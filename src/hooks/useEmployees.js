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

export const useAllEmployees = () => {
    return useQuery({
        queryKey: ['employees', 'all'],
        queryFn: async () => {
            try {
                return await employeeService.getAllEmployees()
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

export const useJobGrades = (activeCompanyId) => {
    return useQuery({
        queryKey: ['jobGrades', activeCompanyId || 'all-companies'],
        queryFn: () => employeeService.getJobGrades(activeCompanyId),
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
    })
}

export const useToggleEmployeeStatus = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (employee) => {
            const newStatus = employee.status === 'active' ? 'inactive' : 'active'
            await employeeService.updateEmployee({ id: employee.id, payload: { status: newStatus } })
            return newStatus
        },
        onSuccess: (newStatus) => {
            toast.success(`Employee marked as ${newStatus}`)
            queryClient.invalidateQueries({ queryKey: ['employees'] })
            queryClient.invalidateQueries({ queryKey: ['planEntitlements'] })
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to toggle employee status')
        }
    })
}

export const useExtendProbation = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ employee, extension }) => {
            const parseProbationMonths = (value) => {
                const months = parseInt(value, 10)
                return Number.isFinite(months) && months > 0 ? months : 0
            }
            const currentMonths = parseProbationMonths(employee.probation_period)
            const totalMonths = currentMonths + extension
            const joiningDate = new Date(employee.joining_date)
            const endDate = new Date(joiningDate)
            endDate.setMonth(endDate.getMonth() + totalMonths)

            const payload = {
                probation_period: String(totalMonths),
                probation_status: 'extended',
                probation_end_date: endDate.toISOString().split('T')[0]
            }

            await employeeService.updateEmployee({ id: employee.id, payload })
            return { employee, extension, totalMonths, endDate }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
            queryClient.invalidateQueries({ queryKey: ['planEntitlements'] })
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to extend probation.')
        }
    })
}

export const useConfirmEmployee = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (employee) => {
            const payload = {
                status: 'active',
                probation_period: '0',
                probation_status: 'confirmed',
                probation_end_date: null
            }
            await employeeService.updateEmployee({ id: employee.id, payload })
            return employee
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
            queryClient.invalidateQueries({ queryKey: ['planEntitlements'] })
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to confirm employee.')
        }
    })
}

export const useSaveEmployee = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ currentData, editingEmployee, profilePhotoFile, removeProfilePhoto, canAddUsage, entitlements }) => {
            const payload = { ...currentData }
            if (payload.salary) {
                payload.salary = parseFloat(payload.salary)
            }
            const CONTRACT_TYPES = ['Permanent', 'Contract', 'Intern', 'Consultant']
            const getDefaultContractType = (employmentType) => {
                if (employmentType === 'consultant') return 'Consultant'
                if (employmentType === 'contract') return 'Contract'
                return 'Permanent'
            }
            const normalizeContractType = (contractType, employmentType) => {
                return CONTRACT_TYPES.includes(contractType) ? contractType : getDefaultContractType(employmentType)
            }
            payload.contract_type = normalizeContractType(payload.contract_type, payload.employment_type)
            if (payload.employment_type === 'permanent') {
                payload.contract_end_date = null
            }

            const dateFields = ['dob', 'joining_date', 'probation_end_date', 'contract_end_date']
            dateFields.forEach(field => {
                if (payload[field] === '') payload[field] = null
            })

            if (removeProfilePhoto) {
                payload.profile_photo_url = ''
            }

            // Photo upload through Service Layer
            if (profilePhotoFile) {
                const targetId = editingEmployee?.id || currentData.employee_id || `new_${Date.now()}`
                const publicUrl = await employeeService.uploadProfilePhoto(targetId, profilePhotoFile)
                payload.profile_photo_url = publicUrl || payload.profile_photo_url || ''
            }

            if (editingEmployee) {
                await employeeService.updateEmployee({ id: editingEmployee.id, payload })
                return { mode: 'updated' }
            }

            if (canAddUsage && !canAddUsage('employees')) {
                const limit = entitlements?.limits?.employees
                throw new Error(`Employee limit reached for ${entitlements?.plan?.name || 'this plan'}${limit ? ` (${limit} active employees)` : ''}. Upgrade the subscription to add more.`)
            }

            await employeeService.createEmployee(payload)
            return { mode: 'added' }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] })
            queryClient.invalidateQueries({ queryKey: ['planEntitlements'] })
        }
    })
}

export const useEmployeeByEmail = (email) => {
    return useQuery({
        queryKey: ['employees', 'email', email],
        queryFn: async () => {
            try {
                return await employeeService.getEmployeeByEmail(email)
            } catch (error) {
                toast.error('Failed to load employee details: ' + error.message)
                throw error
            }
        },
        enabled: !!email,
        staleTime: 10 * 60 * 1000, // Cache for 10 minutes since profile doesn't change often
    })
}

