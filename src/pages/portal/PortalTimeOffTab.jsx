import { Plus, X, Clock, LogOut, Check, AlertCircle, Calendar } from 'lucide-react'
import { calculateLeaveDays, getLeavePolicyOptions } from '../../lib/leaveUtils'

export default function PortalTimeOffTab({
    currentEmployee: _currentEmployee,
    viewAsId: _viewAsId,
    todayPunch,
    punching,
    currentTime,
    userIp,
    handlePunchIn,
    handlePunchOut,
    regularizationRequests,
    showRegularizeModal,
    setShowRegularizeModal,
    regularizeForm,
    setRegularizeForm,
    submittingRegularize,
    handleApplyRegularization,
    timeOffHistory,
    timeOffStatusFilter,
    setTimeOffStatusFilter,
    timeOffStartDate,
    setTimeOffStartDate,
    timeOffEndDate,
    setTimeOffEndDate,
    upcomingLeaves,
    timeOffCards,
    formatDateSafe,
    leavePolicies,
    leaveForm,
    setLeaveForm,
    showLeaveModal,
    setShowLeaveModal,
    handleApplyLeave,
    holidays,
    loading
}) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Time & Attendance</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Track shifts, log attendance, and request time off</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowLeaveModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow"
                    >
                        <Plus className="w-4 h-4" /> Request Time Off
                    </button>
                </div>
            </div>

            {/* Leave Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {timeOffCards.map((card) => {
                    const remaining = Math.max(0, Number(card.total || 0) - Number(card.used || 0))
                    const progress = Math.min(100, Math.round((remaining / Math.max(1, card.total)) * 100))
                    const Icon = card.icon
                    return (
                        <div key={card.key} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                                    <Icon className="w-5 h-5 text-slate-700" />
                                </div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{card.title}</p>
                            </div>
                            <p className="text-3xl font-black text-slate-900 mt-4">{remaining}<span className="text-sm font-bold text-gray-400"> days left</span></p>
                            <div className="mt-4 h-2 rounded-full bg-slate-50 border border-slate-100 overflow-hidden">
                                <div className={`h-full rounded-full ${card.accent}`} style={{ width: `${progress}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-3 italic">Accrued: {card.total} days total</p>
                        </div>
                    )
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    {/* Web Punch Clock Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden p-6 shadow-sm">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <Clock className="w-4.5 h-4.5 text-blue-600 animate-pulse" />
                                    Web Punch Clock
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">Log shift start/end times and record system IP.</p>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-gray-150">
                                <span className={`w-2 h-2 rounded-full ${
                                    todayPunch && !todayPunch.punch_out ? 'bg-emerald-500 animate-ping' : todayPunch ? 'bg-slate-400' : 'bg-rose-500'
                                }`}></span>
                                <span className="text-xs font-bold text-slate-700">
                                    {todayPunch && !todayPunch.punch_out ? 'Currently Punched In' : todayPunch ? 'Shift Completed' : 'Punched Out'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-150">
                            {/* Live Running Time */}
                            <div className="flex flex-col justify-center bg-slate-50 p-4 rounded-xl border border-gray-150">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Time</span>
                                <span className="text-lg font-black text-slate-800 mt-1">
                                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                </span>
                                <span className="text-[10px] text-gray-500 mt-0.5 font-semibold">
                                    {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            </div>

                            {/* Punch Stats */}
                            <div className="flex flex-col justify-center bg-slate-50 p-4 rounded-xl border border-gray-150">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Punch Log</span>
                                <div className="space-y-1 mt-1.5">
                                    <p className="text-xs font-bold text-slate-700">
                                        In: <span className="text-slate-900 font-bold">{todayPunch ? new Date(todayPunch.punch_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</span>
                                    </p>
                                    <p className="text-xs font-bold text-slate-700">
                                        Out: <span className="text-slate-900 font-bold">{todayPunch?.punch_out ? new Date(todayPunch.punch_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</span>
                                    </p>
                                </div>
                            </div>

                            {/* IP & Worked Duration */}
                            <div className="flex flex-col justify-center bg-slate-50 p-4 rounded-xl border border-gray-150">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">System Details</span>
                                <p className="text-xs font-bold text-slate-700 mt-1.5">
                                    IP: <span className="text-slate-900 font-bold">{userIp}</span>
                                </p>
                                {todayPunch && (
                                    <p className="text-xs font-bold text-slate-700">
                                        Worked: <span className="text-blue-600 font-bold">
                                            {todayPunch.working_hours ? `${todayPunch.working_hours} hrs` : (() => {
                                                const diffMs = currentTime - new Date(todayPunch.punch_in)
                                                const hrs = Math.floor(diffMs / (1000 * 60 * 60))
                                                const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                                                return `${hrs}h ${mins}m (Live)`
                                            })()}
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            {!todayPunch ? (
                                <button
                                    onClick={handlePunchIn}
                                    disabled={punching}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow flex items-center gap-2 active:scale-95 disabled:opacity-50"
                                >
                                    <Clock className="w-4 h-4" />
                                    {punching ? 'Punching In...' : 'Punch In Shift'}
                                </button>
                            ) : !todayPunch.punch_out ? (
                                <button
                                    onClick={handlePunchOut}
                                    disabled={punching}
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow flex items-center gap-2 active:scale-95 disabled:opacity-50"
                                >
                                    <LogOut className="w-4 h-4" />
                                    {punching ? 'Punching Out...' : 'Punch Out Shift'}
                                </button>
                            ) : (
                                <button
                                    disabled
                                    className="bg-slate-100 text-slate-400 font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 border border-slate-200 cursor-not-allowed"
                                >
                                    <Check className="w-4 h-4" />
                                    Shift Completed Today
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Attendance Regularization Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h4 className="text-base font-bold text-slate-805">Attendance Regularization</h4>
                                <p className="text-xs text-gray-500 mt-0.5">Submit adjustment requests for missed or incorrect punch dates.</p>
                            </div>
                            <button
                                onClick={() => setShowRegularizeModal(true)}
                                className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-105 text-blue-700 font-bold text-xs rounded-xl border border-blue-100 transition inline-flex items-center gap-1.5"
                            >
                                <Plus className="w-3.5 h-3.5" /> Request Regularization
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-gray-150">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Requested Status</th>
                                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason</th>
                                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reviewed By</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {regularizationRequests.length > 0 ? regularizationRequests.map((req) => {
                                        const status = (req.status || 'pending').toLowerCase()
                                        const statusClass = status === 'approved'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : status === 'rejected'
                                                ? 'bg-rose-100 text-rose-700'
                                                : 'bg-amber-100 text-amber-700'
                                        return (
                                            <tr key={req.id} className="hover:bg-slate-50/50 transition">
                                                <td className="px-6 py-4 text-xs font-bold text-slate-900">{formatDateSafe(req.date)}</td>
                                                <td className="px-6 py-4 text-xs font-bold text-slate-800">{req.requested_status}</td>
                                                <td className="px-6 py-4 text-xs text-gray-500 max-w-[200px] truncate" title={req.reason}>{req.reason}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusClass}`}>
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                                                    {req.reviewed_by ? `HR Review` : '-'}
                                                </td>
                                            </tr>
                                        )
                                    }) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-8 text-center text-xs text-gray-400 italic">No regularization requests found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Time Off History */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
                            <h4 className="text-base font-bold text-slate-805">Time Off History</h4>
                        </div>
                        <div className="px-6 py-4 border-b border-gray-150 bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="inline-flex items-center space-x-1 bg-white p-1 rounded-xl border border-gray-250 w-fit">
                                {[
                                    { key: 'all', label: 'All' },
                                    { key: 'approved', label: 'Approved' },
                                    { key: 'pending', label: 'Pending' },
                                    { key: 'rejected', label: 'Rejected' }
                                ].map((item) => (
                                    <button
                                        key={item.key}
                                        onClick={() => setTimeOffStatusFilter(item.key)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${timeOffStatusFilter === item.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-550 hover:bg-slate-50'}`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={timeOffStartDate}
                                    onChange={(e) => setTimeOffStartDate(e.target.value)}
                                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700"
                                />
                                <span className="text-xs text-gray-400">to</span>
                                <input
                                    type="date"
                                    value={timeOffEndDate}
                                    onChange={(e) => setTimeOffEndDate(e.target.value)}
                                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700"
                                />
                                {(timeOffStartDate || timeOffEndDate) && (
                                    <button
                                        onClick={() => {
                                            setTimeOffStartDate('')
                                            setTimeOffEndDate('')
                                        }}
                                        className="px-3 py-1.5 rounded-lg border border-gray-250 text-xs font-bold text-gray-600 hover:bg-slate-55"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-100 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Leave Type</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Dates</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {timeOffHistory.length > 0 ? timeOffHistory.map((leave) => {
                                        const status = (leave.status || 'pending').toLowerCase()
                                        const statusClass = status === 'approved'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : status === 'rejected'
                                                ? 'bg-rose-100 text-rose-700'
                                                : 'bg-amber-100 text-amber-700'
                                        return (
                                            <tr key={leave.id} className="hover:bg-slate-50/50 transition">
                                                <td className="px-6 py-4 text-xs font-bold text-slate-900">{leave.leave_type}</td>
                                                <td className="px-6 py-4 text-xs font-medium text-gray-700">
                                                    {formatDateSafe(leave.start_date, { month: 'short', day: '2-digit' })}
                                                    {leave.end_date && leave.end_date !== leave.start_date ? ` - ${formatDateSafe(leave.end_date, { month: 'short', day: '2-digit', year: 'numeric' })}` : ''}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-slate-800">{Number(leave.days || 1)} Day{Number(leave.days || 1) > 1 ? 's' : ''}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${statusClass}`}>
                                                        {status}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    }) : (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-12 text-center text-xs text-gray-400 italic">No leave history found for selected filters.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-150 bg-gray-50/50">
                            <h4 className="text-base font-bold text-slate-805">Upcoming Leave</h4>
                        </div>
                        <div className="p-6 space-y-4">
                            {upcomingLeaves.length > 0 ? upcomingLeaves.map((leave, idx) => {
                                const date = new Date(leave.start_date)
                                const border = idx === 0 ? 'border-blue-500' : 'border-amber-500'
                                return (
                                    <div key={leave.id} className={`rounded-xl border-l-4 ${border} bg-slate-50 p-4 border border-slate-100`}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-lg bg-white border border-gray-150 flex flex-col items-center justify-center">
                                                <span className="text-[9px] font-bold text-blue-600 uppercase">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                <span className="text-xl font-bold text-slate-800 leading-none">{date.getDate()}</span>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">{leave.reason || leave.leave_type}</p>
                                                <p className="text-[10px] text-gray-500 mt-0.5">{Number(leave.days || 1)} day(s) ({leave.leave_type})</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }) : (
                                <p className="text-xs text-gray-400 italic">No upcoming leave requests.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-blue-50/50 border border-blue-200/50 rounded-2xl p-6 shadow-sm">
                        <h4 className="text-sm font-bold text-blue-800 inline-flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Leave Policy Guidelines</h4>
                        <ul className="mt-4 space-y-2 text-xs text-blue-700/80 leading-relaxed font-medium">
                            <li className="flex items-start gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                                Request leaves at least 1 week in advance.
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                                Max 10 consecutive vacation days.
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                                Sick leaves require medical notes after 3 days.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Attendance Regularization Modal */}
            {showRegularizeModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-base font-bold text-gray-800">Request Attendance Regularization</h2>
                            <button onClick={() => setShowRegularizeModal(false)} className="p-2 hover:bg-gray-150 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-450" />
                            </button>
                        </div>
                        <form onSubmit={handleApplyRegularization}>
                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Date *</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full rounded-xl border border-gray-250 px-4 py-2.5 text-xs font-bold"
                                        value={regularizeForm.date}
                                        onChange={(e) => setRegularizeForm({ ...regularizeForm, date: e.target.value })}
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Requested Status *</label>
                                    <select
                                        className="w-full rounded-xl border border-gray-250 px-4 py-2.5 text-xs font-bold"
                                        value={regularizeForm.requested_status}
                                        onChange={(e) => setRegularizeForm({ ...regularizeForm, requested_status: e.target.value })}
                                    >
                                        <option value="Present">Present</option>
                                        <option value="Half Day">Half Day</option>
                                        <option value="Weekly Off">Weekly Off</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Reason / Remarks *</label>
                                    <textarea
                                        rows="4"
                                        required
                                        className="w-full rounded-xl border border-gray-255 px-4 py-2.5 text-xs font-medium"
                                        placeholder="Explain the reason for regularization (missed punch, client visit, etc.)..."
                                        value={regularizeForm.reason}
                                        onChange={(e) => setRegularizeForm({ ...regularizeForm, reason: e.target.value })}
                                    ></textarea>
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50/50">
                                <button
                                    type="button"
                                    onClick={() => setShowRegularizeModal(false)}
                                    className="px-4 py-2 bg-white border border-gray-250 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingRegularize}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    {submittingRegularize ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Leave Apply Modal */}
            {showLeaveModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-base font-bold text-gray-800">Apply for Leave</h2>
                            <button onClick={() => setShowLeaveModal(false)} className="p-2 hover:bg-gray-150 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-405" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Leave Type</label>
                                <select
                                    className="w-full rounded-xl border border-gray-250 px-4 py-2.5 text-xs font-bold"
                                    value={leaveForm.type}
                                    onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                                >
                                    <option value="">Select leave type</option>
                                    {getLeavePolicyOptions(leavePolicies).map(policy => (
                                        <option key={policy.leave_type} value={policy.leave_type}>
                                            {policy.leave_type}
                                        </option>
                                    ))}
                                </select>
                                {leaveForm.type && (
                                    <p className="text-[10px] text-gray-450 mt-1.5 font-semibold">
                                        Requested payable days: {calculateLeaveDays(leaveForm.startDate, leaveForm.endDate, holidays)}
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        className="w-full rounded-xl border border-gray-250 px-4 py-2.5 text-xs font-bold"
                                        value={leaveForm.startDate}
                                        onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        className="w-full rounded-xl border border-gray-250 px-4 py-2.5 text-xs font-bold"
                                        value={leaveForm.endDate}
                                        onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Reason</label>
                                <textarea
                                    rows="3"
                                    className="w-full rounded-xl border border-gray-250 px-4 py-2.5 text-xs font-medium"
                                    placeholder="Enter reason for leave..."
                                    value={leaveForm.reason}
                                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                                ></textarea>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50/50">
                            <button
                                onClick={() => setShowLeaveModal(false)}
                                className="px-4 py-2 bg-white border border-gray-250 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApplyLeave}
                                disabled={loading}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                {loading ? 'Submitting...' : 'Submit Application'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
