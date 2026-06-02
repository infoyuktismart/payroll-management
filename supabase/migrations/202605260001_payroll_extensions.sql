-- SQL Migration: Payroll Extensions for Off-cycle, hold flag, employer contributions, and gratuity provisioning.

begin;

-- Add hold_payroll to employees
alter table public.employees 
add column if not exists hold_payroll boolean default false not null;

-- Add run_type and reversal fields to payroll_runs
alter table public.payroll_runs 
add column if not exists run_type varchar(30) default 'regular' not null check (run_type in ('regular', 'off_cycle', 'bonus')),
add column if not exists reversed_by uuid references auth.users(id) on delete set null,
add column if not exists reversed_at timestamp with time zone;

-- Add employer contributions and gratuity provisioning to payroll_items
alter table public.payroll_items 
add column if not exists employer_pf numeric(15, 2) default 0.00 not null,
add column if not exists employer_esic numeric(15, 2) default 0.00 not null,
add column if not exists gratuity_provision numeric(15, 2) default 0.00 not null;

commit;
