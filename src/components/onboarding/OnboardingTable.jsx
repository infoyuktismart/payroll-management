import { CheckCircle2, Circle, Clock, Trash2, Search, CheckSquare } from 'lucide-react'
import { TableSkeleton } from '../ui/SkeletonLoader'

export default function OnboardingTable({
    loading,
    totalTasks,
    filteredTasks,
    selectedCategory,
    setSelectedCategory,
    searchTerm,
    setSearchTerm,
    toggleTaskStatus,
    deleteTask,
    categories,
    isAdmin
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Controls Bar */}
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/40">
                {/* Categories Tabs */}
                <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                selectedCategory === cat
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white text-gray-500 hover:text-slate-900 border border-gray-150'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs w-full bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                </div>
            </div>

            {/* Table / List */}
            <div className="overflow-x-auto">
                {loading ? (
                    <div className="p-10">
                        <TableSkeleton rows={5} cols={5} />
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center">
                        <CheckSquare className="w-12 h-12 text-gray-300 mb-3" />
                        <h3 className="text-base font-bold text-gray-700">No onboarding tasks found</h3>
                        <p className="text-xs text-gray-600 mt-1">
                            {totalTasks === 0
                                ? 'Checklist is empty. Initialize the default schedule above to get started!'
                                : 'No tasks match your selected search or filter criteria.'}
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 border-b border-gray-150 font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                            <tr>
                                <th className="p-4 w-12"></th>
                                <th className="p-4">Task Details</th>
                                <th className="p-4">Category</th>
                                <th className="p-4">Due Date</th>
                                <th className="p-4">Assigned To</th>
                                {isAdmin && <th className="p-4 text-right">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTasks.map((task) => {
                                const isCompleted = task.status === 'completed'
                                const isOverdue = new Date(task.due_date) < new Date() && !isCompleted

                                return (
                                    <tr key={task.id} className={`hover:bg-slate-50/50 transition-colors ${isCompleted ? 'bg-emerald-50/10' : ''}`}>
                                        <td className="p-4 text-center">
                                            <button
                                                type="button"
                                                onClick={() => toggleTaskStatus(task)}
                                                className="transition-transform duration-200 hover:scale-110 focus:outline-none"
                                            >
                                                {isCompleted ? (
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                ) : (
                                                    <Circle className="w-5 h-5 text-gray-300" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <p className={`font-bold text-sm ${isCompleted ? 'text-gray-600 line-through' : 'text-gray-800'}`}>
                                                {task.task_name}
                                            </p>
                                            {isOverdue && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 mt-1">
                                                    <Clock className="w-3 h-3" /> Overdue
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                task.category === 'HR' ? 'bg-blue-50 text-blue-600' :
                                                task.category === 'IT' ? 'bg-violet-50 text-violet-600' :
                                                task.category === 'Document' ? 'bg-amber-50 text-amber-600' :
                                                'bg-gray-50 text-gray-600'
                                            }`}>
                                                {task.category}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold text-gray-600">
                                            {task.due_date}
                                        </td>
                                        <td className="p-4 font-bold text-slate-500">
                                            {task.assigned_to || 'HR Team'}
                                        </td>
                                        {isAdmin && (
                                            <td className="p-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => deleteTask(task.id)}
                                                    className="p-1.5 text-gray-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
