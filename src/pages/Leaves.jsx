import { useState, useEffect, useMemo } from 'react'
import { employeeService } from '../services/employeeService'
import { leaveService } from '../services/leaveService'
import { attendanceService } from '../services/attendanceService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { format } from 'date-fns'
import { Plus, Check, X } from 'lucide-react'
import Modal from '../components/ui/Modal'
import clsx from 'clsx'
import { TableRowSkeleton } from '../components/ui/SkeletonLoader'
import { calculateLeaveDays, getLeavePolicyOptions } from '../lib/leaveUtils'
import { notifyLeaveStatus } from '../lib/notifications'
import Pagination from '../components/Pagination'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
    useLeavePolicies,
    useLeaves,
    useLeaveBalances,
    useCreateLeaveRequest,
    useUpdateLeaveStatus
} from '../hooks/useLeavesData'
import { sanitizeFormData } from '../lib/formUtils'
import { logger } from '../lib/devLogger'
import { applyCompanyFilter } from '../services/tenantScope'

export default function Leaves() {
    const { user, isAdmin } = useAuth()
    const toast = useToast()
    const [page, setPage] = useState(0)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        leave_type: 'Sick Leave',
        start_date: '',
        end_date: '',
        reason: ''
    })

    // We assume the logged in user is linked to an employee record.
    const [currentEmployee, setCurrentEmployee] = useState(null)
    const [loadingEmployee, setLoadingEmployee] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        const loadProfile = async () => {
            if (!user) return
            try {
                setLoadingEmployee(true)
                const emp = await employeeService.getEmployeeByEmail(user.email)
                setCurrentEmployee(emp)
            } catch (error) {
                logger.error('Error loading employee profile:', error)
            } finally {
                setLoadingEmployee(false)
            }
        }
        loadProfile()
    }, [user])

    // Fetch leaves using paginated react-query hook
    const { data: leavesResponse, isLoading: leavesLoading } = useLeaves({
        employeeId: currentEmployee?.id,
        isAdmin,
        page,
        pageSize: 50
    })
    const leaves = leavesResponse?.data || []
    const totalPages = leavesResponse?.totalPages || 1
    const count = leavesResponse?.count || 0

    // Fetch policies
    const { data: policiesData = [] } = useLeavePolicies()
    const leavePolicies = useMemo(() => getLeavePolicyOptions(policiesData), [policiesData])

    // Fetch holidays
    const { data: holidays = [] } = useQuery({
        queryKey: ['holidays'],
        queryFn: () => attendanceService.getHolidays()
    })

    // Fetch leave balances for employee
    const { data: leaveBalances = [] } = useLeaveBalances(currentEmployee?.id)

    // Fetch all employees for admin mapping
    const { data: allEmployees = [] } = useQuery({
        queryKey: ['allEmployeesForMapping'],
        queryFn: async () => {
            const { data, error } = await applyCompanyFilter(
                supabase.from('employees').select('id, first_name, last_name')
            )
            if (error) throw error
            return data || []
        },
        enabled: !!isAdmin
    })
    const employees = useMemo(() => {
        const map = {}
        allEmployees.forEach(e => map[e.id] = `${e.first_name} ${e.last_name}`)
        return map
    }, [allEmployees])

    const createLeaveMutation = useCreateLeaveRequest()
    const updateLeaveStatusMutation = useUpdateLeaveStatus()

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!currentEmployee) {
            toast.error('Your employee profile is not linked. Please contact HR.')
            return
        }

        try {
            setActionLoading(true)
            await createLeaveMutation.mutateAsync(sanitizeFormData({
                ...formData,
                employee_id: currentEmployee.id
            }))

            setIsModalOpen(false)
            setFormData({ leave_type: leavePolicies[0]?.leave_type || 'Sick Leave', start_date: '', end_date: '', reason: '' })
            toast.success('Leave request submitted successfully!')
        } catch (error) {
            toast.error(error.message)
        } finally {
            setActionLoading(false)
        }
    }

    const handleStatusChange = async (id, status) => {
        try {
            setActionLoading(true)
            const leaveBefore = leaves.find(leave => leave.id === id)
            await updateLeaveStatusMutation.mutateAsync({ id, status })

            const leaveWithEmployee = await leaveService.getLeaveWithEmployee(id)
            await notifyLeaveStatus({
                email: leaveWithEmployee?.employee?.email,
                employeeName: `${leaveWithEmployee?.employee?.first_name || ''} ${leaveWithEmployee?.employee?.last_name || ''}`.trim(),
                status,
                leaveType: leaveWithEmployee?.leave_type || leaveBefore?.leave_type,
                leaveId: id
            })
            toast.success(`Leave request ${status} successfully!`)
        } catch (error) {
            toast.error(error.message)
        } finally {
            setActionLoading(false)
        }
    }

    const requestedDays = calculateLeaveDays(formData.start_date, formData.end_date, holidays)
    const currentBalance = leaveBalances.find(balance => balance.leave_type === formData.leave_type)?.balance

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-800'
            case 'rejected': return 'bg-red-100 text-red-800'
            default: return 'bg-yellow-100 text-yellow-800'
        }
    }

    const loading = loadingEmployee || leavesLoading || actionLoading
    const indexOfFirstLeave = page * 50
    const indexOfLastLeave = indexOfFirstLeave + leaves.length

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <div></div>
                    {!isAdmin && (
                        <button
                            onClick={() => {
                                setFormData(prev => ({ ...prev, leave_type: leavePolicies[0]?.leave_type || prev.leave_type }))
                                setIsModalOpen(true)
                            }}
                            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                            <Plus className="h-5 w-5" />
                            <span>Request Leave</span>
                        </button>
                    )}
                </div>
                {!isAdmin && leaveBalances.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                        {leaveBalances.map(balance => (
                            <div key={balance.id} className="rounded-xl bg-slate-50 border border-gray-100 px-4 py-3">
                                <p className="text-xs font-bold text-gray-500 uppercase">{balance.leave_type}</p>
                                <p className="text-2xl font-black text-slate-900 mt-1">{Number(balance.balance || 0)} days</p>
                            </div>
                        ))}
                    </div>
                )}

            <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            {isAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <>
                                <TableRowSkeleton cols={6} />
                                <TableRowSkeleton cols={6} />
                                <TableRowSkeleton cols={6} />
                                <TableRowSkeleton cols={6} />
                                <TableRowSkeleton cols={6} />
                            </>
                        ) : leaves.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-4">No leave requests found</td></tr>
                        ) : (
                            leaves.map((leave) => (
                                <tr key={leave.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {isAdmin ? (employees[leave.employee_id] || 'Unknown') : 'You'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{leave.leave_type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {format(new Date(leave.start_date), 'MMM d, yyyy')} - {format(new Date(leave.end_date), 'MMM d, yyyy')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{leave.reason}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={clsx("px-2 inline-flex text-xs leading-5 font-semibold rounded-full", getStatusColor(leave.status))}>
                                            {leave.status}
                                        </span>
                                    </td>
                                    {isAdmin && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {leave.status === 'pending' && (
                                                <div className="flex justify-end space-x-2">
                                                    <button onClick={() => handleStatusChange(leave.id, 'approved')} aria-label="Approve leave request" className="text-green-600 hover:text-green-900 bg-green-50 p-1 rounded">
                                                        <Check className="h-4 w-4" aria-hidden="true" />
                                                    </button>
                                                    <button onClick={() => handleStatusChange(leave.id, 'rejected')} aria-label="Reject leave request" className="text-red-600 hover:text-red-900 bg-red-50 p-1 rounded">
                                                        <X className="h-4 w-4" aria-hidden="true" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {leaves.length > 0 && (
                    <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
                        <div className="text-sm text-gray-500 font-medium">
                            Showing <span className="font-medium">{indexOfFirstLeave + 1}</span> to <span className="font-medium">{indexOfLastLeave}</span> of <span className="font-medium">{count}</span> results
                        </div>
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Request Leave"
            >
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label htmlFor="auto-id-leaves-46" className="block text-sm font-medium text-gray-700">Leave Type</label>
                        <select id="auto-id-leaves-46"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            value={formData.leave_type}
                            onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                        >
                            {leavePolicies.map(policy => (
                                <option key={policy.leave_type} value={policy.leave_type}>
                                    {policy.leave_type}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Available: {currentBalance ?? 'Not initialized'} day(s)
                        </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm font-semibold text-blue-800">
                        Requested payable days: {requestedDays}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="auto-id-leaves-47" className="block text-sm font-medium text-gray-700">Start Date</label>
                            <input id="auto-id-leaves-47" type="date" required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label htmlFor="auto-id-leaves-48" className="block text-sm font-medium text-gray-700">End Date</label>
                            <input id="auto-id-leaves-48" type="date" required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={formData.end_date}
                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Reason</label>
                        <textarea
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            rows="3"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        ></textarea>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="mr-3 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                        >
                            Submit Request
                        </button>
                    </div>
                </form>
            </Modal>
            </div>
        </div>
    )
}
