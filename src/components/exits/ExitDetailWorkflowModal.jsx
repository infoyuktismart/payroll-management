import { UserCheck, X, ShieldCheck, DollarSign, CheckCircle2, Wrench, Info, Check } from 'lucide-react'
import Modal from '../ui/Modal'

export default function ExitDetailWorkflowModal({
    isOpen = false,
    onClose,
    selectedExit,
    setSelectedExit,
    employeeMap = {},
    onStatusUpdate,
    onClearanceToggle,
    onSettlementUpdate,
    getStatusColor,
    calculateSettlement,
    formatCurrency
}) {
    if (!selectedExit) return null

    const employee = employeeMap[selectedExit.employee_id] || {}

    const settlement = calculateSettlement
        ? calculateSettlement(employee, selectedExit, employee?.leave_balance || 0)
        : { noticeRecovery: 0, gratuity: 0, leaveEncashment: 0, finalAmount: 0 }

    const saveCalculatedSettlement = () => {
        if (onSettlementUpdate) {
            onSettlementUpdate(selectedExit.id, settlement.finalAmount, settlement)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Exit Workflow Management"
            maxWidth="3xl"
        >
            <div className="space-y-6 pt-2">
                {/* Header Details */}
                <div className="flex items-center justify-between bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="flex items-center">
                        <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-black text-lg mr-4 shadow-sm shrink-0">
                            {employee?.first_name?.[0]}
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900">{employee?.first_name} {employee?.last_name}</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {employee?.designation} &bull; {employee?.department}
                            </p>
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
                                    <button
                                        onClick={() => onStatusUpdate(selectedExit.id, 'approved')}
                                        className="w-full flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition border border-blue-100 cursor-pointer"
                                    >
                                        <span className="text-xs font-bold">Approve Resignation</span>
                                        <UserCheck className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => onStatusUpdate(selectedExit.id, 'rejected')}
                                        className="w-full flex items-center justify-between p-3 bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100 transition border border-rose-100 cursor-pointer"
                                    >
                                        <span className="text-xs font-bold">Reject Resignation</span>
                                        <X className="h-4 w-4" />
                                    </button>
                                </>
                            )}
                            {selectedExit.status === 'approved' && (
                                <button
                                    onClick={() => onStatusUpdate(selectedExit.id, 'clearance')}
                                    className="w-full flex items-center justify-between p-3 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition border border-purple-100 cursor-pointer"
                                >
                                    <span className="text-xs font-bold">Initiate Clearance</span>
                                    <ShieldCheck className="h-4 w-4" />
                                </button>
                            )}
                            {selectedExit.status === 'clearance' && (
                                <button
                                    onClick={() => onStatusUpdate(selectedExit.id, 'settlement')}
                                    className="w-full flex items-center justify-between p-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition border border-indigo-100 cursor-pointer"
                                >
                                    <span className="text-xs font-bold">Proceed to Settlement</span>
                                    <DollarSign className="h-4 w-4" />
                                </button>
                            )}
                            {selectedExit.status === 'settlement' && (
                                <button
                                    onClick={() => onStatusUpdate(selectedExit.id, 'completed')}
                                    className="w-full flex items-center justify-between p-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition border border-emerald-100 cursor-pointer"
                                >
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
                                    <div
                                        key={dept.id}
                                        className={`p-4 rounded-2xl border transition-all ${
                                            isCleared ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`p-2 rounded-xl ${isCleared ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <button
                                                disabled={selectedExit.status !== 'clearance'}
                                                onClick={() => onClearanceToggle(selectedExit.id, dept.id)}
                                                className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                                    isCleared ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300 hover:text-slate-600'
                                                }`}
                                            >
                                                <Check className="h-3 w-3" />
                                            </button>
                                        </div>
                                        <p className="text-xs font-black text-slate-900">{dept.id} Clearance</p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-bold">
                                            {isCleared ? 'Completed' : 'Pending Action'}
                                        </p>
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
                                        <span className="text-slate-900">{formatCurrency(settlement.noticeRecovery)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm font-bold">
                                        <span className="text-slate-500">Gratuity</span>
                                        <span className="text-slate-900">{formatCurrency(settlement.gratuity)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm font-bold">
                                        <span className="text-slate-500">Leave Encashment</span>
                                        <span className="text-slate-900">{formatCurrency(settlement.leaveEncashment)}</span>
                                    </div>
                                    <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-lg font-black">
                                        <span className="text-slate-900">Final Pay</span>
                                        <span className="text-indigo-600">
                                            {formatCurrency(selectedExit.settlement_amount || settlement.finalAmount)}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    {selectedExit.status === 'settlement' && (
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase">Calculated Settlement</label>
                                            <button
                                                type="button"
                                                onClick={saveCalculatedSettlement}
                                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-3 font-black text-sm hover:bg-indigo-700 transition cursor-pointer"
                                            >
                                                <DollarSign className="h-4 w-4" />
                                                Save {formatCurrency(settlement.finalAmount)}
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
        </Modal>
    )
}
