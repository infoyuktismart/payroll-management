import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { loanService } from '../services/loanService'
import { toast } from 'react-hot-toast'

export const useLoans = ({ page = 0, pageSize = 50 } = {}) => {
    return useQuery({
        queryKey: ['loans', page, pageSize],
        queryFn: async () => {
            try {
                return await loanService.getLoans({ page, pageSize })
            } catch (error) {
                toast.error('Failed to load loans list: ' + error.message)
                throw error
            }
        }
    })
}

export const useCreateLoan = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => loanService.createLoan(payload),
        onSuccess: () => {
            toast.success('Loan application submitted successfully!')
            queryClient.invalidateQueries({ queryKey: ['loans'] })
        },
        onError: (error) => {
            toast.error('Failed to submit loan application: ' + error.message)
        }
    })
}

export const useUpdateLoanStatus = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status }) => loanService.updateLoanStatus({ id, status }),
        onSuccess: () => {
            toast.success('Loan status updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['loans'] })
        },
        onError: (error) => {
            toast.error('Failed to update loan status: ' + error.message)
        }
    })
}
