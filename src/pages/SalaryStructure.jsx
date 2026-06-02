import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Search, User, Edit2, DollarSign, Calculator, X, Plus, Trash2, Info, Calendar, Save, AlertTriangle } from 'lucide-react'
import { CardSkeleton } from '../components/ui/SkeletonLoader'
import { applyCompanyFilter, withCompanyScope, getActiveCompanyId } from '../services/tenantScope'
import EmployeeSalaryCard from '../components/EmployeeSalaryCard'

// --- Deductions Helper Components & Modals ---

const Badge = ({ children, color = 'bg-slate-100 text-slate-700' }) => (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {children}
    </span>
)


const AddCustomDeductionModal = ({ isOpen, onClose, employees = [], onDeductionAdded, initialData = null }) => {
    const [formData, setFormData] = useState({
        employee_id: '',
        deduction_type: '',
        amount: '',
        reason: '',
        is_recurring: false,
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        status: 'Active'
    })

    useEffect(() => {
        if (initialData) {
            setFormData({
                employee_id: initialData.employee_id || '',
                deduction_type: initialData.deduction_type,
                amount: initialData.amount,
                reason: initialData.reason || '',
                is_recurring: initialData.is_recurring || false,
                start_date: initialData.start_date,
                end_date: initialData.end_date || '',
                status: initialData.status || 'Active'
            })
        } else {
            setFormData({
                employee_id: '',
                deduction_type: '',
                amount: '',
                reason: '',
                is_recurring: false,
                start_date: new Date().toISOString().split('T')[0],
                end_date: '',
                status: 'Active'
            })
        }
    }, [initialData, isOpen])

    if (!isOpen) return null

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const payload = {
                ...formData,
                amount: parseFloat(formData.amount) || 0,
                end_date: formData.end_date || null
            }

            let error = null
            if (initialData) {
                const { error: updateError } = await supabase
                    .from('custom_deductions')
                    .update(payload)
                    .eq('id', initialData.id)
                error = updateError
            } else {
                const { error: insertError } = await supabase
                    .from('custom_deductions')
                    .insert([payload])
                error = insertError
            }

            if (error) throw error
            onDeductionAdded(initialData ? 'updated' : 'added')
            onClose()
        } catch (err) {
            console.error('Error saving custom deduction:', err.message)
            const event = new CustomEvent('salary-structure-toast-error', { detail: err.message })
            window.dispatchEvent(event)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">{initialData ? 'Edit Custom Deduction' : 'Add Custom Deduction'}</h3>
                        <p className="text-sm text-gray-500 mt-1">{initialData ? 'Update custom deduction details.' : 'Add a custom deduction for a specific employee.'}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Employee Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Employee</label>
                        <select
                            required
                            className="w-full rounded-lg border-gray-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all"
                            value={formData.employee_id}
                            onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
                        >
                            <option value="">Select employee</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_id})</option>
                            ))}
                        </select>
                    </div>

                    {/* Type & Amount Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Deduction Type</label>
                            <input
                                type="text"
                                required
                                className="w-full rounded-lg border-gray-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all"
                                placeholder="e.g., Loan Recovery"
                                value={formData.deduction_type}
                                onChange={e => setFormData({ ...formData, deduction_type: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Amount (₹)</label>
                            <input
                                type="number"
                                required
                                step="0.01"
                                className="w-full rounded-lg border-gray-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all"
                                placeholder="e.g., 5000"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Reason/Description</label>
                        <textarea
                            className="w-full rounded-lg border-gray-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all resize-none"
                            placeholder="Enter reason for deduction"
                            rows="2"
                            value={formData.reason}
                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                        />
                    </div>

                    {/* Recurring Toggle */}
                    <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, is_recurring: !prev.is_recurring }))}
                        className="flex items-center space-x-3 w-full group"
                    >
                        <div className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${formData.is_recurring ? 'bg-slate-900' : 'bg-gray-200'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform duration-200 ${formData.is_recurring ? 'left-6' : 'left-1'}`} />
                        </div>
                        <span className="text-sm font-bold text-gray-700 group-hover:text-slate-900 transition-colors">Recurring Deduction</span>
                    </button>

                    {/* Dates Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Start Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    required
                                    className="w-full rounded-lg border-gray-200 bg-slate-50 pl-4 pr-10 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all"
                                    value={formData.start_date}
                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                />
                                <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">End Date (Optional)</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="w-full rounded-lg border-gray-200 bg-slate-50 pl-4 pr-10 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all"
                                    value={formData.end_date}
                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                />
                                <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-50 mt-6">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">Cancel</button>
                        <button type="submit" className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-sm shadow-slate-200 transition-all hover:shadow-md">{initialData ? 'Update Deduction' : 'Add Deduction'}</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// --- Main Pages ---

// Default configurations
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount || 0)
}

export default function SalaryStructure() {
    const { isAdmin } = useAuth()
    const toast = useToast()
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState('employee_salaries') // employee_salaries, salary_components, deductions
    const [successMessage, setSuccessMessage] = useState('') // eslint-disable-line no-unused-vars
    const [salaryComponents, setSalaryComponents] = useState({})

    // Deductions State
    const [isAddCustomOpen, setIsAddCustomOpen] = useState(false)
    const [customDeductions, setCustomDeductions] = useState([])
    const [editingCustomDeduction, setEditingCustomDeduction] = useState(null)

    // Add Component Modal State
    const [isAddComponentModalOpen, setIsAddComponentModalOpen] = useState(false)
    const [editingComponentKey, setEditingComponentKey] = useState(null)
    const [newComponent, setNewComponent] = useState({
        label: '',
        code: '',
        system_type: '',
        type: 'fixed',
        category: 'earning',
        value: '',
        min_limit: '',
        max_limit: '',
        taxable: false,
        is_statutory: false,
        status: 'Active'
    })

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState(null)
    const [basicSalary, setBasicSalary] = useState(0)
    const [effectiveDate, setEffectiveDate] = useState('')
    const [structure, setStructure] = useState({})
    const [calculated, setCalculated] = useState({ gross: 0, totalDeductions: 0, net: 0, components: {} })
    const [showEsiWarningModal, setShowEsiWarningModal] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    })

    // Bulk Revision State
    const [isImpactModalOpen, setIsImpactModalOpen] = useState(false)
    const [bulkRevisionLoading, setBulkRevisionLoading] = useState(false)
    const [pendingComponentData, setPendingComponentData] = useState(null)

    const resetComponentForm = useCallback(() => {
        setNewComponent({
            label: '',
            code: '',
            system_type: '',
            type: 'fixed',
            category: 'earning',
            value: '',
            min_limit: '',
            max_limit: '',
            taxable: false,
            is_statutory: false,
            status: 'Active'
        })
        setEditingComponentKey(null)
    }, [])

    const fetchDeductionsData = useCallback(async () => {
        try {
            // Fetch Custom Deductions
            const { data: customData } = await applyCompanyFilter(
                supabase.from('custom_deductions')
                    .select(`
                        id, employee_id, deduction_type, amount, reason, start_date, end_date, is_recurring, status,
                        employee:employees(first_name, last_name, employee_id)
                    `)
            )
            if (customData) setCustomDeductions(customData)
        } catch (error) {
            console.error('Error fetching deductions:', error)
        }
    }, [])

    const fetchComponents = useCallback(async () => {
        try {
            let { data, error } = await applyCompanyFilter(
                supabase
                    .from('salary_components')
                    .select('*')
            ).order('created_at', { ascending: true })

            if (error) throw error

            const companyId = getActiveCompanyId()
            if (data && data.length > 0) {
                // Auto-update Basic Salary component to percentage-based if it's currently fixed or 0 in DB
                const basicComp = data.find(comp => comp.code === 'BASIC')
                if (basicComp && (basicComp.calculation_type === 'fixed' || parseFloat(basicComp.value) === 0)) {
                    const { error: updateError } = await supabase
                        .from('salary_components')
                        .update({ calculation_type: 'percentage', value: 50 })
                        .eq('id', basicComp.id)
                    if (!updateError) {
                        const { data: updatedData, error: refetchError } = await applyCompanyFilter(
                            supabase
                                .from('salary_components')
                                .select('*')
                        ).order('created_at', { ascending: true })
                        if (!refetchError && updatedData) {
                            data = updatedData
                        }
                    }
                }
            }

            if (data && data.length === 0 && companyId) {
                const defaultComponents = [
                    { name: 'Basic Salary', code: 'BASIC', system_type: '', type: 'earning', calculation_type: 'percentage', value: 50, min_limit: 0, max_limit: 0, is_taxable: true, is_statutory: false, status: 'Active' },
                    { name: 'House Rent Allowance (HRA)', code: 'HRA', system_type: '', type: 'earning', calculation_type: 'percentage', value: 40, min_limit: 0, max_limit: 0, is_taxable: true, is_statutory: false, status: 'Active' },
                    { name: 'Dearness Allowance (DA)', code: 'DA', system_type: '', type: 'earning', calculation_type: 'percentage', value: 10, min_limit: 0, max_limit: 0, is_taxable: true, is_statutory: false, status: 'Active' },
                    { name: 'Medical Allowance', code: 'MED', system_type: '', type: 'earning', calculation_type: 'fixed', value: 1250, min_limit: 0, max_limit: 0, is_taxable: false, is_statutory: false, status: 'Active' },
                    { name: 'Conveyance Allowance', code: 'CONV', system_type: '', type: 'earning', calculation_type: 'fixed', value: 800, min_limit: 0, max_limit: 0, is_taxable: false, is_statutory: false, status: 'Active' },
                    { name: 'Special Allowance', code: 'SA', system_type: '', type: 'earning', calculation_type: 'fixed', value: 5000, min_limit: 0, max_limit: 0, is_taxable: true, is_statutory: false, status: 'Active' },
                    { name: 'Provident Fund', code: 'PF', system_type: 'PF', type: 'deduction', calculation_type: 'percentage', value: 12, min_limit: 0, max_limit: 15000, is_taxable: false, is_statutory: true, status: 'Active' },
                    { name: 'ESI', code: 'ESI', system_type: 'ESI', type: 'deduction', calculation_type: 'percentage', value: 0.75, min_limit: 0, max_limit: 0, is_taxable: false, is_statutory: true, status: 'Active' },
                    { name: 'Professional Tax', code: 'PT', system_type: 'PT', type: 'deduction', calculation_type: 'fixed', value: 200, min_limit: 0, max_limit: 0, is_taxable: false, is_statutory: true, status: 'Active' }
                ].map(comp => withCompanyScope(comp, companyId))

                const { data: insertedData, error: insertError } = await supabase
                    .from('salary_components')
                    .insert(defaultComponents)
                    .select()

                if (insertError) {
                    console.error('Error seeding default components:', insertError)
                } else if (insertedData) {
                    data = insertedData
                }
            }

            const componentsObj = {}
            data.forEach(comp => {
                const key = comp.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
                componentsObj[key] = {
                    id: comp.id,
                    label: comp.name,
                    code: comp.code || '',
                    system_type: comp.system_type || '',
                    type: comp.calculation_type,
                    value: parseFloat(comp.value),
                    min_limit: parseFloat(comp.min_limit) || 0,
                    max_limit: parseFloat(comp.max_limit) || 0,
                    category: comp.type,
                    taxable: comp.is_taxable,
                    is_statutory: comp.is_statutory,
                    status: comp.status,
                    enabled: true
                }
            })
            setSalaryComponents(componentsObj)
        } catch (error) {
            console.error('Error fetching salary components:', error)
        }
    }, [])

    const fetchEmployees = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await applyCompanyFilter(
                supabase
                    .from('employees')
                    .select('*')
            )
                .neq('status', 'terminated')
                .order('first_name')

            if (error) throw error
            setEmployees(data || [])
        } catch (error) {
            console.error('Error fetching employees:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    // Fetch all initial structural data in parallel on mount to avoid waterfalls and tab switching latency
    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true)
            try {
                // Fetch employees, components, and deductions in parallel
                await Promise.all([
                    fetchEmployees(),
                    fetchComponents(),
                    fetchDeductionsData()
                ])
            } catch (error) {
                console.error('Error loading initial data:', error)
            } finally {
                setLoading(false)
            }
        }
        loadInitialData()
    }, [fetchEmployees, fetchComponents, fetchDeductionsData])

    const calculateTotals = useCallback(() => {
        let totalAllowances = 0
        let totalDeductions = 0
        let componentValues = {}

        Object.entries(structure).forEach(([key, config]) => {
            const isBasic = config.label?.toLowerCase() === 'basic' || 
                            config.label?.toLowerCase() === 'basic salary' || 
                            config.code?.toLowerCase() === 'basic' || 
                            key.toLowerCase() === 'basic_salary';
            if (isBasic) return;

            if (config.category === 'earning' && config.enabled) {
                let amount = 0
                if (config.type === 'percentage') {
                    amount = (basicSalary * config.value) / 100
                } else {
                    amount = config.value
                }
                componentValues[key] = amount
                totalAllowances += amount
            }
        })

        const grossSalary = basicSalary + totalAllowances

        Object.entries(structure).forEach(([key, config]) => {
            if (config.category === 'deduction' && config.enabled) {
                // Statutory Eligibility (e.g., ESI)
                if (config.system_type === 'ESI') {
                    const esiLimit = editingEmployee?.is_specially_abled ? 25000 : 21000
                    if (grossSalary > esiLimit) return // Not eligible
                }

                let amount = 0
                if (config.type === 'percentage') {
                    // PF and ESI on Basic Salary as per user requirement.
                    // Fallback to labels if system_type is not set.
                    const label = config.label?.toLowerCase() || ''
                    const isBasicTarget = config.system_type === 'PF' ||
                        config.system_type === 'ESI' ||
                        label.includes('pf') ||
                        label.includes('provident fund') ||
                        label.includes('esi')

                    const base = isBasicTarget ? basicSalary : grossSalary

                    // Apply statutory limits if applicable
                    let effectiveBase = base;
                    if (config.max_limit > 0) effectiveBase = Math.min(effectiveBase, config.max_limit);
                    if (config.min_limit > 0) effectiveBase = Math.max(effectiveBase, config.min_limit);

                    amount = (effectiveBase * config.value) / 100
                } else {
                    amount = config.value
                }
                componentValues[key] = amount
                totalDeductions += amount
            }
        })

        setCalculated({
            gross: grossSalary,
            totalDeductions: totalDeductions,
            net: grossSalary - totalDeductions,
            components: componentValues
        })
    }, [basicSalary, structure, editingEmployee])

    useEffect(() => {
        if (isEditModalOpen) {
            calculateTotals()
        }
    }, [calculateTotals, isEditModalOpen])

    const handleEditClick = useCallback((employee) => {
        setEditingEmployee(employee)
        setBasicSalary((parseFloat(employee.salary) || 0) * 0.5)
        setEffectiveDate(employee.salary_effective_date || new Date().toISOString().split('T')[0])

        const existingStructure = employee.salary_structure || {}
        const mergedStructure = {}

        Object.keys(salaryComponents).forEach(key => {
            const globalDef = salaryComponents[key]

            if (existingStructure[key]) {
                mergedStructure[key] = {
                    ...globalDef,
                    enabled: existingStructure[key].enabled,
                    value: existingStructure[key].value,
                }
            } else {
                mergedStructure[key] = { ...globalDef }
            }
        })

        setStructure(mergedStructure)
        setIsEditModalOpen(true)
    }, [salaryComponents])

    const toggleComponent = useCallback((key) => {
        setStructure(prev => ({
            ...prev,
            [key]: { ...prev[key], enabled: !prev[key].enabled }
        }))
    }, [])

    const updateComponentValue = useCallback((key, newValue) => {
        setStructure(prev => ({
            ...prev,
            [key]: { ...prev[key], value: parseFloat(newValue) || 0, type: 'fixed' }
        }))
    }, [])

    const handleSave = useCallback(async (forceSave = false) => {
        try {
            // ESI Eligibility Validation
            const esiComponents = Object.entries(structure).filter(([key, config]) =>
                config.enabled && (
                    config.label?.toLowerCase().includes('esi') ||
                    key.toLowerCase().includes('esi') ||
                    config.label?.toLowerCase().includes('employee state insurance')
                )
            )

            if (esiComponents.length > 0 && !forceSave) {
                // ESI salary limit: ₹21,000 for regular employees, ₹25,000 for specially abled
                const esiLimit = editingEmployee?.is_specially_abled ? 25000 : 21000

                if (calculated.gross > esiLimit) {
                    setShowEsiWarningModal(true)
                    return // Pause saving, wait for custom modal action
                }
            }

            const updates = {
                salary: basicSalary * 2,
                salary_allowances: calculated.gross - basicSalary,
                salary_deductions: calculated.totalDeductions,
                salary_effective_date: effectiveDate,
                salary_structure: structure
            }

            const { data, error } = await supabase
                .from('employees')
                .update(updates)
                .eq('id', editingEmployee.id)
                .select()

            if (error) throw error

            if (data.length === 0) {
                toast.warning('Update failed: No records were modified. Check employee permissions.')
                return
            }

            toast.success('Salary structure updated successfully!')
            setIsEditModalOpen(false)
            fetchEmployees()
        } catch (error) {
            console.error('Update Error:', error)
            toast.error('Error updating salary structure: ' + error.message)
        }
    }, [structure, basicSalary, calculated, effectiveDate, editingEmployee, toast, fetchEmployees])

    const confirmSaveWithoutEsi = useCallback(() => {
        const esiComponents = Object.entries(structure).filter(([key, config]) =>
            config.enabled && (
                config.label?.toLowerCase().includes('esi') ||
                key.toLowerCase().includes('esi') ||
                config.label?.toLowerCase().includes('employee state insurance')
            )
        )
        
        esiComponents.forEach(([key]) => {
            structure[key].enabled = false
        })

        calculateTotals()
        setShowEsiWarningModal(false)
        handleSave(true)
    }, [structure, calculateTotals, handleSave])

    const autoBalanceSpecialAllowance = useCallback(() => {
        const targetCTC = basicSalary * 2

        const specialAllowanceKey = Object.keys(structure).find(key => 
            structure[key].label?.toLowerCase().includes('special allowance')
        )

        if (!specialAllowanceKey) {
            toast.error('Special Allowance component not found in the current structure.')
            return
        }

        const tempStructure = { ...structure }
        tempStructure[specialAllowanceKey] = {
            ...tempStructure[specialAllowanceKey],
            value: 0,
            enabled: true
        }

        let totalAllowances = 0
        Object.entries(tempStructure).forEach(([key, config]) => {
            const isBasic = config.label?.toLowerCase() === 'basic' || 
                            config.label?.toLowerCase() === 'basic salary' || 
                            config.code?.toLowerCase() === 'basic' || 
                            key.toLowerCase() === 'basic_salary';
            if (isBasic) return;

            if (config.category === 'earning' && config.enabled) {
                const amount = config.type === 'percentage' 
                    ? (basicSalary * config.value) / 100 
                    : (config.value || 0)
                totalAllowances += amount
            }
        })

        const grossSalaryWithoutSA = basicSalary + totalAllowances

        const epfWageBase = Math.min(basicSalary, 15000)
        const employerPF = (epfWageBase * 12) / 100

        const state = editingEmployee?.state || ''
        const getEmployerLWF = (stateName) => {
            switch (stateName) {
                case 'Maharashtra': return 12
                case 'Karnataka': return 40
                case 'Gujarat': return 12
                case 'Tamil Nadu': return 20
                case 'Andhra Pradesh': return 70
                case 'Telangana': return 70
                case 'Madhya Pradesh': return 20
                case 'Punjab': return 20
                case 'Kerala': return 8
                case 'Haryana': return 6
                case 'West Bengal': return 6
                case 'Odisha': return 6
                case 'Chhattisgarh': return 20
                case 'Jharkhand': return 20
                case 'Goa': return 20
                default: return 0
            }
        }
        const employerLWF = getEmployerLWF(state)

        const corporateAddonsWithoutESI = employerPF
        const esiLimit = editingEmployee?.is_specially_abled ? 25000 : 21000

        let targetGross = targetCTC - corporateAddonsWithoutESI

        if (targetGross <= esiLimit) {
            targetGross = (targetCTC - corporateAddonsWithoutESI) / 1.0325
        }

        const specialAllowance = Math.round(targetGross - grossSalaryWithoutSA)

        setStructure(prev => ({
            ...prev,
            [specialAllowanceKey]: {
                ...prev[specialAllowanceKey],
                value: Math.max(0, specialAllowance),
                enabled: true
            }
        }))

        toast.success(`Salary balanced! Computed Special Allowance: ₹${Math.max(0, specialAllowance).toLocaleString('en-IN')}`)
    }, [basicSalary, structure, editingEmployee, toast])

    const handleAddComponent = useCallback(async (forcedSave = false) => {
        try {
            const componentData = {
                name: newComponent.label,
                code: newComponent.code,
                system_type: newComponent.system_type,
                type: newComponent.category,
                calculation_type: newComponent.type,
                value: parseFloat(newComponent.value) || 0,
                min_limit: parseFloat(newComponent.min_limit) || 0,
                max_limit: parseFloat(newComponent.max_limit) || 0,
                is_taxable: newComponent.taxable,
                is_statutory: newComponent.is_statutory,
                status: newComponent.status
            }

            // Check if this is an edit of value, and if we should intercept for bulk revision modal
            if (editingComponentKey && !forcedSave) {
                const originalComponent = salaryComponents[editingComponentKey]
                const valueHasChanged = originalComponent && parseFloat(originalComponent.value) !== parseFloat(newComponent.value);
                if (valueHasChanged) {
                    setPendingComponentData(componentData)
                    setIsImpactModalOpen(true)
                    return // Open the impact modal
                }
            }

            let error = null

            if (editingComponentKey) {
                const id = salaryComponents[editingComponentKey].id
                const { error: updateError } = await supabase
                    .from('salary_components')
                    .update(componentData)
                    .eq('id', id)
                error = updateError
            } else {
                const { error: insertError } = await supabase
                    .from('salary_components')
                    .insert([componentData])
                error = insertError
            }

            if (error) throw error
            toast.success(editingComponentKey ? 'Component updated!' : 'Component added!')
            setIsImpactModalOpen(false)
            setPendingComponentData(null)
            setIsAddComponentModalOpen(false)
            resetComponentForm()
            fetchComponents()
        } catch (error) {
            console.error('Error saving component:', error)
            toast.error('Error saving component: ' + error.message)
        }
    }, [newComponent, editingComponentKey, salaryComponents, fetchComponents, resetComponentForm, toast])

    const handleBulkSalaryRevision = useCallback(async () => {
        if (!pendingComponentData || !editingComponentKey) return
        setBulkRevisionLoading(true)
        try {
            // 1. First, save the global component to the database (equivalent to Save for New Hires Only)
            const id = salaryComponents[editingComponentKey].id
            const { error: updateError } = await supabase
                .from('salary_components')
                .update(pendingComponentData)
                .eq('id', id)

            if (updateError) throw updateError

            // 2. Call the bulk salary revision Supabase Edge Function to update active employee structures
            const activeCompanyId = getActiveCompanyId()
            const { data, error: functionError } = await supabase.functions.invoke('bulk-salary-revision', {
                body: {
                    componentName: pendingComponentData.name,
                    componentCode: pendingComponentData.code,
                    newValue: pendingComponentData.value,
                    companyId: activeCompanyId
                }
            })

            if (functionError) {
                // Supabase wraps the real error. Let's dig it out.
                console.error("1. Full Error Object:", functionError);
                console.error("2. Error Name:", functionError.name);
                
                let errorMessage = functionError.message;
                
                // If the edge function sent back a JSON response with our actual error message, it lives here:
                if (functionError instanceof FunctionsHttpError || functionError.name === 'FunctionsHttpError' || (functionError.context && typeof functionError.context.json === 'function')) {
                    const rawError = await functionError.context.json().catch(() => null);
                    console.error("3. The REAL Backend Error:", rawError || "Could not parse backend error");
                    if (rawError && rawError.error) {
                        errorMessage = rawError.error;
                    }
                }
                
                throw new Error(errorMessage);
            }

            if (data?.success) {
                const updated = data.updatedCount || 0
                const skipped = data.skippedCount || 0
                const warningList = data.warnings || []
                
                toast.success(`Salaries revised successfully! Updated: ${updated} employee(s).`)

                if (warningList.length > 0) {
                    // Display details of skipped employees in a friendly warning toast or log
                    const warningNames = warningList.map(w => `${w.name} (${w.reason})`).join(', ')
                    toast.warning(`Skipped ${warningList.length} employee(s) due to flat adjustments constraint: ${warningNames}`, { duration: 8000 })
                }
            } else {
                throw new Error(data?.error || 'Bulk revision sync response was unsuccessful.')
            }

            // Close all modals and refresh data
            setIsImpactModalOpen(false)
            setPendingComponentData(null)
            setIsAddComponentModalOpen(false)
            resetComponentForm()
            fetchComponents()
            fetchEmployees() // Refresh employees list to show their revised salaries!
        } catch (error) {
            console.error('Bulk Revision Error:', error)
            toast.error('Bulk revision failed: ' + error.message)
        } finally {
            setBulkRevisionLoading(false)
        }
    }, [pendingComponentData, editingComponentKey, salaryComponents, fetchComponents, fetchEmployees, resetComponentForm, toast])

    const handleEditComponent = useCallback((key) => {
        const component = salaryComponents[key]
        setNewComponent({
            label: component.label,
            code: component.code || '',
            system_type: component.system_type || '',
            type: component.type,
            category: component.category,
            value: component.value,
            min_limit: component.min_limit || '',
            max_limit: component.max_limit || '',
            taxable: component.taxable || false,
            is_statutory: component.is_statutory || false,
            status: component.status || 'Active'
        })
        setEditingComponentKey(key)
        setIsAddComponentModalOpen(true)
    }, [salaryComponents])

    const performDeleteComponent = useCallback(async (key) => {
        const id = salaryComponents[key].id
        try {
            const { error } = await supabase.from('salary_components').delete().eq('id', id)
            if (error) throw error
            toast.success('Component deleted!')
            fetchComponents()
        } catch (error) {
            console.error('Error deleting component:', error)
            toast.error('Error deleting component: ' + error.message)
        } finally {
            setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))
        }
    }, [salaryComponents, fetchComponents, toast])

    const handleDeleteComponent = useCallback((key) => {
        setDeleteConfirmation({
            isOpen: true,
            title: 'Delete Component',
            message: `Are you sure you want to delete the "${salaryComponents[key].label}" component? This will permanently remove it from the available salary components list.`,
            onConfirm: () => performDeleteComponent(key)
        })
    }, [salaryComponents, performDeleteComponent])


    const handleEditCustomDeduction = useCallback((deduction) => {
        setEditingCustomDeduction(deduction)
        setIsAddCustomOpen(true)
    }, [])

    const performDeleteCustomDeduction = useCallback(async (id) => {
        try {
            const { error } = await supabase.from('custom_deductions').delete().eq('id', id)
            if (error) throw error
            toast.success('Custom deduction deleted!')
            fetchDeductionsData()
        } catch (error) {
            console.error('Error deleting custom deduction:', error)
            toast.error('Error deleting custom deduction: ' + error.message)
        } finally {
            setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))
        }
    }, [fetchDeductionsData, toast])

    const handleDeleteCustomDeduction = useCallback((id) => {
        const targetDeduction = customDeductions.find(d => d.id === id)
        const empName = targetDeduction ? `${targetDeduction.employee?.first_name} ${targetDeduction.employee?.last_name}` : ''
        const typeLabel = targetDeduction?.deduction_type || 'deduction'
        
        setDeleteConfirmation({
            isOpen: true,
            title: 'Delete Custom Deduction',
            message: `Are you sure you want to delete the ${typeLabel} of ₹${targetDeduction?.amount?.toLocaleString('en-IN')} for ${empName}? This action is permanent.`,
            onConfirm: () => performDeleteCustomDeduction(id)
        })
    }, [customDeductions, performDeleteCustomDeduction])

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp =>
            `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [employees, searchTerm])

    return (
        <div className="space-y-6">
            <header>
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-sm font-medium text-gray-400 mt-1">Manage salary structures, components, and deductions</p>
                    </div>
                </div>
            </header>

            {/* Main Tabs */}
            <div className="inline-flex items-center p-1 bg-white rounded-xl space-x-1 border border-gray-200">
                <button onClick={() => setActiveTab('employee_salaries')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 flex items-center space-x-2 ${activeTab === 'employee_salaries' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'}`}>
                    <User className="w-4 h-4" />
                    <span>Employee Salaries</span>
                </button>
                <button onClick={() => setActiveTab('salary_components')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 flex items-center space-x-2 ${activeTab === 'salary_components' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'}`}>
                    <DollarSign className="w-4 h-4" />
                    <span>Salary Components</span>
                </button>
                <button onClick={() => setActiveTab('deductions')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 flex items-center space-x-2 ${activeTab === 'deductions' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 hover:text-blue-700 hover:bg-blue-50'}`}>
                    <Calculator className="w-4 h-4" />
                    <span>Deductions</span>
                </button>
            </div>

            {/* Employee Salaries Tab */}
            {activeTab === 'employee_salaries' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    {/* Search */}
                    <div className="relative max-w-md mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all placeholder:text-gray-400"
                        />
                    </div>
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <CardSkeleton />
                            <CardSkeleton />
                            <CardSkeleton />
                            <CardSkeleton />
                            <CardSkeleton />
                            <CardSkeleton />
                        </div>
                    ) : filteredEmployees.length > 0 ? (
                        filteredEmployees.map((emp, index) => (
                            <EmployeeSalaryCard
                                key={emp.id}
                                emp={emp}
                                index={index}
                                isAdmin={isAdmin}
                                onEditClick={handleEditClick}
                                formatCurrency={formatCurrency}
                            />
                        ))
                    ) : (
                        <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center"><p className="text-gray-400 italic">No employees found matching your search.</p></div>
                    )}
                </div>
            )}

            {/* Salary Components Tab */}
            {activeTab === 'salary_components' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Salary Components</h3>
                            <p className="text-sm text-gray-500">Manage the building blocks of salary structures</p>
                        </div>
                        <button onClick={() => { resetComponentForm(); setIsAddComponentModalOpen(true) }} className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-gray-200">
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
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border w-fit ${component.category === 'earning' ? 'bg-slate-900 text-white border-slate-900' : 'bg-rose-600 text-white border-rose-600'}`}>{component.category.toUpperCase()}</span>
                                                    {component.is_statutory && <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 w-fit uppercase tracking-tighter">Statutory</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-medium capitalize">{component.type}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-gray-900">{component.type === 'fixed' ? formatCurrency(component.value) : `${component.value}%`}</div>
                                                {component.type === 'percentage' && <p className="text-[10px] text-gray-400 font-medium">on Basic/Gross</p>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {component.max_limit > 0 || component.min_limit > 0 ? (
                                                    <div className="flex flex-col space-y-1">
                                                        {component.max_limit > 0 && <span className="text-[10px] text-gray-500 font-medium">Max: {formatCurrency(component.max_limit)}</span>}
                                                        {component.min_limit > 0 && <span className="text-[10px] text-gray-500 font-medium">Min: {formatCurrency(component.min_limit)}</span>}
                                                    </div>
                                                ) : <span className="text-xs text-gray-300">-</span>}
                                            </td>
                                            <td className="px-6 py-4"><span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${component.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>{component.status}</span></td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-3">
                                                    <button onClick={() => handleEditComponent(key)} className="text-gray-400 hover:text-slate-900 transition-colors cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteComponent(key)} className="text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Deductions Tab */}
            {activeTab === 'deductions' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Custom Deductions Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Custom & Variable Deductions</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Manage employee-specific items like Loan recovery, Fines, or Advances</p>
                            </div>
                            <button onClick={() => setIsAddCustomOpen(true)} className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-gray-200">
                                <Plus className="w-4 h-4" /><span>Add Deduction</span>
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deduction Type</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Period</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {customDeductions.map((deduction) => (
                                        <tr key={deduction.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4"><div><div className="font-semibold text-slate-800">{deduction.employee?.first_name} {deduction.employee?.last_name}</div><div className="text-xs text-gray-400 font-medium mt-0.5">{deduction.employee?.employee_id}</div></div></td>
                                            <td className="px-6 py-4 text-sm text-slate-700">{deduction.deduction_type}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700">₹{deduction.amount?.toLocaleString('en-IN')}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={deduction.reason}>{deduction.reason || '-'}</td>
                                            <td className="px-6 py-4 text-xs text-gray-500"><div className="font-medium">{deduction.start_date}</div>{deduction.is_recurring && <div className="text-blue-500 mt-0.5">Recurring</div>}</td>
                                            <td className="px-6 py-4"><Badge color={deduction.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-gray-100 text-gray-500'}>{deduction.status}</Badge></td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditCustomDeduction(deduction)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteCustomDeduction(deduction.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {customDeductions.length === 0 && (<tr><td colSpan="7" className="px-6 py-12 text-center text-gray-400"><Info className="w-8 h-8 mx-auto mb-3 text-gray-300" /><p>No custom deductions found.</p></td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Modals */}
            {isAddComponentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddComponentModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div><h3 className="text-lg font-bold text-slate-900">{editingComponentKey ? 'Edit Salary Component' : 'Add Salary Component'}</h3><p className="text-xs text-gray-500 mt-1">{editingComponentKey ? 'Modify existing component details.' : 'Create a new salary component for use in salary structures.'}</p></div>
                            <button onClick={() => setIsAddComponentModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Component Name</label><input type="text" placeholder="e.g., Performance Bonus" className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900" value={newComponent.label} onChange={(e) => setNewComponent({ ...newComponent, label: e.target.value })} /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Code</label><input type="text" placeholder="e.g., BONUS" className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-slate-900" value={newComponent.code} onChange={(e) => setNewComponent({ ...newComponent, code: e.target.value })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Type</label><select className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-slate-900" value={newComponent.category} onChange={(e) => setNewComponent({ ...newComponent, category: e.target.value })}><option value="earning">Earning</option><option value="deduction">Deduction</option></select></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Calculation</label><select className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-slate-900" value={newComponent.type} onChange={(e) => setNewComponent({ ...newComponent, type: e.target.value })}><option value="fixed">Fixed Amount</option><option value="percentage">Percentage</option></select></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">{newComponent.type === 'fixed' ? 'Amount (₹)' : 'Rate (%)'}</label><input type="number" step="0.01" className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900" value={newComponent.value} onChange={(e) => setNewComponent({ ...newComponent, value: e.target.value })} /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">System Type</label><select className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-slate-900" value={newComponent.system_type} onChange={(e) => setNewComponent({ ...newComponent, system_type: e.target.value })}><option value="">None (Standard)</option><option value="PF">Provident Fund (PF)</option><option value="ESI">ESI</option><option value="PT">Professional Tax</option></select></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Min Limit (Floor)</label><input type="number" className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900" value={newComponent.min_limit} onChange={(e) => setNewComponent({ ...newComponent, min_limit: e.target.value })} /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Max Limit (Ceiling)</label><input type="number" className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900" value={newComponent.max_limit} onChange={(e) => setNewComponent({ ...newComponent, max_limit: e.target.value })} /></div>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center space-x-3"><button onClick={() => setNewComponent(prev => ({ ...prev, taxable: !prev.taxable }))} className={`w-10 h-5 rounded-full relative transition-colors ${newComponent.taxable ? 'bg-slate-900' : 'bg-gray-200'}`}><div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${newComponent.taxable ? 'left-5' : 'left-0.5'}`} /></button><span className="text-xs font-bold text-gray-700">Taxable</span></div>
                                <div className="flex items-center space-x-3"><button onClick={() => setNewComponent(prev => ({ ...prev, is_statutory: !prev.is_statutory }))} className={`w-10 h-5 rounded-full relative transition-colors ${newComponent.is_statutory ? 'bg-amber-600' : 'bg-gray-200'}`}><div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${newComponent.is_statutory ? 'left-5' : 'left-0.5'}`} /></button><span className="text-xs font-bold text-gray-700">Statutory Compliance</span></div>
                            </div>
                        </div>
                        <div className="flex justify-end items-center px-6 py-4 bg-gray-50 border-t border-gray-100 gap-3"><button type="button" onClick={() => setIsAddComponentModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-white">Cancel</button><button type="button" onClick={() => handleAddComponent(false)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800">{editingComponentKey ? 'Update Component' : 'Add Component'}</button></div>
                    </div>
                </div>
            )}

            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
                    <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-10"><div><h3 className="text-xl font-bold text-slate-800">Edit Salary Structure</h3><p className="text-sm text-gray-500">Configure salary structure for {editingEmployee?.first_name} {editingEmployee?.last_name} ({editingEmployee?.employee_id})</p></div><button onClick={() => setIsEditModalOpen(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button></div>
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                <div className="space-y-1.5 md:col-span-1"><label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Monthly CTC (₹)</label><input type="text" value={formatCurrency(basicSalary * 2)} readOnly className="w-full px-4 py-2.5 bg-slate-100 border border-gray-200 rounded-xl text-lg font-bold text-slate-900 cursor-not-allowed" /></div>
                                <div className="space-y-1.5 md:col-span-1"><label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Basic Salary (₹)</label><input type="text" value={formatCurrency(basicSalary)} readOnly className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-lg font-bold text-slate-900 cursor-not-allowed" /></div>
                                <div className="space-y-1.5 md:col-span-1"><label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Effective Date</label><input type="date" value={effectiveDate} readOnly className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium text-slate-900 cursor-not-allowed" /></div>
                                <div className="space-y-1.5 md:col-span-1"><label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Employee Details</label><div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl"><p className="text-sm font-bold text-slate-800 truncate">{editingEmployee?.designation || 'N/A'}</p><p className="text-xs text-slate-500">{editingEmployee?.department || 'N/A'}</p></div></div>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center"><span className="w-1 h-5 bg-blue-600 rounded-full mr-2"></span>Salary Components Configuration</h4>
                            <div className="space-y-3">
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-6 bg-slate-200 rounded-full relative opacity-50">
                                            <div className="w-5 h-5 bg-white rounded-full absolute right-1 top-0.5 shadow-sm"></div>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">Basic Salary</p>
                                            <p className="text-xs text-gray-500">
                                                earning • {
                                                    Object.values(structure).find(c => c.label?.toLowerCase() === 'basic salary' || c.label?.toLowerCase() === 'basic' || c.code?.toLowerCase() === 'basic')?.type || 'percentage'
                                                } ({
                                                    Object.values(structure).find(c => c.label?.toLowerCase() === 'basic salary' || c.label?.toLowerCase() === 'basic' || c.code?.toLowerCase() === 'basic')?.value || 50
                                                }%)
                                            </p>
                                        </div>
                                    </div>
                                    <p className="font-bold text-slate-900 text-lg">{formatCurrency(basicSalary)}</p>
                                </div>
                                {Object.entries(structure).map(([key, config]) => {
                                    // Skip 'Basic Salary' from the loop as it is hardcoded above
                                    if (config.label?.toLowerCase() === 'basic salary' || config.label?.toLowerCase() === 'basic') return null

                                    const amount = calculated.components[key] || 0
                                    return (
                                        <div key={key} className={`bg-white p-4 rounded-xl border shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${config.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                                            <div className="flex items-center space-x-4">
                                                <button onClick={() => toggleComponent(key)} className={`w-12 h-6 rounded-full relative transition-colors ${config.enabled ? 'bg-slate-800' : 'bg-gray-200'}`}><div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${config.enabled ? 'left-6' : 'left-1'}`} /></button>
                                                <div><p className={`font-bold ${config.enabled ? 'text-slate-800' : 'text-gray-400'}`}>{config.label}</p><p className="text-xs text-gray-500">{config.category} • {config.type} {config.type === 'percentage' && `(${config.value}%)`}</p></div>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <p className={`font-bold text-lg ${config.enabled ? 'text-slate-900' : 'text-gray-300'}`}>{config.category === 'deduction' && config.enabled && '-'}{formatCurrency(amount)}</p>
                                                {config.enabled && (
                                                    config.type === 'fixed' ? (
                                                        <div className="flex items-center space-x-2">
                                                            {config.label?.toLowerCase().includes('special allowance') && (
                                                                <button
                                                                    onClick={autoBalanceSpecialAllowance}
                                                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-100 transition-all active:scale-95 flex items-center space-x-1 shrink-0"
                                                                    title="Automatically adjust to match target CTC"
                                                                >
                                                                    <span>Auto-Balance</span>
                                                                </button>
                                                            )}
                                                            <div className="relative w-32">
                                                                <input
                                                                    type="number"
                                                                    className="w-full pl-6 pr-2 py-1.5 text-right text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                                                                    value={config.value}
                                                                    onChange={(e) => updateComponentValue(key, e.target.value)}
                                                                />
                                                                <span className="absolute left-2 top-1.5 text-gray-400 text-xs">₹</span>
                                                            </div>
                                                        </div>
                                                    ) : (<div className="w-32 text-right px-2 py-1.5 text-sm text-gray-400 bg-gray-50 rounded-lg border border-transparent">{config.value}%</div>)
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="flex justify-between items-center px-6 py-4 bg-white border-t border-gray-100">
                            <div className="flex space-x-8 text-sm">
                                <div><p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Gross Salary</p><p className="text-lg font-bold text-slate-800">{formatCurrency(calculated.gross)}</p></div>
                                <div><p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Total Deductions</p><p className="text-lg font-bold text-rose-600">-{formatCurrency(calculated.totalDeductions)}</p></div>
                                <div><p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Net Salary</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(calculated.net)}</p></div>
                            </div>
                            <div className="flex space-x-3">
                                <button onClick={() => setIsEditModalOpen(false)} className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                                <button onClick={handleSave} className="flex items-center space-x-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 shadow-lg shadow-gray-200 transition-colors font-bold"><Save className="w-4 h-4" /><span>Save Structure</span></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showEsiWarningModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setShowEsiWarningModal(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 overflow-hidden border border-gray-100 flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">ESI Eligibility Warning</h3>
                        </div>
                        <div className="space-y-3.5 text-sm text-slate-600 mb-6">
                            <p>
                                Employee's gross salary (<span className="font-bold text-slate-900">{formatCurrency(calculated.gross)}</span>) exceeds the statutory ESI eligibility threshold.
                            </p>
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-1.5 font-medium">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">ESIC Regulations Thresholds</p>
                                <div className="flex justify-between text-xs">
                                    <span>Regular Employees:</span>
                                    <span className="font-bold text-slate-800">₹21,000 / month</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span>Specially Abled Employees:</span>
                                    <span className="font-bold text-slate-800">₹25,000 / month</span>
                                </div>
                            </div>
                            <p className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start space-x-2">
                                <span>This employee is NOT eligible for ESI deductions under Indian compliance.</span>
                            </p>
                            <p className="text-xs text-slate-400">
                                Do you want to disable ESI and proceed to save the salary structure?
                            </p>
                        </div>
                        <div className="flex space-x-3 justify-end">
                            <button
                                onClick={() => setShowEsiWarningModal(false)}
                                className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSaveWithoutEsi}
                                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md"
                            >
                                Disable ESI & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmation.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))} />
                    <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-gray-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center space-x-3.5 border-b border-gray-50 pb-4">
                            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 leading-none">{deleteConfirmation.title}</h3>
                                <p className="text-xs text-gray-400 mt-1 font-medium">This action cannot be undone</p>
                            </div>
                        </div>
                        <div className="text-sm font-semibold text-slate-600 leading-relaxed">
                            {deleteConfirmation.message}
                        </div>
                        <div className="flex space-x-3 justify-end pt-2">
                            <button
                                onClick={() => setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))}
                                className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 transition-all active:scale-95 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={deleteConfirmation.onConfirm}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-rose-200 cursor-pointer"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Deductions Modals */}
            <AddCustomDeductionModal
                isOpen={isAddCustomOpen}
                onClose={() => {
                    setIsAddCustomOpen(false)
                    setEditingCustomDeduction(null)
                }}
                employees={employees}
                initialData={editingCustomDeduction}
                onDeductionAdded={(message) => {
                    fetchDeductionsData()
                    setSuccessMessage(message === 'updated' ? 'Custom deduction updated successfully!' : 'Custom deduction added successfully!')
                    setTimeout(() => setSuccessMessage(''), 3000)
                }}
            />

            {/* Global Impact Bulk Revision Confirmation Modal */}
            {isImpactModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !bulkRevisionLoading && setIsImpactModalOpen(false)} />
                    <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
                        
                        {/* Header */}
                        <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-550 shrink-0 shadow-inner">
                                <AlertTriangle className="w-6 h-6 animate-bounce" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 leading-tight">Global Salary Impact Revision</h3>
                                <p className="text-xs text-gray-400 mt-1 font-semibold uppercase tracking-wider">Bulk Revision Interceptor</p>
                            </div>
                        </div>

                        {/* Body Message */}
                        <div className="text-sm font-semibold text-slate-600 leading-relaxed space-y-3">
                            <p>
                                You are modifying a global salary component value. Do you want to apply this new value to all existing active employees?
                            </p>
                            <p className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-xs text-slate-550 flex items-start gap-2.5 font-medium">
                                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                <span>
                                    To keep the employee's total CTC unchanged, the difference will be automatically balanced against their <strong>Special Allowance</strong>.
                                </span>
                            </p>
                            {pendingComponentData && (
                                <div className="grid grid-cols-2 gap-4 bg-slate-100/50 p-3 rounded-xl border border-gray-200/50 text-xs mt-2">
                                    <div>
                                        <span className="text-gray-400">Component:</span>
                                        <p className="font-bold text-slate-800">{pendingComponentData.name} ({pendingComponentData.code})</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">New Value:</span>
                                        <p className="font-bold text-indigo-600">₹{pendingComponentData.value.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
                            <button
                                type="button"
                                disabled={bulkRevisionLoading}
                                onClick={() => setIsImpactModalOpen(false)}
                                className="px-4 py-3 border border-gray-200 rounded-2xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-50 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={bulkRevisionLoading}
                                onClick={() => handleAddComponent(true)}
                                className="px-5 py-3 border border-indigo-200 hover:border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                Save for New Hires Only
                            </button>
                            <button
                                type="button"
                                disabled={bulkRevisionLoading}
                                onClick={handleBulkSalaryRevision}
                                className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-slate-200 cursor-pointer flex items-center justify-center gap-2 min-w-44 disabled:opacity-80"
                            >
                                {bulkRevisionLoading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Revising Salaries...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3.5 h-3.5" />
                                        <span>Revise All Salaries</span>
                                    </>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    )
}
