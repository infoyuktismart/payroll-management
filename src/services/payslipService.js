/**
 * payslipService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single Source of Truth service for payroll data.
 *
 * CONTRACT (strictly enforced):
 *   • This file contains ZERO arithmetic operators on money values (+, -, *, /).
 *   • All numeric salary fields are read directly from the DB-finalized payslip.
 *   • The DB is the authority — this layer only fetches, maps, and formats.
 *
 * Usage:
 *   import { payslipService } from './payslipService'
 *   const result = await payslipService.processPayroll('2025-03')
 *   // result.payslips[n].gross_salary   ← authoritative, from DB engine
 *   // result.payslips[n].monthly_ctc    ← authoritative, never recomputed
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../lib/supabase'
import { getActiveCompanyId } from './tenantScope'

// ─── Constants ────────────────────────────────────────────────────────────────

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-payroll`

// ─── DTO Shape ────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ComponentLine
 * @property {string} name
 * @property {number} amount   — exact value from DB engine (integer cents / 100)
 * @property {string} [type]
 * @property {string} [system_type]
 * @property {boolean} [custom]
 */

/**
 * @typedef {Object} EmployerContributions
 * @property {number} employer_epf
 * @property {number} employer_eps
 * @property {number} employer_esi
 * @property {number} gratuity_provision
 * @property {number} lwf_employer
 * @property {number} total_employer_share
 */

/**
 * @typedef {Object} PayslipDTO
 * @property {string}  payroll_item_id
 * @property {string}  employee_id
 * @property {string}  emp_code
 * @property {string}  name
 * @property {string}  department
 * @property {string}  designation
 *
 * — SSOT Money fields: read-only, sourced from DB integer-cents engine —
 * @property {number}  basic_salary
 * @property {number}  total_allowances
 * @property {number}  gross_salary
 * @property {number}  total_deductions
 * @property {number}  net_salary
 * @property {number}  monthly_ctc
 * @property {number}  annual_ctc
 *
 * — Attendance —
 * @property {number}  lop_days
 * @property {number}  payable_days
 * @property {number}  days_in_month
 *
 * — Breakdowns —
 * @property {ComponentLine[]}       earnings_breakdown
 * @property {ComponentLine[]}       deductions_breakdown
 * @property {EmployerContributions} employer_contributions
 *
 * @property {string}  finalized_at
 */

// ─── Internal mapper — NO arithmetic ─────────────────────────────────────────

/**
 * Maps a raw payroll_items DB row into a typed PayslipDTO.
 * @param {Object}  row       — raw payroll_items row (with optional employee join)
 * @param {string}  [name]    — employee full name if not embedded in row
 * @returns {PayslipDTO}
 */
function _mapRowToDTO(row, name) {
    const empName = name
        || (row.first_name ? `${row.first_name} ${row.last_name}`.trim() : '')
        || row.name
        || ''

    return {
        payroll_item_id:        row.id,
        employee_id:            row.employee_id,
        emp_code:               row.emp_code     || row.employee_id_code || '',
        name:                   empName,
        department:             row.department   || row.employees?.department || '',
        designation:            row.designation  || row.employees?.designation || '',

        // ── SSOT: these values come directly from DB — do NOT derive them ──
        basic_salary:           Number(row.basic_salary)     || 0,
        total_allowances:       Number(row.total_allowances) || 0,
        gross_salary:           Number(row.gross_salary)     || 0,
        total_deductions:       Number(row.total_deductions) || 0,
        net_salary:             Number(row.net_salary)       || 0,
        monthly_ctc:            Number(row.monthly_ctc)      || 0,
        annual_ctc:             Number(row.annual_ctc)       || 0,

        // ── Attendance ─────────────────────────────────────────────────────
        lop_days:               Number(row.lop_days)     || 0,
        payable_days:           Number(row.payable_days) || 0,
        days_in_month:          Number(row.calculation_metadata?.days_in_month) || 30,

        // ── Breakdowns ─────────────────────────────────────────────────────
        earnings_breakdown:     Array.isArray(row.earnings_breakdown)    ? row.earnings_breakdown    : [],
        deductions_breakdown:   Array.isArray(row.deductions_breakdown)  ? row.deductions_breakdown  : [],
        employer_contributions: row.employer_contributions || {
            employer_epf:         0,
            employer_eps:         0,
            employer_esi:         0,
            gratuity_provision:   0,
            lwf_employer:         0,
            total_employer_share: 0,
        },

        // ── Meta ───────────────────────────────────────────────────────────
        finalized_at:           row.finalized_at || null,
        calculation_metadata:   row.calculation_metadata || {},
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const payslipService = {

    /**
     * Call the process-payroll Edge Function to run the integer-cents engine
     * for a given month. Returns finalized payslip DTOs directly from the DB.
     *
     * @param {string} monthYear        — "YYYY-MM" e.g. "2025-03"
     * @param {Object} [options]
     * @param {string} [options.runType]           — "regular" | "off_cycle"
     * @param {string} [options.departmentFilter]  — filter by department
     * @param {string[]} [options.employeeIds]     — restrict to specific employees
     * @returns {Promise<{
     *   run_id: string,
     *   month_year: string,
     *   status: string,
     *   processed: number,
     *   failed: number,
     *   total_gross_salary: number,
     *   total_net_salary: number,
     *   total_monthly_ctc: number,
     *   total_annual_ctc: number,
     *   payslips: PayslipDTO[],
     *   errors: Array<{employee_id: string, name: string, error: string}>
     * }>}
     */
    async processPayroll(monthYear, options = {}) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
            throw new Error('Not authenticated. Please log in.')
        }

        const body = {
            month_year:          monthYear,
            run_type:            options.runType || 'regular',
            ...(options.departmentFilter && options.departmentFilter !== 'All Departments'
                ? { department_filter: options.departmentFilter }
                : {}),
            ...(options.employeeIds?.length
                ? { employee_ids: options.employeeIds }
                : {}),
        }

        const response = await fetch(EDGE_FUNCTION_URL, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText }))
            throw new Error(err.error || `Edge Function failed with status ${response.status}`)
        }

        return response.json()
    },

    /**
     * Fetch a single finalized payslip for an employee from the payslips view.
     * @param {string} employeeId
     * @param {string} monthYear   — "YYYY-MM"
     * @returns {Promise<PayslipDTO|null>}
     */
    async getPayslip(employeeId, monthYear) {
        const monthStart = `${monthYear}-01`
        const companyId  = getActiveCompanyId()

        let query = supabase
            .from('payslips')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('month_year',  monthStart)
            .order('finalized_at', { ascending: false })
            .limit(1)

        if (companyId) query = query.eq('company_id', companyId)

        const { data, error } = await query.maybeSingle()
        if (error) throw error
        if (!data) return null

        return _mapRowToDTO(data)
    },

    /**
     * Fetch all finalized payslips for a payroll run.
     * @param {string} runId
     * @returns {Promise<PayslipDTO[]>}
     */
    async getPayslipsByRun(runId) {
        let query = supabase
            .from('payroll_items')
            .select(`
                *,
                employees (
                    id, employee_id, first_name, last_name,
                    department, designation, uan_number,
                    esi_number, bank_name, bank_account_number,
                    pan_number, joining_date, state
                )
            `)
            .eq('payroll_run_id', runId)
            .not('finalized_at', 'is', null)

        const companyId = getActiveCompanyId()
        if (companyId) query = query.eq('company_id', companyId)

        const { data, error } = await query
        if (error) throw error

        return (data || []).map(row => {
            const emp  = row.employees || {}
            const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
            return {
                ..._mapRowToDTO(row, name),
                // Employee identity fields for reports/payslip print
                uan_number:          emp.uan_number          || '',
                esi_number:          emp.esi_number          || '',
                bank_name:           emp.bank_name           || '',
                bank_account_number: emp.bank_account_number || '',
                pan_number:          emp.pan_number          || '',
                joining_date:        emp.joining_date        || '',
                state:               emp.state               || '',
            }
        })
    },

    /**
     * Fetch all payslips for a specific employee across all months.
     * @param {string} employeeId
     * @param {Object} [options]
     * @param {number} [options.limit]  — default 12
     * @returns {Promise<PayslipDTO[]>}
     */
    async getEmployeePayslipHistory(employeeId, options = {}) {
        const companyId = getActiveCompanyId()
        let query = supabase
            .from('payslips')
            .select('*')
            .eq('employee_id', employeeId)
            .order('month_year', { ascending: false })
            .limit(options.limit || 12)

        if (companyId) query = query.eq('company_id', companyId)

        const { data, error } = await query
        if (error) throw error
        return (data || []).map(row => _mapRowToDTO(row))
    },

    /**
     * Get pre-aggregated run summary from the DB aggregate function.
     * Returns totals ready for display — no math needed in the component.
     * @param {string} runId
     * @returns {Promise<Object>}
     */
    async getRunSummary(runId) {
        const { data, error } = await supabase.rpc('get_payroll_run_summary', {
            p_run_id: runId,
        })
        if (error) throw error
        return data || {}
    },

    /**
     * Format a PayslipDTO field as Indian Rupee string.
     * This is the ONLY numeric formatting helper permitted in this file.
     * @param {number} amount
     * @returns {string}  e.g. "₹1,50,000"
     */
    formatINR(amount) {
        return new Intl.NumberFormat('en-IN', {
            style:                'currency',
            currency:             'INR',
            maximumFractionDigits: 0,
        }).format(Number(amount) || 0)
    },
}
