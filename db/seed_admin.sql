-- RECOVERY: Seed Initial Admin Employee
-- Run this to create the first employee record so you can sign up

-- 1. Insert Admin Employee
-- Replace details with your own
INSERT INTO public.employees (
    employee_id,
    first_name,
    last_name,
    email,
    designation,
    department,
    status,
    role,
    joining_date,
    salary
) VALUES (
    'EMP001',           -- Employee ID to use for Signup
    'System',           -- First Name
    'Admin',            -- Last Name
    'infoyuktismart@gmail.com',-- Email (MUST match the one you use for Signup)
    'Administrator',    -- Designation
    'IT',               -- Department
    'active',           -- Status (Must be active)
    'admin',            -- Role (Give yourself admin access)
    CURRENT_DATE,       -- Date of Joining
    50000               -- Salary (Dummy value)
);

-- 2. Verify Inclusion
SELECT * FROM public.employees WHERE employee_id = 'EMP001';

-- NOW: Go to /signup and use:
-- ID: EMP001
-- Email: infoyuktismart@gmail.com

