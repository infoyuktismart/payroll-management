import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, KeyRound, Mail, ShieldCheck, ShieldOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function TwoFactorSetup() {
    const navigate = useNavigate()
    const toast = useToast()
    const { user, getTwoFactorSettings, logSecurityEvent } = useAuth()
    const [settings, setSettings] = useState(null)
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [disabling, setDisabling] = useState(false)
    const [otp, setOtp] = useState('')
    const [enrollmentStarted, setEnrollmentStarted] = useState(false)

    const loadSettings = async () => {
        if (!user?.id) return
        setLoading(true)
        try {
            const data = await getTwoFactorSettings(user.id)
            setSettings(data)
        } catch (error) {
            toast.error(error.message || 'Unable to load two-factor settings.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSettings()
    }, [user?.id])

    const startEnrollment = async () => {
        if (!user?.email) return
        setSending(true)
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email: user.email,
                options: { shouldCreateUser: false }
            })
            if (error) throw error
            setEnrollmentStarted(true)
            toast.success('Verification code sent to your email.')
        } catch (error) {
            toast.error(error.message || 'Unable to send verification code.')
        } finally {
            setSending(false)
        }
    }

    const verifyEnrollment = async (e) => {
        e.preventDefault()
        if (!user?.id || !user?.email) return
        setVerifying(true)
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: user.email,
                token: otp.trim(),
                type: 'email'
            })
            if (error) throw error

            const payload = {
                user_id: user.id,
                email: user.email,
                method: 'email_otp',
                enabled: true,
                enrolled_at: new Date().toISOString(),
                last_verified_at: new Date().toISOString()
            }

            const { data, error: upsertError } = await supabase
                .from('user_2fa_settings')
                .upsert(payload, { onConflict: 'user_id,method' })
                .select('*')
                .single()
            if (upsertError) throw upsertError

            setSettings(data)
            setEnrollmentStarted(false)
            setOtp('')
            await logSecurityEvent('2fa_enabled', { email: user.email, userId: user.id })
            toast.success('Email OTP two-factor authentication enabled.')
        } catch (error) {
            toast.error(error.message || 'Invalid verification code.')
        } finally {
            setVerifying(false)
        }
    }

    const disableTwoFactor = async () => {
        if (!user?.id) return
        setDisabling(true)
        try {
            const { data, error } = await supabase
                .from('user_2fa_settings')
                .upsert({
                    user_id: user.id,
                    email: user.email,
                    method: 'email_otp',
                    enabled: false,
                    enrolled_at: settings?.enrolled_at || null
                }, { onConflict: 'user_id,method' })
                .select('*')
                .single()
            if (error) throw error
            setSettings(data)
            await logSecurityEvent('2fa_disabled', { email: user.email, userId: user.id })
            toast.success('Two-factor authentication disabled.')
        } catch (error) {
            toast.error(error.message || 'Unable to disable two-factor authentication.')
        } finally {
            setDisabling(false)
        }
    }

    const enabled = settings?.enabled

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Two-Factor Authentication</h1>
                        <p className="text-sm text-gray-500 mt-1">Protect payroll access with an email OTP after password sign-in.</p>
                    </div>
                    <button
                        onClick={() => navigate('/security-settings')}
                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                        Security Settings
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                        <h2 className="font-bold text-slate-800">Email OTP Enrollment</h2>
                    </div>
                    <div className="p-6 space-y-5">
                        {loading ? (
                            <div className="h-28 rounded-xl bg-slate-50 animate-pulse" />
                        ) : (
                            <>
                                <div className={`rounded-xl border p-5 ${enabled ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                                    <div className="flex items-start gap-3">
                                        {enabled ? <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" /> : <KeyRound className="w-5 h-5 text-amber-600 mt-0.5" />}
                                        <div>
                                            <p className={`text-sm font-black ${enabled ? 'text-emerald-800' : 'text-amber-800'}`}>
                                                {enabled ? '2FA is enabled' : '2FA is not enabled'}
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">
                                                Codes are sent to <span className="font-bold text-slate-800">{user?.email}</span>.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {!enabled && !enrollmentStarted && (
                                    <button
                                        onClick={startEnrollment}
                                        disabled={sending}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        <Mail className="w-4 h-4" />
                                        {sending ? 'Sending Code...' : 'Send Enrollment Code'}
                                    </button>
                                )}

                                {!enabled && enrollmentStarted && (
                                    <form onSubmit={verifyEnrollment} className="max-w-sm space-y-4">
                                        <label className="block">
                                            <span className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Verification Code</span>
                                            <input
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                maxLength={8}
                                                required
                                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-lg font-black tracking-[0.35em]"
                                                placeholder="000000"
                                            />
                                        </label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={startEnrollment}
                                                disabled={sending || verifying}
                                                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                Resend
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={verifying}
                                                className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {verifying ? 'Verifying...' : 'Enable 2FA'}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {enabled && (
                                    <button
                                        onClick={disableTwoFactor}
                                        disabled={disabling}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50"
                                    >
                                        <ShieldOff className="w-4 h-4" />
                                        {disabling ? 'Disabling...' : 'Disable 2FA'}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </section>

                <aside className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-fit">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Last Verified</p>
                    <p className="text-sm font-bold text-slate-800 mt-2">
                        {settings?.last_verified_at ? new Date(settings.last_verified_at).toLocaleString() : 'Not verified yet'}
                    </p>
                    <div className="mt-5 pt-5 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Enrollment Date</p>
                        <p className="text-sm font-bold text-slate-800 mt-2">
                            {settings?.enrolled_at ? new Date(settings.enrolled_at).toLocaleDateString() : 'Not enrolled'}
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    )
}
