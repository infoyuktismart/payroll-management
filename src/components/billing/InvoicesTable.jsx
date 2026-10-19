import React from 'react'

function InvoiceStatusBadge({ status, size = 'default' }) {
    const configs = {
        draft: { color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Draft' },
        issued: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Issued' },
        paid: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Paid' },
        overdue: { color: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Overdue' },
        void: { color: 'bg-slate-100 text-slate-400 border-slate-200 line-through', label: 'Void' },
        waived: { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Waived' }
    }

    const { color, label } = configs[status] || configs.draft
    const sizeClasses = size === 'large' ? 'px-3.5 py-1.5 text-sm font-black' : 'px-2 py-0.5 text-[10px]'

    return (
        <span className={`inline-flex items-center rounded-lg border font-black uppercase tracking-wider ${sizeClasses} ${color}`}>
            {label}
        </span>
    )
}

export default function InvoicesTable({
    invoices,
    onViewDetails,
    onIssue,
    onVoid,
    onPayOnline,
    onMarkPaid,
    payingOnline,
    formatCurrency
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-black text-slate-900 text-lg flex items-center gap-2">
                    {/* Placeholder icon placeholder replaced in parent */}
                    Invoices History
                </h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Invoice Number</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Billing Period</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Staff Count</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Subtotal</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Total (+GST)</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Payment Status</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-6 py-12 text-center text-sm text-slate-500">
                                    No billing invoices found. Set start/end date above to generate your first invoice.
                                </td>
                            </tr>
                        ) : invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/50">
                                <td className="px-6 py-4 font-black text-slate-900 text-sm">
                                    <button 
                                        type="button"
                                        onClick={() => onViewDetails(inv)} 
                                        className="text-blue-600 hover:underline hover:text-blue-800 text-left font-black cursor-pointer bg-transparent border-none p-0"
                                    >
                                        {inv.invoice_number}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                                    {new Date(inv.billing_period_start).toLocaleDateString('en-IN', {day:'numeric', month:'short'})} - {new Date(inv.billing_period_end).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}
                                    <span className="block text-[10px] font-bold text-slate-400 mt-0.5">
                                        {inv.billing_model === 'per_employee' ? 'Per Employee (PEPM)' : 'Flat Monthly Plan'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-800">
                                    {inv.employee_count} active
                                </td>
                                <td className="px-6 py-4 text-sm font-semibold text-slate-600">
                                    {formatCurrency(inv.subtotal)}
                                </td>
                                <td className="px-6 py-4 text-sm font-black text-slate-950">
                                    {formatCurrency(inv.total_amount)}
                                </td>
                                <td className="px-6 py-4 text-xs font-bold">
                                    <InvoiceStatusBadge status={inv.status} />
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    {inv.status === 'draft' && (
                                        <>
                                            <button 
                                                type="button"
                                                onClick={() => onIssue(inv.id)} 
                                                className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer"
                                            >
                                                Issue
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => onVoid(inv.id)} 
                                                className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-slate-400 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                                            >
                                                Void
                                            </button>
                                        </>
                                    )}
                                    {(inv.status === 'issued' || inv.status === 'overdue') && (
                                        <>
                                            <button 
                                                type="button"
                                                onClick={() => onPayOnline(inv)} 
                                                disabled={payingOnline}
                                                className="inline-flex items-center px-2.5 py-1 text-xs font-black text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer disabled:opacity-50"
                                            >
                                                {payingOnline ? 'Processing...' : 'Pay Online'}
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => onMarkPaid(inv)} 
                                                className="inline-flex items-center px-2.5 py-1 text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer"
                                            >
                                                Mark Paid
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => onVoid(inv.id)} 
                                                className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-slate-400 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                                            >
                                                Void
                                            </button>
                                        </>
                                    )}
                                    <button 
                                        type="button"
                                        onClick={() => onViewDetails(inv)} 
                                        className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 cursor-pointer"
                                    >
                                        View Details
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
export { InvoiceStatusBadge }
