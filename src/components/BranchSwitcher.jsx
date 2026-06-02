import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, GitCommit, MapPin } from 'lucide-react'
import { useCompany } from '../context/CompanyContext'

export default function BranchSwitcher() {
    const { branches, selectedBranch, setSelectedBranch, loading } = useCompany()
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

    if (loading || branches.length === 0) {
        return null
    }

    const activeBranch = branches.find(b => b.id === selectedBranch)

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen(prev => !prev)}
                className="h-11 min-w-48 max-w-64 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 transition"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">
                            {activeBranch ? activeBranch.name : 'All Branches'}
                        </p>
                        <p className="text-[11px] font-semibold text-gray-550 truncate mt-[-2px]">
                            {activeBranch ? 'Active Branch' : 'Showing all records'}
                        </p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Branch</p>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-2" role="listbox">
                        {/* All Branches option */}
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedBranch(null)
                                queryClient.invalidateQueries()
                                setOpen(false)
                            }}
                            className={`w-full rounded-xl px-3 py-2 text-left transition flex items-center gap-3 ${!selectedBranch ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                            role="option"
                            aria-selected={!selectedBranch}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${!selectedBranch ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {!selectedBranch ? <Check className="w-3.5 h-3.5" /> : <GitCommit className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold truncate">All Branches</p>
                            </div>
                        </button>

                        {/* Individual branches */}
                        {branches.map(item => {
                            const selected = item.id === selectedBranch
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedBranch(item.id)
                                        queryClient.invalidateQueries()
                                        setOpen(false)
                                    }}
                                    className={`w-full rounded-xl px-3 py-2 text-left transition flex items-center gap-3 mt-1 ${selected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                    role="option"
                                    aria-selected={selected}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {selected ? <Check className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold truncate">{item.name}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
