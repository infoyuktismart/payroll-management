-- =============================================================================
-- 202606220001_prevent_statutory_cascade_deletes.sql
-- Migration: Prevent Statutory Cascade Deletions
--
-- Statutory Compliance:
--   - Income Tax Act 1961 (Section 206C / TDS Form 24Q & Form 16)
--   - Employees' Provident Funds and Miscellaneous Provisions Act, 1952
--   - Payment of Wages Act, 1936
--
-- Purpose:
--   Prevent hard CASCADE deletes of transactional records (payslips, loans,
--   reimbursements, tax declarations) when an employee is archived/deleted.
--   Enforces ON DELETE RESTRICT on historical financial records so statutory
--   records are permanently preserved in compliance with 8-year audit retention.
-- =============================================================================

begin;

-- 1. tax_declarations: Enforce RESTRICT
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'tax_declarations_employee_id_fkey'
      and table_name = 'tax_declarations'
  ) then
    alter table public.tax_declarations
      drop constraint tax_declarations_employee_id_fkey,
      add constraint tax_declarations_employee_id_fkey
        foreign key (employee_id) references public.employees(id) on delete restrict;
  end if;
end $$;

-- 2. loans: Enforce RESTRICT
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'loans_employee_id_fkey'
      and table_name = 'loans'
  ) then
    alter table public.loans
      drop constraint loans_employee_id_fkey,
      add constraint loans_employee_id_fkey
        foreign key (employee_id) references public.employees(id) on delete restrict;
  end if;
end $$;

-- 3. reimbursements: Enforce RESTRICT
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'reimbursements_employee_id_fkey'
      and table_name = 'reimbursements'
  ) then
    alter table public.reimbursements
      drop constraint reimbursements_employee_id_fkey,
      add constraint reimbursements_employee_id_fkey
        foreign key (employee_id) references public.employees(id) on delete restrict;
  end if;
end $$;

-- 4. payroll_items: Enforce RESTRICT
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'payroll_items_employee_id_fkey'
      and table_name = 'payroll_items'
  ) then
    alter table public.payroll_items
      drop constraint payroll_items_employee_id_fkey,
      add constraint payroll_items_employee_id_fkey
        foreign key (employee_id) references public.employees(id) on delete restrict;
  end if;
end $$;

commit;
