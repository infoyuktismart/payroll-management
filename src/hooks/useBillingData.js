import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { billingService } from '../services/billingService'
import { toast } from 'react-hot-toast'

export const useBillingDashboardQuery = (activeCompanyId) => {
    return useQuery({
        queryKey: ['billingDashboard', activeCompanyId],
        queryFn: async () => {
            if (!activeCompanyId) return { invoices: [], stats: {} }
            try {
                return await billingService.getBillingDashboard(activeCompanyId)
            } catch (error) {
                toast.error(`Failed to load billing: ${error.message}`)
                throw error
            }
        },
        enabled: !!activeCompanyId,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
    })
}

export const useInvoiceDetailsQuery = (invoiceId) => {
    return useQuery({
        queryKey: ['invoiceDetails', invoiceId],
        queryFn: () => billingService.getInvoice(invoiceId),
        enabled: !!invoiceId,
        staleTime: 5 * 60 * 1000,
    })
}

export const useGenerateInvoiceMutation = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ companyId, billingPeriodStart, billingPeriodEnd, billingModel, customNote }) => {
            return await billingService.generateInvoice({
                companyId,
                billingPeriodStart,
                billingPeriodEnd,
                billingModel,
                customNote
            })
        },
        onSuccess: () => {
            toast.success('Draft invoice generated successfully!')
            queryClient.invalidateQueries({ queryKey: ['billingDashboard'] })
        },
        onError: (error) => {
            toast.error(`Failed to generate: ${error.message}`)
        }
    })
}

export const useIssueInvoiceMutation = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (invoiceId) => billingService.issueInvoice(invoiceId),
        onSuccess: () => {
            toast.success('Invoice issued successfully.')
            queryClient.invalidateQueries({ queryKey: ['billingDashboard'] })
        },
        onError: (error) => {
            toast.error(`Issue failed: ${error.message}`)
        }
    })
}

export const useVoidInvoiceMutation = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (invoiceId) => billingService.voidInvoice(invoiceId),
        onSuccess: () => {
            toast.success('Invoice marked as void.')
            queryClient.invalidateQueries({ queryKey: ['billingDashboard'] })
        },
        onError: (error) => {
            toast.error(`Void failed: ${error.message}`)
        }
    })
}

export const useMarkPaidMutation = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => billingService.markInvoicePaid(payload),
        onSuccess: () => {
            toast.success('Invoice marked as paid!')
            queryClient.invalidateQueries({ queryKey: ['billingDashboard'] })
        },
        onError: (error) => {
            toast.error(`Failed to mark paid: ${error.message}`)
        }
    })
}

export const useVerifyRazorpayMutation = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => billingService.verifyRazorpayPayment(payload),
        onSuccess: (verifyRes) => {
            if (verifyRes.success) {
                toast.success('Payment completed successfully!')
                queryClient.invalidateQueries({ queryKey: ['billingDashboard'] })
            } else {
                toast.error('Verification failed. Payment not captured.')
            }
        },
        onError: (error) => {
            toast.error(`Verification failed: ${error.message}`)
        }
    })
}
