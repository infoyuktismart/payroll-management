import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

export default function AddCustomTaskModal({
    isOpen,
    onClose,
    currentEmployee,
    taskForm,
    setTaskForm,
    onSubmit,
    submitting,
    showRolesDropdown,
    setShowRolesDropdown,
    activeRoleIndex,
    setActiveRoleIndex,
    filteredRoles,
    handleAssignedToKeyDown
}) {
    const taskModalRef = useFocusTrap(isOpen)

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
                ref={taskModalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="onboarding-modal-title"
                className="bg-white rounded-3xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200"
            >
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl">
                    <div>
                        <h3 id="onboarding-modal-title" className="text-lg font-bold text-gray-900">Add Custom Onboarding Task</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Define a setup step for {currentEmployee?.first_name}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close modal"
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X aria-hidden="true" className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="task-name" className="block text-xs font-bold text-gray-700 mb-1.5">Task Description*</label>
                        <textarea
                            id="task-name"
                            required
                            value={taskForm.task_name}
                            onChange={(e) => setTaskForm(prev => ({ ...prev, task_name: e.target.value }))}
                            placeholder="e.g. Set up office access card and register biometric ID"
                            className="w-full text-xs border border-gray-200 rounded-xl p-3 bg-gray-50 min-h-20"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="task-category" className="block text-xs font-bold text-gray-700 mb-1.5">Category</label>
                            <select
                                id="task-category"
                                value={taskForm.category}
                                onChange={(e) => setTaskForm(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5"
                            >
                                <option value="HR">HR</option>
                                <option value="IT">IT Setup</option>
                                <option value="General">General</option>
                                <option value="Document">Document</option>
                                <option value="Orientation">Orientation</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="task-due-days" className="block text-xs font-bold text-gray-700 mb-1.5">Due Days (from Joining)</label>
                            <input
                                id="task-due-days"
                                type="number"
                                min="1"
                                required
                                value={taskForm.due_days}
                                onChange={(e) => setTaskForm(prev => ({ ...prev, due_days: e.target.value }))}
                                className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 font-bold"
                            />
                        </div>
                    </div>
                    <div className="relative">
                        <label htmlFor="task-assigned-to" className="block text-xs font-bold text-gray-700 mb-1.5">Assigned To</label>
                        <input
                            id="task-assigned-to"
                            type="text"
                            value={taskForm.assigned_to}
                            onChange={(e) => {
                                setTaskForm(prev => ({ ...prev, assigned_to: e.target.value }))
                                setShowRolesDropdown(true)
                            }}
                            onFocus={() => setShowRolesDropdown(true)}
                            onBlur={() => setTimeout(() => setShowRolesDropdown(false), 205)}
                            onKeyDown={handleAssignedToKeyDown}
                            placeholder="e.g. IT Administrator, HR Lead"
                            className="w-full text-xs border border-gray-200 rounded-xl bg-gray-50 p-2.5 font-bold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                            autoComplete="off"
                        />
                        {showRolesDropdown && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-150 rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-gray-50">
                                {filteredRoles.length > 0 ? (
                                    filteredRoles.map((role, idx) => (
                                        <button
                                            key={role}
                                            type="button"
                                            onMouseDown={() => {
                                                setTaskForm(prev => ({ ...prev, assigned_to: role }))
                                                setShowRolesDropdown(false)
                                            }}
                                            className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors ${
                                                idx === activeRoleIndex ? 'bg-indigo-50 text-indigo-900' : 'text-gray-700'
                                            }`}
                                        >
                                            {role}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-2 text-xs text-gray-500 italic">
                                        Press enter or continue typing...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 p-6 rounded-b-3xl">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-650 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                        >
                            Add Task
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
