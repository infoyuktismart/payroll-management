import { useEffect, useState, useMemo } from 'react'
import { 
    Shield, 
    Building2, 
    Users, 
    TrendingUp, 
    AlertTriangle, 
    RefreshCw, 
    CreditCard, 
    Clock, 
    FileText, 
    ChevronRight,
    Settings,
    Edit2,
    X,
    Check,
    Search,
    Filter
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/payrollUtils'
import { useToast } from '../context/ToastContext'

export default function SuperAdminDashboard() {
    const toast = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dashboard, setDashboard] = useState({
        stats: { totalCompanies: 0, totalEmployees: 0, totalTrials: 0, totalActiveSubscriptions: 0, totalBilled: 0, totalOutstanding: 0 },
        tenants: [],
        recentInvoices: []
    })

    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')

    // Tenant management modal state
    const [editingTenant, setEditingTenant] = useState(null)
    const [editForm, setEditForm] = useState({
        plan_id: '',
        status: 'trialing',
        billing_model: 'per_employee',
        billing_cycle: 'monthly'
    })
    const [plansList, setPlansList] = useState([])

    const loadData = async () => {
        setLoading(true)
        try {
            // Call our secure superadmin analytics RPC
            const { data, error } = await supabase.rpc('get_superadmin_metrics')
            if (error) throw error
            if (data) {
                setDashboard(data)
            }

            // Load plans list for dropdown modifications
            const { data: plansData, error: plansErr } = await supabase
                .from('subscription_plans')
                .select('*')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
            
            if (!plansErr && plansData) {
                setPlansList(plansData)
            }

        } catch (e) {
            toast.error(`Analytics access denied: ${e.message}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const handleEditTenant = async (tenant) => {
        // Fetch current subscription data for the tenant
        try {
            const { data: subData, error } = await supabase
                .from('company_subscriptions')
                .select('*')
                .eq('company_id', tenant.id)
                .maybeSingle()

            if (!error && subData) {
                setEditingTenant(tenant)
                setEditForm({
                    plan_id: subData.plan_id || plansList[0]?.id || '',
                    status: subData.status || 'trialing',
                    billing_model: subData.billing_model || 'per_employee',
                    billing_cycle: subData.billing_cycle || 'monthly'
                })
            } else {
                // If company has no subscription record yet, initialize a blank form
                setEditingTenant(tenant)
                setEditForm({
                    plan_id: plansList[0]?.id || '',
                    status: 'trialing',
                    billing_model: 'per_employee',
                    billing_cycle: 'monthly'
                })
            }
        } catch (e) {
            toast.error(`Failed to fetch subscription: ${e.message}`)
        }
    }

    const saveTenantOverride = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            // Insert/Upsert subscription record bypasses RLS for superadmins or uses upsert directly
            const { error } = await supabase
                .from('company_subscriptions')
                .upsert({
                    company_id: editingTenant.id,
                    ...editForm,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'company_id' })

            if (error) throw error

            toast.success(`Workspace limits overridden for ${editingTenant.company_name}!`)
            setEditingTenant(null)
            await loadData()
        } catch (e) {
            toast.error(`Failed to save limits: ${e.message}`)
        } finally {
            setSaving(false)
        }
    }

    // Filtered lists computation
    const filteredTenants = useMemo(() => {
        return (dashboard.tenants || []).filter(tenant => {
            const matchesSearch = tenant.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
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
                        <h1 className="text-xl font-black tracking-tight text-white">Central Operations Console</h1>
                        <p className="text-sm text-slate-400">Platform-wide tenant diagnostics, multi-company billing audit, and MRR aggregates.</p>
                    </div>
                </div>
                <button onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm font-bold text-white cursor-pointer transition">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Analytics
                </button>
            </div>

            {/* Aggregated KPI Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Billed</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">{formatCurrency(dashboard.stats.totalBilled)}</p>
                        <p className="text-xs text-slate-500">Collected subscriptions</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Receivables</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">{formatCurrency(dashboard.stats.totalOutstanding)}</p>
                        <p className="text-xs text-slate-500">Awaiting payment links</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Tenants</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">{dashboard.stats.totalCompanies} Brands</p>
                        <p className="text-xs text-slate-500">{dashboard.stats.totalActiveSubscriptions} active, {dashboard.stats.totalTrials} trialing</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">SaaS Headcount</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">{dashboard.stats.totalEmployees} Staff</p>
                        <p className="text-xs text-slate-500">Active employees system-wide</p>
                    </div>
                </div>
            </div>

            {/* Split Screen Dashboard details */}
            <div className="space-y-6">
                
                {/* Section 1: Tenant List */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h2 className="font-black text-slate-900 text-lg flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-slate-500" />
                            Tenant Workspaces
                        </h2>
                        
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Search bar */}
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search by company or code..."
                                    className="rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:outline-none focus:bg-white"
                                />
                            </div>

                            {/* Dropdown status filter */}
                            <div className="relative flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
                                <Filter className="w-3.5 h-3.5 text-slate-500" />
                                <select 
                                    value={statusFilter} 
                                    onChange={e => setStatusFilter(e.target.value)} 
                                    className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
                                >
                                    <option value="all">All Tiers</option>
                                    <option value="active">Active Plan</option>
                                    <option value="trialing">Trialing</option>
                                    <option value="expired">Expired</option>
                                    <option value="past_due">Past Due</option>
                                    <option value="none">No Plan</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Corporate Details</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Active Headcount</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Plan Assignment</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Billing Model</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Billed All Time</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Outstanding</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTenants.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center text-sm text-slate-500">
                                            No tenant workspaces match your criteria.
                                        </td>
                                    </tr>
                                ) : filteredTenants.map((tenant) => (
                                    <tr key={tenant.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4 font-black text-slate-900 text-sm">
                                            {tenant.company_name}
                                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                Code: {tenant.company_code} • Setup: {new Date(tenant.created_at).toLocaleDateString('en-IN', {month:'short', year:'numeric'})}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-black text-slate-800">
                                            {tenant.active_employees} employees
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-slate-600">
                                            {tenant.plan_name}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-700">
                                            {tenant.billing_model === 'per_employee' ? 'Per Employee (PEPM)' : 'Flat Price Model'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-emerald-600">
                                            {formatCurrency(tenant.total_billed_amount)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-rose-600">
                                            {formatCurrency(tenant.outstanding_amount)}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold">
                                            <TenantStatusBadge status={tenant.subscription_status} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleEditTenant(tenant)} 
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer transition"
                                            >
                                                <Settings className="w-3.5 h-3.5" />
                                                Manage Plan
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Section 2: Platform-Wide Invoices */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="font-black text-slate-900 text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5 text-slate-500" />
                            Recent SaaS Platform Invoices
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Invoice Number</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Billed Client</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Billing Period</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Staff count</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Total Billed</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Payment Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Created Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {dashboard.recentInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-sm text-slate-500">
                                            No client invoices generated on the platform yet.
                                        </td>
                                    </tr>
                                ) : dashboard.recentInvoices.map((inv) => (
                                    <tr key={inv.id}>
                                        <td className="px-6 py-4 font-black text-slate-900 text-sm">
                                            {inv.invoice_number}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-800">
                                            {inv.company_name}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                                            {new Date(inv.billing_period_start).toLocaleDateString('en-IN', {day:'numeric', month:'short'})} - {new Date(inv.billing_period_end).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}
                                            <span className="block text-[9px] font-bold text-slate-400 mt-0.5">
                                                {inv.billing_model === 'per_employee' ? 'Per Employee (PEPM)' : 'Flat Monthly Plan'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                                            {inv.employee_count} active
                                        </td>
                                        <td className="px-6 py-4 text-sm font-black text-slate-950">
                                            {formatCurrency(inv.total_amount)}
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            <span className={`inline-flex rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest border ${
                                                inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                inv.status === 'void' ? 'bg-slate-100 text-slate-400 border-slate-200 line-through' :
                                                inv.status === 'issued' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-xs font-medium text-slate-500">
                                            {new Date(inv.created_at).toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Manage Tenant Overrides Modal Overlay */}
            {editingTenant && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <div>
                                <h3 className="font-black text-slate-900 text-lg">Manage Plan Limits</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Workspace: <span className="font-bold text-slate-700">{editingTenant.company_name}</span></p>
                            </div>
                            <button onClick={() => setEditingTenant(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={saveTenantOverride} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Assign Subscription Tier</label>
                                <select 
                                    value={editForm.plan_id} 
                                    onChange={e => setEditForm(p => ({ ...p, plan_id: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900"
                                >
                                    {plansList.map(plan => (
                                        <option key={plan.id} value={plan.id}>
                                            {plan.name} Tier (₹{plan.monthly_price}/mo flat, ₹{plan.price_per_employee}/emp)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Billing Status</label>
                                <select 
                                    value={editForm.status} 
                                    onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900"
                                >
                                    <option value="trialing">trialing (14-Day Free Trial)</option>
                                    <option value="active">active (Paid Subscribed)</option>
                                    <option value="past_due">past_due (Late Suspension Grace)</option>
                                    <option value="paused">paused (Temporary Freeze)</option>
                                    <option value="cancelled">cancelled (Manual Termination)</option>
                                    <option value="expired">expired (Term Expired)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Billing Model</label>
                                    <select 
                                        value={editForm.billing_model} 
                                        onChange={e => setEditForm(p => ({ ...p, billing_model: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900"
                                    >
                                        <option value="per_employee">Per Employee</option>
                                        <option value="flat">Flat Price</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Billing Cycle</label>
                                    <select 
                                        value={editForm.billing_cycle} 
                                        onChange={e => setEditForm(p => ({ ...p, billing_cycle: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900"
                                    >
                                        <option value="monthly">monthly</option>
                                        <option value="annual">annual</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                                <button 
                                    type="button" 
                                    onClick={() => setEditingTenant(null)} 
                                    className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-black text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                                >
                                    <Check className="w-4 h-4" />
                                    {saving ? 'Overriding...' : 'Override Limits'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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

function TenantStatusBadge({ status }) {
    const configs = {
        active: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Active Plan' },
        trialing: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Trialing' },
        past_due: { color: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Past Due' },
        paused: { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Paused' },
        cancelled: { color: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Cancelled' },
        expired: { color: 'bg-slate-100 text-slate-400 border-slate-200', label: 'Expired' },
        none: { color: 'bg-slate-50 text-slate-400 border-slate-200', label: 'No Sub' }
    }

    const { color, label } = configs[status] || configs.none
    return (
        <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${color}`}>
            {label}
        </span>
    )
}
