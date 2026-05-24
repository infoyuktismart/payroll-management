-- TDS declaration module for Indian payroll.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.tax_declarations (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references public.employees(id) on delete cascade not null,
  financial_year text not null,
  regime text not null default 'new' check (regime in ('old', 'new')),
  section_80c numeric(15, 2) default 0,
  section_80d numeric(15, 2) default 0,
  hra_exemption numeric(15, 2) default 0,
  home_loan_interest numeric(15, 2) default 0,
  other_deductions numeric(15, 2) default 0,
  other_income numeric(15, 2) default 0,
  tds_already_deducted numeric(15, 2) default 0,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  notes text,
  reviewed_by uuid references auth.users,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(employee_id, financial_year)
);

create table if not exists public.tax_regime_configs (
  id uuid default gen_random_uuid() primary key,
  financial_year text not null unique,
  config jsonb not null default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_tax_declarations_employee_year on public.tax_declarations(employee_id, financial_year);
create index if not exists idx_tax_declarations_status on public.tax_declarations(status);

alter table public.tax_declarations enable row level security;
alter table public.tax_regime_configs enable row level security;

drop policy if exists "Tax declarations select own or admin" on public.tax_declarations;
drop policy if exists "Tax declarations insert own or admin" on public.tax_declarations;
drop policy if exists "Tax declarations update own draft or admin" on public.tax_declarations;
drop policy if exists "Tax declarations delete admin" on public.tax_declarations;
drop policy if exists "Tax configs read authenticated" on public.tax_regime_configs;
drop policy if exists "Tax configs manage admin" on public.tax_regime_configs;

create policy "Tax declarations select own or admin"
  on public.tax_declarations for select
  using (
    public.is_admin_or_hr()
    or exists (
      select 1 from public.employees e
      where e.id = tax_declarations.employee_id
        and e.user_id = auth.uid()
    )
  );

create policy "Tax declarations insert own or admin"
  on public.tax_declarations for insert
  with check (
    public.is_admin_or_hr()
    or exists (
      select 1 from public.employees e
      where e.id = tax_declarations.employee_id
        and e.user_id = auth.uid()
    )
  );

create policy "Tax declarations update own draft or admin"
  on public.tax_declarations for update
  using (
    public.is_admin_or_hr()
    or (
      status in ('draft', 'rejected')
      and exists (
        select 1 from public.employees e
        where e.id = tax_declarations.employee_id
          and e.user_id = auth.uid()
      )
    )
  )
  with check (
    public.is_admin_or_hr()
    or (
      status in ('draft', 'submitted')
      and exists (
        select 1 from public.employees e
        where e.id = tax_declarations.employee_id
          and e.user_id = auth.uid()
      )
    )
  );

create policy "Tax declarations delete admin"
  on public.tax_declarations for delete
  using (public.is_admin_or_hr());

create policy "Tax configs read authenticated"
  on public.tax_regime_configs for select
  using (auth.role() = 'authenticated');

create policy "Tax configs manage admin"
  on public.tax_regime_configs for all
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

drop trigger if exists tax_declarations_audit on public.tax_declarations;
create trigger tax_declarations_audit after insert or update or delete on public.tax_declarations
  for each row execute function public.audit_row_change();

drop trigger if exists tax_regime_configs_audit on public.tax_regime_configs;
create trigger tax_regime_configs_audit after insert or update or delete on public.tax_regime_configs
  for each row execute function public.audit_row_change();

insert into public.tax_regime_configs (financial_year, config, is_active)
values (
  '2026-27',
  '{
    "standardDeductionNew": 75000,
    "standardDeductionOld": 50000,
    "rebateLimitNew": 1200000,
    "rebateLimitOld": 500000,
    "rebateAmountNew": 60000,
    "rebateAmountOld": 12500,
    "cessRate": 0.04
  }'::jsonb,
  true
)
on conflict (financial_year) do nothing;

commit;
