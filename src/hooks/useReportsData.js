import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportService } from '../services/reportService'
import { toast } from 'react-hot-toast'

export const useReportData = (activeCompanyId, selectedBranch) => {
    return useQuery({
        queryKey: ['reportData', activeCompanyId || 'all-companies', selectedBranch || 'all-branches'],
        queryFn: async () => {
            try {
                return await reportService.getReportData(activeCompanyId, selectedBranch)
            } catch (error) {
                toast.error('Failed to load report data: ' + error.message)
                throw error
            }
        }
    })
}

export const useStatutoryData = (statutoryMonth, activeCompanyId, selectedBranch) => {
    return useQuery({
        queryKey: ['statutoryData', statutoryMonth, activeCompanyId || 'all-companies', selectedBranch || 'all-branches'],
        queryFn: async () => {
            try {
                if (activeCompanyId !== undefined || selectedBranch !== undefined) {
                    return await reportService.getStatutoryData(statutoryMonth, activeCompanyId, selectedBranch)
                }
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
        mutationFn: ({ payload, activeCompanyId }) => reportService.saveGeneratedReport(payload, activeCompanyId),
        onSuccess: () => {
            toast.success('Report saved to directory successfully!')
            queryClient.invalidateQueries({ queryKey: ['reportData'] })
        },
        onError: (error) => {
            toast.error('Failed to save generated report: ' + error.message)
        }
    })
}

export const useCustomReportMutation = () => {
    return useMutation({
        mutationFn: async ({ type, fromDate, department }) => {
            if (type === 'Employee') {
                return await reportService.getEmployeeReportsData(department)
            } else if (type === 'Payroll') {
                return await reportService.getPayrollReportsData(fromDate, department)
            } else if (type === 'Attendance') {
                return await reportService.getAttendanceReportsData(fromDate, department)
            }
            throw new Error('Unsupported report type: ' + type)
        }
    })
}

export const useForm16DataMutation = () => {
    return useMutation({
        mutationFn: async ({ employeeId, financialYear, startMonth, endMonth }) => {
            const [declarations, payrollItems] = await Promise.all([
                reportService.getTaxDeclarations(employeeId, financialYear),
                reportService.getPayrollItemsForFinancialYear(employeeId, startMonth, endMonth)
            ])
            return { declarations, payrollItems }
        }
    })
}
