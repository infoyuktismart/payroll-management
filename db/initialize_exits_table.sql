-- Consolidated script to initialize the exits table with all modern workflow columns
-- Run this in the Supabase SQL Editor

-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS public.exits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees NOT NULL,
    exit_date DATE,
    resignation_date DATE DEFAULT CURRENT_DATE,
    last_working_day DATE,
    reason TEXT,
    interview_notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'clearance', 'settlement', 'completed', 'rejected')),
    
    -- Departmental Clearances
    it_clearance BOOLEAN DEFAULT false,
    it_clearance_notes TEXT,
    it_clearance_by UUID REFERENCES auth.users,
    
    finance_clearance BOOLEAN DEFAULT false,
    finance_clearance_notes TEXT,
    finance_clearance_by UUID REFERENCES auth.users,
    
    hr_clearance BOOLEAN DEFAULT false,
    hr_clearance_notes TEXT,
    hr_clearance_by UUID REFERENCES auth.users,
    
    admin_clearance BOOLEAN DEFAULT false,
    admin_clearance_notes TEXT,
    admin_clearance_by UUID REFERENCES auth.users,
    
    -- Final Settlement
    settlement_details JSONB DEFAULT '{}'::jsonb,
    settlement_amount NUMERIC DEFAULT 0,
    settlement_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add columns if table already existed but was missing them (Safety measure)
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS resignation_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS last_working_day DATE;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'clearance', 'settlement', 'completed', 'rejected'));
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
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS settlement_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS settlement_amount NUMERIC DEFAULT 0;
ALTER TABLE public.exits ADD COLUMN IF NOT EXISTS settlement_date DATE;

-- 3. Enable RLS
ALTER TABLE public.exits ENABLE ROW LEVEL SECURITY;

-- 4. Set up Policies
DROP POLICY IF EXISTS "Enable all access for all authenticated users" ON public.exits;
DROP POLICY IF EXISTS "Users can view their own exit records or admins can view all" ON public.exits;
DROP POLICY IF EXISTS "Employees can insert their own exit records" ON public.exits;
DROP POLICY IF EXISTS "Admins can update exit records" ON public.exits;
DROP POLICY IF EXISTS "Allow insert for self or admin" ON public.exits;
DROP POLICY IF EXISTS "Allow select for self or admin" ON public.exits;
DROP POLICY IF EXISTS "Allow update for admin" ON public.exits;

-- Select policy: Users can see their own or admins/HR see all
CREATE POLICY "Allow select for self or admin"
ON public.exits FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND role::text IN ('admin', 'hr', 'HR', 'hr_manager', 'HR Manager', 'hr_admin')
  ) OR 
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE employees.user_id = auth.uid() AND (employees.id = public.exits.employee_id OR role::text IN ('admin', 'hr', 'HR', 'hr_manager', 'HR Manager', 'hr_admin'))
  )
);

-- Insert policy: Users can insert for themselves or admins/HR can insert for anyone
CREATE POLICY "Allow insert for self or admin"
ON public.exits FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND role::text IN ('admin', 'hr', 'HR', 'hr_manager', 'HR Manager', 'hr_admin')
  ) OR 
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE employees.user_id = auth.uid() AND (employees.id = public.exits.employee_id OR role::text IN ('admin', 'hr', 'HR', 'hr_manager', 'HR Manager', 'hr_admin'))
  )
);

-- Update policy: Only admins/HR can update
CREATE POLICY "Allow update for admin"
ON public.exits FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND role::text IN ('admin', 'hr', 'HR', 'hr_manager', 'HR Manager', 'hr_admin')
  ) OR 
  EXISTS (
    SELECT 1 FROM public.employees 
    WHERE employees.user_id = auth.uid() AND role::text IN ('admin', 'hr', 'HR', 'hr_manager', 'HR Manager', 'hr_admin')
  )
);
