-- Phase 3: Multi-Company / Multi-Branch Architecture
-- Adds tenant configuration, branch hierarchy, memberships, and company_id scope columns.

begin;

create extension if not exists "uuid-ossp";

create table if not exists public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null unique,
  legal_name text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  primary_domain text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.branches (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  address text,
  city text,
  state text,
  pincode text,
  is_head_office boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (company_id, code)
);

create table if not exists public.user_company_memberships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  role text not null default 'employee',
  is_default boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (user_id, company_id)
);

insert into public.companies (id, name, code, legal_name)
select
  coalesce((select id from public.company_settings order by created_at limit 1), 'd4b00a00-1111-2222-3333-444455556666'::uuid),
  coalesce((select name from public.company_settings order by created_at limit 1), 'Default Company'),
  'DEFAULT',
  coalesce((select name from public.company_settings order by created_at limit 1), 'Default Company')
on conflict (id) do nothing;

insert into public.branches (company_id, name, code, city, state, pincode, is_head_office)
select c.id, 'Head Office', 'HO', cs.city, cs.state, cs.pincode, true
from public.companies c
left join public.company_settings cs on cs.id = c.id
where c.code = 'DEFAULT'
on conflict (company_id, code) do nothing;

alter table public.company_settings add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.employees add column if not exists company_id uuid references public.companies(id);
alter table public.employees add column if not exists branch_id uuid references public.branches(id);
alter table public.departments add column if not exists company_id uuid references public.companies(id);
alter table public.holidays add column if not exists company_id uuid references public.companies(id);
alter table public.leave_policies add column if not exists company_id uuid references public.companies(id);
alter table public.leave_balances add column if not exists company_id uuid references public.companies(id);
alter table public.employee_documents add column if not exists company_id uuid references public.companies(id);
alter table public.generated_reports add column if not exists company_id uuid references public.companies(id);
alter table public.payroll_runs add column if not exists company_id uuid references public.companies(id);
alter table public.payroll_items add column if not exists company_id uuid references public.companies(id);
alter table public.custom_deductions add column if not exists company_id uuid references public.companies(id);
alter table public.attendance add column if not exists company_id uuid references public.companies(id);
alter table public.leaves add column if not exists company_id uuid references public.companies(id);
alter table public.overtime add column if not exists company_id uuid references public.companies(id);
alter table public.salaries add column if not exists company_id uuid references public.companies(id);
alter table public.exits add column if not exists company_id uuid references public.companies(id);
alter table public.salary_components add column if not exists company_id uuid references public.companies(id);
alter table public.tax_declarations add column if not exists company_id uuid references public.companies(id);

do $$
begin
  if to_regclass('public.attendance_punches') is not null then
    alter table public.attendance_punches add column if not exists company_id uuid references public.companies(id);
  end if;
  if to_regclass('public.attendance_regularizations') is not null then
    alter table public.attendance_regularizations add column if not exists company_id uuid references public.companies(id);
  end if;
  if to_regclass('public.onboarding_checklists') is not null then
    alter table public.onboarding_checklists add column if not exists company_id uuid references public.companies(id);
  end if;
  if to_regclass('public.employee_loans') is not null then
    alter table public.employee_loans add column if not exists company_id uuid references public.companies(id);
  end if;
  if to_regclass('public.reimbursements') is not null then
    alter table public.reimbursements add column if not exists company_id uuid references public.companies(id);
  end if;
  if to_regclass('public.notification_logs') is not null then
    alter table public.notification_logs add column if not exists company_id uuid references public.companies(id);
  end if;
end $$;

-- Existing enterprise self-update guard blocks admin migration backfills because
-- it protects company/admin-owned employee columns from employee-side updates.
do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'employees_self_update_guard'
      and tgrelid = 'public.employees'::regclass
  ) then
    alter table public.employees disable trigger employees_self_update_guard;
  end if;
end $$;

with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.company_settings set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.employees set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.departments set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.holidays set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.leave_policies set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.leave_balances set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.payroll_runs set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.payroll_items set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.custom_deductions set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.attendance set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.leaves set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.overtime set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.salaries set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.exits set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.salary_components set company_id = (select id from default_company) where company_id is null;
with default_company as (select id from public.companies where code = 'DEFAULT' limit 1)
update public.tax_declarations set company_id = (select id from default_company) where company_id is null;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'employees_self_update_guard'
      and tgrelid = 'public.employees'::regclass
  ) then
    alter table public.employees enable trigger employees_self_update_guard;
  end if;
end $$;

do $$
declare
  default_company_id uuid := (select id from public.companies where code = 'DEFAULT' limit 1);
begin
  if to_regclass('public.attendance_punches') is not null then
    update public.attendance_punches set company_id = default_company_id where company_id is null;
  end if;
  if to_regclass('public.attendance_regularizations') is not null then
    update public.attendance_regularizations set company_id = default_company_id where company_id is null;
  end if;
  if to_regclass('public.onboarding_checklists') is not null then
    update public.onboarding_checklists set company_id = default_company_id where company_id is null;
  end if;
  if to_regclass('public.employee_loans') is not null then
    update public.employee_loans set company_id = default_company_id where company_id is null;
  end if;
  if to_regclass('public.reimbursements') is not null then
    update public.reimbursements set company_id = default_company_id where company_id is null;
  end if;
  if to_regclass('public.notification_logs') is not null then
    update public.notification_logs set company_id = default_company_id where company_id is null;
  end if;
end $$;

insert into public.user_company_memberships (user_id, company_id, role, is_default)
select distinct e.user_id, e.company_id, coalesce(e.role, 'employee'), true
from public.employees e
where e.user_id is not null and e.company_id is not null
on conflict (user_id, company_id) do update set
  role = excluded.role,
  is_default = public.user_company_memberships.is_default or excluded.is_default;

create index if not exists idx_branches_company_id on public.branches(company_id);
create index if not exists idx_user_company_memberships_user_id on public.user_company_memberships(user_id);
create index if not exists idx_user_company_memberships_company_id on public.user_company_memberships(company_id);
create index if not exists idx_company_settings_company_id on public.company_settings(company_id);
create unique index if not exists idx_company_settings_company_unique on public.company_settings(company_id) where company_id is not null;
create index if not exists idx_employees_company_id on public.employees(company_id);
create index if not exists idx_employees_branch_id on public.employees(branch_id);
create index if not exists idx_departments_company_id on public.departments(company_id);
create index if not exists idx_holidays_company_id on public.holidays(company_id);
create index if not exists idx_leave_policies_company_id on public.leave_policies(company_id);
create index if not exists idx_payroll_runs_company_id on public.payroll_runs(company_id);
create index if not exists idx_payroll_items_company_id on public.payroll_items(company_id);
create index if not exists idx_attendance_company_id on public.attendance(company_id);
create index if not exists idx_leaves_company_id on public.leaves(company_id);
create index if not exists idx_overtime_company_id on public.overtime(company_id);
create index if not exists idx_tax_declarations_company_id on public.tax_declarations(company_id);

alter table public.companies enable row level security;
alter table public.branches enable row level security;
alter table public.user_company_memberships enable row level security;

create or replace function public.user_has_company_access(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin_or_hr()
    or exists (
      select 1
      from public.user_company_memberships ucm
      where ucm.user_id = auth.uid()
        and ucm.company_id = target_company_id
    )
    or exists (
      select 1
      from public.employees e
      where e.user_id = auth.uid()
        and e.company_id = target_company_id
    );
$$;

drop policy if exists "Companies read member or admin" on public.companies;
drop policy if exists "Companies manage admin" on public.companies;
drop policy if exists "Branches read member or admin" on public.branches;
drop policy if exists "Branches manage admin" on public.branches;
drop policy if exists "Company memberships read own or admin" on public.user_company_memberships;
drop policy if exists "Company memberships manage admin" on public.user_company_memberships;

create policy "Companies read member or admin"
  on public.companies for select
  using (public.user_has_company_access(id));

create policy "Companies manage admin"
  on public.companies for all
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy "Branches read member or admin"
  on public.branches for select
  using (public.user_has_company_access(company_id));

create policy "Branches manage admin"
  on public.branches for all
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

create policy "Company memberships read own or admin"
  on public.user_company_memberships for select
  using (user_id = auth.uid() or public.is_admin_or_hr());

create policy "Company memberships manage admin"
  on public.user_company_memberships for all
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

commit;
