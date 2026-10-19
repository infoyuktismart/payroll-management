import React from 'react'
import { TrendingUp, Clock, Building2, Users } from 'lucide-react'

export default function SuperAdminStats({ stats, formatCurrency }) {
    const defaultStats = {
        totalBilled: 0,
        totalOutstanding: 0,
        totalCompanies: 0,
        totalActiveSubscriptions: 0,
        totalTrials: 0,
        totalEmployees: 0,
        ...stats
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Billed</p>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">{formatCurrency(defaultStats.totalBilled)}</p>
                    <p className="text-xs text-slate-500">Collected subscriptions</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Receivables</p>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">{formatCurrency(defaultStats.totalOutstanding)}</p>
                    <p className="text-xs text-slate-500">Awaiting payment links</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Tenants</p>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">{defaultStats.totalCompanies} Brands</p>
                    <p className="text-xs text-slate-500">{defaultStats.totalActiveSubscriptions} active, {defaultStats.totalTrials} trialing</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">SaaS Headcount</p>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">{defaultStats.totalEmployees} Staff</p>
                    <p className="text-xs text-slate-500">Active employees system-wide</p>
                </div>
            </div>
        </div>
    )
}
