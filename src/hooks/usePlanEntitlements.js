import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { planEntitlementService } from '../services/planEntitlementService'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'

export const usePlanEntitlements = () => {
    const { activeCompanyId } = useCompany()
    const { user, isAdmin, profileData } = useAuth()
    const enabled = Boolean(user && isAdmin && activeCompanyId)

    const load = useCallback(async () => {
        if (!enabled) return null
        return planEntitlementService.getEntitlements(activeCompanyId)
    }, [activeCompanyId, enabled])

    const query = useQuery({
        queryKey: ['planEntitlements', activeCompanyId, user?.id, isAdmin],
        queryFn: load,
        enabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    })

    const entitlements = enabled ? query.data || null : null

    return useMemo(() => ({
        loading: enabled ? query.isLoading : false,
        error: enabled ? query.error : null,
        entitlements,
        refresh: query.refetch,
        isSuperAdmin: profileData?.role === 'superadmin',
        canUseFeature: (featureKey) => (
            profileData?.role === 'superadmin'
                ? true
                : planEntitlementService.canUseFeature(entitlements, featureKey)
        ),
        canAddUsage: (metricKey, increment = 1) => planEntitlementService.canAddUsage(entitlements, metricKey, increment),
    }), [enabled, entitlements, profileData?.role, query.error, query.isLoading, query.refetch])
}
