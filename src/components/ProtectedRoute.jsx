import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { devLog } from '../lib/devLogger'
import { ROUTE_FEATURES } from '../lib/planFeatures'
import { usePlanEntitlements } from '../hooks/usePlanEntitlements'
import PlanRestricted from './PlanRestricted'

export default function ProtectedRoute({ children }) {
    const { user, loading, isAdmin, profileData, twoFactorChallenge, isTwoFactorVerified } = useAuth()
    const { loading: entitlementLoading, entitlements, canUseFeature } = usePlanEntitlements()
    const location = useLocation()

    if (loading) {
        devLog('ProtectedRoute: Loading...')
        return (
            <div
                role="status"
                aria-live="polite"
                aria-label="Loading application"
                className="min-h-screen flex items-center justify-center"
            >
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-hidden="true" />
                <span className="sr-only">Loading application, please wait...</span>
            </div>
        )
    }

    devLog('ProtectedRoute Check:', { pathname: location.pathname, user: !!user, isAdmin })

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (twoFactorChallenge?.userId === user.id && !isTwoFactorVerified(user.id)) {
        return <Navigate to="/login" replace />
    }

    if (!isAdmin && location.pathname !== '/portal') {
        devLog('ProtectedRoute: Non-admin detected at:', location.pathname, '- Redirecting to /portal')
        return <Navigate to="/portal" replace />
    }

    const requiredFeature = ROUTE_FEATURES[location.pathname]
    if (isAdmin && requiredFeature && profileData?.role !== 'superadmin') {
        if (entitlementLoading) {
            return (
                <div
                    role="status"
                    aria-live="polite"
                    aria-label="Checking subscription"
                    className="min-h-screen flex items-center justify-center"
                >
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-hidden="true" />
                    <span className="sr-only">Checking subscription access...</span>
                </div>
            )
        }

        if (!canUseFeature(requiredFeature)) {
            return <PlanRestricted featureKey={requiredFeature} planName={entitlements?.plan?.name} />
        }
    }

    return children
}
