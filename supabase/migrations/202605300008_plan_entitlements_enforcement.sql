-- Plan entitlement enforcement for feature gates and hard usage limits.

begin;

alter table public.subscription_plans
  add column if not exists feature_keys jsonb not null default '[]'::jsonb;

update public.subscription_plans
set feature_keys = '[
  "core_hr",
  "payroll",
  "attendance",
  "statutory_reports",
  "employee_portal"
]'::jsonb
where plan_code = 'starter';

update public.subscription_plans
set feature_keys = '[
  "core_hr",
  "payroll",
  "attendance",
  "statutory_reports",
  "employee_portal",
  "multi_company",
  "analytics",
  "biometric_import",
  "report_builder"
]'::jsonb
where plan_code = 'growth';

update public.subscription_plans
set feature_keys = '[
  "core_hr",
  "payroll",
  "attendance",
  "statutory_reports",
  "employee_portal",
  "multi_company",
  "analytics",
  "biometric_import",
  "report_builder",
  "audit_logs",
  "security_controls",
  "system_health",
  "white_labeling"
]'::jsonb
where plan_code = 'enterprise';

create or replace function public.get_company_subscription_entitlements(p_company_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'subscription_id', cs.id,
        'status', cs.status,
        'trial_ends_at', cs.trial_ends_at,
        'plan_id', sp.id,
        'plan_code', sp.plan_code,
        'plan_name', sp.name,
        'feature_keys', coalesce(sp.feature_keys, '[]'::jsonb),
        'max_employees', sp.max_employees,
        'max_branches', sp.max_branches,
        'max_companies', sp.max_companies,
        'is_active', (
          cs.status = 'active'
          or (
            cs.status = 'trialing'
            and (cs.trial_ends_at is null or cs.trial_ends_at >= timezone('utc'::text, now()))
          )
        )
      )
      from public.company_subscriptions cs
      join public.subscription_plans sp on sp.id = cs.plan_id
      where cs.company_id = p_company_id
      order by cs.created_at desc
      limit 1
    ),
    '{}'::jsonb
  );
$$;

grant execute on function public.get_company_subscription_entitlements(uuid) to authenticated, service_role;

create or replace function public.company_plan_allows_feature(p_company_id uuid, p_feature_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select (
        (
          cs.status = 'active'
          or (
            cs.status = 'trialing'
            and (cs.trial_ends_at is null or cs.trial_ends_at >= timezone('utc'::text, now()))
          )
        )
        and coalesce(sp.feature_keys, '[]'::jsonb) ? lower(trim(p_feature_key))
      )
      from public.company_subscriptions cs
      join public.subscription_plans sp on sp.id = cs.plan_id
      where cs.company_id = p_company_id
      order by cs.created_at desc
      limit 1
    ),
    false
  );
$$;

grant execute on function public.company_plan_allows_feature(uuid, text) to authenticated, service_role;

create or replace function public.assert_company_plan_feature(p_company_id uuid, p_feature_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted_backend_role() then
    return;
  end if;

  if not public.company_plan_allows_feature(p_company_id, p_feature_key) then
    raise exception 'Your current subscription plan does not include feature: %', p_feature_key
      using errcode = 'P0001';
  end if;
end;
$$;

grant execute on function public.assert_company_plan_feature(uuid, text) to authenticated, service_role;

create or replace function public.enforce_company_employee_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
  v_company_id uuid;
  v_plan_name text;
  v_status text;
begin
  if public.is_trusted_backend_role() then
    return new;
  end if;

  v_company_id := new.company_id;
  if v_company_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and coalesce(old.status, 'active') = 'active'
    and coalesce(new.status, 'active') <> 'active'
  then
    return new;
  end if;

  if coalesce(new.status, 'active') <> 'active' then
    return new;
  end if;

  select sp.max_employees, sp.name, cs.status
  into v_limit, v_plan_name, v_status
  from public.company_subscriptions cs
  join public.subscription_plans sp on sp.id = cs.plan_id
  where cs.company_id = v_company_id
    and (
      cs.status = 'active'
      or (
        cs.status = 'trialing'
        and (cs.trial_ends_at is null or cs.trial_ends_at >= timezone('utc'::text, now()))
      )
    )
  order by cs.created_at desc
  limit 1;

  if v_limit is null or v_limit <= 0 then
    return new;
  end if;

  select count(*)
  into v_count
  from public.employees
  where company_id = v_company_id
    and status = 'active'
    and (tg_op = 'INSERT' or id is distinct from new.id);

  if v_count + 1 > v_limit then
    raise exception '% plan allows up to % active employees. Upgrade the subscription to add more employees.', coalesce(v_plan_name, 'Current'), v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_company_employee_limit on public.employees;
create trigger enforce_company_employee_limit
  before insert or update of company_id, status on public.employees
  for each row execute function public.enforce_company_employee_limit();

create or replace function public.enforce_company_branch_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
  v_plan_name text;
begin
  if public.is_trusted_backend_role() then
    return new;
  end if;

  if new.company_id is null then
    return new;
  end if;

  select sp.max_branches, sp.name
  into v_limit, v_plan_name
  from public.company_subscriptions cs
  join public.subscription_plans sp on sp.id = cs.plan_id
  where cs.company_id = new.company_id
    and (
      cs.status = 'active'
      or (
        cs.status = 'trialing'
        and (cs.trial_ends_at is null or cs.trial_ends_at >= timezone('utc'::text, now()))
      )
    )
  order by cs.created_at desc
  limit 1;

  if v_limit is null or v_limit <= 0 then
    return new;
  end if;

  select count(*)
  into v_count
  from public.branches
  where company_id = new.company_id
    and (tg_op = 'INSERT' or id is distinct from new.id);

  if v_count + 1 > v_limit then
    raise exception '% plan allows up to % branches. Upgrade the subscription to add more branches.', coalesce(v_plan_name, 'Current'), v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_company_branch_limit on public.branches;
create trigger enforce_company_branch_limit
  before insert or update of company_id on public.branches
  for each row execute function public.enforce_company_branch_limit();

commit;
