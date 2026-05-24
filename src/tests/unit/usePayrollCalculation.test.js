import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePayrollCalculation } from '../../hooks/usePayrollCalculation';
import { supabase } from '../../lib/supabase';

// Mock Supabase entirely
vi.mock('@supabase/supabase-js', () => {
    const mockClient = {
        from: vi.fn()
    };
    return {
        createClient: () => mockClient
    };
});

// Mock ToastContext
vi.mock('../../context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn()
    })
}));

describe('usePayrollCalculation Hook', () => {
    let mockEmployeesData;
    let mockAttendanceData;
    let mockLeavesData;
    let mockOvertimeData;
    let mockHolidaysData;
    let mockTaxDeclarationsData;
    let mockCustomDeductionsData;

    const makeChain = (resolvedValue) => {
        const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
            then: vi.fn().mockImplementation((onFulfilled) => {
                return Promise.resolve(resolvedValue).then(onFulfilled);
            })
        };
        return chain;
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();

        mockEmployeesData = [
            {
                id: 'emp-1',
                employee_id: 'EMP001',
                first_name: 'John',
                last_name: 'Doe',
                designation: 'Engineer',
                status: 'active',
                salary: 60000,
                salary_allowances: 10000,
                is_specially_abled: true,
                salary_structure: {
                    basic: { label: 'Basic Salary', category: 'earning', enabled: true, type: 'percentage', value: 50 },
                    hra: { label: 'HRA', category: 'earning', enabled: true, type: 'percentage', value: 20 },
                    pf: { label: 'PF', category: 'deduction', enabled: true, type: 'percentage', value: 12, system_type: 'PF' },
                    esi: { label: 'ESI', category: 'deduction', enabled: true, type: 'percentage', value: 0.75, system_type: 'ESI' },
                }
            }
        ];

        mockAttendanceData = [];
        mockLeavesData = [];
        mockOvertimeData = [];
        mockHolidaysData = [];
        mockTaxDeclarationsData = [];
        mockCustomDeductionsData = [];

        supabase.from.mockImplementation((table) => {
            if (table === 'payroll_runs') {
                return makeChain({ data: null, error: null });
            }
            if (table === 'employees') {
                return makeChain({ data: mockEmployeesData, error: null });
            }
            if (table === 'attendance') {
                return makeChain({ data: mockAttendanceData, error: null });
            }
            if (table === 'leaves') {
                return makeChain({ data: mockLeavesData, error: null });
            }
            if (table === 'overtime') {
                return makeChain({ data: mockOvertimeData, error: null });
            }
            if (table === 'holidays') {
                return makeChain({ data: mockHolidaysData, error: null });
            }
            if (table === 'tax_declarations') {
                return makeChain({ data: mockTaxDeclarationsData, error: null });
            }
            if (table === 'custom_deductions') {
                return makeChain({ data: mockCustomDeductionsData, error: null });
            }
            return makeChain({ data: [], error: null });
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should initialize with idle status', () => {
        const { result } = renderHook(() => usePayrollCalculation());

        expect(result.current.loading).toBe(false);
        expect(result.current.processingStep).toBe(0);
        expect(result.current.employees).toEqual([]);
        expect(result.current.payrollData).toEqual([]);
    });

    it('should transition to loading and process calculations successfully with defaults', async () => {
        const { result } = renderHook(() => usePayrollCalculation());

        let calculationPromise;
        act(() => {
            calculationPromise = result.current.calculatePayroll('2026-05', 'All Departments', '');
        });

        expect(result.current.loading).toBe(true);
        expect(result.current.processingStep).toBe(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
            await vi.advanceTimersByTimeAsync(600);
            await vi.advanceTimersByTimeAsync(600);
            await vi.advanceTimersByTimeAsync(600);
        });

        const payrollData = await calculationPromise;

        expect(result.current.loading).toBe(false);
        expect(result.current.processingStep).toBe(5);
        expect(payrollData.length).toBe(1);

        const calculatedItem = payrollData[0];
        expect(calculatedItem.basicSalary).toBe(60000);
        expect(calculatedItem.grossSalary).toBe(72000);
        expect(calculatedItem.totalDeductions).toBe(7200);
        expect(calculatedItem.netSalary).toBe(64800);
    });

    it('should compute complex calculations (LOP, leaves, holidays, overtime, custom deductions, ESI, TDS)', async () => {
        mockAttendanceData = [
            { employee_id: 'emp-1', status: 'Absent', date: '2026-05-04' },
            { employee_id: 'emp-1', status: 'Half Day', date: '2026-05-05' },
            { employee_id: 'emp-1', status: 'Absent', date: '2026-05-10' },
            { employee_id: 'emp-1', status: 'Absent', date: '2026-05-12' },
            { employee_id: 'emp-1', status: 'Absent', date: '2026-05-15' },
        ];

        mockLeavesData = [
            { employee_id: 'emp-1', start_date: '2026-05-12', end_date: '2026-05-12', status: 'approved' }
        ];

        mockHolidaysData = [
            { date: '2026-05-15' }
        ];

        mockOvertimeData = [
            { employee_id: 'emp-1', hours: 16, date: '2026-05-18', status: 'approved' }
        ];

        mockCustomDeductionsData = [
            { employee_id: 'emp-1', deduction_type: 'Gym Membership', amount: 1500, status: 'Active', start_date: '2026-05-01' }
        ];

        mockEmployeesData[0].salary = 310000;
        mockEmployeesData[0].salary_allowances = 0;

        mockTaxDeclarationsData = [
            {
                employee_id: 'emp-1',
                financial_year: '2026-27',
                regime: 'old',
                section_80c: 150000,
                tds_already_deducted: 50000
            }
        ];

        const { result } = renderHook(() => usePayrollCalculation());

        let calculationPromise;
        act(() => {
            calculationPromise = result.current.calculatePayroll('2026-05', 'All Departments', 'John');
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
            await vi.advanceTimersByTimeAsync(600);
            await vi.advanceTimersByTimeAsync(600);
            await vi.advanceTimersByTimeAsync(600);
        });

        const payrollData = await calculationPromise;

        expect(payrollData.length).toBe(1);
        const calculatedItem = payrollData[0];

        expect(calculatedItem.payableDays).toBe(29.5);
        expect(calculatedItem.basicSalary).toBe(295000);
        expect(calculatedItem.overtimeHours).toBe(16);
        expect(calculatedItem.grossSalary).toBe(384000); // 295k basic + 59k pro-rated HRA + 30k overtime

        expect(calculatedItem.deductionsList).toContainEqual(expect.objectContaining({ name: 'Gym Membership', amount: 1500 }));
        expect(calculatedItem.deductionsList).toContainEqual(expect.objectContaining({ name: 'PF', amount: 35400 }));
        expect(calculatedItem.deductionsList.some(d => d.name.includes('TDS'))).toBe(true);
        expect(calculatedItem.netSalary).toBeLessThan(384000);
    });

    it('should transition to error state if employee fetch fails', async () => {
        supabase.from.mockImplementation((table) => {
            if (table === 'payroll_runs') {
                return makeChain({ data: null, error: null });
            }
            return makeChain({ data: null, error: new Error('Failed to query database') });
        });

        const { result } = renderHook(() => usePayrollCalculation());

        let calculationPromise;
        act(() => {
            calculationPromise = result.current.calculatePayroll('2026-05', 'All Departments', '');
            // Attach a silent catch handler to prevent unhandled promise rejection warnings in Node.js
            calculationPromise.catch(() => {});
        });

        // Fast forward the initial simulated delay (600ms)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });

        await expect(calculationPromise).rejects.toThrow('Failed to query database');

        expect(result.current.loading).toBe(false);
        expect(result.current.processingStep).toBe(0);
    });
});
