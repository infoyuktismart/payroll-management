import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Crown, RefreshCw, Save, Users, ArrowUpRight, KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { enterpriseAdminService } from '../services/enterpriseAdminService'
import { auditService } from '../lib/auditService'
import { formatCurrency } from '../lib/payrollUtils'
import { useToast } from '../context/ToastContext'
import { useCompany } from '../context/CompanyContext'
import RedeemLicenseModal from '../components/subscription/RedeemLicenseModal'

export default function SubscriptionManagement() {
  const toast = useToast()
  const navigate = useNavigate()
  const { profileData, isSuperAdmin: authIsSuperAdmin, user } = useAuth()
  const isSuperAdmin = Boolean(
    authIsSuperAdmin ||
    profileData?.role === 'superadmin' ||
    user?.user_metadata?.role === 'superadmin'
  )
  const queryClient = useQueryClient()
  const { activeCompanyId, selectedBranch } = useCompany()
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false)
  const [form, setForm] = useState({
    plan_id: '',
    status: 'trialing',
    billing_cycle: 'monthly',
    billing_model: 'flat',
  })

  const subscriptionQueryKey = useMemo(
    () => [
      'subscriptionDashboard',
      activeCompanyId || 'all-companies',
      selectedBranch || 'all-branches',
    ],
    [activeCompanyId, selectedBranch]
  )

  const subscriptionQuery = useQuery({
    queryKey: subscriptionQueryKey,
    queryFn: async () => {
      try {
        return await enterpriseAdminService.getSubscriptionDashboard(activeCompanyId)
      } catch (error) {
        toast.error(`Failed to load subscription data: ${error.message}`)
        throw error
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const data = subscriptionQuery.data || {
    plans: [],
    subscription: null,
    usageCounters: [],
    liveUsage: {},
  }
  const loading = subscriptionQuery.isLoading

  useEffect(() => {
    if (subscriptionQuery.data) {
      const dashboard = subscriptionQuery.data
      setForm({
        plan_id: dashboard.subscription?.plan_id || dashboard.plans[0]?.id || '',
        status: dashboard.subscription?.status || 'trialing',
        billing_cycle: dashboard.subscription?.billing_cycle || 'monthly',
        billing_model: dashboard.subscription?.billing_model || 'flat',
      })
    }
  }, [subscriptionQuery.data])

  const selectedPlan = useMemo(
    () => data.plans.find((plan) => plan.id === form.plan_id),
    [data.plans, form.plan_id]
  )
  const usage = [
    {
      key: 'employees',
      label: 'Employees',
      value:
        data.liveUsage.employees || getCounter(data.usageCounters, 'employees')?.metric_value || 0,
      limit: selectedPlan?.max_employees,
    },
    {
      key: 'branches',
      label: 'Branches',
      value:
        data.liveUsage.branches || getCounter(data.usageCounters, 'branches')?.metric_value || 0,
      limit: selectedPlan?.max_branches,
    },
    {
      key: 'companies',
      label: 'Companies',
      value: data.liveUsage.companies || 0,
      limit: selectedPlan?.max_companies,
    },
  ]

  const updateSubscriptionMutation = useMutation({
    mutationFn: async (formData) => {
      const safePayload = isSuperAdmin
        ? formData
        : { ...formData, status: data.subscription?.status || 'trialing' }
      const saved = await enterpriseAdminService.updateCompanySubscription(
        safePayload,
        activeCompanyId
      )
      await auditService.logWrite({
        tableName: 'company_subscriptions',
        recordId: saved.id,
        action: 'CLIENT_EVENT',
        before: data.subscription,
        after: saved,
      })
      return saved
    },
    onSuccess: () => {
      toast.success('Subscription updated.')
      queryClient.invalidateQueries({ queryKey: ['subscriptionDashboard'] })
    },
    onError: (error) => {
      toast.error(`Failed to save subscription: ${error.message}`)
    },
  })

  const saveSubscription = () => {
    if (!form.plan_id) {
      toast.warning('Select a plan first.')
      return
    }
    updateSubscriptionMutation.mutate(form)
  }

  const refreshUsageMutation = useMutation({
    mutationFn: () => enterpriseAdminService.refreshUsageCounters(activeCompanyId),
    onSuccess: () => {
      toast.success('Usage counters refreshed.')
      queryClient.invalidateQueries({ queryKey: ['subscriptionDashboard'] })
    },
    onError: (error) => {
      toast.error(`Failed to refresh usage: ${error.message}`)
    },
  })

  const refreshUsage = () => {
    refreshUsageMutation.mutate()
  }

  const saving = updateSubscriptionMutation.isPending || refreshUsageMutation.isPending

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Subscription Management</h1>
            <p className="text-sm text-slate-500">
              Manage plan assignment, billing status, and tenant usage counters.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsRedeemModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700 cursor-pointer transition"
          >
            <KeyRound className="w-4 h-4" />
            Redeem License Key
          </button>
          <button
            onClick={refreshUsage}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Usage
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setForm((prev) => ({ ...prev, plan_id: plan.id }))}
                className={`text-left rounded-2xl border p-5 transition ${form.plan_id === plan.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-100 bg-white hover:border-slate-300'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{plan.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                  </div>
                  <CreditCard className="w-5 h-5 text-slate-400" />
                </div>
                <div className="mt-4">
                  <p className="text-xl font-black text-slate-900">
                    {formatCurrency(plan.monthly_price)}
                    <span className="text-xs font-bold text-slate-500">/mo flat</span>
                  </p>
                  <p className="text-xs font-bold text-blue-600 mt-0.5">
                    OR {formatCurrency(plan.price_per_employee)}
                    <span className="text-[10px] text-slate-500">/employee/mo</span>
                  </p>
                </div>
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                  {(plan.features || []).map((feature) => (
                    <p key={feature} className="text-xs font-semibold text-slate-600">
                      - {feature}
                    </p>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-black text-slate-900 mb-4">Usage Counters</h2>
            <div className="space-y-4">
              {usage.map(({ key, ...props }) => (
                <UsageBar key={key} {...props} />
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-fit">
          <h2 className="font-black text-slate-900 mb-4">Current Subscription</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading subscription...</p>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Plan
                </span>
                <select
                  value={form.plan_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, plan_id: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700"
                >
                  {data.plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>

              {isSuperAdmin ? (
                <label className="block">
                  <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Status (Superadmin Override)
                  </span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700"
                  >
                    {['trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired'].map(
                      (status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      )
                    )}
                  </select>
                </label>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Subscription Status
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                        form.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : form.status === 'trialing'
                            ? 'bg-blue-100 text-blue-800'
                            : form.status === 'past_due'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {form.status}
                    </span>
                  </div>
                  {data.subscription?.trial_ends_at && form.status === 'trialing' && (
                    <p className="text-[11px] font-bold text-slate-500 mt-2">
                      Trial period ends on:{' '}
                      <span className="text-slate-800">
                        {new Date(data.subscription.trial_ends_at).toLocaleDateString()}
                      </span>
                    </p>
                  )}
                </div>
              )}

              <label className="block">
                <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Billing Cycle
                </span>
                <select
                  value={form.billing_cycle}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, billing_cycle: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700"
                >
                  <option value="monthly">monthly</option>
                  <option value="annual">annual</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Billing Model
                </span>
                <select
                  value={form.billing_model}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, billing_model: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700"
                >
                  <option value="flat">Flat Price Model</option>
                  <option value="per_employee">Per Employee (Yukti Smart HRMS)</option>
                </select>
              </label>

              {selectedPlan && (
                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-slate-700 uppercase mb-1">
                    Billing Estimate Preview
                  </p>
                  <p className="text-slate-500">
                    Active Staff Headcount:{' '}
                    <span className="font-bold text-slate-800">
                      {data.liveUsage.employees || 0}
                    </span>
                  </p>
                  {form.billing_model === 'per_employee' ? (
                    <p className="text-slate-500">
                      Estimated Cost:{' '}
                      <span className="font-black text-blue-600">
                        {formatCurrency(
                          (data.liveUsage.employees || 0) * (selectedPlan.price_per_employee || 0)
                        )}{' '}
                        / mo
                      </span>{' '}
                      + GST
                    </p>
                  ) : (
                    <p className="text-slate-500">
                      Estimated Cost:{' '}
                      <span className="font-black text-blue-600">
                        {formatCurrency(selectedPlan.monthly_price || 0)} / mo
                      </span>{' '}
                      + GST
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={saveSubscription}
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Plan Selection'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/billing')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-slate-500" />
                View Invoices & Settle Payment
                <ArrowUpRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => setIsRedeemModalOpen(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 cursor-pointer transition"
              >
                <KeyRound className="w-4 h-4 text-blue-600" />
                Have a License Key? Activate Here
              </button>
            </div>
          )}
        </div>
      </div>

      <RedeemLicenseModal
        isOpen={isRedeemModalOpen}
        onClose={() => setIsRedeemModalOpen(false)}
        activeCompanyId={activeCompanyId}
      />
    </div>
  )
}

const getCounter = (counters, key) => counters.find((counter) => counter.metric_key === key)

const UsageBar = ({ label, value, limit }) => {
  const numericLimit = Number(limit) || 0
  const percent =
    numericLimit > 0 ? Math.min(100, Math.round((Number(value) / numericLimit) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-black text-slate-800">{label}</p>
        </div>
        <p className="text-sm font-bold text-slate-600">
          {value} / {numericLimit || 'Unlimited'}
        </p>
      </div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${percent > 90 ? 'bg-rose-500' : percent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: numericLimit ? `${percent}%` : '100%' }}
        />
      </div>
    </div>
  )
}
