import { supabase } from './supabase'
import { devLog } from './devLogger'

/**
 * Sends a payslip via WhatsApp by invoking the custom Supabase Edge Function.
 *
 * @param {Object} params
 * @param {string} params.employeeId - The UUID of the employee.
 * @param {string} [params.payslipUrl] - A signed storage URL to the payslip PDF.
 * @param {string} [params.period] - The month/year period of the payslip.
 * @param {Object} [params.twilioConfig] - Optional override parameters for Twilio credentials.
 */
export const sendWhatsAppNotification = async ({ employeeId, payslipUrl, period, twilioConfig = {} }) => {
    try {
        devLog('Invoking whatsapp-payslip-delivery Edge Function for:', employeeId)
        const { data, error } = await supabase.functions.invoke('whatsapp-payslip-delivery', {
            body: {
                employee_id: employeeId,
                payslip_url: payslipUrl,
                period,
                ...twilioConfig
            }
        })

        if (error) throw error
        devLog('WhatsApp Edge Function response:', data)
        return { data, error: null }
    } catch (error) {
        devLog('WhatsApp notification failed:', error)
        return { data: null, error }
    }
}
