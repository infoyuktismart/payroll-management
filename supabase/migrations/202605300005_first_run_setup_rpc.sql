-- Isolate first-run company setup from normal employee self-signup triggers.

begin;

create or replace function public.set_first_run_auth_trigger_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_enabled then
    alter table auth.users enable trigger on_auth_user_created;
  else
    alter table auth.users disable trigger on_auth_user_created;
  end if;
end;
$$;

grant execute on function public.set_first_run_auth_trigger_enabled(boolean) to service_role;

create or replace function public.set_first_run_public_trigger_enabled(
  p_table regclass,
  p_trigger_name text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = p_table
      and tgname = p_trigger_name
      and not tgisinternal
  ) then
    execute format(
      'alter table %s %s trigger %I',
      p_table,
      case when p_enabled then 'enable' else 'disable' end,
      p_trigger_name
    );
  end if;
end;
$$;

grant execute on function public.set_first_run_public_trigger_enabled(regclass, text, boolean) to service_role;

create or replace function public.setup_first_run_workspace(
  p_company_name text,
  p_company_code text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_branch_id uuid;
  v_employee_id uuid;
  v_plan_id uuid;
  v_max_employees integer;
begin
  if p_user_id is null then
    raise exception 'User ID is required to initialize company setup.';
  end if;

  if not public.is_first_run() then
    raise exception 'The system has already been initialized.';
  end if;

  perform public.set_first_run_public_trigger_enabled('public.employees'::regclass, 'employees_self_update_guard', false);
  perform public.set_first_run_public_trigger_enabled('public.profiles'::regclass, 'profiles_self_update_guard', false);

  begin
  delete from public.employees
  where lower(trim(email)) = lower(trim(p_email));

  insert into public.profiles (id, email, role)
  values (p_user_id, lower(trim(p_email)), 'admin')
  on conflict (id) do update set
    email = excluded.email,
    role = 'admin';

  insert into public.companies (name, code, legal_name, status)
  values (trim(p_company_name), upper(trim(p_company_code)), trim(p_company_name), 'active')
  on conflict (code) do update set
    name = excluded.name,
    legal_name = excluded.legal_name,
    status = 'active'
  returning id into v_company_id;

  insert into public.branches (company_id, name, code, is_head_office, status)
  values (v_company_id, 'Head Office', 'HO', true, 'active')
  on conflict (company_id, code) do update set
    name = excluded.name,
    is_head_office = true,
    status = 'active'
  returning id into v_branch_id;

  insert into public.employees (
    user_id,
    company_id,
    branch_id,
    employee_id,
    first_name,
    last_name,
    email,
    designation,
    department,
    status,
    role,
    joining_date,
    salary
  ) values (
    p_user_id,
    v_company_id,
    v_branch_id,
    'EMP001',
    trim(p_first_name),
    trim(p_last_name),
    lower(trim(p_email)),
    'Administrator',
    'IT',
    'active',
    'admin',
    current_date,
    50000
  )
  returning id into v_employee_id;

  insert into public.user_company_memberships (user_id, company_id, branch_id, role, is_default)
  values (p_user_id, v_company_id, v_branch_id, 'admin', true)
  on conflict (user_id, company_id) do update set
    branch_id = excluded.branch_id,
    role = 'admin',
    is_default = true;

  select id, max_employees
  into v_plan_id, v_max_employees
  from public.subscription_plans
  where plan_code = 'growth'
  limit 1;

  if v_plan_id is not null then
    insert into public.company_subscriptions (
      company_id,
      plan_id,
      status,
      billing_cycle,
      trial_ends_at,
      current_period_start,
      current_period_end,
      billing_model
    )
    values (
      v_company_id,
      v_plan_id,
      'trialing',
      'monthly',
      timezone('utc'::text, now()) + interval '14 days',
      timezone('utc'::text, now()),
      timezone('utc'::text, now()) + interval '14 days',
      'per_employee'
    );

    insert into public.subscription_usage_counters (
      company_id,
      metric_key,
      metric_value,
      metric_limit,
      source
    )
    values (
      v_company_id,
      'employees',
      1,
      v_max_employees,
      'setup'
    );
  end if;

  perform public.set_first_run_public_trigger_enabled('public.profiles'::regclass, 'profiles_self_update_guard', true);
  perform public.set_first_run_public_trigger_enabled('public.employees'::regclass, 'employees_self_update_guard', true);

  return json_build_object(
    'success', true,
    'company_id', v_company_id,
    'branch_id', v_branch_id,
    'employee_id', v_employee_id
  );
  exception when others then
    perform public.set_first_run_public_trigger_enabled('public.profiles'::regclass, 'profiles_self_update_guard', true);
    perform public.set_first_run_public_trigger_enabled('public.employees'::regclass, 'employees_self_update_guard', true);
    raise;
  end;
end;
$$;

grant execute on function public.setup_first_run_workspace(text, text, text, text, text, uuid) to service_role;

commit;
