-- Allow trusted Supabase service-role automation to run setup/linking flows.
-- RLS is bypassed by service_role, but table triggers still execute and need
-- an explicit service-role escape hatch.

begin;

create or replace function public.is_trusted_backend_role()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    or session_user in ('supabase_auth_admin', 'service_role');
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((select lower(trim(role)) from public.profiles where id = auth.uid()), ''),
    nullif((select lower(trim(role)) from public.employees where user_id = auth.uid() limit 1), ''),
    'employee'
  );
$$;

create or replace function public.is_admin_or_hr()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_role() in (
    'service_role',
    'admin',
    'administrator',
    'superadmin',
    'hr',
    'hr_manager',
    'hr manager',
    'hr-admin',
    'hr_admin',
    'hr_admin_manager',
    'hr administrator',
    'hr_head',
    'hr_executive',
    'human resources'
  );
$$;

create or replace function public.enforce_employee_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.allow_employee_system_update', true) = 'true' then
    return new;
  end if;

  if public.is_trusted_backend_role() then
    return new;
  end if;

  if public.is_admin_or_hr() then
    return new;
  end if;

  if old.user_id is distinct from auth.uid() then
    raise exception 'Employees can only update their own profile.';
  end if;

  if old.employee_id is distinct from new.employee_id
    or old.user_id is distinct from new.user_id
    or old.role is distinct from new.role
    or old.department is distinct from new.department
    or old.designation is distinct from new.designation
    or old.reporting_person is distinct from new.reporting_person
    or old.salary is distinct from new.salary
    or old.salary_allowances is distinct from new.salary_allowances
    or old.salary_deductions is distinct from new.salary_deductions
    or old.salary_structure is distinct from new.salary_structure
    or old.salary_effective_date is distinct from new.salary_effective_date
    or old.pan_number is distinct from new.pan_number
    or old.aadhaar_number is distinct from new.aadhaar_number
    or old.bank_account_number is distinct from new.bank_account_number
    or old.pan_number_enc is distinct from new.pan_number_enc
    or old.aadhaar_number_enc is distinct from new.aadhaar_number_enc
    or old.bank_account_number_enc is distinct from new.bank_account_number_enc
    or old.leave_balance is distinct from new.leave_balance
    or old.status is distinct from new.status
    or old.created_by is distinct from new.created_by
  then
    raise exception 'This profile field can only be changed by HR or Admin.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted_backend_role() then
    return new;
  end if;

  if public.is_admin_or_hr() then
    return new;
  end if;

  if old.id is distinct from new.id
    or old.email is distinct from new.email
    or old.role is distinct from new.role
  then
    raise exception 'Profile identity and role can only be changed by HR or Admin.';
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_role text;
  v_employee_id uuid;
  v_is_setup_admin boolean := coalesce((new.raw_user_meta_data ->> 'setup_admin')::boolean, false);
begin
  -- First-run setup creates the admin employee explicitly in the setup-company
  -- Edge Function. Do not run employee self-signup auto-linking for that path,
  -- because it can collide with stale setup rows and the employee self-update
  -- guard before the first admin profile exists.
  if v_is_setup_admin then
    insert into public.profiles (id, email, role)
    values (new.id, new.email, 'admin')
    on conflict (id) do update set
      email = excluded.email,
      role = 'admin';

    return new;
  end if;

  select id, role
  into v_employee_id, v_employee_role
  from public.employees
  where lower(trim(email)) = lower(trim(new.email))
    and status = 'active'
  limit 1;

  if v_employee_id is not null then
    perform set_config('app.allow_employee_system_update', 'true', true);

    update public.employees
    set user_id = new.id,
        updated_at = timezone('utc'::text, now())
    where id = v_employee_id
      and user_id is null;
  end if;

  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(v_employee_role, 'employee')
  )
  on conflict (id) do update set
    email = excluded.email,
    role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

commit;
