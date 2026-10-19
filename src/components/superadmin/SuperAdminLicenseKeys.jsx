import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Copy, Check, Sparkles } from 'lucide-react'
import { licenseService } from '../../services/licenseService'
import { useToast } from '../../context/ToastContext'

export default function SuperAdminLicenseKeys({ plansList = [], tenantsList = [] }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [copiedKey, setCopiedKey] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  // Create form state
  const [form, setForm] = useState({
    plan_id: plansList[0]?.id || '',
    duration_days: 365,
    billing_cycle: 'annual',
    max_employees: '',
    assigned_to_company_id: '',
    notes: '',
  })

  const { data: licensesData = { data: [], count: 0 }, isLoading } = useQuery({
    queryKey: ['adminLicenseKeys', statusFilter],
    queryFn: () =>
      licenseService.adminListLicenseKeys({ page: 0, pageSize: 50, status: statusFilter }),
    staleTime: 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      return await licenseService.adminCreateLicenseKey({
        planId: payload.plan_id || plansList[0]?.id,
        durationDays: Number(payload.duration_days) || 365,
        billingCycle: payload.billing_cycle,
        maxEmployees: payload.max_employees ? Number(payload.max_employees) : null,
        assignedToCompanyId: payload.assigned_to_company_id || null,
        notes: payload.notes || null,
      })
    },
    onSuccess: (res) => {
      toast.success(`License key issued: ${res.license_key}`)
      queryClient.invalidateQueries({ queryKey: ['adminLicenseKeys'] })
      setIsCreateOpen(false)
      setForm({
        plan_id: plansList[0]?.id || '',
        duration_days: 365,
        billing_cycle: 'annual',
        max_employees: '',
        assigned_to_company_id: '',
        notes: '',
      })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to issue license key')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id) => licenseService.adminRevokeLicenseKey(id),
    onSuccess: () => {
      toast.success('License key revoked.')
      queryClient.invalidateQueries({ queryKey: ['adminLicenseKeys'] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to revoke license key')
    },
  })

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    toast.success('License key copied to clipboard!')
    setTimeout(() => setCopiedKey(''), 2500)
  }

  const licenses = licensesData.data || []

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Enterprise License Key Management</h2>
            <p className="text-xs text-slate-500">
              Issue and audit offline enterprise activation vouchers and contract keys.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active (Unredeemed)</option>
            <option value="redeemed">Redeemed</option>
            <option value="revoked">Revoked</option>
          </select>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Issue License Key
          </button>
        </div>
      </div>

      {/* Issued Keys Table */}
      {isLoading ? (
        <div className="py-8 text-center text-xs font-bold text-slate-400">
          Loading license keys...
        </div>
      ) : licenses.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-600">No license keys found.</p>
          <p className="text-xs text-slate-400">
            Issue an offline license key for clients paying via bank wire or annual contract.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                <th className="pb-3 px-3">License Key</th>
                <th className="pb-3 px-3">Plan</th>
                <th className="pb-3 px-3">Duration</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Redeemed By</th>
                <th className="pb-3 px-3">Created</th>
                <th className="pb-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {licenses.map((lic) => {
                const isCopied = copiedKey === lic.license_key
                return (
                  <tr key={lic.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-3 font-mono font-black text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{lic.license_key}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(lic.license_key)}
                          className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title="Copy key"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      {lic.plan?.name || 'Standard Plan'}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-600">
                      {lic.duration_days} Days ({lic.billing_cycle})
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          lic.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : lic.status === 'redeemed'
                              ? 'bg-blue-100 text-blue-800'
                              : lic.status === 'revoked'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {lic.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700">
                      {lic.company?.name ? (
                        <span className="font-bold text-slate-900">{lic.company.name}</span>
                      ) : lic.redeemed_at ? (
                        <span className="text-slate-400 font-mono text-[11px]">Redeemed</span>
                      ) : (
                        <span className="text-slate-400 italic">Unclaimed</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-medium">
                      {new Date(lic.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {lic.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Revoke license key ${lic.license_key}?`)) {
                              revokeMutation.mutate(lic.id)
                            }
                          }}
                          className="text-rose-600 hover:text-rose-800 font-bold transition cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Issue Key */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-black">Issue Enterprise License Key</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createMutation.mutate(form)
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                  Target Plan Tier
                </label>
                <select
                  value={form.plan_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, plan_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-800"
                >
                  {plansList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.plan_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                    Duration (Days)
                  </label>
                  <select
                    value={form.duration_days}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, duration_days: Number(e.target.value) }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-800"
                  >
                    <option value={30}>30 Days (1 Month)</option>
                    <option value={90}>90 Days (Quarter)</option>
                    <option value={180}>180 Days (Half Year)</option>
                    <option value={365}>365 Days (1 Year)</option>
                    <option value={730}>730 Days (2 Years)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                    Billing Cycle
                  </label>
                  <select
                    value={form.billing_cycle}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, billing_cycle: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-800"
                  >
                    <option value="annual">Annual</option>
                    <option value="monthly">Monthly</option>
                    <option value="multi_year">Multi-Year</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                  Pre-Assign to Company (Optional)
                </label>
                <select
                  value={form.assigned_to_company_id}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, assigned_to_company_id: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-bold text-slate-800"
                >
                  <option value="">Any Company (Unrestricted Voucher)</option>
                  {tenantsList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                  Internal Contract Notes / PO #
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Wire transfer settlement received for Acme Corp annual enterprise contract"
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-white font-black hover:bg-blue-700 cursor-pointer shadow-md shadow-blue-200"
                >
                  {createMutation.isPending ? 'Generating...' : 'Issue License Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
