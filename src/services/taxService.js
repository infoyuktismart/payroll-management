import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId } from './tenantScope'

export const taxService = {
    /**
     * Get tax declarations.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getTaxDeclarations() {
        return withRetry(async () => {
            let query = supabase
                .from('tax_declarations')
                .select('*, employee:employees(id, first_name, last_name, employee_id, salary, salary_allowances)')
                .order('updated_at', { ascending: false })
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Review declaration.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.status - The status parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async reviewDeclaration({ id, status }) {
        return withRetry(async () => {
            const { data: authData } = await supabase.auth.getUser()
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('tax_declarations')
                .update({
                    status,
                    reviewed_by: authData?.user?.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { error } = await query
            if (error) throw error
            return true
        })
    }
}
