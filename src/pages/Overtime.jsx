import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { format } from 'date-fns'
import { Plus, Check, X } from 'lucide-react'
import Modal from '../components/ui/Modal'
import clsx from 'clsx'

export default function Overtime() {
    const { user, isAdmin } = useAuth()
    const toast = useToast()
    const [requests, setRequests] = useState([])
    const [employees, setEmployees] = useState({})
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        date: '',
        hours: '',
        reason: ''
    })
    const [currentEmployee, setCurrentEmployee] = useState(null)

    useEffect(() => {
        fetchCurrentEmployee()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    useEffect(() => {
        if (currentEmployee || isAdmin) {
            fetchRequests()
            if (isAdmin) fetchEmployeesMap()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentEmployee, isAdmin])

    const fetchCurrentEmployee = async () => {
        if (!user) return
        const { data } = await supabase.from('employees').select('*').eq('email', user.email).single()
        setCurrentEmployee(data)
    }

    const fetchEmployeesMap = async () => {
        const { data } = await supabase.from('employees').select('id, first_name, last_name')
        const map = {}
        data?.forEach(e => map[e.id] = `${e.first_name} ${e.last_name}`)
        setEmployees(map)
    }

    const fetchRequests = async () => {
        try {
            let query = supabase.from('overtime').select('*').order('created_at', { ascending: false })
            if (!isAdmin && currentEmployee) {
                query = query.eq('employee_id', currentEmployee.id)
            }
            const { data, error } = await query
            if (error) throw error
            setRequests(data)
        } catch (error) {
            console.error('Error fetching overtime:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!currentEmployee) {
            toast.error('Your employee profile is not linked. Please contact HR.')
            return
        }

        try {
            const { error } = await supabase.from('overtime').insert([{
                ...formData,
                employee_id: currentEmployee.id
            }])

            if (error) throw error
            setIsModalOpen(false)
            fetchRequests()
            setFormData({ date: '', hours: '', reason: '' })
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleStatusChange = async (id, status) => {
        try {
            const { error } = await supabase.from('overtime').update({ status }).eq('id', id)
            if (error) throw error
            fetchRequests()
        } catch (error) {
            toast.error(error.message)
        }
    }

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
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                            <Plus className="h-5 w-5" />
                            <span>Request Overtime</span>
                        </button>
                    )}
                </div>

            <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            {isAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    {Array.from({ length: 6 }).map((_, j) => (
                                        <td key={j} className="px-6 py-4">
                                            <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: j === 0 ? '80px' : j === 1 ? '64px' : '48px' }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : requests.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-4">No overtime requests found</td></tr>
                        ) : (
                            requests.map((request) => (
                                <tr key={request.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {isAdmin ? (employees[request.employee_id] || 'Unknown') : 'You'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {format(new Date(request.date), 'MMM d, yyyy')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.hours} hrs</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{request.reason}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={clsx("px-2 inline-flex text-xs leading-5 font-semibold rounded-full", getStatusColor(request.status))}>
                                            {request.status}
                                        </span>
                                    </td>
                                    {isAdmin && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {request.status === 'pending' && (
                                                <div className="flex justify-end space-x-2">
                                                    <button onClick={() => handleStatusChange(request.id, 'approved')} className="text-green-600 hover:text-green-900 bg-green-50 p-1 rounded">
                                                        <Check className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleStatusChange(request.id, 'rejected')} className="text-red-600 hover:text-red-900 bg-red-50 p-1 rounded">
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
                title="Request Overtime"
            >
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Date</label>
                        <input type="date" required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Hours</label>
                        <input type="number" step="0.5" required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                            value={formData.hours}
                            onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                        />
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
