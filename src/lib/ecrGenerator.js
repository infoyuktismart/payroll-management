/**
 * ecrGenerator.js
 * Generates EPFO Electronic Challan cum Return (ECR) files.
 * Format: ECR Version 2.0 (text file, pipe-separated)
 * Reference: EPFO ECR 2.0 Format specification
 */

import { downloadBlob } from './payrollUtils'

// EPF/EPS statutory limits
export const EPF_WAGE_LIMIT = 15000        // ₹15,000 ceiling wage
export const EPF_EMPLOYEE_RATE = 0.12      // 12% employee contribution
export const EPF_EMPLOYER_EPS_RATE = 0.0833 // 8.33% to EPS (capped at ₹1,250)
export const EPF_EMPLOYER_EPF_RATE = 0.0367 // 3.67% to EPF (employer)
export const EPF_ADMIN_RATE = 0.005         // 0.5% admin charges
export const EDLI_RATE = 0.005              // 0.5% EDLI

/**
 * Calculate EPF/EPS for one employee
 * @param {number} basicSalary  - Monthly basic + DA
 * @returns {{ epfWage, employeeEPF, employerEPS, employerEPF, edli, adminCharges, totalContribution }}
 */
export const calculateEPF = (basicSalary) => {
    const epfWage = Math.min(Math.max(0, Number(basicSalary) || 0), EPF_WAGE_LIMIT)
    const employeeEPF = Math.round(epfWage * EPF_EMPLOYEE_RATE)
    const employerEPS = Math.min(Math.round(epfWage * EPF_EMPLOYER_EPS_RATE), 1250)
    const employerEPF = Math.round(epfWage * EPF_EMPLOYER_EPF_RATE)
    const edli = Math.round(epfWage * EDLI_RATE)
    const adminCharges = Math.max(75, Math.round(epfWage * EPF_ADMIN_RATE))  // Min ₹75/mo
    const totalContribution = employeeEPF + employerEPF + employerEPS

    return { epfWage, employeeEPF, employerEPS, employerEPF, edli, adminCharges, totalContribution }
}

/**
 * Build ECR 2.0 text content
 * @param {Array} employees  - Array of employee payroll records
 * @param {string} monthYear - e.g. "2025-03" (YYYY-MM)
 * @param {string} establishmentId - EPFO Establishment ID
 * @returns {string} ECR file content
 */
export const buildECRContent = (employees, monthYear, establishmentId = '') => {
    const [year, month] = monthYear.split('-').map(Number)
    const wages_month = `${String(month).padStart(2, '0')}/${year}`

    const lines = []

    // Header
    lines.push(`#~#${establishmentId}#~#${wages_month}#~#ECR`)
    lines.push(`MEMBER_ID~UAN~NAME~RELATIONSHIP_WITH_MEMBER~DATE_OF_BIRTH~GENDER~DATE_OF_JOINING_EPF~DATE_OF_LEAVING_EPF~WAGES_EPF~WAGES_EPS~WAGES_EDLI~EPF_CONTRIBUTION_REMITTED~EPS_CONTRIBUTION_REMITTED~EPF_EPS_DIFFERENCE_REMITTED~NCP_DAYS~REMARKS`)

    employees.forEach(emp => {
        const basic = Number(emp.basic || emp.basicSalary || 0)
        const { epfWage, employeeEPF, employerEPS, employerEPF } = calculateEPF(basic)
        const epfEpsDiff = employerEPF  // 3.67% goes to EPF (employer)
        const ncpDays = emp.lop_days || emp.ncpDays || 0
        const dob = emp.date_of_birth || emp.dob || ''
        const doj = emp.joining_date || emp.date_of_joining || ''
        const dol = emp.exit_date || emp.date_of_leaving || ''  // blank if still active
        const gender = (emp.gender || 'M').charAt(0).toUpperCase()

        lines.push([
            emp.member_id || emp.epf_member_id || '',
            emp.uan || emp.uan_number || '',
            (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`).trim().toUpperCase(),
            'SELF',
            dob,
            gender,
            doj,
            dol,
            epfWage,    // Wages for EPF
            epfWage,    // Wages for EPS
            epfWage,    // Wages for EDLI
            employeeEPF,    // Employee EPF contribution
            employerEPS,    // EPS contribution remitted
            epfEpsDiff,     // EPF-EPS difference (3.67%)
            ncpDays,
            ''          // Remarks
        ].join('~'))
    })

    return lines.join('\n')
}

/**
 * Generate and download the ECR text file
 */
export const downloadECR = (employees, monthYear, establishmentId) => {
    const content = buildECRContent(employees, monthYear, establishmentId)
    const filename = `ECR_${establishmentId}_${monthYear}.txt`
    downloadBlob(content, filename, 'text/plain;charset=utf-8;')
}

/**
 * Generate ECR CSV summary (for reconciliation / audit)
 */
export const buildECRSummaryCSV = (employees) => {
    const headers = [
        'UAN', 'Member ID', 'Employee Name', 'EPF Wages', 'EPS Wages',
        'Employee EPF (12%)', 'Employer EPS (8.33%)', 'Employer EPF (3.67%)',
        'EDLI', 'Admin Charges', 'Total Contribution', 'NCP Days'
    ]

    const rows = employees.map(emp => {
        const basic = Number(emp.basic || emp.basicSalary || 0)
        const { epfWage, employeeEPF, employerEPS, employerEPF, edli, adminCharges, totalContribution } = calculateEPF(basic)
        return [
            emp.uan || '',
            emp.member_id || emp.epf_member_id || '',
            (emp.name || '').trim(),
            epfWage,
            epfWage,
            employeeEPF,
            employerEPS,
            employerEPF,
            edli,
            adminCharges,
            totalContribution,
            emp.lop_days || 0
        ]
    })

    // Totals row
    const totals = ['', '', 'TOTAL',
        rows.reduce((s, r) => s + r[3], 0),
        rows.reduce((s, r) => s + r[4], 0),
        rows.reduce((s, r) => s + r[5], 0),
        rows.reduce((s, r) => s + r[6], 0),
        rows.reduce((s, r) => s + r[7], 0),
        rows.reduce((s, r) => s + r[8], 0),
        rows.reduce((s, r) => s + r[9], 0),
        rows.reduce((s, r) => s + r[10], 0),
        ''
    ]

    return [headers, ...rows, totals]
        .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')
}

export const downloadECRSummary = (employees, monthYear) => {
    const csv = buildECRSummaryCSV(employees)
    downloadBlob(csv, `EPF_ECR_Summary_${monthYear}.csv`)
}
