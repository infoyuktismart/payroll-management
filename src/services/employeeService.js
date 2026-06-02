import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'

export const employeeService = {
    /**
     * Get employees.
     * @param {Object} params - The parameter object
     * @param {any} params.page - The page parameter
     * @param {any} params.pageSize - The pageSize parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getEmployees({ page = 0, pageSize = 50 } = {}) {
        return withRetry(async () => {
            let query = supabase
                .from('employees')
                .select('*', { count: 'exact' })
                .order('joining_date', { ascending: true })
                .order('created_at', { ascending: true })
            query = applyCompanyFilter(query)
            const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1)
            if (error) throw error
            return { data: data || [], count, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) }
        })
    },

    /**
     * Get all employees.
     * @param {Object} params - The parameter object
     * @param {any} params.pageSize - The pageSize parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getAllEmployees({ pageSize = 1000 } = {}) {
        const response = await this.getEmployees({ page: 0, pageSize })
        return Array.isArray(response) ? response : response?.data || []
    },

    /**
     * Get employee by id.
     * @param {any} id - The id parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getEmployeeById(id) {
        return withRetry(async () => {
            let query = supabase
                .from('employees')
                .select('*')
                .eq('id', id)
            query = applyCompanyFilter(query)
            const { data, error } = await query
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Get employee by email.
     * @param {any} email - The email parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getEmployeeByEmail(email) {
        return withRetry(async () => {
            let query = supabase
                .from('employees')
                .select('*')
                .eq('email', email)
            query = applyCompanyFilter(query)
            const { data, error } = await query
                .maybeSingle()
            if (error) throw error
            return data
        })
    },

    /**
     * Generate next employee id.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async generateNextEmployeeId() {
        return withRetry(async () => {
            const prefix = 'EMP'
            let query = supabase
                .from('employees')
                .select('employee_id')
                .ilike('employee_id', `${prefix}%`)
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error

            let nextSerial = 1
            if (data && data.length > 0) {
                const serials = data
                    .map(emp => {
                        const numericPart = emp.employee_id?.substring(prefix.length)
                        const val = parseInt(numericPart, 10)
                        return isNaN(val) ? null : val
                    })
                    .filter(val => val !== null)

                if (serials.length > 0) {
                    nextSerial = Math.max(...serials) + 1
                }
            }
            return `${prefix}${nextSerial.toString().padStart(3, '0')}`
        })
    },

    /**
     * Create employee.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createEmployee(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('employees')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Update employee.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateEmployee({ id, payload }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('employees')
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
     * Delete employee.
     * @param {any} id - The id parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async deleteEmployee(id) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('employees')
                .delete()
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { error } = await query
            if (error) throw error
            return true
        })
    }
}
