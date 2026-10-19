import { useState, useEffect } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'

export default function EmployeeCombobox({ employees = [], selectedId, onChange }) {
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
        <div className="relative employee-combobox min-w-85">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full bg-orange-50 px-5 py-3.5 rounded-xl border border-orange-200 shadow-sm cursor-pointer hover:bg-orange-100 transition-colors"
            >
                <div className="flex flex-col items-start overflow-hidden">
                    <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-orange-600/70">Viewing As</span>
                    <span className="text-sm font-bold text-slate-800 truncate w-full leading-tight">
                        {selectedEmp ? `${selectedEmp.first_name} ${selectedEmp.last_name} (${selectedEmp.employee_id})` : 'Select Employee'}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-orange-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-orange-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-orange-50 bg-orange-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search by name or ID..."
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none font-medium"
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
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedId === emp.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                >
                                    <div>
                                        <p className="text-sm font-bold">{emp.first_name} {emp.last_name}</p>
                                        <p className="text-xs opacity-70">{emp.employee_id} • {emp.designation}</p>
                                    </div>
                                    {selectedId === emp.id && <Check className="w-4 h-4" />}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-sm text-gray-400 italic">
                                No employees found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
