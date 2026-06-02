import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'

export const loanService = {
    /**
     * Get loans.
     * @param {Object} params - The parameter object
     * @param {any} params.page - The page parameter
     * @param {any} params.pageSize - The pageSize parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getLoans({ page = 0, pageSize = 50 } = {}) {
        return withRetry(async () => {
            let query = supabase
                .from('employee_loans')
                .select(`
                    *,
                    employee:employees(first_name, last_name, employee_id, designation, department)
                `, { count: 'exact' })
                .order('created_at', { ascending: false })
            query = applyCompanyFilter(query)
            const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1)
            if (error) throw error
            return { data: data || [], count, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) }
        })
    },

    /**
     * Create loan.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createLoan(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('employee_loans')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Update loan status.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.status - The status parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateLoanStatus({ id, status }) {
        return withRetry(async () => {
            const updates = {
                status,
                updated_at: new Date().toISOString()
            }
            if (status === 'active') {
                updates.disbursement_date = new Date().toISOString().split('T')[0]
            }

            const companyId = getActiveCompanyId()
            let query = supabase
                .from('employee_loans')
                .update(updates)
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { data, error } = await query
                .select()
                .single()
            if (error) throw error

            // Automated Enterprise-Level Integration: Link Approved Loans/Advances directly to Deductions
            if (status === 'active') {
                const deductionPayload = {
                    company_id: data.company_id || companyId,
                    employee_id: data.employee_id,
                    deduction_type: `Loan Recovery - ${data.loan_type}`,
                    amount: Number(data.emi_amount) || 0,
                    reason: `Automated recovery deduction for approved ${data.loan_type} (Loan ID: ${data.id})`,
                    is_recurring: true,
                    start_date: data.disbursement_date || new Date().toISOString().split('T')[0],
                    status: 'Active'
                }
                const { error: deductionError } = await supabase
                    .from('custom_deductions')
                    .insert([deductionPayload])
                if (deductionError) {
                    console.error('Failed to auto-create custom deduction:', deductionError.message)
                }
            } else if (status === 'closed' || status === 'rejected') {
                let deductionQuery = supabase
                    .from('custom_deductions')
                    .update({ status: status === 'closed' ? 'Completed' : 'Cancelled' })
                    .eq('employee_id', data.employee_id)
                    .ilike('deduction_type', `%Loan Recovery - ${data.loan_type}%`)
                    .eq('status', 'Active')
                if (companyId) deductionQuery = deductionQuery.eq('company_id', companyId)
                const { error: completeError } = await deductionQuery
                if (completeError) {
                    console.error('Failed to update custom deduction status:', completeError.message)
                }
            }

            return data
        })
    }
}
