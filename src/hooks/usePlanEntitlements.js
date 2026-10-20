import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { planEntitlementService } from '../services/planEntitlementService'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'

export const usePlanEntitlements = (options = {}) => {
  const { activeCompanyId } = useCompany()
  const { user, profileData, isSuperAdmin: authIsSuperAdmin } = useAuth()
  const isSuperAdmin = Boolean(
    authIsSuperAdmin ||
    profileData?.role === 'superadmin' ||
    user?.user_metadata?.role === 'superadmin'
  )
  const enabled = Boolean(user && activeCompanyId && options.enabled !== false)

  const load = useCallback(async () => {
    if (!enabled) return null
    return planEntitlementService.getEntitlements(activeCompanyId)
  }, [activeCompanyId, enabled])

  const query = useQuery({
    queryKey: ['planEntitlements', activeCompanyId, user?.id, isSuperAdmin],
    queryFn: load,
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const entitlements = enabled ? query.data || null : null

  return useMemo(() => {
    const isLocked = isSuperAdmin ? false : Boolean(entitlements?.isLocked)
    return {
      loading: enabled ? query.isLoading : false,
      error: enabled ? query.error : null,
      entitlements,
      refresh: query.refetch,
      isSuperAdmin,
      isLocked,
      lockReason: isSuperAdmin ? null : entitlements?.lockReason,
      isTrialExpired: isSuperAdmin ? false : Boolean(entitlements?.isTrialExpired),
      daysLeft: entitlements?.daysLeft ?? null,
      trialEndsAt: entitlements?.trialEndsAt ?? null,
      canUseFeature: (featureKey) => {
        if (isSuperAdmin) return true
        if (isLocked) return false
        return planEntitlementService.canUseFeature(entitlements, featureKey)
      },
      canAddUsage: (metricKey, increment = 1) => {
        if (isSuperAdmin) return true
        if (isLocked) return false
        return planEntitlementService.canAddUsage(entitlements, metricKey, increment)
      },
    }
  }, [enabled, entitlements, isSuperAdmin, query.error, query.isLoading, query.refetch])
}
