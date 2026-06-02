-- Trusted backend RPC for public client trial registration.
-- The Edge Function creates/confirms the auth user with service-role, then this
-- function provisions the tenant, admin employee, membership, and 14-day trial.

begin;

create or replace function public.setup_trial_workspace(
  p_company_name text,
  p_company_code text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_user_id uuid,
  p_plan_code text default 'growth',
  p_billing_model text default 'per_employee'
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
  v_plan_code text := coalesce(nullif(lower(trim(p_plan_code)), ''), 'growth');
  v_billing_model text := coalesce(nullif(lower(trim(p_billing_model)), ''), 'per_employee');
begin
  if not public.is_trusted_backend_role() then
    raise exception 'Only trusted backend services can create trial workspaces.';
  end if;

  if p_user_id is null then
    raise exception 'User ID is required to create a trial workspace.';
  end if;

  if trim(coalesce(p_company_name, '')) = ''
    or trim(coalesce(p_company_code, '')) = ''
    or trim(coalesce(p_first_name, '')) = ''
    or trim(coalesce(p_last_name, '')) = ''
    or trim(coalesce(p_email, '')) = ''
  then
    raise exception 'Company and administrator details are required.';
  end if;

  if v_billing_model not in ('flat', 'per_employee') then
    v_billing_model := 'per_employee';
  end if;

  if exists (select 1 from public.companies where upper(code) = upper(trim(p_company_code))) then
    raise exception 'Company code % is already taken. Please choose a different short code.', upper(trim(p_company_code));
  end if;

  if exists (
    select 1
    from public.employees
    where lower(trim(email)) = lower(trim(p_email))
      and user_id is not null
  ) then
    raise exception 'This admin email is already linked to an existing employee account.';
  end if;

  perform public.set_first_run_public_trigger_enabled('public.employees'::regclass, 'employees_self_update_guard', false);
  perform public.set_first_run_public_trigger_enabled('public.profiles'::regclass, 'profiles_self_update_guard', false);

  begin
    select id, max_employees
    into v_plan_id, v_max_employees
    from public.subscription_plans
    where plan_code = v_plan_code
      and is_active = true
    limit 1;

    if v_plan_id is null then
      select id, max_employees
      into v_plan_id, v_max_employees
      from public.subscription_plans
      where plan_code = 'growth'
        and is_active = true
      limit 1;
    end if;

    insert into public.profiles (id, email, role)
    values (p_user_id, lower(trim(p_email)), 'admin')
    on conflict (id) do update set
      email = excluded.email,
      role = 'admin';

    insert into public.companies (name, code, legal_name, status, tenant_subdomain)
    values (
      trim(p_company_name),
      upper(trim(p_company_code)),
      trim(p_company_name),
      'active',
      lower(trim(p_company_code))
    )
    returning id into v_company_id;

    insert into public.branches (company_id, name, code, is_head_office, status)
    values (v_company_id, 'Head Office', 'HO', true, 'active')
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
      'HR & Payroll',
      'active',
      'admin',
      current_date,
      0
    )
    returning id into v_employee_id;

    insert into public.user_company_memberships (user_id, company_id, branch_id, role, is_default)
    values (p_user_id, v_company_id, v_branch_id, 'admin', true)
    on conflict (user_id, company_id) do update set
      branch_id = excluded.branch_id,
      role = 'admin',
      is_default = true;

    if v_plan_id is not null then
      insert into public.company_subscriptions (
        company_id,
        plan_id,
        status,
        billing_cycle,
        trial_ends_at,
        current_period_start,
        current_period_end,
        billing_model,
        metadata
      )
      values (
        v_company_id,
        v_plan_id,
        'trialing',
        'monthly',
        timezone('utc'::text, now()) + interval '14 days',
        timezone('utc'::text, now()),
        timezone('utc'::text, now()) + interval '14 days',
        v_billing_model,
        jsonb_build_object('source', 'public_trial_registration')
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
        'trial_registration'
      );
    end if;

    perform public.set_first_run_public_trigger_enabled('public.profiles'::regclass, 'profiles_self_update_guard', true);
    perform public.set_first_run_public_trigger_enabled('public.employees'::regclass, 'employees_self_update_guard', true);

    return json_build_object(
      'success', true,
      'company_id', v_company_id,
      'branch_id', v_branch_id,
      'employee_id', v_employee_id,
      'plan_code', coalesce(v_plan_code, 'growth'),
      'trial_ends_at', timezone('utc'::text, now()) + interval '14 days'
    );
  exception when undefined_column then
    perform public.set_first_run_public_trigger_enabled('public.profiles'::regclass, 'profiles_self_update_guard', true);
    perform public.set_first_run_public_trigger_enabled('public.employees'::regclass, 'employees_self_update_guard', true);
    raise exception 'SaaS registration schema is incomplete. Run multi-company, subscription, and white-labelling migrations first.';
  when others then
    perform public.set_first_run_public_trigger_enabled('public.profiles'::regclass, 'profiles_self_update_guard', true);
    perform public.set_first_run_public_trigger_enabled('public.employees'::regclass, 'employees_self_update_guard', true);
    raise;
  end;
end;
$$;

grant execute on function public.setup_trial_workspace(text, text, text, text, text, uuid, text, text) to service_role;

commit;
