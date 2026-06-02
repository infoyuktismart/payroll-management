import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'

export const salaryService = {
    /**
     * Get salary components.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getSalaryComponents() {
        return withRetry(async () => {
            let query = supabase
                .from('salary_components')
                .select('*')
                .order('created_at', { ascending: true })
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Create salary component.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createSalaryComponent(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('salary_components')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Update salary component.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateSalaryComponent({ id, payload }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('salary_components')
                .update(payload)
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { data, error } = await query
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Delete salary component.
     * @param {any} id - The id parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async deleteSalaryComponent(id) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('salary_components')
                .delete()
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { error } = await query
            if (error) throw error
            return true
        })
    },

    /**
     * Get custom deductions.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getCustomDeductions() {
        return withRetry(async () => {
            let query = supabase
                .from('custom_deductions')
                .select(`
                    id, employee_id, deduction_type, amount, reason, start_date, end_date, is_recurring, status,
                    employee:employees(first_name, last_name, employee_id)
                `)
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Get active custom deductions by period.
     * @param {any} startDate - The startDate parameter
     * @param {any} endDate - The endDate parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getActiveCustomDeductionsByPeriod(startDate, endDate) {
        return withRetry(async () => {
            let query = supabase
                .from('custom_deductions')
                .select('*')
                .eq('status', 'Active')
                .lte('start_date', endDate)
                .or(`end_date.is.null,end_date.gte.${startDate}`)
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Create custom deduction.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createCustomDeduction(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('custom_deductions')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Update custom deduction.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateCustomDeduction({ id, payload }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('custom_deductions')
                .update(payload)
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { data, error } = await query
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Delete custom deduction.
     * @param {any} id - The id parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async deleteCustomDeduction(id) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('custom_deductions')
                .delete()
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { error } = await query
            if (error) throw error
            return true
        })
    }
}
