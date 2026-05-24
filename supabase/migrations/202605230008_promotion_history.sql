-- Migration 202605230008: Employee Transfer & Promotion History and Automated Tracking Trigger
begin;

-- Create employee history table
create table if not exists public.employee_history (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references public.employees(id) on delete cascade,
  change_type text not null, -- e.g. 'designation', 'department', 'salary', 'reporting_person'
  old_value text,
  new_value text,
  effective_date date not null default current_date,
  approved_by text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.employee_history enable row level security;

-- Policies for employee_history
drop policy if exists "Admin HR full access on employee_history" on public.employee_history;
create policy "Admin HR full access on employee_history"
  on public.employee_history for all to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

drop policy if exists "Employees read own history" on public.employee_history;
create policy "Employees read own history"
  on public.employee_history for select to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

-- Automated History Tracking Trigger
create or replace function public.log_employee_history_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_user text := 'System';
begin
  -- Try to get auth email or profile role for tracking
  begin
    v_admin_user := coalesce(auth.jwt() ->> 'email', 'System');
  exception when others then
    v_admin_user := 'System';
  end;

  -- 1. Track designation changes
  if old.designation is distinct from new.designation then
    insert into public.employee_history (employee_id, change_type, old_value, new_value, effective_date, approved_by, notes)
    values (new.id, 'designation', old.designation, new.designation, current_date, v_admin_user, 'Designation revised');
  end if;

  -- 2. Track department changes
  if old.department is distinct from new.department then
    insert into public.employee_history (employee_id, change_type, old_value, new_value, effective_date, approved_by, notes)
    values (new.id, 'department', old.department, new.department, current_date, v_admin_user, 'Department transfer');
  end if;

  -- 3. Track salary changes
  if old.salary is distinct from new.salary then
    insert into public.employee_history (employee_id, change_type, old_value, new_value, effective_date, approved_by, notes)
    values (new.id, 'salary', old.salary::text, new.salary::text, current_date, v_admin_user, 'Base salary revised');
  end if;

  -- 4. Track reporting manager changes
  if old.reporting_person is distinct from new.reporting_person then
    insert into public.employee_history (employee_id, change_type, old_value, new_value, effective_date, approved_by, notes)
    values (new.id, 'reporting_person', old.reporting_person, new.reporting_person, current_date, v_admin_user, 'Reporting manager updated');
  end if;

  return new;
end;
$$;

-- Bind trigger
drop trigger if exists employee_history_change_logger on public.employees;
create trigger employee_history_change_logger
  after update on public.employees
  for each row execute function public.log_employee_history_change();

commit;
