import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'

export const exitService = {
    /**
     * Get exits.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getExits() {
        return withRetry(async () => {
            let query = supabase
                .from('exits')
                .select('*')
                .order('created_at', { ascending: false })
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Create exit.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createExit(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('exits')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Update exit status.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.status - The status parameter
     * @param {any} params.employeeId - The employeeId parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateExitStatus({ id, status, employeeId }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('exits')
                .update({ status })
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { data, error } = await query
                .select()
                .single()
            if (error) throw error

            // If completed, update employee status to resigned
            if (status === 'completed' && employeeId) {
                let empQuery = supabase
                    .from('employees')
                    .update({ status: 'resigned' })
                    .eq('id', employeeId)
                if (companyId) empQuery = empQuery.eq('company_id', companyId)
                const { error: empErr } = await empQuery
                if (empErr) throw empErr
            }

            return data
        })
    },

    /**
     * Update exit clearance.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.department - The department parameter
     * @param {any} params.isCleared - The isCleared parameter
     * @param {any} params.reviewerUserId - The reviewerUserId parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateExitClearance({ id, department, isCleared, reviewerUserId }) {
        return withRetry(async () => {
            const field = `${department.toLowerCase()}_clearance`
            const byField = `${department.toLowerCase()}_clearance_by`

            const companyId = getActiveCompanyId()
            let query = supabase
                .from('exits')
                .update({
                    [field]: isCleared,
                    [byField]: isCleared ? reviewerUserId : null
                })
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
     * Update exit settlement.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.amount - The amount parameter
     * @param {any} params.details - The details parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateExitSettlement({ id, amount, details }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('exits')
                .update({
                    settlement_amount: amount,
                    settlement_details: details,
                    settlement_date: new Date().toISOString().split('T')[0]
                })
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { data, error } = await query
                .select()
                .single()
            if (error) throw error
            return data
        })
    }
}
