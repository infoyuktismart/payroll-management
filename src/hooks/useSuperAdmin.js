import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superadminService } from '../services/superadminService'
import { toast } from 'react-hot-toast'

export const useSuperAdminMetricsQuery = () => {
    return useQuery({
        queryKey: ['superadminMetrics'],
        queryFn: async () => {
            try {
                return await superadminService.getSuperAdminMetrics()
            } catch (error) {
                toast.error('Failed to load superadmin metrics: ' + error.message)
                throw error
            }
        }
    })
}

export const useSubscriptionPlansQuery = () => {
    return useQuery({
        queryKey: ['subscriptionPlans'],
        queryFn: async () => {
            try {
                return await superadminService.getSubscriptionPlans()
            } catch (error) {
                toast.error('Failed to load subscription plans: ' + error.message)
                throw error
            }
        }
    })
}

export const useUpsertSubscriptionMutation = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (subscription) => superadminService.upsertCompanySubscription(subscription),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['superadminMetrics'] })
        }
    })
}
