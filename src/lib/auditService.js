import { supabase } from './supabase'
import { devLog } from './devLogger'

export const auditService = {
    async logEvent({ tableName, recordId = null, action, oldData = null, newData = null, companyId = null }) {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const payload = {
                actor_id: user?.id || null,
                table_name: tableName || 'client_event',
                record_id: isUuid(recordId) ? recordId : null,
                action: action || 'CLIENT_EVENT',
                old_data: oldData,
                new_data: {
                    ...normalizeObject(newData),
                    client_record_id: recordId && !isUuid(recordId) ? String(recordId) : undefined,
                    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
                    path: typeof window !== 'undefined' ? window.location.pathname : undefined
                }
            }
            if (companyId) payload.company_id = companyId

            const { error } = await supabase.from('audit_logs').insert(payload)
            if (error && error.code === 'PGRST204') {
                delete payload.company_id
                const retry = await supabase.from('audit_logs').insert(payload)
                if (retry.error) throw retry.error
            } else if (error) {
                throw error
            }

            return true
        } catch (error) {
            devLog('Client audit event skipped:', error)
            return false
        }
    },

    async logWrite({ tableName, recordId, action, before = null, after = null, companyId = null }) {
        return this.logEvent({
            tableName,
            recordId,
            action,
            oldData: before,
            newData: after,
            companyId
        })
    }
}

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))

const normalizeObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { value }
    return value
}
