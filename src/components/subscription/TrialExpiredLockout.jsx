import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Crown,
  Receipt,
  ArrowRight,
  Building2,
  Calendar,
} from 'lucide-react'
import { licenseService } from '../../services/licenseService'
import { useAuth } from '../../context/AuthContext'
import { useCompany } from '../../context/CompanyContext'
import { useToast } from '../../context/ToastContext'

export default function TrialExpiredLockout({ entitlements }) {
  const { signOut, isAdmin } = useAuth()
  const { company, activeCompanyId } = useCompany()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [licenseKey, setLicenseKey] = useState('')
  const [activatedSuccess, setActivatedSuccess] = useState(null)

  const companyName = company?.name || entitlements?.plan?.name || 'Your Company'
  const trialEndDate = entitlements?.trialEndsAt
    ? new Date(entitlements.trialEndsAt).toLocaleDateString(undefined, {
        dateStyle: 'medium',
      })
    : 'Recently'

  const redeemMutation = useMutation({
    mutationFn: async (key) => {
      return await licenseService.redeemLicenseKey({
        licenseKey: key,
        companyId: activeCompanyId,
      })
    },
    onSuccess: (data) => {
      setActivatedSuccess(data)
      toast.success('Enterprise license successfully activated! Access restored.')
      queryClient.invalidateQueries({ queryKey: ['planEntitlements'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptionDashboard'] })
      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 1500)
    },
    onError: (err) => {
      toast.error(err.message || 'Invalid or expired license key.')
    },
  })

  const handleSubmitKey = (e) => {
    e.preventDefault()
    const cleanKey = licenseKey.trim().toUpperCase()
    if (!cleanKey) {
      toast.warning('Please enter your license key.')
      return
    }
    redeemMutation.mutate(cleanKey)
  }

  const handleSignOut = async () => {
    navigate('/login', { replace: true })
    await signOut()
  }

  return (
    <div className="min-h-[82vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-rose-100 shadow-2xl overflow-hidden animate-in fade-in duration-300">
        {/* Top Warning Ribbon */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">
                Workspace Suspended
              </span>
              <h2 className="text-base font-bold text-white">Trial Period Expired</h2>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-8">
          {activatedSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Workspace Reactivated!</h3>
              <p className="text-sm font-medium text-slate-600 max-w-md mx-auto">
                Your license for{' '}
                <span className="font-bold text-slate-900">{activatedSuccess.plan_name}</span> has
                been applied. Restoring full access to your payroll and HR workspace...
              </p>
              <div className="pt-2">
                <button
                  onClick={() => navigate('/dashboard', { replace: true })}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-black transition cursor-pointer"
                >
                  Enter Dashboard Now
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Context Summary Box */}
              <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 pb-3 mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span>
                      Company: <strong className="text-slate-900">{companyName}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                    <Calendar className="w-3.5 h-3.5 text-rose-500" />
                    <span>Trial Ended: {trialEndDate}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  The free trial evaluation for this organization has ended. To protect data
                  integrity and comply with subscription terms, access to employee records,
                  attendance sync, and payroll processing is suspended until a license key is
                  activated.
                </p>
              </div>

              {isAdmin ? (
                /* Admin Activation Form */
                <form onSubmit={handleSubmitKey} className="space-y-4 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor="lockout-license-key"
                        className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5"
                      >
                        <KeyRound className="w-4 h-4 text-blue-600" />
                        Enter Enterprise License Key
                      </label>
                      <span
                        className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                        onClick={() => navigate('/subscription-management')}
                      >
                        Don't have a key?
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        id="lockout-license-key"
                        type="text"
                        required
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                        placeholder="e.g. YUKTI-GROW-7X9K-B4M2-99L1"
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-sm font-mono font-black text-slate-900 tracking-wider placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Enter the 24-character offline license voucher provided by your sales
                      representative or invoice.
                    </p>
                  </div>

                  {redeemMutation.isError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 flex items-start gap-2.5 text-xs text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        {redeemMutation.error?.message ||
                          'Invalid or already redeemed license key.'}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={redeemMutation.isPending || !licenseKey.trim()}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
                    >
                      {redeemMutation.isPending ? 'Activating License...' : 'Activate License Key'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <Link
                      to="/subscription-management"
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Crown className="w-4 h-4 text-amber-500" />
                      <span>View Plans</span>
                    </Link>
                    <Link
                      to="/billing"
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Receipt className="w-4 h-4 text-slate-500" />
                      <span>Invoices</span>
                    </Link>
                  </div>
                </form>
              ) : (
                /* Non-Admin Employee View */
                <div className="py-4 text-center space-y-4">
                  <p className="text-sm text-slate-600 font-medium">
                    Please contact your organization administrator or HR team to activate the
                    enterprise license. Once activated, your portal and payroll records will be
                    immediately accessible.
                  </p>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-black transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
