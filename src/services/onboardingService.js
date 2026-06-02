import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScopeList } from './tenantScope'

export const onboardingService = {
    /**
     * Get checklist.
     * @param {any} employeeId - The employeeId parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getChecklist(employeeId) {
        return withRetry(async () => {
            let query = supabase
                .from('onboarding_checklists')
                .select('*')
                .eq('employee_id', employeeId)
                .order('created_at', { ascending: true })
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Create tasks.
     * @param {any} tasks - The tasks parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createTasks(tasks) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('onboarding_checklists')
                .insert(withCompanyScopeList(tasks))
                .select()
            if (error) throw error
            return data || []
        })
    },

    /**
     * Update task status.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.status - The status parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateTaskStatus({ id, status }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('onboarding_checklists')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { error } = await query
            if (error) throw error
            return true
        })
    },

    /**
     * Delete task.
     * @param {any} id - The id parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async deleteTask(id) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('onboarding_checklists')
                .delete()
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { error } = await query
            if (error) throw error
            return true
        })
    }
}
