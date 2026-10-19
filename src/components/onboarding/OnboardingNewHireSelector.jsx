import { useState, useEffect } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'

export default function OnboardingNewHireSelector({ employees, selectedId, onChange }) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.employee-combobox')) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filtered = employees.filter(emp =>
        emp.first_name.toLowerCase().includes(search.toLowerCase()) ||
        emp.last_name.toLowerCase().includes(search.toLowerCase()) ||
        emp.employee_id.toLowerCase().includes(search.toLowerCase())
    )

    const selectedEmp = employees.find(e => e.id === selectedId)

    return (
        <div className="relative employee-combobox min-w-70">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
            >
                <div className="flex flex-col items-start overflow-hidden text-left">
                    <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-slate-400">New Hire</span>
                    <span className="text-sm font-bold text-slate-800 truncate w-full leading-tight">
                        {selectedEmp ? `${selectedEmp.first_name} ${selectedEmp.last_name} (${selectedEmp.employee_id})` : 'Select New Hire'}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search by name or ID..."
                                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-medium text-slate-700"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                        {filtered.length > 0 ? (
                            filtered.map(emp => (
                                <div
                                    key={emp.id}
                                    onClick={() => {
                                        onChange(emp.id)
                                        setIsOpen(false)
                                        setSearch('')
                                    }}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedId === emp.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-slate-800">{emp.first_name} {emp.last_name}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">{emp.employee_id} • {emp.designation || 'Employee'}</p>
                                    </div>
                                    {selectedId === emp.id && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-6 text-center text-xs text-slate-400 italic">
                                No employees found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
