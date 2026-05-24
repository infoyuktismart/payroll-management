-- Migration 202605230010: Employee Loans & Salary Advances
begin;

-- Create loans table
create table if not exists public.employee_loans (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid not null references public.employees(id) on delete cascade,
  loan_type text not null,
  amount numeric not null,
  tenure_months integer not null,
  emi_amount numeric not null,
  status text not null default 'pending',
  disbursement_date date,
  remarks text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint check_loan_status check (status in ('pending', 'approved', 'rejected', 'active', 'closed')),
  constraint check_loan_type check (loan_type in ('Advance Salary', 'Home Loan', 'Personal Loan', 'Education Loan')),
  constraint check_loan_amount check (amount > 0),
  constraint check_loan_tenure check (tenure_months > 0)
);

-- Enable RLS
alter table public.employee_loans enable row level security;

-- Policies for employee_loans
drop policy if exists "Admin HR full access on loans" on public.employee_loans;
create policy "Admin HR full access on loans"
  on public.employee_loans for all to authenticated
  using (public.is_admin_or_hr())
  with check (public.is_admin_or_hr());

drop policy if exists "Employees read own loans" on public.employee_loans;
create policy "Employees read own loans"
  on public.employee_loans for select to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

drop policy if exists "Employees apply for loans" on public.employee_loans;
create policy "Employees apply for loans"
  on public.employee_loans for insert to authenticated
  with check (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

-- Audit Trigger
drop trigger if exists employee_loans_audit on public.employee_loans;
create trigger employee_loans_audit after insert or update or delete on public.employee_loans
  for each row execute function public.audit_row_change();

commit;
