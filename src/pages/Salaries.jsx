import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { useToast } from '../context/ToastContext'
import { logger } from '../lib/devLogger'
import { applyCompanyFilter, withCompanyScope } from '../services/tenantScope'

export default function Salaries() {
    const { user, isAdmin } = useAuth()
    const toast = useToast()
    const [salaries, setSalaries] = useState([])
    const [employees, setEmployees] = useState([]) // List of employees for selection
    const [employeeMap, setEmployeeMap] = useState({})
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        employee_id: '',
        month: '',
        basic_salary: '',
        allowances: '0',
        deductions: '0',
        payment_date: ''
    })
    const [currentEmployee, setCurrentEmployee] = useState(null)

    useEffect(() => {
        const loadInitialData = async () => {
            if (!user) return
            try {
                setLoading(true)
                // 1. Fetch current employee profile
                const { data: emp, error: empErr } = await applyCompanyFilter(
                    supabase
                        .from('employees')
                        .select('*')
                )
                    .eq('email', user.email)
                    .single()
                
                if (empErr && empErr.code !== 'PGRST116') throw empErr
                setCurrentEmployee(emp)
 
                // 2. Fetch employee list and salaries in parallel
                const promises = []
 
                if (isAdmin) {
                    promises.push(applyCompanyFilter(supabase.from('employees').select('id, first_name, last_name, basic_salary')))
                } else {
                    promises.push(Promise.resolve({ data: null }))
                }
 
                let salariesQuery = applyCompanyFilter(supabase.from('salaries').select('*')).order('month', { ascending: false })
                if (!isAdmin && emp) {
                    salariesQuery = salariesQuery.eq('employee_id', emp.id)
                }
                promises.push(salariesQuery)
 
                const [empsRes, salariesRes] = await Promise.all(promises)
 
                if (isAdmin && empsRes.data) {
                    setEmployees(empsRes.data)
                    const map = {}
                    empsRes.data.forEach(e => map[e.id] = `${e.first_name} ${e.last_name}`)
                    setEmployeeMap(map)
                }
 
                if (salariesRes.data) {
                    setSalaries(salariesRes.data)
                }
 
            } catch (error) {
                logger.error("Error loading salaries data:", error)
            } finally {
                setLoading(false)
            }
        }
        loadInitialData()
    }, [user, isAdmin])


    const fetchSalaries = async () => {
        try {
            let query = applyCompanyFilter(supabase.from('salaries').select('*')).order('month', { ascending: false })
            if (!isAdmin && currentEmployee) {
                query = query.eq('employee_id', currentEmployee.id)
            }
            const { data, error } = await query
            if (error) throw error
            setSalaries(data)
        } catch (error) {
            logger.error('Error fetching salaries:', error)
        }
    }

    const handleEmployeeSelect = (e) => {
        const empId = e.target.value
        const emp = employees.find(e => e.id === empId)
        setFormData({
            ...formData,
            employee_id: empId,
            basic_salary: emp ? emp.basic_salary : ''
        })
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('salaries').insert([withCompanyScope(formData)])

            if (error) throw error
            setIsModalOpen(false)
            fetchSalaries()
            setFormData({
                employee_id: '',
                month: '',
                basic_salary: '',
                allowances: '0',
                deductions: '0',
                payment_date: ''
            })
        } catch (error) {
            toast.error(error.message)
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <div></div>
                    {isAdmin && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                            <Plus className="h-5 w-5" />
                            <span>Process Payment</span>
                        </button>
                    )}
                </div>

                <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Basic</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allowances</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deductions</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Pay</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid On</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-4 text-gray-500">
                                        <div role="status" aria-live="polite" aria-label="Loading salaries">
                                            <span>Loading...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : salaries.length === 0 ? (
                                <tr><td colSpan="7" className="text-center py-4">No salary records found</td></tr>
                            ) : (
                                salaries.map((salary) => (
                                    <tr key={salary.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {isAdmin ? (employeeMap[salary.employee_id] || 'Unknown') : 'You'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {format(new Date(salary.month), 'MMMM yyyy')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{Number(salary.basic_salary).toLocaleString('en-IN')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">+₹{Number(salary.allowances).toLocaleString('en-IN')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">-₹{Number(salary.deductions).toLocaleString('en-IN')}</td>
                                        {/* net_salary is a GENERATED ALWAYS column in DB — read directly, never recompute */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">₹{Number(salary.net_salary).toLocaleString('en-IN')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {salary.payment_date ? format(new Date(salary.payment_date), 'MMM d, yyyy') : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title="Process Salary Payment"
                >
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Employee</label>
                            <select required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={formData.employee_id}
                                onChange={handleEmployeeSelect}
                            >
                                <option value="">Select Employee</option>
                                {employees.map(e => (
                                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">For Month</label>
                                <input type="date" required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    value={formData.month}
                                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Processed On</label>
                                <input type="date" required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    value={formData.payment_date}
                                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Basic Salary</label>
                            <input type="number" required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-50"
                                readOnly
                                value={formData.basic_salary}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Allowances</label>
                                <input type="number" required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    value={formData.allowances}
                                    onChange={(e) => setFormData({ ...formData, allowances: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Deductions</label>
                                <input type="number" required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    value={formData.deductions}
                                    onChange={(e) => setFormData({ ...formData, deductions: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-md">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span>Net Salary:</span>
                                {/* Net salary is computed by the DB GENERATED ALWAYS column upon save.
                                    No client-side arithmetic — value will be shown after refresh. */}
                                <span className="text-sm text-gray-500 italic">Calculated by database engine on save</span>
                            </div>
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
                                Confirm Payment
                            </button>
                        </div>
                    </form>
                </Modal>
            </div>
        </div>
    )
}
