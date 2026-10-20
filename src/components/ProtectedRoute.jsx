import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { devLog } from '../lib/devLogger'
import { ROUTE_FEATURES } from '../lib/planFeatures'
import { usePlanEntitlements } from '../hooks/usePlanEntitlements'
import PlanRestricted from './PlanRestricted'
import TrialExpiredLockout from './subscription/TrialExpiredLockout'

export default function ProtectedRoute({ children }) {
  const {
    user,
    loading,
    isRoleLoading,
    isAdmin,
    profileData,
    twoFactorChallenge,
    isTwoFactorVerified,
  } = useAuth()
  const location = useLocation()

  const isSuperAdmin = Boolean(
    profileData?.role === 'superadmin' || user?.user_metadata?.role === 'superadmin'
  )

  const {
    loading: entitlementLoading,
    entitlements,
    canUseFeature,
    isLocked,
  } = usePlanEntitlements({
    enabled: Boolean(user && !isSuperAdmin),
  })

  if (loading || isRoleLoading) {
    devLog('ProtectedRoute: Loading auth or role determination...')
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading application"
        className="min-h-screen flex items-center justify-center"
      >
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
          aria-hidden="true"
        />
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

  // SuperAdmin has global unrestricted access to all consoles
  if (isSuperAdmin) {
    return children
  }

  // While entitlements are resolving for this tenant, show loading state
  if (entitlementLoading && !entitlements) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Checking subscription status"
        className="min-h-screen flex items-center justify-center bg-gray-50"
      >
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
          aria-hidden="true"
        />
        <span className="sr-only">Verifying workspace subscription...</span>
      </div>
    )
  }

  // Enterprise Trial/Subscription Expiration Lockout
  if (isLocked) {
    // Admins must be permitted into Subscription & Billing to redeem license keys or pay
    const isLicenseManagementRoute =
      location.pathname === '/subscription-management' || location.pathname === '/billing'

    if (isAdmin && isLicenseManagementRoute) {
      return children
    }

    // For any other route (dashboard, employees, attendance, payroll, reports, portal, etc.),
    // hard-lock access and present the enterprise license activation screen
    return <TrialExpiredLockout entitlements={entitlements} />
  }

  // Plan Tier Feature Restriction (when subscription is active, but specific tier is lower)
  const requiredFeature = ROUTE_FEATURES[location.pathname]
  if (isAdmin && requiredFeature) {
    if (!canUseFeature(requiredFeature)) {
      return <PlanRestricted featureKey={requiredFeature} planName={entitlements?.plan?.name} />
    }
  }

  return children
}
