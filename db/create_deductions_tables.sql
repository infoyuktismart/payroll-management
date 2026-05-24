-- Clean slate
DROP TABLE IF EXISTS public.custom_deductions CASCADE;

-- Create Custom Deductions Table (Employee Specific)
CREATE TABLE public.custom_deductions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    deduction_type TEXT NOT NULL, 
    amount NUMERIC NOT NULL DEFAULT 0,
    reason TEXT,
    is_recurring BOOLEAN DEFAULT false,
    start_date DATE NOT NULL,
    end_date DATE, 
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.custom_deductions ENABLE ROW LEVEL SECURITY;

-- Policies

CREATE POLICY "Admins can manage custom deductions" 
ON public.custom_deductions
USING (
    auth.jwt() ->> 'role' = 'service_role' 
    OR (SELECT role FROM public.profiles WHERE id::text = auth.uid()::text) IN ('admin', 'hr')
)
WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role' 
    OR (SELECT role FROM public.profiles WHERE id::text = auth.uid()::text) IN ('admin', 'hr')
);

CREATE POLICY "Employees can view their own custom deductions"
ON public.custom_deductions FOR SELECT
USING (
    (SELECT user_id FROM public.employees WHERE id = employee_id) = auth.uid()
);

-- No seed data as requested
