import { useEffect, useMemo, useState } from 'react'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'
import { Activity, ShieldCheck, TrendingUp, Users } from 'lucide-react'
import { analyticsService } from '../services/analyticsService'
import { formatCurrency } from '../lib/payrollUtils'
import { useToast } from '../context/ToastContext'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b']

export default function Analytics() {
    const toast = useToast()
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [data, setData] = useState({
        payrollTrend: [],
        departmentHeadcount: [],
        headcountMonthly: [],
        attendanceSummary: [],
        complianceSummary: {},
        momVariance: { percentage: 0, amount: 0, direction: 'neutral' }
    })

    useEffect(() => {
        let mounted = true
        const load = async () => {
            setLoading(true)
            try {
                const analytics = await analyticsService.getAnalyticsDashboard(startDate, endDate)
                if (mounted) setData(analytics)
            } catch (error) {
                toast.error(error.message || 'Unable to load analytics.')
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [toast, startDate, endDate])

    const totals = useMemo(() => {
        const payrollTotal = data.payrollTrend.reduce((sum, row) => sum + Number(row.total_payroll || 0), 0)
        const activeEmployees = data.departmentHeadcount.reduce((sum, row) => sum + Number(row.active_count || 0), 0)
        const latestAttendance = data.attendanceSummary.at(-1)?.attendance_rate || 0
        return {
            payrollTotal,
            activeEmployees,
            attendanceRate: Number(latestAttendance),
            complianceScore: Number(data.complianceSummary?.compliance_score || 0)
        }
    }, [data])

    const complianceEvents = [
        { id: 'tds', name: 'TDS Payment (Challan 281)', dueDay: 7, desc: 'Tax Deducted at Source payment for previous month salaries.', authority: 'Income Tax Dept' },
        { id: 'pf', name: 'PF ECR Filing & Payment', dueDay: 15, desc: 'Provident Fund Electronic Challan cum Receipt filing.', authority: 'EPFO' },
        { id: 'esic', name: 'ESIC Contribution Challan', dueDay: 15, desc: 'Employee State Insurance Corporation monthly contribution.', authority: 'ESIC' },
        { id: 'pt', name: 'Professional Tax (PT) Filing', dueDay: 21, desc: 'State-wise PT deduction returns and payment.', authority: 'State Government' }
    ]

    const [alertSettings, setAlertSettings] = useState({
        tds: true,
        pf: true,
        esic: true,
        pt: false
    })

    const [simulatedAlert, setSimulatedAlert] = useState(null)

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-28 rounded-2xl bg-white border border-gray-200 animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(item => <div key={item} className="h-28 rounded-2xl bg-white border border-gray-200 animate-pulse" />)}
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="h-80 rounded-2xl bg-white border border-gray-200 animate-pulse" />
                    <div className="h-80 rounded-2xl bg-white border border-gray-200 animate-pulse" />
                </div>
            </div>
        )
    }

    const getDaysRemaining = (dueDay) => {
        const today = new Date('2026-05-26')
        const currentYear = today.getFullYear()
        const currentMonth = today.getMonth()
        let targetMonth = currentMonth + 1
        let targetYear = currentYear
        if (targetMonth > 11) {
            targetMonth = 0
            targetYear += 1
        }
        const targetDate = new Date(targetYear, targetMonth, dueDay)
        const diffTime = targetDate.getTime() - today.getTime()
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    const triggerTestAlert = (name, days) => {
        setSimulatedAlert({
            message: `🔔 COMPLIANCE ALERT: ${name} deadline is approaching! Only ${days} days remaining to file.`,
            timestamp: new Date().toLocaleTimeString()
        })
        toast.success(`Compliance alert triggered for ${name}`)
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Analytics</h1>
                    <p className="text-sm text-gray-500 mt-1">Payroll, workforce, attendance, and compliance signals for the active company.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-gray-500 uppercase tracking-wider">From</span>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)} 
                            className="px-3 py-2 rounded-xl border border-gray-205 text-xs font-bold text-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-gray-500 uppercase tracking-wider">To</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)} 
                            className="px-3 py-2 rounded-xl border border-gray-205 text-xs font-bold text-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button 
                            onClick={() => { setStartDate(''); setEndDate(''); }} 
                            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-black text-slate-650 transition"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {simulatedAlert && (
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
                    <p className="text-xs font-bold text-amber-800 leading-relaxed">{simulatedAlert.message} <span className="text-[10px] text-gray-400 font-medium ml-2">Sent at {simulatedAlert.timestamp}</span></p>
                    <button onClick={() => setSimulatedAlert(null)} className="text-xs font-black text-amber-700 hover:text-amber-900 shrink-0">Dismiss</button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard 
                    icon={TrendingUp} 
                    label="Payroll Tracked" 
                    value={formatCurrency(totals.payrollTotal)} 
                    tone="blue" 
                    badge={
                        data.momVariance && data.momVariance.percentage !== 0 ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                data.momVariance.direction === 'up'
                                    ? 'bg-rose-50 border border-rose-100 text-rose-700'
                                    : 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                            }`}>
                                {data.momVariance.direction === 'up' ? '↑' : '↓'} {Math.abs(data.momVariance.percentage).toFixed(1)}% vs last month
                            </span>
                        ) : null
                    }
                />
                <StatCard icon={Users} label="Active Headcount" value={totals.activeEmployees} tone="emerald" />
                <StatCard icon={Activity} label="Attendance Rate" value={`${totals.attendanceRate.toFixed(1)}%`} tone="amber" />
                <StatCard icon={ShieldCheck} label="Compliance Score" value={`${totals.complianceScore.toFixed(1)}%`} tone="violet" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Payroll Trend">
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={data.payrollTrend.slice(-12)}>
                            <defs>
                                <linearGradient id="payrollFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="month_label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(value) => formatCurrency(value)} />
                            <Area type="monotone" dataKey="total_payroll" stroke="#2563eb" strokeWidth={3} fill="url(#payrollFill)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Department Distribution">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-4 items-center">
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie data={data.departmentHeadcount} dataKey="active_count" nameKey="department" innerRadius={62} outerRadius={96} paddingAngle={3}>
                                    {data.departmentHeadcount.map((entry, index) => (
                                        <Cell key={entry.department} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2">
                            {data.departmentHeadcount.slice(0, 7).map((dept, index) => (
                                <div key={dept.department} className="flex items-center justify-between gap-3 text-xs">
                                    <span className="inline-flex items-center gap-2 min-w-0">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        <span className="font-bold text-slate-700 truncate">{dept.department}</span>
                                    </span>
                                    <span className="text-gray-500 font-bold">{dept.active_count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </ChartCard>

                <ChartCard title="Headcount Movement">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={data.headcountMonthly.slice(-12)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="month_label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Bar dataKey="hires" fill="#10b981" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Attendance Health">
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={data.attendanceSummary.slice(-12)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="month_label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                            <Area type="monotone" dataKey="attendance_rate" stroke="#f59e0b" strokeWidth={3} fill="#fef3c7" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Compliance Alerts & Calendar Widget */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-indigo-500" />
                            Statutory Compliance Calendar & Alerts
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">Configure automated notifications and track standard monthly Indian compliance filing schedules.</p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg">Active Tracker</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {complianceEvents.map(event => {
                        const days = getDaysRemaining(event.dueDay)
                        return (
                            <div key={event.id} className="p-4 rounded-2xl border border-gray-150 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[180px]">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{event.authority}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                            days <= 15 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            Due on {event.dueDay}th
                                        </span>
                                    </div>
                                    <h3 className="text-xs font-bold text-slate-800 truncate">{event.name}</h3>
                                    <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{event.desc}</p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase">Time Left</span>
                                        <span className="text-xs font-black text-slate-700">{days} days</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => triggerTestAlert(event.name, days)}
                                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black transition"
                                        >
                                            Test Alert
                                        </button>
                                        <button 
                                            onClick={() => setAlertSettings(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                                            className={`w-8 h-4 rounded-full relative transition-colors ${alertSettings[event.id] ? 'bg-indigo-600' : 'bg-gray-205'}`}
                                        >
                                            <span className={`w-3 h-3 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${alertSettings[event.id] ? 'left-4.5' : 'left-0.5'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

const StatCard = ({ icon: Icon, label, value, tone, badge }) => {
    const tones = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        violet: 'bg-violet-50 text-violet-600 border-violet-100'
    }
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col justify-between">
            <div>
                <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">{label}</p>
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${tones[tone]}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-3">{value}</p>
            </div>
            {badge && <div className="mt-2.5">{badge}</div>}
        </div>
    )
}

const ChartCard = ({ title, children }) => (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 min-w-0">
        <h2 className="text-base font-black text-slate-900 mb-5">{title}</h2>
        {children}
    </section>
)
