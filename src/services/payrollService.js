import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, withCompanyScope, withCompanyScopeList } from './tenantScope'

export const payrollService = {
    /**
     * Get payroll runs.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getPayrollRuns() {
        return withRetry(async () => {
            let query = supabase
                .from('payroll_runs')
                .select('*')
                .order('month_year', { ascending: false })
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Get payroll run by month.
     * @param {any} monthYear - The monthYear parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getPayrollRunByMonth(monthYear) {
        return withRetry(async () => {
            let query = supabase
                .from('payroll_runs')
                .select('id, status')
                .eq('month_year', monthYear)
            query = applyCompanyFilter(query)
            const { data, error } = await query
                .maybeSingle()
            if (error) throw error
            return data
        })
    },

    /**
     * Get payroll items.
     * @param {any} runId - The runId parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getPayrollItems(runId) {
        return withRetry(async () => {
            let query = supabase
                .from('payroll_items')
                .select(`
                    *,
                    employees (
                        id,
                        first_name,
                        last_name,
                        employee_id,
                        email,
                        designation,
                        department,
                        salary,
                        salary_allowances,
                        state,
                        uan_number,
                        esi_number,
                        epf_member_id,
                        esic_ip_no,
                        bank_name,
                        ifsc_code,
                        bank_account_number
                    )
                `)
                .eq('payroll_run_id', runId)
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Create payroll run.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createPayrollRun(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('payroll_runs')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Create payroll items.
     * @param {any} items - The items parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createPayrollItems(items) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('payroll_items')
                .insert(withCompanyScopeList(items))
                .select()
            if (error) throw error
            return data || []
        })
    }
}
