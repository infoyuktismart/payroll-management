import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'

export const superadminService = {
    /**
     * Fetch platform-wide superadmin dashboard metrics and lists.
     * @returns {Promise<any>} A promise resolving with the metrics data.
     */
    async getSuperAdminMetrics() {
        return withRetry(async () => {
            const { data, error } = await supabase.rpc('get_superadmin_metrics')
            if (error) throw error
            return data
        })
    },

    /**
     * Fetch all active subscription plans.
     * @returns {Promise<any>} A promise resolving with the plans list.
     */
    async getSubscriptionPlans() {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('subscription_plans')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
            if (error) throw error
            return data || []
        })
    },

    /**
     * Fetch current subscription limit data for a specific company.
     * @param {string} companyId - Corporate workspace UUID
     * @returns {Promise<any>} A promise resolving with the subscription or null.
     */
    async getCompanySubscription(companyId) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('company_subscriptions')
                .select('*')
                .eq('company_id', companyId)
                .maybeSingle()
            if (error) throw error
            return data
        })
    },

    /**
     * Upsert tenant subscription workspace overrides.
     * @param {any} subscription - Subscription details to upsert
     * @returns {Promise<any>} A promise resolving with the upserted data.
     */
    async upsertCompanySubscription(subscription) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('company_subscriptions')
                .upsert({
                    ...subscription,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'company_id' })
                .select()
            if (error) throw error
            return data
        })
    }
}
