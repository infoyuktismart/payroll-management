import { useState } from 'react'
import { LogOut, CheckCircle, Clock3, X, AlertCircle, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const formatDateSafe = (value, options = { month: 'short', day: '2-digit', year: 'numeric' }, fallback = 'N/A') => {
    if (!value) return fallback
    const d = new Date(value)
    return isNaN(d.getTime()) ? fallback : d.toLocaleDateString('en-US', options)
}

export default function PortalExitTab({
    currentEmployee: _currentEmployee,
    viewAsId,
    isAdmin,
    toast,
    activeExit,
    setActiveExit,
    loading,
    setLoading
}) {
    const [showResignModal, setShowResignModal] = useState(false)
    const [resignationData, setResignationData] = useState({
        resignation_date: new Date().toISOString().split('T')[0],
        last_working_day: '',
        reason: 'Resignation',
        interview_notes: ''
    })

    const handleResign = async () => {
        if (!resignationData.last_working_day) {
            toast.warning('Please select your preferred last working day.')
            return
        }
        try {
            setLoading(true)
            const { error } = await supabase.from('exits').insert([{
                employee_id: viewAsId,
                ...resignationData,
                status: 'pending'
            }])
            if (error) throw error

            const { data: exitData } = await supabase
                .from('exits')
                .select('*')
                .eq('employee_id', viewAsId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
            setActiveExit(exitData)
            setShowResignModal(false)
            toast.success('Resignation submitted successfully. HR will review it soon.')
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const updateExitStatus = async (exitId, newStatus) => {
        try {
            const { error } = await supabase
                .from('exits')
                .update({ status: newStatus })
                .eq('id', exitId)
            if (error) throw error

            setActiveExit(prev => ({ ...prev, status: newStatus }))

            if (newStatus === 'completed' && viewAsId) {
                await supabase
                    .from('employees')
                    .update({ status: 'resigned' })
                    .eq('id', viewAsId)
            }
            toast.success(`Exit process updated to ${newStatus}.`)
        } catch (error) {
            toast.error(error.message)
        }
    }

    const exitSteps = ['pending', 'approved', 'clearance', 'settlement', 'completed']

    return (
        <div className="space-y-8">
            {!activeExit ? (
                /* No active exit — show initiation prompt */
                <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-sm text-center">
                    <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <LogOut className="w-10 h-10 text-rose-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Resignation &amp; Exit Process</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-8">
                        Thinking of moving on? You can initiate your resignation process here. This will notify HR and start the clearance workflow.
                    </p>
                    <button
                        onClick={() => setShowResignModal(true)}
                        className="bg-rose-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-rose-700 transition shadow-lg shadow-rose-100"
                    >
                        Initiate Resignation
                    </button>
                </div>
            ) : (
                /* Active exit process — show status + clearance */
                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Current Exit Process</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Status: <span className="capitalize font-bold text-slate-900">{activeExit.status}</span>
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {isAdmin && activeExit.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => updateExitStatus(activeExit.id, 'approved')}
                                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition shadow-sm text-sm font-bold"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Approve</span>
                                    </button>
                                    <button
                                        onClick={() => updateExitStatus(activeExit.id, 'rejected')}
                                        className="flex items-center space-x-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-xl hover:bg-rose-100 transition border border-rose-100 text-sm font-bold"
                                    >
                                        <X className="w-4 h-4" />
                                        <span>Reject</span>
                                    </button>
                                </>
                            )}
                            {isAdmin && activeExit.status === 'approved' && (
                                <button
                                    onClick={() => updateExitStatus(activeExit.id, 'clearance')}
                                    className="flex items-center space-x-2 bg-amber-500 text-white px-4 py-2 rounded-xl hover:bg-amber-600 transition shadow-sm text-sm font-bold"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Start Clearance</span>
                                </button>
                            )}
                            {isAdmin && activeExit.status === 'clearance' && (
                                <button
                                    onClick={() => updateExitStatus(activeExit.id, 'settlement')}
                                    className="flex items-center space-x-2 bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 transition shadow-sm text-sm font-bold"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Move to Settlement</span>
                                </button>
                            )}
                            {isAdmin && activeExit.status === 'settlement' && (
                                <button
                                    onClick={() => updateExitStatus(activeExit.id, 'completed')}
                                    className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition shadow-sm text-sm font-bold"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Mark Completed</span>
                                </button>
                            )}
                            <div className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize
                                ${activeExit.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                                  activeExit.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                                  activeExit.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                                  'bg-amber-100 text-amber-700'}`}
                            >
                                {activeExit.status}
                            </div>
                        </div>
                    </div>

                    {/* Progress Stepper */}
                    <div className="relative mb-12">
                        <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-100"></div>
                        <div className="relative flex justify-between">
                            {exitSteps.map((step, idx) => {
                                const currentIndex = exitSteps.indexOf(activeExit.status)
                                const stepIndex = exitSteps.indexOf(step)
                                const isActive = stepIndex <= currentIndex
                                const labels = ['Pending', 'Approved', 'Clearance', 'Settlement', 'Completed']
                                return (
                                    <div key={step} className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-colors border-2
                                            ${isActive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-400 border-gray-200'}`}
                                        >
                                            {isActive ? <Check className="w-4 h-4" /> : idx + 1}
                                        </div>
                                        <span className={`mt-2 text-xs font-bold transition-colors ${isActive ? 'text-slate-900' : 'text-gray-400'}`}>
                                            {labels[idx]}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-gray-100">
                        <div>
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Request Details</h4>
                            <div className="space-y-4 bg-slate-50 rounded-xl p-5">
                                {[
                                    ['Resignation Date', formatDateSafe(activeExit.resignation_date)],
                                    ['Last Working Day', formatDateSafe(activeExit.last_working_day)],
                                    ['Reason', activeExit.reason || 'Resignation'],
                                    ['Notes', activeExit.interview_notes || '—']
                                ].map(([label, value]) => (
                                    <div key={label} className="flex justify-between text-sm">
                                        <span className="text-gray-500 font-medium">{label}:</span>
                                        <span className="text-gray-900 font-bold text-right max-w-[60%]">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Clearance Tracking</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'IT', status: activeExit.it_clearance },
                                    { label: 'Finance', status: activeExit.finance_clearance },
                                    { label: 'HR', status: activeExit.hr_clearance },
                                    { label: 'Admin', status: activeExit.admin_clearance }
                                ].map((dept) => (
                                    <div
                                        key={dept.label}
                                        className={`p-4 rounded-xl border flex items-center justify-between
                                            ${dept.status ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}
                                    >
                                        <span className={`text-sm font-bold ${dept.status ? 'text-emerald-700' : 'text-gray-500'}`}>
                                            {dept.label}
                                        </span>
                                        {dept.status
                                            ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            : <Clock3 className="w-4 h-4 text-gray-300" />
                                        }
                                    </div>
                                ))}
                            </div>
                            {activeExit.status === 'completed' && (
                                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
                                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <p className="text-sm font-bold text-emerald-700">Exit process fully completed. Employee offboarded.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Resignation Modal */}
            {showResignModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">Initiate Resignation</h2>
                            <button onClick={() => setShowResignModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                    Initiating resignation will start the official exit process. Please ensure you have discussed this with your manager.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Preferred Last Working Day *</label>
                                <input
                                    type="date"
                                    className="w-full rounded-lg border-gray-200 focus:ring-slate-900 focus:border-slate-900 font-bold"
                                    value={resignationData.last_working_day}
                                    onChange={(e) => setResignationData({ ...resignationData, last_working_day: e.target.value })}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Reason</label>
                                <select
                                    className="w-full rounded-lg border-gray-200 focus:ring-slate-900 focus:border-slate-900 font-medium"
                                    value={resignationData.reason}
                                    onChange={(e) => setResignationData({ ...resignationData, reason: e.target.value })}
                                >
                                    <option value="Resignation">Standard Resignation</option>
                                    <option value="Retirement">Retirement</option>
                                    <option value="Personal Reasons">Personal Reasons</option>
                                    <option value="Career Growth">Career Growth</option>
                                    <option value="Higher Education">Higher Education</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Comments / Notes</label>
                                <textarea
                                    rows="3"
                                    className="w-full rounded-lg border-gray-200 focus:ring-slate-900 focus:border-slate-900"
                                    placeholder="Tell us about your decision or any notes for the HR..."
                                    value={resignationData.interview_notes}
                                    onChange={(e) => setResignationData({ ...resignationData, interview_notes: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50/50">
                            <button
                                onClick={() => setShowResignModal(false)}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResign}
                                disabled={loading}
                                className="px-6 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Submitting...' : 'Confirm Resignation'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
