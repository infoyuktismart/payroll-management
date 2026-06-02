-- Phase 9: Multi-Tenant Client Registration RPC
-- Allows any newly registered authenticated user to provision their own company workspace and trial subscription.

begin;

create or replace function public.register_new_tenant(
  p_company_name text,
  p_company_code text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_plan_code text default 'growth',
  p_billing_model text default 'per_employee'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_company_id uuid;
  v_branch_id uuid;
  v_plan_id uuid;
  v_employee_id uuid;
  v_max_employees integer;
begin
  -- 1. Check if user is authenticated
  if v_auth_user is null then
    raise exception 'Authentication is required to register a company workspace.';
  end if;

  -- 2. Verify p_company_code doesn't already exist to avoid clean key violations
  if exists (select 1 from public.companies where upper(code) = upper(p_company_code)) then
    raise exception 'Company code % is already taken. Please choose a different short code.', upper(p_company_code);
  end if;

  -- 3. Get plan details
  select id, max_employees into v_plan_id, v_max_employees
  from public.subscription_plans
  where plan_code = p_plan_code;

  if v_plan_id is null then
    -- Fallback to the growth plan if starter or custom code isn't seeded properly
    select id, max_employees into v_plan_id, v_max_employees
    from public.subscription_plans
    where plan_code = 'growth'
    limit 1;
  end if;

  -- 4. Create the Company
  insert into public.companies (name, code, status)
  values (p_company_name, upper(p_company_code), 'active')
  returning id into v_company_id;

  -- 5. Create default branch (Head Office)
  insert into public.branches (company_id, name, code, is_head_office, status)
  values (v_company_id, 'Head Office', 'HO', true, 'active')
  returning id into v_branch_id;

  -- 6. Create the Employee record as Admin
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
    v_auth_user,
    v_company_id,
    v_branch_id,
    'EMP001',
    p_first_name,
    p_last_name,
    p_email,
    'Administrator',
    'IT',
    'active',
    'admin',
    current_date,
    0
  )
  returning id into v_employee_id;

  -- 7. Update the user profile to Admin
  update public.profiles
  set role = 'admin'
  where id = v_auth_user;

  -- 8. Create the default Membership
  insert into public.user_company_memberships (user_id, company_id, branch_id, role, is_default)
  values (v_auth_user, v_company_id, v_branch_id, 'admin', true);

  -- 9. Create default subscription (14-day trial)
  insert into public.company_subscriptions (
    company_id,
    plan_id,
    status,
    billing_cycle,
    trial_ends_at,
    current_period_start,
    current_period_end,
    billing_model
  ) values (
    v_company_id,
    v_plan_id,
    'trialing',
    'monthly',
    timezone('utc'::text, now()) + interval '14 days',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()) + interval '14 days',
    p_billing_model
  );

  -- 10. Seed dynamic subscription usage counters
  insert into public.subscription_usage_counters (
    company_id,
    metric_key,
    metric_value,
    metric_limit,
    source
  ) values (
    v_company_id,
    'employees',
    1,
    v_max_employees,
    'signup'
  );

  return json_build_object(
    'success', true,
    'company_id', v_company_id,
    'branch_id', v_branch_id,
    'employee_id', v_employee_id
  );
end;
$$;

grant execute on function public.register_new_tenant(text, text, text, text, text, text, text) to authenticated;

commit;
