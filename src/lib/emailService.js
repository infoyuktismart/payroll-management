import { supabase } from './supabase'
import { devLog } from './devLogger'

const DEFAULT_PROVIDER = import.meta.env.VITE_EMAIL_PROVIDER || 'resend'

export const emailService = {
    async sendTransactionalEmail({ to, subject, html, text, provider = DEFAULT_PROVIDER, metadata = {} }) {
        const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean)
        if (recipients.length === 0) return { results: [], skipped: true }

        try {
            const { data, error } = await supabase.functions.invoke('send-notification', {
                body: {
                    type: 'custom',
                    to: recipients,
                    subject,
                    html,
                    text,
                    metadata: {
                        ...metadata,
                        provider
                    }
                }
            })

            if (error) throw error
            return data || { results: [] }
        } catch (error) {
            devLog('Transactional email failed:', error)
            return {
                results: recipients.map(recipient => ({
                    to: recipient,
                    status: 'failed',
                    error: error.message || 'Unable to send email.'
                })),
                error
            }
        }
    },

    async sendPayslipEmail({ email, employeeName, period, payrollRunId, provider }) {
        return this.sendTransactionalEmail({
            to: email,
            provider,
            subject: `Payslip available${period ? ` - ${period}` : ''}`,
            text: `Hello ${employeeName || 'Employee'}, your payslip${period ? ` for ${period}` : ''} is available in the payroll portal.`,
            html: `<p>Hello ${escapeHtml(employeeName || 'Employee')},</p><p>Your payslip${period ? ` for <strong>${escapeHtml(period)}</strong>` : ''} is available in the payroll portal.</p>`,
            metadata: {
                template: 'payslip',
                employeeName,
                period,
                payrollRunId
            }
        })
    }
}

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
}[char] || char))
