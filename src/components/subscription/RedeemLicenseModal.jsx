import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, X, CheckCircle2, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react'
import { licenseService } from '../../services/licenseService'
import { useToast } from '../../context/ToastContext'
import { useFocusTrap } from '../../hooks/useFocusTrap'

export default function RedeemLicenseModal({ isOpen, onClose, activeCompanyId }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [licenseKey, setLicenseKey] = useState('')
  const [redemptionSuccess, setRedemptionSuccess] = useState(null)
  const modalRef = useFocusTrap(isOpen)

  const handleClose = () => {
    setLicenseKey('')
    setRedemptionSuccess(null)
    onClose()
  }

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const redeemMutation = useMutation({
    mutationFn: async (key) => {
      return await licenseService.redeemLicenseKey({
        licenseKey: key,
        companyId: activeCompanyId,
      })
    },
    onSuccess: (data) => {
      setRedemptionSuccess(data)
      toast.success('License successfully activated!')
      queryClient.invalidateQueries({ queryKey: ['subscriptionDashboard'] })
      queryClient.invalidateQueries({ queryKey: ['planEntitlements'] })
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to activate license key')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const clean = licenseKey.trim().toUpperCase()
    if (!clean) {
      toast.warning('Please enter your license key.')
      return
    }
    redeemMutation.mutate(clean)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="redeem-license-title"
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 id="redeem-license-title" className="text-lg font-black tracking-tight">
                Redeem Enterprise License
              </h2>
              <p className="text-xs text-slate-400">Activate or extend your company subscription</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {redemptionSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">License Activated!</h3>
                <p className="text-sm font-medium text-slate-600 mt-1">
                  Your organization is now upgraded to{' '}
                  <span className="font-black text-blue-600">{redemptionSuccess.plan_name}</span>.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Plan Tier</span>
                  <span className="text-slate-900 font-black">{redemptionSuccess.plan_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Validity Extension</span>
                  <span className="text-emerald-700 font-black">
                    +{redemptionSuccess.duration_days} Days
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">New Expiry Date</span>
                  <span className="text-slate-900 font-black">
                    {redemptionSuccess.period_end
                      ? new Date(redemptionSuccess.period_end).toLocaleDateString(undefined, {
                          dateStyle: 'long',
                        })
                      : 'Active'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Redeemed Key</span>
                  <span className="font-mono font-bold text-slate-700">
                    {redemptionSuccess.license_key}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-black transition cursor-pointer"
              >
                Continue to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                If you purchased an offline enterprise plan, volume contract, or received an
                activation voucher, enter your 24-character key below.
              </p>

              <div>
                <label
                  htmlFor="license-key-input"
                  className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2"
                >
                  Enterprise License Key
                </label>
                <div className="relative">
                  <input
                    id="license-key-input"
                    type="text"
                    required
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    placeholder="e.g. YUKTI-GROW-7X9K-B4M2-99L1"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono font-black text-slate-900 tracking-wider placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                  <KeyRound className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  Works both before trial expires (extensions) and after trial expires
                  (reactivations).
                </p>
              </div>

              {redeemMutation.isError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{redeemMutation.error?.message || 'Invalid or expired license key.'}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={redeemMutation.isPending || !licenseKey.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {redeemMutation.isPending ? 'Verifying...' : 'Activate License'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
