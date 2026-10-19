import { UserPlus, Plus } from 'lucide-react'

export default function OnboardingStats({
    currentEmployee,
    completedTasks,
    totalTasks,
    progressPercent,
    submitting,
    initializeDefaultChecklist,
    onAddCustomTaskClick
}) {
    if (!currentEmployee) return null

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Employee Profile */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                    {currentEmployee.first_name?.[0] || ''}{currentEmployee.last_name?.[0] || ''}
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-800">{currentEmployee.first_name} {currentEmployee.last_name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{currentEmployee.designation} &bull; {currentEmployee.department}</p>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Joined {currentEmployee.joining_date}</p>
                </div>
            </div>

            {/* Progress Card */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <span>Checklist Progress</span>
                    <span className="text-indigo-600 font-extrabold">{completedTasks}/{totalTasks} Completed</span>
                </div>
                <div className="flex items-center gap-4 mt-2">
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-gray-700 shrink-0">{progressPercent}%</span>
                </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center justify-around">
                {totalTasks === 0 ? (
                    <button
                        onClick={initializeDefaultChecklist}
                        disabled={submitting}
                        className="px-6 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                    >
                        <UserPlus className="w-4 h-4" /> Initialize Default Checklist
                    </button>
                ) : (
                    <button
                        onClick={onAddCustomTaskClick}
                        className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Add Custom Task
                    </button>
                )}
            </div>
        </div>
    )
}
