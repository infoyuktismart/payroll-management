import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { getActiveCompanyId } from './tenantScope'

export const licenseService = {
  /**
   * Redeem an enterprise license key for a company.
   * Works before trial expiration (extending plan) or after trial expiration (reactivating workspace).
   * @param {Object} params
   * @param {string} params.licenseKey
   * @param {string} [params.companyId]
   * @returns {Promise<Object>}
   */
  async redeemLicenseKey({ licenseKey, companyId }) {
    return withRetry(async () => {
      const targetCompanyId = companyId || getActiveCompanyId()
      if (!targetCompanyId) {
        throw new Error('Active company context is required to redeem a license.')
      }

      const cleanKey = String(licenseKey || '')
        .trim()
        .toUpperCase()
      if (!cleanKey) {
        throw new Error('Please enter a valid license key.')
      }

      const { data, error } = await supabase.rpc('redeem_license_key', {
        p_license_key: cleanKey,
        p_company_id: targetCompanyId,
      })

      if (error) throw error
      if (data && !data.success) {
        const err = new Error(data.error || 'Failed to redeem license key.')
        err.status = 400
        throw err
      }

      return data
    })
  },

  /**
   * Get redemption history for a specific company.
   * @param {string} [companyId]
   * @returns {Promise<Array>}
   */
  async getCompanyLicenseHistory(companyId) {
    return withRetry(async () => {
      const targetCompanyId = companyId || getActiveCompanyId()
      if (!targetCompanyId) return []

      const { data, error } = await supabase
        .from('license_keys')
        .select(
          'id, license_key, billing_cycle, duration_days, redeemed_at, plan:subscription_plans(name, plan_code)'
        )
        .eq('redeemed_by_company_id', targetCompanyId)
        .order('redeemed_at', { ascending: false })

      if (error) {
        // If table doesn't exist yet in remote instance, return empty gracefully
        if (['42P01', '42703'].includes(error.code)) return []
        throw error
      }

      return data || []
    })
  },

  /**
   * Superadmin: Generate a new enterprise license key.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async adminCreateLicenseKey({
    planId,
    durationDays = 365,
    billingCycle = 'annual',
    maxEmployees = null,
    maxBranches = null,
    assignedToCompanyId = null,
    notes = null,
    validUntil = null,
  }) {
    return withRetry(async () => {
      const { data, error } = await supabase.rpc('admin_create_license_key', {
        p_plan_id: planId,
        p_duration_days: durationDays,
        p_billing_cycle: billingCycle,
        p_max_employees: maxEmployees,
        p_max_branches: maxBranches,
        p_assigned_to_company_id: assignedToCompanyId,
        p_notes: notes,
        p_valid_until: validUntil,
      })

      if (error) throw error
      if (data && !data.success) {
        const err = new Error(data.error || 'Failed to generate license key.')
        err.status = 400
        throw err
      }

      return data
    })
  },

  /**
   * Superadmin: List all generated license keys with pagination and filtering.
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async adminListLicenseKeys({ page = 0, pageSize = 25, status = 'all' } = {}) {
    return withRetry(async () => {
      let query = supabase
        .from('license_keys')
        .select(
          '*, plan:subscription_plans(name, plan_code), company:companies!license_keys_redeemed_by_company_id_fkey(name)',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })

      if (status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) {
        if (['42P01', '42703'].includes(error.code)) {
          return { data: [], count: 0, totalPages: 0 }
        }
        throw error
      }

      return {
        data: data || [],
        count: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      }
    })
  },

  /**
   * Superadmin: Revoke an active license key.
   * @param {string} licenseKeyId
   * @returns {Promise<boolean>}
   */
  async adminRevokeLicenseKey(licenseKeyId) {
    return withRetry(async () => {
      const { error } = await supabase
        .from('license_keys')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('id', licenseKeyId)

      if (error) throw error
      return true
    })
  },
}
