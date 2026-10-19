import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCompany } from '../context/CompanyContext'
import { useToast } from '../context/ToastContext'
import {
    useSalaryComponents,
    useCreateSalaryComponent,
    useUpdateSalaryComponent,
    useDeleteSalaryComponent,
    useCustomDeductions,
    useCreateCustomDeduction,
    useUpdateCustomDeduction,
    useDeleteCustomDeduction,
    useSalaryEmployees,
    useUpdateEmployeeSalaryStructure,
    useBulkSalaryRevision
} from '../hooks/useSalaryData'
import SalaryFilterBar from '../components/salary/SalaryFilterBar'
import SalaryStructureTable from '../components/salary/SalaryStructureTable'
import SalaryComponentList from '../components/salary/SalaryComponentList'
import CustomDeductionsList from '../components/salary/CustomDeductionsList'
import {
    AddCustomDeductionModal,
    SalaryComponentModal,
    EditSalaryStructureModal,
    EsiWarningModal,
    BulkRevisionImpactModal,
    DeleteConfirmationModal
} from '../components/salary/SalaryStructureModals'

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount || 0)
}

export default function SalaryStructure() {
    const { isAdmin } = useAuth()
    const { activeCompanyId } = useCompany()
    const toast = useToast()

    const [searchTerm, setSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState('employee_salaries') // employee_salaries, salary_components, deductions

    // Deductions State
    const [isAddCustomOpen, setIsAddCustomOpen] = useState(false)
    const [editingCustomDeduction, setEditingCustomDeduction] = useState(null)

    // Add/Edit Component Modal State
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

    // Edit Structure Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState(null)
    const [basicSalary, setBasicSalary] = useState(0)
    const [effectiveDate, setEffectiveDate] = useState('')
    const [structure, setStructure] = useState({})
    const [calculated, setCalculated] = useState({ gross: 0, totalDeductions: 0, net: 0, components: {} })
    const [showEsiWarningModal, setShowEsiWarningModal] = useState(false)

    // Delete Confirmation Modal State
    const [deleteConfirmation, setDeleteConfirmation] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null
    })

    // Bulk Revision Impact Modal State
    const [isImpactModalOpen, setIsImpactModalOpen] = useState(false)
    const [pendingComponentData, setPendingComponentData] = useState(null)

    // --- React Query Hooks ---
    const employeesQuery = useSalaryEmployees()
    const componentsQuery = useSalaryComponents()
    const deductionsQuery = useCustomDeductions()

    const employees = employeesQuery.data || []
    const customDeductions = deductionsQuery.data || []
    const loading = employeesQuery.isLoading || componentsQuery.isLoading || deductionsQuery.isLoading

    const salaryComponentsRaw = componentsQuery.data || []
    const salaryComponents = useMemo(() => {
        const componentsObj = {}
        salaryComponentsRaw.forEach(comp => {
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
        return componentsObj
    }, [salaryComponentsRaw])

    // --- Mutations ---
    const createComponentMutation = useCreateSalaryComponent()
    const updateComponentMutation = useUpdateSalaryComponent()
    const deleteComponentMutation = useDeleteSalaryComponent()
    
    const createDeductionMutation = useCreateCustomDeduction()
    const updateDeductionMutation = useUpdateCustomDeduction()
    const deleteDeductionMutation = useDeleteCustomDeduction()

    const updateEmployeeStructureMutation = useUpdateEmployeeSalaryStructure()
    const bulkSalaryRevisionMutation = useBulkSalaryRevision()

    // --- Component Reset ---
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

    // --- Totals Calculation ---
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

    // --- Handlers ---
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
                const esiLimit = editingEmployee?.is_specially_abled ? 25000 : 21000

                if (calculated.gross > esiLimit) {
                    setShowEsiWarningModal(true)
                    return // Pause saving, wait for warning modal decision
                }
            }

            const updates = {
                salary: basicSalary * 2,
                salary_allowances: calculated.gross - basicSalary,
                salary_deductions: calculated.totalDeductions,
                salary_effective_date: effectiveDate,
                salary_structure: structure
            }

            await updateEmployeeStructureMutation.mutateAsync({
                employeeId: editingEmployee.id,
                updates
            })

            setIsEditModalOpen(false)
        } catch (error) {
            console.error('Update Error:', error)
        }
    }, [structure, basicSalary, calculated, effectiveDate, editingEmployee, updateEmployeeStructureMutation])

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

    // --- Component Actions ---
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

            if (editingComponentKey && !forcedSave) {
                const originalComponent = salaryComponents[editingComponentKey]
                const valueHasChanged = originalComponent && parseFloat(originalComponent.value) !== parseFloat(newComponent.value);
                if (valueHasChanged) {
                    setPendingComponentData(componentData)
                    setIsImpactModalOpen(true)
                    return // Open bulk revision interceptor
                }
            }

            if (editingComponentKey) {
                const id = salaryComponents[editingComponentKey].id
                await updateComponentMutation.mutateAsync({ id, payload: componentData })
            } else {
                await createComponentMutation.mutateAsync(componentData)
            }

            setIsImpactModalOpen(false)
            setPendingComponentData(null)
            setIsAddComponentModalOpen(false)
            resetComponentForm()
        } catch (error) {
            console.error('Error saving component:', error)
        }
    }, [newComponent, editingComponentKey, salaryComponents, resetComponentForm, createComponentMutation, updateComponentMutation])

    const handleBulkSalaryRevision = useCallback(async () => {
        if (!pendingComponentData || !editingComponentKey) return
        try {
            await bulkSalaryRevisionMutation.mutateAsync({
                componentName: pendingComponentData.name,
                componentCode: pendingComponentData.code,
                newValue: pendingComponentData.value,
                companyId: activeCompanyId
            })

            setIsImpactModalOpen(false)
            setPendingComponentData(null)
            setIsAddComponentModalOpen(false)
            resetComponentForm()
        } catch (error) {
            console.error('Bulk Revision Error:', error)
        }
    }, [pendingComponentData, editingComponentKey, activeCompanyId, resetComponentForm, bulkSalaryRevisionMutation])

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
            await deleteComponentMutation.mutateAsync(id)
        } catch (error) {
            console.error('Error deleting component:', error)
        } finally {
            setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))
        }
    }, [salaryComponents, deleteComponentMutation])

    const handleDeleteComponent = useCallback((key) => {
        setDeleteConfirmation({
            isOpen: true,
            title: 'Delete Component',
            message: `Are you sure you want to delete the "${salaryComponents[key].label}" component? This will permanently remove it from the available salary components list.`,
            onConfirm: () => performDeleteComponent(key)
        })
    }, [salaryComponents, performDeleteComponent])

    // --- Deductions Actions ---
    const handleEditCustomDeduction = useCallback((deduction) => {
        setEditingCustomDeduction(deduction)
        setIsAddCustomOpen(true)
    }, [])

    const performDeleteCustomDeduction = useCallback(async (id) => {
        try {
            await deleteDeductionMutation.mutateAsync(id)
        } catch (error) {
            console.error('Error deleting custom deduction:', error)
        } finally {
            setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))
        }
    }, [deleteDeductionMutation])

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

    const handleCustomDeductionSubmit = async (payload) => {
        try {
            if (editingCustomDeduction) {
                await updateDeductionMutation.mutateAsync({
                    id: editingCustomDeduction.id,
                    payload
                })
            } else {
                await createDeductionMutation.mutateAsync(payload)
            }
            setIsAddCustomOpen(false)
            setEditingCustomDeduction(null)
        } catch (error) {
            console.error('Error saving custom deduction:', error)
        }
    }

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

            {/* Filter/Tab Bar */}
            <SalaryFilterBar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Employee Salaries Tab */}
            {activeTab === 'employee_salaries' && (
                <SalaryStructureTable
                    employees={filteredEmployees}
                    loading={loading}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    isAdmin={isAdmin}
                    onEditClick={handleEditClick}
                    formatCurrency={formatCurrency}
                />
            )}

            {/* Salary Components Tab */}
            {activeTab === 'salary_components' && (
                <SalaryComponentList
                    salaryComponents={salaryComponents}
                    onEditComponent={handleEditComponent}
                    onDeleteComponent={handleDeleteComponent}
                    onAddComponentClick={() => { resetComponentForm(); setIsAddComponentModalOpen(true) }}
                    formatCurrency={formatCurrency}
                />
            )}

            {/* Deductions Tab */}
            {activeTab === 'deductions' && (
                <CustomDeductionsList
                    customDeductions={customDeductions}
                    onEditCustomDeduction={handleEditCustomDeduction}
                    onDeleteCustomDeduction={handleDeleteCustomDeduction}
                    onAddCustomDeductionClick={() => setIsAddCustomOpen(true)}
                />
            )}

            {/* Modals Container */}
            <AddCustomDeductionModal
                isOpen={isAddCustomOpen}
                onClose={() => {
                    setIsAddCustomOpen(false)
                    setEditingCustomDeduction(null)
                }}
                employees={employees}
                onSubmit={handleCustomDeductionSubmit}
                initialData={editingCustomDeduction}
                submitting={createDeductionMutation.isPending || updateDeductionMutation.isPending}
            />

            <SalaryComponentModal
                isOpen={isAddComponentModalOpen}
                onClose={() => setIsAddComponentModalOpen(false)}
                editingComponentKey={editingComponentKey}
                newComponent={newComponent}
                setNewComponent={setNewComponent}
                onSubmit={() => handleAddComponent(false)}
            />

            <EditSalaryStructureModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                editingEmployee={editingEmployee}
                basicSalary={basicSalary}
                effectiveDate={effectiveDate}
                structure={structure}
                toggleComponent={toggleComponent}
                updateComponentValue={updateComponentValue}
                calculated={calculated}
                autoBalanceSpecialAllowance={autoBalanceSpecialAllowance}
                onSave={handleSave}
                formatCurrency={formatCurrency}
            />

            <EsiWarningModal
                isOpen={showEsiWarningModal}
                onClose={() => setShowEsiWarningModal(false)}
                calculated={calculated}
                confirmSaveWithoutEsi={confirmSaveWithoutEsi}
                formatCurrency={formatCurrency}
            />

            <BulkRevisionImpactModal
                isOpen={isImpactModalOpen}
                onClose={() => setIsImpactModalOpen(false)}
                bulkRevisionLoading={bulkSalaryRevisionMutation.isPending}
                pendingComponentData={pendingComponentData}
                handleAddComponent={handleAddComponent}
                handleBulkSalaryRevision={handleBulkSalaryRevision}
            />

            <DeleteConfirmationModal
                isOpen={deleteConfirmation.isOpen}
                onClose={() => setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))}
                title={deleteConfirmation.title}
                message={deleteConfirmation.message}
                onConfirm={deleteConfirmation.onConfirm}
            />
        </div>
    )
}
