import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, Check, ChevronDown, MapPin } from 'lucide-react'
import { useCompany } from '../context/CompanyContext'

export default function CompanySwitcher() {
    const { company, companies, branches, activeCompanyId, switchCompany, loading } = useCompany()
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const rootRef = useRef(null)

    useEffect(() => {
        const onPointerDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', onPointerDown)
        return () => document.removeEventListener('mousedown', onPointerDown)
    }, [])

    if (loading || companies.length === 0) {
        return (
            <div className="hidden md:flex h-10 w-48 rounded-xl bg-slate-100 animate-pulse" aria-hidden="true" />
        )
    }

    const activeBranch = branches.find(branch => branch.is_head_office) || branches[0]

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen(prev => !prev)}
                className="h-11 min-w-56 max-w-72 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 transition"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">{company?.name || 'Company'}</p>
                        <p className="text-[11px] font-semibold text-gray-500 truncate">
                            {activeBranch ? activeBranch.name : company?.city || 'All branches'}
                        </p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Company</p>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-2" role="listbox">
                        {companies.map(item => {
                            const selected = item.id === activeCompanyId
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        switchCompany(item.id)
                                        queryClient.invalidateQueries()
                                        setOpen(false)
                                    }}
                                    className={`w-full rounded-xl px-3 py-3 text-left transition flex items-start gap-3 ${selected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                    role="option"
                                    aria-selected={selected}
                                >
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {selected ? <Check className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black truncate">{item.name}</p>
                                        <p className="text-xs font-medium opacity-75 truncate">{item.code || item.legal_name || 'Tenant'}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                    <div className="px-4 py-3 border-t border-gray-100 bg-slate-50">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-semibold">{branches.length} branch{branches.length === 1 ? '' : 'es'} available</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
