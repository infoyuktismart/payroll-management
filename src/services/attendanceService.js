import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'
import { planEntitlementService } from './planEntitlementService'

export const attendanceService = {
  /**
   * Get holidays.
   * @returns {Promise<any>} A promise that resolves with the result
   */
  async getHolidays() {
    return withRetry(async () => {
      let query = supabase.from('holidays').select('*')
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
      let query = supabase.from('holidays').select('*').gte('date', startDate).lte('date', endDate)
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
        .select(
          '*, employee:employees(first_name, last_name, employee_id, department, designation)',
          { count: 'exact' }
        )
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
      return {
        data: data || [],
        count,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      }
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
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (companyId) query = query.eq('company_id', companyId)
      const { data, error } = await query.select()
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
      const { data, error } = await query.maybeSingle()
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
      await planEntitlementService.assertActiveSubscription(payload?.company_id)
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
      await planEntitlementService.assertActiveSubscription(payload?.company_id)
      const { data, error } = await supabase
        .from('attendance')
        .upsert(withCompanyScope(payload), { onConflict: 'employee_id, date' })
        .select()
      if (error) throw error
      const record = Array.isArray(data) ? data[0] : data
      if (record) {
        await this.calculateAndSaveOvertime(
          record.id,
          record.check_in,
          record.check_out,
          record.employee_id,
          record.date
        )
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
      await planEntitlementService.assertActiveSubscription()
      const companyId = getActiveCompanyId()
      let query = supabase.from('attendance').update(payload).eq('id', id)
      if (companyId) query = query.eq('company_id', companyId)
      const { data, error } = await query.select().single()
      if (error) throw error
      if (data) {
        await this.calculateAndSaveOvertime(
          data.id,
          data.check_in,
          data.check_out,
          data.employee_id,
          data.date
        )
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
      let query = supabase.from('attendance').delete().eq('id', id)
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
      await planEntitlementService.assertActiveSubscription(payload?.company_id)
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
      await planEntitlementService.assertActiveSubscription()
      const companyId = getActiveCompanyId()
      let query = supabase.from('overtime').update({ status }).eq('id', id)
      if (companyId) query = query.eq('company_id', companyId)
      const { data, error } = await query.select().single()
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
          const startHours = startParts[0] + startParts[1] / 60
          const endHours = endParts[0] + endParts[1] / 60
          let diff = endHours - startHours
          if (diff < 0) diff += 24 // Handle overnight shifts
          standardHours = diff
        }
      }

      // Standardize time inputs (handling ISO dates or clean time strings)
      const cleanCheckIn = checkIn.includes('T') ? checkIn.split('T')[1].substring(0, 8) : checkIn
      const cleanCheckOut = checkOut.includes('T')
        ? checkOut.split('T')[1].substring(0, 8)
        : checkOut

      const diffMs = new Date(`${date}T${cleanCheckOut}`) - new Date(`${date}T${cleanCheckIn}`)
      const hoursWorked = diffMs / (1000 * 60 * 60)

      if (hoursWorked > standardHours) {
        const otHours = parseFloat((hoursWorked - standardHours).toFixed(2))

        // 1. Insert into overtime requests table
        await supabase.from('overtime').insert([
          withCompanyScope({
            employee_id: employeeId,
            date,
            hours: otHours,
            status: 'approved',
            remarks: `Auto-calculated overtime (shift length: ${standardHours} hrs)`,
          }),
        ])

        // 2. Write directly to the overtime_hours column on the attendance record
        await supabase.from('attendance').update({ overtime_hours: otHours }).eq('id', attendanceId)
      } else {
        await supabase.from('attendance').update({ overtime_hours: 0.0 }).eq('id', attendanceId)
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
          await supabase.from('leave_balances').insert([
            withCompanyScope({
              employee_id: employeeId,
              leave_type: 'Comp Off',
              balance: 1,
            }),
          ])
        }
      }
    } catch (err) {
      console.error('Error calculating and crediting comp off:', err)
    }
  },

  /**
   * Get attendance policies.
   * @returns {Promise<any>} A promise that resolves with the result
   */
  async getAttendancePolicies() {
    return withRetry(async () => {
      const companyId = getActiveCompanyId()
      let query = supabase.from('attendance_policies').select('*')
      if (companyId) query = query.eq('company_id', companyId)
      const { data, error } = await query.order('name')
      if (error) throw error
      return data
    })
  },

  /**
   * Create attendance policy.
   * @param {any} policyData - The policyData parameter
   * @returns {Promise<any>} A promise that resolves with the result
   */
  async createAttendancePolicy(policyData) {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('attendance_policies')
        .insert([withCompanyScope(policyData)])
        .select()
        .single()
      if (error) throw error
      return data
    })
  },

  /**
   * Get attendance stats.
   * @param {Object} params - The parameter object
   * @param {any} params.dateFilter - The dateFilter parameter
   * @param {any} params.holidays - The holidays parameter
   * @returns {Promise<any>} A promise that resolves with the result
   */
  async getAttendanceStats({ dateFilter, holidays }) {
    return withRetry(async () => {
      if (!dateFilter)
        return { total: 0, present: 0, absent: 0, onLeave: 0, late: 0, early: 0, rate: 0 }

      const [year, month] = dateFilter.split('-').map(Number)
      const startOfMonth = `${dateFilter}-01`
      const lastDayDate = new Date(year, month, 0)
      const endOfMonth = `${dateFilter}-${lastDayDate.getDate().toString().padStart(2, '0')}`

      const holidaysInMonth = (holidays || []).filter(
        (h) => h.date >= startOfMonth && h.date <= endOfMonth
      )

      const [employeesRes, attendanceRes, leavesRes] = await Promise.all([
        applyCompanyFilter(
          supabase.from('employees').select('*', { count: 'exact', head: true }),
          getActiveCompanyId()
        ).eq('status', 'active'),
        applyCompanyFilter(supabase.from('attendance').select('status, date'), getActiveCompanyId())
          .gte('date', startOfMonth)
          .lte('date', endOfMonth),
        applyCompanyFilter(
          supabase.from('leaves').select('start_date, end_date'),
          getActiveCompanyId()
        )
          .eq('status', 'approved')
          .lte('start_date', endOfMonth)
          .gte('end_date', startOfMonth),
      ])

      if (attendanceRes.error) throw attendanceRes.error
      if (leavesRes.error) throw leavesRes.error

      const totalEmployees = employeesRes.count || 0
      const attendanceData = attendanceRes.data || []
      const leavesData = leavesRes.data || []

      const presentRecordsTotal =
        attendanceData?.filter((a) => a.status === 'present' || a.status === 'half_day').length || 0

      const presentOnWorkable =
        attendanceData?.filter((a) => {
          const date = new Date(a.date)
          const isSun = date.getDay() === 0
          const isHol = holidaysInMonth.some((h) => h.date === a.date)
          return (a.status === 'present' || a.status === 'half_day') && !isSun && !isHol
        }).length || 0

      let totalOnLeaveDays = 0
      leavesData?.forEach((leave) => {
        const leaveStart = new Date(leave.start_date)
        const leaveEnd = new Date(leave.end_date)
        const monthStart = new Date(startOfMonth)
        const monthEnd = new Date(endOfMonth)

        const start = new Date(Math.max(leaveStart, monthStart))
        const end = new Date(Math.min(leaveEnd, monthEnd))

        if (start <= end) {
          const diffTime = Math.abs(end - start)
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
          totalOnLeaveDays += diffDays
        }
      })

      let workableDaysCount = 0
      const tempDate = new Date(startOfMonth)
      const monthEndDate = new Date(endOfMonth)
      while (tempDate <= monthEndDate) {
        const dateStr = tempDate.toISOString().split('T')[0]
        const isSunday = tempDate.getDay() === 0
        const isHoliday = holidaysInMonth.some((h) => h.date === dateStr)
        if (!isSunday && !isHoliday) {
          workableDaysCount++
        }
        tempDate.setDate(tempDate.getDate() + 1)
      }

      const totalPossibleManDays = (totalEmployees || 0) * workableDaysCount
      const totalAbsentManDays = Math.max(
        0,
        totalPossibleManDays - presentOnWorkable - totalOnLeaveDays
      )

      const attendanceRate =
        totalPossibleManDays > 0 ? Math.round((presentOnWorkable / totalPossibleManDays) * 100) : 0

      return {
        total: totalEmployees || 0,
        present: presentRecordsTotal,
        absent: totalAbsentManDays,
        onLeave: totalOnLeaveDays,
        late: 0,
        early: 0,
        rate: attendanceRate,
      }
    })
  },

  /**
   * Bulk upload attendance.
   * @param {Object} params - The parameter object
   * @param {any} params.data - The data parameter
   * @param {any} params.activeCompanyId - The activeCompanyId parameter
   * @returns {Promise<any>} A promise that resolves with the result
   */
  async bulkUploadAttendance({ data, activeCompanyId }) {
    return withRetry(async () => {
      await planEntitlementService.assertActiveSubscription(activeCompanyId)
      const stats = { total: data.length, success: 0, failed: 0 }
      const report = []

      const { data: allEmployees, error: empErr } = await supabase
        .from('employees')
        .select('id, employee_id')
      if (empErr) throw empErr

      const empMap = {}
      allEmployees?.forEach((e) => {
        if (e.employee_id) empMap[e.employee_id] = e.id
      })

      const normalizeDate = (dateStr) => {
        if (!dateStr) return null
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
        const parts = dateStr.trim().split(/[-/]/)
        if (parts.length === 3) {
          if (parts[2].length === 4)
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
          if (parts[0].length === 4)
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
        }
        return dateStr
      }

      const combineDateAndTime = (dateStr, timeStr) => {
        if (!timeStr) return null
        const t = timeStr.trim()
        if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return `${dateStr}T${t}.000Z`
        if (/^\d{2}:\d{2}$/.test(t)) return `${dateStr}T${t}:00.000Z`
        return null
      }

      const getStatusFromHours = (checkIn, checkOut, defaultStatus, dateStr, holidaysList) => {
        const statusMap = {
          P: 'present',
          A: 'absent',
          WO: 'weekly_off',
          present: 'present',
          absent: 'absent',
          weekly_off: 'weekly_off',
        }
        const mappedStatus = statusMap[defaultStatus] || statusMap[defaultStatus?.toUpperCase()]

        const date = new Date(dateStr)
        const isSunday = date.getDay() === 0
        const isHoliday = holidaysList.some((h) => h.date === dateStr)

        if (mappedStatus === 'weekly_off' || (isSunday && !mappedStatus)) return 'weekly_off'
        if (isHoliday && !mappedStatus) return 'on_leave'

        if (mappedStatus === 'absent') return 'absent'

        if (checkIn && checkOut) {
          const diff = new Date(checkOut) - new Date(checkIn)
          const hours = diff / (1000 * 60 * 60)
          if (hours <= 4) return 'absent'
          if (hours < 8) return 'half_day'
          return 'present'
        }

        if (isSunday) return 'weekly_off'
        if (isHoliday) return 'on_leave'
        return mappedStatus || 'absent'
      }

      const dates = data.map((d) => normalizeDate(d.Date)).filter(Boolean)
      if (dates.length === 0) {
        throw new Error('No valid dates found in CSV data.')
      }
      const minDate = dates.reduce((a, b) => (a < b ? a : b))
      const maxDate = dates.reduce((a, b) => (a > b ? a : b))

      const { data: monthLeaves, error: leavesErr } = await supabase
        .from('leaves')
        .select('*')
        .gte('end_date', minDate)
        .lte('start_date', maxDate)
      if (leavesErr) throw leavesErr

      const holidaysList = await this.getHolidays()

      for (const row of data) {
        const empUUID = empMap[row.Employee_ID]
        if (!empUUID) {
          stats.failed++
          report.push({ ...row, error: `Employee ID ${row.Employee_ID} not found` })
          continue
        }

        try {
          const normalizedDate = normalizeDate(row.Date)
          const checkInTime = combineDateAndTime(normalizedDate, row.Check_In)
          const checkOutTime = combineDateAndTime(normalizedDate, row.Check_Out)
          let calculatedStatus = getStatusFromHours(
            checkInTime,
            checkOutTime,
            row.Status,
            normalizedDate,
            holidaysList
          )
          let finalRemarks = row.Remarks || ''

          const leave = monthLeaves?.find(
            (l) =>
              l.employee_id === empUUID &&
              normalizedDate >= l.start_date &&
              normalizedDate <= l.end_date
          )

          if (leave) {
            if (leave.status === 'approved') {
              if (!checkInTime && !checkOutTime) {
                calculatedStatus = 'on_leave'
                finalRemarks = 'Approved Leave Sync'
              }
            } else if (leave.status === 'rejected') {
              if (calculatedStatus === 'absent') {
                finalRemarks = 'Leave Request Rejected'
              }
            }
          }

          const { error } = await supabase.from('attendance').upsert(
            {
              employee_id: empUUID,
              date: normalizedDate,
              status: calculatedStatus,
              check_in: checkInTime,
              check_out: checkOutTime,
              remarks: finalRemarks,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'employee_id, date' }
          )

          if (error) throw error
          stats.success++
        } catch (err) {
          stats.failed++
          report.push({ ...row, error: err.message })
        }
      }

      return { stats, report }
    })
  },
}
