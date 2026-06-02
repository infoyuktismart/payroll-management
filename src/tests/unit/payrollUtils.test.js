import { describe, it, expect, vi } from 'vitest';
import {
    formatCurrency,
    calculateNewRegimeAnnualTax,
    calculateMonthlyTds,
    buildPayrollCsv,
    downloadBlob,
    calculateSettlement
} from '../../lib/payrollUtils';

describe('payrollUtils - formatCurrency', () => {
    it('should format numbers to Indian currency (INR)', () => {
        const formatted = formatCurrency(50000);
        const normalized = formatted.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
        expect(normalized).toContain('50,000');
        expect(normalized).toMatch(/₹|INR/);
    });

    it('should handle zero or undefined values safely', () => {
        expect(formatCurrency(0)).toContain('0');
        expect(formatCurrency()).toContain('0');
    });
});

describe('payrollUtils - calculateNewRegimeAnnualTax', () => {
    it('should compute tax accurately for income within rebate limit', () => {
        expect(calculateNewRegimeAnnualTax(900000)).toBe(0);
    });

    it('should compute tax accurately for income above rebate limit', () => {
        expect(calculateNewRegimeAnnualTax(1300000)).toBe(78000);
    });

    it('should handle zero or negative income', () => {
        expect(calculateNewRegimeAnnualTax(0)).toBe(0);
        expect(calculateNewRegimeAnnualTax(-50000)).toBe(0);
    });
});

describe('payrollUtils - calculateMonthlyTds', () => {
    it('should calculate monthly TDS correctly based on gross', () => {
        const monthlyTds = calculateMonthlyTds({
            monthlyGross: 110000,
            previousMonthlyTds: 20000,
            monthsRemaining: 6
        });
        expect(monthlyTds).toBe(8237);
    });

    it('should default remaining months if not provided', () => {
        const monthlyTds = calculateMonthlyTds({
            monthlyGross: 110000
        });
        expect(monthlyTds).toBe(5785);
    });
});

describe('payrollUtils - buildPayrollCsv', () => {
    it('should generate valid CSV structure from array items', () => {
        const items = [
            {
                empId: 'EMP001',
                name: 'Alice',
                payableDays: 30,
                basicSalary: 30000,
                grossSalary: 50000,
                totalDeductions: 5000,
                netSalary: 45000,
                designation: 'Engineer',
                employee: {
                    department: 'Engineering'
                }
            }
        ];

        const csv = buildPayrollCsv(items);
        const lines = csv.split('\n');
        expect(lines[0]).toBe('"Employee ID","Employee Name","Department","Designation","Payable Days","Basic Salary","Gross Salary","Total Deductions","Net Salary"');
        expect(lines[1]).toBe('"EMP001","Alice","Engineering","Engineer","30","30000","50000","5000","45000"');
    });

    it('should handle empty lists safely', () => {
        const csv = buildPayrollCsv([]);
        expect(csv).toContain('Employee ID');
    });
});

describe('payrollUtils - downloadBlob', () => {
    it('should execute download steps in DOM/jsdom', () => {
        const mockLink = {
            href: '',
            download: '',
            click: vi.fn(),
        };
        const spyCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
        const spyAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
        const spyRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('mock-url');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        expect(() => downloadBlob('csv,content', 'test.csv')).not.toThrow();

        expect(spyCreateElement).toHaveBeenCalledWith('a');
        expect(mockLink.download).toBe('test.csv');
        expect(mockLink.click).toHaveBeenCalled();
        expect(spyAppendChild).toHaveBeenCalled();
        expect(spyRemoveChild).toHaveBeenCalled();

        vi.restoreAllMocks();
    });
});

describe('payrollUtils - calculateSettlement F&F, negative clamps, LOP shortfall pro-rating', () => {
    it('should correctly calculate F&F settlement when employee served full notice period', () => {
        const employee = {
            salary: 120000,
            notice_period_days: 30,
            joining_date: '2022-01-01'
        };
        const exitRecord = {
            resignation_date: '2024-01-01',
            last_working_day: '2024-02-15', // Served 45 days (30 expected)
            exit_date: '2024-02-15'
        };
        // notice shortfall: 0
        // leave balance: 5
        // dailySalary: 2000
        // leaveEncashment: 5 * 2000 = 10000
        // finalAmount: 10000
        const settlement = calculateSettlement(employee, exitRecord, 5);

        expect(settlement.shortfallDays).toBe(0);
        expect(settlement.noticeRecovery).toBe(0);
        expect(settlement.leaveEncashment).toBe(10000);
        expect(settlement.gratuity).toBe(0);
        expect(settlement.finalAmount).toBe(10000);
    });

    it('should pro-rate notice recovery LOP shortfall days and clamp final amount at 0 (never negative)', () => {
        const employee = {
            salary: 120000,
            notice_period_days: 60,
            joining_date: '2022-01-01'
        };
        const exitRecord = {
            resignation_date: '2024-01-01',
            last_working_day: '2024-01-05', // Served only 4 days -> shortfall 56 days
            exit_date: '2024-01-05'
        };
        // daily salary: 2000
        // notice recovery: 56 shortfall * 2000 = 112,000
        // leave encashment: 5 * 2000 = 10,000
        // final net: 10,000 - 112,000 = -102,000 -> Clamped at 0!
        const settlement = calculateSettlement(employee, exitRecord, 5);

        expect(settlement.shortfallDays).toBe(56);
        expect(settlement.noticeRecovery).toBe(112000);
        expect(settlement.finalAmount).toBe(0); // Clamped at 0, never negative!
    });

    it('should handle missing optional deduction fields and default safely to 0', () => {
        const settlement = calculateSettlement(null, null, null);
        expect(settlement.noticeRecovery).toBe(0);
        expect(settlement.leaveEncashment).toBe(0);
        expect(settlement.gratuity).toBe(0);
        expect(settlement.yearsOfService).toBe(0);
        expect(settlement.finalAmount).toBe(0);
    });
});
