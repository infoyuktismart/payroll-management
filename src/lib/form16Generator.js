/**
 * form16Generator.js
 * Generates Form 16 (Part A + Part B) as a PDF using jsPDF.
 *
 * Form 16 is the TDS certificate issued by an employer to an employee
 * under Section 203 of the Income Tax Act, 1961.
 *
 * Part A: TDS deducted & deposited (from employer)
 * Part B: Computation of income & tax (breakup of salary)
 */

import jsPDF from 'jspdf'
import { calculateAnnualTax, TAX_REGIMES } from './taxUtils'

// ── Helpers ───────────────────────────────────────────────────────────────────

const toNum = (v) => Math.max(0, Number(v) || 0)

const formatPDFCurrency = (value) => {
    return 'Rs. ' + Math.round(toNum(value)).toLocaleString('en-IN')
}

const addLine = (doc, label, value, x1, x2, y, bold = false) => {
    if (bold) doc.setFont('helvetica', 'bold')
    doc.text(label, x1, y)
    doc.setFont('helvetica', 'normal')
    doc.text(formatPDFCurrency(value), x2, y, { align: 'right' })
}

const drawHRule = (doc, y, x1 = 15, x2 = 195) => {
    doc.setLineWidth(0.3)
    doc.line(x1, y, x2, y)
}

const sectionTitle = (doc, title, y) => {
    doc.setFillColor(30, 41, 59)
    doc.rect(15, y, 180, 7, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(title, 18, y + 5)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    return y + 10
}

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * Generate a Form 16 PDF for a single employee.
 *
 * @param {object} params
 * @param {object} params.employee         - Employee record { name, pan, designation, joining_date, ... }
 * @param {object} params.company          - Company record { name, pan, tan, address, ... }
 * @param {object} params.declaration      - Tax declaration { regime, section_80c, section_80d, ... }
 * @param {Array}  params.payrollRuns      - Monthly payroll runs for the financial year
 * @param {string} params.financialYear    - e.g. "2024-25"
 * @param {boolean} [params.download=true] - Auto-download the PDF
 * @returns {jsPDF} The jsPDF document instance
 */
export const generateForm16PDF = ({
    employee,
    company,
    declaration = {},
    payrollRuns = [],
    financialYear = '2024-25',
    download = true
}) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = 210
    const lm = 15  // left margin
    const rm = 195 // right margin (x for right-aligned values)

    // ── Compute annual figures from payroll runs ───────────────────────────────
    const annualBasic        = payrollRuns.reduce((s, r) => s + toNum(r.basic || r.basicSalary), 0)
    const annualHRA          = payrollRuns.reduce((s, r) => s + toNum(r.hra || r.HRA), 0)
    const annualConveyance   = payrollRuns.reduce((s, r) => s + toNum(r.conveyance), 0)
    const annualMedical      = payrollRuns.reduce((s, r) => s + toNum(r.medical), 0)
    const annualSpecial      = payrollRuns.reduce((s, r) => s + toNum(r.special_allowance || r.specialAllowance), 0)
    const annualLTA          = payrollRuns.reduce((s, r) => s + toNum(r.lta || r.LTA), 0)
    const annualOther        = payrollRuns.reduce((s, r) => s + toNum(r.other_allowance || r.otherAllowance), 0)
    const annualGross        = payrollRuns.reduce((s, r) => s + toNum(r.grossSalary || r.gross_salary), 0) || (annualBasic + annualHRA + annualConveyance + annualMedical + annualSpecial + annualLTA + annualOther)
    const annualTdsDeducted  = payrollRuns.reduce((s, r) => s + toNum(r.tds || r.income_tax), 0)

    const regime = declaration.regime || TAX_REGIMES.NEW
    const taxResult = calculateAnnualTax({ annualGross, regime, declaration })
    const isOld = regime === TAX_REGIMES.OLD

    // ── PAGE 1: PART A ────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('FORM 16', pageW / 2, 18, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('[See Rule 31(1)(a) of Income Tax Rules, 1962]', pageW / 2, 24, { align: 'center' })
    doc.text(`Certificate of Tax Deducted at Source on Salary — Financial Year ${financialYear}`, pageW / 2, 29, { align: 'center' })

    drawHRule(doc, 32)

    // PART A header
    let y = sectionTitle(doc, 'PART A — Details of Tax Deducted and Deposited', 33)

    doc.setFontSize(8.5)
    const detailRows = [
        ['Name & Address of Employer', (company.name || '') + (company.address ? '\n' + company.address : '')],
        ['TAN of Employer', company.tan || ''],
        ['PAN of Employer', company.pan || ''],
        ['Name of Employee', employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim()],
        ['PAN of Employee', employee.pan || 'NOT AVAILABLE'],
        ['Designation', employee.designation || ''],
        ['Assessment Year', `${financialYear.split('-')[0].slice(-2) === '24' ? '2025' : String(Number(financialYear.split('-')[0]) + 1)}-${String(Number(financialYear.split('-')[0]) + 2).slice(-2)}`],
        ['Period of Employment', `${employee.joining_date || '01/04/' + financialYear.split('-')[0]} to 31/03/${financialYear.split('-')[1].length === 2 ? '20' + financialYear.split('-')[1] : financialYear.split('-')[1]}`],
    ]

    detailRows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold')
        doc.text(label + ':', lm, y)
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(String(value), 80)
        doc.text(lines, 100, y)
        y += lines.length * 5 + 1
    })

    y += 3
    y = sectionTitle(doc, 'Summary of Tax Deducted at Source', y)
    doc.setFontSize(8.5)

    const partARows = [
        ['Total TDS Deducted (as per payroll records)', annualTdsDeducted],
        ['Tax Deposited (Employer certifies deposit to Government)', annualTdsDeducted],
    ]

    partARows.forEach(([label, val]) => {
        addLine(doc, label, val, lm, rm, y)
        y += 6
    })

    drawHRule(doc, y)
    y += 5

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'italic')
    doc.text(
        'I hereby certify that the sum stated above has been paid to the credit of the Central Government.',
        lm, y
    )
    y += 5
    doc.text(`Employer Signature / Seal: _______________________ Date: _____________`, lm, y)

    // ── PAGE 2: PART B ────────────────────────────────────────────────────────
    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('FORM 16 — PART B', pageW / 2, 15, { align: 'center' })
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.text('Statement showing particulars of perquisites, other fringe benefits or amenities', pageW / 2, 21, { align: 'center' })
    doc.text(`and profits in lieu of salary with value thereof — FY ${financialYear}`, pageW / 2, 26, { align: 'center' })

    drawHRule(doc, 28)
    y = 32

    // ── Earnings ──────────────────────────────────────────────────────────────
    y = sectionTitle(doc, '1. GROSS SALARY', y)
    doc.setFontSize(8.5)

    const earningsRows = [
        ['(a) Basic Salary', annualBasic],
        ['(b) House Rent Allowance (HRA)', annualHRA],
        ['(c) Conveyance Allowance', annualConveyance],
        ['(d) Medical Allowance', annualMedical],
        ['(e) Special Allowance', annualSpecial],
        ['(f) Leave Travel Allowance (LTA)', annualLTA],
        ['(g) Other Allowances', annualOther],
    ]

    earningsRows.forEach(([label, val]) => {
        addLine(doc, label, val, lm + 3, rm, y)
        y += 5.5
    })

    y += 2
    drawHRule(doc, y)
    y += 5.5
    addLine(doc, 'Total Gross Salary (1)', annualGross, lm, rm, y, true)
    y += 1.5
    drawHRule(doc, y)
    y += 8

    // ── Deductions ────────────────────────────────────────────────────────────
    y = sectionTitle(doc, '2. DEDUCTIONS UNDER THE ACT', y)
    doc.setFontSize(8.5)

    const standardDeduction = isOld ? 50000 : 75000
    addLine(doc, '(a) Standard Deduction u/s 16(ia)', standardDeduction, lm + 3, rm, y)
    y += 5.5

    if (isOld) {
        addLine(doc, '(b) Section 80C (PF, LIC, ELSS, etc.)', Math.min(toNum(declaration.section_80c), 150000), lm + 3, rm, y)
        y += 5.5
        addLine(doc, '(c) Section 80D (Medical Insurance)', toNum(declaration.section_80d), lm + 3, rm, y)
        y += 5.5
        addLine(doc, '(d) HRA Exemption u/s 10(13A)', toNum(declaration.hra_exemption), lm + 3, rm, y)
        y += 5.5
        addLine(doc, '(e) Home Loan Interest u/s 24(b)', Math.min(toNum(declaration.home_loan_interest), 200000), lm + 3, rm, y)
        y += 5.5
        addLine(doc, '(f) Other Deductions', toNum(declaration.other_deductions), lm + 3, rm, y)
        y += 5.5
    }

    y += 2
    drawHRule(doc, y)
    y += 5.5
    addLine(doc, 'Total Deductions (2)', taxResult.allowedDeductions, lm, rm, y, true)
    y += 1.5
    drawHRule(doc, y)
    y += 8

    // ── Taxable Income ────────────────────────────────────────────────────────
    y = sectionTitle(doc, '3. INCOME CHARGEABLE UNDER "SALARIES"', y)
    y += 1.5
    doc.setFontSize(8.5)
    addLine(doc, 'Taxable Income [1 - 2]', taxResult.taxableIncome, lm, rm, y, true)
    y += 8

    // ── Tax Computation ───────────────────────────────────────────────────────
    y = sectionTitle(doc, '4. TAX ON INCOME', y)
    doc.setFontSize(8.5)

    const taxRows = [
        [`Tax on income as per ${isOld ? 'Old' : 'New'} Regime`, taxResult.baseTax],
        ['Less: Rebate u/s 87A', taxResult.rebate],
        ['Tax after Rebate', taxResult.baseTax - taxResult.rebate],
        ['Add: Health & Education Cess (4%)', taxResult.cess],
    ]

    taxRows.forEach(([label, val]) => {
        addLine(doc, label, Math.max(0, val), lm + 3, rm, y)
        y += 5.5
    })

    y += 2
    drawHRule(doc, y)
    y += 5.5
    addLine(doc, 'Total Tax Payable (4)', taxResult.totalTax, lm, rm, y, true)
    y += 1.5
    drawHRule(doc, y)
    y += 8

    // ── Verification ──────────────────────────────────────────────────────────
    y = sectionTitle(doc, '5. RELIEF & TDS DEDUCTED', y)
    doc.setFontSize(8.5)
    addLine(doc, 'Tax Deducted at Source (TDS)', annualTdsDeducted, lm + 3, rm, y)
    y += 5.5
    const balance = Math.max(0, taxResult.totalTax - annualTdsDeducted)
    addLine(doc, 'Balance Tax Payable / (Refundable)', balance, lm + 3, rm, y, true)
    y += 10

    drawHRule(doc, y)
    y += 6

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Employee PAN:', lm, y)
    doc.setFont('helvetica', 'bold')
    doc.text(employee.pan || 'NOT AVAILABLE', lm + 28, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`Tax Regime: ${isOld ? 'Old Regime' : 'New Regime (Default)'}`, lm + 80, y)
    y += 8

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    doc.text('This is a system-generated Form 16. Figures are based on payroll data and declared investments.', lm, y)
    doc.text('Please verify with actual investment proofs and consult a tax professional for final filing.', lm, y + 5)

    if (download) {
        const empName = (employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`).trim().replace(/\s+/g, '_')
        doc.save(`Form16_${empName}_FY${financialYear}.pdf`)
    }

    return doc
}
