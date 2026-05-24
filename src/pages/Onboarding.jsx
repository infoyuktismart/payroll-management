import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { CheckCircle2, Circle, Clock, Plus, Trash2, UserPlus, CheckSquare, Briefcase, Info, Search, ShieldCheck } from 'lucide-react'
import { TableSkeleton } from '../components/ui/SkeletonLoader'

const DEFAULT_TASKS = [
    { task_name: 'Collect Aadhaar, PAN, Bank Details', category: 'HR', days: 2 },
    { task_name: 'Sign Employment Agreement & NDA', category: 'HR', days: 2 },
    { task_name: 'Allocate Laptop, Charger & Workspace', category: 'IT', days: 1 },
    { task_name: 'Configure Email & Slack Accounts', category: 'IT', days: 1 },
    { task_name: 'HR Orientation & Company Policies Induction', category: 'HR', days: 3 },
    { task_name: 'Team Meet & Greet Session', category: 'General', days: 5 },
    { task_name: 'Introduce to Reporting Manager', category: 'General', days: 1 }
]

export default function Onboarding() {
    const toast = useToast()
    const { isAdmin } = useAuth()
    const [employees, setEmployees] = useState([])
    const [checklists, setChecklists] = useState([])
    const [selectedEmployee, setSelectedEmployee] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All')

    // Task Creation Form State
    const [showAddTaskModal, setShowAddTaskModal] = useState(false)
    const [taskForm, setTaskForm] = useState({
        task_name: '',
        category: 'HR',
        due_days: 3,
        assigned_to: ''
    })

    useEffect(() => {
        fetchInitialData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchInitialData = async () => {
        try {
            setLoading(true)
            // 1. Fetch active employees
            const { data: emps, error: empError } = await supabase
                .from('employees')
                .select('id, first_name, last_name, employee_id, designation, department, joining_date')
                .eq('status', 'active')
                .order('joining_date', { ascending: false })

            if (empError) throw empError
            setEmployees(emps || [])

            if (emps && emps.length > 0) {
                setSelectedEmployee(emps[0].id)
                await fetchChecklist(emps[0].id)
            } else {
                setLoading(false)
            }
        } catch (error) {
            console.error('Error fetching initial onboarding data:', error)
            toast.error('Failed to load onboarding list.')
            setLoading(false)
        }
    }

    const fetchChecklist = async (employeeId) => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('onboarding_checklists')
                .select('*')
                .eq('employee_id', employeeId)
                .order('created_at', { ascending: true })

            if (error) throw error
            setChecklists(data || [])
        } catch (error) {
            console.error('Error fetching checklist:', error)
            toast.error('Failed to load employee onboarding checklist.')
        } finally {
            setLoading(false)
        }
    }

    const handleEmployeeChange = async (e) => {
        const empId = e.target.value
        setSelectedEmployee(empId)
        await fetchChecklist(empId)
    }

    // Initialize Default Onboarding Checklist
    const initializeDefaultChecklist = async () => {
        if (!selectedEmployee) return
        try {
            setSubmitting(true)
            const targetEmployee = employees.find(e => e.id === selectedEmployee)
            const joining = targetEmployee?.joining_date ? new Date(targetEmployee.joining_date) : new Date()

            const payload = DEFAULT_TASKS.map(task => {
                const dueDate = new Date(joining)
                dueDate.setDate(dueDate.getDate() + task.days)

                return {
                    employee_id: selectedEmployee,
                    task_name: task.task_name,
                    category: task.category,
                    due_date: dueDate.toISOString().split('T')[0],
                    status: 'pending',
                    assigned_to: task.category === 'IT' ? 'IT Admin' : 'HR Specialist'
                }
            })

            const { error } = await supabase
                .from('onboarding_checklists')
                .insert(payload)

            if (error) throw error

            toast.success('Initialized default onboarding checklist!')
            await fetchChecklist(selectedEmployee)
        } catch (error) {
            console.error('Error initializing checklist:', error)
            toast.error('Failed to initialize default onboarding tasks.')
        } finally {
            setSubmitting(false)
        }
    }

    // Toggle Task Status
    const toggleTaskStatus = async (task) => {
        const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
        try {
            const { error } = await supabase
                .from('onboarding_checklists')
                .update({ status: nextStatus, updated_at: new Date().toISOString() })
                .eq('id', task.id)

            if (error) throw error
            toast.success(`Task marked as ${nextStatus}`)
            
            // Local state update for immediate feedback
            setChecklists(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t))
        } catch (error) {
            console.error('Error updating task status:', error)
            toast.error('Failed to update task status.')
        }
    }

    // Delete Task
    const deleteTask = async (taskId) => {
        try {
            const { error } = await supabase
                .from('onboarding_checklists')
                .delete()
                .eq('id', taskId)

            if (error) throw error
            toast.success('Task removed from checklist.')
            setChecklists(prev => prev.filter(t => t.id !== taskId))
        } catch (error) {
            console.error('Error deleting task:', error)
            toast.error('Failed to remove onboarding task.')
        }
    }

    // Create New Custom Task
    const handleCreateTask = async (e) => {
        e.preventDefault()
        if (!taskForm.task_name.trim()) return

        try {
            setSubmitting(true)
            const targetEmployee = employees.find(e => e.id === selectedEmployee)
            const baseDate = targetEmployee?.joining_date ? new Date(targetEmployee.joining_date) : new Date()
            baseDate.setDate(baseDate.getDate() + Number(taskForm.due_days))

            const payload = {
                employee_id: selectedEmployee,
                task_name: taskForm.task_name,
                category: taskForm.category,
                due_date: baseDate.toISOString().split('T')[0],
                status: 'pending',
                assigned_to: taskForm.assigned_to || 'HR Team'
            }

            const { error } = await supabase
                .from('onboarding_checklists')
                .insert([payload])

            if (error) throw error

            toast.success('Onboarding task added successfully.')
            setShowAddTaskModal(false)
            setTaskForm({
                task_name: '',
                category: 'HR',
                due_days: 3,
                assigned_to: ''
            })
            await fetchChecklist(selectedEmployee)
        } catch (error) {
            console.error('Error creating task:', error)
            toast.error('Failed to create custom task.')
        } finally {
            setSubmitting(false)
        }
    }

    const currentEmployee = employees.find(e => e.id === selectedEmployee)
    const completedTasks = checklists.filter(t => t.status === 'completed').length
    const totalTasks = checklists.length
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    const filteredTasks = checklists.filter(task => {
        const matchesSearch = task.task_name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = selectedCategory === 'All' || task.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    const categories = ['All', 'HR', 'IT', 'General', 'Document', 'Orientation']

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Onboarding Checklists</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Manage new hire setups, IT assets, orientations and induction milestones</p>
                </div>
                
                {/* Employee Selector */}
                <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Select New Hire</label>
                    <select
                        value={selectedEmployee}
                        onChange={handleEmployeeChange}
                        className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all min-w-[240px]"
                    >
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                                {emp.first_name} {emp.last_name} ({emp.employee_id})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Quick Stats Grid */}
            {currentEmployee && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Employee Profile */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                            {currentEmployee.first_name?.[0]}{currentEmployee.last_name?.[0]}
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">{currentEmployee.first_name} {currentEmployee.last_name}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">{currentEmployee.designation} &bull; {currentEmployee.department}</p>
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Joined {currentEmployee.joining_date}</p>
                        </div>
                    </div>

                    {/* Progress Card */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <span>Checklist Progress</span>
                            <span className="text-indigo-600 font-extrabold">{completedTasks}/{totalTasks} Completed</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                            <span className="text-xs font-bold text-gray-700 shrink-0">{progressPercent}%</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center justify-around">
                        {totalTasks === 0 ? (
                            <button
                                onClick={initializeDefaultChecklist}
                                disabled={submitting}
                                className="px-6 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                            >
                                <UserPlus className="w-4 h-4" /> Initialize Default Checklist
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowAddTaskModal(true)}
                                className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Add Custom Task
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Checklist Section */}
            {currentEmployee && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Controls Bar */}
                    <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/40">
                        {/* Categories Tabs */}
                        <div className="flex flex-wrap gap-1.5">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        selectedCategory === cat
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'bg-white text-gray-500 hover:text-slate-900 border border-gray-150'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs w-full bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                            />
                        </div>
                    </div>

                    {/* Table / List */}
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-10">
                                <TableSkeleton rows={5} cols={5} />
                            </div>
                        ) : filteredTasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-16 text-center">
                                <CheckSquare className="w-12 h-12 text-gray-300 mb-3" />
                                <h3 className="text-base font-bold text-gray-700">No onboarding tasks found</h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    {totalTasks === 0
                                        ? 'Checklist is empty. Initialize the default schedule above to get started!'
                                        : 'No tasks match your selected search or filter criteria.'}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-50 border-b border-gray-150 font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="p-4 w-12"></th>
                                        <th className="p-4">Task Details</th>
                                        <th className="p-4">Category</th>
                                        <th className="p-4">Due Date</th>
                                        <th className="p-4">Assigned To</th>
                                        {isAdmin && <th className="p-4 text-right">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTasks.map((task) => {
                                        const isCompleted = task.status === 'completed'
                                        const isOverdue = new Date(task.due_date) < new Date() && !isCompleted

                                        return (
                                            <tr key={task.id} className={`hover:bg-slate-50/50 transition-colors ${isCompleted ? 'bg-emerald-50/10' : ''}`}>
                                                <td className="p-4 text-center">
                                                    <button
                                                        onClick={() => toggleTaskStatus(task)}
                                                        className={`transition-transform duration-200 hover:scale-110 focus:outline-none`}
                                                    >
                                                        {isCompleted ? (
                                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                        ) : (
                                                            <Circle className="w-5 h-5 text-gray-300" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="p-4">
                                                    <p className={`font-bold text-sm ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                                        {task.task_name}
                                                    </p>
                                                    {isOverdue && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 mt-1">
                                                            <Clock className="w-3 h-3" /> Overdue
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                        task.category === 'HR' ? 'bg-blue-50 text-blue-600' :
                                                        task.category === 'IT' ? 'bg-violet-50 text-violet-600' :
                                                        task.category === 'Document' ? 'bg-amber-50 text-amber-600' :
                                                        'bg-gray-50 text-gray-600'
                                                    }`}>
                                                        {task.category}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold text-gray-600">
                                                    {task.due_date}
                                                </td>
                                                <td className="p-4 font-bold text-slate-500">
                                                    {task.assigned_to || 'HR Team'}
                                                </td>
                                                {isAdmin && (
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => deleteTask(task.id)}
                                                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Custom Task Addition Modal */}
            {showAddTaskModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Add Custom Onboarding Task</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Define a setup step for {currentEmployee?.first_name}</p>
                            </div>
                            <button onClick={() => setShowAddTaskModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTask} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Task Description*</label>
                                <textarea
                                    required
                                    value={taskForm.task_name}
                                    onChange={(e) => setTaskForm(prev => ({ ...prev, task_name: e.target.value }))}
                                    placeholder="e.g. Set up office access card and register biometric ID"
                                    className="w-full text-xs border border-gray-200 rounded-xl p-3 bg-gray-50 min-h-[80px]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Category</label>
                                    <select
                                        value={taskForm.category}
                                        onChange={(e) => setTaskForm(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5"
                                    >
                                        <option value="HR">HR</option>
                                        <option value="IT">IT Setup</option>
                                        <option value="General">General</option>
                                        <option value="Document">Document</option>
                                        <option value="Orientation">Orientation</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Due Days (from Joining)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={taskForm.due_days}
                                        onChange={(e) => setTaskForm(prev => ({ ...prev, due_days: e.target.value }))}
                                        className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 font-bold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">Assigned To</label>
                                <input
                                    type="text"
                                    value={taskForm.assigned_to}
                                    onChange={(e) => setTaskForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                                    placeholder="e.g. IT Administrator, HR Lead"
                                    className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 font-bold"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 p-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddTaskModal(false)}
                                    className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                                >
                                    Add Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
