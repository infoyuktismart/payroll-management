import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'

export const adminService = {
    /**
     * Retrieves admin settings including departments, holidays, policies, and recent logs.
     * @returns {Promise<{departments: Array, holidays: Array, leavePolicies: Array, auditLogs: Array, notificationLogs: Array}>} Object containing lists of admin data
     */
    async getAdminSettings() {
        return withRetry(async () => {
            const [deptRes, holidayRes, leaveRes, auditRes, notificationRes] = await Promise.all([
                applyCompanyFilter(supabase.from('departments').select('*').order('name')),
                applyCompanyFilter(supabase.from('holidays').select('*').order('date', { ascending: true })),
                applyCompanyFilter(supabase.from('leave_policies').select('*').order('leave_type')),
                supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(25),
                applyCompanyFilter(supabase.from('notification_logs').select('*').order('created_at', { ascending: false }).limit(25))
            ])

            if (deptRes.error) throw deptRes.error
            if (holidayRes.error) throw holidayRes.error
            if (leaveRes.error) throw leaveRes.error
            if (auditRes.error) throw auditRes.error
            if (notificationRes.error) throw notificationRes.error

            return {
                departments: deptRes.data || [],
                holidays: holidayRes.data || [],
                leavePolicies: leaveRes.data || [],
                auditLogs: auditRes.data || [],
                notificationLogs: notificationRes.data || []
            }
        })
    },

    /**
     * Adds a new department.
     * @param {string} name - Name of the department
     * @returns {Promise<Object>} Newly created department record
     */
    async addDepartment(name) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('departments')
                .insert(withCompanyScope({ name }))
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Adds a new holiday.
     * @param {Object} holiday - The holiday object
     * @param {string} holiday.name - Name of the holiday
     * @param {string} holiday.date - Date string (YYYY-MM-DD)
     * @returns {Promise<Object>} Newly created holiday record
     */
    async addHoliday({ name, date }) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('holidays')
                .insert(withCompanyScope({ name, date }))
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Adds a new leave policy rule.
     * @param {Object} policy - The leave policy object
     * @param {string} policy.leaveType - Type of leave
     * @param {number} policy.annualBalance - Annual allowed balance
     * @returns {Promise<Object>} Newly created leave policy record
     */
    async addLeavePolicy({ leaveType, annualBalance }) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('leave_policies')
                .insert(withCompanyScope({
                    leave_type: leaveType,
                    annual_balance: Number(annualBalance) || 0
                }))
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Removes an admin configuration row.
     * @param {Object} params
     * @param {string} params.table - Table name to delete from
     * @param {string} params.id - Row ID to delete
     * @returns {Promise<boolean>} Resolves to true if successful
     */
    async removeAdminRow({ table, id }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from(table)
                .delete()
                .eq('id', id)
            if (companyId && !['audit_logs'].includes(table)) query = query.eq('company_id', companyId)
            const { error } = await query
            if (error) throw error
            return true
        })
    },

    /**
     * Invokes database RPC to initialize leave balances for a year.
     * @param {number} [year=new Date().getFullYear()] - Year to initialize
     * @returns {Promise<any>} RPC response data
     */
    async initializeLeaveBalances(year = new Date().getFullYear()) {
        return withRetry(async () => {
            const { data, error } = await supabase.rpc('initialize_leave_balances', {
                p_year: year
            })
            if (error) throw error
            return data
        })
    }
}
