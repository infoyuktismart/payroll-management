import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, getActiveCompanyId, withCompanyScope } from './tenantScope'

export const reimbursementService = {
    /**
     * Get claims.
     * @param {Object} params - The parameter object
     * @param {any} params.page - The page parameter
     * @param {any} params.pageSize - The pageSize parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async getClaims({ page = 0, pageSize = 50 } = {}) {
        return withRetry(async () => {
            let query = supabase
                .from('reimbursements')
                .select(`
                    *,
                    employee:employees!employee_id(first_name, last_name, employee_id, designation, department)
                `, { count: 'exact' })
                .eq('is_deleted', false)
                .order('created_at', { ascending: false })
            query = applyCompanyFilter(query)
            const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1)
            if (error) throw error
            return { data: data || [], count, page, pageSize, totalPages: Math.ceil((count || 0) / pageSize) }
        })
    },

    /**
     * Create claim.
     * @param {any} payload - The payload parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async createClaim(payload) {
        return withRetry(async () => {
            const { data, error } = await supabase
                .from('reimbursements')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    },

    /**
     * Update claim status.
     * @param {Object} params - The parameter object
     * @param {any} params.id - The id parameter
     * @param {any} params.status - The status parameter
     * @param {any} params.reviewerUserId - The reviewerUserId parameter
     * @returns {Promise<any>} A promise that resolves with the result
     */
    async updateClaimStatus({ id, status, reviewerUserId }) {
        return withRetry(async () => {
            let reviewerEmployeeId = null
            let resolvedUid = reviewerUserId
            if (!resolvedUid) {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) resolvedUid = user.id
            }
            if (resolvedUid) {
                let reviewerQuery = supabase
                    .from('employees')
                    .select('id')
                    .eq('user_id', resolvedUid)
                reviewerQuery = applyCompanyFilter(reviewerQuery)
                const { data: reviewer, error: revErr } = await reviewerQuery
                    .maybeSingle()
                if (!revErr && reviewer) {
                    reviewerEmployeeId = reviewer.id
                }
            }

            const updates = {
                status,
                approved_by: status === 'approved' ? reviewerEmployeeId : null,
                approved_at: status === 'approved' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            }

            const companyId = getActiveCompanyId()
            let query = supabase
                .from('reimbursements')
                .update(updates)
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
     * Upload reimbursement receipt to Supabase Storage.
     * @param {Object} params - Parameter object
     * @param {string} params.employeeId - Employee ID
     * @param {File} params.file - File object to upload
     * @returns {Promise<{publicUrl: string, fileName: string}>} File URL and name info
     */
    async uploadReceipt({ employeeId, file }) {
        return withRetry(async () => {
            const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const storagePath = `reimbursements/${employeeId}/${Date.now()}_${safeFileName}`

            let uploadResult = await supabase
                .storage
                .from('employee-documents')
                .upload(storagePath, file, {
                    contentType: file.type,
                    upsert: false
                })

            if (uploadResult.error && (
                uploadResult.error.message?.toLowerCase().includes('bucket not found') ||
                uploadResult.error.message?.toLowerCase().includes('does not exist')
            )) {
                const { error: createError } = await supabase.storage.createBucket('employee-documents', {
                    public: true
                })

                if (!createError) {
                    uploadResult = await supabase
                        .storage
                        .from('employee-documents')
                        .upload(storagePath, file, {
                            contentType: file.type,
                            upsert: false
                        })
                }
            }

            if (uploadResult.error) throw uploadResult.error

            const { data: publicData } = supabase
                .storage
                .from('employee-documents')
                .getPublicUrl(storagePath)

            if (!publicData?.publicUrl) {
                throw new Error('Failed to retrieve file URL.')
            }

            return {
                publicUrl: publicData.publicUrl,
                fileName: file.name
            }
        })
    }
}

