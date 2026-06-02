import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminService } from '../services/adminService'
import { toast } from 'react-hot-toast'

export const useAdminSettings = () => {
    return useQuery({
        queryKey: ['adminSettings'],
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

export const useAddDepartment = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (name) => adminService.addDepartment(name),
        onSuccess: () => {
            toast.success('Department added successfully!')
            queryClient.invalidateQueries({ queryKey: ['adminSettings'] })
        },
        onError: (error) => {
            toast.error('Failed to add department: ' + error.message)
        }
    })
}

export const useAddHoliday = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ name, date }) => adminService.addHoliday({ name, date }),
        onSuccess: () => {
            toast.success('Holiday added successfully!')
            queryClient.invalidateQueries({ queryKey: ['adminSettings'] })
        },
        onError: (error) => {
            toast.error('Failed to add holiday: ' + error.message)
        }
    })
}

export const useAddLeavePolicy = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ leaveType, annualBalance }) => adminService.addLeavePolicy({ leaveType, annualBalance }),
        onSuccess: () => {
            toast.success('Leave policy added successfully!')
            queryClient.invalidateQueries({ queryKey: ['adminSettings'] })
        },
        onError: (error) => {
            toast.error('Failed to add leave policy: ' + error.message)
        }
    })
}

export const useRemoveAdminRow = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ table, id }) => adminService.removeAdminRow({ table, id }),
        onSuccess: () => {
            toast.success('Record removed successfully!')
            queryClient.invalidateQueries({ queryKey: ['adminSettings'] })
        },
        onError: (error) => {
            toast.error('Failed to remove record: ' + error.message)
        }
    })
}

export const useInitializeLeaveBalances = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (year) => adminService.initializeLeaveBalances(year),
        onSuccess: () => {
            toast.success('Leave balances initialized successfully!')
            queryClient.invalidateQueries({ queryKey: ['adminSettings'] })
        },
        onError: (error) => {
            toast.error('Failed to initialize leave balances: ' + error.message)
        }
    })
}
