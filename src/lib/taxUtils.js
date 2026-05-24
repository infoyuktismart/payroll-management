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

export const getIndianFinancialYear = (date = new Date()) => {
    const value = typeof date === 'string' ? new Date(`${date}-01`) : new Date(date)
    const year = value.getFullYear()
    const month = value.getMonth() + 1
    const start = month >= 4 ? year : year - 1
    return `${start}-${String(start + 1).slice(-2)}`
}

const toNumber = (value) => Math.max(0, Number(value) || 0)

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
 * @param {object} companySettings - Row from company_settings table
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
