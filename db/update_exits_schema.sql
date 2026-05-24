-- Migration to enhance exits table
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS resignation_date DATE;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS last_working_day DATE;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'clearance', 'settlement', 'completed', 'rejected'));

-- Departmental Clearances
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS it_clearance BOOLEAN DEFAULT false;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS it_clearance_notes TEXT;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS it_clearance_by UUID REFERENCES auth.users;

ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS finance_clearance BOOLEAN DEFAULT false;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS finance_clearance_notes TEXT;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS finance_clearance_by UUID REFERENCES auth.users;

ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS hr_clearance BOOLEAN DEFAULT false;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS hr_clearance_notes TEXT;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS hr_clearance_by UUID REFERENCES auth.users;

ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS admin_clearance BOOLEAN DEFAULT false;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS admin_clearance_notes TEXT;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS admin_clearance_by UUID REFERENCES auth.users;

-- Final Settlement
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS settlement_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS settlement_amount NUMERIC DEFAULT 0;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS settlement_date DATE;

-- Allow employees to see their own exits, but admins to see all
DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.exits;

CREATE POLICY "Users can view their own exit records or admins can view all"
ON public.exits FOR SELECT
USING (
  auth.uid() IN (SELECT user_id FROM public.employees WHERE id = employee_id) OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Employees can insert their own exit records"
ON public.exits FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM public.employees WHERE id = employee_id)
);

CREATE POLICY "Admins can update exit records"
ON public.exits FOR UPDATE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
