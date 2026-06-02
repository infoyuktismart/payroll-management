import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportService } from '../services/reportService'
import { toast } from 'react-hot-toast'

export const useReportData = () => {
    return useQuery({
        queryKey: ['reportData'],
        queryFn: async () => {
            try {
                return await reportService.getReportData()
            } catch (error) {
                toast.error('Failed to load report data: ' + error.message)
                throw error
            }
        }
    })
}

export const useStatutoryData = (statutoryMonth) => {
    return useQuery({
        queryKey: ['statutoryData', statutoryMonth],
        queryFn: async () => {
            try {
                return await reportService.getStatutoryData(statutoryMonth)
            } catch (error) {
                toast.error('Failed to load statutory data: ' + error.message)
                throw error
            }
        },
        enabled: !!statutoryMonth
    })
}

export const useSaveGeneratedReport = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => reportService.saveGeneratedReport(payload),
        onSuccess: () => {
            toast.success('Report saved to directory successfully!')
            queryClient.invalidateQueries({ queryKey: ['reportData'] })
        },
        onError: (error) => {
            toast.error('Failed to save generated report: ' + error.message)
        }
    })
}
