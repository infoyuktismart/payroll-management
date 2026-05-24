-- Create payroll_runs table
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month_year DATE NOT NULL, -- Stored as the first day of the month (e.g., '2024-01-01')
    total_amount DECIMAL(15, 2) DEFAULT 0,
    status TEXT CHECK (status IN ('Draft', 'Completed', 'Paid')) DEFAULT 'Draft',
    total_employees INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create payroll_items table
CREATE TABLE IF NOT EXISTS public.payroll_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE NOT NULL,
    employee_id UUID REFERENCES public.employees(id) NOT NULL,
    basic_salary DECIMAL(15, 2) DEFAULT 0,
    total_allowances DECIMAL(15, 2) DEFAULT 0,
    total_deductions DECIMAL(15, 2) DEFAULT 0,
    net_salary DECIMAL(15, 2) DEFAULT 0,
    attendance_days DECIMAL(5, 2) DEFAULT 0,
    breakdown JSONB DEFAULT '{}'::jsonb, -- Stores detailed components for historical record
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_payroll_runs_month_year ON public.payroll_runs(month_year);
CREATE INDEX IF NOT EXISTS idx_payroll_items_payroll_run_id ON public.payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee_id ON public.payroll_items(employee_id);

-- Enable RLS
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Admin & HR can view all payroll runs
CREATE POLICY "Admins and HR can view all payroll runs" ON public.payroll_runs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'hr_manager')
        )
    );

-- Admin & HR can insert/update payroll runs
CREATE POLICY "Admins and HR can manage payroll runs" ON public.payroll_runs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'hr_manager')
        )
    );

-- Employees can view their own payroll items (Payslips)
CREATE POLICY "Employees can view own payroll items" ON public.payroll_items
    FOR SELECT
    USING (
        auth.uid() = (SELECT user_id FROM public.employees WHERE id = payroll_items.employee_id)
        OR 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'hr_manager')
        )
    );

-- Admin & HR can manage payroll items
CREATE POLICY "Admins and HR can manage payroll items" ON public.payroll_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'hr_manager')
        )
    );
