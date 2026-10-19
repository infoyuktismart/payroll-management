import Modal from '../ui/Modal'

export default function InitiateExitModal({
    isOpen = false,
    onClose,
    employees = [],
    formData,
    setFormData,
    onSubmit
}) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Initiate Employee Exit"
        >
            <form onSubmit={onSubmit} className="space-y-4 pt-2">
                <div>
                    <label htmlFor="initiate-exit-employee-select" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Select Employee</label>
                    <select
                        id="initiate-exit-employee-select"
                        required
                        className="block w-full bg-gray-50 border-gray-200 rounded-xl shadow-sm text-sm font-medium focus:ring-slate-900 focus:border-slate-900 p-2.5 outline-none"
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
                        <label htmlFor="initiate-exit-resignation-date" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Resignation Date</label>
                        <input
                            id="initiate-exit-resignation-date"
                            type="date"
                            required
                            className="block w-full bg-gray-50 border-gray-200 rounded-xl shadow-sm text-sm font-medium focus:ring-slate-900 focus:border-slate-900 p-2.5 outline-none"
                            value={formData.resignation_date}
                            onChange={(e) => setFormData({ ...formData, resignation_date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label htmlFor="initiate-exit-exit-date" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Expected LWD</label>
                        <input
                            id="initiate-exit-exit-date"
                            type="date"
                            required
                            className="block w-full bg-gray-50 border-gray-200 rounded-xl shadow-sm text-sm font-medium focus:ring-slate-900 focus:border-slate-900 p-2.5 outline-none"
                            value={formData.exit_date}
                            onChange={(e) => setFormData({ ...formData, exit_date: e.target.value, last_working_day: e.target.value })}
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="initiate-exit-reason" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reason for Exit</label>
                    <select
                        id="initiate-exit-reason"
                        className="block w-full bg-gray-50 border-gray-200 rounded-xl shadow-sm text-sm font-medium focus:ring-slate-900 focus:border-slate-900 p-2.5 outline-none"
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
                    <label htmlFor="initiate-exit-notes" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Internal Notes</label>
                    <textarea
                        id="initiate-exit-notes"
                        className="block w-full bg-gray-50 border-gray-200 rounded-xl shadow-sm text-sm font-medium focus:ring-slate-900 focus:border-slate-900 p-3 outline-none"
                        rows="3"
                        placeholder="Exit interview summary or termination details..."
                        value={formData.interview_notes}
                        onChange={(e) => setFormData({ ...formData, interview_notes: e.target.value })}
                    ></textarea>
                </div>

                <div className="flex justify-end pt-4 space-x-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-sm cursor-pointer"
                    >
                        Process Exit
                    </button>
                </div>
            </form>
        </Modal>
    )
}
