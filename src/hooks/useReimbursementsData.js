import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reimbursementService } from '../services/reimbursementService'
import { toast } from 'react-hot-toast'

export const useReimbursements = ({ page = 0, pageSize = 50 } = {}) => {
    return useQuery({
        queryKey: ['reimbursements', page, pageSize],
        queryFn: async () => {
            try {
                return await reimbursementService.getClaims({ page, pageSize })
            } catch (error) {
                toast.error('Failed to load reimbursement claims: ' + error.message)
                throw error
            }
        }
    })
}

export const useCreateReimbursement = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => reimbursementService.createClaim(payload),
        onSuccess: () => {
            toast.success('Reimbursement claim submitted successfully!')
            queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
        },
        onError: (error) => {
            toast.error('Failed to submit reimbursement claim: ' + error.message)
        }
    })
}

export const useUpdateReimbursementStatus = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status, reviewerUserId }) => reimbursementService.updateClaimStatus({ id, status, reviewerUserId }),
        onSuccess: () => {
            toast.success('Claim status updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
        },
        onError: (error) => {
            toast.error('Failed to update claim status: ' + error.message)
        }
    })
}
