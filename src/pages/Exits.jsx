import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { calculateSettlement, formatCurrency } from '../lib/payrollUtils'
import { logger, devLog } from '../lib/devLogger'
import { LogOut, AlertTriangle, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useEmployees } from '../hooks/useEmployees'
import {
    useExits,
    useCreateExit,
    useUpdateExitStatus,
    useUpdateExitClearance,
    useUpdateExitSettlement
} from '../hooks/useExitsData'

// Subcomponents
import ExitStats from '../components/exits/ExitStats'
import ExitsTable from '../components/exits/ExitsTable'
import InitiateExitModal from '../components/exits/InitiateExitModal'
import ExitDetailWorkflowModal from '../components/exits/ExitDetailWorkflowModal'

export default function Exits() {
    const { isAdmin, user } = useAuth()
    const toast = useToast()

    // React Query Queries
    const { data: exits = [], isLoading: loadingExits } = useExits()
    const { data: employeesResponse, isLoading: loadingEmployees } = useEmployees({ page: 0, pageSize: 1000 })
    
    const rawEmployees = useMemo(() => {
        return Array.isArray(employeesResponse) ? employeesResponse : employeesResponse?.data || []
    }, [employeesResponse])

    const loading = loadingExits || loadingEmployees

    // React Query Mutations
    const createExitMutation = useCreateExit()
    const updateExitStatusMutation = useUpdateExitStatus()
    const updateExitClearanceMutation = useUpdateExitClearance()
    const updateExitSettlementMutation = useUpdateExitSettlement()

    // Map employees and build active list
    const { employees, employeeMap } = useMemo(() => {
        const active = rawEmployees.filter(e => e.status === 'active')
        const map = {}
        rawEmployees.forEach(e => map[e.id] = e)
        return { employees: active, employeeMap: map }
    }, [rawEmployees])

    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [selectedExit, setSelectedExit] = useState(null)
    const [notification, setNotification] = useState(null)

    // Clear notification after 5s
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [notification])

    const [formData, setFormData] = useState({
        employee_id: '',
        exit_date: '',
        resignation_date: new Date().toISOString().split('T')[0],
        reason: 'Resignation',
        interview_notes: '',
        status: 'pending'
    })

    const handleCreateExit = async (e) => {
        if (e) e.preventDefault()
        try {
            await createExitMutation.mutateAsync(formData)

            setIsProcessModalOpen(false)
            setFormData({
                employee_id: '',
                exit_date: '',
                resignation_date: new Date().toISOString().split('T')[0],
                reason: 'Resignation',
                interview_notes: '',
                status: 'pending'
            })
        } catch (error) {
            toast.error(error.message)
        }
    }

    const updateExitStatus = async (exitId, newStatus) => {
        try {
            await updateExitStatusMutation.mutateAsync({
                id: exitId,
                status: newStatus,
                employeeId: selectedExit?.employee_id
            })

            // Update local state immediately for better UX
            if (selectedExit?.id === exitId) {
                setSelectedExit(prev => ({ ...prev, status: newStatus }))
            }

            setNotification({ type: 'success', message: `Exit status updated to ${newStatus} successfully.` })
        } catch (error) {
            setNotification({ type: 'error', message: error.message })
        }
    }

    const toggleClearance = async (exitId, dept) => {
        if (!selectedExit) return

        const field = `${dept.toLowerCase()}_clearance`
        const newVal = !selectedExit[field]

        try {
            devLog(`Toggling ${dept} clearance for exit ${exitId} to ${newVal}`)

            await updateExitClearanceMutation.mutateAsync({
                id: exitId,
                department: dept,
                isCleared: newVal,
                reviewerUserId: user.id
            })

            // Update local state immediately
            setSelectedExit(prev => ({
                ...prev,
                [field]: newVal,
                [`${dept.toLowerCase()}_clearance_by`]: newVal ? user.id : null
            }))

            setNotification({ type: 'success', message: `${dept} clearance updated successfully.` })
        } catch (error) {
            logger.error('Clearance Update Error:', error)
            setNotification({ type: 'error', message: `Failed to update ${dept} clearance: ${error.message}` })
        }
    }

    const handleSettlementUpdate = async (exitId, amount, details) => {
        try {
            await updateExitSettlementMutation.mutateAsync({
                id: exitId,
                amount,
                details
            })

            if (selectedExit?.id === exitId) {
                setSelectedExit(prev => ({ ...prev, settlement_amount: amount, settlement_details: details }))
            }

            setNotification({ type: 'success', message: 'Settlement details updated successfully.' })
        } catch (error) {
            setNotification({ type: 'error', message: error.message })
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-amber-100 text-amber-700'
            case 'approved': return 'bg-blue-100 text-blue-700'
            case 'clearance': return 'bg-purple-100 text-purple-700'
            case 'settlement': return 'bg-indigo-100 text-indigo-700'
            case 'completed': return 'bg-emerald-100 text-emerald-700'
            case 'rejected': return 'bg-rose-100 text-rose-700'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500">
                <AlertTriangle className="h-12 w-12 mb-4 text-yellow-500" />
                <h2 className="text-xl font-medium">Access Restricted</h2>
                <p>Only administrators can manage exit processes.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Notifications */}
            {notification && (
                <div className="fixed top-8 right-8 z-50 animate-in slide-in-from-right duration-300">
                    <div className={`flex items-center space-x-3 px-6 py-4 rounded-2xl shadow-2xl border ${
                        notification.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
                    }`}>
                        {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-rose-500" />}
                        <span className="text-sm font-bold">{notification.message}</span>
                        <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded-full transition-colors cursor-pointer">
                            <X className="w-4 h-4 opacity-50" />
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Exit Workflow Management</h2>
                        <p className="text-sm text-gray-500 mt-1">Manage employee resignations, clearances, and final settlements.</p>
                    </div>
                    <button
                        onClick={() => setIsProcessModalOpen(true)}
                        className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 transition shadow-sm cursor-pointer"
                    >
                        <LogOut className="h-4 w-4" />
                        <span className="text-sm font-bold">Initiate Exit</span>
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <ExitStats exits={exits} />

            {/* Table layout */}
            <ExitsTable
                exits={exits}
                loading={loading}
                employeeMap={employeeMap}
                onRowClick={(record) => {
                    setSelectedExit(record)
                    setIsDetailModalOpen(true)
                }}
                getStatusColor={getStatusColor}
            />

            {/* Initiate Exit Modal */}
            <InitiateExitModal
                isOpen={isProcessModalOpen}
                onClose={() => setIsProcessModalOpen(false)}
                employees={employees}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleCreateExit}
            />

            {/* Exit Detail & Clearance Workflow Modal */}
            <ExitDetailWorkflowModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                selectedExit={selectedExit}
                setSelectedExit={setSelectedExit}
                employeeMap={employeeMap}
                onStatusUpdate={updateExitStatus}
                onClearanceToggle={toggleClearance}
                onSettlementUpdate={handleSettlementUpdate}
                getStatusColor={getStatusColor}
                calculateSettlement={calculateSettlement}
                formatCurrency={formatCurrency}
            />
        </div>
    )
}
