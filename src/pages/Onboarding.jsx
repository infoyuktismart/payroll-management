import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useEmployees } from '../hooks/useEmployees'
import {
    useOnboardingChecklist,
    useCreateOnboardingTasks,
    useToggleTaskStatus,
    useDeleteOnboardingTask
} from '../hooks/useOnboardingData'
import { logger } from '../lib/devLogger'

// Subcomponents
import OnboardingHeader from '../components/onboarding/OnboardingHeader'
import OnboardingStats from '../components/onboarding/OnboardingStats'
import OnboardingTable from '../components/onboarding/OnboardingTable'
import AddCustomTaskModal from '../components/onboarding/AddCustomTaskModal'

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

const CATEGORIES = ['All', 'HR', 'IT', 'General', 'Document', 'Orientation']

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
        if (e) e.preventDefault()
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <OnboardingHeader
                employees={employees}
                selectedEmployee={selectedEmployee}
                setSelectedEmployee={setSelectedEmployee}
            />

            <OnboardingStats
                currentEmployee={currentEmployee}
                completedTasks={completedTasks}
                totalTasks={totalTasks}
                progressPercent={progressPercent}
                submitting={submitting}
                initializeDefaultChecklist={initializeDefaultChecklist}
                onAddCustomTaskClick={() => setShowAddTaskModal(true)}
            />

            {currentEmployee && (
                <OnboardingTable
                    loading={loading}
                    totalTasks={totalTasks}
                    filteredTasks={filteredTasks}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    toggleTaskStatus={toggleTaskStatus}
                    deleteTask={deleteTask}
                    categories={CATEGORIES}
                    isAdmin={isAdmin}
                />
            )}

            <AddCustomTaskModal
                isOpen={showAddTaskModal}
                onClose={() => setShowAddTaskModal(false)}
                currentEmployee={currentEmployee}
                taskForm={taskForm}
                setTaskForm={setTaskForm}
                onSubmit={handleCreateTask}
                submitting={submitting}
                showRolesDropdown={showRolesDropdown}
                setShowRolesDropdown={setShowRolesDropdown}
                activeRoleIndex={activeRoleIndex}
                setActiveRoleIndex={setActiveRoleIndex}
                filteredRoles={filteredRoles}
                handleAssignedToKeyDown={handleAssignedToKeyDown}
            />
        </div>
    )
}
