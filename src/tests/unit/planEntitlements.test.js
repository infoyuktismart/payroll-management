import { describe, it, expect, vi, beforeEach } from 'vitest'
import { planEntitlementService } from '../../services/planEntitlementService'
import { supabase } from '../../lib/supabase'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('../../services/tenantScope', () => ({
  getActiveCompanyId: vi.fn(() => 'test-company-id'),
}))

describe('planEntitlementService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-regular' } },
      error: null,
    })
  })

  const setupSupabaseMocks = ({
    subscription = null,
    employeesCount = 3,
    branchesCount = 1,
    companiesCount = 1,
    role = 'admin',
  } = {}) => {
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error: null }),
            }),
          }),
        }
      }
      if (table === 'company_subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: subscription, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      }
      if (table === 'employees') {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({ count: employeesCount, error: null }),
            }),
          }),
        }
      }
      if (table === 'branches') {
        return {
          select: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({ count: branchesCount, error: null }),
            }),
          }),
        }
      }
      if (table === 'companies') {
        return {
          select: () => vi.fn().mockResolvedValue({ count: companiesCount, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })
  }

  describe('getEntitlements', () => {
    it('returns empty entitlements if companyId is missing', async () => {
      const res = await planEntitlementService.getEntitlements(null)
      expect(res.hasSubscription).toBe(false)
      expect(res.isActive).toBe(false)
      expect(res.featureKeys).toEqual([])
    })

    it('identifies expired trial when trial_ends_at is in the past', async () => {
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      setupSupabaseMocks({
        subscription: {
          id: 'sub-1',
          status: 'trialing',
          trial_ends_at: pastDate,
          plan: {
            name: 'Starter Plan',
            plan_code: 'starter',
            features: ['payroll'],
            max_employees: 10,
          },
        },
      })

      const res = await planEntitlementService.getEntitlements('test-company-id')

      expect(res.isTrial).toBe(true)
      expect(res.isTrialExpired).toBe(true)
      expect(res.isActive).toBe(false)
      expect(res.isLocked).toBe(true)
      expect(res.lockReason).toBe('trial_expired')
      expect(res.daysLeft).toBeLessThan(0)
    })

    it('identifies active trial when trial_ends_at is in the future', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
      setupSupabaseMocks({
        subscription: {
          id: 'sub-2',
          status: 'trialing',
          trial_ends_at: futureDate,
          plan: {
            name: 'Growth Plan',
            plan_code: 'growth',
            features: ['payroll', 'reports'],
            max_employees: 50,
          },
        },
      })

      const res = await planEntitlementService.getEntitlements('test-company-id')

      expect(res.isTrial).toBe(true)
      expect(res.isTrialExpired).toBe(false)
      expect(res.isActive).toBe(true)
      expect(res.isLocked).toBe(false)
      expect(res.lockReason).toBeNull()
      expect(res.daysLeft).toBeGreaterThan(0)
    })

    it('identifies expired status when company_subscriptions has trial_expired', async () => {
      setupSupabaseMocks({
        subscription: {
          id: 'sub-3',
          status: 'trial_expired',
          plan: {
            name: 'Starter Plan',
            plan_code: 'starter',
            features: ['payroll'],
          },
        },
      })

      const res = await planEntitlementService.getEntitlements('test-company-id')

      expect(res.isTrialExpired).toBe(true)
      expect(res.isActive).toBe(false)
      expect(res.isLocked).toBe(true)
      expect(res.lockReason).toBe('trial_expired')
    })

    it('identifies canceled or past_due subscription as expired and locked', async () => {
      setupSupabaseMocks({
        subscription: {
          id: 'sub-4',
          status: 'canceled',
          plan: {
            name: 'Enterprise Plan',
            plan_code: 'enterprise',
            features: ['payroll', 'all'],
          },
        },
      })

      const res = await planEntitlementService.getEntitlements('test-company-id')

      expect(res.isSubscriptionExpired).toBe(true)
      expect(res.isActive).toBe(false)
      expect(res.isLocked).toBe(true)
      expect(res.lockReason).toBe('subscription_expired')
    })
  })

  describe('canUseFeature and canAddUsage', () => {
    it('blocks feature usage when workspace is locked due to expired trial', () => {
      const entitlements = {
        isActive: false,
        hasSubscription: true,
        isTrialExpired: true,
        isLocked: true,
        plan: { plan_code: 'starter' },
        featureKeys: ['payroll'],
      }

      expect(planEntitlementService.canUseFeature(entitlements, 'payroll')).toBe(false)
      expect(planEntitlementService.canUseFeature(entitlements, null)).toBe(false)
    })

    it('blocks adding usage when workspace is locked', () => {
      const entitlements = {
        isActive: false,
        hasSubscription: true,
        limits: { employees: 20 },
        usage: { employees: 5 },
      }

      expect(planEntitlementService.canAddUsage(entitlements, 'employees', 1)).toBe(false)
    })

    it('enforces limit threshold when active', () => {
      const entitlements = {
        isActive: true,
        hasSubscription: true,
        limits: { employees: 10 },
        usage: { employees: 10 },
      }

      expect(planEntitlementService.canAddUsage(entitlements, 'employees', 1)).toBe(false)
      expect(planEntitlementService.canAddUsage(entitlements, 'employees', 0)).toBe(true)
    })
  })

  describe('assertActiveSubscription', () => {
    it('throws error when trial is expired', async () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      setupSupabaseMocks({
        subscription: {
          id: 'sub-exp',
          status: 'trialing',
          trial_ends_at: pastDate,
          plan: { name: 'Starter Plan', plan_code: 'starter' },
        },
      })

      await expect(
        planEntitlementService.assertActiveSubscription('test-company-id')
      ).rejects.toThrow(
        'Your company trial period has expired. Please activate an enterprise license key'
      )
    })

    it('throws error when no subscription exists', async () => {
      setupSupabaseMocks({ subscription: null })

      await expect(
        planEntitlementService.assertActiveSubscription('test-company-id')
      ).rejects.toThrow('An active company subscription or activated license key is required')
    })

    it('passes and returns entitlements when subscription is active', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      setupSupabaseMocks({
        subscription: {
          id: 'sub-act',
          status: 'active',
          current_period_end: futureDate,
          plan: { name: 'Enterprise Plan', plan_code: 'enterprise' },
        },
      })

      const res = await planEntitlementService.assertActiveSubscription('test-company-id')
      expect(res.isActive).toBe(true)
      expect(res.isLocked).toBe(false)
    })

    it('bypasses lockout check for SuperAdmin', async () => {
      setupSupabaseMocks({
        subscription: null, // no subscription
        role: 'superadmin',
      })

      const res = await planEntitlementService.assertActiveSubscription('test-company-id')
      expect(res.isActive).toBe(true)
      expect(res.isLocked).toBe(false)
    })
  })

  describe('assertFeature', () => {
    it('throws when trial is expired before checking feature', async () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      setupSupabaseMocks({
        subscription: {
          id: 'sub-exp',
          status: 'trialing',
          trial_ends_at: pastDate,
          plan: { name: 'Starter Plan', plan_code: 'starter' },
        },
      })

      await expect(
        planEntitlementService.assertFeature('multi_branch', 'test-company-id')
      ).rejects.toThrow('Your company trial period has expired')
    })
  })
})
