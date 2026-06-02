import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leaveService } from '../services/leaveService'
import { toast } from 'react-hot-toast'

export const useLeavePolicies = () => {
    return useQuery({
        queryKey: ['leavePolicies'],
        queryFn: async () => {
            try {
                return await leaveService.getLeavePolicies()
            } catch (error) {
                toast.error('Failed to load leave policies: ' + error.message)
                throw error
            }
        }
    })
}

export const useLeaves = ({ employeeId, isAdmin, page = 0, pageSize = 50 } = {}) => {
    return useQuery({
        queryKey: ['leaves', { employeeId, isAdmin }, page, pageSize],
        queryFn: async () => {
            try {
                return await leaveService.getLeaves({ employeeId, isAdmin, page, pageSize })
            } catch (error) {
                toast.error('Failed to load leave requests: ' + error.message)
                throw error
            }
        }
    })
}

export const useLeaveBalances = (employeeId, year = new Date().getFullYear()) => {
    return useQuery({
        queryKey: ['leaveBalances', employeeId, year],
        queryFn: async () => {
            try {
                return await leaveService.getLeaveBalances(employeeId, year)
            } catch (error) {
                toast.error('Failed to load leave balances: ' + error.message)
                throw error
            }
        },
        enabled: !!employeeId
    })
}

export const useLeaveApplicationsWithEmployee = () => {
    return useQuery({
        queryKey: ['leaveApplicationsWithEmployee'],
        queryFn: async () => {
            try {
                return await leaveService.getLeaveApplicationsWithEmployee()
            } catch (error) {
                toast.error('Failed to load leave applications: ' + error.message)
                throw error
            }
        }
    })
}

export const useCreateLeaveRequest = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => leaveService.createLeaveRequest(payload),
        onSuccess: (data) => {
            toast.success('Leave request submitted successfully!')
            queryClient.invalidateQueries({ queryKey: ['leaves'] })
            queryClient.invalidateQueries({ queryKey: ['leaveApplicationsWithEmployee'] })
            if (data?.employee_id) {
                queryClient.invalidateQueries({ queryKey: ['leaveBalances', data.employee_id] })
            }
        },
        onError: (error) => {
            toast.error('Failed to submit leave request: ' + error.message)
        }
    })
}

export const useUpdateLeaveStatus = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status }) => leaveService.updateLeaveStatus({ id, status }),
        onSuccess: () => {
            toast.success('Leave request status updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['leaves'] })
            queryClient.invalidateQueries({ queryKey: ['leaveApplicationsWithEmployee'] })
            queryClient.invalidateQueries({ queryKey: ['leaveBalances'] })
        },
        onError: (error) => {
            toast.error('Failed to update leave status: ' + error.message)
        }
    })
}
