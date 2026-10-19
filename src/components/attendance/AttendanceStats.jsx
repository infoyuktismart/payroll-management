import { Users, UserCheck, UserX, Calendar, Clock, LogOut } from 'lucide-react'

const StatCard = ({ title, value, icon: Icon, colorClass, borderColor }) => (
    <div className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 ${borderColor} flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-default group`}>
        <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">{title}</p>
            <p className="text-2xl font-bold text-slate-900 group-hover:scale-105 transition-transform origin-left">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl transition-all duration-300 group-hover:rotate-6 shadow-sm ${colorClass} flex items-center justify-center shrink-0`}>
            <Icon className="w-5 h-5" />
        </div>
    </div>
)

export default function AttendanceStats({ stats }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard title="Total Employees" value={stats.total} icon={Users} colorClass="bg-blue-50 text-blue-600" borderColor="border-l-blue-600" />
                <StatCard title="Present (Total)" value={stats.present} icon={UserCheck} colorClass="bg-emerald-50 text-emerald-600" borderColor="border-l-emerald-500" />
                <StatCard title="Absent (Total)" value={stats.absent} icon={UserX} colorClass="bg-rose-50 text-rose-600" borderColor="border-l-rose-500" />
                <StatCard title="On Leave (Days)" value={stats.onLeave} icon={Calendar} colorClass="bg-amber-50 text-amber-600" borderColor="border-l-amber-500" />
                <StatCard title="Late Arrivals" value={stats.late} icon={Clock} colorClass="bg-orange-50 text-orange-600" borderColor="border-l-orange-500" />
                <StatCard title="Early Departures" value={stats.early} icon={LogOut} colorClass="bg-purple-50 text-purple-600" borderColor="border-l-purple-600" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                <StatCard title="Attendance Rate" value={`${stats.rate}%`} icon={Clock} colorClass="bg-teal-50 text-teal-600" borderColor="border-l-teal-500" />
            </div>
        </div>
    )
}
