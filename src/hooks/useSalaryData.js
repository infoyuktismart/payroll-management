import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salaryService } from '../services/salaryService'
import { toast } from 'react-hot-toast'

export const useSalaryComponents = () => {
    return useQuery({
        queryKey: ['salaryComponents'],
        queryFn: async () => {
            try {
                return await salaryService.getSalaryComponents()
            } catch (error) {
                toast.error('Failed to load salary components: ' + error.message)
                throw error
            }
        }
    })
}

export const useCreateSalaryComponent = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => salaryService.createSalaryComponent(payload),
        onSuccess: () => {
            toast.success('Salary component created successfully!')
            queryClient.invalidateQueries({ queryKey: ['salaryComponents'] })
        },
        onError: (error) => {
            toast.error('Failed to create salary component: ' + error.message)
        }
    })
}

export const useUpdateSalaryComponent = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, payload }) => salaryService.updateSalaryComponent({ id, payload }),
        onSuccess: () => {
            toast.success('Salary component updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['salaryComponents'] })
        },
        onError: (error) => {
            toast.error('Failed to update salary component: ' + error.message)
        }
    })
}

export const useDeleteSalaryComponent = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id) => salaryService.deleteSalaryComponent(id),
        onSuccess: () => {
            toast.success('Salary component deleted successfully!')
            queryClient.invalidateQueries({ queryKey: ['salaryComponents'] })
        },
        onError: (error) => {
            toast.error('Failed to delete salary component: ' + error.message)
        }
    })
}

export const useCustomDeductions = () => {
    return useQuery({
        queryKey: ['customDeductions'],
        queryFn: async () => {
            try {
                return await salaryService.getCustomDeductions()
            } catch (error) {
                toast.error('Failed to load custom deductions: ' + error.message)
                throw error
            }
        }
    })
}

export const useCreateCustomDeduction = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => salaryService.createCustomDeduction(payload),
        onSuccess: () => {
            toast.success('Custom deduction created successfully!')
            queryClient.invalidateQueries({ queryKey: ['customDeductions'] })
        },
        onError: (error) => {
            toast.error('Failed to create custom deduction: ' + error.message)
        }
    })
}

export const useUpdateCustomDeduction = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, payload }) => salaryService.updateCustomDeduction({ id, payload }),
        onSuccess: () => {
            toast.success('Custom deduction updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['customDeductions'] })
        },
        onError: (error) => {
            toast.error('Failed to update custom deduction: ' + error.message)
        }
    })
}

export const useDeleteCustomDeduction = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id) => salaryService.deleteCustomDeduction(id),
        onSuccess: () => {
            toast.success('Custom deduction deleted successfully!')
            queryClient.invalidateQueries({ queryKey: ['customDeductions'] })
        },
        onError: (error) => {
            toast.error('Failed to delete custom deduction: ' + error.message)
        }
    })
}
