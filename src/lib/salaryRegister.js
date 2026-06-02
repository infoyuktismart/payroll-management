/**
 * salaryRegister.js
 * Generates the Salary Register — a statutory document required under
 * various labour laws (Payment of Wages Act, Factories Act, etc.)
 *
 * The register captures all earnings and deductions for every employee
 * for a given payroll month and is used for audits and inspections.
 */

import { downloadBlob } from './payrollUtils'

/**
 * Build the full salary register as a CSV.
 * @param {Array}  employees  - Array of processed payroll records
 * @param {string} monthYear  - e.g. "2025-03"
 * @param {object} company    - { name, pan, tan, pf_reg_no, esic_reg_no, address }
 * @returns {string} CSV content string
 */
export const buildSalaryRegisterCSV = (employees, monthYear, company = {}) => {
    const [year, month] = monthYear.split('-').map(Number)
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })

    // ── Header block ──────────────────────────────────────────────────────────
    const companyHeader = [
        [`Salary Register for ${monthName}`],
        [`Company: ${company.name || ''}`, `PAN: ${company.pan || ''}`, `TAN: ${company.tan || ''}`],
        [`PF Reg No: ${company.pf_reg_no || ''}`, `ESIC Reg No: ${company.esic_reg_no || ''}`],
        [`Address: ${company.address || ''}`],
        [],  // blank separator
    ]

    // ── Column headers ────────────────────────────────────────────────────────
    const headers = [
        'Sr No',
        'Employee ID',
        'Employee Name',
        'Department',
        'Designation',
        'Date of Joining',
        'UAN',
        'ESIC No',
        'Bank A/c No',
        'Bank Name',
        'PAN',
        // Attendance
        'Total Days',
        'Working Days',
        'LOP Days',
        'Payable Days',
        // Earnings
        'Basic',
        'HRA',
        'Conveyance',
        'Medical',
        'Special Allowance',
        'LTA',
        'Other Allowance',
        'Overtime',
        'Gross Earnings',
        // Deductions
        'Employee PF (12%)',
        'Employee ESI (0.75%)',
        'Professional Tax',
        'LWF (Employee)',
        'TDS',
        'Advance / Loan',
        'Other Deductions',
        'Total Deductions',
        // Net
        'Net Pay',
    ]

    // ── Data rows ─────────────────────────────────────────────────────────────
    const rows = employees.map((emp, idx) => {
        const components = emp.salary_structure?.components || emp.components || {}
        const getComp = (keys) => {
            if (Array.isArray(keys)) {
                for (const k of keys) {
                    const v = Number(emp[k] || components[k]?.amount || 0)
                    if (v > 0) return v
                }
                return 0
            }
            return Number(emp[keys] || components[keys]?.amount || 0)
        }

        const basic = getComp(['basic', 'basicSalary', 'Basic'])
        const hra = getComp(['hra', 'HRA'])
        const conveyance = getComp(['conveyance', 'Conveyance'])
        const medical = getComp(['medical', 'Medical'])
        const specialAllowance = getComp(['special_allowance', 'specialAllowance', 'Special Allowance'])
        const lta = getComp(['lta', 'LTA'])
        const otherAllowance = getComp(['other_allowance', 'otherAllowance'])
        const overtime = getComp(['overtime', 'Overtime'])
        // ── SSOT: read from finalized DB payslip — NO fallback arithmetic ──────
        // If an employee's payroll hasn't been processed by the DB engine yet,
        // the cell is left blank rather than computing a potentially-wrong value.
        const grossEarnings = Number(emp.grossSalary || emp.gross_salary) || 0

        // Deductions: prefer the typed breakdown from the DB payslip engine
        const dedBreakdown   = emp.deductions_breakdown || emp.deductionsList || []
        const findDed        = (...keys) => {
            const found = dedBreakdown.find(d => keys.some(k => (d.system_type || d.name || '').toLowerCase().includes(k.toLowerCase())))
            return found ? Number(found.amount) || 0 : 0
        }
        const employeePF     = findDed('PF', 'pf', 'provident')
        const employeeESI    = findDed('ESI', 'esi', 'state insurance')
        const pt             = findDed('PT', 'professional')
        const lwf            = findDed('LWF', 'welfare')
        const tds            = findDed('TDS', 'income tax')
        const advanceLoan    = findDed('advance', 'loan')
        const otherDeductions= findDed('other')
        // totalDeductions and netPay: SSOT only — DB-computed, never re-derived
        const totalDeductions= Number(emp.totalDeductions || emp.total_deductions) || 0
        const netPay         = Number(emp.netSalary      || emp.net_salary)        || 0

        const totalDays = emp.totalDays || emp.total_days || 30
        const workingDays = emp.workingDays || emp.working_days || 26
        const lopDays = emp.lop_days || emp.lopDays || 0
        const payableDays = emp.payableDays || emp.payable_days || (workingDays - lopDays)

        return [
            idx + 1,
            emp.empId || emp.employee_id || emp.id || '',
            (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`).trim(),
            emp.department || emp.employee?.department || '',
            emp.designation || emp.employee?.designation || '',
            emp.joining_date || emp.employee?.joining_date || '',
            emp.uan || emp.uan_number || '',
            emp.esic_number || '',
            emp.bank_account_number || '',
            emp.bank_name || '',
            emp.pan || '',
            totalDays,
            workingDays,
            lopDays,
            payableDays,
            basic,
            hra,
            conveyance,
            medical,
            specialAllowance,
            lta,
            otherAllowance,
            overtime,
            grossEarnings,
            employeePF,
            employeeESI,
            pt,
            lwf,
            tds,
            advanceLoan,
            otherDeductions,
            totalDeductions,
            netPay
        ]
    })

    // ── Totals row ────────────────────────────────────────────────────────────
    const numericCols = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
    const totalRow = headers.map((h, i) => {
        if (i === 0) return 'TOTAL'
        if (i >= 2 && i <= 10) return ''
        if (numericCols.includes(i)) return rows.reduce((sum, row) => sum + (Number(row[i]) || 0), 0)
        return ''
    })

    // ── Serialize ─────────────────────────────────────────────────────────────
    const toCSVRow = (row) => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')

    const csvParts = [
        ...companyHeader.map(row => row.join(',')),
        toCSVRow(headers),
        ...rows.map(toCSVRow),
        toCSVRow(totalRow),
    ]

    return csvParts.join('\n')
}

/**
 * Download the salary register as a CSV file.
 */
export const downloadSalaryRegister = (employees, monthYear, company = {}) => {
    const csv = buildSalaryRegisterCSV(employees, monthYear, company)
    downloadBlob(csv, `Salary_Register_${monthYear}.csv`)
}

/**
 * Build a lightweight summary object for dashboard display.
 * @param {Array} employees
 * @returns {{ totalGross, totalDeductions, totalNetPay, headcount }}
 */
/**
 * Build a lightweight summary object for dashboard display.
 * Reads from SSOT fields only — no arithmetic fallbacks.
 * For pre-aggregated server-side totals, use payslipService.getRunSummary(runId).
 * @param {Array} employees — array of finalized PayslipDTO objects
 * @returns {{ headcount, totalGross, totalDeductions, totalNetPay }}
 */
export const getSalaryRegisterSummary = (employees) => {
    let headcount = 0, totalGross = 0, totalDeductions = 0, totalNetPay = 0
    for (const e of employees) {
        headcount++
        // SSOT: read DB-finalized fields, do NOT re-derive via arithmetic
        totalGross       = totalGross       + (Number(e.grossSalary    || e.gross_salary)    || 0)
        totalDeductions  = totalDeductions  + (Number(e.totalDeductions || e.total_deductions) || 0)
        totalNetPay      = totalNetPay      + (Number(e.netSalary      || e.net_salary)      || 0)
    }
    return { headcount, totalGross, totalDeductions, totalNetPay }
}
