import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taxService } from '../services/taxService'
import { toast } from 'react-hot-toast'

export const useTaxDeclarations = () => {
    return useQuery({
        queryKey: ['taxDeclarations'],
        queryFn: async () => {
            try {
                return await taxService.getTaxDeclarations()
            } catch (error) {
                toast.error('Failed to load tax declarations: ' + error.message)
                throw error
            }
        }
    })
}

export const useReviewDeclaration = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status }) => taxService.reviewDeclaration({ id, status }),
        onSuccess: () => {
            toast.success('Tax declaration status reviewed successfully!')
            queryClient.invalidateQueries({ queryKey: ['taxDeclarations'] })
        },
        onError: (error) => {
            toast.error('Failed to review tax declaration: ' + error.message)
        }
    })
}
