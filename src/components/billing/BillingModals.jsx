import React from 'react'
import { X, Check, Printer, CreditCard, RefreshCw } from 'lucide-react'
import { InvoiceStatusBadge } from './InvoicesTable'

export function PaymentConfirmModal({
    isOpen,
    onClose,
    invoice,
    payForm,
    setPayForm,
    onSubmit,
    formatCurrency
}) {
    if (!isOpen || !invoice) return null

    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit(e)
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <h3 className="font-black text-slate-900 text-lg">Mark Invoice as Paid</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <p className="text-sm font-semibold text-slate-600">Invoice Reference:</p>
                        <p className="text-base font-black text-slate-900 mt-0.5">{invoice.invoice_number} ({formatCurrency(invoice.total_amount)})</p>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Payment Reference / UTR Number</label>
                        <input 
                            type="text" 
                            value={payForm.paymentReference}
                            onChange={e => setPayForm(p => ({ ...p, paymentReference: e.target.value }))}
                            placeholder="E.g. IMPS120938102, HDFCBANKUTR"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:border-slate-900"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Date & Time of Payment</label>
                        <input 
                            type="datetime-local" 
                            value={payForm.paidAt}
                            onChange={e => setPayForm(p => ({ ...p, paidAt: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:border-slate-900"
                            required
                        />
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-4 py-2 text-sm font-black text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer flex items-center gap-1.5"
                        >
                            <Check className="w-4 h-4" />
                            Confirm Payment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export function InvoiceDetailModal({
    isOpen,
    onClose,
    invoice,
    isLoading,
    onPrint,
    onPayOnline,
    payingOnline,
    formatCurrency,
    subscription
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto z-50 animate-fadeIn print:p-0 print:bg-transparent">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden print:my-0 print:shadow-none print:border-none print:rounded-none">
                
                {/* Printable invoice controls header */}
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:hidden">
                    <div>
                        <h3 className="font-black text-sm uppercase tracking-wider text-slate-400">Invoice Details</h3>
                        <p className="text-base font-black mt-0.5">{isLoading ? 'Loading...' : invoice?.invoice_number}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {invoice && !isLoading && (
                            <button 
                                type="button"
                                onClick={onPrint} 
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 cursor-pointer"
                            >
                                <Printer className="w-4 h-4" />
                                Print Invoice
                            </button>
                        )}
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center gap-3 animate-pulse">
                        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                        <p className="text-sm font-bold text-slate-500">Loading invoice details...</p>
                    </div>
                ) : invoice ? (
                    /* Tax invoice printable layout */
                    <div className="p-8 md:p-12 print:p-0 space-y-8" id="printable-tax-invoice">
                        
                        {/* Title & Badge */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                            <div>
                                <h1 className="text-3xl font-black tracking-tight text-slate-900">TAX INVOICE</h1>
                                <p className="text-sm text-slate-500 mt-1">Invoice Ref: <span className="font-bold text-slate-700">{invoice.invoice_number}</span></p>
                            </div>
                            <div className="text-left md:text-right">
                                <span className="print:hidden">
                                    <InvoiceStatusBadge status={invoice.status} size="large" />
                                </span>
                                <p className="text-xs font-bold text-slate-400 mt-2">DUE DATE</p>
                                <p className="text-sm font-black text-slate-950">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN', {day:'numeric', month:'long', year:'numeric'}) : '-'}</p>
                            </div>
                        </div>

                        {/* Seller & Buyer details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Billed By (Provider)</p>
                                <p className="font-black text-slate-900 text-base">InfoYukti Solutions Pvt Ltd</p>
                                <p className="text-slate-500 mt-1">HRMS Subscriptions Department</p>
                                <p className="text-slate-500">Corporate Park, Sector 62, Noida, UP - 201301</p>
                                <p className="text-slate-500">GSTIN: 09AAACI0928J1Z2</p>
                                <p className="text-slate-500">Email: billing@infoyuktismart.com</p>
                            </div>

                            <div>
                                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Billed To (Client)</p>
                                <p className="font-black text-slate-900 text-base">{subscription?.company_name || 'Client Corporate Partner'}</p>
                                <p className="text-slate-500 mt-1">Registered Tenant: <span className="font-bold">{subscription?.company_id || 'Active Tenant ID'}</span></p>
                                <p className="text-slate-500">Registered Office Address</p>
                                <p className="text-slate-500">Country of operations: India (INR)</p>
                            </div>
                        </div>

                        {/* Invoice metadata fields */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 rounded-xl p-4 text-xs">
                            <div>
                                <p className="font-black text-slate-400 uppercase">Billing Cycle</p>
                                <p className="font-bold text-slate-900 mt-1">Monthly Statement</p>
                            </div>
                            <div>
                                <p className="font-black text-slate-400 uppercase">Billing Period</p>
                                <p className="font-bold text-slate-900 mt-1">
                                    {new Date(invoice.billing_period_start).toLocaleDateString('en-IN', {month:'short', year:'numeric'})}
                                </p>
                            </div>
                            <div>
                                <p className="font-black text-slate-400 uppercase">Generation Model</p>
                                <p className="font-bold text-slate-900 mt-1">
                                    {invoice.billing_model === 'per_employee' ? 'Per Employee (PEPM)' : 'Flat rate plan'}
                                </p>
                            </div>
                            <div>
                                <p className="font-black text-slate-400 uppercase">Staff Headcount</p>
                                <p className="font-bold text-slate-900 mt-1">{invoice.employee_count} Active Staff</p>
                            </div>
                        </div>

                        {/* Line items table */}
                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100 text-xs font-black uppercase tracking-wider text-slate-400">
                                    <tr>
                                        <th className="px-5 py-3">Item Description</th>
                                        <th className="px-5 py-3 text-right">Quantity</th>
                                        <th className="px-5 py-3 text-right">Unit Rate</th>
                                        <th className="px-5 py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {invoice.lineItems?.map(item => (
                                        <tr key={item.id}>
                                            <td className="px-5 py-4 font-bold text-slate-900">{item.description}</td>
                                            <td className="px-5 py-4 text-right font-semibold text-slate-600">{Number(item.quantity)}</td>
                                            <td className="px-5 py-4 text-right font-semibold text-slate-600">{formatCurrency(item.unit_price)}</td>
                                            <td className="px-5 py-4 text-right font-black text-slate-950">{formatCurrency(item.line_total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Aggregates calculations block */}
                        <div className="flex flex-col md:flex-row justify-between gap-6 pt-4">
                            <div className="max-w-xs text-xs text-slate-500">
                                <p className="font-bold text-slate-700 uppercase">Notes & Declarations</p>
                                <p className="mt-1 leading-relaxed">
                                    This is a computer-generated tax invoice for SaaS system subscriptions. No physical signature is required. Amount is inclusive of standard service guarantees.
                                </p>
                                {invoice.notes && (
                                    <div className="mt-3 p-2 bg-slate-50 rounded border border-slate-100 text-slate-700">
                                        <span className="font-black block uppercase text-[9px] text-slate-400">Internal Comment:</span>
                                        {invoice.notes}
                                    </div>
                                )}
                            </div>

                            <div className="w-full md:w-80 space-y-2 text-sm border-t md:border-t-0 pt-4 md:pt-0">
                                <div className="flex items-center justify-between text-slate-600">
                                    <span>Subtotal:</span>
                                    <span className="font-bold">{formatCurrency(invoice.subtotal)}</span>
                                </div>
                                
                                <div className="flex items-center justify-between text-slate-600">
                                    <span>GST ({Number(invoice.tax_rate)}%):</span>
                                    <span className="font-bold">{formatCurrency(invoice.tax_amount)}</span>
                                </div>

                                <div className="border-t border-slate-100 my-2 pt-2 flex items-center justify-between text-base font-black text-slate-950">
                                    <span>Total Payable:</span>
                                    <span className="text-xl text-blue-600">{formatCurrency(invoice.total_amount)}</span>
                                </div>

                                {/* UTR reference for paid invoices */}
                                {invoice.status === 'paid' && (
                                    <div className="bg-emerald-50 text-emerald-800 rounded-lg p-3 text-xs border border-emerald-100 mt-4 space-y-1">
                                        <p className="font-black uppercase tracking-wider">Payment Received</p>
                                        <p>Reference: <span className="font-bold text-emerald-950">{invoice.payment_reference || 'N/A'}</span></p>
                                        <p>Date: <span className="font-bold text-emerald-950">{new Date(invoice.paid_at).toLocaleString('en-IN')}</span></p>
                                    </div>
                                )}

                                {/* Razorpay Online Checkout Action in Modal (hidden when printing) */}
                                {(invoice.status === 'issued' || invoice.status === 'overdue') && (
                                    <div className="bg-blue-50 text-blue-800 rounded-lg p-4 text-xs border border-blue-100 mt-4 space-y-3 print:hidden">
                                        <p className="font-black uppercase tracking-wider">Online Payment Awaiting</p>
                                        <p className="text-slate-600">You can pay this invoice instantly using Credit Card, UPI, Netbanking, or Wallets via secure Razorpay checkout.</p>
                                        <button 
                                            type="button"
                                            onClick={() => onPayOnline(invoice)}
                                            disabled={payingOnline}
                                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-lg transition shadow-sm cursor-pointer disabled:opacity-50"
                                        >
                                            <CreditCard className="w-4 h-4 text-slate-400" />
                                            {payingOnline ? 'Processing Payment...' : `Pay Online via Razorpay`}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="p-12 text-center text-sm font-bold text-slate-500">
                        Failed to load invoice details.
                    </div>
                )}
            </div>
        </div>
    )
}
