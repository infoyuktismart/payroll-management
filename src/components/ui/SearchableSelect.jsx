import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'

export default function SearchableSelect({
    name,
    value,
    onChange,
    options, // Can be array of strings, array of {value, label}, or array of {label, options} (grouped)
    placeholder = 'Select option...',
    className = '',
    error = false,
    disabled = false
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const containerRef = useRef(null)
    const inputRef = useRef(null)

    // Normalize options into a flat array of { value, label, group } for searching and keyboard navigation
    const flatOptions = useMemo(() => {
        const result = []
        if (!options) return result

        options.forEach(opt => {
            if (typeof opt === 'string') {
                result.push({ value: opt, label: opt })
            } else if (opt && typeof opt === 'object') {
                if (Array.isArray(opt.options)) {
                    // Grouped options
                    opt.options.forEach(subOpt => {
                        const val = typeof subOpt === 'string' ? subOpt : subOpt.value
                        const lbl = typeof subOpt === 'string' ? subOpt : subOpt.label
                        result.push({ value: val, label: lbl, group: opt.label })
                    })
                } else {
                    // Standard {value, label} object
                    result.push({ value: opt.value, label: opt.label })
                }
            }
        })
        return result
    }, [options])

    // Selected option label
    const selectedLabel = useMemo(() => {
        const found = flatOptions.find(opt => opt.value === value)
        return found ? found.label : ''
    }, [value, flatOptions])

    // Filtered options based on search query
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return flatOptions
        const term = searchTerm.toLowerCase().trim()
        return flatOptions.filter(opt =>
            opt.label.toLowerCase().includes(term) ||
            (opt.group && opt.group.toLowerCase().includes(term))
        )
    }, [searchTerm, flatOptions])

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Reset keyboard focus index when dropdown opens/closes or search term changes
    useEffect(() => {
        setFocusedIndex(-1)
    }, [isOpen, searchTerm])

    // Handle selecting an option
    const handleSelect = (optionValue) => {
        onChange({
            target: {
                name,
                value: optionValue
            }
        })
        setIsOpen(false)
        setSearchTerm('')
    }

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (disabled) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!isOpen) {
                setIsOpen(true)
            } else {
                setFocusedIndex(prev => (prev + 1) % filteredOptions.length)
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (isOpen) {
                setFocusedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length)
            }
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (isOpen && focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
                handleSelect(filteredOptions[focusedIndex].value)
            } else if (!isOpen) {
                setIsOpen(true)
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false)
        } else if (e.key === 'Tab') {
            setIsOpen(false)
        }
    }

    // Focus input when dropdown is opened
    const handleTriggerClick = () => {
        if (disabled) return
        setIsOpen(prev => !prev)
        if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }

    // Regroup filtered options for rendering (maintaining headers)
    const groupedFiltered = useMemo(() => {
        const groups = {}
        const noGroup = []

        filteredOptions.forEach(opt => {
            if (opt.group) {
                if (!groups[opt.group]) {
                    groups[opt.group] = []
                }
                groups[opt.group].push(opt)
            } else {
                noGroup.push(opt)
            }
        })

        return { groups, noGroup }
    }, [filteredOptions])

    // Find overall index in filteredOptions for an item in grouped rendering (for focused style)
    const getOverallIndex = (optionValue) => {
        return filteredOptions.findIndex(opt => opt.value === optionValue)
    }

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            {/* Display / Search Input */}
            <div
                onClick={handleTriggerClick}
                onKeyDown={handleKeyDown}
                tabIndex={disabled ? -1 : 0}
                className={`flex items-center justify-between w-full border rounded-xl shadow-sm p-3 bg-slate-50 font-medium text-slate-800 cursor-pointer transition-all ${
                    disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'hover:border-slate-300'
                } ${
                    isOpen ? 'bg-white ring-2 ring-slate-900 border-transparent' : ''
                } ${
                    error ? 'border-red-500 focus:ring-red-500' : 'border-gray-200'
                }`}
            >
                {isOpen ? (
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full bg-transparent border-0 p-0 text-sm font-medium text-slate-800 focus:ring-0 focus:outline-none placeholder:text-slate-400"
                        placeholder={selectedLabel || placeholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className={`text-sm ${value ? 'text-slate-800' : 'text-slate-400'}`}>
                        {selectedLabel || placeholder}
                    </span>
                )}
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {value && !disabled && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                handleSelect('')
                            }}
                            className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-slate-600' : ''}`} />
                </div>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-[999] w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-100">
                    {filteredOptions.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-400 font-semibold uppercase tracking-wider">
                            No options found
                        </div>
                    ) : (
                        <div className="py-1">
                            {/* Non-grouped options */}
                            {groupedFiltered.noGroup.map(opt => {
                                const overallIdx = getOverallIndex(opt.value)
                                const isSelected = opt.value === value
                                const isFocused = overallIdx === focusedIndex
                                return (
                                    <div
                                        key={opt.value}
                                        onClick={() => handleSelect(opt.value)}
                                        className={`flex items-center justify-between px-4 py-2.5 text-sm font-medium cursor-pointer transition-all ${
                                            isSelected ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                                        } ${isFocused ? 'bg-slate-50 text-slate-900' : ''}`}
                                    >
                                        <span>{opt.label}</span>
                                        {isSelected && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                                    </div>
                                )
                            })}

                            {/* Grouped options */}
                            {Object.entries(groupedFiltered.groups).map(([groupName, groupOpts]) => (
                                <div key={groupName} className="border-t border-slate-50 first:border-t-0">
                                    <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                                        {groupName}
                                    </div>
                                    {groupOpts.map(opt => {
                                        const overallIdx = getOverallIndex(opt.value)
                                        const isSelected = opt.value === value
                                        const isFocused = overallIdx === focusedIndex
                                        return (
                                            <div
                                                key={opt.value}
                                                onClick={() => handleSelect(opt.value)}
                                                className={`flex items-center justify-between px-6 py-2.5 text-sm font-medium cursor-pointer transition-all ${
                                                    isSelected ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                                                } ${isFocused ? 'bg-slate-50 text-slate-900' : ''}`}
                                            >
                                                <span>{opt.label}</span>
                                                {isSelected && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
