import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardData } from '../hooks/useDashboardData'
import { formatDistanceToNow } from 'date-fns'
import { formatMonthYear } from '../lib/dateUtils'
import {
    Users,
    IndianRupee,
    CalendarCheck,
    AlertTriangle,
    Clock
} from 'lucide-react'

import { useCompany } from '../context/CompanyContext'

// --- Components ---

const StatCard = ({ title, value, icon: Icon, colorClass, borderClass }) => (
    <div className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-default group border-l-[6px] ${borderClass}`}>
        <div>
            <p className="text-[11px] font-bold text-gray-600 mb-1 group-hover:text-gray-500 transition-colors uppercase tracking-widest">{title}</p>
            <p className="text-3xl font-bold text-gray-900 group-hover:scale-105 transition-transform origin-left">{value}</p>
        </div>
        <div className={`p-3 rounded-xl transition-all duration-300 group-hover:rotate-12 group-hover:scale-110 shadow-sm ${colorClass}`}>
            <Icon className="w-5 h-5" />
        </div>
    </div>
)

const ActivityItem = ({ title, time, status }) => {
    const statusColors = {
        'completed': 'bg-emerald-100 text-emerald-700',
        'pending': 'bg-amber-50 text-amber-700',
        'in_progress': 'bg-blue-50 text-blue-700'
    }

    return (
        <div className="flex items-center justify-between py-4 group">
            <div>
                <p className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{title}</p>
                <p className="text-xs text-gray-600 mt-1">{time}</p>
            </div>
            {status && (
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold capitalize ${statusColors[status?.toLowerCase()] || 'bg-gray-100'}`}>
                    {status}
                </span>
            )}
        </div>
    )
}

const TaskItem = ({ title, due, priority, onClick }) => {
    const priorityColors = {
        'high': 'bg-rose-100 text-rose-600',
        'medium': 'bg-amber-100 text-amber-600',
        'low': 'bg-emerald-100 text-emerald-600'
    }

    return (
        <div 
            onClick={onClick}
            className={`flex items-center justify-between py-4 border-b border-gray-50 last:border-0 hover:bg-slate-50 transition-all duration-200 px-3 -mx-3 rounded-xl ${onClick ? 'cursor-pointer hover:pl-4 group' : ''}`}
        >
            <div>
                <p className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{title}</p>
                <p className="text-xs text-gray-600 mt-1">Due: {due}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold capitalize ${priorityColors[priority]}`}>
                {priority}
            </span>
        </div>
    )
}

const ProgressBar = ({ label, percentage, colorClass = "bg-slate-900" }) => (
    <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
            <span className="text-xs font-bold text-gray-500">{label}</span>
            <span className="text-xs font-bold text-gray-900">{percentage}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
                className={`h-2 rounded-full transition-all duration-1000 ease-out ${colorClass}`}
                style={{ width: `${percentage}%` }}
            ></div>
        </div>
    </div>
)

export default function Dashboard() {
    const navigate = useNavigate()
    const { company } = useCompany()
    const { data: dashboardData, isLoading: loading } = useDashboardData()

    const today = new Date()
    const todayDate = today.getDate()
    const todayMonthShort = today.toLocaleString('default', { month: 'short' })

    const { stats, activities, tasks, payrollStatus } = useMemo(() => {
        if (!dashboardData) {
            return {
                stats: {
                    totalEmployees: 0,
                    monthlyPayrollCost: 0,
                    attendanceRate: 0,
                    pendingCompliance: 0
                },
                activities: [],
                tasks: [],
                payrollStatus: {
                    attendance: 0,
                    calculation: 0,
                    compliance: 0,
                    payslip: 0
                }
            }
        }

        const employeeCount = dashboardData.employeeCount
        const latestRun = dashboardData.latestRun
        const salaries = dashboardData.salaries
        const attendanceLogs = dashboardData.attendanceLogs
        const pendingCompliance = dashboardData.pendingCompliance
        const recentRuns = dashboardData.recentRuns
        const newHires = dashboardData.newHires
        const recentReports = dashboardData.recentReports

        let payrollCost = latestRun?.total_amount
        if (!payrollCost) {
            payrollCost = salaries?.reduce((sum, e) => sum + (Number(e.salary || 0) + Number(e.salary_allowances || 0)), 0) || 0
        }

        const totalLogs = attendanceLogs?.length || 0
        const presentLogs = attendanceLogs?.filter(l => l.status === 'present').length || 0
        const attendanceRate = totalLogs > 0 ? ((presentLogs / totalLogs) * 100).toFixed(1) : 0

        const calculatedStats = {
            totalEmployees: employeeCount || 0,
            monthlyPayrollCost: payrollCost,
            attendanceRate: attendanceRate,
            pendingCompliance: pendingCompliance || 0
        }

        const mergedActivities = [
            ...(recentRuns?.map(run => {
                const date = new Date(run.month_year + '-01')
                return isNaN(date.getTime()) ? null : {
                    title: `Payroll processed for ${formatMonthYear(run.month_year)}`,
                    date,
                    status: run.status
                }
            }).filter(Boolean) || []),
            ...(newHires?.map(emp => {
                const date = new Date(emp.created_at)
                return isNaN(date.getTime()) ? null : {
                    title: `Employee onboarding - ${emp.first_name} ${emp.last_name}`,
                    date,
                    status: 'completed'
                }
            }).filter(Boolean) || []),
            ...(recentReports?.map(rep => {
                const date = new Date(rep.created_at)
                return isNaN(date.getTime()) ? null : {
                    title: `${rep.title} generated`,
                    date,
                    status: 'completed'
                }
            }).filter(Boolean) || [])
        ].sort((a, b) => b.date - a.date).slice(0, 5)

        const upcoming = []

        // Salary Configuration Task
        const pendingSalaryConfigs = salaries?.filter(e => {
            const hasSalary = e.salary && parseFloat(e.salary) > 0
            const hasStructure = e.salary_structure && Object.keys(e.salary_structure).length > 0
            return !hasSalary || !hasStructure
        }).length || 0
        if (pendingSalaryConfigs > 0) {
            upcoming.push({ 
                title: `Configure salary for ${pendingSalaryConfigs} pending employees`, 
                due: 'Immediate', 
                priority: 'high',
                action: '/salary-structure'
            })
        }

        // Payroll Task
        if (todayDate > 20) {
            upcoming.push({ title: 'Finalize monthly payroll processing', due: '25th ' + todayMonthShort, priority: 'high', action: '/payroll-processing' })
        } else {
            upcoming.push({ title: 'Reconcile attendance records', due: '20th ' + todayMonthShort, priority: 'medium', action: '/attendance' })
        }

        // Compliance Task
        if (pendingCompliance > 0) {
            upcoming.push({ title: `Review ${pendingCompliance} pending tax declarations`, due: 'Immediate', priority: 'high', action: '/tax-declarations' })
        } else {
            upcoming.push({ title: 'Verify statutory compliance filings', due: 'End of month', priority: 'low' })
        }

        const calculatedPayrollStatus = {
            attendance: 100,
            calculation: todayDate > 22 ? 100 : 40,
            compliance: pendingCompliance === 0 ? 100 : 75,
            payslip: todayDate > 25 ? 100 : 0
        }

        return {
            stats: calculatedStats,
            activities: mergedActivities,
            tasks: upcoming,
            payrollStatus: calculatedPayrollStatus
        }
    }, [dashboardData, todayDate, todayMonthShort])

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-slate-800">Welcome Back, {company?.name || 'Admin'}</h1>
                <p className="text-sm font-medium text-gray-600 mt-1">Here is what is happening with your payroll system today.</p>
            </header>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
                    {[1, 2, 3, 4].map(n => (
                        <div key={n} className="h-32 bg-white rounded-2xl border border-gray-100"></div>
                    ))}
                </div>
            ) : (
                <>
                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Total Active Employees"
                            value={stats.totalEmployees}
                            icon={Users}
                            colorClass="bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
                            borderClass="border-l-indigo-600"
                        />
                        <StatCard
                            title="Estimated Payroll Cost"
                            value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(stats.monthlyPayrollCost)}
                            icon={IndianRupee}
                            colorClass="bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"
                            borderClass="border-l-emerald-600"
                        />
                        <StatCard
                            title="Monthly Attendance Rate"
                            value={`${stats.attendanceRate}%`}
                            icon={CalendarCheck}
                            colorClass="bg-blue-50 text-blue-600 group-hover:bg-blue-100"
                            borderClass="border-l-blue-600"
                        />
                        <StatCard
                            title="Pending Compliance Reviews"
                            value={stats.pendingCompliance}
                            icon={AlertTriangle}
                            colorClass="bg-amber-50 text-amber-600 group-hover:bg-amber-100"
                            borderClass="border-l-amber-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Payroll Cycle Status */}
                        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-slate-800">Current Payroll Cycle</h3>
                                    <span className="flex items-center space-x-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Active Cycle</span>
                                    </span>
                                </div>
                                <div className="space-y-4">
                                    <ProgressBar label="Attendance & Leaves Synced" percentage={payrollStatus.attendance} colorClass="bg-emerald-500" />
                                    <ProgressBar label="Salary Calculations & Deductions" percentage={payrollStatus.calculation} colorClass="bg-indigo-500" />
                                    <ProgressBar label="Statutory & Tax Compliance" percentage={payrollStatus.compliance} colorClass="bg-amber-500" />
                                    <ProgressBar label="Payslip Generation & Distribution" percentage={payrollStatus.payslip} colorClass="bg-blue-500" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-6 border-t border-gray-50 mt-6 text-sm text-gray-600 font-bold">
                                <span>Cycle Period: 1st - 30th of Current Month</span>
                                <span onClick={() => navigate('/payroll-processing')} className="text-slate-700 font-black cursor-pointer hover:underline">View Flow Details</span>
                            </div>
                        </div>

                        {/* Upcoming Tasks */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-6">Action Needed</h3>
                                <div className="divide-y divide-gray-50">
                                    {tasks.length === 0 ? (
                                        <div className="py-6 text-center text-gray-600 text-sm">All tasks are up to date!</div>
                                    ) : (
                                        tasks.map((task, i) => (
                                            <TaskItem 
                                                key={i} 
                                                title={task.title} 
                                                due={task.due} 
                                                priority={task.priority} 
                                                onClick={task.action ? () => navigate(task.action) : undefined}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                            <button onClick={() => navigate('/reports')} className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-100 flex items-center justify-center space-x-2 mt-6 uppercase tracking-wider">
                                <span>Go to Compliance</span>
                            </button>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Recent Activities</h3>
                            <button onClick={() => navigate('/reports')} className="text-sm font-bold text-blue-600 hover:text-blue-700 transition">View History</button>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {activities.length === 0 ? (
                                <div className="py-6 text-center text-gray-600 text-sm">No recent activities found.</div>
                            ) : (
                                activities.map((activity, i) => (
                                    <ActivityItem
                                        key={i}
                                        title={activity.title}
                                        time={formatDistanceToNow(activity.date, { addSuffix: true })}
                                        status={activity.status}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
