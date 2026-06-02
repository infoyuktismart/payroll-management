import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companyService } from '../services/companyService'
import { toast } from 'react-hot-toast'

export const useCompanySettings = () => {
    return useQuery({
        queryKey: ['companySettings'],
        queryFn: async () => {
            try {
                return await companyService.getCompanySettings()
            } catch (error) {
                toast.error('Failed to load company settings: ' + error.message)
                throw error
            }
        }
    })
}

export const useUpdateCompanySettings = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, updates }) => companyService.updateCompanySettings({ id, updates }),
        onSuccess: () => {
            toast.success('Company settings updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['companySettings'] })
        },
        onError: (error) => {
            toast.error('Failed to update company settings: ' + error.message)
        }
    })
}
