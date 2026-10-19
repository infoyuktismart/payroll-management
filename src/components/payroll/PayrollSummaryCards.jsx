import React from 'react'

export default function PayrollSummaryCards({
    employeeCount,
    totalGross,
    totalNet,
    formatCurrency
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-[6px] border-l-slate-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-md group">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-500 transition-colors">
                    Total Employees
                </p>
                <p className="text-3xl font-bold text-slate-800 mt-2 transition-transform group-hover:scale-105 origin-left">
                    {employeeCount}
                </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-[6px] border-l-emerald-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-md group">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-500 transition-colors">
                    Gross Payroll
                </p>
                <p className="text-3xl font-bold text-emerald-600 mt-2 transition-transform group-hover:scale-105 origin-left">
                    {formatCurrency(totalGross)}
                </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-[6px] border-l-blue-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-md group">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-500 transition-colors">
                    Net Payable
                </p>
                <p className="text-3xl font-bold text-blue-600 mt-2 transition-transform group-hover:scale-105 origin-left">
                    {formatCurrency(totalNet)}
                </p>
            </div>
        </div>
    )
}
