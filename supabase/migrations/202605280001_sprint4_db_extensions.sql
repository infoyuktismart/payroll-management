-- Migration to extend payroll_runs status constraints and notification_logs columns for ESS inbox
begin;

-- 1. Extend payroll_runs status constraint
alter table public.payroll_runs drop constraint if exists payroll_runs_status_check;
alter table public.payroll_runs add constraint payroll_runs_status_check check (status in ('Draft', 'Completed', 'Paid', 'Reversed', 'reversed'));

-- 2. Extend notification_logs columns
alter table public.notification_logs
  add column if not exists employee_id uuid references public.employees(id) on delete cascade,
  add column if not exists is_read boolean default false not null,
  add column if not exists message text;

-- 3. Add index structures
create index if not exists idx_notification_logs_employee_id on public.notification_logs(employee_id);
create index if not exists idx_notification_logs_unread on public.notification_logs(employee_id) where is_read = false;

-- 4. Enable RLS
alter table public.notification_logs enable row level security;

-- 5. RLS Policies
drop policy if exists "Employees can view own notification logs" on public.notification_logs;
create policy "Employees can view own notification logs" on public.notification_logs
  for select
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

drop policy if exists "Employees can update own notification logs" on public.notification_logs;
create policy "Employees can update own notification logs" on public.notification_logs
  for update
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

commit;
