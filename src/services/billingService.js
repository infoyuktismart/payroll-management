import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'

const emptyOnMissing = async (query, missingCodes = ['42P01', '42703']) => {
    const { data, error, count } = await query
    if (error && missingCodes.includes(error.code)) return { data: [], count: 0, missing: true }
    if (error) throw error
    return { data: data || [], count }
}

const singleOrNullOnMissing = async (query, missingCodes = ['42P01', '42703']) => {
    const { data, error } = await query
    if (error && missingCodes.includes(error.code)) return null
    if (error && error.code !== 'PGRST116') throw error
    return data || null
}

export const billingService = {
    /**
     * Fetch billing dashboard stats and recent invoices.
     */
    async getBillingDashboard() {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            if (!companyId) return { invoices: [], stats: {} }

            // Get active employees count
            const { count: activeEmployees } = await supabase
                .from('employees')
                .select('id', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .eq('status', 'active')

            // Fetch subscription plan details
            const subscription = await singleOrNullOnMissing(
                supabase
                    .from('company_subscriptions')
                    .select('*, plan:subscription_plans(*)')
                    .eq('company_id', companyId)
                    .maybeSingle()
            )

            // Fetch invoices
            let invoicesQuery = supabase
                .from('billing_invoices')
                .select('*')
                .eq('company_id', companyId)
                .order('billing_period_start', { ascending: false })

            const invoicesRes = await emptyOnMissing(invoicesQuery)
            const invoices = invoicesRes.data || []

            // Calculate aggregate stats
            let totalBilled = 0
            let totalOutstanding = 0
            let totalPaid = 0

            invoices.forEach(inv => {
                const total = Number(inv.total_amount) || 0
                if (inv.status === 'paid') {
                    totalPaid += total
                    totalBilled += total
                } else if (inv.status === 'issued' || inv.status === 'overdue') {
                    totalOutstanding += total
                    totalBilled += total
                } else if (inv.status === 'draft') {
                    // Drafts don't count towards billed/outstanding yet
                }
            })

            return {
                subscription,
                activeEmployeesCount: activeEmployees || 0,
                invoices,
                stats: {
                    totalBilled,
                    totalOutstanding,
                    totalPaid
                }
            }
        })
    },

    /**
     * Get paginated list of invoices.
     */
    async getInvoices({ page = 0, pageSize = 50, status = 'all' } = {}) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            if (!companyId) return { data: [], count: 0 }

            let query = supabase
                .from('billing_invoices')
                .select('*', { count: 'exact' })
                .eq('company_id', companyId)
                .order('billing_period_start', { ascending: false })

            if (status !== 'all') {
                query = query.eq('status', status)
            }

            const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1)
            if (error) throw error

            return {
                data: data || [],
                count: count || 0,
                page,
                pageSize,
                totalPages: Math.ceil((count || 0) / pageSize)
            }
        })
    },

    /**
     * Get details of a single invoice, including line items.
     */
    async getInvoice(invoiceId) {
        return withRetry(async () => {
            const { data: invoice, error: invError } = await supabase
                .from('billing_invoices')
                .select('*')
                .eq('id', invoiceId)
                .single()

            if (invError) throw invError

            const { data: lineItems, error: itemsError } = await supabase
                .from('billing_invoice_line_items')
                .select('*')
                .eq('invoice_id', invoiceId)
                .order('created_at', { ascending: true })

            if (itemsError) throw itemsError

            return {
                ...invoice,
                lineItems: lineItems || []
            }
        })
    },

    /**
     * Generate an invoice for a specific period and model.
     */
    async generateInvoice({ billingPeriodStart, billingPeriodEnd, billingModel = 'per_employee', customNote = '' } = {}) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            if (!companyId) throw new Error('No active company selected')

            const { data: { user } } = await supabase.auth.getUser()

            // Fetch plan details
            const subscription = await singleOrNullOnMissing(
                supabase
                    .from('company_subscriptions')
                    .select('*, plan:subscription_plans(*)')
                    .eq('company_id', companyId)
                    .maybeSingle()
            )

            if (!subscription || !subscription.plan) {
                throw new Error('No active subscription plan found for this company')
            }

            const plan = subscription.plan

            // Count active employees
            const { count: activeEmployees, error: empError } = await supabase
                .from('employees')
                .select('id', { count: 'exact', head: true })
                .eq('company_id', companyId)
                .eq('status', 'active')

            if (empError) throw empError

            const headcount = activeEmployees || 0
            const ratePerEmp = Number(plan.price_per_employee) || 0
            const flatPrice = Number(plan.monthly_price) || 0

            // Calculations
            let subtotal = 0
            let description = ''
            let quantity = 1
            let unitPrice = 0

            if (billingModel === 'per_employee') {
                subtotal = headcount * ratePerEmp
                description = `${headcount} Active Employees × ${formatCurrencyValue(ratePerEmp)}/emp/month`
                quantity = headcount
                unitPrice = ratePerEmp
            } else {
                subtotal = flatPrice
                description = `${plan.name} Plan - Flat Monthly subscription`
                quantity = 1
                unitPrice = flatPrice
            }

            const TAX_RATE = 18.00 // 18% GST
            const taxAmount = Math.round(subtotal * (TAX_RATE / 100))
            const totalAmount = subtotal + taxAmount

            // Generate invoice number
            let invoiceNumber = ''
            try {
                const { data: numData, error: numError } = await supabase.rpc('next_invoice_number')
                if (numError) throw numError
                invoiceNumber = numData
            } catch (e) {
                // Fallback number generator if RPC function is missing/fails
                const dateStr = new Date().toISOString().slice(0, 7).replace('-', '')
                const randPart = Math.floor(1000 + Math.random() * 9000)
                invoiceNumber = `INV-${dateStr}-${randPart}`
            }

            // Create Invoice
            const invoicePayload = {
                company_id: companyId,
                subscription_id: subscription.id,
                invoice_number: invoiceNumber,
                billing_period_start: billingPeriodStart,
                billing_period_end: billingPeriodEnd,
                billing_model: billingModel,
                employee_count: headcount,
                rate_per_employee: ratePerEmp,
                flat_amount: flatPrice,
                subtotal: subtotal,
                tax_rate: TAX_RATE,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                status: 'draft',
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 7 days due date
                notes: customNote || null,
                generated_by: user?.id || null
            }

            const { data: invoice, error: createInvError } = await supabase
                .from('billing_invoices')
                .insert([invoicePayload])
                .select()
                .single()

            if (createInvError) throw createInvError

            // Create Line Items
            const lineItemPayload = {
                invoice_id: invoice.id,
                description,
                quantity,
                unit_price: unitPrice,
                line_total: subtotal
            }

            const { error: createItemError } = await supabase
                .from('billing_invoice_line_items')
                .insert([lineItemPayload])

            if (createItemError) throw createItemError

            return invoice
        })
    },

    /**
     * Mark an invoice as paid.
     */
    async markInvoicePaid({ invoiceId, paymentReference, paidAt } = {}) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('billing_invoices')
                .update({
                    status: 'paid',
                    payment_reference: paymentReference || null,
                    paid_at: paidAt || new Date().toISOString()
                })
                .eq('id', invoiceId)
                .select()
                .single()

            if (error) throw error
            return data
        })
    },

    /**
     * Issue draft invoice (moves draft to issued).
     */
    async issueInvoice(invoiceId) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('billing_invoices')
                .update({ status: 'issued' })
                .eq('id', invoiceId)
                .select()
                .single()

            if (error) throw error
            return data
        })
    },

    /**
     * Void an invoice.
     */
    async voidInvoice(invoiceId) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('billing_invoices')
                .update({ status: 'void' })
                .eq('id', invoiceId)
                .select()
                .single()

            if (error) throw error
            return data
        })
    },

    /**
     * Update invoice notes.
     */
    async updateInvoiceNotes({ invoiceId, notes }) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('billing_invoices')
                .update({ notes })
                .eq('id', invoiceId)
                .select()
                .single()

            if (error) throw error
            return data
        })
    },

    /**
     * Create a Razorpay order for an invoice via Edge Function.
     */
    async createRazorpayOrder(invoiceId) {
        return withRetry(async () => {
            const { data, error } = await supabase.functions.invoke('razorpay-checkout', {
                body: {
                    action: 'create_order',
                    invoice_id: invoiceId
                }
            })
            if (error) throw error
            return data
        })
    },

    /**
     * Verify Razorpay payment signature via Edge Function.
     */
    async verifyRazorpayPayment({ invoiceId, razorpayPaymentId, razorpayOrderId, razorpaySignature }) {
        return withRetry(async () => {
            const { data, error } = await supabase.functions.invoke('razorpay-checkout', {
                body: {
                    action: 'verify_payment',
                    invoice_id: invoiceId,
                    razorpay_payment_id: razorpayPaymentId,
                    razorpay_order_id: razorpayOrderId,
                    razorpay_signature: razorpaySignature
                }
            })
            if (error) throw error
            return data
        })
    }
}

// Inline helper for formatting currencies in text
function formatCurrencyValue(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(Number(amount) || 0)
}
