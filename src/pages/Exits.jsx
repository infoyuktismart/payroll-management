import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { format } from 'date-fns'
import { calculateSettlement, formatCurrency } from '../lib/payrollUtils'
import { logger, devLog } from '../lib/devLogger'
import {
    LogOut, AlertTriangle, CheckCircle2,
    Clock, Wrench, DollarSign, UserCheck, ShieldCheck,
    ChevronRight, Info, AlertCircle, Check, X
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import { TableRowSkeleton } from '../components/ui/SkeletonLoader'
import { useEmployees } from '../hooks/useEmployees'
import {
    useExits,
    useCreateExit,
    useUpdateExitStatus,
    useUpdateExitClearance,
    useUpdateExitSettlement
} from '../hooks/useExitsData'

const StatCard = ({ title, value, icon: Icon, colorClass, borderClass }) => (
    <div className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-default group border-l-[6px] ${borderClass}`}>
        <div>
            <p className="text-[11px] font-bold text-gray-600 mb-1 group-hover:text-gray-500 transition-colors uppercase tracking-widest">{title}</p>
            <p className="text-3xl font-bold text-gray-900 group-hover:scale-105 transition-transform origin-left">{value}</p>
        </div>
        <div className={`p-3 rounded-xl transition-all duration-300 group-hover:rotate-12 group-hover:scale-110 shadow-sm ${colorClass}`}>
            <Icon className="w-5 h-5" />
        </div>
    </div>
)

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
        e.preventDefault()
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

    const getSelectedSettlement = () => {
        const employee = employeeMap[selectedExit?.employee_id]
        return calculateSettlement(employee, selectedExit, employee?.leave_balance || 0)
    }

    const saveCalculatedSettlement = async () => {
        if (!selectedExit) return
        const settlement = getSelectedSettlement()
        await handleSettlementUpdate(selectedExit.id, settlement.finalAmount, settlement)
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
                <div className={`fixed top-8 right-8 z-50 animate-in slide-in-from-right duration-300`}>
                    <div className={`flex items-center space-x-3 px-6 py-4 rounded-2xl shadow-2xl border ${notification.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
                        }`}>
                        {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-rose-500" />}
                        <span className="text-sm font-bold">{notification.message}</span>
                        <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                            <X className="w-4 h-4 opacity-50" />
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-sm text-gray-500 mt-1">Manage employee resignations, clearances, and final settlements.</p>
                    </div>
                    <button
                        onClick={() => setIsProcessModalOpen(true)}
                        className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition shadow-sm"
                    >
                        <LogOut className="h-4 w-4" />
                        <span className="text-sm font-bold">Initiate Exit</span>
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Pending Requests"
                    value={exits.filter(e => e.status === 'pending').length}
                    icon={Clock}
                    colorClass="bg-amber-50 text-amber-600"
                    borderClass="border-l-4 border-l-amber-500"
                />
                <StatCard
                    title="In Clearance"
                    value={exits.filter(e => e.status === 'clearance').length}
                    icon={Wrench}
                    colorClass="bg-indigo-50 text-indigo-600"
                    borderClass="border-l-4 border-l-indigo-500"
                />
                <StatCard
                    title="Final Settlement"
                    value={exits.filter(e => e.status === 'settlement').length}
                    icon={DollarSign}
                    colorClass="bg-emerald-50 text-emerald-600"
                    borderClass="border-l-4 border-l-emerald-500"
                />
                <StatCard
                    title="Completed Exits"
                    value={exits.filter(e => e.status === 'completed').length}
                    icon={CheckCircle2}
                    colorClass="bg-blue-50 text-blue-600"
                    borderClass="border-l-4 border-l-blue-500"
                />
            </div>

            <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-100 mt-6">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Dates</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                        {loading ? (
                            <>
                                <TableRowSkeleton cols={5} />
                                <TableRowSkeleton cols={5} />
                                <TableRowSkeleton cols={5} />
                                <TableRowSkeleton cols={5} />
                                <TableRowSkeleton cols={5} />
                            </>
                        ) : exits.length === 0 ? (
                            <tr><td colSpan="5" className="text-center py-12 text-gray-600">No exit records found</td></tr>
                        ) : (
                            exits.map((record) => {
                                const emp = employeeMap[record.employee_id] || {}
                                return (
                                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => { setSelectedExit(record); setIsDetailModalOpen(true); }}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs mr-3">
                                                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-gray-900">{emp.first_name} {emp.last_name}</div>
                                                    <div className="text-xs text-gray-500">{emp.designation}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-xs text-gray-500">Resigned: {format(new Date(record.resignation_date), 'MMM d, yyyy')}</div>
                                            <div className="text-xs font-bold text-gray-700">LWD: {record.last_working_day ? format(new Date(record.last_working_day), 'MMM d, yyyy') : 'TBD'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-600 uppercase">
                                                {record.reason}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusColor(record.status)}`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className="text-slate-400 hover:text-slate-900">
                                                <ChevronRight className="h-5 w-5" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Initiate Exit Modal */}
            <Modal
                isOpen={isProcessModalOpen}
                onClose={() => setIsProcessModalOpen(false)}
                title="Initiate Employee Exit"
            >
                <form onSubmit={handleCreateExit} className="space-y-4 pt-2">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Select Employee</label>
                        <select required
                            className="block w-full bg-gray-50 border-gray-200 rounded-xl shadow-sm text-sm font-medium focus:ring-slate-900 focus:border-slate-900"
                            value={formData.employee_id}
                            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                        >
                            <option value="">Select Employee</option>
                            {employees.map(e => (
                                <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.designation})</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Resignation Date</label>
                            <input type="date" required
                                className="block w-full bg-gray-50 border-gray-200 rounded-xl shadow-sm text-sm font-medium focus:ring-slate-900 focus:border-slate-900"
                                value={formData.resignation_date}
                                onChange={(e) => setFormData({ ...formData, resignation_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Expected LWD</label>
                            <input type="date" required
                                className="block w-full bg-gray-50 border-gray-200 rounded-xl shadow-sm text-sm font-medium focus:ring-slate-900 focus:border-slate-900"
                                value={formData.exit_date}
                                onChange={(e) => setFormData({ ...formData, exit_date: e.target.value, last_working_day: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reason for Exit</label>
                        <select
                            className="block w-full bg-gray-50 border-gray-200 rounded-xl shadow-sm text-sm font-medium focus:ring-slate-900 focus:border-slate-900"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        >
                            <option value="Resignation">Resignation</option>
                            <option value="Termination">Termination</option>
                            <option value="Retirement">Retirement</option>
                            <option value="Layoff">Layoff</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Internal Notes</label>
                        <textarea
                            className="block w-full bg-gray-50 border-gray-200 rounded-xl shadow-sm text-sm font-medium focus:ring-slate-900 focus:border-slate-900"
                            rows="3"
                            placeholder="Exit interview summary or termination details..."
                            value={formData.interview_notes}
                            onChange={(e) => setFormData({ ...formData, interview_notes: e.target.value })}
                        ></textarea>
                    </div>

                    <div className="flex justify-end pt-4 space-x-3">
                        <button type="button" onClick={() => setIsProcessModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Cancel</button>
                        <button type="submit" className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-sm">Process Exit</button>
                    </div>
                </form>
            </Modal>

            {/* Exit Detail & Workflow Modal */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title="Exit Workflow Management"
                maxWidth="3xl"
            >
                {selectedExit && (
                    <div className="space-y-6 pt-2">
                        {/* Header Details */}
                        <div className="flex items-center justify-between bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <div className="flex items-center">
                                <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-black text-lg mr-4 shadow-sm">
                                    {employeeMap[selectedExit.employee_id]?.first_name?.[0]}
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">{employeeMap[selectedExit.employee_id]?.first_name} {employeeMap[selectedExit.employee_id]?.last_name}</h3>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{employeeMap[selectedExit.employee_id]?.designation} • {employeeMap[selectedExit.employee_id]?.department}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusColor(selectedExit.status)}`}>
                                    {selectedExit.status}
                                </span>
                            </div>
                        </div>

                        {/* Workflow Stages */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Actions Stage */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Process Actions</h4>
                                <div className="space-y-2">
                                    {selectedExit.status === 'pending' && (
                                        <>
                                            <button onClick={() => updateExitStatus(selectedExit.id, 'approved')} className="w-full flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition border border-blue-100">
                                                <span className="text-xs font-bold">Approve Resignation</span>
                                                <UserCheck className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => updateExitStatus(selectedExit.id, 'rejected')} className="w-full flex items-center justify-between p-3 bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100 transition border border-rose-100">
                                                <span className="text-xs font-bold">Reject Resignation</span>
                                                <X className="h-4 w-4" />
                                            </button>
                                        </>
                                    )}
                                    {selectedExit.status === 'approved' && (
                                        <button onClick={() => updateExitStatus(selectedExit.id, 'clearance')} className="w-full flex items-center justify-between p-3 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition border border-purple-100">
                                            <span className="text-xs font-bold">Initiate Clearance</span>
                                            <ShieldCheck className="h-4 w-4" />
                                        </button>
                                    )}
                                    {selectedExit.status === 'clearance' && (
                                        <button onClick={() => updateExitStatus(selectedExit.id, 'settlement')} className="w-full flex items-center justify-between p-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition border border-indigo-100">
                                            <span className="text-xs font-bold">Proceed to Settlement</span>
                                            <DollarSign className="h-4 w-4" />
                                        </button>
                                    )}
                                    {selectedExit.status === 'settlement' && (
                                        <button onClick={() => updateExitStatus(selectedExit.id, 'completed')} className="w-full flex items-center justify-between p-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition border border-emerald-100">
                                            <span className="text-xs font-bold">Finalize Exit</span>
                                            <CheckCircle2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Clearances Stage */}
                            <div className="md:col-span-2 space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Departmental Clearances</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'IT', icon: Wrench },
                                        { id: 'Finance', icon: DollarSign },
                                        { id: 'HR', icon: Info },
                                        { id: 'Admin', icon: ShieldCheck }
                                    ].map((dept) => {
                                        const isCleared = selectedExit[`${dept.id.toLowerCase()}_clearance`]
                                        const Icon = dept.icon
                                        return (
                                            <div key={dept.id} className={`p-4 rounded-2xl border transition-all ${isCleared ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className={`p-2 rounded-xl ${isCleared ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <button
                                                        disabled={selectedExit.status !== 'clearance'}
                                                        onClick={() => toggleClearance(selectedExit.id, dept.id)}
                                                        className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${isCleared ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300 hover:text-slate-600'}`}
                                                    >
                                                        <Check className="h-3 w-3" />
                                                    </button>
                                                </div>
                                                <p className="text-xs font-black text-slate-900">{dept.id} Clearance</p>
                                                <p className="text-[10px] text-slate-400 mt-1 font-bold">{isCleared ? 'Completed' : 'Pending Action'}</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Settlement Section */}
                        {(selectedExit.status === 'settlement' || selectedExit.status === 'completed') && (
                            <div className="pt-6 border-t border-slate-100 space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Final Settlement Details</h4>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center text-sm font-bold">
                                                <span className="text-slate-500">Notice Recovery</span>
                                                <span className="text-slate-900">{formatCurrency(getSelectedSettlement().noticeRecovery)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm font-bold">
                                                <span className="text-slate-500">Gratuity</span>
                                                <span className="text-slate-900">{formatCurrency(getSelectedSettlement().gratuity)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm font-bold">
                                                <span className="text-slate-500">Leave Encashment</span>
                                                <span className="text-slate-900">{formatCurrency(getSelectedSettlement().leaveEncashment)}</span>
                                            </div>
                                            <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-lg font-black">
                                                <span className="text-slate-900">Final Pay</span>
                                                <span className="text-indigo-600">{formatCurrency(selectedExit.settlement_amount || getSelectedSettlement().finalAmount)}</span>
                                            </div>
                                        </div>
                                        <div>
                                            {selectedExit.status === 'settlement' && (
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase">Calculated Settlement</label>
                                                    <button
                                                        type="button"
                                                        onClick={saveCalculatedSettlement}
                                                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-3 font-black text-sm hover:bg-indigo-700 transition"
                                                    >
                                                        <DollarSign className="h-4 w-4" />
                                                        Save {formatCurrency(getSelectedSettlement().finalAmount)}
                                                    </button>
                                                    <p className="text-[10px] text-slate-400 font-bold italic">
                                                        Based on salary, leave balance, notice shortfall, and gratuity eligibility.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}
