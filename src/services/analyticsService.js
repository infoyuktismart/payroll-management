import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/withRetry'
import { applyCompanyFilter, withCompanyScope } from './tenantScope'
import { planEntitlementService } from './planEntitlementService'

const viewOrEmpty = async (query, missingCodes = ['42P01', '42703']) => {
    const { data, error } = await query
    if (error && !missingCodes.includes(error.code)) throw error
    return data || []
}

export const analyticsService = {
    async getAnalyticsDashboard(startDate, endDate) {
        return withRetry(async () => {
            await planEntitlementService.assertFeature('analytics')
            let trendQuery = supabase.from('v_payroll_monthly_trend').select('*')
            let headcountQuery = supabase.from('v_headcount_monthly').select('*')
            let attendanceQuery = supabase.from('v_attendance_monthly_summary').select('*')

            if (startDate) {
                trendQuery = trendQuery.gte('month_start', startDate)
                headcountQuery = headcountQuery.gte('month_start', startDate)
                attendanceQuery = attendanceQuery.gte('month_start', startDate)
            }
            if (endDate) {
                trendQuery = trendQuery.lte('month_start', endDate)
                headcountQuery = headcountQuery.lte('month_start', endDate)
                attendanceQuery = attendanceQuery.lte('month_start', endDate)
            }

            trendQuery = applyCompanyFilter(trendQuery).order('month_start', { ascending: true })
            headcountQuery = applyCompanyFilter(headcountQuery).order('month_start', { ascending: true })
            attendanceQuery = applyCompanyFilter(attendanceQuery).order('month_start', { ascending: true })

            const [
                payrollTrend,
                departmentHeadcount,
                headcountMonthly,
                attendanceSummary,
                complianceRows
            ] = await Promise.all([
                viewOrEmpty(trendQuery),
                viewOrEmpty(applyCompanyFilter(supabase.from('v_department_headcount').select('*')).order('active_count', { ascending: false })),
                viewOrEmpty(headcountQuery),
                viewOrEmpty(attendanceQuery),
                viewOrEmpty(applyCompanyFilter(supabase.from('v_compliance_summary').select('*')))
            ])

            // Calculate MoM payroll cost shift
            let momPercentage = 0
            let momAmount = 0
            let momDirection = 'neutral'
            
            if (payrollTrend && payrollTrend.length >= 2) {
                const latest = payrollTrend[payrollTrend.length - 1]
                const previous = payrollTrend[payrollTrend.length - 2]
                const latestAmount = Number(latest.total_payroll || 0)
                const previousAmount = Number(previous.total_payroll || 0)
                
                if (previousAmount > 0) {
                    momPercentage = ((latestAmount - previousAmount) / previousAmount) * 100
                    momAmount = latestAmount - previousAmount
                    momDirection = momAmount > 0 ? 'up' : momAmount < 0 ? 'down' : 'neutral'
                }
            } else if (payrollTrend && payrollTrend.length === 1) {
                const latest = payrollTrend[0]
                momAmount = Number(latest.total_payroll || 0)
                momDirection = 'up'
            }

            return {
                payrollTrend,
                departmentHeadcount,
                headcountMonthly,
                attendanceSummary,
                complianceSummary: complianceRows[0] || {},
                momVariance: {
                    percentage: momPercentage,
                    amount: momAmount,
                    direction: momDirection
                }
            }
        })
    },

    async buildCustomReport({ type, department, fromDate, toDate, fields = [] }) {
        return withRetry(async () => {
            await planEntitlementService.assertFeature('report_builder')
            const selectedFields = fields.length > 0 ? fields : ['employee_id', 'first_name', 'last_name', 'department']

            if (type === 'employee') {
                let query = applyCompanyFilter(supabase.from('employees').select('*')).order('created_at', { ascending: false })
                if (department) query = query.eq('department', department)
                const { data, error } = await query
                if (error) throw error
                return (data || []).map(row => pickFields(row, selectedFields))
            }

            if (type === 'payroll') {
                let query = applyCompanyFilter(supabase
                    .from('payroll_items')
                    .select('*, employee:employees(first_name,last_name,employee_id,department), payroll_run:payroll_runs(month_year,status)'))
                if (fromDate) query = query.gte('created_at', fromDate)
                if (toDate) query = query.lte('created_at', toDate)
                const { data, error } = await query
                if (error) throw error
                return (data || [])
                    .filter(row => !department || row.employee?.department === department)
                    .map(row => flattenPayrollRow(row, selectedFields))
            }

            let query = applyCompanyFilter(supabase
                .from('attendance')
                .select('*, employee:employees(first_name,last_name,employee_id,department)'))
            if (fromDate) query = query.gte('date', fromDate)
            if (toDate) query = query.lte('date', toDate)
            const { data, error } = await query
            if (error) throw error
            return (data || [])
                .filter(row => !department || row.employee?.department === department)
                .map(row => flattenAttendanceRow(row, selectedFields))
        })
    },

    async saveReportDefinition(payload) {
        return withRetry(async () => {
            await planEntitlementService.assertFeature('report_builder')
            const { data, error } = await supabase
                .from('generated_reports')
                .insert([withCompanyScope(payload)])
                .select()
                .single()
            if (error) throw error
            return data
        })
    }
}

const pickFields = (row, fields) => {
    return fields.reduce((acc, field) => ({ ...acc, [field]: row[field] ?? '' }), {})
}

const flattenPayrollRow = (row, fields) => {
    const flat = {
        employee_id: row.employee?.employee_id || '',
        employee_name: `${row.employee?.first_name || ''} ${row.employee?.last_name || ''}`.trim(),
        department: row.employee?.department || '',
        month_year: row.payroll_run?.month_year || '',
        basic_salary: row.basic_salary || 0,
        total_allowances: row.total_allowances || 0,
        total_deductions: row.total_deductions || 0,
        net_salary: row.net_salary || 0,
        attendance_days: row.attendance_days || 0
    }
    return pickFields(flat, fields)
}

const flattenAttendanceRow = (row, fields) => {
    const flat = {
        employee_id: row.employee?.employee_id || '',
        employee_name: `${row.employee?.first_name || ''} ${row.employee?.last_name || ''}`.trim(),
        department: row.employee?.department || '',
        date: row.date || '',
        status: row.status || '',
        check_in: row.check_in || '',
        check_out: row.check_out || '',
        remarks: row.remarks || ''
    }
    return pickFields(flat, fields)
}
