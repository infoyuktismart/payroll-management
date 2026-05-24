-- MIGRATION: Create Holidays table
-- Used to exclude specific dates from mandatory attendance/absent logic

CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    date DATE NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Allow public read (or authenticated)
CREATE POLICY "Allow public read holidays" 
ON public.holidays FOR SELECT 
TO authenticated 
USING (true);

-- Allow admin write
CREATE POLICY "Allow admin to manage holidays" 
ON public.holidays FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'HR' OR role = 'hr')
    )
);

-- Seed with some Indian holidays (as user seems to be in India based on local time +05:30)
INSERT INTO public.holidays (name, date, description)
VALUES 
    ('Republic Day', '2026-01-26', 'National Holiday'),
    ('Independence Day', '2026-08-15', 'National Holiday'),
    ('Gandhi Jayanti', '2026-10-02', 'National Holiday')
ON CONFLICT (date) DO NOTHING;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
