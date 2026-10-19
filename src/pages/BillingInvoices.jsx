import { useEffect, useState, useMemo } from 'react'
import { Receipt, RefreshCw } from 'lucide-react'
import { billingService } from '../services/billingService'
import { formatCurrency } from '../lib/payrollUtils'
import { useToast } from '../context/ToastContext'
import { useCompany } from '../context/CompanyContext'

// Custom Hooks
import {
    useBillingDashboardQuery,
    useInvoiceDetailsQuery,
    useGenerateInvoiceMutation,
    useIssueInvoiceMutation,
    useVoidInvoiceMutation,
    useMarkPaidMutation,
    useVerifyRazorpayMutation
} from '../hooks/useBillingData'

// Subcomponents
import BillingStats from '../components/billing/BillingStats'
import InvoiceGenerator from '../components/billing/InvoiceGenerator'
import InvoiceEstimatePreview from '../components/billing/InvoiceEstimatePreview'
import InvoicesTable from '../components/billing/InvoicesTable'
import { PaymentConfirmModal, InvoiceDetailModal } from '../components/billing/BillingModals'

export default function BillingInvoices() {
    const toast = useToast()
    const { activeCompanyId } = useCompany()

    // Query for billing dashboard
    const { 
        data: billingData = { 
            subscription: null, 
            activeEmployeesCount: 0, 
            invoices: [], 
            stats: { totalBilled: 0, totalOutstanding: 0, totalPaid: 0 } 
        }, 
        isLoading: loading,
        isFetching,
        refetch 
    } = useBillingDashboardQuery(activeCompanyId)

    // Detailed Invoice query using stateful ID
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)
    const { data: selectedInvoice = null, isLoading: invoiceDetailsLoading } = useInvoiceDetailsQuery(selectedInvoiceId)

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

    // Prefill billing model dynamically when dashboard data loads
    useEffect(() => {
        if (billingData?.subscription) {
            setGenForm(prev => ({
                ...prev,
                billingModel: billingData.subscription.billing_model || 'per_employee'
            }))
        }
    }, [billingData])

    const currentPlan = billingData.subscription?.plan || null

    // Real-time invoice estimation values for the user
    const liveEstimate = useMemo(() => {
        if (!currentPlan) return { subtotal: 0, tax: 0, total: 0, empCount: 0, rate: 0, flat: 0 }
        const empCount = billingData.activeEmployeesCount
        const rate = Number(currentPlan.price_per_employee) || 0
        const flat = Number(currentPlan.monthly_price) || 0

        const subtotal = genForm.billingModel === 'per_employee' ? (empCount * rate) : flat
        const tax = Math.round(subtotal * 0.18) // 18% GST
        const total = subtotal + tax

        return { subtotal, tax, total, empCount, rate, flat }
    }, [currentPlan, genForm.billingModel, billingData.activeEmployeesCount])

    // Mutations
    const generateInvoiceMutation = useGenerateInvoiceMutation()
    const issueInvoiceMutation = useIssueInvoiceMutation()
    const voidInvoiceMutation = useVoidInvoiceMutation()
    const markPaidMutation = useMarkPaidMutation()
    const verifyRazorpayMutation = useVerifyRazorpayMutation()

    const handleGenerate = async (e) => {
        if (e) e.preventDefault()
        if (!genForm.billingPeriodStart || !genForm.billingPeriodEnd) {
            toast.warning('Please select both start and end dates.')
            return
        }
        generateInvoiceMutation.mutate({
            companyId: activeCompanyId,
            billingPeriodStart: genForm.billingPeriodStart,
            billingPeriodEnd: genForm.billingPeriodEnd,
            billingModel: genForm.billingModel,
            customNote: genForm.notes
        }, {
            onSuccess: () => {
                setGenForm(prev => ({ ...prev, notes: '' }))
            }
        })
    }

    const handleIssue = async (invId) => {
        issueInvoiceMutation.mutate(invId)
    }

    const handleVoid = async (invId) => {
        if (!window.confirm('Are you sure you want to void this invoice? This action is permanent.')) return
        voidInvoiceMutation.mutate(invId)
    }

    const submitPayment = async (e) => {
        if (e) e.preventDefault()
        markPaidMutation.mutate({
            invoiceId: payingInvoice.id,
            paymentReference: payForm.paymentReference,
            paidAt: new Date(payForm.paidAt).toISOString()
        }, {
            onSuccess: () => {
                setPayingInvoice(null)
                setPayForm({ paymentReference: '', paidAt: new Date().toISOString().slice(0, 16) })
            }
        })
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
                
                verifyRazorpayMutation.mutate({
                    invoiceId: invoice.id,
                    razorpayPaymentId: mockPaymentId,
                    razorpayOrderId: orderData.order_id,
                    razorpaySignature: mockSignature
                }, {
                    onSuccess: () => {
                        setSelectedInvoiceId(null)
                    }
                })
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
                    verifyRazorpayMutation.mutate({
                        invoiceId: invoice.id,
                        razorpayPaymentId: response.razorpay_payment_id,
                        razorpayOrderId: response.razorpay_order_id,
                        razorpaySignature: response.razorpay_signature
                    }, {
                        onSuccess: () => {
                            setSelectedInvoiceId(null)
                        }
                    })
                },
                prefill: {
                    name: billingData.subscription?.company_name || '',
                    email: billingData.subscription?.contact_email || ''
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
                <button 
                    onClick={() => refetch()} 
                    disabled={loading || isFetching} 
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh Stats
                </button>
            </div>

            {/* Aggregated KPI Row */}
            <BillingStats 
                stats={billingData.stats}
                activeEmployeesCount={billingData.activeEmployeesCount}
                subscription={billingData.subscription}
                formatCurrency={formatCurrency}
            />

            {/* Split Panel: Generate Invoice & Active Plan Preview */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
                
                <InvoiceGenerator 
                    currentPlan={currentPlan}
                    genForm={genForm}
                    setGenForm={setGenForm}
                    onSubmit={handleGenerate}
                    generating={generateInvoiceMutation.isPending}
                />

                <InvoiceEstimatePreview 
                    currentPlan={currentPlan}
                    liveEstimate={liveEstimate}
                    billingModel={genForm.billingModel}
                    formatCurrency={formatCurrency}
                />
            </div>

            {/* Invoices History Table */}
            <InvoicesTable 
                invoices={billingData.invoices || []}
                onViewDetails={(inv) => setSelectedInvoiceId(inv.id)}
                onIssue={handleIssue}
                onVoid={handleVoid}
                onPayOnline={handlePayOnline}
                onMarkPaid={(inv) => setPayingInvoice(inv)}
                payingOnline={payingOnline || verifyRazorpayMutation.isPending}
                formatCurrency={formatCurrency}
            />

            {/* Modals */}
            <PaymentConfirmModal 
                isOpen={!!payingInvoice}
                onClose={() => setPayingInvoice(null)}
                invoice={payingInvoice}
                payForm={payForm}
                setPayForm={setPayForm}
                onSubmit={submitPayment}
                formatCurrency={formatCurrency}
            />

            <InvoiceDetailModal 
                isOpen={!!selectedInvoiceId}
                onClose={() => setSelectedInvoiceId(null)}
                invoice={selectedInvoice}
                isLoading={invoiceDetailsLoading}
                onPrint={printInvoice}
                onPayOnline={handlePayOnline}
                payingOnline={payingOnline}
                formatCurrency={formatCurrency}
                subscription={billingData.subscription}
            />

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
