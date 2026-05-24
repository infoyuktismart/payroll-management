export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(Number(amount) || 0)
}

export const calculateNewRegimeAnnualTax = (annualTaxableIncome) => {
    const taxable = Math.max(0, Number(annualTaxableIncome) || 0)
    const slabs = [
        { limit: 400000, rate: 0 },
        { limit: 800000, rate: 0.05 },
        { limit: 1200000, rate: 0.10 },
        { limit: 1600000, rate: 0.15 },
        { limit: 2000000, rate: 0.20 },
        { limit: 2400000, rate: 0.25 },
        { limit: Infinity, rate: 0.30 }
    ]

    let previousLimit = 0
    let tax = 0

    for (const slab of slabs) {
        if (taxable <= previousLimit) break
        const slabAmount = Math.min(taxable, slab.limit) - previousLimit
        tax += slabAmount * slab.rate
        previousLimit = slab.limit
    }

    const rebate = taxable <= 1200000 ? Math.min(tax, 60000) : 0
    const taxAfterRebate = Math.max(0, tax - rebate)
    const cess = taxAfterRebate * 0.04
    return Math.round(taxAfterRebate + cess)
}

export const calculateMonthlyTds = ({ monthlyGross, previousMonthlyTds = 0, monthsRemaining = 12 }) => {
    const standardDeduction = 75000
    const annualTaxableIncome = Math.max(0, (Number(monthlyGross) || 0) * 12 - standardDeduction)
    const annualTax = calculateNewRegimeAnnualTax(annualTaxableIncome)
    const remainingTax = Math.max(0, annualTax - (Number(previousMonthlyTds) || 0))
    return Math.round(remainingTax / Math.max(1, monthsRemaining))
}

export const buildPayrollCsv = (items) => {
    const headers = [
        'Employee ID',
        'Employee Name',
        'Department',
        'Designation',
        'Payable Days',
        'Basic Salary',
        'Gross Salary',
        'Total Deductions',
        'Net Salary'
    ]

    const rows = (items || []).map(item => [
        item.empId,
        item.name,
        item.employee?.department || '',
        item.designation || '',
        item.payableDays,
        item.basicSalary,
        item.grossSalary,
        item.totalDeductions,
        item.netSalary
    ])

    return [headers, ...rows]
        .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')
}

export const downloadBlob = (content, filename, type = 'text/csv;charset=utf-8;') => {
    const blob = content instanceof Blob ? content : new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export const calculateSettlement = (employee, exitRecord, leaveBalance = 0) => {
    const monthlySalary = Number(employee?.salary) || 0
    const dailySalary = monthlySalary / 30
    const resignationDate = exitRecord?.resignation_date ? new Date(exitRecord.resignation_date) : null
    const lastWorkingDay = exitRecord?.last_working_day || exitRecord?.exit_date ? new Date(exitRecord.last_working_day || exitRecord.exit_date) : null
    const noticeDaysServed = resignationDate && lastWorkingDay
        ? Math.max(0, Math.ceil((lastWorkingDay - resignationDate) / (1000 * 60 * 60 * 24)))
        : 0
    const expectedNoticeDays = Number(employee?.notice_period_days) || 30
    const shortfallDays = Math.max(0, expectedNoticeDays - noticeDaysServed)
    const noticeRecovery = Math.round(shortfallDays * dailySalary)
    const leaveEncashment = Math.round(Math.max(0, Number(leaveBalance) || 0) * dailySalary)
    const yearsOfService = employee?.joining_date
        ? Math.max(0, (new Date(exitRecord?.exit_date || Date.now()) - new Date(employee.joining_date)) / (1000 * 60 * 60 * 24 * 365.25))
        : 0
    const gratuity = yearsOfService >= 5 ? Math.round((15 / 26) * monthlySalary * Math.floor(yearsOfService)) : 0
    const finalAmount = Math.max(0, leaveEncashment + gratuity - noticeRecovery)

    return {
        noticeRecovery,
        leaveEncashment,
        gratuity,
        finalAmount,
        shortfallDays,
        yearsOfService: Number(yearsOfService.toFixed(1))
    }
}
