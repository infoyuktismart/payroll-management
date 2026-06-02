import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'

export const reimbursementService = {
    /**
     * Get claims.
     * @param {Object} params - The parameter object
     * @param {any} params.page - The page parameter
     * @param {any} params.pageSize - The pageSize parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getClaims({ page = 0, pageSize = 50 } = {}) {
        return withRetry(async () => {
            let query = supabase
                .from('reimbursements')
                .select(`
                    *,
                    employee:employees!employee_id(first_name, last_name, employee_id, designation, department)
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
            query = applyCompanyFilter(query)
            const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1)
            if (error) throw error
            return { data: data || [], count, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) }
        })
    },

    /**
     * Create claim.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createClaim(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('reimbursements')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Update claim status.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.status - The status parameter
     * @param {any} params.reviewerUserId - The reviewerUserId parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateClaimStatus({ id, status, reviewerUserId }) {
        return withRetry(async () => {
            let reviewerEmployeeId = null
            if (reviewerUserId) {
                let reviewerQuery = supabase
                    .from('employees')
                    .select('id')
                    .eq('user_id', reviewerUserId)
                reviewerQuery = applyCompanyFilter(reviewerQuery)
                const { data: reviewer, error: revErr } = await reviewerQuery
                    .maybeSingle()
                if (!revErr && reviewer) {
                    reviewerEmployeeId = reviewer.id
                }
            }

            const updates = {
                status,
                approved_by: status === 'approved' ? reviewerEmployeeId : null,
                approved_at: status === 'approved' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            }

            const companyId = getActiveCompanyId()
            let query = supabase
                .from('reimbursements')
                .update(updates)
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
