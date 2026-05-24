-- Create generated_reports table
CREATE TABLE IF NOT EXISTS public.generated_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    report_type TEXT NOT NULL, -- 'Compliance', 'Attendance', 'Custom', 'Financial'
    description TEXT,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'pending', 'processing', 'failed')),
    file_url TEXT, -- Path to storage or null if generated on fly
    metadata JSONB DEFAULT '{}'::jsonb, -- Store filters, date ranges, generated_by, etc.
    generated_date DATE DEFAULT CURRENT_DATE
);

-- Enable RLS
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for authenticated users" ON public.generated_reports
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.generated_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE public.generated_reports TO authenticated;
GRANT ALL ON TABLE public.generated_reports TO service_role;

-- Insert Seed Data for Demonstration
INSERT INTO public.generated_reports (title, report_type, description, status, generated_date)
VALUES 
    ('PF Monthly Filing - Dec 2025', 'Compliance', 'Provident Fund monthly return filing report', 'available', '2026-01-10'),
    ('ESI Contribution - Q4 2025', 'Compliance', 'Quarterly ESI contribution summary', 'available', '2026-01-05'),
    ('Annual Attendance Summary 2025', 'Attendance', 'Consolidated employee attendance for FY 2025', 'available', '2025-12-31'),
    ('TDS Projection Report', 'Tax', ' projected tax deduction liabilities for Q1 2026', 'available', '2026-01-15');
