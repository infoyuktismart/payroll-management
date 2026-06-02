import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../services/dashboardService'
import { toast } from 'react-hot-toast'

export const useDashboardData = () => {
    return useQuery({
        queryKey: ['dashboardData'],
        queryFn: async () => {
            try {
                return await dashboardService.getDashboardData()
            } catch (error) {
                toast.error('Failed to load dashboard data: ' + error.message)
                throw error
            }
        }
    })
}
