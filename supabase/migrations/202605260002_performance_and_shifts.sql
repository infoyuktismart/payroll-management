-- SQL Migration: Performance tracking and Shift Management tables

begin;

-- Create shifts table
create table if not exists public.shifts (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  grace_period_mins integer default 15 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create employee_shifts mapping table
create table if not exists public.employee_shifts (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references public.employees(id) on delete cascade not null,
  shift_id uuid references public.shifts(id) on delete cascade not null,
  start_date date not null,
  end_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(employee_id, shift_id, start_date)
);

-- Create performance_goals table
create table if not exists public.performance_goals (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references public.employees(id) on delete cascade not null,
  title text not null,
  description text,
  target_date date not null,
  weightage integer default 20 not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create performance_reviews table
create table if not exists public.performance_reviews (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references public.employees(id) on delete cascade not null,
  reviewer_id uuid references public.employees(id) on delete set null,
  review_date date not null default current_date,
  core_competencies jsonb default '{}'::jsonb not null,
  score numeric(3, 2) default 0.00 not null check (score >= 0.00 and score <= 5.00),
  comments text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS policies for shifts and performance
alter table public.shifts enable row level security;
alter table public.employee_shifts enable row level security;
alter table public.performance_goals enable row level security;
alter table public.performance_reviews enable row level security;

-- Drop existing policies if they already exist
drop policy if exists "Shifts select company scope" on public.shifts;
drop policy if exists "Shifts all admin or hr" on public.shifts;
drop policy if exists "Employee shifts select own or admin" on public.employee_shifts;
drop policy if exists "Employee shifts all admin or hr" on public.employee_shifts;
drop policy if exists "Performance goals select own or admin" on public.performance_goals;
drop policy if exists "Performance goals insert own or admin" on public.performance_goals;
drop policy if exists "Performance goals update own or admin" on public.performance_goals;
drop policy if exists "Performance goals delete admin" on public.performance_goals;
drop policy if exists "Performance reviews select own or admin" on public.performance_reviews;
drop policy if exists "Performance reviews manage admin" on public.performance_reviews;

-- Policies for shifts
create policy "Shifts select company scope" on public.shifts for select
  using (public.is_admin_or_hr() or company_id in (select company_id from public.employees where user_id = auth.uid()));

create policy "Shifts all admin or hr" on public.shifts for all
  using (public.is_admin_or_hr());

-- Policies for employee_shifts
create policy "Employee shifts select own or admin" on public.employee_shifts for select
  using (public.is_admin_or_hr() or employee_id in (select id from public.employees where user_id = auth.uid()));

create policy "Employee shifts all admin or hr" on public.employee_shifts for all
  using (public.is_admin_or_hr());

-- Policies for performance_goals
create policy "Performance goals select own or admin" on public.performance_goals for select
  using (public.is_admin_or_hr() or employee_id in (select id from public.employees where user_id = auth.uid()));

create policy "Performance goals insert own or admin" on public.performance_goals for insert
  with check (public.is_admin_or_hr() or employee_id in (select id from public.employees where user_id = auth.uid()));

create policy "Performance goals update own or admin" on public.performance_goals for update
  using (public.is_admin_or_hr() or employee_id in (select id from public.employees where user_id = auth.uid()));

create policy "Performance goals delete admin" on public.performance_goals for delete
  using (public.is_admin_or_hr());

-- Policies for performance_reviews
create policy "Performance reviews select own or admin" on public.performance_reviews for select
  using (public.is_admin_or_hr() or employee_id in (select id from public.employees where user_id = auth.uid()) or reviewer_id in (select id from public.employees where user_id = auth.uid()));

create policy "Performance reviews manage admin" on public.performance_reviews for all
  using (public.is_admin_or_hr());

commit;
