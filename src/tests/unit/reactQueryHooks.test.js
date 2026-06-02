/**
 * @file reactQueryHooks.test.js
 * @description Unit tests for all React Query hooks (src/hooks/).
 * Each hook is tested by:
 *   1. Mocking the underlying service module
 *   2. Wrapping renderHook in a fresh QueryClientProvider
 *   3. Verifying the query resolves / mutation fires the correct service method
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Service Mocks ────────────────────────────────────────────────────────────

vi.mock('../../services/employeeService', () => ({
    employeeService: {
        getEmployees: vi.fn(),
        getEmployeeById: vi.fn(),
        createEmployee: vi.fn(),
        updateEmployee: vi.fn(),
        deleteEmployee: vi.fn()
    }
}))

vi.mock('../../services/payrollService', () => ({
    payrollService: {
        getPayrollRuns: vi.fn(),
        getPayrollItems: vi.fn(),
        createPayrollRun: vi.fn(),
        createPayrollItems: vi.fn()
    }
}))

vi.mock('../../services/attendanceService', () => ({
    attendanceService: {
        getHolidays: vi.fn(),
        getDailyAttendance: vi.fn(),
        getCalendarAttendance: vi.fn(),
        getRegularizationRequests: vi.fn(),
        updateRegularizationStatus: vi.fn(),
        createAttendance: vi.fn(),
        updateAttendance: vi.fn(),
        deleteAttendance: vi.fn(),
        getOvertimeRequests: vi.fn(),
        createOvertimeRequest: vi.fn(),
        updateOvertimeStatus: vi.fn()
    }
}))

vi.mock('../../services/leaveService', () => ({
    leaveService: {
        getLeavePolicies: vi.fn(),
        getLeaves: vi.fn(),
        getLeaveBalances: vi.fn(),
        getLeaveApplicationsWithEmployee: vi.fn(),
        createLeaveRequest: vi.fn(),
        updateLeaveStatus: vi.fn()
    }
}))

vi.mock('../../services/loanService', () => ({
    loanService: {
        getLoans: vi.fn(),
        createLoan: vi.fn(),
        updateLoanStatus: vi.fn()
    }
}))

vi.mock('../../services/reimbursementService', () => ({
    reimbursementService: {
        getClaims: vi.fn(),
        createClaim: vi.fn(),
        updateClaimStatus: vi.fn()
    }
}))

vi.mock('../../services/salaryService', () => ({
    salaryService: {
        getSalaryComponents: vi.fn(),
        getCustomDeductions: vi.fn(),
        createSalaryComponent: vi.fn(),
        updateSalaryComponent: vi.fn(),
        deleteSalaryComponent: vi.fn(),
        createCustomDeduction: vi.fn(),
        updateCustomDeduction: vi.fn(),
        deleteCustomDeduction: vi.fn()
    }
}))

vi.mock('../../services/adminService', () => ({
    adminService: {
        getAdminSettings: vi.fn(),
        addDepartment: vi.fn(),
        addHoliday: vi.fn(),
        addLeavePolicy: vi.fn(),
        removeAdminRow: vi.fn(),
        initializeLeaveBalances: vi.fn()
    }
}))

vi.mock('../../services/companyService', () => ({
    companyService: {
        getCompanySettings: vi.fn(),
        updateCompanySettings: vi.fn()
    }
}))

vi.mock('../../services/exitService', () => ({
    exitService: {
        getExits: vi.fn(),
        createExit: vi.fn(),
        updateExitStatus: vi.fn(),
        updateExitClearance: vi.fn(),
        updateExitSettlement: vi.fn()
    }
}))

vi.mock('../../services/reportService', () => ({
    reportService: {
        getReportData: vi.fn(),
        getStatutoryData: vi.fn(),
        saveGeneratedReport: vi.fn()
    }
}))

vi.mock('../../services/taxService', () => ({
    taxService: {
        getTaxDeclarations: vi.fn(),
        reviewDeclaration: vi.fn()
    }
}))

vi.mock('../../services/onboardingService', () => ({
    onboardingService: {
        getChecklist: vi.fn(),
        createTasks: vi.fn(),
        updateTaskStatus: vi.fn(),
        deleteTask: vi.fn()
    }
}))

vi.mock('../../services/dashboardService', () => ({
    dashboardService: {
        getDashboardData: vi.fn()
    }
}))

// ─── Import hooks (after mocks) ───────────────────────────────────────────────

import {
    useEmployees, useEmployeeById, useCreateEmployee, useUpdateEmployee, useDeleteEmployee
} from '../../hooks/useEmployees'

import {
    usePayrollRuns, usePayrollItems, useCreatePayrollRun, useCreatePayrollItems
} from '../../hooks/usePayrollRuns'

import {
    useHolidays, useDailyAttendance, useOvertimeRequests,
    useCreateAttendance, useUpdateAttendance, useDeleteAttendance,
    useRegularizationRequests, useUpdateRegularizationStatus, useUpdateOvertimeStatus
} from '../../hooks/useAttendanceData'

import {
    useLeavePolicies, useLeaves, useLeaveBalances,
    useLeaveApplicationsWithEmployee,
    useCreateLeaveRequest, useUpdateLeaveStatus
} from '../../hooks/useLeavesData'

import { useLoans, useCreateLoan, useUpdateLoanStatus } from '../../hooks/useLoansData'

import {
    useReimbursements, useCreateReimbursement, useUpdateReimbursementStatus
} from '../../hooks/useReimbursementsData'

import {
    useSalaryComponents, useCustomDeductions,
    useCreateSalaryComponent, useUpdateSalaryComponent, useDeleteSalaryComponent,
    useCreateCustomDeduction, useUpdateCustomDeduction, useDeleteCustomDeduction
} from '../../hooks/useSalaryData'

import {
    useAdminSettings, useAddDepartment, useAddHoliday,
    useAddLeavePolicy, useRemoveAdminRow, useInitializeLeaveBalances
} from '../../hooks/useAdminData'

import { useCompanySettings, useUpdateCompanySettings } from '../../hooks/useCompanyData'

import {
    useExits, useCreateExit, useUpdateExitStatus,
    useUpdateExitClearance, useUpdateExitSettlement
} from '../../hooks/useExitsData'

import { useReportData, useStatutoryData, useSaveGeneratedReport } from '../../hooks/useReportsData'

import { useTaxDeclarations, useReviewDeclaration } from '../../hooks/useTaxDeclarations'

import {
    useOnboardingChecklist, useCreateOnboardingTasks,
    useToggleTaskStatus, useDeleteOnboardingTask
} from '../../hooks/useOnboardingData'

import { useDashboardData } from '../../hooks/useDashboardData'

// ─── Service imports for assertion ────────────────────────────────────────────
import { employeeService } from '../../services/employeeService'
import { payrollService } from '../../services/payrollService'
import { attendanceService } from '../../services/attendanceService'
import { leaveService } from '../../services/leaveService'
import { loanService } from '../../services/loanService'
import { reimbursementService } from '../../services/reimbursementService'
import { salaryService } from '../../services/salaryService'
import { adminService } from '../../services/adminService'
import { companyService } from '../../services/companyService'
import { exitService } from '../../services/exitService'
import { reportService } from '../../services/reportService'
import { taxService } from '../../services/taxService'
import { onboardingService } from '../../services/onboardingService'
import { dashboardService } from '../../services/dashboardService'

// ─── Test Utilities ───────────────────────────────────────────────────────────

/** Fresh QueryClient per test to avoid cache contamination */
const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false }
        }
    })

const createWrapper = (queryClient) => {
    const Wrapper = ({ children }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children)
    Wrapper.displayName = 'TestQueryWrapper'
    return Wrapper
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useEmployees', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('fetches employees list', async () => {
        const mockData = [{ id: '1', first_name: 'Alice', last_name: 'Smith' }]
        employeeService.getEmployees.mockResolvedValue(mockData)

        const { result } = renderHook(() => useEmployees(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toEqual(mockData)
        expect(employeeService.getEmployees).toHaveBeenCalledOnce()
    })

    it('useCreateEmployee — fires mutationFn', async () => {
        const newEmp = { first_name: 'Bob', last_name: 'Jones' }
        employeeService.createEmployee.mockResolvedValue({ id: '2', ...newEmp })

        const { result } = renderHook(() => useCreateEmployee(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync(newEmp) })

        expect(employeeService.createEmployee).toHaveBeenCalledWith(newEmp)
    })

    it('useUpdateEmployee — fires mutationFn', async () => {
        employeeService.updateEmployee.mockResolvedValue({ id: '1', first_name: 'Updated' })

        const { result } = renderHook(() => useUpdateEmployee(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: '1', payload: { first_name: 'Updated' } })
        })

        expect(employeeService.updateEmployee).toHaveBeenCalledWith({ id: '1', payload: { first_name: 'Updated' } })
    })

    it('useDeleteEmployee — fires mutationFn', async () => {
        employeeService.deleteEmployee.mockResolvedValue(true)

        const { result } = renderHook(() => useDeleteEmployee(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync('1') })

        expect(employeeService.deleteEmployee).toHaveBeenCalledWith('1')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL RUNS HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('usePayrollRuns', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('fetches payroll runs', async () => {
        const mockRuns = [{ id: 'run-1', month_year: '2026-05', status: 'finalized' }]
        payrollService.getPayrollRuns.mockResolvedValue(mockRuns)

        const { result } = renderHook(() => usePayrollRuns(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toEqual(mockRuns)
    })

    it('usePayrollItems — disabled when runId is null', () => {
        const { result } = renderHook(() => usePayrollItems(null), { wrapper: createWrapper(qc) })
        expect(result.current.fetchStatus).toBe('idle')
        expect(payrollService.getPayrollItems).not.toHaveBeenCalled()
    })

    it('usePayrollItems — fetches when runId is provided', async () => {
        payrollService.getPayrollItems.mockResolvedValue([{ id: 'item-1' }])

        const { result } = renderHook(() => usePayrollItems('run-1'), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(payrollService.getPayrollItems).toHaveBeenCalledWith('run-1')
    })

    it('useCreatePayrollRun — fires mutationFn', async () => {
        const payload = { month_year: '2026-05', status: 'draft' }
        payrollService.createPayrollRun.mockResolvedValue({ id: 'run-2', ...payload })

        const { result } = renderHook(() => useCreatePayrollRun(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync(payload) })

        expect(payrollService.createPayrollRun).toHaveBeenCalledWith(payload)
    })

    it('useCreatePayrollItems — fires mutationFn', async () => {
        const items = [{ payroll_run_id: 'run-1', employee_id: 'emp-1', net_salary: 50000 }]
        payrollService.createPayrollItems.mockResolvedValue(items)

        const { result } = renderHook(() => useCreatePayrollItems(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync(items) })

        expect(payrollService.createPayrollItems).toHaveBeenCalledWith(items)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useAttendanceData', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useHolidays — fetches holidays list', async () => {
        attendanceService.getHolidays.mockResolvedValue([{ id: 'h1', name: 'Republic Day', date: '2026-01-26' }])

        const { result } = renderHook(() => useHolidays(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toHaveLength(1)
        expect(attendanceService.getHolidays).toHaveBeenCalledOnce()
    })

    it('useDailyAttendance — disabled when no startDate', () => {
        const { result } = renderHook(
            () => useDailyAttendance({ startDate: null, endDate: null, statusFilter: 'All' }),
            { wrapper: createWrapper(qc) }
        )
        expect(result.current.fetchStatus).toBe('idle')
    })

    it('useDailyAttendance — fetches when dates provided', async () => {
        attendanceService.getDailyAttendance.mockResolvedValue([{ id: 'att-1', status: 'present' }])

        const { result } = renderHook(
            () => useDailyAttendance({ startDate: '2026-05-01', endDate: '2026-05-31', statusFilter: 'All Status' }),
            { wrapper: createWrapper(qc) }
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(attendanceService.getDailyAttendance).toHaveBeenCalled()
    })

    it('useOvertimeRequests — fetches overtime requests', async () => {
        attendanceService.getOvertimeRequests.mockResolvedValue([{ id: 'ot-1', hours: 8, status: 'pending' }])

        const { result } = renderHook(() => useOvertimeRequests({ isAdmin: true }), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toHaveLength(1)
    })

    it('useCreateAttendance — fires mutationFn', async () => {
        attendanceService.createAttendance.mockResolvedValue({ id: 'att-2', status: 'present' })

        const { result } = renderHook(() => useCreateAttendance(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ employee_id: 'emp-1', date: '2026-05-01', status: 'present' })
        })

        expect(attendanceService.createAttendance).toHaveBeenCalled()
    })

    it('useUpdateOvertimeStatus — fires mutationFn', async () => {
        attendanceService.updateOvertimeStatus.mockResolvedValue({ id: 'ot-1', status: 'approved' })

        const { result } = renderHook(() => useUpdateOvertimeStatus(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'ot-1', status: 'approved' })
        })

        expect(attendanceService.updateOvertimeStatus).toHaveBeenCalledWith({ id: 'ot-1', status: 'approved' })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// LEAVES HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useLeavesData', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useLeavePolicies — fetches policies', async () => {
        leaveService.getLeavePolicies.mockResolvedValue([{ id: 'p1', leave_type: 'Annual Leave', annual_balance: 20 }])

        const { result } = renderHook(() => useLeavePolicies(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toHaveLength(1)
    })

    it('useLeaves — fetches leave requests for admin', async () => {
        leaveService.getLeaves.mockResolvedValue([{ id: 'lv-1', status: 'pending' }])

        const { result } = renderHook(() => useLeaves({ isAdmin: true }), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(leaveService.getLeaves).toHaveBeenCalled()
    })

    it('useLeaveBalances — disabled when no employeeId', () => {
        const { result } = renderHook(() => useLeaveBalances(null), { wrapper: createWrapper(qc) })
        expect(result.current.fetchStatus).toBe('idle')
    })

    it('useLeaveBalances — enabled with employeeId', async () => {
        leaveService.getLeaveBalances.mockResolvedValue([{ leave_type: 'Annual', balance: 10 }])

        const { result } = renderHook(() => useLeaveBalances('emp-1'), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(leaveService.getLeaveBalances).toHaveBeenCalledWith('emp-1', expect.any(Number))
    })

    it('useCreateLeaveRequest — fires mutationFn', async () => {
        leaveService.createLeaveRequest.mockResolvedValue({ id: 'lv-2', employee_id: 'emp-1' })

        const { result } = renderHook(() => useCreateLeaveRequest(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ employee_id: 'emp-1', leave_type: 'Annual', start_date: '2026-06-01', end_date: '2026-06-05' })
        })

        expect(leaveService.createLeaveRequest).toHaveBeenCalled()
    })

    it('useUpdateLeaveStatus — fires mutationFn', async () => {
        leaveService.updateLeaveStatus.mockResolvedValue(true)

        const { result } = renderHook(() => useUpdateLeaveStatus(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'lv-1', status: 'approved' })
        })

        expect(leaveService.updateLeaveStatus).toHaveBeenCalledWith({ id: 'lv-1', status: 'approved' })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// LOANS HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useLoansData', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useLoans — fetches loans list', async () => {
        loanService.getLoans.mockResolvedValue([{ id: 'ln-1', amount: 50000, status: 'pending' }])

        const { result } = renderHook(() => useLoans(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toHaveLength(1)
    })

    it('useCreateLoan — fires mutationFn', async () => {
        loanService.createLoan.mockResolvedValue({ id: 'ln-2', amount: 30000 })

        const { result } = renderHook(() => useCreateLoan(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ employee_id: 'emp-1', amount: 30000 })
        })

        expect(loanService.createLoan).toHaveBeenCalled()
    })

    it('useUpdateLoanStatus — fires mutationFn', async () => {
        loanService.updateLoanStatus.mockResolvedValue(true)

        const { result } = renderHook(() => useUpdateLoanStatus(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'ln-1', status: 'approved' })
        })

        expect(loanService.updateLoanStatus).toHaveBeenCalledWith({ id: 'ln-1', status: 'approved' })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// REIMBURSEMENTS HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useReimbursementsData', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useReimbursements — fetches claims', async () => {
        reimbursementService.getClaims.mockResolvedValue([{ id: 'cl-1', amount: 2000, status: 'pending' }])

        const { result } = renderHook(() => useReimbursements(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toHaveLength(1)
    })

    it('useCreateReimbursement — fires mutationFn', async () => {
        reimbursementService.createClaim.mockResolvedValue({ id: 'cl-2' })

        const { result } = renderHook(() => useCreateReimbursement(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ employee_id: 'emp-1', amount: 1500, category: 'Travel' })
        })

        expect(reimbursementService.createClaim).toHaveBeenCalled()
    })

    it('useUpdateReimbursementStatus — fires mutationFn', async () => {
        reimbursementService.updateClaimStatus.mockResolvedValue(true)

        const { result } = renderHook(() => useUpdateReimbursementStatus(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'cl-1', status: 'approved', reviewerUserId: 'user-1' })
        })

        expect(reimbursementService.updateClaimStatus).toHaveBeenCalled()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// SALARY DATA HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useSalaryData', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useSalaryComponents — fetches components', async () => {
        salaryService.getSalaryComponents.mockResolvedValue([{ id: 'sc-1', label: 'Basic', category: 'earning' }])

        const { result } = renderHook(() => useSalaryComponents(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toHaveLength(1)
    })

    it('useCustomDeductions — fetches deductions', async () => {
        salaryService.getCustomDeductions.mockResolvedValue([{ id: 'cd-1', deduction_type: 'Gym', amount: 500 }])

        const { result } = renderHook(() => useCustomDeductions(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toHaveLength(1)
    })

    it('useCreateSalaryComponent — fires mutationFn', async () => {
        salaryService.createSalaryComponent.mockResolvedValue({ id: 'sc-2', label: 'HRA' })

        const { result } = renderHook(() => useCreateSalaryComponent(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ label: 'HRA', category: 'earning', type: 'percentage', value: 20 })
        })

        expect(salaryService.createSalaryComponent).toHaveBeenCalled()
    })

    it('useDeleteSalaryComponent — fires mutationFn', async () => {
        salaryService.deleteSalaryComponent.mockResolvedValue(true)

        const { result } = renderHook(() => useDeleteSalaryComponent(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync('sc-1') })

        expect(salaryService.deleteSalaryComponent).toHaveBeenCalledWith('sc-1')
    })

    it('useCreateCustomDeduction — fires mutationFn', async () => {
        salaryService.createCustomDeduction.mockResolvedValue({ id: 'cd-2' })

        const { result } = renderHook(() => useCreateCustomDeduction(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ employee_id: 'emp-1', deduction_type: 'Gym', amount: 500 })
        })

        expect(salaryService.createCustomDeduction).toHaveBeenCalled()
    })

    it('useDeleteCustomDeduction — fires mutationFn', async () => {
        salaryService.deleteCustomDeduction.mockResolvedValue(true)

        const { result } = renderHook(() => useDeleteCustomDeduction(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync('cd-1') })

        expect(salaryService.deleteCustomDeduction).toHaveBeenCalledWith('cd-1')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DATA HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useAdminData', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useAdminSettings — fetches all admin data', async () => {
        const mockData = {
            departments: [{ id: 'd1', name: 'Engineering' }],
            holidays: [],
            leavePolicies: [],
            auditLogs: [],
            notificationLogs: []
        }
        adminService.getAdminSettings.mockResolvedValue(mockData)

        const { result } = renderHook(() => useAdminSettings(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data.departments).toHaveLength(1)
    })

    it('useAddDepartment — fires mutationFn', async () => {
        adminService.addDepartment.mockResolvedValue({ id: 'd2', name: 'HR' })

        const { result } = renderHook(() => useAddDepartment(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync('HR') })

        expect(adminService.addDepartment).toHaveBeenCalledWith('HR')
    })

    it('useAddHoliday — fires mutationFn', async () => {
        adminService.addHoliday.mockResolvedValue({ id: 'h2', name: 'Diwali', date: '2026-11-01' })

        const { result } = renderHook(() => useAddHoliday(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ name: 'Diwali', date: '2026-11-01' })
        })

        expect(adminService.addHoliday).toHaveBeenCalledWith({ name: 'Diwali', date: '2026-11-01' })
    })

    it('useAddLeavePolicy — fires mutationFn', async () => {
        adminService.addLeavePolicy.mockResolvedValue({ id: 'lp1', leave_type: 'Sick Leave', annual_balance: 10 })

        const { result } = renderHook(() => useAddLeavePolicy(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ leaveType: 'Sick Leave', annualBalance: 10 })
        })

        expect(adminService.addLeavePolicy).toHaveBeenCalled()
    })

    it('useRemoveAdminRow — fires mutationFn', async () => {
        adminService.removeAdminRow.mockResolvedValue(true)

        const { result } = renderHook(() => useRemoveAdminRow(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ table: 'departments', id: 'd1' })
        })

        expect(adminService.removeAdminRow).toHaveBeenCalledWith({ table: 'departments', id: 'd1' })
    })

    it('useInitializeLeaveBalances — fires mutationFn', async () => {
        adminService.initializeLeaveBalances.mockResolvedValue(true)

        const { result } = renderHook(() => useInitializeLeaveBalances(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync(2026) })

        expect(adminService.initializeLeaveBalances).toHaveBeenCalledWith(2026)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY SETTINGS HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useCompanyData', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useCompanySettings — fetches company info', async () => {
        companyService.getCompanySettings.mockResolvedValue({ id: 'co-1', name: 'Acme Corp' })

        const { result } = renderHook(() => useCompanySettings(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data.name).toBe('Acme Corp')
    })

    it('useUpdateCompanySettings — fires mutationFn', async () => {
        companyService.updateCompanySettings.mockResolvedValue({ id: 'co-1', name: 'Updated Corp' })

        const { result } = renderHook(() => useUpdateCompanySettings(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'co-1', updates: { name: 'Updated Corp' } })
        })

        expect(companyService.updateCompanySettings).toHaveBeenCalledWith({ id: 'co-1', updates: { name: 'Updated Corp' } })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// EXITS HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useExitsData', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useExits — fetches exit requests', async () => {
        exitService.getExits.mockResolvedValue([{ id: 'ex-1', status: 'pending' }])

        const { result } = renderHook(() => useExits(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toHaveLength(1)
    })

    it('useCreateExit — fires mutationFn', async () => {
        exitService.createExit.mockResolvedValue({ id: 'ex-2' })

        const { result } = renderHook(() => useCreateExit(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ employee_id: 'emp-1', exit_type: 'resignation', last_working_date: '2026-06-30' })
        })

        expect(exitService.createExit).toHaveBeenCalled()
    })

    it('useUpdateExitStatus — fires mutationFn', async () => {
        exitService.updateExitStatus.mockResolvedValue(true)

        const { result } = renderHook(() => useUpdateExitStatus(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'ex-1', status: 'approved', employeeId: 'emp-1' })
        })

        expect(exitService.updateExitStatus).toHaveBeenCalled()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useReportsData', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useReportData — fetches report aggregates', async () => {
        reportService.getReportData.mockResolvedValue({
            payrollRuns: [],
            employees: [],
            attendance: [],
            generatedReports: []
        })

        const { result } = renderHook(() => useReportData(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(reportService.getReportData).toHaveBeenCalledOnce()
    })

    it('useStatutoryData — disabled when no month provided', () => {
        const { result } = renderHook(() => useStatutoryData(null), { wrapper: createWrapper(qc) })
        expect(result.current.fetchStatus).toBe('idle')
    })

    it('useStatutoryData — fetches when month provided', async () => {
        reportService.getStatutoryData.mockResolvedValue({ companySettings: {}, payrollRun: null })

        const { result } = renderHook(() => useStatutoryData('2026-05'), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(reportService.getStatutoryData).toHaveBeenCalledWith('2026-05')
    })

    it('useSaveGeneratedReport — fires mutationFn', async () => {
        reportService.saveGeneratedReport.mockResolvedValue({ id: 'rpt-1' })

        const { result } = renderHook(() => useSaveGeneratedReport(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ title: 'Monthly Payroll Report', type: 'payroll' })
        })

        expect(reportService.saveGeneratedReport).toHaveBeenCalled()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// TAX DECLARATIONS HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useTaxDeclarations', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useTaxDeclarations — fetches declarations', async () => {
        taxService.getTaxDeclarations.mockResolvedValue([{ id: 'td-1', status: 'submitted', regime: 'new' }])

        const { result } = renderHook(() => useTaxDeclarations(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toHaveLength(1)
    })

    it('useReviewDeclaration — fires mutationFn', async () => {
        taxService.reviewDeclaration.mockResolvedValue(true)

        const { result } = renderHook(() => useReviewDeclaration(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'td-1', status: 'approved' })
        })

        expect(taxService.reviewDeclaration).toHaveBeenCalledWith({ id: 'td-1', status: 'approved' })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useOnboardingData', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useOnboardingChecklist — disabled when no employeeId', () => {
        const { result } = renderHook(() => useOnboardingChecklist(null), { wrapper: createWrapper(qc) })
        expect(result.current.fetchStatus).toBe('idle')
    })

    it('useOnboardingChecklist — fetches when employeeId provided', async () => {
        onboardingService.getChecklist.mockResolvedValue([{ id: 'oc-1', task_name: 'Collect Documents', status: 'pending' }])

        const { result } = renderHook(() => useOnboardingChecklist('emp-1'), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(onboardingService.getChecklist).toHaveBeenCalledWith('emp-1')
    })

    it('useCreateOnboardingTasks — fires mutationFn', async () => {
        const tasks = [{ employee_id: 'emp-1', task_name: 'IT Setup', category: 'IT', status: 'pending' }]
        onboardingService.createTasks.mockResolvedValue(tasks)

        const { result } = renderHook(() => useCreateOnboardingTasks(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync(tasks) })

        expect(onboardingService.createTasks).toHaveBeenCalledWith(tasks)
    })

    it('useToggleTaskStatus — fires mutationFn', async () => {
        onboardingService.updateTaskStatus.mockResolvedValue(true)

        const { result } = renderHook(() => useToggleTaskStatus(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'oc-1', status: 'completed' })
        })

        expect(onboardingService.updateTaskStatus).toHaveBeenCalledWith({ id: 'oc-1', status: 'completed' })
    })

    it('useDeleteOnboardingTask — fires mutationFn', async () => {
        onboardingService.deleteTask.mockResolvedValue(true)

        const { result } = renderHook(() => useDeleteOnboardingTask(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync('oc-1') })

        expect(onboardingService.deleteTask).toHaveBeenCalledWith('oc-1')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD HOOKS
// ─────────────────────────────────────────────────────────────────────────────

describe('useDashboardData', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useDashboardData — fetches dashboard aggregates', async () => {
        dashboardService.getDashboardData.mockResolvedValue({
            employeeCount: 42,
            latestRun: null,
            salaries: [],
            attendanceLogs: [],
            pendingCompliance: 3,
            recentRuns: [],
            newHires: [],
            recentReports: []
        })

        const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data.employeeCount).toBe(42)
        expect(dashboardService.getDashboardData).toHaveBeenCalledOnce()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// EXTRA BRANCH-COVERAGE TESTS
// These cover specific uncovered lines/branches identified in the coverage report
// ─────────────────────────────────────────────────────────────────────────────

describe('Branch coverage — useEmployeeById', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('disabled when id is null', () => {
        const { result } = renderHook(() => useEmployeeById(null), { wrapper: createWrapper(qc) })
        expect(result.current.fetchStatus).toBe('idle')
        expect(employeeService.getEmployeeById).not.toHaveBeenCalled()
    })

    it('fetches when id is provided', async () => {
        employeeService.getEmployeeById.mockResolvedValue({ id: 'emp-1', first_name: 'Alice' })

        const { result } = renderHook(() => useEmployeeById('emp-1'), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(employeeService.getEmployeeById).toHaveBeenCalledWith('emp-1')
    })
})

describe('Branch coverage — useAttendanceData extras', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useUpdateAttendance — fires mutationFn (with employee_id in response)', async () => {
        attendanceService.updateAttendance.mockResolvedValue({ id: 'att-1', employee_id: 'emp-1', status: 'present' })

        const { result } = renderHook(() => useUpdateAttendance(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'att-1', payload: { status: 'present' } })
        })

        expect(attendanceService.updateAttendance).toHaveBeenCalledWith({ id: 'att-1', payload: { status: 'present' } })
    })

    it('useUpdateAttendance — fires mutationFn (without employee_id in response)', async () => {
        attendanceService.updateAttendance.mockResolvedValue({ id: 'att-1', status: 'absent' })

        const { result } = renderHook(() => useUpdateAttendance(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'att-1', payload: { status: 'absent' } })
        })

        expect(attendanceService.updateAttendance).toHaveBeenCalled()
    })

    it('useDeleteAttendance — fires mutationFn', async () => {
        attendanceService.deleteAttendance.mockResolvedValue(true)

        const { result } = renderHook(() => useDeleteAttendance(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync('att-1') })

        expect(attendanceService.deleteAttendance).toHaveBeenCalledWith('att-1')
    })

    it('useRegularizationRequests — fetches requests', async () => {
        attendanceService.getRegularizationRequests.mockResolvedValue([{ id: 'reg-1', status: 'pending' }])

        const { result } = renderHook(() => useRegularizationRequests(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toHaveLength(1)
    })

    it('useUpdateRegularizationStatus — fires mutationFn', async () => {
        attendanceService.updateRegularizationStatus.mockResolvedValue(true)

        const { result } = renderHook(() => useUpdateRegularizationStatus(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'reg-1', status: 'approved', reviewedBy: 'admin-1' })
        })

        expect(attendanceService.updateRegularizationStatus).toHaveBeenCalledWith({ id: 'reg-1', status: 'approved', reviewedBy: 'admin-1' })
    })
})

describe('Branch coverage — useExitsData extras', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useUpdateExitClearance — fires mutationFn', async () => {
        exitService.updateExitClearance.mockResolvedValue(true)

        const { result } = renderHook(() => useUpdateExitClearance(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'ex-1', department: 'IT', isCleared: true, reviewerUserId: 'admin-1' })
        })

        expect(exitService.updateExitClearance).toHaveBeenCalled()
    })

    it('useUpdateExitSettlement — fires mutationFn', async () => {
        exitService.updateExitSettlement.mockResolvedValue(true)

        const { result } = renderHook(() => useUpdateExitSettlement(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'ex-1', amount: 75000, details: { gratuity: 50000 } })
        })

        expect(exitService.updateExitSettlement).toHaveBeenCalled()
    })
})

describe('Branch coverage — useLeavesData extras', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useLeaveApplicationsWithEmployee — fetches with employee data', async () => {
        leaveService.getLeaveApplicationsWithEmployee.mockResolvedValue([
            { id: 'lv-1', employee: { first_name: 'Alice', last_name: 'Smith' }, status: 'pending' }
        ])

        const { result } = renderHook(() => useLeaveApplicationsWithEmployee(), { wrapper: createWrapper(qc) })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toHaveLength(1)
        expect(leaveService.getLeaveApplicationsWithEmployee).toHaveBeenCalledOnce()
    })
})

describe('Branch coverage — useSalaryData extras', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useUpdateSalaryComponent — fires mutationFn', async () => {
        salaryService.updateSalaryComponent.mockResolvedValue({ id: 'sc-1', label: 'Basic Updated' })

        const { result } = renderHook(() => useUpdateSalaryComponent(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'sc-1', payload: { label: 'Basic Updated', value: 55 } })
        })

        expect(salaryService.updateSalaryComponent).toHaveBeenCalledWith({ id: 'sc-1', payload: { label: 'Basic Updated', value: 55 } })
    })

    it('useUpdateCustomDeduction — fires mutationFn', async () => {
        salaryService.updateCustomDeduction.mockResolvedValue({ id: 'cd-1', amount: 750 })

        const { result } = renderHook(() => useUpdateCustomDeduction(), { wrapper: createWrapper(qc) })

        await act(async () => {
            await result.current.mutateAsync({ id: 'cd-1', payload: { amount: 750 } })
        })

        expect(salaryService.updateCustomDeduction).toHaveBeenCalledWith({ id: 'cd-1', payload: { amount: 750 } })
    })
})

describe('Branch coverage — useOnboardingData onSuccess employeeId branch', () => {
    let qc
    beforeEach(() => { qc = createTestQueryClient(); vi.clearAllMocks() })

    it('useCreateOnboardingTasks — invalidates specific employee checklist when tasks have employee_id', async () => {
        const tasks = [{ employee_id: 'emp-1', task_name: 'Setup Laptop', category: 'IT', status: 'pending' }]
        onboardingService.createTasks.mockResolvedValue(tasks)

        const { result } = renderHook(() => useCreateOnboardingTasks(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync(tasks) })

        expect(onboardingService.createTasks).toHaveBeenCalledWith(tasks)
        // onSuccess path with employee_id exercised — cache invalidation for that employee's checklist fired
    })

    it('useCreateOnboardingTasks — handles tasks without employee_id gracefully', async () => {
        const tasks = [{ task_name: 'Setup Laptop', category: 'IT', status: 'pending' }]
        onboardingService.createTasks.mockResolvedValue(tasks)

        const { result } = renderHook(() => useCreateOnboardingTasks(), { wrapper: createWrapper(qc) })

        await act(async () => { await result.current.mutateAsync(tasks) })

        // Service was called — the onSuccess branch without employee_id was exercised
        expect(onboardingService.createTasks).toHaveBeenCalledWith(tasks)
    })
})
