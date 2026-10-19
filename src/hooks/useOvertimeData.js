import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { attendanceService } from '../services/attendanceService'
import { toast } from 'react-hot-toast'

export const useOvertimeRequests = ({ employeeId, isAdmin }) => {
    return useQuery({
        queryKey: ['overtimeRequests', { employeeId, isAdmin }],
        queryFn: async () => {
            try {
                return await attendanceService.getOvertimeRequests({ employeeId, isAdmin })
            } catch (error) {
                toast.error('Failed to load overtime requests: ' + error.message)
                throw error
            }
        },
        staleTime: 30 * 1000, // 30 seconds stale time
    })
}

export const useCreateOvertimeRequest = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => attendanceService.createOvertimeRequest(payload),
        onSuccess: () => {
            toast.success('Overtime request submitted successfully!')
            queryClient.invalidateQueries({ queryKey: ['overtimeRequests'] })
        },
        onError: (error) => {
            toast.error('Failed to submit overtime request: ' + error.message)
        }
    })
}

export const useUpdateOvertimeStatus = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status }) => attendanceService.updateOvertimeStatus({ id, status }),
        onSuccess: (_, variables) => {
            toast.success(`Overtime request ${variables.status} successfully!`)
            queryClient.invalidateQueries({ queryKey: ['overtimeRequests'] })
        },
        onError: (error) => {
            toast.error('Failed to update overtime status: ' + error.message)
        }
    })
}
