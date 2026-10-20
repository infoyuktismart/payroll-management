import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'
import { planEntitlementService } from './planEntitlementService'

// Read queries use the decryption view so PAN / Aadhaar / bank account arrive decrypted.
// Write queries (insert, update, delete) use the base table; the DB trigger encrypts on write.
// Toggle this constant back to 'employees' to disable decrypted reads (e.g., before migration runs).
const READABLE_VIEW = 'employees_readable'

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
        .from(READABLE_VIEW)
        .select('*', { count: 'exact' })
        .eq('is_deleted', false)
        .order('joining_date', { ascending: true })
        .order('created_at', { ascending: true })
      query = applyCompanyFilter(query)
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
      let query = supabase.from(READABLE_VIEW).select('*').eq('id', id).eq('is_deleted', false)
      query = applyCompanyFilter(query)
      const { data, error } = await query.single()
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
        .from(READABLE_VIEW)
        .select('*')
        .eq('email', email)
        .eq('is_deleted', false)
      query = applyCompanyFilter(query)
      const { data, error } = await query.maybeSingle()
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
          .map((emp) => {
            const numericPart = emp.employee_id?.substring(prefix.length)
            const val = parseInt(numericPart, 10)
            return isNaN(val) ? null : val
          })
          .filter((val) => val !== null)

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
      const entitlements = await planEntitlementService.assertActiveSubscription(
        payload?.company_id
      )
      if (!planEntitlementService.canAddUsage(entitlements, 'employees', 1)) {
        const limit = entitlements.limits?.employees
        throw new Error(
          `Your current plan limit of ${limit} active employees has been reached. Please upgrade your subscription or activate a higher tier license.`
        )
      }
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
      await planEntitlementService.assertActiveSubscription()
      const companyId = getActiveCompanyId()
      let query = supabase.from('employees').update(payload).eq('id', id)
      if (companyId) query = query.eq('company_id', companyId)
      const { data, error } = await query.select().single()
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
      await planEntitlementService.assertActiveSubscription()
      const companyId = getActiveCompanyId()
      let query = supabase
        .from('employees')
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), status: 'inactive' })
        .eq('id', id)
      if (companyId) query = query.eq('company_id', companyId)
      const { error } = await query
      if (error) throw error
      return true
    })
  },

  /**
   * Get job grades for a company.
   * @param {string} activeCompanyId - Active company UUID
   * @returns {Promise<Array>} List of job grades
   */
  async getJobGrades(activeCompanyId) {
    return withRetry(async () => {
      let query = supabase.from('job_grades').select('*').order('min_salary', { ascending: true })

      if (activeCompanyId) query = query.eq('company_id', activeCompanyId)

      const { data, error } = await query
      if (error) {
        if (error.code === '42P01') {
          return [
            {
              id: 'default-l1',
              grade_code: 'L1',
              name: 'L1 - Junior Associate',
              min_salary: 10000,
              max_salary: 40000,
            },
            {
              id: 'default-l2',
              grade_code: 'L2',
              name: 'L2 - Associate',
              min_salary: 40000,
              max_salary: 80000,
            },
            {
              id: 'default-l3',
              grade_code: 'L3',
              name: 'L3 - Senior Associate',
              min_salary: 80000,
              max_salary: 150000,
            },
            {
              id: 'default-l4',
              grade_code: 'L4',
              name: 'L4 - Lead',
              min_salary: 150000,
              max_salary: 300000,
            },
            {
              id: 'default-l5',
              grade_code: 'L5',
              name: 'L5 - Principal',
              min_salary: 300000,
              max_salary: 800000,
            },
          ]
        }
        throw error
      }
      return data?.length
        ? data
        : [
            {
              id: 'default-l1',
              grade_code: 'L1',
              name: 'L1 - Junior Associate',
              min_salary: 10000,
              max_salary: 40000,
            },
            {
              id: 'default-l2',
              grade_code: 'L2',
              name: 'L2 - Associate',
              min_salary: 40000,
              max_salary: 80000,
            },
            {
              id: 'default-l3',
              grade_code: 'L3',
              name: 'L3 - Senior Associate',
              min_salary: 80000,
              max_salary: 150000,
            },
            {
              id: 'default-l4',
              grade_code: 'L4',
              name: 'L4 - Lead',
              min_salary: 150000,
              max_salary: 300000,
            },
            {
              id: 'default-l5',
              grade_code: 'L5',
              name: 'L5 - Principal',
              min_salary: 300000,
              max_salary: 800000,
            },
          ]
    })
  },

  /**
   * Get nominees for an employee.
   * @param {string} employeeId - Employee UUID
   * @returns {Promise<Array>} List of nominees
   */
  async getNominees(employeeId) {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('employee_nominees')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    })
  },

  /**
   * Create a nominee.
   * @param {Object} payload - Nominee data
   * @returns {Promise<Object>} Created nominee record
   */
  async createNominee(payload) {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('employee_nominees')
        .insert([payload])
        .select()
        .single()
      if (error) throw error
      return data
    })
  },

  /**
   * Update a nominee.
   * @param {Object} params
   * @param {string} params.id - Nominee UUID
   * @param {Object} params.payload - Nominee data
   * @returns {Promise<Object>} Updated nominee record
   */
  async updateNominee({ id, payload }) {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('employee_nominees')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    })
  },

  /**
   * Delete a nominee.
   * @param {string} id - Nominee UUID
   * @returns {Promise<boolean>} True if successful
   */
  async deleteNominee(id) {
    return withRetry(async () => {
      const { error } = await supabase.from('employee_nominees').delete().eq('id', id)
      if (error) throw error
      return true
    })
  },

  /**
   * Upload employee profile photo to storage.
   * @param {string} employeeId - ID or UUID
   * @param {File} file - File object
   * @returns {Promise<string>} Public URL
   */
  async uploadProfilePhoto(employeeId, file) {
    return withRetry(async () => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${employeeId}/${Date.now()}_${safeName}`
      const { error } = await supabase.storage.from('employee-profiles').upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      if (error) throw error
      const { data } = supabase.storage.from('employee-profiles').getPublicUrl(path)
      return data?.publicUrl || ''
    })
  },

  /**
   * Create a signed URL for a document from employee-documents bucket.
   * @param {string} storagePath - Path to the file in storage
   * @param {number} expiresInSeconds - Seconds before link expires
   * @param {Object} [options] - Additional download options
   * @returns {Promise<string>} Signed URL
   */
  async getDocumentSignedUrl(storagePath, expiresInSeconds = 120, options = {}) {
    return withRetry(async () => {
      const { data, error } = await supabase.storage
        .from('employee-documents')
        .createSignedUrl(storagePath, expiresInSeconds, options)
      if (error) throw error
      return data?.signedUrl || null
    })
  },
}
