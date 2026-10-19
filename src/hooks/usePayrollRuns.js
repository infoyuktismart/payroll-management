import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payrollService } from '../services/payrollService'
import { toast } from 'react-hot-toast'

export const usePayrollRuns = () => {
    return useQuery({
        queryKey: ['payrollRuns'],
        queryFn: async () => {
            try {
                return await payrollService.getPayrollRuns()
            } catch (error) {
                toast.error('Failed to load payroll runs: ' + error.message)
                throw error
            }
        }
    })
}

export const usePayrollItems = (runId) => {
    return useQuery({
        queryKey: ['payrollItems', runId],
        queryFn: async () => {
            try {
                return await payrollService.getPayrollItems(runId)
            } catch (error) {
                toast.error('Failed to load payroll items: ' + error.message)
                throw error
            }
        },
        enabled: !!runId
    })
}

export const useCreatePayrollRun = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => payrollService.createPayrollRun(payload),
        onSuccess: () => {
            toast.success('Payroll run processed successfully!')
            queryClient.invalidateQueries({ queryKey: ['payrollRuns'] })
        },
        onError: (error) => {
            toast.error('Failed to process payroll run: ' + error.message)
        }
    })
}

export const useCreatePayrollItems = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (items) => payrollService.createPayrollItems(items),
        onSuccess: () => {
            toast.success('Payroll items saved successfully!')
            queryClient.invalidateQueries({ queryKey: ['payrollItems'] })
        },
        onError: (error) => {
            toast.error('Failed to save payroll items: ' + error.message)
        }
    })
}

export const usePayrollHistoryQuery = () => {
    return useQuery({
        queryKey: ['payrollHistory'],
        queryFn: async () => {
            try {
                return await payrollService.getPayrollRuns()
            } catch (error) {
                toast.error('Failed to load payroll history: ' + error.message)
                throw error
            }
        }
    })
}

export const useDeliveryLogsQuery = (activeCompanyId) => {
    return useQuery({
        queryKey: ['deliveryLogs', activeCompanyId],
        queryFn: async () => {
            try {
                return await payrollService.getDeliveryLogs(activeCompanyId)
            } catch (error) {
                toast.error('Failed to load delivery logs: ' + error.message)
                throw error
            }
        },
        enabled: activeCompanyId !== undefined
    })
}

export const useReversePayrollMutation = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ runId, userId }) => payrollService.reversePayrollRun(runId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payrollHistory'] })
            queryClient.invalidateQueries({ queryKey: ['payrollRuns'] })
        }
    })
}

export const useFinalizePayrollMutation = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (params) => payrollService.finalizePayrollRun(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payrollHistory'] })
            queryClient.invalidateQueries({ queryKey: ['payrollRuns'] })
        }
    })
}

