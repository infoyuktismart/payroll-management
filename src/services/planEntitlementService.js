import { supabase } from '../lib/supabase'
import { PLAN_FEATURE_SETS, normalizePlanFeatureKeys, planAllowsFeature } from '../lib/planFeatures'
import { getActiveCompanyId } from './tenantScope'
import { withRetry } from '../lib/withRetry'

const limitValue = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

const emptyEntitlements = {
  loading: false,
  hasSubscription: false,
  isActive: false,
  isTrial: false,
  plan: null,
  subscription: null,
  featureKeys: [],
  limits: {
    employees: null,
    branches: null,
    companies: null,
  },
  usage: {
    employees: 0,
    branches: 0,
    companies: 0,
  },
}

const isCurrentUserSuperAdmin = async () => {
  const { data: userRes } = await supabase.auth.getUser()
  const userId = userRes?.user?.id
  if (!userId) return false

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) return false
  return String(data?.role || '').toLowerCase() === 'superadmin'
}

export const planEntitlementService = {
  async getEntitlements(companyId = getActiveCompanyId()) {
    return withRetry(async () => {
      if (!companyId) return emptyEntitlements

      const [subscriptionRes, employeeRes, branchRes, companyRes] = await Promise.all([
        supabase
          .from('company_subscriptions')
          .select('*, plan:subscription_plans(*)')
          .eq('company_id', companyId)
          .maybeSingle(),
        supabase
          .from('employees')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('status', 'active'),
        supabase
          .from('branches')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId),
        supabase.from('companies').select('id', { count: 'exact', head: true }),
      ])

      if (subscriptionRes.error && subscriptionRes.error.code !== 'PGRST116')
        throw subscriptionRes.error
      if (employeeRes.error) throw employeeRes.error
      if (branchRes.error) throw branchRes.error
      if (companyRes.error) throw companyRes.error

      const subscription = subscriptionRes.data || null
      const plan = subscription?.plan || null
      const featureKeys = normalizePlanFeatureKeys(plan)
      const status = String(subscription?.status || '').toLowerCase()
      const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null
      const periodEndsAt = subscription?.current_period_end
        ? new Date(subscription.current_period_end)
        : null
      const isTrial = status === 'trialing'
      const isTrialExpired = Boolean(
        (isTrial && trialEndsAt && trialEndsAt < new Date()) || status === 'trial_expired'
      )
      const isSubscriptionExpired = Boolean(
        ['past_due', 'canceled', 'unpaid', 'incomplete_expired', 'expired'].includes(status) ||
        (status === 'active' && periodEndsAt && periodEndsAt < new Date())
      )
      const trialValid = isTrial && !isTrialExpired
      const hasSubscription = Boolean(subscription && plan)
      const isActive = (status === 'active' && !isSubscriptionExpired) || trialValid
      const isLocked = !hasSubscription || !isActive
      const lockReason = !hasSubscription
        ? 'no_subscription'
        : isTrialExpired
          ? 'trial_expired'
          : isSubscriptionExpired
            ? 'subscription_expired'
            : null

      const daysLeft = trialEndsAt
        ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null

      // Self-heal DB status if trial date passed while still marked 'trialing'
      if (isTrial && isTrialExpired && subscription?.id && status !== 'trial_expired') {
        supabase
          .from('company_subscriptions')
          .update({ status: 'trial_expired', updated_at: new Date().toISOString() })
          .eq('id', subscription.id)
          .then(() => {})
          .catch(() => {})
      }

      return {
        hasSubscription,
        isActive,
        isTrial,
        isTrialExpired,
        isSubscriptionExpired,
        isLocked,
        lockReason,
        trialEndsAt,
        periodEndsAt,
        daysLeft,
        plan,
        subscription,
        featureKeys,
        limits: {
          employees: limitValue(plan?.max_employees),
          branches: limitValue(plan?.max_branches),
          companies: limitValue(plan?.max_companies),
        },
        usage: {
          employees: employeeRes.count || 0,
          branches: branchRes.count || 0,
          companies: companyRes.count || 0,
        },
      }
    })
  },

  canUseFeature(entitlements, featureKey) {
    if (!featureKey) return Boolean(entitlements?.isActive)
    if (!entitlements?.hasSubscription) return false
    if (!entitlements?.isActive) return false
    return planAllowsFeature(
      entitlements.plan?.plan_code,
      featureKey,
      entitlements.featureKeys || PLAN_FEATURE_SETS[entitlements.plan?.plan_code] || []
    )
  },

  canAddUsage(entitlements, metricKey, increment = 1) {
    if (!entitlements?.isActive) return false
    const limit = entitlements?.limits?.[metricKey]
    if (!limit) return true
    return Number(entitlements?.usage?.[metricKey] || 0) + increment <= limit
  },

  async assertActiveSubscription(companyId = getActiveCompanyId()) {
    if (await isCurrentUserSuperAdmin()) {
      return { ...emptyEntitlements, isActive: true, hasSubscription: true, isLocked: false }
    }
    const entitlements = await this.getEntitlements(companyId)
    if (!entitlements?.isActive) {
      if (entitlements?.isTrialExpired) {
        throw new Error(
          'Your company trial period has expired. Please activate an enterprise license key to continue using services.'
        )
      }
      throw new Error(
        'An active company subscription or activated license key is required to perform this action.'
      )
    }
    return entitlements
  },

  async assertFeature(featureKey, companyId = getActiveCompanyId()) {
    if (await isCurrentUserSuperAdmin()) {
      return { ...emptyEntitlements, isActive: true, hasSubscription: true, isLocked: false }
    }
    const entitlements = await this.getEntitlements(companyId)
    if (!entitlements?.isActive) {
      if (entitlements?.isTrialExpired) {
        throw new Error(
          'Your company trial period has expired. Please activate an enterprise license key to continue using services.'
        )
      }
      throw new Error(
        'An active company subscription or license key is required to access this service.'
      )
    }
    if (!this.canUseFeature(entitlements, featureKey)) {
      const planName = entitlements.plan?.name || 'your current plan'
      throw new Error(
        `${planName} does not include this feature. Upgrade the subscription to continue.`
      )
    }
    return entitlements
  },
}
