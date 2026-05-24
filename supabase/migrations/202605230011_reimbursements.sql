-- Migration 202605230011: Reimbursements Claims
begin;

-- Create reimbursements table
create table if not exists public.reimbursements (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references public.employees(id) on delete cascade,
  claim_type text not null,
  amount numeric not null,
  description text,
  receipt_url text,
  status text not null default 'pending',
  approved_by uuid references public.employees(id),
  approved_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint check_reimbursement_status check (status in ('pending', 'approved', 'rejected')),
  constraint check_claim_type check (claim_type in ('Travel', 'Medical', 'Food', 'Internet', 'Others')),
  constraint check_reimbursement_amount check (amount > 0)
);

-- Enable RLS
alter table public.reimbursements enable row level security;

-- Policies for reimbursements
drop policy if exists "Admin HR full access on reimbursements" on public.reimbursements;
create policy "Admin HR full access on reimbursements"
  on public.reimbursements for all to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

drop policy if exists "Employees read own reimbursements" on public.reimbursements;
create policy "Employees read own reimbursements"
  on public.reimbursements for select to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

drop policy if exists "Employees submit reimbursements" on public.reimbursements;
create policy "Employees submit reimbursements"
  on public.reimbursements for insert to authenticated
  with check (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

-- Audit Trigger
drop trigger if exists reimbursements_audit on public.reimbursements;
create trigger reimbursements_audit after insert or update or delete on public.reimbursements
  for each row execute function public.audit_row_change();

commit;
