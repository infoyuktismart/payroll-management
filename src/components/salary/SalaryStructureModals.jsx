import { useEffect, useState } from 'react'
import { X, Calendar, Save, AlertTriangle, Trash2, Info } from 'lucide-react'

// --- 1. Add/Edit Custom Deduction Modal ---
export function AddCustomDeductionModal({
    isOpen,
    onClose,
    employees = [],
    onSubmit,
    initialData = null,
    submitting = false
}) {
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
                deduction_type: initialData.deduction_type || '',
                amount: initialData.amount || '',
                reason: initialData.reason || '',
                is_recurring: initialData.is_recurring || false,
                start_date: initialData.start_date || new Date().toISOString().split('T')[0],
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

    const handleSubmitLocal = (e) => {
        e.preventDefault()
        const payload = {
            ...formData,
            amount: parseFloat(formData.amount) || 0,
            end_date: formData.end_date || null
        }
        onSubmit(payload)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">
                            {initialData ? 'Edit Custom Deduction' : 'Add Custom Deduction'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {initialData ? 'Update custom deduction details.' : 'Add a custom deduction for a specific employee.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmitLocal} className="p-6 space-y-5">
                    {/* Employee Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Employee</label>
                        <select
                            required
                            disabled={!!initialData}
                            className="w-full rounded-lg border-gray-200 bg-slate-50 px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all disabled:opacity-65"
                            value={formData.employee_id}
                            onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
                        >
                            <option value="">Select employee</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.first_name} {emp.last_name} ({emp.employee_id})
                                </option>
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
                        <div
                            className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${
                                formData.is_recurring ? 'bg-slate-900' : 'bg-gray-200'
                            }`}
                        >
                            <div
                                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform duration-200 ${
                                    formData.is_recurring ? 'left-6' : 'left-1'
                                }`}
                            />
                        </div>
                        <span className="text-sm font-bold text-gray-700 group-hover:text-slate-900 transition-colors">
                            Recurring Deduction
                        </span>
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
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-sm shadow-slate-200 transition-all hover:shadow-md disabled:opacity-55"
                        >
                            {submitting ? 'Saving...' : initialData ? 'Update Deduction' : 'Add Deduction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// --- 2. Add/Edit Salary Component Modal ---
export function SalaryComponentModal({
    isOpen,
    onClose,
    editingComponentKey = null,
    newComponent,
    setNewComponent,
    onSubmit
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">
                            {editingComponentKey ? 'Edit Salary Component' : 'Add Salary Component'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            {editingComponentKey ? 'Modify existing component details.' : 'Create a new salary component for use in salary structures.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Component Name</label>
                            <input
                                type="text"
                                placeholder="e.g., Performance Bonus"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900"
                                value={newComponent.label}
                                onChange={(e) => setNewComponent({ ...newComponent, label: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Code</label>
                            <input
                                type="text"
                                placeholder="e.g., BONUS"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-slate-900"
                                value={newComponent.code}
                                onChange={(e) => setNewComponent({ ...newComponent, code: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                            <select
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-slate-900"
                                value={newComponent.category}
                                onChange={(e) => setNewComponent({ ...newComponent, category: e.target.value })}
                            >
                                <option value="earning">Earning</option>
                                <option value="deduction">Deduction</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Calculation</label>
                            <select
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-slate-900"
                                value={newComponent.type}
                                onChange={(e) => setNewComponent({ ...newComponent, type: e.target.value })}
                            >
                                <option value="fixed">Fixed Amount</option>
                                <option value="percentage">Percentage</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">
                                {newComponent.type === 'fixed' ? 'Amount (₹)' : 'Rate (%)'}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900"
                                value={newComponent.value}
                                onChange={(e) => setNewComponent({ ...newComponent, value: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">System Type</label>
                            <select
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-slate-900"
                                value={newComponent.system_type}
                                onChange={(e) => setNewComponent({ ...newComponent, system_type: e.target.value })}
                            >
                                <option value="">None (Standard)</option>
                                <option value="PF">Provident Fund (PF)</option>
                                <option value="ESI">ESI</option>
                                <option value="PT">Professional Tax</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Min Limit (Floor)</label>
                            <input
                                type="number"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900"
                                value={newComponent.min_limit}
                                onChange={(e) => setNewComponent({ ...newComponent, min_limit: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Max Limit (Ceiling)</label>
                            <input
                                type="number"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900"
                                value={newComponent.max_limit}
                                onChange={(e) => setNewComponent({ ...newComponent, max_limit: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setNewComponent(prev => ({ ...prev, taxable: !prev.taxable }))}
                                className={`w-10 h-5 rounded-full relative transition-colors ${
                                    newComponent.taxable ? 'bg-slate-900' : 'bg-gray-200'
                                }`}
                            >
                                <div
                                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${
                                        newComponent.taxable ? 'left-5' : 'left-0.5'
                                    }`}
                                />
                            </button>
                            <span className="text-xs font-bold text-gray-700">Taxable</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setNewComponent(prev => ({ ...prev, is_statutory: !prev.is_statutory }))}
                                className={`w-10 h-5 rounded-full relative transition-colors ${
                                    newComponent.is_statutory ? 'bg-amber-600' : 'bg-gray-200'
                                }`}
                            >
                                <div
                                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${
                                        newComponent.is_statutory ? 'left-5' : 'left-0.5'
                                    }`}
                                />
                            </button>
                            <span className="text-xs font-bold text-gray-700">Statutory Compliance</span>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end items-center px-6 py-4 bg-gray-50 border-t border-gray-100 gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-white"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800"
                    >
                        {editingComponentKey ? 'Update Component' : 'Add Component'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// --- 3. Edit Salary Structure Modal ---
export function EditSalaryStructureModal({
    isOpen,
    onClose,
    editingEmployee,
    basicSalary,
    effectiveDate,
    structure,
    toggleComponent,
    updateComponentValue,
    calculated,
    autoBalanceSpecialAllowance,
    onSave,
    formatCurrency
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-10">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Edit Salary Structure</h3>
                        <p className="text-sm text-gray-500">
                            Configure salary structure for {editingEmployee?.first_name} {editingEmployee?.last_name} ({editingEmployee?.employee_id})
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="space-y-1.5 md:col-span-1">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Monthly CTC (₹)</label>
                            <input
                                type="text"
                                value={formatCurrency(basicSalary * 2)}
                                readOnly
                                className="w-full px-4 py-2.5 bg-slate-100 border border-gray-200 rounded-xl text-lg font-bold text-slate-900 cursor-not-allowed"
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-1">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Basic Salary (₹)</label>
                            <input
                                type="text"
                                value={formatCurrency(basicSalary)}
                                readOnly
                                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-lg font-bold text-slate-900 cursor-not-allowed"
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-1">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Effective Date</label>
                            <input
                                type="date"
                                value={effectiveDate}
                                readOnly
                                className="w-full px-4 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm font-medium text-slate-900 cursor-not-allowed"
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-1">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Employee Details</label>
                            <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl">
                                <p className="text-sm font-bold text-slate-800 truncate">{editingEmployee?.designation || 'N/A'}</p>
                                <p className="text-xs text-slate-550 truncate">{editingEmployee?.department || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                        <span className="w-1 h-5 bg-blue-600 rounded-full mr-2"></span>
                        Salary Components Configuration
                    </h4>
                    <div className="space-y-3">
                        {/* Basic Salary hardcoded row */}
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
                            if (config.label?.toLowerCase() === 'basic salary' || config.label?.toLowerCase() === 'basic') return null

                            const amount = calculated.components[key] || 0
                            return (
                                <div
                                    key={key}
                                    className={`bg-white p-4 rounded-xl border shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                        config.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'
                                    }`}
                                >
                                    <div className="flex items-center space-x-4">
                                        <button
                                            onClick={() => toggleComponent(key)}
                                            className={`w-12 h-6 rounded-full relative transition-colors ${
                                                config.enabled ? 'bg-slate-800' : 'bg-gray-200'
                                            }`}
                                        >
                                            <div
                                                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform ${
                                                    config.enabled ? 'left-6' : 'left-1'
                                                }`}
                                            />
                                        </button>
                                        <div>
                                            <p className={`font-bold ${config.enabled ? 'text-slate-800' : 'text-gray-400'}`}>
                                                {config.label}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {config.category} • {config.type} {config.type === 'percentage' && `(${config.value}%)`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <p className={`font-bold text-lg ${config.enabled ? 'text-slate-900' : 'text-gray-300'}`}>
                                            {config.category === 'deduction' && config.enabled && '-'}{formatCurrency(amount)}
                                        </p>
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
                                            ) : (
                                                <div className="w-32 text-right px-2 py-1.5 text-sm text-gray-400 bg-gray-50 rounded-lg border border-transparent">
                                                    {config.value}%
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="flex justify-between items-center px-6 py-4 bg-white border-t border-gray-100">
                    <div className="flex space-x-8 text-sm">
                        <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Gross Salary</p>
                            <p className="text-lg font-bold text-slate-800">{formatCurrency(calculated.gross)}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Total Deductions</p>
                            <p className="text-lg font-bold text-rose-600">-{formatCurrency(calculated.totalDeductions)}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wider font-bold">Net Salary</p>
                            <p className="text-lg font-bold text-emerald-600">{formatCurrency(calculated.net)}</p>
                        </div>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(false)}
                            className="flex items-center space-x-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 shadow-lg shadow-gray-200 transition-colors font-bold"
                        >
                            <Save className="w-4 h-4" /><span>Save Structure</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- 4. ESI Eligibility Warning Modal ---
export function EsiWarningModal({
    isOpen,
    onClose,
    calculated,
    confirmSaveWithoutEsi,
    formatCurrency
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
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
                        onClick={onClose}
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
    )
}

// --- 5. Global Impact Bulk Revision Confirmation Modal ---
export function BulkRevisionImpactModal({
    isOpen,
    onClose,
    bulkRevisionLoading,
    pendingComponentData,
    handleAddComponent,
    handleBulkSalaryRevision
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => !bulkRevisionLoading && onClose()}
            />
            <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 shadow-inner animate-pulse">
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
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
                                <p className="font-bold text-indigo-600">
                                    {pendingComponentData.calculation_type === 'percentage' 
                                        ? `${pendingComponentData.value}%` 
                                        : `₹${pendingComponentData.value.toLocaleString('en-IN')}`}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
                    <button
                        type="button"
                        disabled={bulkRevisionLoading}
                        onClick={onClose}
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
    )
}

// --- 6. Delete Confirmation Modal ---
export function DeleteConfirmationModal({
    isOpen,
    onClose,
    title,
    message,
    onConfirm
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-gray-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
                <div className="flex items-center space-x-3.5 border-b border-gray-50 pb-4">
                    <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                        <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-900 leading-none">{title}</h3>
                        <p className="text-xs text-gray-400 mt-1 font-medium">This action cannot be undone</p>
                    </div>
                </div>
                <div className="text-sm font-semibold text-slate-600 leading-relaxed">
                    {message}
                </div>
                <div className="flex space-x-3 justify-end pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 transition-all active:scale-95 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-rose-200 cursor-pointer"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    )
}
