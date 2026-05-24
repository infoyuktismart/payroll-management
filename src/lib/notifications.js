import { supabase } from './supabase'
import { devLog } from './devLogger'

export const sendNotification = async (payload) => {
    try {
        const { data, error } = await supabase.functions.invoke('send-notification', {
            body: payload
        })

        if (error) throw error
        return { data, error: null }
    } catch (error) {
        devLog('Notification skipped or failed:', error)
        return { data: null, error }
    }
}

export const notifyLeaveStatus = ({ email, employeeName, status, leaveType, leaveId }) => {
    if (!email) return Promise.resolve({ skipped: true })
    return sendNotification({
        type: 'leave_status',
        to: email,
        metadata: {
            employeeName,
            status,
            leaveType,
            leaveId
        }
    })
}

export const notifyPayslipAvailable = ({ email, employeeName, period, payrollRunId }) => {
    if (!email) return Promise.resolve({ skipped: true })
    return sendNotification({
        type: 'payslip',
        to: email,
        metadata: {
            employeeName,
            period,
            payrollRunId
        }
    })
}

export const notifyPayrollCompleted = ({ recipients, period, payrollRunId, totalEmployees, totalAmount }) => {
    const to = (recipients || []).filter(Boolean)
    if (to.length === 0) return Promise.resolve({ skipped: true })
    return sendNotification({
        type: 'payroll_completed',
        to,
        metadata: {
            period,
            payrollRunId,
            totalEmployees,
            totalAmount
        }
    })
}
