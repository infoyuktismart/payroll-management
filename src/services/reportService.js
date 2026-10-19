import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, withCompanyScope } from './tenantScope'

export const reportService = {
    /**
     * Get report data.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getReportData(activeCompanyId, selectedBranch) {
        return withRetry(async () => {
            const sixMonthsAgo = new Date()
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
            const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]

            const [runsRes, employeesRes, attendanceRes, reportsRes] = await Promise.all([
                applyCompanyFilter(supabase
                    .from('payroll_runs')
                    .select('*')
                    .eq('status', 'Completed')
                    .order('month_year', { ascending: true }), activeCompanyId),
                applyCompanyFilter(supabase
                    .from('employees')
                    .select('id, first_name, last_name, salary, department, uan_number, esi_number, pan_number, joining_date, salary_structure, status'), activeCompanyId),
                applyCompanyFilter(supabase
                    .from('attendance')
                    .select('date, status')
                    .gte('date', sixMonthsAgoStr), activeCompanyId),
                applyCompanyFilter(supabase
                    .from('generated_reports')
                    .select('*')
                    .order('generated_date', { ascending: false }), activeCompanyId)
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
     * @param {string} activeCompanyId - The activeCompanyId parameter
     * @param {string} selectedBranch - The selectedBranch parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getStatutoryData(statutoryMonth, activeCompanyId, selectedBranch) {
        return withRetry(async () => {
            const [settingsRes, runRes] = await Promise.all([
                applyCompanyFilter(supabase.from('company_settings').select('*'), activeCompanyId).single(),
                applyCompanyFilter(supabase
                    .from('payroll_runs')
                    .select('*')
                    .eq('month_year', statutoryMonth + '-01')
                    .eq('status', 'Completed'), activeCompanyId
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
     * @param {string} activeCompanyId - The activeCompanyId parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async saveGeneratedReport(payload, activeCompanyId) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('generated_reports')
                .insert([withCompanyScope(payload, activeCompanyId)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Get active employee data for custom employee reports.
     * @param {string} department - Selected department (optional)
     * @returns {Promise<any>} List of active employees
     */
    async getEmployeeReportsData(department) {
        return withRetry(async () => {
            let query = supabase.from('employees').select('*').eq('status', 'active')
            query = applyCompanyFilter(query)
            if (department) query = query.eq('department', department)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Get completed payroll items for custom payroll reports.
     * @param {string} fromDate - Date bound limit (optional)
     * @param {string} department - Selected department (optional)
     * @returns {Promise<any>} List of payroll items
     */
    async getPayrollReportsData(fromDate, department) {
        return withRetry(async () => {
            let query = supabase
                .from('payroll_items')
                .select(`
                    id, basic_salary, total_allowances, total_deductions, net_salary, attendance_days, breakdown,
                    employees(first_name, last_name, employee_id, department, designation),
                    payroll_runs(month_year)
                `)
            query = applyCompanyFilter(query)
            if (fromDate) query = query.gte('created_at', fromDate)
            const { data, error } = await query
            if (error) throw error
            const filtered = department
                ? (data || []).filter(i => i.employees?.department === department)
                : (data || [])
            return filtered
        })
    },

    /**
     * Get historical attendance records for custom attendance reports.
     * @param {string} fromDate - Date bound limit (optional)
     * @param {string} department - Selected department (optional)
     * @returns {Promise<any>} List of attendance items
     */
    async getAttendanceReportsData(fromDate, department) {
        return withRetry(async () => {
            let query = supabase
                .from('attendance')
                .select(`
                    date, status, check_in, check_out, remarks,
                    employees(first_name, last_name, employee_id, department)
                `)
            query = applyCompanyFilter(query)
            if (fromDate) query = query.gte('date', fromDate)
            const { data, error } = await query
            if (error) throw error
            const filtered = department
                ? (data || []).filter(a => a.employees?.department === department)
                : (data || [])
            return filtered
        })
    },

    /**
     * Get tax declarations for an employee in a given financial year.
     * @param {string} employeeId - Employee ID
     * @param {string} financialYear - Financial Year
     * @returns {Promise<any>} List of declarations
     */
    async getTaxDeclarations(employeeId, financialYear) {
        return withRetry(async () => {
            let query = supabase.from('tax_declarations').select('*')
            query = applyCompanyFilter(query)
            query = query.eq('employee_id', employeeId).eq('financial_year', financialYear)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Get completed payroll items for Form 16.
     * @param {string} employeeId - Employee ID
     * @param {string} startMonth - Start month-year bound
     * @param {string} endMonth - End month-year bound
     * @returns {Promise<any>} List of payroll items
     */
    async getPayrollItemsForFinancialYear(employeeId, startMonth, endMonth) {
        return withRetry(async () => {
            let query = supabase
                .from('payroll_items')
                .select(`
                    basic_salary,
                    total_allowances,
                    total_deductions,
                    net_salary,
                    attendance_days,
                    breakdown,
                    payroll_runs!inner (
                        month_year,
                        status
                    )
                `)
            query = applyCompanyFilter(query)
            query = query
                .eq('employee_id', employeeId)
                .eq('payroll_runs.status', 'Completed')
                .gte('payroll_runs.month_year', startMonth)
                .lte('payroll_runs.month_year', endMonth)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    }
}
