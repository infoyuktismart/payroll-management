-- Migration 202605230009: Attendance Regularizations, Punches (Web Punch-In), and Auto-Updater Trigger
begin;

-- Create attendance regularization requests
create table if not exists public.attendance_regularizations (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  requested_status text not null,
  reason text not null,
  status text not null default 'pending',
  reviewed_by text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint check_regularization_status check (status in ('pending', 'approved', 'rejected')),
  constraint check_requested_status check (requested_status in ('Present', 'Absent', 'Half Day', 'Weekly Off'))
);

-- Create web punch-in table
create table if not exists public.attendance_punches (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null default current_date,
  punch_in timestamp with time zone not null,
  punch_out timestamp with time zone,
  ip_address text,
  working_hours numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.attendance_regularizations enable row level security;
alter table public.attendance_punches enable row level security;

-- Policies for attendance_regularizations
drop policy if exists "Admin HR full access on regularizations" on public.attendance_regularizations;
create policy "Admin HR full access on regularizations"
  on public.attendance_regularizations for all to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

drop policy if exists "Employees read own regularizations" on public.attendance_regularizations;
create policy "Employees read own regularizations"
  on public.attendance_regularizations for select to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

drop policy if exists "Employees create own regularizations" on public.attendance_regularizations;
create policy "Employees create own regularizations"
  on public.attendance_regularizations for insert to authenticated
  with check (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

-- Policies for attendance_punches
drop policy if exists "Admin HR full access on punches" on public.attendance_punches;
create policy "Admin HR full access on punches"
  on public.attendance_punches for all to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

drop policy if exists "Employees manage own punches" on public.attendance_punches;
create policy "Employees manage own punches"
  on public.attendance_punches for all to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  )
  with check (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

-- Auto-update attendance table on regularization approval
create or replace function public.process_attendance_regularization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    -- Check if record already exists in attendance table
    if exists (
      select 1 from public.attendance
      where employee_id = new.employee_id and date = new.date
    ) then
      update public.attendance
      set status = new.requested_status,
          updated_at = timezone('utc'::text, now())
      where employee_id = new.employee_id and date = new.date;
    else
      insert into public.attendance (employee_id, date, status, created_at, updated_at)
      values (new.employee_id, new.date, new.requested_status, timezone('utc'::text, now()), timezone('utc'::text, now()));
    end if;
  end if;
  return new;
end;
$$;

-- Bind trigger
drop trigger if exists attendance_regularization_approver on public.attendance_regularizations;
create trigger attendance_regularization_approver
  after update on public.attendance_regularizations
  for each row execute function public.process_attendance_regularization();

commit;
