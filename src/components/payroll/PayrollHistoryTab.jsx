import React from 'react'
import { FileText, Eye, ChevronRight } from 'lucide-react'
import { TableSkeleton } from '../ui/SkeletonLoader'

const Badge = ({ children, color = 'bg-slate-100 text-slate-700' }) => (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${color}`}>
        {children}
    </span>
)

export default function PayrollHistoryTab({
    history,
    selectedRun,
    setSelectedRun,
    runItems,
    runLoading,
    reversingRun,
    handleReversePayrollRun,
    fetchRunItems,
    formatCurrency,
    onViewPayslip
}) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!selectedRun ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center space-x-2">
                            <FileText className="w-5 h-5 text-slate-700" />
                            <h3 className="text-lg font-bold text-slate-800">Payroll History</h3>
                        </div>
                    </div>
                    {history && history.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Period</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Run Type</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employees</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total Amount</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date Processed</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {history.map((run) => (
                                        <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800">
                                                {new Date(run.month_year).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge
                                                    color={
                                                        run.run_type === 'bonus'
                                                            ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                                            : run.run_type === 'off_cycle'
                                                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                                                    }
                                                >
                                                    {run.run_type === 'bonus' ? 'Bonus' : run.run_type === 'off_cycle' ? 'Off-Cycle' : 'Regular'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{run.total_employees}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-emerald-600">{formatCurrency(run.total_amount)}</td>
                                            <td className="px-6 py-4">
                                                <Badge color={run.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}>
                                                    {run.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(run.processed_at || run.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => fetchRunItems(run)}
                                                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-900 hover:text-white transition-all font-bold text-xs"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>View Details</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-500 italic">No payroll history found.</div>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setSelectedRun(null)}
                                className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
                            >
                                <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                                Back to History
                            </button>
                            {selectedRun.status !== 'Reversed' && (
                                <button
                                    onClick={() => handleReversePayrollRun(selectedRun.id)}
                                    disabled={reversingRun}
                                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 disabled:opacity-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                                >
                                    {reversingRun ? 'Reversing...' : 'Reverse Payroll Run'}
                                </button>
                            )}
                        </div>
                        <div className="text-right">
                            <h3 className="text-lg font-bold text-slate-800">
                                {new Date(selectedRun.month_year).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                            </h3>
                            <p className="text-xs text-slate-400">Payroll run ID: {selectedRun.id.slice(0, 8)}</p>
                        </div>
                    </div>

                    {runLoading ? (
                        <TableSkeleton rows={5} cols={3} />
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Net Salary</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {runItems.map((item) => (
                                        <tr key={item.empId} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800">{item.name}</div>
                                                <div className="text-xs text-gray-500">{item.designation}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatCurrency(item.netSalary)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => onViewPayslip(item)}
                                                    className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                                                    title="View Payslip"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
