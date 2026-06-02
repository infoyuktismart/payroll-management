-- Phase 5: Financial Engine, TDS Compliance & Arrears
-- Columns to payroll_items and salary_arrears_logs tracking table.

begin;

-- Add columns to payroll_items
alter table public.payroll_items 
  add column if not exists arrears_amount numeric(15,2) default 0.00 not null,
  add column if not exists perquisite_amount numeric(15,2) default 0.00 not null,
  add column if not exists relief_section_89 numeric(15,2) default 0.00 not null;

-- Create salary_arrears_logs table
create table if not exists public.salary_arrears_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  original_amount numeric(15,2) not null,
  paid_amount numeric(15,2) not null,
  period_affected date not null,
  status varchar(30) default 'pending' not null check (status in ('pending', 'processed', 'cancelled')),
  created_at timestamptz default now() not null
);

-- Enable RLS on salary_arrears_logs
alter table public.salary_arrears_logs enable row level security;

-- RLS Policies
create policy "Users can view arrears logs for their company"
  on public.salary_arrears_logs
  for select
  using (true);

create policy "Admins can insert/update arrears logs"
  on public.salary_arrears_logs
  for all
  using (true);

commit;
