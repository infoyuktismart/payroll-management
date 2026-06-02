export const TAX_REGIMES = {
    NEW: 'new',
    OLD: 'old'
}

export const DEFAULT_TAX_CONFIG = {
    financialYear: '2026-27',
    standardDeductionNew: 75000,
    standardDeductionOld: 50000,
    rebateLimitNew: 1200000,
    rebateLimitOld: 500000,
    rebateAmountNew: 60000,
    rebateAmountOld: 12500,
    cessRate: 0.04,
    oldRegimeSlabs: [
        { limit: 250000, rate: 0 },
        { limit: 500000, rate: 0.05 },
        { limit: 1000000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 }
    ],
    newRegimeSlabs: [
        { limit: 400000, rate: 0 },
        { limit: 800000, rate: 0.05 },
        { limit: 1200000, rate: 0.10 },
        { limit: 1600000, rate: 0.15 },
        { limit: 2000000, rate: 0.20 },
        { limit: 2400000, rate: 0.25 },
        { limit: Infinity, rate: 0.30 }
    ]
}

/**
 * Determines the Indian Financial Year string (e.g., "2026-27") for a given date.
 * @param {Date|string} [date=new Date()] - The date to check
 * @returns {string} The financial year string in YYYY-YY format
 */
export const getIndianFinancialYear = (date = new Date()) => {
    const value = typeof date === 'string' ? new Date(`${date}-01`) : new Date(date)
    const year = value.getFullYear()
    const month = value.getMonth() + 1
    const start = month >= 4 ? year : year - 1
    return `${start}-${String(start + 1).slice(-2)}`
}

const toNumber = (value) => Math.max(0, Number(value) || 0)

/**
 * Calculates progressive tax based on tax slab brackets.
 * @param {number} taxableIncome - The annual taxable income amount
 * @param {Array<{limit: number, rate: number}>} slabs - Array of tax slab definitions
 * @returns {number} The calculated basic tax amount
 */
export const calculateSlabTax = (taxableIncome, slabs) => {
    let previousLimit = 0
    let tax = 0
    const income = toNumber(taxableIncome)

    for (const slab of slabs) {
        if (income <= previousLimit) break
        const slabAmount = Math.min(income, slab.limit) - previousLimit
        tax += slabAmount * slab.rate
        previousLimit = slab.limit
    }

    return tax
}

/**
 * Computes and caps tax declarations under typical sections (80C, 80D, HRA, etc.).
 * @param {Object} [declaration={}] - User's tax declaration fields
 * @param {number} [declaration.section_80c] - Investment amount under Section 80C
 * @param {number} [declaration.section_80d] - Premium paid under Section 80D
 * @param {number} [declaration.hra_exemption] - Calculated HRA exemption amount
 * @param {number} [declaration.home_loan_interest] - Interest paid on housing loan
 * @param {number} [declaration.other_deductions] - Miscellaneous approved deductions
 * @returns {{section80c: number, section80d: number, hraExemption: number, homeLoanInterest: number, otherDeductions: number}} Capped declaration totals
 */
export const getDeclarationTotals = (declaration = {}) => {
    const section80c = toNumber(declaration.section_80c)
    const section80d = toNumber(declaration.section_80d)
    const hraExemption = toNumber(declaration.hra_exemption)
    const homeLoanInterest = toNumber(declaration.home_loan_interest)
    const otherDeductions = toNumber(declaration.other_deductions)

    return {
        section80c: Math.min(section80c, 150000),
        section80d,
        hraExemption,
        homeLoanInterest: Math.min(homeLoanInterest, 200000),
        otherDeductions
    }
}

/**
 * Computes the annual income tax, rebate, cess, and total tax payable under Indian IT rules.
 * @param {Object} params
 * @param {number} params.annualGross - Annual gross income
 * @param {string} [params.regime='new'] - The tax regime ('new' or 'old')
 * @param {Object} [params.declaration={}] - Tax declaration inputs
 * @param {Object} [params.config] - Standard tax slabs and parameters config
 * @returns {{annualGross: number, taxableIncome: number, allowedDeductions: number, baseTax: number, rebate: number, cess: number, totalTax: number}} Complete annual tax calculation breakdown
 */
export const calculateAnnualTax = ({
    annualGross,
    regime = TAX_REGIMES.NEW,
    declaration = {},
    config = DEFAULT_TAX_CONFIG
}) => {
    const gross = toNumber(annualGross)
    const totals = getDeclarationTotals(declaration)
    const isOld = regime === TAX_REGIMES.OLD
    const standardDeduction = isOld ? config.standardDeductionOld : config.standardDeductionNew
    const slabConfig = isOld ? config.oldRegimeSlabs : config.newRegimeSlabs

    const allowedDeductions = isOld
        ? standardDeduction + totals.section80c + totals.section80d + totals.hraExemption + totals.homeLoanInterest + totals.otherDeductions
        : standardDeduction

    const taxableIncome = Math.max(0, gross - allowedDeductions)
    const baseTax = calculateSlabTax(taxableIncome, slabConfig)
    const rebateLimit = isOld ? config.rebateLimitOld : config.rebateLimitNew
    const rebateAmount = isOld ? config.rebateAmountOld : config.rebateAmountNew
    const rebate = taxableIncome <= rebateLimit ? Math.min(baseTax, rebateAmount) : 0
    const taxAfterRebate = Math.max(0, baseTax - rebate)
    const cess = taxAfterRebate * config.cessRate

    return {
        annualGross: gross,
        taxableIncome: Math.round(taxableIncome),
        allowedDeductions: Math.round(allowedDeductions),
        baseTax: Math.round(baseTax),
        rebate: Math.round(rebate),
        cess: Math.round(cess),
        totalTax: Math.round(taxAfterRebate + cess)
    }
}

/**
 * Calculates monthly TDS by projecting annual tax and factoring in previous deductions.
 * @param {Object} params
 * @param {number} params.monthlyGross - The current month's gross salary
 * @param {Object} params.declaration - Tax declaration and settings
 * @param {number} [params.monthsRemaining=12] - Number of months remaining in financial year
 * @param {Object} [params.config] - Standard tax config
 * @returns {Object} Annual tax details along with the calculated monthly TDS amount
 */
export const calculateMonthlyTdsFromDeclaration = ({
    monthlyGross,
    declaration,
    monthsRemaining = 12,
    config = DEFAULT_TAX_CONFIG
}) => {
    const annualGross = toNumber(monthlyGross) * 12 + toNumber(declaration?.other_income)
    const regime = declaration?.regime || TAX_REGIMES.NEW
    const tax = calculateAnnualTax({ annualGross, regime, declaration, config })
    const alreadyDeducted = toNumber(declaration?.tds_already_deducted)
    const remainingTax = Math.max(0, tax.totalTax - alreadyDeducted)

    return {
        ...tax,
        monthlyTds: Math.round(remainingTax / Math.max(1, monthsRemaining)),
        regime
    }
}

// ── State-aware Professional Tax helpers ─────────────────────────────────────
// Re-exported so consumers only need one import for all tax logic.
export { calculatePT, calculateAnnualPT, getLWF, PT_STATES, LWF_STATES } from './ptSlabs'

/**
 * Get payslip compliance identifiers for display/print.
 * @param {Object} [companySettings={}] - Row from company_settings table
 * @returns {{pan: string, tan: string, pfRegNo: string, esicRegNo: string, ptRegNo: string, lwfRegNo: string, companyName: string, address: string}} Formatted compliance details and complete address
 */
export const getPayslipIds = (companySettings = {}) => ({
    pan:         companySettings.pan_number    || '',
    tan:         companySettings.tan_number    || '',
    pfRegNo:     companySettings.pf_reg_no     || '',
    esicRegNo:   companySettings.esic_reg_no   || '',
    ptRegNo:     companySettings.pt_reg_no     || '',
    lwfRegNo:    companySettings.lwf_reg_no    || '',
    companyName: companySettings.company_name  || '',
    address: [
        companySettings.address_line1,
        companySettings.address_line2,
        companySettings.city,
        companySettings.state,
        companySettings.pincode
    ].filter(Boolean).join(', ')
})

/**
 * Calculates perquisites (car perk, ESOPs, memberships) for TDS calculation.
 * @param {Object} employee - The employee record
 * @returns {number} The calculated monthly perquisite value
 */
export const calculatePerquisites = (employee = {}) => {
    let perq = 0
    // 1. Car Perquisite (Standard Indian Income Tax rules: Rs. 1800/month < 1.6L or Rs. 2400/month > 1.6L)
    if (employee.has_company_car) {
        perq += employee.car_capacity_above_1_6 ? 2400 : 1800
        if (employee.has_chauffeur) perq += 900
    }
    // 2. Gym / Health Club Membership
    if (employee.gym_membership_perk) {
        perq += Number(employee.gym_membership_perk) || 0
    }
    // 3. ESOP Perquisite (difference between FMV and allotment price)
    if (employee.esop_perk_annual) {
        perq += (Number(employee.esop_perk_annual) || 0) / 12
    }
    return Math.round(perq)
}

/**
 * Calculates Section 89 relief for retroactive salary differences.
 * @param {number} arrearsAmount - The arrears calculated for previous financial years
 * @returns {number} The relief tax savings amount
 */
export const calculateSection89Relief = (arrearsAmount = 0) => {
    // Standard section 89 relief offers tax savings on lump-sum salary arrears.
    // We compute a standard 15% estimated relief rebate
    return Math.round(arrearsAmount * 0.15)
}

