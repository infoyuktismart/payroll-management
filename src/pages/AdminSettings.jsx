import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus, Trash2, Users, ClipboardList, History, Shield, Monitor, Smartphone, Globe, LogOut, RefreshCw, Activity, Crown, FileSearch } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import {
    useAdminSettings,
    useAddDepartment,
    useAddHoliday,
    useAddLeavePolicy,
    useRemoveAdminRow,
    useInitializeLeaveBalances
} from '../hooks/useAdminData'
import { logger } from '../lib/devLogger'
import { getPublicIpAddress } from '../lib/networkInfo'
import SecuritySettings from './SecuritySettings'
import { usePlanEntitlements } from '../hooks/usePlanEntitlements'

const Panel = ({ title, icon: Icon, children, accentColor = 'text-slate-500' }) => (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Icon className={`w-5 h-5 ${accentColor}`} />
            <h3 className="font-bold text-slate-800">{title}</h3>
        </div>
        <div className="p-6">{children}</div>
    </section>
)

const getBrowserInfo = () => {
    const ua = navigator.userAgent
    let browser = 'Unknown Browser'
    let os = 'Unknown OS'
    let deviceType = 'desktop'

    if (/Edg/i.test(ua)) browser = 'Microsoft Edge'
    else if (/OPR|Opera/i.test(ua)) browser = 'Opera'
    else if (/Firefox/i.test(ua)) browser = 'Firefox'
    else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Browser'
    else if (/Chrome/i.test(ua)) browser = 'Google Chrome'
    else if (/Safari/i.test(ua)) browser = 'Safari'

    if (/Windows NT/i.test(ua)) os = 'Windows'
    else if (/Mac OS X/i.test(ua)) os = 'macOS'
    else if (/Android/i.test(ua)) { os = 'Android'; deviceType = 'mobile' }
    else if (/iPhone|iPad/i.test(ua)) { os = 'iOS'; deviceType = 'mobile' }
    else if (/Linux/i.test(ua)) os = 'Linux'

    return { browser, os, deviceType }
}

export default function AdminSettings() {
    const toast = useToast()
    const [currentUser, setCurrentUser] = useState(null)
    const [currentSession, setCurrentSession] = useState(null)
    const [userIp, setUserIp] = useState('Detecting...')
    const [signingOut, setSigningOut] = useState(false)
    const [activeSettingsTab, setActiveSettingsTab] = useState('operations')
    const { canUseFeature, loading: entitlementLoading } = usePlanEntitlements()
    const [forms, setForms] = useState({
        department: '',
        holidayName: '',
        holidayDate: '',
        leaveType: '',
        annualBalance: ''
    })

    // React Query hooks
    const { data: adminData = {} } = useAdminSettings()
    const { departments = [], holidays = [], leavePolicies = [], auditLogs = [], notificationLogs = [] } = adminData

    const addDepartmentMutation = useAddDepartment()
    const addHolidayMutation = useAddHoliday()
    const addLeavePolicyMutation = useAddLeavePolicy()
    const removeRowMutation = useRemoveAdminRow()
    const initializeLeaveBalancesMutation = useInitializeLeaveBalances()

    const fetchSessionInfo = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const { data: { session } } = await supabase.auth.getSession()
            setCurrentUser(user)
            setCurrentSession(session)
        } catch (err) {
            logger.error('Failed to fetch session info:', err)
        }
    }

    const detectIp = async () => {
        setUserIp(await getPublicIpAddress())
    }

    useEffect(() => {
        fetchSessionInfo()
        detectIp()
    }, [])

    const addDepartment = () => {
        const name = forms.department.trim()
        if (!name) return
        addDepartmentMutation.mutate(name, {
            onSuccess: () => {
                setForms(prev => ({ ...prev, department: '' }))
                toast.success('Department added.')
            },
            onError: (err) => toast.error(err.message || 'Failed to add department.')
        })
    }

    const addHoliday = () => {
        if (!forms.holidayName.trim() || !forms.holidayDate) return
        addHolidayMutation.mutate({ name: forms.holidayName.trim(), date: forms.holidayDate }, {
            onSuccess: () => {
                setForms(prev => ({ ...prev, holidayName: '', holidayDate: '' }))
                toast.success('Holiday added.')
            },
            onError: (err) => toast.error(err.message || 'Failed to add holiday.')
        })
    }

    const addLeavePolicy = () => {
        if (!forms.leaveType.trim() || !forms.annualBalance) return
        addLeavePolicyMutation.mutate({ leaveType: forms.leaveType.trim(), annualBalance: forms.annualBalance }, {
            onSuccess: () => {
                setForms(prev => ({ ...prev, leaveType: '', annualBalance: '' }))
                toast.success('Leave policy added.')
            },
            onError: (err) => toast.error(err.message || 'Failed to add leave policy.')
        })
    }

    const removeRow = (table, id) => {
        removeRowMutation.mutate({ table, id }, {
            onSuccess: () => toast.success('Deleted successfully.'),
            onError: (err) => toast.error(err.message || 'Failed to delete.')
        })
    }

    const initializeLeaveBalances = () => {
        initializeLeaveBalancesMutation.mutate(new Date().getFullYear(), {
            onSuccess: () => toast.success('Leave balances initialized for active employees.'),
            onError: (err) => toast.error(err.message || 'Failed to initialize leave balances.')
        })
    }

    const handleSignOutAllDevices = async () => {
        setSigningOut(true)
        try {
            const { error } = await supabase.auth.signOut({ scope: 'global' })
            if (error) throw error
            toast.success('Signed out of all devices successfully.')
            setTimeout(() => window.location.href = '/login', 1500)
        } catch (err) {
            toast.error('Failed to sign out: ' + err.message)
        } finally {
            setSigningOut(false)
        }
    }

    return (
        <div className="space-y-6">

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Manage operational setup used by payroll, attendance, and employee records.</p>
            </div>

            <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                {[
                    { key: 'operations', label: 'Operations' },
                    { key: 'security', label: 'Security', feature: 'security_controls' },
                    { key: 'enterprise', label: 'Enterprise Admin' }
                ].filter(tab => !tab.feature || entitlementLoading || canUseFeature(tab.feature)).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveSettingsTab(tab.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeSettingsTab === tab.key ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeSettingsTab === 'security' ? (
                <SecuritySettings />
            ) : activeSettingsTab === 'enterprise' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {canUseFeature('audit_logs') && (
                        <EnterpriseCard
                            to="/audit-logs"
                            icon={FileSearch}
                            title="Audit Log Viewer"
                            description="Filter and inspect write events, actor IDs, and before/after payloads."
                        />
                    )}
                    <EnterpriseCard
                        to="/subscription-management"
                        icon={Crown}
                        title="Subscription Management"
                        description="Manage plan assignment, billing status, feature limits, and usage counters."
                    />
                    {canUseFeature('system_health') && (
                        <EnterpriseCard
                            to="/system-health"
                            icon={Activity}
                            title="System Health"
                            description="Check DB connectivity, mail logs, report jobs, sessions, and health markers."
                        />
                    )}
                </div>
            ) : (
                <>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Panel title="Departments" icon={Users}>
                    <div className="flex gap-2 mb-4">
                        <input
                            value={forms.department}
                            onChange={(e) => setForms(prev => ({ ...prev, department: e.target.value }))}
                            placeholder="Department name"
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <button onClick={addDepartment} className="p-2 rounded-lg bg-slate-900 text-white"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-2">
                        {departments.map(dept => (
                            <div key={dept.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-sm font-semibold">
                                <span>{dept.name}</span>
                                <button onClick={() => removeRow('departments', dept.id)} className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title="Holidays" icon={CalendarDays}>
                    <div className="space-y-2 mb-4">
                        <input
                            value={forms.holidayName}
                            onChange={(e) => setForms(prev => ({ ...prev, holidayName: e.target.value }))}
                            placeholder="Holiday name"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={forms.holidayDate}
                                onChange={(e) => setForms(prev => ({ ...prev, holidayDate: e.target.value }))}
                                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />
                            <button onClick={addHoliday} className="p-2 rounded-lg bg-slate-900 text-white"><Plus className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                        {holidays.map(holiday => (
                            <div key={holiday.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-sm">
                                <span><b>{holiday.name}</b><br /><span className="text-xs text-gray-500">{holiday.date}</span></span>
                                <button onClick={() => removeRow('holidays', holiday.id)} className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title="Leave Policies" icon={ClipboardList}>
                    <button
                        onClick={initializeLeaveBalances}
                        className="mb-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition"
                    >
                        Initialize Current Year Balances
                    </button>
                    <div className="space-y-2 mb-4">
                        <input
                            value={forms.leaveType}
                            onChange={(e) => setForms(prev => ({ ...prev, leaveType: e.target.value }))}
                            placeholder="Leave type"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={forms.annualBalance}
                                onChange={(e) => setForms(prev => ({ ...prev, annualBalance: e.target.value }))}
                                placeholder="Annual balance"
                                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />
                            <button onClick={addLeavePolicy} className="p-2 rounded-lg bg-slate-900 text-white"><Plus className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {leavePolicies.map(policy => (
                            <div key={policy.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-sm">
                                <span><b>{policy.leave_type}</b><br /><span className="text-xs text-gray-500">{policy.annual_balance} days/year</span></span>
                                <button onClick={() => removeRow('leave_policies', policy.id)} className="text-rose-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>

            <Panel title="Recent Audit Logs" icon={History}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">When</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Action</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Table</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Record</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Actor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {auditLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-sm text-gray-500">No audit activity yet.</td>
                                </tr>
                            ) : auditLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(log.created_at).toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-black">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold text-slate-800">{log.table_name}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{log.record_id || '-'}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{log.actor_id || 'system'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>

            {/* ── Active Sessions & Security Panel ── */}
            <Panel title="Active Sessions &amp; Security" icon={Shield} accentColor="text-blue-500">
                {(() => {
                    const { browser, os, deviceType } = getBrowserInfo()
                    const DeviceIcon = deviceType === 'mobile' ? Smartphone : Monitor
                    const sessionCreated = currentSession?.created_at
                        ? new Date(currentSession.created_at).toLocaleString()
                        : 'N/A'
                    const lastSignIn = currentUser?.last_sign_in_at
                        ? new Date(currentUser.last_sign_in_at).toLocaleString()
                        : 'N/A'

                    return (
                        <div className="space-y-6">
                            {/* Current session card */}
                            <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                                            <DeviceIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{browser} on {os}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">IP Address: <span className="font-mono font-semibold text-slate-700">{userIp}</span></p>
                                            <p className="text-xs text-gray-500 mt-0.5">Signed in: {lastSignIn}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Session started: {sessionCreated}</p>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full shrink-0">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                        Current Session
                                    </span>
                                </div>
                            </div>

                            {/* User info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-xl p-4">
                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Account Email</p>
                                    <p className="text-sm font-bold text-slate-800 mt-1.5">{currentUser?.email || 'N/A'}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4">
                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Auth Provider</p>
                                    <p className="text-sm font-bold text-slate-800 mt-1.5 capitalize">
                                        {currentUser?.app_metadata?.provider || 'email'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4">
                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Account Created</p>
                                    <p className="text-sm font-bold text-slate-800 mt-1.5">
                                        {currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4">
                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Browser</p>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        <Globe className="w-3.5 h-3.5 text-gray-400" />
                                        <p className="text-sm font-bold text-slate-800">{browser} / {os}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Security actions */}
                            <div className="border-t border-gray-100 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Sign Out of All Devices</p>
                                    <p className="text-xs text-gray-500 mt-0.5">This will invalidate all active sessions across all browsers and devices.</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={fetchSessionInfo}
                                        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                                        title="Refresh session info"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                    <button
                                        id="btn-sign-out-all"
                                        onClick={handleSignOutAllDevices}
                                        disabled={signingOut}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        {signingOut ? 'Signing Out...' : 'Sign Out All Devices'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })()}
            </Panel>

            <Panel title="Recent Email Notifications" icon={History}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">When</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Type</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Recipient</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Subject</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {notificationLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-sm text-gray-500">No email notifications yet.</td>
                                </tr>
                            ) : notificationLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(log.created_at).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm font-bold text-slate-800">{log.notification_type}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{log.recipient_email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-black ${log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : log.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{log.subject}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>
                </>
            )}
        </div>
    )
}

const EnterpriseCard = ({ to, icon: Icon, title, description }) => (
    <Link to={to} className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:border-blue-200 hover:shadow-md transition">
        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-5">
            <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500 leading-6">{description}</p>
    </Link>
)
