import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const email = import.meta.env.TEST_USER_EMAIL || 'non_admin_test@example.com';
const password = import.meta.env.TEST_USER_PASSWORD || 'TestPassword123';

describe('Supabase RLS Integration Tests - payroll_runs', () => {
    let supabaseClient;

    beforeAll(async () => {
        expect(supabaseUrl).toBeDefined();
        expect(supabaseKey).toBeDefined();
        
        supabaseClient = createClient(supabaseUrl, supabaseKey);
        
        // Attempt to sign in as the non-admin user
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
        
        if (signInError) {
            // If sign in fails (e.g. user does not exist), attempt to sign up
            const { error: signUpError } = await supabaseClient.auth.signUp({ email, password });
            if (!signUpError) {
                // If sign up succeeded, retry sign in
                await supabaseClient.auth.signInWithPassword({ email, password });
            }
        }
    });

    it('should assert SELECT on payroll_runs returns empty array or RLS error', async () => {
        const { data, error } = await supabaseClient
            .from('payroll_runs')
            .select('*');

        if (error) {
            // If an error is returned, it should be an RLS/permission error
            expect(error.message).toMatch(/policy|permission|denied/i);
        } else {
            // Under RLS, selecting from restricted tables yields 0 rows for non-admins
            expect(data).toBeInstanceOf(Array);
            expect(data.length).toBe(0);
        }
    });

    it('should assert INSERT into payroll_runs is rejected by RLS', async () => {
        const { error } = await supabaseClient
            .from('payroll_runs')
            .insert([
                {
                    month_year: '2026-05-01',
                    status: 'Draft'
                }
            ]);

        // Insert must be rejected by Row Level Security
        expect(error).toBeDefined();
        expect(error.message).toMatch(/policy|permission|denied|row-level security/i);
    });
});
