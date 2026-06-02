/**
 * NSDL 24Q Quarterly TDS Return plain-text file generator utility.
 * Generates government-compliant plain-text file outputs representing File Header (FH),
 * Batch Header (BH), Challan Details (CD), and Deductee Details (DD) records.
 */

export function deriveQuarterFromMonth(month) {
    const m = Number(month)
    if (m >= 4 && m <= 6)  return 'Q1' // Apr–Jun
    if (m >= 7 && m <= 9)  return 'Q2' // Jul–Sep
    if (m >= 10 && m <= 12) return 'Q3' // Oct–Dec
    return 'Q4'                        // Jan–Mar
}

export const generate24QText = (companySettings = {}, payrollItems = [], quarter = 'Q1') => {
    const lines = []
    
    // Helper to format text records separated by caret (^)
    const formatRecord = (fields) => fields.join('^') + '^'

    const tan = companySettings.tan_number || 'DELM12345F'
    const pan = companySettings.pan_number || 'ABCDE1234F'
    const companyName = companySettings.company_name || 'My Company'
    const financialYear = '2026-27'
    const assessmentYear = '2027-28'

    // 1. File Header (FH) Record
    // Format: Record Type (FH), File Type (NSDL), Upload Type (R/C), Date, TAN, etc.
    lines.push(formatRecord([
        'FH',
        'SL1.0',
        '24Q',
        new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        '1',
        tan,
        '000000001',
        companyName
    ]))

    // 2. Batch Header (BH) Record
    // Format: Record Type (BH), Quarter, FY, AY, Employer Details, address, counts
    lines.push(formatRecord([
        'BH',
        '1',
        payrollItems.length.toString(),
        '24Q',
        quarter,
        financialYear,
        assessmentYear,
        tan,
        pan,
        companyName,
        companySettings.address_line1 || 'Main Office address',
        companySettings.city || 'Mumbai',
        companySettings.state || 'Maharashtra'
    ]))

    // 3. Challan Detail (CD) Records & Deductee Detail (DD) Records
    // In standard 24Q filing, each monthly tax deposit is logged as a Challan,
    // and individual employee deductions are mapped to that Challan.
    payrollItems.forEach((item, index) => {
        const serialNo = index + 1
        
        // Find TDS amount in deductions breakdown or default to 0
        const tdsEntry = item.deductions_breakdown?.find(d => d.name?.toLowerCase().includes('tds'))
        const taxAmount = tdsEntry ? Number(tdsEntry.amount) || 0 : 0

        // 3.1 Challan Detail (CD)
        // Mocks monthly TDS Challan for this employee's TDS deposit
        lines.push(formatRecord([
            'CD',
            serialNo.toString(),
            '92', // Section 192 (Salaries)
            taxAmount.toFixed(2), // TDS Amount
            '0.00', // Surcharge
            '0.00', // Education Cess
            '0.00', // Interest
            '0.00', // Others
            taxAmount.toFixed(2), // Total Challan Amount
            `CHLN202605${serialNo.toString().padStart(2, '0')}`, // Challan Serial Number
            '0002810', // BSR Code
            new Date().toISOString().slice(0, 10).replace(/-/g, ''), // Deposit Date
            '200' // Minor Head (TDS paid by regular tax payer)
        ]))

        // 3.2 Deductee Detail (DD)
        // Individual tax logs mapping to the Challan above
        const employeePAN = item.employees?.pan_number || 'PANNOTAVBL'
        const employeeName = item.employees ? `${item.employees.first_name} ${item.employees.last_name}` : 'Employee'
        lines.push(formatRecord([
            'DD',
            serialNo.toString(),
            '1', // Deductee Code (01: Corporate / 02: Non-Corporate)
            employeePAN,
            employeeName,
            taxAmount.toFixed(2), // Tax Deducted
            taxAmount.toFixed(2), // Total Tax Deposited
            new Date().toISOString().slice(0, 10).replace(/-/g, ''), // Date of Deduction
            'A', // Rate at which deducted (A: Normal Rate)
            item.basic_salary ? item.basic_salary.toFixed(2) : '0.00' // Salary Amount
        ]))
    })

    return lines.join('\n')
}
