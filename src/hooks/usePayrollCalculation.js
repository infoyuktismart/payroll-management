import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { devLog } from '../lib/devLogger'
import { useToast } from '../context/ToastContext'
import { calculateMonthlyTdsFromDeclaration, getIndianFinancialYear } from '../lib/taxUtils'

export const usePayrollCalculation = (initialState = {}) => {
    const toast = useToast()
    const [loading, setLoading] = useState(false)
    const [processingStep, setProcessingStep] = useState(initialState.processingStep || 0)
    const [employees, setEmployees] = useState(initialState.employees || [])
    const [payrollData, setPayrollData] = useState(initialState.payrollData || [])

    const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate()

    const calculatePayroll = useCallback(async (selectedDate, selectedDepartment, employeeSearch) => {
        devLog('calculatePayroll called with:', { selectedDate, selectedDepartment, employeeSearch })
        setLoading(true)
        setPayrollData([])
        setProcessingStep(1) // Attendance Collection

        try {
            const [year, month] = selectedDate.split('-').map(Number)
            const daysInMonth = getDaysInMonth(year, month)
            const startDate = `${selectedDate}-01`
            const endDate = `${selectedDate}-${daysInMonth}`

            const { data: existingRun, error: existingRunError } = await supabase
                .from('payroll_runs')
                .select('id, status')
                .eq('month_year', startDate)
                .maybeSingle()

            if (existingRunError && existingRunError.code !== '42P01') throw existingRunError
            if (existingRun?.id) {
                throw new Error(`Payroll for ${selectedDate} is already ${existingRun.status || 'created'}. Open Payroll History to view it.`)
            }

            // Simulated Delay for smooth UX transition
            await new Promise(r => setTimeout(r, 600))

            // 1. Fetch Employees
            let employeeQuery = supabase
                .from('employees')
                .select('*')
                .neq('status', 'terminated')

            if (selectedDepartment !== 'All Departments') {
                employeeQuery = employeeQuery.eq('department', selectedDepartment)
            }

            if (employeeSearch?.trim()) {
                const search = employeeSearch.trim()
                employeeQuery = employeeQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_id.ilike.%${search}%,email.ilike.%${search}%`)
            }

            const { data: emps, error: empError } = await employeeQuery.order('first_name')
            if (empError) throw empError
            setEmployees(emps || [])

            // 2. Fetch Attendance (Absent/Half Day records) for LOP Calculation
            const { data: attendanceData, error: attError } = await supabase
                .from('attendance')
                .select('employee_id, status, date')
                .gte('date', startDate)
                .lte('date', endDate)

            if (attError) throw attError

            // Fetch Approved Leaves for the period
            const { data: approvedLeaves } = await supabase
                .from('leaves')
                .select('*')
                .eq('status', 'approved')
                .lte('start_date', endDate)
                .gte('end_date', startDate)

            const { data: overtimeData, error: overtimeError } = await supabase
                .from('overtime')
                .select('employee_id, hours, date, status')
                .eq('status', 'approved')
                .gte('date', startDate)
                .lte('date', endDate)

            if (overtimeError) throw overtimeError

            const { data: holidays } = await supabase
                .from('holidays')
                .select('date')
                .gte('date', startDate)
                .lte('date', endDate)

            const financialYear = getIndianFinancialYear(selectedDate)
            const { data: taxDeclarations, error: taxError } = await supabase
                .from('tax_declarations')
                .select('*')
                .eq('financial_year', financialYear)
                .eq('status', 'approved')

            if (taxError && taxError.code !== '42P01') throw taxError

            setProcessingStep(2) // Salary Calculation
            await new Promise(r => setTimeout(r, 600))

            // Identify Sundays
            const sundays = []
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month - 1, d)
                if (date.getDay() === 0) {
                    sundays.push(`${selectedDate}-${d.toString().padStart(2, '0')}`)
                }
            }

            // Compute Payable Days & Gross
            let tempPayroll = emps.map(emp => {
                const empAttendance = attendanceData.filter(a => a.employee_id === emp.id)
                const empOvertimeHours = (overtimeData || [])
                    .filter(o => o.employee_id === emp.id)
                    .reduce((sum, o) => sum + (Number(o.hours) || 0), 0)

                const absentDays = empAttendance.filter(a => {
                    const isAbsent = a.status === 'Absent' || a.status === 'absent'
                    const isSun = sundays.includes(a.date)
                    const isHoliday = holidays?.some(h => h.date === a.date)
                    const isWO = a.status === 'weekly_off' || a.status === 'Weekly Off'
                    const onApprovedLeave = approvedLeaves?.some(l =>
                        l.employee_id === emp.id &&
                        a.date >= l.start_date &&
                        a.date <= l.end_date &&
                        l.status === 'approved'
                    )
                    return isAbsent && !isSun && !isHoliday && !isWO && !onApprovedLeave
                }).length

                const halfDays = empAttendance.filter(a => {
                    const isHalf = a.status === 'Half Day' || a.status === 'half_day'
                    const isSun = sundays.includes(a.date)
                    const isHoliday = holidays?.some(h => h.date === a.date)
                    const isWO = a.status === 'weekly_off' || a.status === 'Weekly Off'
                    const onApprovedLeave = approvedLeaves?.some(l =>
                        l.employee_id === emp.id &&
                        a.date >= l.start_date &&
                        a.date <= l.end_date &&
                        l.status === 'approved'
                    )
                    return isHalf && !isSun && !isHoliday && !isWO && !onApprovedLeave
                }).length

                const lopDays = absentDays + (halfDays * 0.5)
                const payableDays = Math.max(0, daysInMonth - lopDays)

                const basic = parseFloat(emp.salary) || 0
                const allowances = parseFloat(emp.salary_allowances) || 0
                const monthlyTotal = basic + allowances

                const earnedGross = (monthlyTotal / daysInMonth) * payableDays
                const earnedBasic = (basic / daysInMonth) * payableDays

                return {
                    id: emp.id,
                    employee: emp,
                    empId: emp.employee_id,
                    name: `${emp.first_name} ${emp.last_name}`,
                    designation: emp.designation,
                    totalDays: daysInMonth,
                    payableDays,
                    basicSalary: earnedBasic,
                    grossSalary: earnedGross,
                    overtimeHours: empOvertimeHours,
                    deductionsList: [],
                    totalDeductions: 0,
                    netSalary: 0
                }
            })

            setProcessingStep(3) // Deduction Calculation
            await new Promise(r => setTimeout(r, 600))

            // 3. Apply Deductions & Finalize Components
            const { data: customDeductions, error: customError } = await supabase.from('custom_deductions')
                .select('*')
                .eq('status', 'Active')
                .lte('start_date', endDate)
                .or(`end_date.is.null,end_date.gte.${startDate}`)

            if (customError) console.error("Error fetching custom deductions:", customError)
            devLog(`Fetched ${customDeductions?.length || 0} active custom deductions for period ${startDate} to ${endDate}`)

            tempPayroll = tempPayroll.map(item => {
                let totalDed = 0
                let dedList = []
                let totalEarned = 0
                let earnList = []
                const structure = item.employee?.salary_structure || {}
                const factor = item.payableDays / daysInMonth

                // A. Calculate Earnings from structure
                Object.entries(structure).forEach(([, config]) => {
                    if (config.label?.toLowerCase() === 'basic salary' || config.label?.toLowerCase() === 'basic') return

                    if (config.category === 'earning' && config.enabled) {
                        let amount = 0
                        if (config.type === 'percentage') {
                            amount = (item.employee.salary * config.value) / 100
                        } else {
                            amount = config.value
                        }
                        const earnedAmount = amount * factor
                        earnList.push({ name: config.label, amount: parseFloat(earnedAmount.toFixed(2)) })
                        totalEarned += earnedAmount
                    }
                })

                // Add pro-rated basic
                const earnedBasic = (parseFloat(item.employee.salary) || 0) * factor
                totalEarned += earnedBasic
                earnList.unshift({ name: 'Basic Salary', amount: parseFloat(earnedBasic.toFixed(2)) })

                const hourlyRate = ((parseFloat(item.employee.salary) || 0) / daysInMonth) / 8
                const overtimePay = (Number(item.overtimeHours) || 0) * hourlyRate * 1.5
                if (overtimePay > 0) {
                    earnList.push({ name: `Overtime (${item.overtimeHours} hrs)`, amount: parseFloat(overtimePay.toFixed(2)) })
                    totalEarned += overtimePay
                }

                // B. Apply Deductions from structure
                Object.entries(structure).forEach(([, config]) => {
                    if (config.category === 'deduction' && config.enabled) {
                        let amount = 0

                        if (config.system_type === 'ESI') {
                            const esiLimit = item.employee?.is_specially_abled ? 25000 : 21000
                            if (totalEarned > esiLimit) return // Not eligible
                        }

                        if (config.type === 'percentage') {
                            const label = config.label?.toLowerCase() || ''
                            const isBasicTarget = config.system_type === 'PF' ||
                                config.system_type === 'ESI' ||
                                label.includes('pf') ||
                                label.includes('provident fund') ||
                                label.includes('esi')

                            const base = isBasicTarget ? earnedBasic : totalEarned

                            let effectiveBase = base;
                            if (config.max_limit > 0) effectiveBase = Math.min(effectiveBase, config.max_limit);
                            if (config.min_limit > 0) effectiveBase = Math.max(effectiveBase, config.min_limit);

                            amount = (effectiveBase * config.value) / 100
                        } else {
                            amount = config.value * factor
                        }

                        if (amount > 0) {
                            dedList.push({ name: config.label, amount: parseFloat(amount.toFixed(2)) })
                            totalDed += amount
                        }
                    }
                })

                // C. Apply Custom (Variable) Deductions
                const empCustom = customDeductions?.filter(cd => cd.employee_id === item.id)
                empCustom?.forEach(cd => {
                    dedList.push({ name: cd.deduction_type, amount: cd.amount })
                    totalDed += cd.amount
                })

                const declaration = taxDeclarations?.find(td => td.employee_id === item.id)
                const tdsResult = calculateMonthlyTdsFromDeclaration({
                    monthlyGross: totalEarned,
                    declaration,
                    monthsRemaining: Math.max(1, 13 - month)
                })
                const monthlyTds = tdsResult.monthlyTds

                if (monthlyTds > 0) {
                    dedList.push({ name: `TDS - ${tdsResult.regime === 'old' ? 'Old' : 'New'} Regime`, amount: monthlyTds })
                    totalDed += monthlyTds
                }

                return {
                    ...item,
                    basicSalary: parseFloat(earnedBasic.toFixed(2)),
                    grossSalary: parseFloat(totalEarned.toFixed(2)),
                    earningsList: earnList,
                    deductionsList: dedList,
                    totalDeductions: parseFloat(totalDed.toFixed(2)),
                    netSalary: parseFloat((totalEarned - totalDed).toFixed(2))
                }
            })

            setProcessingStep(4) // Compliance
            await new Promise(r => setTimeout(r, 600))

            setProcessingStep(5) // Final Review
            setPayrollData(tempPayroll)
            toast.success(`Successfully processed payroll calculations for ${tempPayroll.length} employees.`)
            return tempPayroll
        } catch (error) {
            toast.error(error.message || 'Error occurred during payroll calculations.')
            setProcessingStep(0)
            throw error
        } finally {
            setLoading(false)
        }
    }, [toast])

    return {
        loading,
        setLoading,
        processingStep,
        setProcessingStep,
        employees,
        setEmployees,
        payrollData,
        setPayrollData,
        calculatePayroll
    }
}
