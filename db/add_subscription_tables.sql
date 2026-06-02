-- Phase 7: Enterprise Administration
-- Adds subscription, plan, usage, health-check, and admin audit metadata.

begin;

create extension if not exists "uuid-ossp";

create table if not exists public.subscription_plans (
  id uuid primary key default uuid_generate_v4(),
  plan_code text not null unique,
  name text not null,
  description text,
  monthly_price numeric(12,2) not null default 0,
  annual_price numeric(12,2) not null default 0,
  currency text not null default 'INR',
  max_employees integer,
  max_companies integer,
  max_branches integer,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.company_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  trial_ends_at timestamp with time zone,
  current_period_start timestamp with time zone not null default timezone('utc'::text, now()),
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean not null default false,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (company_id)
);

create table if not exists public.subscription_usage_counters (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  metric_key text not null,
  metric_value numeric(15,2) not null default 0,
  metric_limit numeric(15,2),
  period_start date not null default date_trunc('month', timezone('utc'::text, now()))::date,
  period_end date not null default (date_trunc('month', timezone('utc'::text, now())) + interval '1 month - 1 day')::date,
  source text not null default 'system',
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (company_id, metric_key, period_start)
);

create table if not exists public.system_health_checks (
  id uuid primary key default uuid_generate_v4(),
  check_key text not null,
  status text not null default 'unknown' check (status in ('healthy', 'warning', 'critical', 'unknown')),
  message text,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.audit_logs add column if not exists company_id uuid references public.companies(id) on delete set null;
create index if not exists idx_audit_logs_company_created_at on public.audit_logs(company_id, created_at desc);
create index if not exists idx_subscription_plans_active_sort on public.subscription_plans(is_active, sort_order);
create index if not exists idx_company_subscriptions_company_id on public.company_subscriptions(company_id);
create index if not exists idx_subscription_usage_company_metric on public.subscription_usage_counters(company_id, metric_key);
create index if not exists idx_system_health_checks_key_checked_at on public.system_health_checks(check_key, checked_at desc);

alter table public.subscription_plans enable row level security;
alter table public.company_subscriptions enable row level security;
alter table public.subscription_usage_counters enable row level security;
alter table public.system_health_checks enable row level security;

drop policy if exists "Subscription plans read authenticated" on public.subscription_plans;
drop policy if exists "Subscription plans manage admin" on public.subscription_plans;
drop policy if exists "Company subscriptions read admin" on public.company_subscriptions;
drop policy if exists "Company subscriptions manage admin" on public.company_subscriptions;
drop policy if exists "Usage counters read admin" on public.subscription_usage_counters;
drop policy if exists "Usage counters manage admin" on public.subscription_usage_counters;
drop policy if exists "System health read admin" on public.system_health_checks;
drop policy if exists "System health manage admin" on public.system_health_checks;

create policy "Subscription plans read authenticated"
  on public.subscription_plans for select
  using (auth.role() = 'authenticated');

create policy "Subscription plans manage admin"
  on public.subscription_plans for all
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy "Company subscriptions read admin"
  on public.company_subscriptions for select
  using (public.is_admin_or_hr());

create policy "Company subscriptions manage admin"
  on public.company_subscriptions for all
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy "Usage counters read admin"
  on public.subscription_usage_counters for select
  using (public.is_admin_or_hr());

create policy "Usage counters manage admin"
  on public.subscription_usage_counters for all
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy "System health read admin"
  on public.system_health_checks for select
  using (public.is_admin_or_hr());

create policy "System health manage admin"
  on public.system_health_checks for all
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists subscription_plans_touch_updated_at on public.subscription_plans;
create trigger subscription_plans_touch_updated_at
  before update on public.subscription_plans
  for each row execute function public.touch_updated_at();

drop trigger if exists company_subscriptions_touch_updated_at on public.company_subscriptions;
create trigger company_subscriptions_touch_updated_at
  before update on public.company_subscriptions
  for each row execute function public.touch_updated_at();

drop trigger if exists subscription_usage_counters_touch_updated_at on public.subscription_usage_counters;
create trigger subscription_usage_counters_touch_updated_at
  before update on public.subscription_usage_counters
  for each row execute function public.touch_updated_at();

insert into public.subscription_plans
  (plan_code, name, description, monthly_price, annual_price, max_employees, max_companies, max_branches, features, sort_order)
values
  ('starter', 'Starter', 'Core payroll and HR for small teams.', 2999, 29990, 50, 1, 2, '["Payroll processing", "Attendance", "Employee portal", "Statutory reports"]'::jsonb, 10),
  ('growth', 'Growth', 'Multi-branch payroll with analytics and integrations.', 7999, 79990, 250, 3, 10, '["Everything in Starter", "Multi-company", "Analytics", "Biometric import", "Tally exports"]'::jsonb, 20),
  ('enterprise', 'Enterprise', 'Advanced controls for larger organizations.', 19999, 199990, null, null, null, '["Everything in Growth", "2FA controls", "Audit logs", "System health", "Priority support"]'::jsonb, 30)
on conflict (plan_code) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  max_employees = excluded.max_employees,
  max_companies = excluded.max_companies,
  max_branches = excluded.max_branches,
  features = excluded.features,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc'::text, now());

insert into public.company_subscriptions (company_id, plan_id, status, billing_cycle, trial_ends_at, current_period_end)
select
  c.id,
  (select id from public.subscription_plans where plan_code = 'growth' limit 1),
  'trialing',
  'monthly',
  timezone('utc'::text, now()) + interval '14 days',
  timezone('utc'::text, now()) + interval '1 month'
from public.companies c
on conflict (company_id) do nothing;

insert into public.subscription_usage_counters (company_id, metric_key, metric_value, metric_limit, source)
select c.id, 'employees', coalesce(emp.count, 0), sp.max_employees, 'seed'
from public.companies c
left join lateral (
  select count(*)::numeric as count from public.employees e where e.company_id = c.id
) emp on true
left join public.company_subscriptions cs on cs.company_id = c.id
left join public.subscription_plans sp on sp.id = cs.plan_id
on conflict (company_id, metric_key, period_start) do update set
  metric_value = excluded.metric_value,
  metric_limit = excluded.metric_limit,
  updated_at = timezone('utc'::text, now());

do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_row_change' and pronamespace = 'public'::regnamespace) then
    drop trigger if exists subscription_plans_audit on public.subscription_plans;
    create trigger subscription_plans_audit after insert or update or delete on public.subscription_plans
      for each row execute function public.audit_row_change();

    drop trigger if exists company_subscriptions_audit on public.company_subscriptions;
    create trigger company_subscriptions_audit after insert or update or delete on public.company_subscriptions
      for each row execute function public.audit_row_change();

    drop trigger if exists subscription_usage_counters_audit on public.subscription_usage_counters;
    create trigger subscription_usage_counters_audit after insert or update or delete on public.subscription_usage_counters
      for each row execute function public.audit_row_change();
  end if;
end $$;

commit;
