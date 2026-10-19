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

export const useSalaryEmployees = () => {
    return useQuery({
        queryKey: ['salaryEmployees'],
        queryFn: async () => {
            try {
                return await salaryService.getSalaryEmployees()
            } catch (error) {
                toast.error('Failed to load salary employees: ' + error.message)
                throw error
            }
        }
    })
}

export const useUpdateEmployeeSalaryStructure = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ employeeId, updates }) => salaryService.updateEmployeeSalaryStructure({ employeeId, updates }),
        onSuccess: () => {
            toast.success('Salary structure updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['salaryStructurePage'] })
        },
        onError: (error) => {
            toast.error('Failed to update salary structure: ' + error.message)
        }
    })
}

export const useBulkSalaryRevision = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ componentName, componentCode, newValue, companyId }) =>
            salaryService.bulkSalaryRevision({ componentName, componentCode, newValue, companyId }),
        onSuccess: (data) => {
            if (data?.success) {
                const updated = data.updatedCount || 0
                toast.success(`Salaries revised successfully! Updated: ${updated} employee(s).`)
                
                if (data.warnings && data.warnings.length > 0) {
                    const warningNames = data.warnings.map(w => `${w.name} (${w.reason})`).join(', ')
                    toast(`Skipped ${data.warnings.length} employee(s) due to flat adjustments constraint: ${warningNames}`, {
                        icon: '⚠️',
                        duration: 8000
                    })
                }
            } else {
                toast.error(data?.error || 'Bulk revision sync response was unsuccessful.')
            }
            queryClient.invalidateQueries({ queryKey: ['salaryStructurePage'] })
            queryClient.invalidateQueries({ queryKey: ['salaryComponents'] })
        },
        onError: (error) => {
            toast.error('Bulk revision failed: ' + error.message)
        }
    })
}

export const useSalaries = ({ employeeId, isAdmin } = {}) => {
    return useQuery({
        queryKey: ['salaries', { employeeId, isAdmin }],
        queryFn: async () => {
            try {
                return await salaryService.getSalaries({ employeeId, isAdmin })
            } catch (error) {
                toast.error('Failed to load salaries list: ' + error.message)
                throw error
            }
        }
    })
}

export const useCreateSalaryPayment = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => salaryService.createSalaryPayment(payload),
        onSuccess: () => {
            toast.success('Salary payment processed successfully!')
            queryClient.invalidateQueries({ queryKey: ['salaries'] })
        },
        onError: (error) => {
            toast.error('Failed to process salary payment: ' + error.message)
        }
    })
}
