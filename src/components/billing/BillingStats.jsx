import React from 'react'
import { TrendingUp, Clock, Users, CreditCard } from 'lucide-react'

export default function BillingStats({
    stats,
    activeEmployeesCount,
    subscription,
    formatCurrency
}) {
    const currentPlan = subscription?.plan || null
    const defaultStats = stats || { totalPaid: 0, totalOutstanding: 0 }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Paid</p>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">{formatCurrency(defaultStats.totalPaid)}</p>
                    <p className="text-xs text-slate-500">Revenue collected</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Outstanding</p>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">{formatCurrency(defaultStats.totalOutstanding)}</p>
                    <p className="text-xs text-slate-500">Awaiting payment</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Headcount Rate</p>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">{activeEmployeesCount} Active</p>
                    <p className="text-xs text-slate-500">
                        {currentPlan ? `₹${currentPlan.price_per_employee || 0}/emp/mo rate` : 'No plan active'}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <CreditCard className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Plan</p>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{currentPlan?.name || 'Starter Plan'}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white uppercase tracking-wider mt-1">
                        {subscription?.billing_model === 'per_employee' ? 'PEPM Model' : 'Flat Plan'}
                    </span>
                </div>
            </div>
        </div>
    )
}
