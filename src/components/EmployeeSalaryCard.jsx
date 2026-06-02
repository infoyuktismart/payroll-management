import { memo } from 'react'

const COLORS = [
    { border: 'border-l-indigo-600', text: 'text-indigo-600', bg: 'bg-indigo-50', hover: 'group-hover:text-indigo-900' },
    { border: 'border-l-emerald-600', text: 'text-emerald-600', bg: 'bg-emerald-50', hover: 'group-hover:text-emerald-900' },
    { border: 'border-l-blue-600', text: 'text-blue-600', bg: 'bg-blue-50', hover: 'group-hover:text-blue-900' },
    { border: 'border-l-violet-600', text: 'text-violet-600', bg: 'bg-violet-50', hover: 'group-hover:text-violet-900' },
    { border: 'border-l-amber-600', text: 'text-amber-600', bg: 'bg-amber-50', hover: 'group-hover:text-amber-900' },
    { border: 'border-l-rose-600', text: 'text-rose-600', bg: 'bg-rose-50', hover: 'group-hover:text-rose-900' },
    { border: 'border-l-cyan-600', text: 'text-cyan-600', bg: 'bg-cyan-50', hover: 'group-hover:text-cyan-900' },
    { border: 'border-l-teal-600', text: 'text-teal-600', bg: 'bg-teal-50', hover: 'group-hover:text-teal-900' },
]

const EmployeeSalaryCard = memo(function EmployeeSalaryCard({ emp, index, isAdmin, onEditClick, formatCurrency }) {
    const basic = (parseFloat(emp.salary) || 0) * 0.5
    const structure = emp.salary_structure || {}
    const colorScheme = COLORS[index % COLORS.length]

    // Calculate Dynamic Allowances
    let totalAllowances = 0
    Object.entries(structure).forEach(([key, config]) => {
        const isBasic = config.label?.toLowerCase() === 'basic' || 
                        config.label?.toLowerCase() === 'basic salary' || 
                        config.code?.toLowerCase() === 'basic' || 
                        key.toLowerCase() === 'basic_salary';
        if (isBasic) return;

        if (config.category === 'earning' && config.enabled) {
            totalAllowances += config.type === 'percentage' ? (basic * config.value) / 100 : (config.value || 0)
        }
    })

    const gross = basic + totalAllowances

    // Calculate Dynamic Deductions
    let deductions = 0
    Object.values(structure).forEach(config => {
        if (config.category === 'deduction' && config.enabled) {
            // ESI Eligibility check
            if (config.system_type === 'ESI') {
                const esiLimit = emp.is_specially_abled ? 25000 : 21000
                if (gross > esiLimit) return
            }

            if (config.type === 'percentage') {
                const label = config.label?.toLowerCase() || ''
                const isBasicTarget = config.system_type === 'PF' ||
                    config.system_type === 'ESI' ||
                    label.includes('pf') ||
                    label.includes('provident fund') ||
                    label.includes('esi')

                const base = isBasicTarget ? basic : gross
                let effectiveBase = base
                if (config.max_limit > 0) effectiveBase = Math.min(effectiveBase, config.max_limit);
                if (config.min_limit > 0) effectiveBase = Math.max(effectiveBase, config.min_limit);
                deductions += (effectiveBase * config.value) / 100
            } else {
                deductions += (config.value || 0)
            }
        }
    })

    const net = gross - deductions
    const hasStructure = Object.keys(structure).length > 0

    if (!hasStructure) {
        return (
            <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-[6px] ${colorScheme.border} flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-300 hover:scale-[1.01] hover:shadow-md group`}>
                <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-full ${colorScheme.bg} flex items-center justify-center ${colorScheme.text} font-bold text-lg shrink-0 group-hover:scale-110 transition-transform`}>
                        {emp.first_name?.[0] || ''}{emp.last_name?.[0] || ''}
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold text-gray-900 ${colorScheme.hover} transition-colors`}>{emp.first_name} {emp.last_name}</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{emp.designation || 'No Designation'} • {emp.department || 'No Dept'}</p>
                        <p className={`text-[10px] ${colorScheme.text} font-bold mt-1 uppercase tracking-widest`}>{emp.employee_id || 'ID-Pending'}</p>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-end gap-6 text-right">
                    <div className="text-gray-400 text-xs font-bold uppercase tracking-widest italic">No salary structure configured</div>
                    {isAdmin && (
                        <button onClick={() => onEditClick(emp)} className="px-6 py-2.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-100 transition-all active:scale-95 cursor-pointer">Configure Salary</button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-[6px] ${colorScheme.border} transition-all duration-300 hover:scale-[1.01] hover:shadow-md group`}>
            <div className="flex flex-col md:flex-row justify-between items-start mb-6">
                <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-full ${colorScheme.bg} flex items-center justify-center ${colorScheme.text} font-bold text-lg shrink-0 group-hover:scale-110 transition-transform shadow-inner`}>
                        {emp.first_name?.[0] || ''}{emp.last_name?.[0] || ''}
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold text-gray-900 ${colorScheme.hover} transition-colors`}>{emp.first_name} {emp.last_name}</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{emp.designation || 'No Designation'} • {emp.department || 'No Dept'}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">Employee ID: {emp.employee_id || 'ID-Pending'}</p>
                    </div>
                </div>
                <div className="text-right mt-4 md:mt-0">
                    <p className="text-3xl font-bold text-slate-900 group-hover:scale-105 transition-transform origin-right">{formatCurrency(gross)}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-1">Gross Salary</p>
                    <p className="text-sm font-bold text-emerald-600 mt-2 flex items-center justify-end">
                        <span className="text-[10px] uppercase tracking-widest mr-2 opacity-60">Net:</span>
                        {formatCurrency(net)}
                    </p>
                </div>
            </div>
            <div className="flex flex-col md:flex-row items-end justify-between gap-6 pt-6 border-t border-gray-50/50">
                <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex items-center">
                            <span className={`w-1.5 h-1.5 rounded-full ${colorScheme.text.replace('-600', '-500')} mr-2`}></span>
                            Basic Salary
                        </p>
                        <p className="text-xl font-bold text-slate-900">{formatCurrency(basic)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-2"></span>
                            Total Deductions
                        </p>
                        <p className="text-xl font-bold text-rose-600">{formatCurrency(deductions)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-2"></span>
                            Effective Date
                        </p>
                        <p className="text-sm font-bold text-slate-700">{emp.salary_effective_date || '-'}</p>
                    </div>
                </div>
                {isAdmin && (
                    <button onClick={() => onEditClick(emp)} className="px-6 py-2.5 bg-white border border-gray-200 shadow-sm rounded-xl text-xs font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95 shrink-0 whitespace-nowrap cursor-pointer">Edit Salary</button>
                )}
            </div>
        </div>
    )
})

export default EmployeeSalaryCard
