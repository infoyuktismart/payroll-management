import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'

export const companyService = {
    /**
     * Get company settings.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getCompanySettings() {
        return withRetry(async () => {
            let query = supabase
                .from('company_settings')
                .select('*')
                .limit(1)
            query = applyCompanyFilter(query)
            const { data, error } = await query
                .maybeSingle()
            if (error) throw error
            return data
        })
    },

    /**
     * Update company settings.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.updates - The updates parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateCompanySettings({ id, updates }) {
        return withRetry(async () => {
            let res
            const scopedUpdates = withCompanyScope(updates)
            if (id) {
                const companyId = getActiveCompanyId()
                let query = supabase
                    .from('company_settings')
                    .update(scopedUpdates)
                    .eq('id', id)
                if (companyId) query = query.eq('company_id', companyId)
                res = await query
                    .select()
                    .single()
            } else {
                res = await supabase
                    .from('company_settings')
                    .insert([scopedUpdates])
                    .select()
                    .single()
            }
            if (res.error) throw res.error
            return res.data
        })
    }
}
