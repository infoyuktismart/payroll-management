-- Leave balance and policy engine
-- Apply after 202605230001_enterprise_security_audit.sql.

begin;

alter table public.leaves add column if not exists days numeric default 0;
alter table public.leaves add column if not exists balance_deducted numeric default 0;
alter table public.leaves add column if not exists policy_year integer default extract(year from current_date)::integer;
alter table public.leaves add column if not exists approved_at timestamp with time zone;
alter table public.leaves add column if not exists approved_by uuid references auth.users;
alter table public.leaves add column if not exists rejected_at timestamp with time zone;
alter table public.leaves add column if not exists rejected_by uuid references auth.users;

create index if not exists idx_leave_balances_employee_type_year
  on public.leave_balances(employee_id, lower(leave_type), year);

create or replace function public.normalize_leave_type(value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(value, ''), '[^a-z0-9]+', '', 'g'));
$$;

create or replace function public.calculate_leave_days(start_date date, end_date date)
returns numeric
language sql
stable
as $$
  select coalesce(count(*)::numeric, 0)
  from generate_series(start_date, end_date, interval '1 day') as day(value)
  where extract(dow from day.value) <> 0
    and not exists (
      select 1
      from public.holidays h
      where h.date = day.value::date
    );
$$;

create or replace function public.resolve_leave_policy_name(requested_type text)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select lp.leave_type
      from public.leave_policies lp
      where public.normalize_leave_type(lp.leave_type) = public.normalize_leave_type(requested_type)
        and coalesce(lp.status, 'Active') = 'Active'
      limit 1
    ),
    requested_type
  );
$$;

create or replace function public.ensure_leave_balance(
  p_employee_id uuid,
  p_leave_type text,
  p_year integer
)
returns public.leave_balances
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_balance numeric := 0;
  resolved_type text := public.resolve_leave_policy_name(p_leave_type);
  balance_row public.leave_balances;
begin
  select coalesce(annual_balance, 0)
  into policy_balance
  from public.leave_policies
  where public.normalize_leave_type(leave_type) = public.normalize_leave_type(resolved_type)
    and coalesce(status, 'Active') = 'Active'
  limit 1;

  insert into public.leave_balances (employee_id, leave_type, balance, year)
  values (p_employee_id, resolved_type, coalesce(policy_balance, 0), p_year)
  on conflict (employee_id, leave_type, year) do nothing;

  select *
  into balance_row
  from public.leave_balances
  where employee_id = p_employee_id
    and public.normalize_leave_type(leave_type) = public.normalize_leave_type(resolved_type)
    and year = p_year
  limit 1;

  return balance_row;
end;
$$;

create or replace function public.sync_employee_leave_balance(p_employee_id uuid, p_year integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.employees e
  set leave_balance = coalesce((
    select sum(balance)
    from public.leave_balances lb
    where lb.employee_id = p_employee_id
      and lb.year = p_year
  ), e.leave_balance)
  where e.id = p_employee_id;
$$;

create or replace function public.sync_leave_attendance(
  p_leave_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  leave_row public.leaves;
  current_day date;
  fallback_status text;
begin
  select *
  into leave_row
  from public.leaves
  where id = p_leave_id;

  if not found then
    raise exception 'Leave request not found.';
  end if;

  current_day := leave_row.start_date;
  while current_day <= leave_row.end_date loop
    if p_status = 'approved' then
      if extract(dow from current_day) <> 0
        and not exists (select 1 from public.holidays h where h.date = current_day)
      then
        insert into public.attendance (employee_id, date, status, remarks)
        values (leave_row.employee_id, current_day, 'on_leave', 'Approved Leave: ' || leave_row.leave_type)
        on conflict (employee_id, date) do update
          set status = 'on_leave',
              remarks = excluded.remarks,
              updated_at = timezone('utc'::text, now());
      end if;
    elsif p_status = 'rejected' then
      fallback_status := case
        when extract(dow from current_day) = 0 then 'weekly_off'
        when exists (select 1 from public.holidays h where h.date = current_day) then 'on_leave'
        else 'absent'
      end;

      insert into public.attendance (employee_id, date, status, remarks)
      values (leave_row.employee_id, current_day, fallback_status, 'Leave Request Rejected')
      on conflict (employee_id, date) do update
        set status = case when public.attendance.status = 'on_leave' then excluded.status else public.attendance.status end,
            remarks = 'Leave Request Rejected',
            updated_at = timezone('utc'::text, now());
    end if;

    current_day := current_day + 1;
  end loop;
end;
$$;

create or replace function public.approve_leave_request(p_leave_id uuid)
returns public.leaves
language plpgsql
security definer
set search_path = public
as $$
declare
  leave_row public.leaves;
  balance_row public.leave_balances;
  leave_days numeric;
  resolved_type text;
  target_year integer;
begin
  if not public.is_admin_or_hr() then
    raise exception 'Only HR or Admin can approve leave.';
  end if;

  select *
  into leave_row
  from public.leaves
  where id = p_leave_id
  for update;

  if not found then
    raise exception 'Leave request not found.';
  end if;

  if leave_row.status = 'approved' then
    return leave_row;
  end if;

  target_year := extract(year from leave_row.start_date)::integer;
  resolved_type := public.resolve_leave_policy_name(leave_row.leave_type);
  leave_days := public.calculate_leave_days(leave_row.start_date, leave_row.end_date);

  if leave_days <= 0 then
    raise exception 'Selected dates do not contain payable leave days.';
  end if;

  balance_row := public.ensure_leave_balance(leave_row.employee_id, resolved_type, target_year);

  if balance_row.balance < leave_days then
    raise exception 'Insufficient % balance. Available: %, requested: %', resolved_type, balance_row.balance, leave_days;
  end if;

  update public.leave_balances
  set balance = balance - leave_days,
      updated_at = timezone('utc'::text, now())
  where id = balance_row.id;

  update public.leaves
  set status = 'approved',
      leave_type = resolved_type,
      days = leave_days,
      balance_deducted = leave_days,
      policy_year = target_year,
      approved_at = timezone('utc'::text, now()),
      approved_by = auth.uid(),
      rejected_at = null,
      rejected_by = null,
      updated_at = timezone('utc'::text, now())
  where id = p_leave_id
  returning * into leave_row;

  perform public.sync_employee_leave_balance(leave_row.employee_id, target_year);
  perform public.sync_leave_attendance(p_leave_id, 'approved');

  return leave_row;
end;
$$;

create or replace function public.reject_leave_request(p_leave_id uuid)
returns public.leaves
language plpgsql
security definer
set search_path = public
as $$
declare
  leave_row public.leaves;
  target_year integer;
begin
  if not public.is_admin_or_hr() then
    raise exception 'Only HR or Admin can reject leave.';
  end if;

  select *
  into leave_row
  from public.leaves
  where id = p_leave_id
  for update;

  if not found then
    raise exception 'Leave request not found.';
  end if;

  target_year := coalesce(leave_row.policy_year, extract(year from leave_row.start_date)::integer);

  if leave_row.status = 'approved' and coalesce(leave_row.balance_deducted, 0) > 0 then
    update public.leave_balances
    set balance = balance + leave_row.balance_deducted,
        updated_at = timezone('utc'::text, now())
    where employee_id = leave_row.employee_id
      and public.normalize_leave_type(leave_type) = public.normalize_leave_type(leave_row.leave_type)
      and year = target_year;
  end if;

  update public.leaves
  set status = 'rejected',
      rejected_at = timezone('utc'::text, now()),
      rejected_by = auth.uid(),
      approved_at = null,
      approved_by = null,
      balance_deducted = 0,
      updated_at = timezone('utc'::text, now())
  where id = p_leave_id
  returning * into leave_row;

  perform public.sync_employee_leave_balance(leave_row.employee_id, target_year);
  perform public.sync_leave_attendance(p_leave_id, 'rejected');

  return leave_row;
end;
$$;

create or replace function public.initialize_leave_balances(p_year integer default extract(year from current_date)::integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_hr() then
    raise exception 'Only HR or Admin can initialize leave balances.';
  end if;

  insert into public.leave_balances (employee_id, leave_type, balance, year)
  select e.id, lp.leave_type, lp.annual_balance, p_year
  from public.employees e
  cross join public.leave_policies lp
  where coalesce(e.status, 'active') = 'active'
    and coalesce(lp.status, 'Active') = 'Active'
  on conflict (employee_id, leave_type, year) do nothing;
end;
$$;

create or replace function public.initialize_employee_leave_balances()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_year integer := extract(year from coalesce(new.joining_date, current_date))::integer;
begin
  insert into public.leave_balances (employee_id, leave_type, balance, year)
  select new.id, lp.leave_type, lp.annual_balance, target_year
  from public.leave_policies lp
  where coalesce(lp.status, 'Active') = 'Active'
  on conflict (employee_id, leave_type, year) do nothing;

  perform public.sync_employee_leave_balance(new.id, target_year);
  return new;
end;
$$;

drop trigger if exists employees_initialize_leave_balances on public.employees;
create trigger employees_initialize_leave_balances
  after insert on public.employees
  for each row execute function public.initialize_employee_leave_balances();

commit;
