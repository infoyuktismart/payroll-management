/**
 * neftGenerator.js
 * Generates bank salary transfer files in formats accepted by major Indian banks.
 * Supported formats:
 * 1. Generic NEFT CSV
 * 2. HDFC NetBanking Bulk Payment CSV
 * 3. SBI SFMS Bulk Payment CSV/TXT
 */

import { downloadBlob } from './payrollUtils'

/**
 * Generates Generic NEFT CSV content.
 * Fields: Serial No, Beneficiary Name, Beneficiary Account No, IFSC Code, Amount, Payment Mode, Remarks
 * @param {Array} employees - Array of employee payroll records
 * @returns {string} CSV content
 */
export const buildGenericNEFTCSV = (employees) => {
    const headers = [
        'Serial No',
        'Beneficiary Name',
        'Beneficiary Account No',
        'IFSC Code',
        'Amount',
        'Payment Mode',
        'Remarks'
    ]

    const rows = employees.map((emp, index) => {
        const netAmt = Number(emp.netSalary || emp.net_salary || 0)
        const name = (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`).trim()
        const bankDetails = emp.employee || emp

        // Determine Payment Mode: NEFT for amounts < 2L, RTGS for >= 2L
        const mode = netAmt >= 200000 ? 'RTGS' : 'NEFT'

        return [
            index + 1,
            name.toUpperCase(),
            bankDetails.bank_account_number || bankDetails.bankAccountNumber || '',
            bankDetails.ifsc_code || bankDetails.ifscCode || '',
            netAmt.toFixed(2),
            mode,
            'SALARY'
        ]
    })

    return [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')
}

/**
 * Generates HDFC NetBanking Bulk Payment CSV content.
 * HDFC standard format: Payment Type (N/R/I), Beneficiary Account Number, Amount, Beneficiary Name, , , IFSC Code, Email ID
 * N = NEFT, R = RTGS, I = Internal Fund Transfer (FT)
 * @param {Array} employees - Array of employee payroll records
 * @returns {string} CSV content
 */
export const buildHDFCBulkCSV = (employees) => {
    const rows = employees.map(emp => {
        const netAmt = Number(emp.netSalary || emp.net_salary || 0)
        const name = (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`).trim()
        const bankDetails = emp.employee || emp
        
        const ifsc = (bankDetails.ifsc_code || bankDetails.ifscCode || '').toUpperCase()
        const email = bankDetails.email || ''

        // HDFC payment types: I = FT (HDFC to HDFC), R = RTGS, N = NEFT
        let type = 'N'
        if (ifsc.startsWith('HDFC')) {
            type = 'I'
        } else if (netAmt >= 200000) {
            type = 'R'
        }

        return [
            type,
            bankDetails.bank_account_number || bankDetails.bankAccountNumber || '',
            netAmt.toFixed(2),
            name.toUpperCase(),
            '', // Blank field
            '', // Blank field
            ifsc,
            email
        ]
    })

    // HDFC bulk files do NOT contain a header row
    return rows
        .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')
}

/**
 * Generates SBI SFMS Bulk Payment CSV content.
 * SBI corporate format: Debit Account No, Beneficiary IFSC, Beneficiary Account No, Beneficiary Name, Amount, Remarks
 * @param {Array} employees - Array of employee payroll records
 * @param {string} debitAccount - Company's SBI debit account number
 * @returns {string} CSV content
 */
export const buildSBISFMSCSV = (employees, debitAccount = '') => {
    const headers = [
        'Debit Account Number',
        'Beneficiary IFSC',
        'Beneficiary Account Number',
        'Beneficiary Name',
        'Amount',
        'Remarks'
    ]

    const rows = employees.map(emp => {
        const netAmt = Number(emp.netSalary || emp.net_salary || 0)
        const name = (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`).trim()
        const bankDetails = emp.employee || emp

        return [
            debitAccount,
            (bankDetails.ifsc_code || bankDetails.ifscCode || '').toUpperCase(),
            bankDetails.bank_account_number || bankDetails.bankAccountNumber || '',
            name.toUpperCase(),
            netAmt.toFixed(2),
            'SALARY'
        ]
    })

    return [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')
}

/**
 * Download Generic NEFT CSV file
 */
export const downloadGenericNEFT = (employees, monthYear) => {
    const csv = buildGenericNEFTCSV(employees)
    downloadBlob(csv, `NEFT_Generic_${monthYear}.csv`)
}

/**
 * Download HDFC Bulk Payment CSV file
 */
export const downloadHDFCBulk = (employees, monthYear) => {
    const csv = buildHDFCBulkCSV(employees)
    downloadBlob(csv, `NEFT_HDFC_Bulk_${monthYear}.csv`)
}

/**
 * Download SBI SFMS CSV file
 */
export const downloadSBISFMS = (employees, monthYear, debitAccount) => {
    const csv = buildSBISFMSCSV(employees, debitAccount)
    downloadBlob(csv, `NEFT_SBI_SFMS_${monthYear}.csv`)
}
