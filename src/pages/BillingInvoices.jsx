import { useEffect, useState, useMemo } from 'react'
import { 
    Receipt, 
    Calendar, 
    Users, 
    CreditCard, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    TrendingUp, 
    RefreshCw, 
    Save, 
    FileText, 
    ArrowRight, 
    DollarSign,
    Check,
    X,
    Printer,
    FileSpreadsheet,
    Plus
} from 'lucide-react'
import { billingService } from '../services/billingService'
import { formatCurrency } from '../lib/payrollUtils'
import { useToast } from '../context/ToastContext'

export default function BillingInvoices() {
    const toast = useToast()
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [data, setData] = useState({ subscription: null, activeEmployeesCount: 0, invoices: [], stats: { totalBilled: 0, totalOutstanding: 0, totalPaid: 0 } })
    const [selectedInvoice, setSelectedInvoice] = useState(null)
    const [viewingDetail, setViewingDetail] = useState(false)
    const [payingOnline, setPayingOnline] = useState(false)
    
    // Payment confirmation modal form state
    const [payingInvoice, setPayingInvoice] = useState(null)
    const [payForm, setPayForm] = useState({ paymentReference: '', paidAt: new Date().toISOString().slice(0, 16) })

    // Invoice generator states
    const [genForm, setGenForm] = useState({
        billingPeriodStart: '',
        billingPeriodEnd: '',
        billingModel: 'per_employee',
        notes: ''
    })

    // Init dates for generator form (default to previous month)
    useEffect(() => {
        const d = new Date()
        // Month start
        const start = new Date(d.getFullYear(), d.getMonth() - 1, 1)
        const end = new Date(d.getFullYear(), d.getMonth(), 0) // last day of previous month
        
        setGenForm(prev => ({
            ...prev,
            billingPeriodStart: start.toISOString().slice(0, 10),
            billingPeriodEnd: end.toISOString().slice(0, 10)
        }))
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const res = await billingService.getBillingDashboard()
            setData(res)
            if (res.subscription) {
                setGenForm(prev => ({
                    ...prev,
                    billingModel: res.subscription.billing_model || 'per_employee'
                }))
            }
        } catch (error) {
            toast.error(`Failed to load billing: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const currentPlan = data.subscription?.plan || null

    // Real-time invoice estimation values for the user
    const liveEstimate = useMemo(() => {
        if (!currentPlan) return { subtotal: 0, tax: 0, total: 0 }
        const empCount = data.activeEmployeesCount
        const rate = Number(currentPlan.price_per_employee) || 0
        const flat = Number(currentPlan.monthly_price) || 0

        const subtotal = genForm.billingModel === 'per_employee' ? (empCount * rate) : flat
        const tax = Math.round(subtotal * 0.18) // 18% GST
        const total = subtotal + tax

        return { subtotal, tax, total, empCount, rate, flat }
    }, [currentPlan, genForm.billingModel, data.activeEmployeesCount])

    const handleGenerate = async (e) => {
        e.preventDefault()
        if (!genForm.billingPeriodStart || !genForm.billingPeriodEnd) {
            toast.warning('Please select both start and end dates.')
            return
        }

        setGenerating(true)
        try {
            await billingService.generateInvoice({
                billingPeriodStart: genForm.billingPeriodStart,
                billingPeriodEnd: genForm.billingPeriodEnd,
                billingModel: genForm.billingModel,
                customNote: genForm.notes
            })
            toast.success('Draft invoice generated successfully!')
            await loadData()
            setGenForm(prev => ({ ...prev, notes: '' }))
        } catch (e) {
            toast.error(`Failed to generate: ${e.message}`)
        } finally {
            setGenerating(false)
        }
    }

    const handleIssue = async (invId) => {
        try {
            await billingService.issueInvoice(invId)
            toast.success('Invoice issued successfully.')
            await loadData()
        } catch (error) {
            toast.error(`Issue failed: ${error.message}`)
        }
    }

    const handleVoid = async (invId) => {
        if (!window.confirm('Are you sure you want to void this invoice? This action is permanent.')) return
        try {
            await billingService.voidInvoice(invId)
            toast.success('Invoice marked as void.')
            await loadData()
        } catch (error) {
            toast.error(`Void failed: ${error.message}`)
        }
    }

    const submitPayment = async (e) => {
        e.preventDefault()
        try {
            await billingService.markInvoicePaid({
                invoiceId: payingInvoice.id,
                paymentReference: payForm.paymentReference,
                paidAt: new Date(payForm.paidAt).toISOString()
            })
            toast.success('Invoice marked as paid!')
            setPayingInvoice(null)
            setPayForm({ paymentReference: '', paidAt: new Date().toISOString().slice(0, 16) })
            await loadData()
        } catch (error) {
            toast.error(`Failed to mark paid: ${error.message}`)
        }
    }

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true)
                return
            }
            const script = document.createElement('script')
            script.src = 'https://checkout.razorpay.com/v1/checkout.js'
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.body.appendChild(script)
        })
    }

    const handlePayOnline = async (invoice) => {
        setPayingOnline(true)
        try {
            const loaded = await loadRazorpayScript()
            if (!loaded) {
                toast.error('Failed to load Razorpay SDK. Please check your network.')
                return
            }

            // 1. Create order on Edge Function
            const orderData = await billingService.createRazorpayOrder(invoice.id)
            if (!orderData || !orderData.order_id) {
                throw new Error('Order creation returned an invalid response.')
            }

            // If it is a mock order (sandbox / developer fallback), auto-verify
            if (orderData.is_mock) {
                toast.info('Mock gateway triggered. Instantly auto-verifying payment...', { duration: 4000 })
                const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(2, 11)}`
                const mockSignature = `sig_mock_${Math.random().toString(36).substring(2, 11)}`
                
                const verifyRes = await billingService.verifyRazorpayPayment({
                    invoiceId: invoice.id,
                    razorpayPaymentId: mockPaymentId,
                    razorpayOrderId: orderData.order_id,
                    razorpaySignature: mockSignature
                })

                if (verifyRes.success) {
                    toast.success('Mock Payment succeeded! Subscription activated.')
                    await loadData()
                    setViewingDetail(false)
                    setSelectedInvoice(null)
                } else {
                    toast.error('Mock verification failed.')
                }
                return
            }

            // 2. Setup checkout options for real Razorpay script
            const options = {
                key: orderData.key_id,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'InfoYukti Solutions',
                description: `Invoice: ${invoice.invoice_number}`,
                order_id: orderData.order_id,
                handler: async function (response) {
                    setPayingOnline(true)
                    try {
                        const verifyRes = await billingService.verifyRazorpayPayment({
                            invoiceId: invoice.id,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpayOrderId: response.razorpay_order_id,
                            razorpaySignature: response.razorpay_signature
                        })

                        if (verifyRes.success) {
                            toast.success('Payment completed successfully!')
                            await loadData()
                            setViewingDetail(false)
                            setSelectedInvoice(null)
                        } else {
                            toast.error('Verification failed. Payment not captured.')
                        }
                    } catch (err) {
                        toast.error(`Verification failed: ${err.message}`)
                    } finally {
                        setPayingOnline(false)
                    }
                },
                prefill: {
                    name: data.subscription?.company_name || '',
                    email: data.subscription?.contact_email || ''
                },
                theme: {
                    color: '#0f172a'
                },
                modal: {
                    ondismiss: function() {
                        toast.info('Payment window closed.')
                    }
                }
            }

            const rzp = new window.Razorpay(options)
            rzp.on('payment.failed', function (resp) {
                toast.error(`Payment failed: ${resp.error.description}`)
            })
            rzp.open()
        } catch (error) {
            toast.error(`Payment failed: ${error.message}`)
        } finally {
            setPayingOnline(false)
        }
    }

    const viewInvoice = async (inv) => {
        try {
            const detailed = await billingService.getInvoice(inv.id)
            setSelectedInvoice(detailed)
            setViewingDetail(true)
        } catch (error) {
            toast.error(`Failed to fetch details: ${error.message}`)
        }
    }

    const printInvoice = () => {
        window.print()
    }

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                        <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">Billing & Invoices</h1>
                        <p className="text-sm text-slate-500">Manage dynamically calculated per-employee monthly invoices, flat charges, and billing statements.</p>
                    </div>
                </div>
                <button onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Stats
                </button>
            </div>

            {/* Aggregated KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Paid</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">{formatCurrency(data.stats.totalPaid)}</p>
                        <p className="text-xs text-slate-500">Revenue collected</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Outstanding</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">{formatCurrency(data.stats.totalOutstanding)}</p>
                        <p className="text-xs text-slate-500">Awaiting payment</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Headcount Rate</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">{data.activeEmployeesCount} Active</p>
                        <p className="text-xs text-slate-500">
                            {currentPlan ? `₹${currentPlan.price_per_employee || 0}/emp/mo rate` : 'No plan active'}
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Plan</p>
                        <p className="text-lg font-black text-slate-900 mt-0.5">{currentPlan?.name || 'Starter Plan'}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white uppercase tracking-wider mt-1">
                            {data.subscription?.billing_model === 'per_employee' ? 'PEPM Model' : 'Flat Plan'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Split Panel: Generate Invoice & Active Plan Preview */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
                
                {/* Panel 1: Dynamic Invoice Generator */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
                        <Calendar className="w-5 h-5 text-slate-500" />
                        Monthly Billing Invoice Generator
                    </h2>
                    
                    <form onSubmit={handleGenerate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Period Start Date</label>
                                <input 
                                    type="date" 
                                    value={genForm.billingPeriodStart}
                                    onChange={e => setGenForm(p => ({ ...p, billingPeriodStart: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900 bg-slate-50"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Period End Date</label>
                                <input 
                                    type="date" 
                                    value={genForm.billingPeriodEnd}
                                    onChange={e => setGenForm(p => ({ ...p, billingPeriodEnd: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900 bg-slate-50"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Billing Calculation Model</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className={`border rounded-xl p-4 flex items-start gap-3 cursor-pointer transition ${genForm.billingModel === 'per_employee' ? 'border-blue-500 bg-blue-50/40' : 'border-slate-100 hover:border-slate-300 bg-white'}`}>
                                    <input 
                                        type="radio" 
                                        name="billingModel" 
                                        value="per_employee" 
                                        checked={genForm.billingModel === 'per_employee'} 
                                        onChange={e => setGenForm(p => ({ ...p, billingModel: e.target.value }))}
                                        className="mt-1"
                                    />
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Per Employee (Yukti Smart HRMS)</p>
                                        <p className="text-xs text-slate-500 mt-1">₹{currentPlan?.price_per_employee || 129}/employee/month based on active headcount.</p>
                                    </div>
                                </label>
                                
                                <label className={`border rounded-xl p-4 flex items-start gap-3 cursor-pointer transition ${genForm.billingModel === 'flat' ? 'border-blue-500 bg-blue-50/40' : 'border-slate-100 hover:border-slate-300 bg-white'}`}>
                                    <input 
                                        type="radio" 
                                        name="billingModel" 
                                        value="flat" 
                                        checked={genForm.billingModel === 'flat'} 
                                        onChange={e => setGenForm(p => ({ ...p, billingModel: e.target.value }))}
                                        className="mt-1"
                                    />
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Flat Monthly Plan</p>
                                        <p className="text-xs text-slate-500 mt-1">₹{currentPlan?.monthly_price || 7999}/mo fixed rate regardless of employee cap.</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Invoice Notes / Internal Comments (Optional)</label>
                            <textarea 
                                value={genForm.notes}
                                onChange={e => setGenForm(p => ({ ...p, notes: e.target.value }))}
                                placeholder="E.g., Special discount applied, manual adjustments"
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 min-h-[60px]"
                            />
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={generating || !currentPlan}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm px-6 py-3 cursor-pointer disabled:opacity-50"
                            >
                                <Plus className="w-4 h-4" />
                                {generating ? 'Generating...' : 'Generate Draft Invoice'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Panel 2: Real-time Live Estimate Preview */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 text-white p-6 flex flex-col justify-between shadow-lg">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Live Period Estimate</h3>
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-blue-500 text-white rounded">Preview</span>
                        </div>

                        <div className="space-y-3.5 mb-6">
                            <div className="flex items-center justify-between text-sm text-slate-300">
                                <span>Plan Tier:</span>
                                <span className="font-bold text-white">{currentPlan?.name || 'Active Plan'}</span>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm text-slate-300">
                                <span>Headcount Source:</span>
                                <span className="font-bold text-white">{liveEstimate.empCount} Active Staff</span>
                            </div>

                            <div className="flex items-center justify-between text-sm text-slate-300">
                                <span>Calculation formula:</span>
                                <span className="font-bold text-white">
                                    {genForm.billingModel === 'per_employee' 
                                        ? `${liveEstimate.empCount} × ₹${liveEstimate.rate}` 
                                        : `₹${liveEstimate.flat} Flat`
                                    }
                                </span>
                            </div>

                            <div className="border-t border-slate-800 my-2 pt-2 flex items-center justify-between text-sm text-slate-300">
                                <span>Subtotal Charge:</span>
                                <span className="font-bold text-white">{formatCurrency(liveEstimate.subtotal)}</span>
                            </div>

                            <div className="flex items-center justify-between text-sm text-slate-300">
                                <span>Tax amount (18% GST):</span>
                                <span className="font-bold text-white">{formatCurrency(liveEstimate.tax)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-800 pt-4 mt-auto">
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Invoice Cost</p>
                                <p className="text-3xl font-black text-blue-400 mt-1">{formatCurrency(liveEstimate.total)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoices History Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-black text-slate-900 text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5 text-slate-500" />
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
                            {data.invoices.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-sm text-slate-500">
                                        No billing invoices found. Set start/end date above to generate your first invoice.
                                    </td>
                                </tr>
                            ) : data.invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-black text-slate-900 text-sm">
                                        <button onClick={() => viewInvoice(inv)} className="text-blue-600 hover:underline hover:text-blue-800 text-left font-black cursor-pointer">
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
                                                    onClick={() => handleIssue(inv.id)} 
                                                    className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer"
                                                >
                                                    Issue
                                                </button>
                                                <button 
                                                    onClick={() => handleVoid(inv.id)} 
                                                    className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-slate-400 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                                                >
                                                    Void
                                                </button>
                                            </>
                                        )}
                                        {(inv.status === 'issued' || inv.status === 'overdue') && (
                                            <>
                                                <button 
                                                    onClick={() => handlePayOnline(inv)} 
                                                    disabled={payingOnline}
                                                    className="inline-flex items-center px-2.5 py-1 text-xs font-black text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer disabled:opacity-50"
                                                >
                                                    {payingOnline ? 'Processing...' : 'Pay Online'}
                                                </button>
                                                <button 
                                                    onClick={() => setPayingInvoice(inv)} 
                                                    className="inline-flex items-center px-2.5 py-1 text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer"
                                                >
                                                    Mark Paid
                                                </button>
                                                <button 
                                                    onClick={() => handleVoid(inv.id)} 
                                                    className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-slate-400 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                                                >
                                                    Void
                                                </button>
                                            </>
                                        )}
                                        <button 
                                            onClick={() => viewInvoice(inv)} 
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

            {/* Payment capture inline modal */}
            {payingInvoice && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <h3 className="font-black text-slate-900 text-lg">Mark Invoice as Paid</h3>
                            <button onClick={() => setPayingInvoice(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={submitPayment} className="space-y-4">
                            <div>
                                <p className="text-sm font-semibold text-slate-600">Invoice Reference:</p>
                                <p className="text-base font-black text-slate-900 mt-0.5">{payingInvoice.invoice_number} ({formatCurrency(payingInvoice.total_amount)})</p>
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
                                    onClick={() => setPayingInvoice(null)} 
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
            )}

            {/* In-depth Printable Invoice Modal Detail View */}
            {viewingDetail && selectedInvoice && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden print:my-0 print:shadow-none print:border-none">
                        
                        {/* Printable invoice controls header */}
                        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:hidden">
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-wider text-slate-400">Invoice Details</h3>
                                <p className="text-base font-black mt-0.5">{selectedInvoice.invoice_number}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={printInvoice} 
                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 cursor-pointer"
                                >
                                    <Printer className="w-4 h-4" />
                                    Print Invoice
                                </button>
                                <button 
                                    onClick={() => { setViewingDetail(false); setSelectedInvoice(null) }} 
                                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer text-slate-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Tax invoice printable layout */}
                        <div className="p-8 md:p-12 print:p-0 space-y-8" id="printable-tax-invoice">
                            
                            {/* Title & Badge */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                                <div>
                                    <h1 className="text-3xl font-black tracking-tight text-slate-900">TAX INVOICE</h1>
                                    <p className="text-sm text-slate-500 mt-1">Invoice Ref: <span className="font-bold text-slate-700">{selectedInvoice.invoice_number}</span></p>
                                </div>
                                <div className="text-left md:text-right">
                                    <span className="print:hidden">
                                        <InvoiceStatusBadge status={selectedInvoice.status} size="large" />
                                    </span>
                                    <p className="text-xs font-bold text-slate-400 mt-2">DUE DATE</p>
                                    <p className="text-sm font-black text-slate-900">{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString('en-IN', {day:'numeric', month:'long', year:'numeric'}) : '-'}</p>
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
                                    <p className="font-black text-slate-900 text-base">{data.subscription?.company_name || 'Client Corporate Partner'}</p>
                                    <p className="text-slate-500 mt-1">Registered Tenant: <span className="font-bold">{data.subscription?.company_id || 'Active Tenant ID'}</span></p>
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
                                        {new Date(selectedInvoice.billing_period_start).toLocaleDateString('en-IN', {month:'short', year:'numeric'})}
                                    </p>
                                </div>
                                <div>
                                    <p className="font-black text-slate-400 uppercase">Generation Model</p>
                                    <p className="font-bold text-slate-900 mt-1">
                                        {selectedInvoice.billing_model === 'per_employee' ? 'Per Employee (PEPM)' : 'Flat rate plan'}
                                    </p>
                                </div>
                                <div>
                                    <p className="font-black text-slate-400 uppercase">Staff Headcount</p>
                                    <p className="font-bold text-slate-900 mt-1">{selectedInvoice.employee_count} Active Staff</p>
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
                                        {selectedInvoice.lineItems.map(item => (
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
                                    {selectedInvoice.notes && (
                                        <div className="mt-3 p-2 bg-slate-50 rounded border border-slate-100 text-slate-700">
                                            <span className="font-black block uppercase text-[9px] text-slate-400">Internal Comment:</span>
                                            {selectedInvoice.notes}
                                        </div>
                                    )}
                                </div>

                                <div className="w-full md:w-80 space-y-2 text-sm border-t md:border-t-0 pt-4 md:pt-0">
                                    <div className="flex items-center justify-between text-slate-600">
                                        <span>Subtotal:</span>
                                        <span className="font-bold">{formatCurrency(selectedInvoice.subtotal)}</span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between text-slate-600">
                                        <span>GST ({Number(selectedInvoice.tax_rate)}%):</span>
                                        <span className="font-bold">{formatCurrency(selectedInvoice.tax_amount)}</span>
                                    </div>

                                    <div className="border-t border-slate-100 my-2 pt-2 flex items-center justify-between text-base font-black text-slate-950">
                                        <span>Total Payable:</span>
                                        <span className="text-xl text-blue-600">{formatCurrency(selectedInvoice.total_amount)}</span>
                                    </div>

                                    {/* UTR reference for paid invoices */}
                                    {selectedInvoice.status === 'paid' && (
                                        <div className="bg-emerald-50 text-emerald-800 rounded-lg p-3 text-xs border border-emerald-100 mt-4 space-y-1">
                                            <p className="font-black uppercase tracking-wider">Payment Received</p>
                                            <p>Reference: <span className="font-bold text-emerald-950">{selectedInvoice.payment_reference || 'N/A'}</span></p>
                                            <p>Date: <span className="font-bold text-emerald-950">{new Date(selectedInvoice.paid_at).toLocaleString('en-IN')}</span></p>
                                        </div>
                                    )}

                                    {/* Razorpay Online Checkout Action in Modal (hidden when printing) */}
                                    {(selectedInvoice.status === 'issued' || selectedInvoice.status === 'overdue') && (
                                        <div className="bg-blue-50 text-blue-800 rounded-lg p-4 text-xs border border-blue-100 mt-4 space-y-3 print:hidden">
                                            <p className="font-black uppercase tracking-wider">Online Payment Awaiting</p>
                                            <p className="text-slate-600">You can pay this invoice instantly using Credit Card, UPI, Netbanking, or Wallets via secure Razorpay checkout.</p>
                                            <button 
                                                onClick={() => handlePayOnline(selectedInvoice)}
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
                    </div>
                </div>
            )}

            {/* Custom animations styling */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-tax-invoice, #printable-tax-invoice * {
                        visibility: visible;
                    }
                    #printable-tax-invoice {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    )
}

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
