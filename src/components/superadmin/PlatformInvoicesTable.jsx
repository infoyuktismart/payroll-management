import React from 'react'
import { FileText } from 'lucide-react'

export default function PlatformInvoicesTable({ invoices, formatCurrency }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-black text-slate-900 text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-500" />
                    Recent SaaS Platform Invoices
                </h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Invoice Number</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Billed Client</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Billing Period</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Staff count</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Total Billed</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Payment Status</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Created Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-12 text-center text-sm text-slate-500">
                                    No client invoices generated on the platform yet.
                                </td>
                            </tr>
                        ) : invoices.map((inv) => (
                            <tr key={inv.id}>
                                <td className="px-6 py-4 font-black text-slate-900 text-sm">
                                    {inv.invoice_number}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-800">
                                    {inv.company_name}
                                </td>
                                <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                                    {new Date(inv.billing_period_start).toLocaleDateString('en-IN', {day:'numeric', month:'short'})} - {new Date(inv.billing_period_end).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}
                                    <span className="block text-[9px] font-bold text-slate-400 mt-0.5">
                                        {inv.billing_model === 'per_employee' ? 'Per Employee (PEPM)' : 'Flat Monthly Plan'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                                    {inv.employee_count} active
                                </td>
                                <td className="px-6 py-4 text-sm font-black text-slate-950">
                                    {formatCurrency(inv.total_amount)}
                                </td>
                                <td className="px-6 py-4 text-xs">
                                    <span className={`inline-flex rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest border ${
                                        inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        inv.status === 'void' ? 'bg-slate-100 text-slate-400 border-slate-200 line-through' :
                                        inv.status === 'issued' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}>
                                        {inv.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right text-xs font-medium text-slate-500">
                                    {new Date(inv.created_at).toLocaleString('en-IN')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
