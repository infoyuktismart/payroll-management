import { WalletCards, CheckCircle2, Landmark } from 'lucide-react'

export default function LoansStats({
    pendingCount,
    activeCount,
    totalActiveAmount,
    formatCurrency
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-amber-500">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Requests</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{pendingCount}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <WalletCards className="w-6 h-6" />
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-emerald-500">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Loans</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{activeCount}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-indigo-600">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Disbursed Balance</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{formatCurrency(totalActiveAmount)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Landmark className="w-6 h-6" />
                </div>
            </div>
        </div>
    )
}
