import React from 'react'
import { AlertTriangle, Eye } from 'lucide-react'

const Badge = ({ children, color = 'bg-slate-100 text-slate-700' }) => (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${color}`}>
        {children}
    </span>
)

export default function PayrollCurrentTable({
    payrollData,
    formatCurrency,
    onViewPayslip,
    handleFinalize,
    loading
}) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-slate-800">Employee Payroll Details ({payrollData.length})</h3>
                <button
                    onClick={handleFinalize}
                    disabled={loading}
                    className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-75"
                >
                    {loading ? 'Finalizing...' : 'Finalize & Save'}
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Attendance</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Basic Salary</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Gross Salary</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Deductions</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Net Salary</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {payrollData.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="font-bold text-slate-800">{item.name}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{item.designation}</div>
                                        <div className="text-[10px] text-blue-600 font-mono mt-0.5">{item.empId}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="font-medium text-slate-700">{item.payableDays}</span>
                                    <span className="text-xs text-gray-400">/{item.totalDays} days</span>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-600">{formatCurrency(item.basicSalary)}</td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-800">{formatCurrency(item.grossSalary)}</td>
                                <td className="px-6 py-4 text-sm font-bold text-rose-600">
                                    {formatCurrency(item.totalDeductions)}
                                    {item.deductionsList && item.deductionsList.length > 0 && (
                                        <div className="group relative inline-block ml-1">
                                            <AlertTriangle className="w-3 h-3 text-gray-400 inline cursor-help" />
                                            <div className="hidden group-hover:block absolute bg-gray-800 text-white text-xs rounded p-2 z-50 min-w-37.5 -left-10 top-5 shadow-xl">
                                                {item.deductionsList.map((d, i) => (
                                                    <div key={i} className="flex justify-between py-0.5">
                                                        <span>{d.name}:</span>
                                                        <span>{d.amount}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-emerald-600">{formatCurrency(item.netSalary)}</td>
                                <td className="px-6 py-4">
                                    <Badge color="bg-blue-50 text-blue-700 border border-blue-100">Calculated</Badge>
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => onViewPayslip(item)}
                                        className="text-gray-400 hover:text-slate-800 transition-colors"
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
