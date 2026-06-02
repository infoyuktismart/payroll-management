import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { CheckCircle2, Circle, Clock, Plus, Trash2, UserPlus, CheckSquare, Search, X, ChevronDown, Check } from 'lucide-react'
import { TableSkeleton } from '../components/ui/SkeletonLoader'
import { useEmployees } from '../hooks/useEmployees'
import { useFocusTrap } from '../hooks/useFocusTrap'
import {
    useOnboardingChecklist,
    useCreateOnboardingTasks,
    useToggleTaskStatus,
    useDeleteOnboardingTask
} from '../hooks/useOnboardingData'
import { logger } from '../lib/devLogger'

const DEFAULT_TASKS = [
    { task_name: 'Collect Aadhaar, PAN, Bank Details', category: 'HR', days: 2 },
    { task_name: 'Sign Employment Agreement & NDA', category: 'HR', days: 2 },
    { task_name: 'Allocate Laptop, Charger & Workspace', category: 'IT', days: 1 },
    { task_name: 'Configure Email & Slack Accounts', category: 'IT', days: 1 },
    { task_name: 'HR Orientation & Company Policies Induction', category: 'HR', days: 3 },
    { task_name: 'Team Meet & Greet Session', category: 'General', days: 5 },
    { task_name: 'Introduce to Reporting Manager', category: 'General', days: 1 }
]

const STANDARD_ROLES = [
    'HR Specialist',
    'HR Manager',
    'HR Team',
    'IT Admin',
    'IT Support',
    'Facilities Coordinator',
    'Reporting Manager',
    'Finance Specialist',
    'Office Admin'
]

function EmployeeCombobox({ employees, selectedId, onChange }) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.employee-combobox')) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filtered = employees.filter(emp =>
        emp.first_name.toLowerCase().includes(search.toLowerCase()) ||
        emp.last_name.toLowerCase().includes(search.toLowerCase()) ||
        emp.employee_id.toLowerCase().includes(search.toLowerCase())
    )

    const selectedEmp = employees.find(e => e.id === selectedId)

    return (
        <div className="relative employee-combobox min-w-[280px]">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
            >
                <div className="flex flex-col items-start overflow-hidden text-left">
                    <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-slate-400">New Hire</span>
                    <span className="text-sm font-bold text-slate-800 truncate w-full leading-tight">
                        {selectedEmp ? `${selectedEmp.first_name} ${selectedEmp.last_name} (${selectedEmp.employee_id})` : 'Select New Hire'}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search by name or ID..."
                                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-medium text-slate-700"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                        {filtered.length > 0 ? (
                            filtered.map(emp => (
                                <div
                                    key={emp.id}
                                    onClick={() => {
                                        onChange(emp.id)
                                        setIsOpen(false)
                                        setSearch('')
                                    }}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedId === emp.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-slate-800">{emp.first_name} {emp.last_name}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">{emp.employee_id} • {emp.designation || 'Employee'}</p>
                                    </div>
                                    {selectedId === emp.id && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-6 text-center text-xs text-slate-400 italic">
                                No employees found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function Onboarding() {
    const toast = useToast()
    const { isAdmin } = useAuth()
    const [selectedEmployee, setSelectedEmployee] = useState('')
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

    const [showRolesDropdown, setShowRolesDropdown] = useState(false)
    const [activeRoleIndex, setActiveRoleIndex] = useState(-1)

    const filteredRoles = useMemo(() => {
        const query = taskForm.assigned_to.trim().toLowerCase()
        if (!query) return STANDARD_ROLES
        return STANDARD_ROLES.filter(role => role.toLowerCase().includes(query))
    }, [taskForm.assigned_to])

    useEffect(() => {
        setActiveRoleIndex(-1)
    }, [filteredRoles])

    const handleAssignedToKeyDown = (e) => {
        if (!showRolesDropdown) {
            if (e.key === 'ArrowDown') {
                setShowRolesDropdown(true)
                e.preventDefault()
            }
            return
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setActiveRoleIndex(prev => (prev + 1) % filteredRoles.length)
                break
            case 'ArrowUp':
                e.preventDefault()
                setActiveRoleIndex(prev => (prev - 1 + filteredRoles.length) % filteredRoles.length)
                break
            case 'Enter':
                if (activeRoleIndex >= 0 && activeRoleIndex < filteredRoles.length) {
                    e.preventDefault()
                    setTaskForm(prev => ({ ...prev, assigned_to: filteredRoles[activeRoleIndex] }))
                    setShowRolesDropdown(false)
                }
                break
            case 'Escape':
                e.preventDefault()
                setShowRolesDropdown(false)
                break
            default:
                break
        }
    }

    const taskModalRef = useFocusTrap(showAddTaskModal)

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') setShowAddTaskModal(false)
        }
        if (showAddTaskModal) document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [showAddTaskModal])

    // React Query hooks
    const { data: employeesResponse, isLoading: loadingEmployees } = useEmployees({ page: 0, pageSize: 1000 })
    const allEmployees = useMemo(() => {
        return Array.isArray(employeesResponse) ? employeesResponse : employeesResponse?.data || []
    }, [employeesResponse])
    const employees = useMemo(
        () => allEmployees.filter(e => e.status === 'active').sort((a, b) => new Date(b.joining_date) - new Date(a.joining_date)),
        [allEmployees]
    )

    // Initialize default selected employee once employees load
    useEffect(() => {
        if (employees.length > 0 && !selectedEmployee) {
            setSelectedEmployee(employees[0].id)
        }
    }, [employees, selectedEmployee])

    const { data: checklists = [], isLoading: loadingChecklist } = useOnboardingChecklist(selectedEmployee)
    const createTasksMutation = useCreateOnboardingTasks()
    const toggleStatusMutation = useToggleTaskStatus()
    const deleteTaskMutation = useDeleteOnboardingTask()

    const loading = loadingEmployees || loadingChecklist

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

            await createTasksMutation.mutateAsync(payload)
            toast.success('Initialized default onboarding checklist!')
        } catch (error) {
            logger.error('Error initializing checklist:', error)
            toast.error('Failed to initialize default onboarding tasks.')
        } finally {
            setSubmitting(false)
        }
    }

    // Toggle Task Status
    const toggleTaskStatus = (task) => {
        const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
        toggleStatusMutation.mutate({ id: task.id, status: nextStatus }, {
            onSuccess: () => toast.success(`Task marked as ${nextStatus}`),
            onError: (err) => toast.error(err.message || 'Failed to update task status.')
        })
    }

    // Delete Task
    const deleteTask = (taskId) => {
        deleteTaskMutation.mutate(taskId, {
            onSuccess: () => toast.success('Task removed from checklist.'),
            onError: (err) => toast.error(err.message || 'Failed to remove onboarding task.')
        })
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

            await createTasksMutation.mutateAsync([payload])
            toast.success('Onboarding task added successfully.')
            setShowAddTaskModal(false)
            setTaskForm({ task_name: '', category: 'HR', due_days: 3, assigned_to: '' })
        } catch (error) {
            logger.error('Error creating task:', error)
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
                    <label className="text-xs font-bold text-gray-650 uppercase tracking-wider">Select New Hire</label>
                    <EmployeeCombobox
                        employees={employees}
                        selectedId={selectedEmployee}
                        onChange={setSelectedEmployee}
                    />
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
                                <p className="text-xs text-gray-600 mt-1">
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
                                                    <p className={`font-bold text-sm ${isCompleted ? 'text-gray-600 line-through' : 'text-gray-800'}`}>
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
                                                            className="p-1.5 text-gray-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
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
                    <div
                        ref={taskModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="onboarding-modal-title"
                        className="bg-white rounded-3xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200"
                    >
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl">
                            <div>
                                <h3 id="onboarding-modal-title" className="text-lg font-bold text-gray-900">Add Custom Onboarding Task</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Define a setup step for {currentEmployee?.first_name}</p>
                            </div>
                            <button
                                onClick={() => setShowAddTaskModal(false)}
                                aria-label="Close modal"
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X aria-hidden="true" className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTask} className="p-6 space-y-4">
                            <div>
                                <label htmlFor="task-name" className="block text-xs font-bold text-gray-700 mb-1.5">Task Description*</label>
                                <textarea
                                    id="task-name"
                                    required
                                    value={taskForm.task_name}
                                    onChange={(e) => setTaskForm(prev => ({ ...prev, task_name: e.target.value }))}
                                    placeholder="e.g. Set up office access card and register biometric ID"
                                    className="w-full text-xs border border-gray-200 rounded-xl p-3 bg-gray-50 min-h-[80px]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="task-category" className="block text-xs font-bold text-gray-700 mb-1.5">Category</label>
                                    <select
                                        id="task-category"
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
                                    <label htmlFor="task-due-days" className="block text-xs font-bold text-gray-700 mb-1.5">Due Days (from Joining)</label>
                                    <input
                                        id="task-due-days"
                                        type="number"
                                        min="1"
                                        required
                                        value={taskForm.due_days}
                                        onChange={(e) => setTaskForm(prev => ({ ...prev, due_days: e.target.value }))}
                                        className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 font-bold"
                                    />
                                </div>
                            </div>
                            <div className="relative">
                                <label htmlFor="task-assigned-to" className="block text-xs font-bold text-gray-700 mb-1.5">Assigned To</label>
                                <input
                                    id="task-assigned-to"
                                    type="text"
                                    value={taskForm.assigned_to}
                                    onChange={(e) => {
                                        setTaskForm(prev => ({ ...prev, assigned_to: e.target.value }))
                                        setShowRolesDropdown(true)
                                    }}
                                    onFocus={() => setShowRolesDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowRolesDropdown(false), 200)}
                                    onKeyDown={handleAssignedToKeyDown}
                                    placeholder="e.g. IT Administrator, HR Lead"
                                    className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 font-bold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                    autoComplete="off"
                                />
                                {showRolesDropdown && (
                                    <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-150 rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-gray-50">
                                        {filteredRoles.length > 0 ? (
                                            filteredRoles.map((role, idx) => (
                                                <button
                                                    key={role}
                                                    type="button"
                                                    onMouseDown={() => {
                                                        setTaskForm(prev => ({ ...prev, assigned_to: role }))
                                                        setShowRolesDropdown(false)
                                                    }}
                                                    className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors ${
                                                        idx === activeRoleIndex ? 'bg-indigo-50 text-indigo-900' : 'text-gray-700'
                                                    }`}
                                                >
                                                    {role}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-4 py-2 text-xs text-gray-500 italic">
                                                Press enter or continue typing...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 p-6 rounded-b-3xl">
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
