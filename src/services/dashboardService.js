import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter } from './tenantScope'

export const dashboardService = {
    /**
     * Get dashboard data.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getDashboardData() {
        return withRetry(async () => {
            const now = new Date()
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

            const [
                employeeCountRes,
                latestRunRes,
                salariesRes,
                attendanceRes,
                complianceRes,
                recentRunsRes,
                newHiresRes,
                recentReportsRes
            ] = await Promise.all([
                applyCompanyFilter(supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active')),
                applyCompanyFilter(supabase.from('payroll_runs').select('total_amount').eq('status', 'Completed').order('created_at', { ascending: false }).limit(1)).maybeSingle(),
                applyCompanyFilter(supabase.from('employees').select('salary, salary_allowances, salary_structure').eq('status', 'active')),
                applyCompanyFilter(supabase.from('attendance').select('status').gte('date', lastMonthStart.toISOString()).lte('date', lastMonthEnd.toISOString())),
                applyCompanyFilter(supabase.from('tax_declarations').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
                applyCompanyFilter(supabase.from('payroll_runs').select('month_year, created_at, status').order('created_at', { ascending: false }).limit(2)),
                applyCompanyFilter(supabase.from('employees').select('first_name, last_name, created_at').order('created_at', { ascending: false }).limit(2)),
                applyCompanyFilter(supabase.from('generated_reports').select('title, created_at').order('created_at', { ascending: false }).limit(2))
            ])

            if (employeeCountRes.error) throw employeeCountRes.error
            if (recentRunsRes.error) throw recentRunsRes.error
            if (newHiresRes.error) throw newHiresRes.error
            if (recentReportsRes.error) throw recentReportsRes.error

            return {
                employeeCount: employeeCountRes.count || 0,
                latestRun: latestRunRes.data,
                salaries: salariesRes.data || [],
                attendanceLogs: attendanceRes.data || [],
                pendingCompliance: complianceRes.count || 0,
                recentRuns: recentRunsRes.data || [],
                newHires: newHiresRes.data || [],
                recentReports: recentReportsRes.data || []
            }
        })
    }
}
