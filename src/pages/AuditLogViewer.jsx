import { useEffect, useMemo, useState } from 'react'
import { Clock, Database, Filter, RefreshCw, ShieldCheck } from 'lucide-react'
import { enterpriseAdminService } from '../services/enterpriseAdminService'
import { useToast } from '../context/ToastContext'

const actions = ['all', 'INSERT', 'UPDATE', 'DELETE', 'CLIENT_EVENT']
const tables = ['all', 'employees', 'attendance', 'payroll_runs', 'payroll_items', 'company_subscriptions', 'subscription_plans', 'notification_logs', 'client_event']

export default function AuditLogViewer() {
    const toast = useToast()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState({ tableName: 'all', action: 'all', fromDate: '', toDate: '' })
    const [selectedLog, setSelectedLog] = useState(null)

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
                                        <td className="px-5 py-3 text-xs font-mono text-slate-500">{log.record_id || '-'}</td>
                                        <td className="px-5 py-3 text-xs font-mono text-slate-500">{log.actor_id || 'system'}</td>
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
