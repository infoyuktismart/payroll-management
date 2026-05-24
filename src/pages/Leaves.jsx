import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { format } from 'date-fns'
import { Plus, Check, X } from 'lucide-react'
import Modal from '../components/ui/Modal'
import clsx from 'clsx'
import { TableRowSkeleton } from '../components/ui/SkeletonLoader'
import { calculateLeaveDays, getLeavePolicyOptions } from '../lib/leaveUtils'
import { notifyLeaveStatus } from '../lib/notifications'

export default function Leaves() {
    const { user, isAdmin } = useAuth()
    const toast = useToast()
    const [leaves, setLeaves] = useState([])
    const [employees, setEmployees] = useState({})
    const [leavePolicies, setLeavePolicies] = useState([])
    const [leaveBalances, setLeaveBalances] = useState([])
    const [holidays, setHolidays] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        leave_type: 'Sick Leave',
        start_date: '',
        end_date: '',
        reason: ''
    })

    // We need employee_id. If user is admin, they might be approving. If user is employee, they request for themselves.
    // For this MVP, we map auth.user.id to employee.user_id or we just use email to find employee.
    // We'll assuming the logged in user is linked to an employee record.
    const [currentEmployee, setCurrentEmployee] = useState(null)

    useEffect(() => {
        const loadInitialData = async () => {
            if (!user) return
            try {
                setLoading(true)
                // 1. Fetch current employee profile
                const { data: emp, error: empErr } = await supabase
                    .from('employees')
                    .select('*')
                    .eq('email', user.email)
                    .single()
                
                if (empErr) throw empErr
                setCurrentEmployee(emp)

                // 2. Fetch remaining data concurrently
                const promises = []

                // Leaves query
                let leavesQuery = supabase.from('leaves').select('*').order('created_at', { ascending: false })
                if (!isAdmin && emp) {
                    leavesQuery = leavesQuery.eq('employee_id', emp.id)
                }
                promises.push(leavesQuery)

                // Employees map query (if admin)
                if (isAdmin) {
                    promises.push(supabase.from('employees').select('id, first_name, last_name, leave_balance'))
                } else {
                    promises.push(Promise.resolve({ data: null }))
                }

                // Leave Policies query
                promises.push(supabase.from('leave_policies').select('*').order('leave_type'))

                // Holidays query
                promises.push(supabase.from('holidays').select('date'))

                // Leave Balances query (if employee exists)
                if (emp) {
                    const year = new Date().getFullYear()
                    promises.push(
                        supabase
                            .from('leave_balances')
                            .select('*')
                            .eq('employee_id', emp.id)
                            .eq('year', year)
                            .order('leave_type')
                    )
                } else {
                    promises.push(Promise.resolve({ data: null }))
                }

                const [leavesRes, employeesRes, policiesRes, holidaysRes, balancesRes] = await Promise.all(promises)

                if (leavesRes.error) throw leavesRes.error
                setLeaves(leavesRes.data || [])

                if (isAdmin && employeesRes.data) {
                    const map = {}
                    employeesRes.data.forEach(e => map[e.id] = `${e.first_name} ${e.last_name}`)
                    setEmployees(map)
                }

                if (policiesRes.data) {
                    setLeavePolicies(getLeavePolicyOptions(policiesRes.data))
                }

                setHolidays(holidaysRes.data || [])

                if (emp && balancesRes.data) {
                    setLeaveBalances(balancesRes.data)
                }

            } catch (error) {
                console.error('Error loading leaves initial data:', error)
            } finally {
                setLoading(false)
            }
        }
        loadInitialData()
    }, [user, isAdmin])


    const fetchLeaveBalances = async (employeeId) => {
        const year = new Date().getFullYear()
        const { data } = await supabase
            .from('leave_balances')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('year', year)
            .order('leave_type')
        setLeaveBalances(data || [])
    }


    const fetchLeaves = async () => {
        try {
            let query = supabase.from('leaves').select('*').order('created_at', { ascending: false })

            if (!isAdmin && currentEmployee) {
                query = query.eq('employee_id', currentEmployee.id)
            }

            const { data, error } = await query
            if (error) throw error
            setLeaves(data)
        } catch (error) {
            console.error('Error fetching leaves:', error)
        }
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!currentEmployee) {
            toast.error('Your employee profile is not linked. Please contact HR.')
            return
        }

        try {
            const { error } = await supabase.from('leaves').insert([{
                ...formData,
                employee_id: currentEmployee.id
            }])

            if (error) throw error
            setIsModalOpen(false)
            fetchLeaves()
            setFormData({ leave_type: leavePolicies[0]?.leave_type || 'Sick Leave', start_date: '', end_date: '', reason: '' })
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleStatusChange = async (id, status) => {
        try {
            const leaveBefore = leaves.find(leave => leave.id === id)
            const rpcName = status === 'approved' ? 'approve_leave_request' : 'reject_leave_request'
            const { error } = await supabase.rpc(rpcName, { p_leave_id: id })
            if (error) throw error
            const { data: leaveWithEmployee } = await supabase
                .from('leaves')
                .select('id, leave_type, employee:employees(first_name, last_name, email)')
                .eq('id', id)
                .single()
            await notifyLeaveStatus({
                email: leaveWithEmployee?.employee?.email,
                employeeName: `${leaveWithEmployee?.employee?.first_name || ''} ${leaveWithEmployee?.employee?.last_name || ''}`.trim(),
                status,
                leaveType: leaveWithEmployee?.leave_type || leaveBefore?.leave_type,
                leaveId: id
            })
            fetchLeaves()
            if (currentEmployee) fetchLeaveBalances(currentEmployee.id)
        } catch (error) {
            toast.error(error.message)
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
                                                    <button onClick={() => handleStatusChange(leave.id, 'approved')} className="text-green-600 hover:text-green-900 bg-green-50 p-1 rounded">
                                                        <Check className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleStatusChange(leave.id, 'rejected')} className="text-red-600 hover:text-red-900 bg-red-50 p-1 rounded">
                                                        <X className="h-4 w-4" />
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
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Request Leave"
            >
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Leave Type</label>
                        <select
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
                            <label className="block text-sm font-medium text-gray-700">Start Date</label>
                            <input type="date" required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">End Date</label>
                            <input type="date" required
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
