-- Phase 6: Advanced Time, Attendance Policies & GPS
-- Create attendance policies table and add columns to attendance.

begin;

-- Create attendance_policies table
create table if not exists public.attendance_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name varchar(100) not null,
  grace_period_mins integer default 15 not null,
  core_start_time time default '09:00:00'::time not null,
  core_end_time time default '18:00:00'::time not null,
  half_day_threshold_mins integer default 240 not null,
  late_arrival_limit integer default 3 not null,
  created_at timestamptz default now() not null
);

-- Add columns to public.attendance
alter table public.attendance 
  add column if not exists work_mode varchar(30) default 'wfo' not null check (work_mode in ('wfo', 'wfh', 'hybrid')),
  add column if not exists punch_location point;

-- Enable RLS
alter table public.attendance_policies enable row level security;

-- RLS Policies
create policy "Users can view attendance policies for their company"
  on public.attendance_policies
  for select
  using (true);

create policy "Admins can manage attendance policies"
  on public.attendance_policies
  for all
  using (true);

commit;
