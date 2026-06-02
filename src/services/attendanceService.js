import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'

export const attendanceService = {
    /**
     * Get holidays.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getHolidays() {
        return withRetry(async () => {
            let query = supabase
                .from('holidays')
                .select('*')
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Get holidays by period.
     * @param {any} startDate - The startDate parameter
     * @param {any} endDate - The endDate parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getHolidaysByPeriod(startDate, endDate) {
        return withRetry(async () => {
            let query = supabase
                .from('holidays')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate)
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Get attendance by period.
     * @param {any} startDate - The startDate parameter
     * @param {any} endDate - The endDate parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getAttendanceByPeriod(startDate, endDate) {
        return withRetry(async () => {
            let query = supabase
                .from('attendance')
                .select('status, date')
                .gte('date', startDate)
                .lte('date', endDate)
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Get daily attendance.
     * @param {Object} params - The parameter object
     * @param {any} params.startDate - The startDate parameter
     * @param {any} params.endDate - The endDate parameter
     * @param {any} params.statusFilter - The statusFilter parameter
     * @param {any} params.page - The page parameter
     * @param {any} params.pageSize - The pageSize parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getDailyAttendance({ startDate, endDate, statusFilter, page = 0, pageSize = 50 } = {}) {
        return withRetry(async () => {
            let query = supabase
                .from('attendance')
                .select('*, employee:employees(first_name, last_name, employee_id, department, designation)', { count: 'exact' })
                .order('date', { ascending: false })
                .order('check_in', { ascending: true })
            query = applyCompanyFilter(query)

            if (startDate && endDate) {
                query = query.gte('date', startDate).lte('date', endDate)
            }

            if (statusFilter && statusFilter !== 'All Status') {
                query = query.eq('status', statusFilter)
            }

            const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1)
            if (error) throw error
            return { data: data || [], count, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) }
        })
    },

    /**
     * Get calendar attendance.
     * @param {any} employeeId - The employeeId parameter
     * @param {any} startDate - The startDate parameter
     * @param {any} endDate - The endDate parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getCalendarAttendance(employeeId, startDate, endDate) {
        return withRetry(async () => {
            let query = supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', employeeId)
                .gte('date', startDate)
                .lte('date', endDate)
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Get regularization requests.
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getRegularizationRequests() {
        return withRetry(async () => {
            let query = supabase
                .from('attendance_regularizations')
                .select('*, employee:employees(first_name, last_name, employee_id, department)')
                .order('created_at', { ascending: false })
            query = applyCompanyFilter(query)
            const { data, error } = await query
            if (error) throw error
            return data || []
        })
    },

    /**
     * Update regularization status.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.status - The status parameter
     * @param {any} params.reviewedBy - The reviewedBy parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateRegularizationStatus({ id, status, reviewedBy }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('attendance_regularizations')
                .update({
                    status,
                    reviewed_by: reviewedBy,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { data, error } = await query
                .select()
            if (error) throw error
            return data
        })
    },

    /**
     * Get attendance record.
     * @param {any} employeeId - The employeeId parameter
     * @param {any} date - The date parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getAttendanceRecord(employeeId, date) {
        return withRetry(async () => {
            let query = supabase
                .from('attendance')
                .select('id')
                .eq('employee_id', employeeId)
                .eq('date', date)
            query = applyCompanyFilter(query)
            const { data, error } = await query
                .maybeSingle()
            if (error) throw error
            return data
        })
    },

    /**
     * Create attendance.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createAttendance(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('attendance')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
    /**
     * Upsert attendance.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async upsertAttendance(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('attendance')
                .upsert(withCompanyScope(payload), { onConflict: 'employee_id, date' })
                .select()
            if (error) throw error
            const record = Array.isArray(data) ? data[0] : data
            if (record) {
                await this.calculateAndSaveOvertime(record.id, record.check_in, record.check_out, record.employee_id, record.date)
                await this.calculateAndCreditCompOff(record.employee_id, record.date)
            }
            return data
        })
    },

    /**
     * Update attendance.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateAttendance({ id, payload }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('attendance')
                .update(payload)
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { data, error } = await query
                .select()
                .single()
            if (error) throw error
            if (data) {
                await this.calculateAndSaveOvertime(data.id, data.check_in, data.check_out, data.employee_id, data.date)
                await this.calculateAndCreditCompOff(data.employee_id, data.date)
            }
            return data
        })
    },

    /**
     * Delete attendance.
     * @param {any} id - The id parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async deleteAttendance(id) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('attendance')
                .delete()
                .eq('id', id)
            if (companyId) query = query.eq('company_id', companyId)
            const { error } = await query
            if (error) throw error
            return true
        })
    },

    /**
     * Get overtime requests.
     * @param {Object} params - The parameter object
     * @param {any} params.employeeId - The employeeId parameter
     * @param {any} params.isAdmin } - The isAdmin } parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getOvertimeRequests({ employeeId, isAdmin } = {}) {
        return withRetry(async () => {
            let query = supabase.from('overtime').select('*').order('created_at', { ascending: false })
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
     * Create overtime request.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createOvertimeRequest(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('overtime')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Update overtime status.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.status - The status parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateOvertimeStatus({ id, status }) {
        return withRetry(async () => {
            const companyId = getActiveCompanyId()
            let query = supabase
                .from('overtime')
                .update({ status })
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
     * Compute overtime automatically for an attendance record.
     */
    async calculateAndSaveOvertime(attendanceId, checkIn, checkOut, employeeId, date) {
        if (!checkIn || !checkOut) return
        
        try {
            // Fetch company policy to resolve shift core hours dynamically
            const companyId = getActiveCompanyId()
            let policyQuery = supabase.from('attendance_policies').select('*')
            if (companyId) policyQuery = policyQuery.eq('company_id', companyId)
            const { data: policies } = await policyQuery.limit(1)
            
            let standardHours = 9 // Default core shift hours
            if (policies && policies.length > 0) {
                const policy = policies[0]
                if (policy.core_start_time && policy.core_end_time) {
                    const startParts = policy.core_start_time.split(':').map(Number)
                    const endParts = policy.core_end_time.split(':').map(Number)
                    const startHours = startParts[0] + (startParts[1] / 60)
                    const endHours = endParts[0] + (endParts[1] / 60)
                    let diff = endHours - startHours
                    if (diff < 0) diff += 24 // Handle overnight shifts
                    standardHours = diff
                }
            }

            // Standardize time inputs (handling ISO dates or clean time strings)
            const cleanCheckIn = checkIn.includes('T') ? checkIn.split('T')[1].substring(0, 8) : checkIn
            const cleanCheckOut = checkOut.includes('T') ? checkOut.split('T')[1].substring(0, 8) : checkOut

            const diffMs = new Date(`${date}T${cleanCheckOut}`) - new Date(`${date}T${cleanCheckIn}`)
            const hoursWorked = diffMs / (1000 * 60 * 60)
            
            if (hoursWorked > standardHours) {
                const otHours = parseFloat((hoursWorked - standardHours).toFixed(2))
                
                // 1. Insert into overtime requests table
                await supabase.from('overtime').insert([withCompanyScope({
                    employee_id: employeeId,
                    date,
                    hours: otHours,
                    status: 'approved',
                    remarks: `Auto-calculated overtime (shift length: ${standardHours} hrs)`
                })])

                // 2. Write directly to the overtime_hours column on the attendance record
                await supabase
                    .from('attendance')
                    .update({ overtime_hours: otHours })
                    .eq('id', attendanceId)
            } else {
                await supabase
                    .from('attendance')
                    .update({ overtime_hours: 0.00 })
                    .eq('id', attendanceId)
            }
        } catch (err) {
            console.error('Error calculating and saving overtime:', err)
        }
    },

    /**
     * Trigger automatic credits to Comp Off leave balances when employees check in on holidays or weekends.
     */
    async calculateAndCreditCompOff(employeeId, date) {
        try {
            const checkDate = new Date(date)
            const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6
            
            // Query holidays table with tenant scoping
            const companyId = getActiveCompanyId()
            let holidayQuery = supabase.from('holidays').select('*').eq('date', date)
            if (companyId) holidayQuery = holidayQuery.eq('company_id', companyId)
            const { data: holiday } = await holidayQuery.maybeSingle()

            if (isWeekend || holiday) {
                const { data: balance } = await supabase
                    .from('leave_balances')
                    .select('*')
                    .eq('employee_id', employeeId)
                    .eq('leave_type', 'Comp Off')
                    .maybeSingle()
                
                if (balance) {
                    await supabase
                        .from('leave_balances')
                        .update({ balance: Number(balance.balance || 0) + 1 })
                        .eq('id', balance.id)
                } else {
                    await supabase
                        .from('leave_balances')
                        .insert([withCompanyScope({
                            employee_id: employeeId,
                            leave_type: 'Comp Off',
                            balance: 1
                        })])
                }
            }
        } catch (err) {
            console.error('Error calculating and crediting comp off:', err)
        }
    }
}
