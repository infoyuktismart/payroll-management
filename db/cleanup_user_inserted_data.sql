-- CLEANUP SCRIPT VERSION: 2026-05-28-v2-signup-audit-text-fix
-- Cleanup user-entered/demo-session data while preserving baseline system data.
--
-- IMPORTANT:
-- 1. Run db/preview_user_inserted_data_cleanup.sql first.
-- 2. Review the counts.
-- 3. Run this only after confirming the baseline employee list below is correct.
--
-- Baseline kept:
-- - employees EMP001 through EMP006, including first admin/demo employees
-- - configuration/reference tables such as companies, company_settings,
--   departments, leave_policies, tax_regime_configs, salary_components,
--   job_grades, shifts, attendance_policies, biometric_devices

begin;

create temporary table cleanup_baseline_employees as
select id
from public.employees
where employee_id in ('EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005', 'EMP006')
   or email in (
     'infoyuktismart@gmail.com',
     'john.doe@example.com',
     'jane.smith@example.com',
     'robert.j@example.com',
     'emily.d@example.com',
     'michael.b@example.com'
   );

create temporary table cleanup_user_employees as
select id, employee_id, email
from public.employees
where id not in (select id from cleanup_baseline_employees);

-- Payroll children before runs.
delete from public.payroll_items
where employee_id in (select id from cleanup_user_employees)
   or payroll_run_id in (select id from public.payroll_runs);

delete from public.payroll_runs;

-- Employee-scoped transactional data.
delete from public.attendance_punches where employee_id in (select id from cleanup_user_employees);
delete from public.attendance_regularizations where employee_id in (select id from cleanup_user_employees);
delete from public.attendance where employee_id in (select id from cleanup_user_employees);
delete from public.leaves where employee_id in (select id from cleanup_user_employees);
delete from public.leave_balances where employee_id in (select id from cleanup_user_employees);
delete from public.overtime where employee_id in (select id from cleanup_user_employees);
delete from public.salaries where employee_id in (select id from cleanup_user_employees);
delete from public.tax_declarations where employee_id in (select id from cleanup_user_employees);
delete from public.custom_deductions where employee_id in (select id from cleanup_user_employees);
delete from public.employee_documents where employee_id in (select id from cleanup_user_employees);
delete from public.employee_history where employee_id in (select id from cleanup_user_employees);
delete from public.employee_loans where employee_id in (select id from cleanup_user_employees);
delete from public.employee_nominees where employee_id in (select id from cleanup_user_employees);
delete from public.employee_shifts where employee_id in (select id from cleanup_user_employees);
delete from public.exits where employee_id in (select id from cleanup_user_employees);
delete from public.lta_claims where employee_id in (select id from cleanup_user_employees);
delete from public.onboarding_checklists where employee_id in (select id from cleanup_user_employees);
delete from public.performance_goals where employee_id in (select id from cleanup_user_employees);
delete from public.performance_reviews where employee_id in (select id from cleanup_user_employees);
delete from public.privacy_consents where employee_id in (select id from cleanup_user_employees);
delete from public.reimbursements where employee_id in (select id from cleanup_user_employees);
delete from public.salary_arrears_logs where employee_id in (select id from cleanup_user_employees);
delete from public.signup_audit_logs
where employee_id in (
    select id::text from cleanup_user_employees
    union
    select employee_id from cleanup_user_employees where employee_id is not null
  )
   or email in (select email from cleanup_user_employees where email is not null);

-- Standalone app-generated data. Keep reference/config tables intact.
delete from public.generated_reports;
delete from public.holidays;
delete from public.notification_logs;

-- Remove user-created employee records last.
delete from public.employees
where id in (select id from cleanup_user_employees);

drop table cleanup_user_employees;
drop table cleanup_baseline_employees;

commit;
