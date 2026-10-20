import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, withCompanyScope, withCompanyScopeList } from './tenantScope'
import { planEntitlementService } from './planEntitlementService'

export const payrollService = {
  /**
   * Get payroll runs.
   * @returns {Promise<any>} A promise that resolves with the result
   */
  async getPayrollRuns() {
    return withRetry(async () => {
      let query = supabase
        .from('payroll_runs')
        .select('*')
        .order('month_year', { ascending: false })
      query = applyCompanyFilter(query)
      const { data, error } = await query
      if (error) throw error
      return data || []
    })
  },

  /**
   * Get payroll run by month.
   * @param {any} monthYear - The monthYear parameter
   * @returns {Promise<any>} A promise that resolves with the result
   */
  async getPayrollRunByMonth(monthYear) {
    return withRetry(async () => {
      let query = supabase.from('payroll_runs').select('id, status').eq('month_year', monthYear)
      query = applyCompanyFilter(query)
      const { data, error } = await query.maybeSingle()
      if (error) throw error
      return data
    })
  },

  /**
   * Get payroll items.
   * @param {any} runId - The runId parameter
   * @returns {Promise<any>} A promise that resolves with the result
   */
  async getPayrollItems(runId) {
    return withRetry(async () => {
      let query = supabase
        .from('payroll_items')
        .select(
          `
                    *,
                    employees (
                        id,
                        first_name,
                        last_name,
                        employee_id,
                        email,
                        phone,
                        whatsapp_enabled,
                        designation,
                        department,
                        salary,
                        salary_allowances,
                        state,
                        uan_number,
                        esi_number,
                        epf_member_id,
                        esic_ip_no,
                        bank_name,
                        ifsc_code,
                        bank_account_number
                    )
                `
        )
        .eq('payroll_run_id', runId)
      query = applyCompanyFilter(query)
      const { data, error } = await query
      if (error) throw error
      return data || []
    })
  },

  /**
   * Create payroll run.
   * @param {any} payload - The payload parameter
   * @returns {Promise<any>} A promise that resolves with the result
   */
  async createPayrollRun(payload) {
    return withRetry(async () => {
      await planEntitlementService.assertActiveSubscription(payload?.company_id)
      const { data, error } = await supabase
        .from('payroll_runs')
        .insert([withCompanyScope(payload)])
        .select()
        .single()
      if (error) throw error
      return data
    })
  },

  /**
   * Create payroll items.
   * @param {any} items - The items parameter
   * @returns {Promise<any>} A promise that resolves with the result
   */
  async createPayrollItems(items) {
    return withRetry(async () => {
      const companyId = items?.[0]?.company_id
      await planEntitlementService.assertActiveSubscription(companyId)
      const { data, error } = await supabase
        .from('payroll_items')
        .insert(withCompanyScopeList(items))
        .select()
      if (error) throw error
      return data || []
    })
  },

  /**
   * Get delivery logs for notifications.
   * @param {string} activeCompanyId - Selected company filter
   * @returns {Promise<any>} List of delivery logs
   */
  async getDeliveryLogs(activeCompanyId) {
    return withRetry(async () => {
      let query = supabase
        .from('notification_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      query = applyCompanyFilter(query, activeCompanyId)
      const { data, error } = await query
      if (error) throw error
      return data || []
    })
  },

  /**
   * Get payroll run by month and run type.
   * @param {string} monthYear - Month-year string (YYYY-MM-DD)
   * @param {string} runType - Regular, bonus, or off-cycle
   * @param {string} activeCompanyId - Selected company filter
   * @returns {Promise<any>} Single run record or null
   */
  async getPayrollRunByMonthAndType(monthYear, runType, activeCompanyId) {
    return withRetry(async () => {
      let query = supabase
        .from('payroll_runs')
        .select('id, status')
        .eq('month_year', monthYear)
        .eq('run_type', runType)
      query = applyCompanyFilter(query, activeCompanyId)
      const { data, error } = await query.maybeSingle()
      if (error) throw error
      return data
    })
  },

  /**
   * Reverse a completed payroll run.
   * @param {string} runId - Run UUID
   * @param {string} userId - User UUID who initiated reversal
   * @returns {Promise<any>} Result
   */
  async reversePayrollRun(runId, userId) {
    return withRetry(async () => {
      const { error: itemsError } = await supabase
        .from('payroll_items')
        .delete()
        .eq('payroll_run_id', runId)
      if (itemsError) throw itemsError

      const { error: runError } = await supabase
        .from('payroll_runs')
        .update({
          status: 'reversed',
          reversed_by: userId || null,
          reversed_at: new Date().toISOString(),
        })
        .eq('id', runId)
      if (runError) throw runError
    })
  },

  /**
   * Finalize and save payroll run and items.
   */
  async finalizePayrollRun({
    monthStart,
    totalNet,
    runType,
    payrollData,
    employeeIds,
    activeCompanyId,
  }) {
    return withRetry(async () => {
      await planEntitlementService.assertActiveSubscription(activeCompanyId)

      // Check duplicate first
      let duplicateQuery = supabase
        .from('payroll_runs')
        .select('id, status')
        .eq('month_year', monthStart)
        .eq('run_type', runType)
      duplicateQuery = applyCompanyFilter(duplicateQuery, activeCompanyId)
      const { data: duplicateRun, error: duplicateError } = await duplicateQuery.maybeSingle()
      if (duplicateError) throw duplicateError
      if (duplicateRun?.id) {
        throw new Error(
          `Payroll for ${monthStart} (${runType}) already exists with status ${duplicateRun.status}. Duplicate runs of the same type are blocked.`
        )
      }

      // 1. Create Run Record
      const { data: runData, error: runError } = await supabase
        .from('payroll_runs')
        .insert([
          withCompanyScope(
            {
              month_year: monthStart,
              total_amount: totalNet,
              total_employees: payrollData.length,
              status: 'Completed',
              run_type: runType,
              processed_at: new Date().toISOString(),
            },
            activeCompanyId
          ),
        ])
        .select()
        .single()

      if (runError) throw runError

      // 2. Create Items
      const items = payrollData.map((item) =>
        withCompanyScope(
          {
            payroll_run_id: runData.id,
            employee_id: item.id,
            basic_salary: parseFloat(item.basicSalary.toFixed(2)),
            total_allowances: parseFloat((item.grossSalary - item.basicSalary).toFixed(2)),
            total_deductions: parseFloat(item.totalDeductions.toFixed(2)),
            net_salary: parseFloat(item.netSalary.toFixed(2)),
            attendance_days: item.payableDays,
            arrears_amount: item.arrearsAmount || 0,
            perquisite_amount: item.perquisiteAmount || 0,
            relief_section_89: item.reliefSection89 || 0,
            breakdown: {
              gross: item.grossSalary,
              earnings: item.earningsList,
              deductions: item.deductionsList,
              totalDays: item.totalDays,
            },
          },
          activeCompanyId
        )
      )

      const { error: itemsError } = await supabase.from('payroll_items').insert(items)

      if (itemsError) throw itemsError

      // 3. Update processed arrears logs
      const { error: arrearsUpdateError } = await supabase
        .from('salary_arrears_logs')
        .update({ status: 'processed' })
        .in('employee_id', employeeIds)
        .eq('status', 'pending')

      if (arrearsUpdateError) throw arrearsUpdateError

      return runData
    })
  },

  /**
   * Get payroll items for a specific employee within a financial year date range.
   * @param {any} employeeId - The employee ID
   * @param {string} fyStart - Financial Year start date (YYYY-MM-DD)
   * @param {string} fyEnd - Financial Year end date (YYYY-MM-DD)
   * @returns {Promise<any>} A promise that resolves with the payroll items list
   */
  async getEmployeePayrollItemsForFY(employeeId, fyStart, fyEnd) {
    return withRetry(async () => {
      let query = supabase
        .from('payroll_items')
        .select(
          `
                    basic_salary,
                    total_allowances,
                    total_deductions,
                    net_salary,
                    attendance_days,
                    breakdown,
                    payroll_runs!inner (
                        month_year,
                        status
                    )
                `
        )
        .eq('employee_id', employeeId)
        .eq('payroll_runs.status', 'Completed')
        .gte('payroll_runs.month_year', fyStart)
        .lte('payroll_runs.month_year', fyEnd)
      query = applyCompanyFilter(query)
      const { data, error } = await query
      if (error) throw error
      return data || []
    })
  },
}
