-- Insert Dummy Employees
-- Note: Ideally user_id should link to real auth.users if they need to login.
-- For this seed, we'll leave user_id null for some, or you might need to manually update them later to match real users.
INSERT INTO public.employees (employee_id, first_name, last_name, email, phone, designation, department, joining_date, salary, status)
VALUES 
('EMP002', 'John', 'Doe', 'john.doe@example.com', '123-456-7890', 'Software Engineer', 'Engineering', '2023-01-15', 75000, 'active'),
('EMP003', 'Jane', 'Smith', 'jane.smith@example.com', '098-765-4321', 'HR Manager', 'HR', '2022-05-20', 85000, 'active'),
('EMP004', 'Robert', 'Johnson', 'robert.j@example.com', '555-123-4567', 'Sales Executive', 'Sales', '2023-08-01', 55000, 'active'),
('EMP005', 'Emily', 'Davis', 'emily.d@example.com', '444-987-6543', 'Product Designer', 'Design', '2021-11-10', 70000, 'on_leave'),
('EMP006', 'Michael', 'Brown', 'michael.b@example.com', '333-222-1111', 'Marketing Specialist', 'Marketing', '2020-03-15', 60000, 'terminated');

-- Get IDs for reference (This part works in a script flow, but for a one-off run we use subqueries or just inserts if we knew UUIDs. 
-- Since we use uuid_generate_v4(), we use subqueries to link data).

-- Insert Leaves
INSERT INTO public.leaves (employee_id, leave_type, start_date, end_date, reason, status)
VALUES 
((SELECT id FROM public.employees WHERE email = 'john.doe@example.com'), 'sick', '2023-10-01', '2023-10-03', 'Flu', 'approved'),
((SELECT id FROM public.employees WHERE email = 'emily.d@example.com'), 'vacation', '2023-12-20', '2024-01-05', 'End of year break', 'pending'),
((SELECT id FROM public.employees WHERE email = 'robert.j@example.com'), 'casual', '2023-09-15', '2023-09-15', 'Personal work', 'rejected');

-- Insert Overtime
INSERT INTO public.overtime (employee_id, date, hours, reason, status)
VALUES 
((SELECT id FROM public.employees WHERE email = 'john.doe@example.com'), '2023-11-10', 2.5, 'Project deadline', 'approved'),
((SELECT id FROM public.employees WHERE email = 'robert.j@example.com'), '2023-11-12', 4, 'Client meeting prep', 'pending');

-- Insert Salaries
INSERT INTO public.salaries (employee_id, month, basic_salary, allowances, deductions, payment_date)
VALUES 
((SELECT id FROM public.employees WHERE email = 'john.doe@example.com'), '2023-10-01', 75000, 2000, 500, '2023-10-30'),
((SELECT id FROM public.employees WHERE email = 'jane.smith@example.com'), '2023-10-01', 85000, 3000, 1000, '2023-10-30');

-- Insert Exits
INSERT INTO public.exits (employee_id, exit_date, reason, interview_notes)
VALUES 
((SELECT id FROM public.employees WHERE email = 'michael.b@example.com'), '2023-09-30', 'Termination', 'Performance issues over consecutive quarters.');
-- Insert Attendance
INSERT INTO public.attendance (employee_id, date, status)
VALUES 
((SELECT id FROM public.employees WHERE email = 'john.doe@example.com'), CURRENT_DATE, 'present'),
((SELECT id FROM public.employees WHERE email = 'jane.smith@example.com'), CURRENT_DATE, 'present'),
((SELECT id FROM public.employees WHERE email = 'robert.j@example.com'), CURRENT_DATE, 'present');
