import { Clock, Wrench, DollarSign, CheckCircle2 } from 'lucide-react'

const StatCard = ({ title, value, icon: Icon, colorClass, borderClass }) => (
    <div className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-default group border-l-4 ${borderClass}`}>
        <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">{title}</p>
            <p className="text-2xl font-bold text-slate-900 group-hover:scale-105 transition-transform origin-left">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl transition-all duration-300 group-hover:rotate-6 shadow-sm ${colorClass} flex items-center justify-center shrink-0`}>
            <Icon className="w-5 h-5" />
        </div>
    </div>
)

export default function ExitStats({ exits = [] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
                title="Pending Requests"
                value={exits.filter(e => e.status === 'pending').length}
                icon={Clock}
                colorClass="bg-amber-50 text-amber-600"
                borderClass="border-l-4 border-l-amber-500"
            />
            <StatCard
                title="In Clearance"
                value={exits.filter(e => e.status === 'clearance').length}
                icon={Wrench}
                colorClass="bg-indigo-50 text-indigo-600"
                borderClass="border-l-4 border-l-indigo-500"
            />
            <StatCard
                title="Final Settlement"
                value={exits.filter(e => e.status === 'settlement').length}
                icon={DollarSign}
                colorClass="bg-emerald-50 text-emerald-600"
                borderClass="border-l-4 border-l-emerald-500"
            />
            <StatCard
                title="Completed Exits"
                value={exits.filter(e => e.status === 'completed').length}
                icon={CheckCircle2}
                colorClass="bg-blue-50 text-blue-600"
                borderClass="border-l-4 border-l-blue-500"
            />
        </div>
    )
}
