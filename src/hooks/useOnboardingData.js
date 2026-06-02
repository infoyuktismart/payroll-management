import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { onboardingService } from '../services/onboardingService'
import { toast } from 'react-hot-toast'

export const useOnboardingChecklist = (employeeId) => {
    return useQuery({
        queryKey: ['onboardingChecklist', employeeId],
        queryFn: async () => {
            try {
                return await onboardingService.getChecklist(employeeId)
            } catch (error) {
                toast.error('Failed to load onboarding checklist: ' + error.message)
                throw error
            }
        },
        enabled: !!employeeId
    })
}

export const useCreateOnboardingTasks = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (tasks) => onboardingService.createTasks(tasks),
        onSuccess: (_data, tasks) => {
            toast.success('Onboarding checklist task(s) created!')
            const employeeId = tasks[0]?.employee_id
            if (employeeId) {
                queryClient.invalidateQueries({ queryKey: ['onboardingChecklist', employeeId] })
            }
        },
        onError: (error) => {
            toast.error('Failed to create onboarding tasks: ' + error.message)
        }
    })
}

export const useToggleTaskStatus = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status }) => onboardingService.updateTaskStatus({ id, status }),
        onSuccess: (_data, _variables) => {
            toast.success('Task status updated!')
            queryClient.invalidateQueries({ queryKey: ['onboardingChecklist'] })
        },
        onError: (error) => {
            toast.error('Failed to update task status: ' + error.message)
        }
    })
}

export const useDeleteOnboardingTask = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id) => onboardingService.deleteTask(id),
        onSuccess: () => {
            toast.success('Task removed from onboarding checklist!')
            queryClient.invalidateQueries({ queryKey: ['onboardingChecklist'] })
        },
        onError: (error) => {
            toast.error('Failed to remove onboarding task: ' + error.message)
        }
    })
}
