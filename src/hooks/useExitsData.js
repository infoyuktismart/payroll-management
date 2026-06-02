import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { exitService } from '../services/exitService'
import { toast } from 'react-hot-toast'

export const useExits = () => {
    return useQuery({
        queryKey: ['exits'],
        queryFn: async () => {
            try {
                return await exitService.getExits()
            } catch (error) {
                toast.error('Failed to load exit records: ' + error.message)
                throw error
            }
        }
    })
}

export const useCreateExit = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => exitService.createExit(payload),
        onSuccess: () => {
            toast.success('Exit process initiated successfully!')
            queryClient.invalidateQueries({ queryKey: ['exits'] })
        },
        onError: (error) => {
            toast.error('Failed to initiate exit: ' + error.message)
        }
    })
}

export const useUpdateExitStatus = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status, employeeId }) => exitService.updateExitStatus({ id, status, employeeId }),
        onSuccess: () => {
            toast.success('Exit process status updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['exits'] })
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        },
        onError: (error) => {
            toast.error('Failed to update exit status: ' + error.message)
        }
    })
}

export const useUpdateExitClearance = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, department, isCleared, reviewerUserId }) => exitService.updateExitClearance({ id, department, isCleared, reviewerUserId }),
        onSuccess: () => {
            toast.success('Department clearance updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['exits'] })
        },
        onError: (error) => {
            toast.error('Failed to update departmental clearance: ' + error.message)
        }
    })
}

export const useUpdateExitSettlement = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, amount, details }) => exitService.updateExitSettlement({ id, amount, details }),
        onSuccess: () => {
            toast.success('Settlement details updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['exits'] })
        },
        onError: (error) => {
            toast.error('Failed to update settlement details: ' + error.message)
        }
    })
}
