import { X } from 'lucide-react'

export default function ManualEntryTab({
    employees,
    manualForm,
    manualErrors,
    submitting,
    errorMessage,
    onSubmit,
    onInputChange
}) {
    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-full animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-slate-800 mb-6">Manual Attendance Entry</h3>

            {errorMessage && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-lg flex items-center space-x-3 text-rose-600">
                    <X className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-bold">{errorMessage}</p>
                </div>
            )}

            <form onSubmit={onSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Employee</label>
                        <select
                            required
                            className={`w-full px-4 py-2.5 bg-slate-50 border ${manualErrors.employee_id ? 'border-rose-500' : 'border-gray-100'} rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium`}
                            value={manualForm.employee_id}
                            onChange={(e) => onInputChange('employee_id', e.target.value)}
                        >
                            <option value="">Select employee</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                        </select>
                        {manualErrors.employee_id && <p className="text-[10px] font-bold text-rose-500 uppercase mt-1">{manualErrors.employee_id}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Date</label>
                        <input
                            type="date"
                            required
                            className={`w-full px-4 py-2.5 bg-slate-50 border ${manualErrors.date ? 'border-rose-500' : 'border-gray-100'} rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium`}
                            value={manualForm.date}
                            onChange={(e) => onInputChange('date', e.target.value)}
                        />
                        {manualErrors.date && <p className="text-[10px] font-bold text-rose-500 uppercase mt-1">{manualErrors.date}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Check In</label>
                        <input
                            type="time"
                            className={`w-full px-4 py-2.5 bg-slate-50 border ${manualErrors.check_in ? 'border-rose-500' : 'border-gray-100'} rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium`}
                            value={manualForm.check_in || ''}
                            onChange={(e) => onInputChange('check_in', e.target.value)}
                        />
                        {manualErrors.check_in && <p className="text-[10px] font-bold text-rose-500 uppercase mt-1">{manualErrors.check_in}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Check Out</label>
                        <input
                            type="time"
                            className={`w-full px-4 py-2.5 bg-slate-50 border ${manualErrors.check_out ? 'border-rose-500' : 'border-gray-100'} rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium`}
                            value={manualForm.check_out || ''}
                            onChange={(e) => onInputChange('check_out', e.target.value)}
                        />
                        {manualErrors.check_out && <p className="text-[10px] font-bold text-rose-500 uppercase mt-1">{manualErrors.check_out}</p>}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Status</label>
                        <select
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium"
                            value={manualForm.status}
                            onChange={(e) => onInputChange('status', e.target.value)}
                        >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="late">Late</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Remarks</label>
                    <textarea
                        rows="3"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 text-gray-700 font-medium resize-none"
                        placeholder="Add any notes here..."
                        value={manualForm.remarks || ''}
                        onChange={(e) => onInputChange('remarks', e.target.value)}
                    />
                </div>
                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="bg-black text-white px-10 py-3 rounded-lg text-sm font-bold hover:bg-gray-800 transition-all shadow-sm disabled:opacity-50 active:scale-95 cursor-pointer"
                    >
                        {submitting ? 'Adding...' : 'Add Attendance'}
                    </button>
                </div>
            </form>
        </div>
    )
}
