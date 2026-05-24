-- Optimizing Database Performance with Indices (Fixed)

-- 1. Employees: Critical for "auth.uid()" RLS lookups (Runs on almost every query)
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

-- 2. Payroll Items: Critical for "My Payslips" and Admin Generators
-- (Note: These might already exist from create_payroll_tables.sql, but IF NOT EXISTS makes it safe)
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee_id ON payroll_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_payroll_run_id ON payroll_items(payroll_run_id);

-- 3. Attendance: Critical for "Last Month's Attendance" and filtering by date range
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);

-- 4. Payroll Runs: Critical for sorting "Recent Activities" and dashboard stats
CREATE INDEX IF NOT EXISTS idx_payroll_runs_month_year ON payroll_runs(month_year);

-- 5. Generated Reports: Critical for dashboard "Pending Compliance" stats
-- Fixed: Removed reference to 'generated_by' which doesn't exist. Using report_type + status.
CREATE INDEX IF NOT EXISTS idx_reports_type_status ON generated_reports(report_type, status);
