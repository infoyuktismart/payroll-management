import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { attendanceService } from '../services/attendanceService'
import { toast } from 'react-hot-toast'

export const useHolidays = () => {
    return useQuery({
        queryKey: ['holidays'],
        queryFn: async () => {
            try {
                return await attendanceService.getHolidays()
            } catch (error) {
                toast.error('Failed to load holidays: ' + error.message)
                throw error
            }
        }
    })
}

export const useDailyAttendance = ({ startDate, endDate, statusFilter, page = 0, pageSize = 50 }) => {
    return useQuery({
        queryKey: ['dailyAttendance', { startDate, endDate, statusFilter }, page, pageSize],
        queryFn: async () => {
            try {
                return await attendanceService.getDailyAttendance({ startDate, endDate, statusFilter, page, pageSize })
            } catch (error) {
                toast.error('Failed to load daily attendance: ' + error.message)
                throw error
            }
        },
        enabled: !!startDate && !!endDate
    })
}

export const useCalendarAttendance = (employeeId, startDate, endDate) => {
    return useQuery({
        queryKey: ['calendarAttendance', employeeId, { startDate, endDate }],
        queryFn: async () => {
            try {
                return await attendanceService.getCalendarAttendance(employeeId, startDate, endDate)
            } catch (error) {
                toast.error('Failed to load calendar attendance: ' + error.message)
                throw error
            }
        },
        enabled: !!employeeId && !!startDate && !!endDate
    })
}

export const useRegularizationRequests = () => {
    return useQuery({
        queryKey: ['regularizationRequests'],
        queryFn: async () => {
            try {
                return await attendanceService.getRegularizationRequests()
            } catch (error) {
                toast.error('Failed to load regularization requests: ' + error.message)
                throw error
            }
        }
    })
}

export const useUpdateRegularizationStatus = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status, reviewedBy }) => attendanceService.updateRegularizationStatus({ id, status, reviewedBy }),
        onSuccess: () => {
            toast.success('Regularization request status updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['regularizationRequests'] })
            queryClient.invalidateQueries({ queryKey: ['dailyAttendance'] })
            queryClient.invalidateQueries({ queryKey: ['calendarAttendance'] })
        },
        onError: (error) => {
            toast.error('Failed to update regularization status: ' + error.message)
        }
    })
}

export const useCreateAttendance = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => attendanceService.createAttendance(payload),
        onSuccess: () => {
            toast.success('Attendance recorded successfully!')
            queryClient.invalidateQueries({ queryKey: ['dailyAttendance'] })
            queryClient.invalidateQueries({ queryKey: ['calendarAttendance'] })
        },
        onError: (error) => {
            toast.error('Failed to record attendance: ' + error.message)
        }
    })
}

export const useUpdateAttendance = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, payload }) => attendanceService.updateAttendance({ id, payload }),
        onSuccess: (data) => {
            toast.success('Attendance record updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['dailyAttendance'] })
            if (data?.employee_id) {
                queryClient.invalidateQueries({ queryKey: ['calendarAttendance', data.employee_id] })
            }
        },
        onError: (error) => {
            toast.error('Failed to update attendance record: ' + error.message)
        }
    })
}

export const useDeleteAttendance = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id) => attendanceService.deleteAttendance(id),
        onSuccess: () => {
            toast.success('Attendance record deleted successfully!')
            queryClient.invalidateQueries({ queryKey: ['dailyAttendance'] })
            queryClient.invalidateQueries({ queryKey: ['calendarAttendance'] })
        },
        onError: (error) => {
            toast.error('Failed to delete attendance record: ' + error.message)
        }
    })
}

export const useOvertimeRequests = ({ employeeId, isAdmin } = {}) => {
    return useQuery({
        queryKey: ['overtimeRequests', { employeeId, isAdmin }],
        queryFn: async () => {
            try {
                return await attendanceService.getOvertimeRequests({ employeeId, isAdmin })
            } catch (error) {
                toast.error('Failed to load overtime requests: ' + error.message)
                throw error
            }
        }
    })
}

export const useCreateOvertimeRequest = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => attendanceService.createOvertimeRequest(payload),
        onSuccess: () => {
            toast.success('Overtime request submitted successfully!')
            queryClient.invalidateQueries({ queryKey: ['overtimeRequests'] })
        },
        onError: (error) => {
            toast.error('Failed to submit overtime request: ' + error.message)
        }
    })
}

export const useUpdateOvertimeStatus = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status }) => attendanceService.updateOvertimeStatus({ id, status }),
        onSuccess: () => {
            toast.success('Overtime request status updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['overtimeRequests'] })
        },
        onError: (error) => {
            toast.error('Failed to update overtime status: ' + error.message)
        }
    })
}
