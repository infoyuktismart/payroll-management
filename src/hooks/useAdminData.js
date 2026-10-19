import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminService } from '../services/adminService'
import { getActiveCompanyId } from '../services/tenantScope'
import { toast } from 'react-hot-toast'

// Query Key Factory for robust cache management and type safety.
// Scoping query keys by activeCompanyId guarantees strict tenant isolation.
export const adminKeys = {
    all: ['adminSettings'],
    settings: (companyId = getActiveCompanyId()) => [...adminKeys.all, companyId || 'all-companies'],
}

/**
 * Hook to retrieve organizational settings, policies, and recent logs.
 */
export const useAdminSettings = () => {
    const companyId = getActiveCompanyId()
    return useQuery({
        queryKey: adminKeys.settings(companyId),
        queryFn: async () => {
            try {
                return await adminService.getAdminSettings()
            } catch (error) {
                toast.error('Failed to load admin settings: ' + error.message)
                throw error
            }
        }
    })
}

/**
 * Mutation hook to create a new department.
 */
export const useAddDepartment = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (name) => adminService.addDepartment(name),
        onSuccess: () => {
            toast.success('Department added successfully!')
            queryClient.invalidateQueries({ queryKey: adminKeys.all })
        },
        onError: (error) => {
            toast.error('Failed to add department: ' + error.message)
        }
    })
}

/**
 * Mutation hook to register a new company holiday.
 */
export const useAddHoliday = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ name, date }) => adminService.addHoliday({ name, date }),
        onSuccess: () => {
            toast.success('Holiday added successfully!')
            queryClient.invalidateQueries({ queryKey: adminKeys.all })
        },
        onError: (error) => {
            toast.error('Failed to add holiday: ' + error.message)
        }
    })
}

/**
 * Mutation hook to establish a new leave policy rule.
 */
export const useAddLeavePolicy = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ leaveType, annualBalance }) => adminService.addLeavePolicy({ leaveType, annualBalance }),
        onSuccess: () => {
            toast.success('Leave policy added successfully!')
            queryClient.invalidateQueries({ queryKey: adminKeys.all })
        },
        onError: (error) => {
            toast.error('Failed to add leave policy: ' + error.message)
        }
    })
}

/**
 * Mutation hook to remove an admin configuration row dynamically.
 */
export const useRemoveAdminRow = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ table, id }) => adminService.removeAdminRow({ table, id }),
        onSuccess: () => {
            toast.success('Record removed successfully!')
            queryClient.invalidateQueries({ queryKey: adminKeys.all })
        },
        onError: (error) => {
            toast.error('Failed to remove record: ' + error.message)
        }
    })
}

/**
 * Mutation hook to initialize year-end or initial leave balances.
 */
export const useInitializeLeaveBalances = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (year) => adminService.initializeLeaveBalances(year),
        onSuccess: () => {
            toast.success('Leave balances initialized successfully!')
            queryClient.invalidateQueries({ queryKey: adminKeys.all })
        },
        onError: (error) => {
            toast.error('Failed to initialize leave balances: ' + error.message)
        }
    })
}
