import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, withCompanyScope } from './tenantScope'

export const leaveService = {
    /**
     * Get leave policies.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getLeavePolicies() {
        return withRetry(async () => {
            let query = supabase
                .from('leave_policies')
                .select('*')
                .order('leave_type')
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Get leaves.
     * @param {Object} params - The parameter object
     * @param {any} params.employeeId - The employeeId parameter
     * @param {any} params.isAdmin - The isAdmin parameter
     * @param {any} params.page - The page parameter
     * @param {any} params.pageSize - The pageSize parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getLeaves({ employeeId, isAdmin, page = 0, pageSize = 50 } = {}) {
        return withRetry(async () => {
            let query = supabase
                .from('leaves')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
            query = applyCompanyFilter(query)
            if (!isAdmin && employeeId) {
                query = query.eq('employee_id', employeeId)
            }
            const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1)
            if (error) throw error
            return { data: data || [], count, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) }
        })
    },

    async getLeaveBalances(employeeId, year = new Date().getFullYear()) {
        return withRetry(async () => {
            let query = supabase
                .from('leave_balances')
                .select('*')
                .eq('employee_id', employeeId)
                .eq('year', year)
                .order('leave_type')
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Create leave request.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createLeaveRequest(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('leaves')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Update leave status.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.status - The status parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateLeaveStatus({ id, status }) {
        return withRetry(async () => {
            const rpcName = status === 'approved' ? 'approve_leave_request' : 'reject_leave_request'
            const { error } = await supabase.rpc(rpcName, { p_leave_id: id })
            if (error) throw error
            return true
        })
    },

    /**
     * Get leave with employee.
     * @param {any} id - The id parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getLeaveWithEmployee(id) {
        return withRetry(async () => {
            let query = supabase
                .from('leaves')
                .select('id, leave_type, employee:employees(first_name, last_name, email)')
                .eq('id', id)
            query = applyCompanyFilter(query)
            const { data, error } = await query
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Get leave applications with employee.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getLeaveApplicationsWithEmployee() {
        return withRetry(async () => {
            let query = supabase
                .from('leaves')
                .select(`
                    *,
                    employee:employees(first_name, last_name, department)
                `)
                .order('created_at', { ascending: false })
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Get approved leaves by period.
     * @param {any} startDate - The startDate parameter
     * @param {any} endDate - The endDate parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getApprovedLeavesByPeriod(startDate, endDate) {
        return withRetry(async () => {
            let query = supabase
                .from('leaves')
                .select('*')
                .eq('status', 'approved')
                .lte('start_date', endDate)
                .gte('end_date', startDate)
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    }
}
