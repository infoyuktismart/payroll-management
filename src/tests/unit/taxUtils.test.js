import { describe, it, expect } from 'vitest';
import {
    TAX_REGIMES,
    DEFAULT_TAX_CONFIG,
    getIndianFinancialYear,
    calculateSlabTax,
    getDeclarationTotals,
    calculateAnnualTax,
    calculateMonthlyTdsFromDeclaration,
    getPayslipIds
} from '../../lib/taxUtils';

describe('taxUtils - getIndianFinancialYear', () => {
    it('should calculate correct financial year for string and Date inputs', () => {
        expect(getIndianFinancialYear('2026-03')).toBe('2025-26');
        expect(getIndianFinancialYear('2026-04')).toBe('2026-27');
        expect(getIndianFinancialYear(new Date('2026-03-15'))).toBe('2025-26');
        expect(getIndianFinancialYear(new Date('2026-04-01'))).toBe('2026-27');
        expect(getIndianFinancialYear()).toBeDefined();
    });
});

describe('taxUtils - calculateSlabTax boundaries and edge cases', () => {
    const slabs = DEFAULT_TAX_CONFIG.newRegimeSlabs;

    it('should return 0 for zero or negative income', () => {
        expect(calculateSlabTax(0, slabs)).toBe(0);
        expect(calculateSlabTax(-50000, slabs)).toBe(0);
    });

    it('should calculate tax at boundary 400,000', () => {
        expect(calculateSlabTax(399999, slabs)).toBe(0);
        expect(calculateSlabTax(400000, slabs)).toBe(0);
        expect(calculateSlabTax(400001, slabs)).toBeCloseTo(0.05, 2);
    });

    it('should calculate tax at boundary 800,000', () => {
        // 400k at 0%, next at 5%
        expect(calculateSlabTax(799999, slabs)).toBeCloseTo(19999.95, 2);
        expect(calculateSlabTax(800000, slabs)).toBe(20000);
        expect(calculateSlabTax(800001, slabs)).toBeCloseTo(20000.10, 2);
    });

    it('should calculate tax at boundary 1,200,000', () => {
        // 400k @ 0% + 400k @ 5% (20k)
        expect(calculateSlabTax(1199999, slabs)).toBeCloseTo(59999.90, 2);
        expect(calculateSlabTax(1200000, slabs)).toBe(60000);
        expect(calculateSlabTax(1200001, slabs)).toBeCloseTo(60000.15, 2);
    });

    it('should calculate tax for large incomes without overflow or NaN', () => {
        const largeIncomes = [5000000, 10000000, 20000000, 50000000];
        largeIncomes.forEach(income => {
            const tax = calculateSlabTax(income, slabs);
            expect(tax).toBeGreaterThan(0);
            expect(tax).not.toBe(NaN);
            expect(Number.isFinite(tax)).toBe(true);
        });
    });
});

describe('taxUtils - getDeclarationTotals', () => {
    it('should correctly sum and cap Section 80C and Home Loan Interest', () => {
        const declaration = {
            section_80c: '180000', // Capped at 1.5L
            section_80d: '25000',
            hra_exemption: '120000',
            home_loan_interest: '250000', // Capped at 2L
            other_deductions: '10000'
        };

        const totals = getDeclarationTotals(declaration);
        expect(totals.section80c).toBe(150000);
        expect(totals.section80d).toBe(25000);
        expect(totals.hraExemption).toBe(120000);
        expect(totals.homeLoanInterest).toBe(200000);
        expect(totals.otherDeductions).toBe(10000);
    });

    it('should default missing fields to 0', () => {
        const totals = getDeclarationTotals({});
        expect(totals.section80c).toBe(0);
        expect(totals.homeLoanInterest).toBe(0);
    });
});

describe('taxUtils - calculateAnnualTax Old vs New regimes & standard deductions', () => {
    it('should compute New Regime tax with 75k standard deduction', () => {
        // Gross: 1.3M -> Std deduction 75k -> Taxable: 1.225M
        // Slabs: 4L@0% + 4L@5% (20k) + 4L@10% (40k) + 25k@15% (3.75k) = 63.75k
        // Rebate: 0 (since > 1.2M)
        // Cess: 4% of 63.75k = 2.55k
        // Total Tax: 66,300
        const result = calculateAnnualTax({
            annualGross: 1300000,
            regime: TAX_REGIMES.NEW
        });

        expect(result.allowedDeductions).toBe(75000);
        expect(result.taxableIncome).toBe(1225000);
        expect(result.baseTax).toBe(63750);
        expect(result.rebate).toBe(0);
        expect(result.cess).toBe(2550);
        expect(result.totalTax).toBe(66300);
    });

    it('should compute Old Regime tax with 50k standard deduction + other deductions', () => {
        // Gross: 1.0M -> Std 50k + 80c 150k + 80d 25k + HRA 50k + Home Loan 100k = 375k allowed
        // Taxable: 625,000
        // Slabs: 2.5L@0% + 2.5L@5% (12.5k) + 1.25L@20% (25k) = 37.5k base tax
        // Rebate: 0
        // Cess: 4% of 37.5k = 1.5k
        // Total Tax: 39,000
        const result = calculateAnnualTax({
            annualGross: 1000000,
            regime: TAX_REGIMES.OLD,
            declaration: {
                section_80c: 150000,
                section_80d: 25000,
                hra_exemption: 50000,
                home_loan_interest: 100000
            }
        });

        expect(result.allowedDeductions).toBe(375000);
        expect(result.taxableIncome).toBe(625000);
        expect(result.baseTax).toBe(37500);
        expect(result.cess).toBe(1500);
        expect(result.totalTax).toBe(39000);
    });

    it('should return 0 tax if gross income is zero or negative', () => {
        const resultZero = calculateAnnualTax({ annualGross: 0 });
        expect(resultZero.totalTax).toBe(0);

        const resultNeg = calculateAnnualTax({ annualGross: -100000 });
        expect(resultNeg.totalTax).toBe(0);
    });

    it('should calculate correctly for super high incomes (surcharge thresholds 50L, 1Cr, 2Cr, 5Cr)', () => {
        const testIncomes = [5000000, 10000000, 20000000, 50000000];
        testIncomes.forEach(income => {
            const result = calculateAnnualTax({ annualGross: income, regime: TAX_REGIMES.NEW });
            expect(result.totalTax).toBeGreaterThan(0);
            expect(result.totalTax).not.toBe(NaN);
        });
    });
});

describe('taxUtils - calculateMonthlyTdsFromDeclaration', () => {
    it('should compute monthly TDS correctly based on remaining months', () => {
        // Monthly Gross: 100,000 (Annualized: 1.2M)
        // Other income: 100,000 -> Total Gross: 1.3M
        // Total Tax: 66,300
        // Already deducted: 30,000 -> Remaining: 36,300
        // Months remaining: 6
        // Monthly TDS: 36,300 / 6 = 6,050
        const result = calculateMonthlyTdsFromDeclaration({
            monthlyGross: 100000,
            declaration: {
                regime: TAX_REGIMES.NEW,
                other_income: 100000,
                tds_already_deducted: 30000
            },
            monthsRemaining: 6
        });

        expect(result.totalTax).toBe(66300);
        expect(result.monthlyTds).toBe(6050);
    });
});

describe('taxUtils - getPayslipIds', () => {
    it('should safely construct identifiers from company settings', () => {
        const companySettings = {
            pan_number: 'PAN123',
            company_name: 'Antigravity',
            city: 'Mumbai',
            state: 'MH'
        };

        const result = getPayslipIds(companySettings);
        expect(result.pan).toBe('PAN123');
        expect(result.companyName).toBe('Antigravity');
        expect(result.address).toBe('Mumbai, MH');
    });

    it('should handle missing company settings', () => {
        const result = getPayslipIds();
        expect(result.pan).toBe('');
        expect(result.address).toBe('');
    });
});
