DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT IN (
            'profiles',
            'employees',
            'leaves',
            'overtime',
            'salaries',
            'exits',
            'attendance',
            'salary_components',
            'payroll_runs',
            'payroll_items',
            'generated_reports',
            'holidays',
            'custom_deductions',
            'spatial_ref_sys'
        )
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Dropped table: %', r.tablename;
    END LOOP;
END $$;
