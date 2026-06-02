import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeeService } from '../services/employeeService'
import { toast } from 'react-hot-toast'

export const useEmployees = ({ page = 0, pageSize = 50 } = {}) => {
    return useQuery({
        queryKey: ['employees', page, pageSize],
        queryFn: async () => {
            try {
                return await employeeService.getEmployees({ page, pageSize })
            } catch (error) {
                toast.error('Failed to load employees list: ' + error.message)
                throw error
            }
        }
    })
}

export const useEmployeeById = (id) => {
    return useQuery({
        queryKey: ['employees', id],
        queryFn: async () => {
            try {
                return await employeeService.getEmployeeById(id)
            } catch (error) {
                toast.error('Failed to load employee details: ' + error.message)
                throw error
            }
        },
        enabled: !!id
    })
}

export const useCreateEmployee = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload) => employeeService.createEmployee(payload),
        onSuccess: () => {
            toast.success('Employee created successfully!')
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        },
        onError: (error) => {
            toast.error('Failed to create employee: ' + error.message)
        }
    })
}

export const useUpdateEmployee = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, payload }) => employeeService.updateEmployee({ id, payload }),
        onSuccess: (data) => {
            toast.success('Employee updated successfully!')
            queryClient.invalidateQueries({ queryKey: ['employees'] })
            if (data?.id) {
                queryClient.invalidateQueries({ queryKey: ['employees', data.id] })
            }
        },
        onError: (error) => {
            toast.error('Failed to update employee: ' + error.message)
        }
    })
}

export const useDeleteEmployee = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id) => employeeService.deleteEmployee(id),
        onSuccess: () => {
            toast.success('Employee deleted successfully!')
            queryClient.invalidateQueries({ queryKey: ['employees'] })
        },
        onError: (error) => {
            toast.error('Failed to delete employee: ' + error.message)
        }
    })
}
