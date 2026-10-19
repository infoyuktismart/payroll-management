import { Plus, Edit2, Trash2, Info } from 'lucide-react'

const Badge = ({ children, color = 'bg-slate-100 text-slate-700' }) => (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {children}
    </span>
)

export default function CustomDeductionsList({
    customDeductions,
    onEditCustomDeduction,
    onDeleteCustomDeduction,
    onAddCustomDeductionClick
}) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Custom Deductions Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Custom & Variable Deductions</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Manage employee-specific items like Loan recovery, Fines, or Advances</p>
                    </div>
                    <button
                        onClick={onAddCustomDeductionClick}
                        className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-gray-200"
                    >
                        <Plus className="w-4 h-4" /><span>Add Deduction</span>
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deduction Type</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Period</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {customDeductions.map((deduction) => (
                                <tr key={deduction.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div>
                                            <div className="font-semibold text-slate-800">
                                                {deduction.employee?.first_name} {deduction.employee?.last_name}
                                            </div>
                                            <div className="text-xs text-gray-400 font-medium mt-0.5">
                                                {deduction.employee?.employee_id}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">{deduction.deduction_type}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-700">
                                        ₹{deduction.amount?.toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={deduction.reason}>
                                        {deduction.reason || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">
                                        <div className="font-medium">{deduction.start_date}</div>
                                        {deduction.is_recurring && <div className="text-blue-500 mt-0.5">Recurring</div>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge
                                            color={
                                                deduction.status === 'Active'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                    : 'bg-gray-100 text-gray-500'
                                            }
                                        >
                                            {deduction.status}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onEditCustomDeduction(deduction)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteCustomDeduction(deduction.id)}
                                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {customDeductions.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                                        <Info className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                                        <p>No custom deductions found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
