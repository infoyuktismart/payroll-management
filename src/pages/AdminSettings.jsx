import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus, Trash2, Users, ClipboardList, History, Shield, Monitor, Smartphone, Globe, LogOut, RefreshCw, Activity, Crown, FileSearch, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
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
import { CardSkeleton, TableSkeleton } from '../components/ui/SkeletonLoader'

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

const getReadableRecordLabel = (log) => {
    if (!log) return '-'
    const data = log.new_data || log.old_data || {}
    const table = log.table_name
    
    switch (table) {
        case 'employees':
            if (data.first_name || data.last_name) {
                return `${data.first_name || ''} ${data.last_name || ''}`.trim() + (data.employee_id ? ` (${data.employee_id})` : '')
            }
            break
        case 'departments':
        case 'holidays':
            if (data.name) return data.name
            break
        case 'leave_policies':
        case 'leaves':
            if (data.leave_type) return data.leave_type
            break
        case 'onboarding_checklists':
            if (data.task_name) return data.task_name
            break
        case 'custom_deductions':
            if (data.deduction_type) return `${data.deduction_type} (₹${data.amount || 0})`
            break
        case 'payroll_runs':
            if (data.month_year) return new Date(data.month_year).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
            break
        case 'payroll_items':
            if (data.employee_id) return `Payroll Item (${data.net_salary ? '₹' + data.net_salary : log.record_id})`
            break
        case 'attendance':
        case 'overtime':
            if (data.date) return new Date(data.date).toLocaleDateString()
            break
        case 'salaries':
            if (data.month) return `Salary - ${new Date(data.month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
            break
        case 'salary_components':
            if (data.name) return data.name
            break
        case 'leave_balances':
            if (data.leave_type) return `${data.leave_type} Balance: ${data.balance || 0}`
            break
        case 'employee_documents':
            if (data.document_type) return data.document_type
            break
        case 'exits':
            if (data.exit_date) return `Exit Date: ${data.exit_date}`
            break
        case 'generated_reports':
            if (data.title) return data.title
            break
    }
    return log.record_id || '-'
}

export default function AdminSettings() {
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
    const [actorMap, setActorMap] = useState({})

    // React Query Gold Standard Query Hook
    const { data: adminData = {}, isLoading, error } = useAdminSettings()
    const { departments = [], holidays = [], leavePolicies = [], auditLogs = [], notificationLogs = [] } = adminData

    // React Query Gold Standard Mutation Hooks
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

    useEffect(() => {
        const fetchActors = async () => {
            const uniqueActorIds = [...new Set(auditLogs.map(log => log.actor_id).filter(Boolean))]
            if (uniqueActorIds.length === 0) return

            try {
                const [profilesRes, employeesRes] = await Promise.all([
                    supabase.from('profiles').select('id, email, full_name').in('id', uniqueActorIds),
                    supabase.from('employees').select('user_id, first_name, last_name, email').in('user_id', uniqueActorIds)
                ])

                const newMap = {}
                uniqueActorIds.forEach(id => {
                    const profile = profilesRes.data?.find(p => p.id === id)
                    const employee = employeesRes.data?.find(e => e.user_id === id)

                    const name = employee 
                        ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
                        : profile?.full_name || ''

                    const email = employee?.email || profile?.email || ''

                    newMap[id] = {
                        name: name || email || 'Unknown User',
                        email: email
                    }
                })
                setActorMap(prev => ({ ...prev, ...newMap }))
            } catch (err) {
                console.error('Failed to fetch actor names:', err)
            }
        }

        if (auditLogs && auditLogs.length > 0) {
            fetchActors()
        }
    }, [auditLogs])

    // Pristine Handlers: Mutate state & delegate user notifications entirely to hooks
    const addDepartment = () => {
        const name = forms.department.trim()
        if (!name) return
        addDepartmentMutation.mutate(name, {
            onSuccess: () => {
                setForms(prev => ({ ...prev, department: '' }))
            }
        })
    }

    const addHoliday = () => {
        if (!forms.holidayName.trim() || !forms.holidayDate) return
        addHolidayMutation.mutate({ name: forms.holidayName.trim(), date: forms.holidayDate }, {
            onSuccess: () => {
                setForms(prev => ({ ...prev, holidayName: '', holidayDate: '' }))
            }
        })
    }

    const addLeavePolicy = () => {
        if (!forms.leaveType.trim() || !forms.annualBalance) return
        addLeavePolicyMutation.mutate({ leaveType: forms.leaveType.trim(), annualBalance: forms.annualBalance }, {
            onSuccess: () => {
                setForms(prev => ({ ...prev, leaveType: '', annualBalance: '' }))
            }
        })
    }

    const removeRow = (table, id) => {
        removeRowMutation.mutate({ table, id })
    }

    const initializeLeaveBalances = () => {
        initializeLeaveBalancesMutation.mutate(new Date().getFullYear())
    }

    const handleSignOutAllDevices = async () => {
        setSigningOut(true)
        try {
            const { error } = await supabase.auth.signOut({ scope: 'global' })
            if (error) throw error
            setTimeout(() => window.location.href = '/login', 1500)
        } catch (err) {
            logger.error('Failed to sign out all devices:', err)
        } finally {
            setSigningOut(false)
        }
    }

    // ─── Render Loading Skeletons ───
    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                        <div className="h-5 bg-gray-200 rounded w-1/2 mb-4"></div>
                        <CardSkeleton lines={3} />
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                        <div className="h-5 bg-gray-200 rounded w-1/2 mb-4"></div>
                        <CardSkeleton lines={3} />
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                        <div className="h-5 bg-gray-200 rounded w-1/2 mb-4"></div>
                        <CardSkeleton lines={3} />
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                    <div className="h-5 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <TableSkeleton rows={4} cols={5} />
                </div>
            </div>
        )
    }

    // ─── Render Error Banner ───
    if (error) {
        return (
            <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center max-w-xl mx-auto my-12 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Failed to Load Admin Settings</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    {error.message || 'An unexpected error occurred while fetching organizational configuration.'}
                </p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
                >
                    <RefreshCw className="w-4 h-4" />
                    Retry Loading
                </button>
            </div>
        )
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
                {/* ── Departments Panel ── */}
                <Panel title="Departments" icon={Users}>
                    <div className="flex gap-2 mb-4">
                        <input
                            disabled={addDepartmentMutation.isPending}
                            value={forms.department}
                            onChange={(e) => setForms(prev => ({ ...prev, department: e.target.value }))}
                            placeholder={addDepartmentMutation.isPending ? "Adding..." : "Department name"}
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50"
                        />
                        <button 
                            disabled={addDepartmentMutation.isPending || !forms.department.trim()}
                            onClick={addDepartment} 
                            className="p-2 rounded-lg bg-slate-900 text-white disabled:opacity-50 flex items-center justify-center min-w-9"
                        >
                            {addDepartmentMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        </button>
                    </div>
                    <div className="space-y-2">
                        {departments.map(dept => (
                            <div key={dept.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-sm font-semibold">
                                <span>{dept.name}</span>
                                <button 
                                    disabled={removeRowMutation.isPending}
                                    onClick={() => removeRow('departments', dept.id)} 
                                    className="text-rose-500 hover:text-rose-700 disabled:opacity-50 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {departments.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">No departments configured.</p>
                        )}
                    </div>
                </Panel>

                {/* ── Holidays Panel ── */}
                <Panel title="Holidays" icon={CalendarDays}>
                    <div className="space-y-2 mb-4">
                        <input
                            disabled={addHolidayMutation.isPending}
                            value={forms.holidayName}
                            onChange={(e) => setForms(prev => ({ ...prev, holidayName: e.target.value }))}
                            placeholder={addHolidayMutation.isPending ? "Adding..." : "Holiday name"}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50"
                        />
                        <div className="flex gap-2">
                            <input
                                disabled={addHolidayMutation.isPending}
                                type="date"
                                value={forms.holidayDate}
                                onChange={(e) => setForms(prev => ({ ...prev, holidayDate: e.target.value }))}
                                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50"
                            />
                            <button 
                                disabled={addHolidayMutation.isPending || !forms.holidayName.trim() || !forms.holidayDate}
                                onClick={addHoliday} 
                                className="p-2 rounded-lg bg-slate-900 text-white disabled:opacity-50 flex items-center justify-center min-w-9"
                            >
                                {addHolidayMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                        {holidays.map(holiday => (
                            <div key={holiday.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-sm">
                                <span><b>{holiday.name}</b><br /><span className="text-xs text-gray-500">{holiday.date}</span></span>
                                <button 
                                    disabled={removeRowMutation.isPending}
                                    onClick={() => removeRow('holidays', holiday.id)} 
                                    className="text-rose-500 hover:text-rose-700 disabled:opacity-50 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {holidays.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">No holidays registered.</p>
                        )}
                    </div>
                </Panel>

                {/* ── Leave Policies Panel ── */}
                <Panel title="Leave Policies" icon={ClipboardList}>
                    <button
                        disabled={initializeLeaveBalancesMutation.isPending}
                        onClick={initializeLeaveBalances}
                        className="mb-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {initializeLeaveBalancesMutation.isPending ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Initializing...
                            </>
                        ) : (
                            "Initialize Current Year Balances"
                        )}
                    </button>
                    <div className="space-y-2 mb-4">
                        <input
                            disabled={addLeavePolicyMutation.isPending}
                            value={forms.leaveType}
                            onChange={(e) => setForms(prev => ({ ...prev, leaveType: e.target.value }))}
                            placeholder={addLeavePolicyMutation.isPending ? "Adding..." : "Leave type"}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50"
                        />
                        <div className="flex gap-2">
                            <input
                                disabled={addLeavePolicyMutation.isPending}
                                type="number"
                                value={forms.annualBalance}
                                onChange={(e) => setForms(prev => ({ ...prev, annualBalance: e.target.value }))}
                                placeholder="Annual balance"
                                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50"
                            />
                            <button 
                                disabled={addLeavePolicyMutation.isPending || !forms.leaveType.trim() || !forms.annualBalance}
                                onClick={addLeavePolicy} 
                                className="p-2 rounded-lg bg-slate-900 text-white disabled:opacity-50 flex items-center justify-center min-w-9"
                            >
                                {addLeavePolicyMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {leavePolicies.map(policy => (
                            <div key={policy.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-sm">
                                <span><b>{policy.leave_type}</b><br /><span className="text-xs text-gray-500">{policy.annual_balance} days/year</span></span>
                                <button 
                                    disabled={removeRowMutation.isPending}
                                    onClick={() => removeRow('leave_policies', policy.id)} 
                                    className="text-rose-500 hover:text-rose-700 disabled:opacity-50 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {leavePolicies.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">No leave policies defined.</p>
                        )}
                    </div>
                </Panel>
            </div>

            {/* ── Recent Audit Logs Panel ── */}
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
                                    <td className="px-4 py-3 text-xs text-gray-700 font-medium" title={log.record_id || ''}>{getReadableRecordLabel(log)}</td>
                                    <td className="px-4 py-3 text-xs text-gray-700 font-medium" title={log.actor_id || 'system'}>{log.actor_id ? (actorMap[log.actor_id]?.name || 'Loading...') : 'system'}</td>
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

            {/* ── Recent Email Notifications Panel ── */}
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
