import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, withCompanyScope } from './tenantScope'

export const reportService = {
    /**
     * Get report data.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getReportData() {
        return withRetry(async () => {
            const sixMonthsAgo = new Date()
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
            const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]

            const [runsRes, employeesRes, attendanceRes, reportsRes] = await Promise.all([
                applyCompanyFilter(supabase
                    .from('payroll_runs')
                    .select('*')
                    .eq('status', 'Completed')
                    .order('month_year', { ascending: true })),
                applyCompanyFilter(supabase
                    .from('employees')
                    .select('id, first_name, last_name, salary, department, uan_number, esi_number, pan_number, joining_date, salary_structure, status')),
                applyCompanyFilter(supabase
                    .from('attendance')
                    .select('date, status')
                    .gte('date', sixMonthsAgoStr)),
                applyCompanyFilter(supabase
                    .from('generated_reports')
                    .select('*')
                    .order('generated_date', { ascending: false }))
            ])

            if (runsRes.error) throw runsRes.error
            if (employeesRes.error) throw employeesRes.error
            if (attendanceRes.error) throw attendanceRes.error
            if (reportsRes.error && reportsRes.error.code !== '42P01') throw reportsRes.error

            return {
                payrollRuns: runsRes.data || [],
                employees: employeesRes.data || [],
                attendance: attendanceRes.data || [],
                generatedReports: reportsRes.data || []
            }
        })
    },

    /**
     * Get statutory data.
     * @param {any} statutoryMonth - The statutoryMonth parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getStatutoryData(statutoryMonth) {
        return withRetry(async () => {
            const [settingsRes, runRes] = await Promise.all([
                applyCompanyFilter(supabase.from('company_settings').select('*')).single(),
                applyCompanyFilter(supabase
                    .from('payroll_runs')
                    .select('*')
                    .eq('month_year', statutoryMonth + '-01')
                    .eq('status', 'Completed')
                )
                    .maybeSingle()
            ])

            if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error

            return {
                companySettings: settingsRes.data || {},
                payrollRun: runRes.data || null
            }
        })
    },

    /**
     * Save generated report.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async saveGeneratedReport(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('generated_reports')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    }
}
