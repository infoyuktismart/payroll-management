import { useState } from 'react'
import { FileText, AlertCircle, MapPin, User, X } from 'lucide-react'

export default function PortalJobTab({
    currentEmployee,
    tenureText,
    formatDateSafe
}) {
    const [showCareerPathModal, setShowCareerPathModal] = useState(false)

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-250 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800">Job Information</h3>
                        <FileText className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Job Title</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.designation || 'Employee'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Department</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.department || 'General'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Business Unit</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{currentEmployee.department || 'Operations'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Reporting Manager</p>
                            <p className="text-sm font-bold text-slate-800 mt-1 inline-flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 inline-flex items-center justify-center">
                                    <User className="w-3.5 h-3.5 text-slate-500" />
                                </span>
                                {currentEmployee.reporting_person || 'Not Assigned'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-250 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800">Employment Details</h3>
                        <AlertCircle className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Employment Type</p>
                            <span className="inline-flex mt-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold">Full-time</span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Joining Date</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{formatDateSafe(currentEmployee.joining_date, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Work Location</p>
                            <p className="text-sm font-bold text-slate-800 mt-1 inline-flex items-center gap-1.5">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                {currentEmployee.department || 'Main Office'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tenure</p>
                            <p className="text-sm font-bold text-slate-800 mt-1">{tenureText}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm h-fit">
                <div className="px-6 py-4 border-b border-gray-250 bg-gray-50/50">
                    <h3 className="text-lg font-bold text-slate-800">Role History</h3>
                </div>
                <div className="p-6">
                    <div className="relative pl-8 space-y-8 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-blue-100">
                        <div className="relative">
                            <span className="absolute -left-8.5 top-0.5 w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow text-white flex items-center justify-center text-[10px] font-bold">1</span>
                            <p className="text-sm font-bold text-blue-700">{currentEmployee.designation || 'Current Role'}</p>
                            <p className="text-xs text-gray-500">Current Position</p>
                            <p className="text-xs font-bold text-slate-800 mt-1">{formatDateSafe(currentEmployee.joining_date, { month: 'short', year: 'numeric' })} - Present</p>
                            <p className="text-xs text-gray-400 mt-1 leading-relaxed">Leading responsibilities in {currentEmployee.department || 'core operations'}.</p>
                        </div>
                        <div className="relative">
                            <span className="absolute -left-8.5 top-0.5 w-6 h-6 rounded-full bg-gray-100 border-2 border-white shadow text-gray-400 flex items-center justify-center text-[10px] font-bold">2</span>
                            <p className="text-sm font-bold text-slate-800">Associate {currentEmployee.designation || 'Role'}</p>
                            <p className="text-xs text-gray-500">Career Progression</p>
                            <p className="text-xs font-bold text-slate-800 mt-1">Initial Phase</p>
                            <p className="text-xs text-gray-400 mt-1 leading-relaxed">Built foundation and delivered key team objectives.</p>
                        </div>
                    </div>
                    <button onClick={() => setShowCareerPathModal(true)} className="w-full mt-6 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold transition">
                        View Full Career Path
                    </button>
                </div>
            </div>

            {/* Career Path Modal */}
            {showCareerPathModal && (
                <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-lg font-bold text-slate-800">Career Path</h3>
                            <button onClick={() => setShowCareerPathModal(false)} className="p-2 rounded-full hover:bg-gray-105 transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-1 before:bottom-1 before:w-px before:bg-blue-200">
                                {[
                                    {
                                        title: currentEmployee?.designation || 'Current Role',
                                        period: `${formatDateSafe(currentEmployee?.joining_date || '', { month: 'short', year: 'numeric' })} - Present`,
                                        note: `Leading responsibilities in ${currentEmployee?.department || 'the team'}.`
                                    },
                                    {
                                        title: `Associate ${currentEmployee?.designation || 'Role'}`,
                                        period: 'Initial Phase',
                                        note: 'Delivered critical tasks and built cross-functional collaboration.'
                                    },
                                    {
                                        title: 'Onboarding Stage',
                                        period: 'First 3 months',
                                        note: 'Completed induction, system access, and mandatory trainings.'
                                    }
                                ].map((item, idx) => (
                                    <div key={`${item.title}-${idx}`} className="relative">
                                        <span className={`absolute -left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{idx + 1}</span>
                                        <p className="text-base font-bold text-slate-800">{item.title}</p>
                                        <p className="text-xs font-bold text-blue-600 mt-0.5">{item.period}</p>
                                        <p className="text-xs text-gray-500 mt-1">{item.note}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button onClick={() => setShowCareerPathModal(false)} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
