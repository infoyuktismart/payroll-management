import { Building2, Search, Filter, Settings, ExternalLink } from 'lucide-react'

function TenantStatusBadge({ status }) {
  const configs = {
    active: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Active Plan' },
    trialing: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Trialing' },
    past_due: { color: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Past Due' },
    paused: { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Paused' },
    cancelled: { color: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Cancelled' },
    expired: { color: 'bg-slate-100 text-slate-400 border-slate-200', label: 'Expired' },
    none: { color: 'bg-slate-50 text-slate-400 border-slate-200', label: 'No Sub' },
  }

  const { color, label } = configs[status] || configs.none
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${color}`}
    >
      {label}
    </span>
  )
}

export default function TenantWorkspacesTable({
  tenants,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onManagePlan,
  onInspectWorkspace,
  formatCurrency,
}) {
  return (
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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by company or code..."
              className="rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:outline-none focus:bg-white"
            />
          </div>

          {/* Dropdown status filter */}
          <div className="relative flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                Corporate Details
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                Active Headcount
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                Plan Assignment
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                Billing Model
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                Billed All Time
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                Outstanding
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center text-sm text-slate-500">
                  No tenant workspaces match your criteria.
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-black text-slate-900 text-sm">
                    {tenant.company_name}
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Code: {tenant.company_code} • Setup:{' '}
                      {new Date(tenant.created_at).toLocaleDateString('en-IN', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-slate-800">
                    {tenant.active_employees} employees
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-600">
                    {tenant.plan_name}
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-700">
                    {tenant.billing_model === 'per_employee'
                      ? 'Per Employee (PEPM)'
                      : 'Flat Price Model'}
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
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onInspectWorkspace && onInspectWorkspace(tenant)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition shadow-xs"
                        title={`Launch and inspect ${tenant.company_name} workspace`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Inspect HRMS
                      </button>
                      <button
                        type="button"
                        onClick={() => onManagePlan(tenant)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer transition"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Manage Plan
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
