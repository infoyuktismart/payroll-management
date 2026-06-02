import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, KeyRound, Lock, Monitor, RefreshCw, Shield, ShieldCheck, UserCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

const EVENT_LABELS = {
    password_login: 'Password login',
    '2fa_challenge_sent': '2FA code sent',
    '2fa_verified': '2FA verified',
    '2fa_failed': '2FA failed',
    '2fa_enabled': '2FA enabled',
    '2fa_disabled': '2FA disabled',
    logout: 'Logout',
    global_logout: 'Global logout'
}

const defaultPolicyState = {
    two_factor_required_for_admins: { enabled: true },
    session_timeout_minutes: { minutes: 480 },
    failed_login_lockout: { max_attempts: 5, window_minutes: 15, lock_minutes: 30 }
}

export default function SecuritySettings() {
    const toast = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [sessionLogs, setSessionLogs] = useState([])
    const [twoFactorRows, setTwoFactorRows] = useState([])
    const [userDirectory, setUserDirectory] = useState({})
    const [policies, setPolicies] = useState(defaultPolicyState)

    const loadSecurityData = async () => {
        setLoading(true)
        try {
            const [logsRes, twoFactorRes, policiesRes, employeesRes, authRes] = await Promise.all([
                supabase
                    .from('security_session_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50),
                supabase
                    .from('user_2fa_settings')
                    .select('*')
                    .order('updated_at', { ascending: false }),
                supabase
                    .from('security_policies')
                    .select('*'),
                supabase
                    .from('employees')
                    .select('user_id, first_name, last_name, email, employee_id'),
                supabase.auth.getUser()
            ])

            if (logsRes.error && logsRes.error.code !== '42P01') throw logsRes.error
            if (twoFactorRes.error && twoFactorRes.error.code !== '42P01') throw twoFactorRes.error
            if (policiesRes.error && policiesRes.error.code !== '42P01') throw policiesRes.error
            if (employeesRes.error && employeesRes.error.code !== '42P01') throw employeesRes.error

            setSessionLogs(logsRes.data || [])
            setTwoFactorRows(twoFactorRes.data || [])
            setUserDirectory((employeesRes.data || []).reduce((acc, employee) => {
                if (!employee.user_id) return acc
                const fullName = [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim()
                return {
                    ...acc,
                    [employee.user_id]: {
                        label: fullName || employee.email || employee.employee_id || employee.user_id,
                        subLabel: employee.email || employee.employee_id || ''
                    }
                }
            }, authRes.data?.user?.id ? {
                [authRes.data.user.id]: {
                    label: authRes.data.user.email,
                    subLabel: 'Current account'
                }
            } : {}))
            setPolicies((policiesRes.data || []).reduce((acc, policy) => ({
                ...acc,
                [policy.policy_key]: policy.policy_value || {}
            }), defaultPolicyState))
        } catch (error) {
            toast.error(error.message || 'Unable to load security settings.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSecurityData()
    }, [])

    const stats = useMemo(() => {
        const enabled2fa = twoFactorRows.filter(row => row.enabled).length
        const failed2fa = sessionLogs.filter(log => log.event_type === '2fa_failed').length
        const recentLogins = sessionLogs.filter(log => log.event_type === 'password_login').length
        return { enabled2fa, failed2fa, recentLogins }
    }, [twoFactorRows, sessionLogs])

    const twoFactorUserDirectory = useMemo(() => (
        twoFactorRows.reduce((acc, row) => ({
            ...acc,
            [row.user_id]: {
                label: row.email,
                subLabel: row.enabled ? '2FA enabled' : '2FA disabled'
            }
        }), {})
    ), [twoFactorRows])

    const getLogUser = (log) => {
        const metadataEmail = log.metadata?.email
        if (metadataEmail) return { label: metadataEmail, subLabel: '' }

        const matchedUser = userDirectory[log.user_id] || twoFactorUserDirectory[log.user_id]
        if (matchedUser) return matchedUser

        return {
            label: 'Unknown user',
            subLabel: log.user_id || ''
        }
    }

    const updatePolicy = (key, patch) => {
        setPolicies(prev => ({
            ...prev,
            [key]: { ...(prev[key] || {}), ...patch }
        }))
    }

    const savePolicies = async () => {
        setSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const rows = Object.entries(policies).map(([policy_key, policy_value]) => ({
                policy_key,
                policy_value,
                updated_by: user?.id || null,
                is_enforced: true
            }))
            const { error } = await supabase
                .from('security_policies')
                .upsert(rows, { onConflict: 'policy_key' })
            if (error) throw error
            toast.success('Security policies saved.')
            await loadSecurityData()
        } catch (error) {
            toast.error(error.message || 'Unable to save security policies.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Security Settings</h1>
                        <p className="text-sm text-gray-500 mt-1">Review 2FA enrollment, session activity, and enterprise lockout policy metadata.</p>
                    </div>
                    <div className="flex gap-2">
                        <Link to="/security/2fa" className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            Manage 2FA
                        </Link>
                        <button
                            onClick={loadSecurityData}
                            className="p-2.5 rounded-xl border border-gray-200 text-slate-600 hover:bg-slate-50"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: '2FA Enabled Users', value: stats.enabled2fa, icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                    { label: 'Recent Password Logins', value: stats.recentLogins, icon: UserCheck, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                    { label: 'Recent 2FA Failures', value: stats.failed2fa, icon: Lock, color: 'text-rose-600 bg-rose-50 border-rose-100' }
                ].map((item) => (
                    <div key={item.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">{item.label}</p>
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.color}`}>
                                <item.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-slate-900 mt-3">{item.value}</p>
                    </div>
                ))}
            </div>

            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                        <h2 className="font-bold text-slate-800">Lockout & Session Policies</h2>
                    </div>
                    <button
                        onClick={savePolicies}
                        disabled={saving}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Policies'}
                    </button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <label className="rounded-xl border border-gray-200 p-4">
                        <span className="text-xs font-bold text-gray-600 uppercase">Admin 2FA Requirement</span>
                        <select
                            value={policies.two_factor_required_for_admins?.enabled ? 'true' : 'false'}
                            onChange={(e) => updatePolicy('two_factor_required_for_admins', { enabled: e.target.value === 'true' })}
                            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold"
                        >
                            <option value="true">Required when enrolled</option>
                            <option value="false">Optional</option>
                        </select>
                    </label>
                    <label className="rounded-xl border border-gray-200 p-4">
                        <span className="text-xs font-bold text-gray-600 uppercase">Session Timeout</span>
                        <input
                            type="number"
                            min="15"
                            value={policies.session_timeout_minutes?.minutes || 480}
                            onChange={(e) => updatePolicy('session_timeout_minutes', { minutes: Number(e.target.value) })}
                            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold"
                        />
                    </label>
                    <label className="rounded-xl border border-gray-200 p-4">
                        <span className="text-xs font-bold text-gray-600 uppercase">Max Failed Attempts</span>
                        <input
                            type="number"
                            min="1"
                            value={policies.failed_login_lockout?.max_attempts || 5}
                            onChange={(e) => updatePolicy('failed_login_lockout', { max_attempts: Number(e.target.value) })}
                            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold"
                        />
                    </label>
                    <label className="rounded-xl border border-gray-200 p-4">
                        <span className="text-xs font-bold text-gray-600 uppercase">Lock Duration</span>
                        <input
                            type="number"
                            min="1"
                            value={policies.failed_login_lockout?.lock_minutes || 30}
                            onChange={(e) => updatePolicy('failed_login_lockout', { lock_minutes: Number(e.target.value) })}
                            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold"
                        />
                    </label>
                </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-slate-600" />
                    <h2 className="font-bold text-slate-800">Recent Session Events</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">When</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Event</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Device</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">User</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-500">Loading security events...</td></tr>
                            ) : sessionLogs.length === 0 ? (
                                <tr><td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-500">No security events recorded yet.</td></tr>
                            ) : sessionLogs.map(log => {
                                const logUser = getLogUser(log)
                                return (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-sm text-gray-600 inline-flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold text-slate-800">{EVENT_LABELS[log.event_type] || log.event_type}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500">{log.browser || 'Unknown'} / {log.os || 'Unknown'}</td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-bold text-slate-800">{logUser.label}</p>
                                            {logUser.subLabel && (
                                                <p className="text-[11px] text-gray-500 mt-0.5">{logUser.subLabel}</p>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-blue-600" />
                    <h2 className="font-bold text-slate-800">2FA Enrollment Registry</h2>
                </div>
                <div className="divide-y divide-gray-100">
                    {twoFactorRows.length === 0 ? (
                        <div className="px-6 py-8 text-sm text-gray-500">No users have enrolled in 2FA yet.</div>
                    ) : twoFactorRows.map(row => (
                        <div key={row.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <p className="text-sm font-bold text-slate-800">{row.email}</p>
                                <p className="text-xs text-gray-500">Last verified: {row.last_verified_at ? new Date(row.last_verified_at).toLocaleString() : 'Never'}</p>
                            </div>
                            <span className={`w-fit px-3 py-1 rounded-full text-xs font-bold ${row.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {row.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
