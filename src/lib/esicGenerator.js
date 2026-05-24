/**
 * esicGenerator.js
 * Generates ESIC (Employees' State Insurance Corporation) monthly contribution CSV.
 * Reference: ESIC portal file upload specification
 *
 * Statutory rates (as of 2024-25):
 *   Employee contribution: 0.75% of gross wages
 *   Employer contribution: 3.25% of gross wages
 *   Applicability: Employees with gross wages ≤ ₹21,000/month
 *                  (₹25,000 for persons with disability)
 */

import { downloadBlob } from './payrollUtils'

export const ESIC_WAGE_LIMIT = 21000          // ₹21,000/month
export const ESIC_WAGE_LIMIT_DISABILITY = 25000
export const ESIC_EMPLOYEE_RATE = 0.0075      // 0.75%
export const ESIC_EMPLOYER_RATE = 0.0325      // 3.25%

/**
 * Determine ESIC eligibility and calculate contributions.
 * @param {number} grossSalary
 * @param {boolean} isDisabled
 * @returns {{ eligible, employeeESIC, employerESIC, totalESIC }}
 */
export const calculateESIC = (grossSalary, isDisabled = false) => {
    const gross = Math.max(0, Number(grossSalary) || 0)
    const limit = isDisabled ? ESIC_WAGE_LIMIT_DISABILITY : ESIC_WAGE_LIMIT
    const eligible = gross <= limit && gross > 0

    if (!eligible) {
        return { eligible: false, employeeESIC: 0, employerESIC: 0, totalESIC: 0 }
    }

    const employeeESIC = Math.round(gross * ESIC_EMPLOYEE_RATE)
    const employerESIC = Math.round(gross * ESIC_EMPLOYER_RATE)
    const totalESIC = employeeESIC + employerESIC

    return { eligible: true, employeeESIC, employerESIC, totalESIC }
}

/**
 * Build ESIC CSV content for portal upload.
 * @param {Array} employees  - Array of employee payroll records
 * @param {string} monthYear - e.g. "2025-03"
 * @param {string} esicCode  - Company ESIC code
 * @returns {string} CSV content
 */
export const buildESICCSV = (employees, monthYear, esicCode = '') => {
    const [year, month] = monthYear.split('-').map(Number)
    const period = `${String(month).padStart(2, '0')}/${year}`

    const headers = [
        'ESIC Code',
        'Insurance Number',
        'Employee Name',
        'IP No (ESIC)',
        'Gross Wages',
        'Employee Contribution (0.75%)',
        'Employer Contribution (3.25%)',
        'Total Contribution',
        'Working Days',
        'Contribution Period',
        'Reason Code'
    ]

    // Filter only eligible employees
    const eligible = employees.filter(emp => {
        const gross = Number(emp.grossSalary || emp.gross_salary || emp.salary || 0)
        const isDisabled = emp.is_disabled || false
        return calculateESIC(gross, isDisabled).eligible
    })

    const rows = eligible.map(emp => {
        const gross = Number(emp.grossSalary || emp.gross_salary || emp.salary || 0)
        const isDisabled = emp.is_disabled || false
        const { employeeESIC, employerESIC, totalESIC } = calculateESIC(gross, isDisabled)
        const workingDays = emp.payableDays || emp.working_days || 26

        return [
            esicCode,
            emp.esic_number || emp.esicNumber || '',
            (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`).trim(),
            emp.ip_no || emp.esic_ip_no || '',
            gross,
            employeeESIC,
            employerESIC,
            totalESIC,
            workingDays,
            period,
            ''   // Reason code (blank = regular)
        ]
    })

    // Summary totals row
    const totalEmployee = rows.reduce((s, r) => s + Number(r[5]), 0)
    const totalEmployer = rows.reduce((s, r) => s + Number(r[6]), 0)
    const grandTotal = rows.reduce((s, r) => s + Number(r[7]), 0)

    const totalsRow = [
        '', '', `TOTAL (${eligible.length} employees)`, '', '',
        totalEmployee, totalEmployer, grandTotal, '', period, ''
    ]

    return [headers, ...rows, totalsRow]
        .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')
}

/**
 * Generate and download ESIC CSV file.
 */
export const downloadESIC = (employees, monthYear, esicCode) => {
    const csv = buildESICCSV(employees, monthYear, esicCode)
    downloadBlob(csv, `ESIC_${monthYear}.csv`)
}

/**
 * Get a summary breakdown of ESIC for a given payroll run.
 * @param {Array} employees
 * @returns {{ eligibleCount, totalEmployeeContribution, totalEmployerContribution, totalContribution }}
 */
export const getESICSummary = (employees) => {
    let eligibleCount = 0, totalEmployee = 0, totalEmployer = 0

    employees.forEach(emp => {
        const gross = Number(emp.grossSalary || emp.gross_salary || emp.salary || 0)
        const { eligible, employeeESIC, employerESIC } = calculateESIC(gross, emp.is_disabled)
        if (eligible) {
            eligibleCount++
            totalEmployee += employeeESIC
            totalEmployer += employerESIC
        }
    })

    return {
        eligibleCount,
        totalEmployeeContribution: totalEmployee,
        totalEmployerContribution: totalEmployer,
        totalContribution: totalEmployee + totalEmployer
    }
}
