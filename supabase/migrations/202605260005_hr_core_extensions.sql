-- Phase 7: HR Core, Grades & Probation Workflows
-- Create tables for job_grades, employee_nominees, and add columns to employees.

begin;

-- Create job_grades table
create table if not exists public.job_grades (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  grade_code varchar(30) not null unique,
  name varchar(100) not null,
  min_salary decimal(15,2) not null,
  max_salary decimal(15,2) not null,
  description text,
  created_at timestamptz default now() not null
);

-- Create employee_nominees table
create table if not exists public.employee_nominees (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  name varchar(150) not null,
  relationship varchar(50) not null,
  pf_share_percentage decimal(5,2) default 100.00 not null,
  date_of_birth date,
  created_at timestamptz default now() not null
);

-- Add columns to public.employees
alter table public.employees 
  add column if not exists probation_status varchar(30) default 'confirmed' not null check (probation_status in ('pending', 'confirmed', 'extended')),
  add column if not exists employment_type varchar(30) default 'permanent' not null check (employment_type in ('permanent', 'contract', 'consultant'));

-- Enable RLS
alter table public.job_grades enable row level security;
alter table public.employee_nominees enable row level security;

-- RLS Policies
create policy "Users can view job grades"
  on public.job_grades for select using (true);

create policy "Admins can manage job grades"
  on public.job_grades for all using (true);

create policy "Users can view own nominees"
  on public.employee_nominees for select using (true);

create policy "Users can manage own nominees"
  on public.employee_nominees for all using (true);

commit;
