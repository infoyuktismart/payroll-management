import { X, Check, Plus } from 'lucide-react'
import Modal from '../ui/Modal'

export default function AttendanceModals({
    isLeaveModalOpen,
    setIsLeaveModalOpen,
    leaveForm,
    setLeaveForm,
    leavePolicies,
    onSubmitLeave,
    isEditModalOpen,
    setIsEditModalOpen,
    editForm,
    setEditForm,
    editingRecord,
    onSubmitEdit,
    confirmModal,
    setConfirmModal,
    employees,
    submitting
}) {
    return (
        <>
            {/* Apply Leave Modal */}
            <Modal 
                isOpen={isLeaveModalOpen} 
                onClose={() => setIsLeaveModalOpen(false)} 
                title={
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Apply for Leave</h3>
                        <p className="text-sm text-gray-400 font-medium mt-1">Submit a new leave application for approval.</p>
                    </div>
                }
            >
                <form onSubmit={onSubmitLeave} className="space-y-5 pb-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">Employee *</label>
                        <select 
                            required 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" 
                            value={leaveForm.employee_id} 
                            onChange={(e) => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}
                        >
                            <option value="">Search Employee ID or Name</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">Leave Type *</label>
                        <select 
                            required 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" 
                            value={leaveForm.leave_type} 
                            onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                        >
                            {leavePolicies.map(policy => (
                                <option key={policy.leave_type} value={policy.leave_type}>
                                    {policy.leave_type}
                                </option>
                            ))}
                            <option value="Unpaid Leave">Unpaid Leave</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700">Start Date *</label>
                            <input 
                                type="date" 
                                required 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" 
                                value={leaveForm.start_date} 
                                onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700">End Date *</label>
                            <input 
                                type="date" 
                                required 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" 
                                value={leaveForm.end_date} 
                                onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} 
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">Reason</label>
                        <textarea 
                            rows="4" 
                            placeholder="Enter reason for leave" 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium resize-none" 
                            value={leaveForm.reason} 
                            onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                        ></textarea>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button 
                            type="button" 
                            onClick={() => setIsLeaveModalOpen(false)} 
                            className="px-6 py-2.5 bg-slate-50 text-gray-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={submitting} 
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                            {submitting ? 'Submitting...' : 'Submit Application'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit Attendance Modal */}
            <Modal 
                isOpen={isEditModalOpen} 
                onClose={() => setIsEditModalOpen(false)} 
                title={
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Edit Attendance</h3>
                        <p className="text-sm text-gray-400 font-medium mt-1">Update attendance details for {editingRecord?.employee?.first_name} {editingRecord?.employee?.last_name}</p>
                    </div>
                }
            >
                <form onSubmit={onSubmitEdit} className="space-y-5 pb-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700">Check In</label>
                            <input 
                                type="time" 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" 
                                value={editForm.check_in || ''} 
                                onChange={(e) => setEditForm({ ...editForm, check_in: e.target.value })} 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700">Check Out</label>
                            <input 
                                type="time" 
                                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" 
                                value={editForm.check_out || ''} 
                                onChange={(e) => setEditForm({ ...editForm, check_out: e.target.value })} 
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">Status</label>
                        <select 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium" 
                            value={editForm.status || 'present'} 
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="half_day">Half Day</option>
                            <option value="weekly_off">Weekly Off</option>
                            <option value="late">Late</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">Remarks</label>
                        <textarea 
                            rows="3" 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium resize-none" 
                            value={editForm.remarks || ''} 
                            onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} 
                        />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                        <button 
                            type="button" 
                            onClick={() => setIsEditModalOpen(false)} 
                            className="px-6 py-2.5 bg-slate-50 text-gray-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={submitting} 
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                            {submitting ? 'Update...' : 'Update Attendance'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Custom Confirmation Modal */}
            <Modal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                title={
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${confirmModal.type === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                            {confirmModal.type === 'danger' ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">{confirmModal.title}</h3>
                    </div>
                }
            >
                <div className="space-y-6 pb-4">
                    <p className="text-gray-600 font-medium leading-relaxed">
                        {confirmModal.message}
                    </p>
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                            className="px-6 py-2.5 bg-slate-50 text-gray-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                if (confirmModal.onConfirm) {
                                    await confirmModal.onConfirm()
                                }
                                setConfirmModal({ ...confirmModal, isOpen: false })
                            }}
                            className={`px-6 py-2.5 ${confirmModal.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg text-sm font-bold transition-colors shadow-sm cursor-pointer`}
                        >
                            Confirm Action
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    )
}
