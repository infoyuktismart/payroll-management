import { Plus } from 'lucide-react'

export default function LoansHeader({ isAdmin, onApplyClick }) {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Loans & Salary Advances</h2>
                <p className="text-xs text-gray-500 mt-0.5">Manage interest-free salary advances, EMIs, and long-term employee loans</p>
            </div>
            {isAdmin && (
                <button
                    onClick={onApplyClick}
                    className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Apply for Loan
                </button>
            )}
        </div>
    )
}
