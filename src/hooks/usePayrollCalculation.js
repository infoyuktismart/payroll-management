/**
 * usePayrollCalculation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin orchestration hook — NO salary arithmetic.
 *
 * SSOT contract enforced here:
 *   • All money values (gross, net, CTC, deductions) come from the DB engine
 *     via payslipService.processPayroll() → finalized payroll_items rows.
 *   • This hook is responsible ONLY for:
 *       1. Driving the multi-step UX progress indicator
 *       2. Calling the Edge Function / payslipService
 *       3. Storing the returned DTO array in state
 *   • Zero native arithmetic operators (+, -, *, /) on money values.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from 'react'
import { logger } from '../lib/devLogger'
import { useToast } from '../context/ToastContext'
import { payslipService } from '../services/payslipService'

const DEFAULT_DEPARTMENT = 'All Departments'
const getCurrentPayrollMonth = () => new Date().toISOString().slice(0, 7)

// ─── Filter normaliser (unchanged — UI logic only) ────────────────────────────

const normalizePayrollFilters = (dateOrFilters, department, search, fallback) => {
    if (dateOrFilters && typeof dateOrFilters === 'object') {
        return {
            selectedDate:     dateOrFilters.selectedDate     || fallback.selectedDate || getCurrentPayrollMonth(),
            departmentFilter: dateOrFilters.selectedDepartment || dateOrFilters.departmentFilter || fallback.departmentFilter || DEFAULT_DEPARTMENT,
            employeeSearch:   dateOrFilters.employeeSearch   ?? fallback.employeeSearch ?? '',
        }
    }
    return {
        selectedDate:     dateOrFilters || fallback.selectedDate || getCurrentPayrollMonth(),
        departmentFilter: department    || fallback.departmentFilter || DEFAULT_DEPARTMENT,
        employeeSearch:   search        ?? fallback.employeeSearch ?? '',
    }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const usePayrollCalculation = (initialState = {}) => {
    const toast = useToast()

    const fallbackSelectedDate     = initialState.selectedDate     || getCurrentPayrollMonth()
    const fallbackDepartmentFilter = initialState.selectedDepartment || initialState.departmentFilter || DEFAULT_DEPARTMENT
    const fallbackEmployeeSearch   = initialState.employeeSearch   || ''

    const [loading,        setLoading]        = useState(false)
    const [processingStep, setProcessingStep] = useState(initialState.processingStep || 0)
    const [employees,      setEmployees]      = useState(initialState.employees      || [])
    const [payrollData,    setPayrollData]    = useState(initialState.payrollData    || [])

    /**
     * Run payroll for the given month.
     *
     * Steps (for UX progress indicator):
     *   1 — Collecting attendance & employee data
     *   2 — Running DB integer-cents engine
     *   3 — Applying deductions & CTC
     *   4 — Compliance pass
     *   5 — Finalising
     *
     * @param {string|Object} dateOrFilters  — "YYYY-MM" or filters object
     * @param {string}        [department]
     * @param {string}        [search]
     * @param {string}        [runType]      — "regular" | "off_cycle"
     * @returns {Promise<PayslipDTO[]>}
     */
    const calculatePayroll = useCallback(async (
        dateOrFilters,
        department,
        search,
        runType = 'regular',
    ) => {
        const { selectedDate, departmentFilter, employeeSearch } = normalizePayrollFilters(
            dateOrFilters,
            department,
            search,
            {
                selectedDate:     fallbackSelectedDate,
                departmentFilter: fallbackDepartmentFilter,
                employeeSearch:   fallbackEmployeeSearch,
            },
        )

        logger.info('[usePayrollCalculation] Starting payroll run', { selectedDate, departmentFilter, runType })

        setLoading(true)
        setPayrollData([])
        setProcessingStep(1)   // Attendance collection (happens inside Edge Function)

        try {
            // Brief UX pause so the stepper is visible
            await new Promise(r => setTimeout(r, 400))
            setProcessingStep(2)   // DB engine running

            // ── Delegate all salary computation to the DB engine ──────────────
            // payslipService.processPayroll calls the Edge Function which calls
            // calculate_payroll_engine() (integer-cents SQL) per employee.
            // We do NOT perform any arithmetic on the returned values.
            const result = await payslipService.processPayroll(selectedDate, {
                runType:          runType,
                departmentFilter: departmentFilter,
                ...(employeeSearch?.trim()
                    ? { _search: employeeSearch.trim() }   // Edge Function does DB filtering
                    : {}),
            })

            await new Promise(r => setTimeout(r, 400))
            setProcessingStep(3)   // Deductions applied in DB

            await new Promise(r => setTimeout(r, 300))
            setProcessingStep(4)   // Compliance

            // Extract the employee identity list for consumers that need it
            const empList = result.payslips.map(p => ({
                id:          p.employee_id,
                employee_id: p.emp_code,
                name:        p.name,
                department:  p.department,
                designation: p.designation,
            }))
            setEmployees(empList)

            await new Promise(r => setTimeout(r, 300))
            setProcessingStep(5)   // Final review

            // ── Store DTO array — fields consumed directly by UI ──────────────
            // Each item already has:
            //   .grossSalary   → .gross_salary    (DB engine value)
            //   .netSalary     → .net_salary       (DB engine value)
            //   .monthly_ctc                       (DB engine value)
            //   .annual_ctc                        (DB engine value)
            //   .totalDeductions → .total_deductions
            //
            // We alias the snake_case DB fields to the camelCase names that
            // existing UI components (PayrollPage, SalaryRegister, etc.) expect,
            // without performing any computation.
            const normalized = result.payslips.map(p => ({
                // Identity
                id:              p.employee_id,
                employee_id:     p.employee_id,
                empId:           p.emp_code,
                name:            p.name,
                designation:     p.designation,
                department:      p.department,
                employee: {
                    id: p.employee_id,
                    email: p.email,
                    phone: p.phone,
                    whatsapp_enabled: p.whatsapp_enabled
                },

                // ── SSOT money values — direct from DB, not recomputed ────────
                basicSalary:     p.basic_salary,
                grossSalary:     p.gross_salary,
                netSalary:       p.net_salary,
                totalDeductions: p.total_deductions,
                totalAllowances: p.total_allowances,
                monthly_ctc:     p.monthly_ctc,
                annual_ctc:      p.annual_ctc,

                // Attendance (day counts — not money, safe here)
                payableDays:     p.payable_days,
                lop_days:        p.lop_days,
                totalDays:       p.days_in_month,
                overtimeHours:   Number(p.calculation_metadata?.overtime_hours || 0),

                // Breakdowns (pre-built by DB engine)
                earningsList:        p.earnings_breakdown,
                deductionsList:      p.deductions_breakdown,
                earnings_breakdown:  p.earnings_breakdown,
                deductions_breakdown: p.deductions_breakdown,

                // Employer contributions for CTC display
                employer_contributions: p.employer_contributions,
                epf_employer:    p.employer_contributions?.employer_epf ?? 0,
                esic_employer:   p.employer_contributions?.employer_esi ?? 0,
                gratuity_provision: p.employer_contributions?.gratuity_provision ?? 0,

                // Meta
                finalized_at:    p.finalized_at,
                payroll_item_id: p.payroll_item_id,

                // Raw DTO reference (for services needing the full object)
                _dto: p,
            }))

            setPayrollData(normalized)

            if (result.errors?.length) {
                toast.warn(
                    `Payroll processed for ${result.processed} employees. ${result.errors.length} failed — check console.`,
                )
                result.errors.forEach(e => logger.error(`[Payroll Engine] Failed for ${e.name}: ${e.error}`))
            } else {
                toast.success(`Payroll finalised for ${normalized.length} employees via DB engine.`)
            }

            return normalized
        } catch (error) {
            const message = error?.message || 'Error occurred during payroll run.'
            toast.error(message)
            setProcessingStep(0)
            throw error
        } finally {
            setLoading(false)
        }
    }, [toast, fallbackSelectedDate, fallbackDepartmentFilter, fallbackEmployeeSearch])

    return {
        loading,
        setLoading,
        processingStep,
        setProcessingStep,
        employees,
        setEmployees,
        payrollData,
        setPayrollData,
        calculatePayroll,
    }
}
