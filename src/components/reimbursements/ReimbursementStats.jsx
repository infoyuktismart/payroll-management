import { FileText, CheckCircle2, Receipt } from 'lucide-react'

export default function ReimbursementStats({ pendingCount = 0, approvedCount = 0, totalApprovedAmount = 0, formatCurrency }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-amber-500">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending Review</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{pendingCount}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-emerald-500">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Approved Claims</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{approvedCount}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between border-l-[6px] border-l-indigo-600">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Reimbursed</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{formatCurrency(totalApprovedAmount)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Receipt className="w-6 h-6" />
                </div>
            </div>
        </div>
    )
}
