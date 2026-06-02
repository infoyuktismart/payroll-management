/**
 * ptChallanGenerator.js
 * Generates Professional Tax (PT) monthly statements and challan CSVs per state.
 */

import { downloadBlob } from './payrollUtils'

export function extractPTFromPayrollItem(item) {
    if (!item) return 0
    // First: try top-level field (legacy / direct column)
    if (item.professional_tax != null) return Number(item.professional_tax)
    if (item.professionalTax != null) return Number(item.professionalTax)

    // Second: dig into breakdown.deductions array
    if (item.breakdown?.deductions && Array.isArray(item.breakdown.deductions)) {
        const ptEntry = item.breakdown.deductions.find(
            d => d.name?.toLowerCase().includes('professional tax') ||
                 d.type === 'pt' ||
                 d.key === 'professional_tax'
        )
        if (ptEntry) return Number(ptEntry.amount ?? 0)
    }

    // Third: try breakdown as object with known keys
    if (item.breakdown?.professional_tax != null) return Number(item.breakdown.professional_tax)
    if (item.breakdown?.pt != null) return Number(item.breakdown.pt)

    return 0 // safe fallback
}


/**
 * Build PT Challan Statement CSV for a specific state.
 * @param {Array} employees - Array of employee payroll records
 * @param {string} state - The name of the Indian state (e.g. "Maharashtra", "Karnataka")
 * @param {string} monthYear - Period (e.g. "2025-03")
 * @returns {string} CSV content
 */
export const buildPTChallanCSV = (employees, state, monthYear) => {
    const headers = [
        'Serial No',
        'Employee ID',
        'Employee Name',
        'State',
        'Gross Wages',
        'Professional Tax Deducted'
    ]

    // Filter employees by state and check for PT deductions
    const stateEmployees = employees.filter(emp => {
        const empState = emp.state || emp.employee?.state || '';
        return empState.toLowerCase() === state.toLowerCase();
    })

    const rows = stateEmployees.map((emp, index) => {
        const gross = Number(emp.grossSalary || emp.gross_salary || emp.salary || 0)
        const pt = Number(extractPTFromPayrollItem(emp))
        const name = (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`).trim()

        return [
            index + 1,
            emp.empId || emp.employee_id || '',
            name.toUpperCase(),
            state,
            gross.toFixed(2),
            pt.toFixed(2)
        ]
    })

    // Calculate total PT
    const totalPT = rows.reduce((sum, row) => sum + Number(row[5]), 0)
    const totalGross = rows.reduce((sum, row) => sum + Number(row[4]), 0)

    const totalsRow = [
        '',
        '',
        `TOTAL (${stateEmployees.length} employees)`,
        '',
        totalGross.toFixed(2),
        totalPT.toFixed(2)
    ]

    return [
        [`PROFESSIONAL TAX CHALLAN STATEMENT - ${state.toUpperCase()} - ${monthYear}`],
        [],
        headers,
        ...rows,
        totalsRow
    ].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
     .join('\n')
}

/**
 * Generates and downloads the PT Challan Statement CSV
 */
export const downloadPTChallan = (employees, state, monthYear) => {
    const csv = buildPTChallanCSV(employees, state, monthYear)
    const formattedState = state.replace(/\s+/g, '_')
    downloadBlob(csv, `PT_Statement_${formattedState}_${monthYear}.csv`)
}

/**
 * Build LWF Statement CSV for a specific state.
 * @param {Array} employees - Array of employee payroll records
 * @param {string} state - The name of the Indian state
 * @param {string} monthYear - Period (e.g. "2025-03")
 * @returns {string} CSV content
 */
export const buildLWFStatementCSV = (employees, state, monthYear) => {
    const headers = [
        'Serial No',
        'Employee ID',
        'Employee Name',
        'State',
        'Gross Wages',
        'Employee LWF Contribution',
        'Employer LWF Contribution',
        'Total LWF'
    ]

    const stateEmployees = employees.filter(emp => {
        const empState = emp.state || emp.employee?.state || '';
        return empState.toLowerCase() === state.toLowerCase();
    })

    const rows = stateEmployees.map((emp, index) => {
        const gross = Number(emp.grossSalary || emp.gross_salary || emp.salary || 0)
        const lwfEmp = Number(emp.lwf_employee || emp.lwfEmployee || 0)
        const lwfEmpr = Number(emp.lwf_employer || emp.lwfEmployer || 0)
        const name = (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`).trim()

        return [
            index + 1,
            emp.empId || emp.employee_id || '',
            name.toUpperCase(),
            state,
            gross.toFixed(2),
            lwfEmp.toFixed(2),
            lwfEmpr.toFixed(2),
            (lwfEmp + lwfEmpr).toFixed(2)
        ]
    })

    const totalGross = rows.reduce((sum, row) => sum + Number(row[4]), 0)
    const totalEmp = rows.reduce((sum, row) => sum + Number(row[5]), 0)
    const totalEmpr = rows.reduce((sum, row) => sum + Number(row[6]), 0)
    const totalLWF = rows.reduce((sum, row) => sum + Number(row[7]), 0)

    const totalsRow = [
        '',
        '',
        `TOTAL (${stateEmployees.length} employees)`,
        '',
        totalGross.toFixed(2),
        totalEmp.toFixed(2),
        totalEmpr.toFixed(2),
        totalLWF.toFixed(2)
    ]

    return [
        [`LABOUR WELFARE FUND STATEMENT - ${state.toUpperCase()} - ${monthYear}`],
        [],
        headers,
        ...rows,
        totalsRow
    ].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
     .join('\n')
}

/**
 * Generates and downloads the LWF Statement CSV
 */
export const downloadLWFStatement = (employees, state, monthYear) => {
    const csv = buildLWFStatementCSV(employees, state, monthYear)
    const formattedState = state.replace(/\s+/g, '_')
    downloadBlob(csv, `LWF_Statement_${formattedState}_${monthYear}.csv`)
}
