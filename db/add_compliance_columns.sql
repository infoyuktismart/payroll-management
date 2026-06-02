-- Add state field to employees (required for PT calculation)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_location text;

-- Add UAN + ESIC columns (may already exist, idempotent)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS uan_number text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS esic_number text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS epf_member_id text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS esic_ip_no text;

-- Bank details (may already exist, idempotent)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS ifsc_code text;

-- Store computed PT/LWF per payroll item for audit
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS professional_tax numeric(10,2) DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS lwf_employee numeric(10,2) DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS lwf_employer numeric(10,2) DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS epf_employee numeric(10,2) DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS epf_employer numeric(10,2) DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS esic_employee numeric(10,2) DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS esic_employer numeric(10,2) DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS gross_salary numeric(10,2) DEFAULT 0;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS earnings_breakdown jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.payroll_items ADD COLUMN IF NOT EXISTS deductions_breakdown jsonb DEFAULT '[]'::jsonb;
