import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Crown } from 'lucide-react'
import { differenceInCalendarDays, format } from 'date-fns'
import { enterpriseAdminService } from '../services/enterpriseAdminService'
import { formatCurrency } from '../lib/payrollUtils'
import { useCompany } from '../context/CompanyContext'
import { getActiveCompanyId } from '../services/tenantScope'

export default function SubscriptionStatusBanner({ onlyUrgent = false }) {
  const { activeCompanyId } = useCompany()
  const targetCompanyId = activeCompanyId || getActiveCompanyId()
  const {
    data: dashboard,
    error,
    isLoading: loading,
  } = useQuery({
    queryKey: ['subscriptionDashboard', targetCompanyId],
    queryFn: () => enterpriseAdminService.getSubscriptionDashboard(targetCompanyId),
    enabled: Boolean(targetCompanyId),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const status = useMemo(() => {
    const subscription = dashboard?.subscription
    const plan = subscription?.plan
    if (!subscription || !plan) return null

    const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null
    const daysLeft = trialEnd ? differenceInCalendarDays(trialEnd, new Date()) : null
    const employeeCount = Number(dashboard?.liveUsage?.employees || 0)
    const amount =
      subscription.billing_model === 'per_employee'
        ? employeeCount * Number(plan.price_per_employee || 0)
        : Number(plan.monthly_price || 0)

    return {
      subscription,
      plan,
      trialEnd,
      daysLeft,
      employeeCount,
      amount,
    }
  }, [dashboard])

  if (loading) {
    return null
  }

  if (error) {
    if (onlyUrgent) return null
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <p className="text-sm font-bold text-amber-900">
            Subscription status could not be loaded: {error.message}
          </p>
        </div>
        <Link
          to="/subscription-management"
          className="text-xs font-black uppercase tracking-wider text-amber-700 hover:text-amber-900"
        >
          Review
        </Link>
      </div>
    )
  }

  if (!status) {
    if (onlyUrgent) return null
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <Crown className="h-5 w-5 text-blue-700" />
          <p className="text-sm font-bold text-blue-950">
            No subscription is attached to this company yet.
          </p>
        </div>
        <Link
          to="/subscription-management"
          className="text-xs font-black uppercase tracking-wider text-blue-700 hover:text-blue-900"
        >
          Setup Plan
        </Link>
      </div>
    )
  }

  const isTrial = status.subscription.status === 'trialing'
  const isUrgent = isTrial && status.daysLeft !== null && status.daysLeft <= 3

  // If onlyUrgent is requested and it's not urgent/expired, do not show intrusive banner
  if (onlyUrgent && !isUrgent) {
    return null
  }

  const palette = isUrgent
    ? 'border-amber-200 bg-amber-50 text-amber-950'
    : 'border-emerald-200 bg-emerald-50 text-emerald-950'

  return (
    <div
      className={`mb-4 flex flex-col gap-3 rounded-xl border px-4 py-3 lg:flex-row lg:items-center lg:justify-between ${palette}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-white/70 p-2">
          <Crown className={`h-4 w-4 ${isUrgent ? 'text-amber-700' : 'text-emerald-700'}`} />
        </div>
        <div>
          <p className="text-sm font-black">
            {isTrial
              ? `${status.plan.name} trial: ${Math.max(status.daysLeft ?? 0, 0)} days left`
              : `${status.plan.name} subscription: ${status.subscription.status}`}
          </p>
          <p className="mt-1 text-xs font-semibold opacity-80">
            {status.employeeCount} active employees. Estimated monthly billing is{' '}
            {formatCurrency(status.amount)}
            {status.subscription.billing_model === 'per_employee'
              ? ' using per-employee pricing.'
              : ' using flat pricing.'}
            {status.trialEnd ? ` Trial ends ${format(status.trialEnd, 'dd MMM yyyy')}.` : ''}
          </p>
        </div>
      </div>
      <Link
        to="/subscription-management"
        className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-black"
      >
        Manage Subscription
      </Link>
    </div>
  )
}

/**
 * Compact, modern header pill for enterprise-grade navigation (Keka-style)
 */
export function SubscriptionHeaderPill() {
  const { activeCompanyId } = useCompany()
  const targetCompanyId = activeCompanyId || getActiveCompanyId()
  const { data: dashboard } = useQuery({
    queryKey: ['subscriptionDashboard', targetCompanyId],
    queryFn: () => enterpriseAdminService.getSubscriptionDashboard(targetCompanyId),
    enabled: Boolean(targetCompanyId),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const subscription = dashboard?.subscription
  const plan = subscription?.plan
  if (!subscription || !plan) return null

  const isTrial = subscription.status === 'trialing'
  const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null
  const daysLeft = trialEnd ? differenceInCalendarDays(trialEnd, new Date()) : null
  const isUrgent = isTrial && daysLeft !== null && daysLeft <= 3

  return (
    <Link
      to="/subscription-management"
      className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 ${
        isUrgent
          ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-xs'
          : 'bg-emerald-50 text-emerald-800 border-emerald-200/90 hover:bg-emerald-100 shadow-xs'
      }`}
      title="Click to view subscription and billing details"
    >
      <Crown className={`w-3.5 h-3.5 ${isUrgent ? 'text-amber-600' : 'text-emerald-600'}`} />
      <span>
        {isTrial ? `${plan.name} Trial • ${Math.max(daysLeft ?? 0, 0)}d left` : `${plan.name}`}
      </span>
    </Link>
  )
}
