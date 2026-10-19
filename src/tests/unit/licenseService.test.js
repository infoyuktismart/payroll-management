import { describe, it, expect, vi, beforeEach } from 'vitest'
import { licenseService } from '../../services/licenseService'
import { supabase } from '../../lib/supabase'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

vi.mock('../../services/tenantScope', () => ({
  getActiveCompanyId: vi.fn(() => 'company-123'),
}))

describe('licenseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('redeemLicenseKey', () => {
    it('throws error when license key is empty or blank', async () => {
      await expect(
        licenseService.redeemLicenseKey({ licenseKey: '', companyId: 'company-123' })
      ).rejects.toThrow('Please enter a valid license key.')
    })

    it('sanitizes and invokes redeem_license_key RPC successfully', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: {
          success: true,
          plan_name: 'Enterprise Plan',
          duration_days: 365,
          period_end: '2027-10-19T00:00:00Z',
          license_key: 'YUKTI-ENT-ABCD-1234-EFGH',
        },
        error: null,
      })

      const res = await licenseService.redeemLicenseKey({
        licenseKey: '  yukti-ent-abcd-1234-efgh  ',
        companyId: 'company-123',
      })

      expect(supabase.rpc).toHaveBeenCalledWith('redeem_license_key', {
        p_license_key: 'YUKTI-ENT-ABCD-1234-EFGH',
        p_company_id: 'company-123',
      })
      expect(res.success).toBe(true)
      expect(res.plan_name).toBe('Enterprise Plan')
    })

    it('throws descriptive error if RPC returns failure', async () => {
      supabase.rpc.mockResolvedValue({
        data: {
          success: false,
          error: 'This license key has already been redeemed',
        },
        error: null,
      })

      await expect(
        licenseService.redeemLicenseKey({
          licenseKey: 'YUKTI-ALREADY-USED-KEY1',
          companyId: 'company-123',
        })
      ).rejects.toThrow('This license key has already been redeemed')
    })
  })

  describe('adminCreateLicenseKey', () => {
    it('invokes admin_create_license_key with correct parameters', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: {
          success: true,
          license_key: 'YUKTI-GROW-9999-8888-7777',
          duration_days: 365,
        },
        error: null,
      })

      const result = await licenseService.adminCreateLicenseKey({
        planId: 'plan-growth-uuid',
        durationDays: 365,
        billingCycle: 'annual',
        notes: 'Annual offline contract',
      })

      expect(supabase.rpc).toHaveBeenCalledWith('admin_create_license_key', {
        p_plan_id: 'plan-growth-uuid',
        p_duration_days: 365,
        p_billing_cycle: 'annual',
        p_max_employees: null,
        p_max_branches: null,
        p_assigned_to_company_id: null,
        p_notes: 'Annual offline contract',
        p_valid_until: null,
      })
      expect(result.license_key).toBe('YUKTI-GROW-9999-8888-7777')
    })
  })
})
