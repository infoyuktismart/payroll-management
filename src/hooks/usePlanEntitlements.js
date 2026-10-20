import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { planEntitlementService } from '../services/planEntitlementService'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'

const getCachedLocked = (companyId) => {
  if (typeof window === 'undefined' || !companyId) return null
  try {
    const raw = localStorage.getItem(`payroll_plan_locked_${companyId}`)
    return raw !== null ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const setCachedLocked = (companyId, locked) => {
  if (typeof window === 'undefined' || !companyId) return
  try {
    localStorage.setItem(`payroll_plan_locked_${companyId}`, JSON.stringify(Boolean(locked)))
  } catch {
    // ignore
  }
}

export const usePlanEntitlements = (options = {}) => {
  const { activeCompanyId, loading: companyLoading } = useCompany()
  const { user, profileData, isSuperAdmin: authIsSuperAdmin } = useAuth()
  const isSuperAdmin = Boolean(
    authIsSuperAdmin ||
    profileData?.role === 'superadmin' ||
    user?.user_metadata?.role === 'superadmin'
  )
  const shouldCheck = Boolean(user && !isSuperAdmin && options.enabled !== false)
  const effectiveCompanyId = activeCompanyId || null
  const enabled = Boolean(shouldCheck && effectiveCompanyId)

  const load = useCallback(async () => {
    if (!effectiveCompanyId) return null
    const result = await planEntitlementService.getEntitlements(effectiveCompanyId)
    if (result && effectiveCompanyId) {
      setCachedLocked(effectiveCompanyId, result.isLocked)
    }
    return result
  }, [effectiveCompanyId])

  const query = useQuery({
    queryKey: ['planEntitlements', effectiveCompanyId, user?.id, isSuperAdmin],
    queryFn: load,
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const cachedLocked = getCachedLocked(effectiveCompanyId)
  const entitlements = shouldCheck ? query.data || null : null

  return useMemo(() => {
    // Loading state is true whenever company or entitlements are in-flight
    const isLoading = shouldCheck
      ? companyLoading ||
        !effectiveCompanyId ||
        query.isLoading ||
        (enabled && !query.data && !query.error)
      : false

    // Determine lock state: prioritize query response; fallback to cached value while loading
    const isLocked = isSuperAdmin
      ? false
      : entitlements
        ? Boolean(entitlements.isLocked)
        : cachedLocked !== null
          ? cachedLocked
          : false

    return {
      loading: isLoading,
      error: shouldCheck ? query.error : null,
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
  }, [
    shouldCheck,
    companyLoading,
    effectiveCompanyId,
    query.isLoading,
    query.data,
    query.error,
    query.refetch,
    enabled,
    isSuperAdmin,
    entitlements,
    cachedLocked,
  ])
}
