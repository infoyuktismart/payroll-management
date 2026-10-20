import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, RefreshCw, ShieldAlert } from 'lucide-react'
import { formatCurrency } from '../lib/payrollUtils'
import { useToast } from '../context/ToastContext'
import { useCompany } from '../context/CompanyContext'
import { useAuth } from '../context/AuthContext'

// Services & Hooks
import {
  useSuperAdminMetricsQuery,
  useSubscriptionPlansQuery,
  useUpsertSubscriptionMutation,
} from '../hooks/useSuperAdmin'
import { superadminService } from '../services/superadminService'

// Subcomponents
import SuperAdminStats from '../components/superadmin/SuperAdminStats'
import TenantWorkspacesTable from '../components/superadmin/TenantWorkspacesTable'
import PlatformInvoicesTable from '../components/superadmin/PlatformInvoicesTable'
import ManageSubscriptionModal from '../components/superadmin/ManageSubscriptionModal'
import SuperAdminLicenseKeys from '../components/superadmin/SuperAdminLicenseKeys'

export default function SuperAdminDashboard() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { switchCompany } = useCompany()
  const [actionLoading, setActionLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const handleInspectWorkspace = (tenant) => {
    if (!tenant?.id) return
    switchCompany(tenant.id)
    toast.success(`Switched context to ${tenant.company_name}. Opening HRMS workspace...`)
    navigate('/dashboard')
  }

  // Tenant override modal state
  const [editingTenant, setEditingTenant] = useState(null)
  const [editForm, setEditForm] = useState({
    plan_id: '',
    status: 'trialing',
    billing_model: 'per_employee',
    billing_cycle: 'monthly',
  })

  // React Query Queries & Mutations
  const {
    data: dashboard = {
      stats: {
        totalCompanies: 0,
        totalEmployees: 0,
        totalTrials: 0,
        totalActiveSubscriptions: 0,
        totalBilled: 0,
        totalOutstanding: 0,
      },
      tenants: [],
      recentInvoices: [],
    },
    error: metricsError,
    isLoading,
    isFetching,
    refetch,
  } = useSuperAdminMetricsQuery()

  const { data: plansList = [] } = useSubscriptionPlansQuery()
  const upsertSubscriptionMutation = useUpsertSubscriptionMutation()

  const loading = isLoading || isFetching || actionLoading

  const handleEditTenant = async (tenant) => {
    setActionLoading(true)
    try {
      const subData = await superadminService.getCompanySubscription(tenant.id)
      setEditingTenant(tenant)
      setEditForm({
        plan_id: subData?.plan_id || plansList[0]?.id || '',
        status: subData?.status || 'trialing',
        billing_model: subData?.billing_model || 'per_employee',
        billing_cycle: subData?.billing_cycle || 'monthly',
      })
    } catch (e) {
      toast.error(`Failed to fetch subscription: ${e.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  const saveTenantOverride = async (e) => {
    if (e) e.preventDefault()
    setActionLoading(true)
    try {
      await upsertSubscriptionMutation.mutateAsync({
        company_id: editingTenant.id,
        ...editForm,
      })
      toast.success(`Workspace limits overridden for ${editingTenant.company_name}!`)
      setEditingTenant(null)
    } catch (e) {
      toast.error(`Failed to save limits: ${e.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Filtered lists computation
  const filteredTenants = useMemo(() => {
    return (dashboard.tenants || []).filter((tenant) => {
      const matchesSearch =
        tenant.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.company_code?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || tenant.subscription_status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [dashboard.tenants, searchQuery, statusFilter])

  return (
    <div className="space-y-6">
      {/* Header Block */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 text-white p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Shield className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">
              Central Operations Console
            </h1>
            <p className="text-sm text-slate-400">
              Platform-wide tenant diagnostics, multi-company billing audit, and MRR aggregates.
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm font-bold text-white cursor-pointer transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Analytics
        </button>
      </div>

      {/* Permission Guidance Banner for Admins needing SuperAdmin promotion */}
      {metricsError && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-900">
                Super Admin Permissions Required
              </h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                {metricsError.message ||
                  'Your current account has Company Admin permissions, but managing cross-company workspaces and generating enterprise license keys requires platform-wide superadmin access.'}
              </p>
            </div>
          </div>
          <div className="p-3 bg-white rounded-xl border border-amber-200 font-mono text-xs text-slate-800 overflow-x-auto">
            <code>
              {user?.email
                ? `SELECT public.promote_user_to_superadmin('${user.email}');`
                : `UPDATE public.profiles SET role = 'superadmin' WHERE email = 'YOUR_EMAIL';`}
            </code>
          </div>
          <p className="text-[11px] text-amber-700">
            Run the SQL function above in your Supabase SQL Editor to elevate your user account to
            superadmin.
          </p>
        </div>
      )}

      {/* Aggregated KPI Metrics Grid */}
      <SuperAdminStats stats={dashboard.stats} formatCurrency={formatCurrency} />

      {/* Split Screen Dashboard details */}
      <div className="space-y-6">
        {/* Section 1: Enterprise License Key Management */}
        <SuperAdminLicenseKeys plansList={plansList} tenantsList={dashboard.tenants || []} />

        {/* Section 2: Tenant List */}
        <TenantWorkspacesTable
          tenants={filteredTenants}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onManagePlan={handleEditTenant}
          onInspectWorkspace={handleInspectWorkspace}
          formatCurrency={formatCurrency}
        />

        {/* Section 3: Platform-Wide Invoices */}
        <PlatformInvoicesTable
          invoices={dashboard.recentInvoices || []}
          formatCurrency={formatCurrency}
        />
      </div>

      {/* Manage Tenant Overrides Modal Overlay */}
      <ManageSubscriptionModal
        isOpen={!!editingTenant}
        onClose={() => setEditingTenant(null)}
        tenant={editingTenant}
        plansList={plansList}
        editForm={editForm}
        setEditForm={setEditForm}
        onSave={saveTenantOverride}
        saving={loading}
      />

      <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
    </div>
  )
}
