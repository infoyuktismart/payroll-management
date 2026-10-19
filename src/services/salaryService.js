import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'

export const salaryService = {
    /**
     * Get salary components.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getSalaryComponents() {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('salary_components')
                .select('*')
                .order('created_at', { ascending: true })
            query = applyCompanyFilter(query)
            let { data, error } = await query
            if (error) throw error

            if (data && data.length > 0) {
                // Auto-update Basic Salary component to percentage-based if it's currently fixed or 0 in DB
                const basicComp = data.find(comp => comp.code === 'BASIC')
                if (basicComp && (basicComp.calculation_type === 'fixed' || parseFloat(basicComp.value) === 0)) {
                    const { error: updateError } = await supabase
                        .from('salary_components')
                        .update({ calculation_type: 'percentage', value: 50 })
                        .eq('id', basicComp.id)
                    if (!updateError) {
                        let refetchQuery = supabase
                            .from('salary_components')
                            .select('*')
                            .order('created_at', { ascending: true })
                        refetchQuery = applyCompanyFilter(refetchQuery)
                        const { data: updatedData, error: refetchError } = await refetchQuery
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

            return data || []
        })
    },

    /**
     * Create salary component.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createSalaryComponent(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('salary_components')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Update salary component.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateSalaryComponent({ id, payload }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('salary_components')
                .update(payload)
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { data, error } = await query
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Delete salary component.
     * @param {any} id - The id parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async deleteSalaryComponent(id) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('salary_components')
                .delete()
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { error } = await query
            if (error) throw error
            return true
        })
    },

    /**
     * Get custom deductions.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getCustomDeductions() {
        return withRetry(async () => {
            let query = supabase
                .from('custom_deductions')
                .select(`
                    id, employee_id, deduction_type, amount, reason, start_date, end_date, is_recurring, status,
                    employee:employees(first_name, last_name, employee_id)
                `)
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Get active custom deductions by period.
     * @param {any} startDate - The startDate parameter
     * @param {any} endDate - The endDate parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getActiveCustomDeductionsByPeriod(startDate, endDate) {
        return withRetry(async () => {
            let query = supabase
                .from('custom_deductions')
                .select('*')
                .eq('status', 'Active')
                .lte('start_date', endDate)
                .or(`end_date.is.null,end_date.gte.${startDate}`)
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Create custom deduction.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createCustomDeduction(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('custom_deductions')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Update custom deduction.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateCustomDeduction({ id, payload }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('custom_deductions')
                .update(payload)
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { data, error } = await query
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Delete custom deduction.
     * @param {any} id - The id parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async deleteCustomDeduction(id) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('custom_deductions')
                .delete()
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { error } = await query
            if (error) throw error
            return true
        })
    },

    /**
     * Get employees for salary structures.
     * Only non-terminated employees.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getSalaryEmployees() {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('employees')
                .select('*')
                .neq('status', 'terminated')
                .order('first_name', { ascending: true })
            query = applyCompanyFilter(query, companyId)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Update employee's salary details.
     * @param {Object} params - The parameter object
     * @param {any} params.employeeId - Employee ID
     * @param {any} params.updates - Salary structure updates
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateEmployeeSalaryStructure({ employeeId, updates }) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('employees')
                .update(updates)
                .eq('id', employeeId)
                .select()
            if (error) throw error
            return data || []
        })
    },

    /**
     * Perform bulk salary revision.
     * @param {Object} params - The parameter object
     * @param {string} params.componentName - Component name
     * @param {string} params.componentCode - Component code
     * @param {number} params.newValue - New component value
     * @param {string} params.companyId - Company ID
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async bulkSalaryRevision({ componentName, componentCode, newValue, companyId }) {
        return withRetry(async () => {
            const { data, error } = await supabase.functions.invoke('bulk-salary-revision', {
                body: {
                    componentName,
                    componentCode,
                    newValue,
                    companyId
                }
            })
            if (error) throw error
            return data
        })
    },

    /**
     * Get salary payments logs.
     * @param {Object} params
     * @param {string} params.employeeId
     * @param {boolean} params.isAdmin
     * @returns {Promise<Array>}
     */
    async getSalaries({ employeeId, isAdmin } = {}) {
        return withRetry(async () => {
            let query = supabase
                .from('salaries')
                .select('*')
                .order('month', { ascending: false })
            query = applyCompanyFilter(query)
            if (!isAdmin && employeeId) {
                query = query.eq('employee_id', employeeId)
            }
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Process/Create a salary payment record.
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async createSalaryPayment(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('salaries')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    }
}
