-- PREVIEW SCRIPT VERSION: 2026-05-28-v2-signup-audit-text-fix
-- Preview rows that would be removed by db/cleanup_user_inserted_data.sql.
-- Run this first in Supabase SQL Editor. It does not modify data.
--
-- Baseline kept by this cleanup:
-- - employees EMP001 through EMP006, including the first admin/demo employees
-- - configuration/reference tables such as companies, company_settings,
--   departments, leave_policies, tax_regime_configs, salary_components,
--   job_grades, shifts, attendance_policies, biometric_devices

with baseline_employees as (
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
     )
),
user_employees as (
  select id, employee_id, email
  from public.employees
  where id not in (select id from baseline_employees)
)
select 'employees' as table_name, count(*) as rows_to_delete from user_employees
union all select 'attendance', count(*) from public.attendance where employee_id in (select id from user_employees)
union all select 'attendance_punches', count(*) from public.attendance_punches where employee_id in (select id from user_employees)
union all select 'attendance_regularizations', count(*) from public.attendance_regularizations where employee_id in (select id from user_employees)
union all select 'leaves', count(*) from public.leaves where employee_id in (select id from user_employees)
union all select 'leave_balances', count(*) from public.leave_balances where employee_id in (select id from user_employees)
union all select 'overtime', count(*) from public.overtime where employee_id in (select id from user_employees)
union all select 'salaries', count(*) from public.salaries where employee_id in (select id from user_employees)
union all select 'payroll_items', count(*) from public.payroll_items where employee_id in (select id from user_employees)
union all select 'payroll_runs', count(*) from public.payroll_runs
union all select 'tax_declarations', count(*) from public.tax_declarations where employee_id in (select id from user_employees)
union all select 'custom_deductions', count(*) from public.custom_deductions where employee_id in (select id from user_employees)
union all select 'employee_documents', count(*) from public.employee_documents where employee_id in (select id from user_employees)
union all select 'employee_history', count(*) from public.employee_history where employee_id in (select id from user_employees)
union all select 'employee_loans', count(*) from public.employee_loans where employee_id in (select id from user_employees)
union all select 'employee_nominees', count(*) from public.employee_nominees where employee_id in (select id from user_employees)
union all select 'employee_shifts', count(*) from public.employee_shifts where employee_id in (select id from user_employees)
union all select 'exits', count(*) from public.exits where employee_id in (select id from user_employees)
union all select 'generated_reports', count(*) from public.generated_reports
union all select 'holidays', count(*) from public.holidays
union all select 'lta_claims', count(*) from public.lta_claims where employee_id in (select id from user_employees)
union all select 'notification_logs', count(*) from public.notification_logs
union all select 'onboarding_checklists', count(*) from public.onboarding_checklists where employee_id in (select id from user_employees)
union all select 'performance_goals', count(*) from public.performance_goals where employee_id in (select id from user_employees)
union all select 'performance_reviews', count(*) from public.performance_reviews where employee_id in (select id from user_employees)
union all select 'privacy_consents', count(*) from public.privacy_consents where employee_id in (select id from user_employees)
union all select 'reimbursements', count(*) from public.reimbursements where employee_id in (select id from user_employees)
union all select 'salary_arrears_logs', count(*) from public.salary_arrears_logs where employee_id in (select id from user_employees)
union all select 'signup_audit_logs', count(*) from public.signup_audit_logs
  where employee_id in (
    select id::text from user_employees
    union
    select employee_id from user_employees where employee_id is not null
  )
  or email in (select email from user_employees where email is not null)
order by table_name;
