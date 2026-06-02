import { useEffect, useMemo, useState } from 'react'
import { Activity, CheckCircle2, Clock, Database, Mail, RefreshCw, Server, ShieldAlert, XCircle } from 'lucide-react'
import { enterpriseAdminService } from '../services/enterpriseAdminService'
import { useToast } from '../context/ToastContext'

export default function SystemHealth() {
    const toast = useToast()
    const [health, setHealth] = useState(null)
    const [loading, setLoading] = useState(true)

    const load = async () => {
        setLoading(true)
        try {
            setHealth(await enterpriseAdminService.getSystemHealth())
        } catch (error) {
            toast.error(`System health check failed: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
         
    }, [])

    const mailStats = useMemo(() => {
        const logs = health?.mailLogs || []
        return {
            total: logs.length,
            sent: logs.filter(log => log.status === 'sent').length,
            failed: logs.filter(log => log.status === 'failed').length
        }
    }, [health])

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">System Health</h1>
                        <p className="text-sm text-slate-500">Check database connectivity, audit volume, email delivery logs, sessions, and report-job health.</p>
                    </div>
                </div>
                <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Run Check
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <HealthCard title="Database" value={health?.db?.ok ? 'Online' : 'Issue'} detail={`${health?.latencyMs || 0} ms response`} icon={Database} ok={health?.db?.ok} />
                <HealthCard title="Audit Records" value={health?.auditCount || 0} detail="Rows visible to admin" icon={ShieldAlert} ok />
                <HealthCard title="Mail Logs" value={mailStats.total} detail={`${mailStats.sent} sent, ${mailStats.failed} failed`} icon={Mail} ok={mailStats.failed === 0} />
                <HealthCard title="Report Jobs" value={health?.reportJobsCount || 0} detail="Generated reports tracked" icon={Server} ok />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Panel title="Recent Mail Logs" icon={Mail}>
                    <Table
                        empty="No email logs found."
                        rows={health?.mailLogs || []}
                        columns={[
                            ['When', row => new Date(row.created_at).toLocaleString()],
                            ['Recipient', row => row.recipient_email],
                            ['Type', row => row.notification_type],
                            ['Status', row => <Status status={row.status} />]
                        ]}
                    />
                </Panel>

                <Panel title="Recent Session Events" icon={Clock}>
                    <Table
                        empty="No session logs found."
                        rows={health?.sessionLogs || []}
                        columns={[
                            ['When', row => new Date(row.created_at).toLocaleString()],
                            ['Event', row => row.event_type],
                            ['Device', row => [row.browser, row.os].filter(Boolean).join(' / ') || '-'],
                            ['User', row => row.metadata?.email || row.user_id || '-']
                        ]}
                    />
                </Panel>
            </div>

            <Panel title="Stored Health Checks" icon={Activity}>
                <Table
                    empty="No stored health checks yet."
                    rows={health?.healthChecks || []}
                    columns={[
                        ['Checked', row => new Date(row.checked_at).toLocaleString()],
                        ['Check', row => row.check_key],
                        ['Status', row => <Status status={row.status} />],
                        ['Message', row => row.message || '-']
                    ]}
                />
            </Panel>
        </div>
    )
}

const HealthCard = ({ title, value, detail, icon: Icon, ok }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
            <Icon className="w-5 h-5 text-slate-400" />
            {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-rose-500" />}
        </div>
        <p className="mt-4 text-sm font-black uppercase tracking-wider text-slate-500">{title}</p>
        <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
)

const Panel = ({ title, icon: Icon, children }) => (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Icon className="w-4 h-4 text-slate-500" />
            <h2 className="font-black text-slate-900">{title}</h2>
        </div>
        <div className="overflow-x-auto">{children}</div>
    </section>
)

const Table = ({ rows, columns, empty }) => (
    <table className="w-full text-left">
        <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{columns.map(([header]) => <th key={header} className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-sm text-slate-500">{empty}</td></tr>
            ) : rows.map((row, index) => (
                <tr key={row.id || index} className="hover:bg-slate-50">
                    {columns.map(([header, render]) => <td key={header} className="px-5 py-3 text-sm text-slate-600">{render(row)}</td>)}
                </tr>
            ))}
        </tbody>
    </table>
)

const Status = ({ status }) => {
    const ok = ['sent', 'healthy', 'active'].includes(status)
    const bad = ['failed', 'critical'].includes(status)
    const color = ok ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${color}`}>{status || 'unknown'}</span>
}
