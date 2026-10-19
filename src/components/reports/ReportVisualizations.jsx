import { useMemo } from 'react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    Legend
} from 'recharts'
import { TrendingUp, CalendarCheck, ShieldCheck } from 'lucide-react'

export default function ReportVisualizations({
    activeReportTab,
    payrollTrendData,
    departmentData,
    attendanceData,
    metrics,
    formatCurrency
}) {
    return (
        <div
            className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${
                activeReportTab === 'compliance' || activeReportTab === 'custom' ? 'hidden' : ''
            }`}
        >
            {/* Monthly Payroll Trend */}
            <div
                className={`col-span-1 lg:col-span-2 min-w-0 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${
                    activeReportTab !== 'payroll' ? 'hidden' : ''
                }`}
            >
                <div className="flex items-center space-x-2 mb-6">
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                    <h3 className="font-bold text-gray-800">Monthly Payroll Trend</h3>
                </div>
                <div className="h-64 w-full min-w-0 mt-4">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={payrollTrendData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '12px',
                                    border: 'none',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="amount"
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Department Distribution */}
            <div
                className={`min-w-0 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${
                    activeReportTab !== 'hr' ? 'hidden' : ''
                }`}
            >
                <h3 className="font-bold text-gray-800 mb-6">Department-wise Employee Distribution</h3>
                <div className="h-48 w-full min-w-0 mt-4">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                            <Pie
                                data={departmentData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={70}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {departmentData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    {departmentData.map((item, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-gray-600 font-medium">
                                {item.name}: {item.value}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Attendance Trends */}
            <div
                className={`col-span-1 lg:col-span-2 min-w-0 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${
                    activeReportTab !== 'hr' ? 'hidden' : ''
                }`}
            >
                <div className="flex items-center space-x-2 mb-6">
                    <CalendarCheck className="w-5 h-5 text-gray-400" />
                    <h3 className="font-bold text-gray-800">Attendance Trends</h3>
                </div>
                <div className="h-64 w-full min-w-0 mt-4">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={attendanceData} barSize={12}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{
                                    borderRadius: '12px',
                                    border: 'none',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                }}
                            />
                            <Legend
                                iconType="circle"
                                verticalAlign="bottom"
                                align="center"
                                wrapperStyle={{ paddingTop: '20px' }}
                            />
                            <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                            <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Key Metrics */}
            <div
                className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between border-l-[6px] border-l-slate-900 group transition-all duration-300 hover:shadow-md ${
                    activeReportTab !== 'hr' ? 'hidden' : ''
                }`}
            >
                <div className="flex items-center space-x-2 mb-6">
                    <TrendingUp className="w-5 h-5 text-slate-400 group-hover:scale-110 transition-transform" />
                    <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-widest">Key Metrics Overview</h3>
                </div>
                <div className="space-y-6">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Average Salary</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(metrics.averageSalary)}</p>
                        </div>
                        <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-full">Live</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Employee Retention</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.retentionRate.toFixed(1)}%</p>
                        </div>
                        <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                            {metrics.activeEmployees}/{metrics.totalEmployees}
                        </span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Avg. Attendance</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.attendanceRate.toFixed(1)}%</p>
                        </div>
                        <span className="text-xs font-bold text-gray-600 bg-gray-50 px-2 py-1 rounded-full">6 mo</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Compliance Score</p>
                            <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.complianceScore.toFixed(1)}%</p>
                        </div>
                        <ShieldCheck className="w-6 h-6 text-emerald-600" />
                    </div>
                </div>
            </div>
        </div>
    )
}
