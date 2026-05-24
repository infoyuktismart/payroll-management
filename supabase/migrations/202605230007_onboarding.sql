-- Migration 202605230007: Onboarding Checklists and Employee Contract Columns
begin;

-- Add contract management columns to employees
alter table public.employees 
  add column if not exists contract_type text default 'Permanent',
  add column if not exists contract_end_date date;

-- Add check constraint for contract type validation
alter table public.employees
  drop constraint if exists check_contract_type,
  add constraint check_contract_type check (contract_type in ('Permanent', 'Contract', 'Intern', 'Consultant'));

-- Create onboarding checklists table
create table if not exists public.onboarding_checklists (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references public.employees(id) on delete cascade,
  task_name text not null,
  category text not null default 'general', -- e.g. 'general', 'document', 'it', 'hr', 'orientation'
  due_date date,
  status text not null default 'pending',
  assigned_to text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint check_onboarding_status check (status in ('pending', 'in_progress', 'completed'))
);

-- Enable RLS
alter table public.onboarding_checklists enable row level security;

-- Policies for onboarding_checklists
drop policy if exists "Admin HR full access on onboarding" on public.onboarding_checklists;
create policy "Admin HR full access on onboarding"
  on public.onboarding_checklists for all to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

drop policy if exists "Employees read own onboarding checklist" on public.onboarding_checklists;
create policy "Employees read own onboarding checklist"
  on public.onboarding_checklists for select to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

drop policy if exists "Employees update own onboarding task status" on public.onboarding_checklists;
create policy "Employees update own onboarding task status"
  on public.onboarding_checklists for update to authenticated
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

-- Bind audit trigger
drop trigger if exists onboarding_checklists_audit on public.onboarding_checklists;
create trigger onboarding_checklists_audit after insert or update or delete on public.onboarding_checklists
  for each row execute function public.audit_row_change();

commit;
