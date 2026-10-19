import { useEffect, useMemo, useState } from 'react'
import { Clock, Database, Filter, RefreshCw, ShieldCheck } from 'lucide-react'
import { enterpriseAdminService } from '../services/enterpriseAdminService'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'

const actions = ['all', 'INSERT', 'UPDATE', 'DELETE', 'CLIENT_EVENT']
const tables = ['all', 'employees', 'attendance', 'payroll_runs', 'payroll_items', 'company_subscriptions', 'subscription_plans', 'notification_logs', 'client_event']

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

export default function AuditLogViewer() {
    const toast = useToast()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState({ tableName: 'all', action: 'all', fromDate: '', toDate: '' })
    const [selectedLog, setSelectedLog] = useState(null)
    const [actorMap, setActorMap] = useState({})

    const loadLogs = async () => {
        setLoading(true)
        try {
            const response = await enterpriseAdminService.getAuditLogs(filters)
            setLogs(response.data || [])
        } catch (error) {
            toast.error(`Failed to load audit logs: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadLogs()
         
    }, [])

    useEffect(() => {
        const fetchActors = async () => {
            const uniqueActorIds = [...new Set(logs.map(log => log.actor_id).filter(Boolean))]
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

        if (logs && logs.length > 0) {
            fetchActors()
        }
    }, [logs])

    const summary = useMemo(() => ({
        total: logs.length,
        updates: logs.filter(log => log.action === 'UPDATE').length,
        deletes: logs.filter(log => log.action === 'DELETE').length,
        inserts: logs.filter(log => log.action === 'INSERT').length
    }), [logs])

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">Audit Log Viewer</h1>
                        <p className="text-sm text-slate-500">Review write activity, actor IDs, before/after payloads, and client-side admin events.</p>
                    </div>
                </div>
                <button onClick={loadLogs} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Rows Loaded" value={summary.total} />
                <Stat label="Inserts" value={summary.inserts} tone="emerald" />
                <Stat label="Updates" value={summary.updates} tone="blue" />
                <Stat label="Deletes" value={summary.deletes} tone="rose" />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <h2 className="font-black text-slate-900">Filters</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <Select label="Table" value={filters.tableName} options={tables} onChange={(tableName) => setFilters(prev => ({ ...prev, tableName }))} />
                    <Select label="Action" value={filters.action} options={actions} onChange={(action) => setFilters(prev => ({ ...prev, action }))} />
                    <Input label="From" type="date" value={filters.fromDate} onChange={(fromDate) => setFilters(prev => ({ ...prev, fromDate }))} />
                    <Input label="To" type="date" value={filters.toDate} onChange={(toDate) => setFilters(prev => ({ ...prev, toDate }))} />
                    <button onClick={loadLogs} className="self-end rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">Apply</button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    {['When', 'Action', 'Table', 'Record', 'Actor'].map(header => (
                                        <th key={header} className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {logs.length === 0 ? (
                                    <tr><td colSpan="5" className="px-5 py-10 text-center text-sm text-slate-500">{loading ? 'Loading audit logs...' : 'No audit logs found.'}</td></tr>
                                ) : logs.map(log => (
                                    <tr key={log.id} onClick={() => setSelectedLog(log)} className="cursor-pointer hover:bg-slate-50">
                                        <td className="px-5 py-3 text-sm text-slate-600">
                                            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" />{new Date(log.created_at).toLocaleString()}</div>
                                        </td>
                                        <td className="px-5 py-3"><ActionBadge action={log.action} /></td>
                                        <td className="px-5 py-3 text-sm font-bold text-slate-800">{log.table_name}</td>
                                        <td className="px-5 py-3 text-xs text-gray-700 font-medium" title={log.record_id || ''}>{getReadableRecordLabel(log)}</td>
                                        <td className="px-5 py-3 text-xs text-gray-700 font-medium" title={log.actor_id || 'system'}>{log.actor_id ? (actorMap[log.actor_id]?.name || 'Loading...') : 'system'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                        <Database className="w-4 h-4 text-slate-500" />
                        <h2 className="font-black text-slate-900">Event Payload</h2>
                    </div>
                    <div className="p-5">
                        {selectedLog ? (
                            <div className="space-y-4">
                                <Payload title="Old Data" value={selectedLog.old_data} />
                                <Payload title="New Data" value={selectedLog.new_data} />
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">Select a row to inspect the stored payload.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

const Stat = ({ label, value, tone = 'slate' }) => {
    const tones = {
        slate: 'bg-slate-50 text-slate-900 border-slate-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100'
    }
    return <div className={`rounded-2xl border p-4 ${tones[tone]}`}><p className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>
}

const Select = ({ label, value, options, onChange }) => (
    <label className="block">
        <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">{label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
    </label>
)

const Input = ({ label, value, onChange, type = 'text' }) => (
    <label className="block">
        <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">{label}</span>
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700" />
    </label>
)

const ActionBadge = ({ action }) => {
    const colors = {
        INSERT: 'bg-emerald-50 text-emerald-700',
        UPDATE: 'bg-blue-50 text-blue-700',
        DELETE: 'bg-rose-50 text-rose-700',
        CLIENT_EVENT: 'bg-violet-50 text-violet-700'
    }
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${colors[action] || 'bg-slate-100 text-slate-700'}`}>{action}</span>
}

const Payload = ({ title, value }) => (
    <div>
        <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">{title}</p>
        <pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(value || {}, null, 2)}</pre>
    </div>
)
