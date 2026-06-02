import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Crown, RefreshCw } from 'lucide-react'
import { differenceInCalendarDays, format } from 'date-fns'
import { enterpriseAdminService } from '../services/enterpriseAdminService'
import { formatCurrency } from '../lib/payrollUtils'
import { useCompany } from '../context/CompanyContext'

export default function SubscriptionStatusBanner() {
    const { activeCompanyId } = useCompany()
    const {
        data: dashboard,
        error,
        isLoading: loading
    } = useQuery({
        queryKey: ['subscriptionDashboard', activeCompanyId],
        queryFn: () => enterpriseAdminService.getSubscriptionDashboard(),
        enabled: Boolean(activeCompanyId),
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
        const amount = subscription.billing_model === 'per_employee'
            ? employeeCount * Number(plan.price_per_employee || 0)
            : Number(plan.monthly_price || 0)

        return {
            subscription,
            plan,
            trialEnd,
            daysLeft,
            employeeCount,
            amount
        }
    }, [dashboard])

    if (loading) {
        return (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Checking subscription status...
            </div>
        )
    }

    if (error) {
        return (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <p className="text-sm font-bold text-amber-900">Subscription status could not be loaded: {error.message}</p>
                </div>
                <Link to="/subscription-management" className="text-xs font-black uppercase tracking-wider text-amber-700 hover:text-amber-900">
                    Review
                </Link>
            </div>
        )
    }

    if (!status) {
        return (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-blue-700" />
                    <p className="text-sm font-bold text-blue-950">No subscription is attached to this company yet.</p>
                </div>
                <Link to="/subscription-management" className="text-xs font-black uppercase tracking-wider text-blue-700 hover:text-blue-900">
                    Setup Plan
                </Link>
            </div>
        )
    }

    const isTrial = status.subscription.status === 'trialing'
    const isUrgent = isTrial && status.daysLeft !== null && status.daysLeft <= 3
    const palette = isUrgent
        ? 'border-amber-200 bg-amber-50 text-amber-950'
        : 'border-emerald-200 bg-emerald-50 text-emerald-950'

    return (
        <div className={`mb-4 flex flex-col gap-3 rounded-xl border px-4 py-3 lg:flex-row lg:items-center lg:justify-between ${palette}`}>
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
                        {status.employeeCount} active employees. Estimated monthly billing is {formatCurrency(status.amount)}
                        {status.subscription.billing_model === 'per_employee' ? ' using per-employee pricing.' : ' using flat pricing.'}
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
