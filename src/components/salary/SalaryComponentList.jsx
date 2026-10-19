import { Plus, Edit2, Trash2 } from 'lucide-react'

export default function SalaryComponentList({
    salaryComponents,
    onEditComponent,
    onDeleteComponent,
    onAddComponentClick,
    formatCurrency
}) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Salary Components</h3>
                    <p className="text-sm text-gray-500">Manage the building blocks of salary structures</p>
                </div>
                <button
                    onClick={onAddComponentClick}
                    className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-gray-200"
                >
                    <Plus className="w-4 h-4" /> <span className="font-bold text-sm">Add Component</span>
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-800 uppercase tracking-wider">Component Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-800 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-800 uppercase tracking-wider">Calculation</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-800 uppercase tracking-wider">Value</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-800 uppercase tracking-wider">Limits (Floor/Ceil)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-800 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-800 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {Object.entries(salaryComponents).map(([key, component]) => (
                                <tr key={key} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-gray-900 text-sm">{component.label}</p>
                                        {component.code && <p className="text-[10px] text-gray-400 font-mono uppercase">{component.code}</p>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col space-y-1">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border w-fit ${
                                                    component.category === 'earning'
                                                        ? 'bg-slate-900 text-white border-slate-900'
                                                        : 'bg-rose-600 text-white border-rose-600'
                                                }`}
                                            >
                                                {component.category.toUpperCase()}
                                            </span>
                                            {component.is_statutory && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 w-fit uppercase tracking-tighter">
                                                    Statutory
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 font-medium capitalize">{component.type}</td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-gray-900">
                                            {component.type === 'fixed' ? formatCurrency(component.value) : `${component.value}%`}
                                        </div>
                                        {component.type === 'percentage' && (
                                            <p className="text-[10px] text-gray-400 font-medium">on Basic/Gross</p>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {component.max_limit > 0 || component.min_limit > 0 ? (
                                            <div className="flex flex-col space-y-1">
                                                {component.max_limit > 0 && (
                                                    <span className="text-[10px] text-gray-500 font-medium">
                                                        Max: {formatCurrency(component.max_limit)}
                                                    </span>
                                                )}
                                                {component.min_limit > 0 && (
                                                    <span className="text-[10px] text-gray-500 font-medium">
                                                        Min: {formatCurrency(component.min_limit)}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                                component.status === 'Active'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-gray-100 text-gray-400'
                                            }`}
                                        >
                                            {component.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <button
                                                onClick={() => onEditComponent(key)}
                                                className="text-gray-400 hover:text-slate-900 transition-colors cursor-pointer"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteComponent(key)}
                                                className="text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
