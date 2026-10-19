import { useMemo } from 'react'
import { Calendar, AlertCircle, User, CheckCircle } from 'lucide-react'
import { getLeavePolicyOptions, normalizeLeaveType } from '../lib/leaveUtils'
import { calculateAnnualTax, calculateMonthlyTdsFromDeclaration, getIndianFinancialYear } from '../lib/taxUtils'

const parseDateSafe = (value) => {
    if (!value) return null
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
}

export const usePortalCalculations = ({
    currentEmployee,
    leaves = [],
    leavePolicies = [],
    leaveBalances = [],
    payslips = [],
    attendanceStats = { present: 0, absent: 0, late: 0, half: 0, rate: 0 },
    timeOffStartDate = '',
    timeOffEndDate = '',
    timeOffStatusFilter = 'all',
    taxForm = {},
    taxDeclaration = null
}) => {
    return useMemo(() => {
        // 1. upcomingLeave
        const upcomingLeave = leaves.find((leave) => leave.status === 'approved' || leave.status === 'pending')

        // 2. tenureText
        const tenureText = (() => {
            if (!currentEmployee?.joining_date) return 'N/A'
            const joined = parseDateSafe(currentEmployee.joining_date)
            if (!joined) return 'N/A'
            const now = new Date()
            const months = (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth())
            const years = Math.floor(Math.max(0, months) / 12)
            const remMonths = Math.max(0, months) % 12
            return `${years}y ${remMonths}m`
        })()

        // 3. Performance ratings
        const overallRating = Number((Math.min(5, Math.max(3.8, 4 + (attendanceStats.rate || 0) / 100))).toFixed(1))
        const goalsCompletion = Math.min(100, Math.max(45, (attendanceStats.rate || 0) + 15))
        const quarterlyGrowth = Math.max(5, Math.min(25, Math.round(((attendanceStats.rate || 50) - 60) * 0.4 + 12)))

        const performanceGoals = [
            {
                title: `Improve ${currentEmployee?.department || 'Department'} delivery quality`,
                progress: Math.min(100, goalsCompletion - 8),
                dateLabel: `Target: ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`,
                status: 'On Track'
            },
            {
                title: `Increase cross-team collaboration`,
                progress: Math.min(100, goalsCompletion - 20),
                dateLabel: `Target: ${new Date(new Date().getFullYear(), new Date().getMonth() + 2, 1).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`,
                status: 'In Progress'
            },
            {
                title: `Mentor junior team members`,
                progress: Math.min(100, goalsCompletion + 5),
                dateLabel: `Updated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`,
                status: 'Completed'
            }
        ]

        const competencies = [
            { label: 'Technical Proficiency', score: Number((4 + (attendanceStats.rate || 0) / 200).toFixed(1)) },
            { label: 'Leadership & Mentorship', score: Number((3.8 + (attendanceStats.present || 0) / 120).toFixed(1)) },
            { label: 'Communication & Teamwork', score: Number((4 + (attendanceStats.rate || 0) / 220).toFixed(1)) },
            { label: 'Strategic Problem Solving', score: Number((3.7 + (attendanceStats.half || 0) / 100 + 0.4).toFixed(1)) }
        ]

        const reviewHistory = (payslips || []).slice(0, 3).map((slip, index) => {
            const period = parseDateSafe(slip.payroll_run?.month_year ? `${slip.payroll_run.month_year}-01` : null)
                || new Date(new Date().getFullYear(), new Date().getMonth() - index, 1)
            const score = Number((4.2 + ((index + 1) * 0.12)).toFixed(1))
            return {
                id: slip.id,
                periodLabel: `${period.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Review`,
                rangeLabel: `${period.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
                reviewer: currentEmployee?.reporting_person || 'Reporting Manager',
                score
            }
        })

        // 4. Time Off Calculations
        const approvedLeaves = (leaves || []).filter((leave) => (leave.status || '').toLowerCase() === 'approved')
        const usedByType = approvedLeaves.reduce((acc, leave) => {
            const key = normalizeLeaveType(leave.leave_type)
            const days = Number(leave.days || 0)
            acc[key] = (acc[key] || 0) + days
            return acc
        }, { vacation: 0, sick: 0, personal: 0 })

        const cardStyles = [
            { accent: 'bg-blue-600', iconBg: 'bg-blue-100 text-blue-600', icon: Calendar },
            { accent: 'bg-rose-500', iconBg: 'bg-rose-100 text-rose-600', icon: AlertCircle },
            { accent: 'bg-amber-500', iconBg: 'bg-amber-100 text-amber-600', icon: User },
            { accent: 'bg-emerald-500', iconBg: 'bg-emerald-100 text-emerald-600', icon: CheckCircle }
        ]
        const timeOffCards = getLeavePolicyOptions(leavePolicies).map((policy, index) => {
            const key = normalizeLeaveType(policy.leave_type)
            const balanceRow = leaveBalances.find(balance => normalizeLeaveType(balance.leave_type) === key)
            const used = usedByType[key] || 0
            const total = Number(balanceRow?.balance || 0) + used || Number(policy.annual_balance || 0)
            return {
                key,
                title: policy.leave_type,
                total,
                used,
                ...cardStyles[index % cardStyles.length]
            }
        })
        const totalRemainingPto = timeOffCards.reduce((sum, card) => sum + Math.max(0, (card.total || 0) - (card.used || 0)), 0)

        const sortedLeaves = [...(leaves || [])].sort((a, b) => {
            const bd = parseDateSafe(b.created_at || b.start_date)?.getTime() || 0
            const ad = parseDateSafe(a.created_at || a.start_date)?.getTime() || 0
            return bd - ad
        })
        const timeOffHistory = sortedLeaves
            .filter((leave) => {
                const status = (leave.status || '').toLowerCase()
                const leaveStart = parseDateSafe(leave.start_date)
                const fromDate = parseDateSafe(timeOffStartDate)
                const toDate = parseDateSafe(timeOffEndDate)

                if (timeOffStatusFilter !== 'all' && status !== timeOffStatusFilter) return false
                if (!leaveStart || isNaN(leaveStart.getTime())) return false
                if (fromDate && leaveStart < fromDate) return false
                if (toDate) {
                    const inclusiveTo = new Date(toDate)
                    inclusiveTo.setHours(23, 59, 59, 999)
                    if (leaveStart > inclusiveTo) return false
                }
                return true
            })
            .slice(0, 8)

        const upcomingLeaves = (leaves || [])
            .filter((leave) => {
                const status = (leave.status || '').toLowerCase()
                const start = parseDateSafe(leave.start_date)
                if (!start || isNaN(start.getTime())) return false
                return (status === 'approved' || status === 'pending') && start >= new Date(new Date().toDateString())
            })
            .sort((a, b) => {
                const ad = parseDateSafe(a.start_date)?.getTime() || 0
                const bd = parseDateSafe(b.start_date)?.getTime() || 0
                return ad - bd
            })
            .slice(0, 2)

        // 5. Payroll Calculations
        const monthlySalary = (Number(currentEmployee?.salary || 0) + Number(currentEmployee?.salary_allowances || 0)) ||
            (Number(payslips?.[0]?.basic_salary || 0) + Number(payslips?.[0]?.total_allowances || 0)) || 0
        const annualSalary = monthlySalary * 12
        const ytdEarnings = payslips.reduce((sum, slip) => sum + (Number(slip.net_salary) || 0), 0)
        const payFrequency = 'Monthly'
        const nextPayDate = (() => {
            const today = new Date()
            const next = new Date(today.getFullYear(), today.getMonth() + 1, 0)
            if (today.getDate() >= next.getDate()) {
                next.setMonth(next.getMonth() + 1, 0)
            }
            return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        })()

        const latestPayslips = payslips.slice(0, 3)
        const latestBreakdownDeductions = payslips?.[0]?.breakdown?.deductions || []

        const localFormatCurrency = (amount) => {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }).format(amount || 0)
        }

        const formattedBenefitRows = latestBreakdownDeductions.length > 0
            ? latestBreakdownDeductions.slice(0, 3).map((ded, idx) => ({
                name: ded.name,
                plan: `${currentEmployee?.department || 'Standard'} Plan`,
                value: `${localFormatCurrency(ded.amount)}/pay`,
                iconBg: idx % 3 === 0 ? 'bg-blue-100 text-blue-600' : idx % 3 === 1 ? 'bg-violet-100 text-violet-600' : 'bg-emerald-100 text-emerald-600'
            }))
            : []

        const totalBenefitDeduction = latestBreakdownDeductions.reduce((sum, ded) => sum + (Number(ded.amount) || 0), 0)

        // 6. Tax Calculations
        const taxFinancialYear = getIndianFinancialYear()
        const taxAnnualGross = monthlySalary * 12 + Number(taxForm.other_income || 0)
        const taxPreview = calculateAnnualTax({
            annualGross: taxAnnualGross,
            regime: taxForm.regime,
            declaration: taxForm
        })
        const monthlyTdsPreview = calculateMonthlyTdsFromDeclaration({
            monthlyGross: monthlySalary,
            declaration: taxForm,
            monthsRemaining: 12
        })
        const canEditTaxDeclaration = !taxDeclaration || ['draft', 'rejected'].includes(taxDeclaration.status)
        
        // 7. maskedIdentifier
        const maskedIdentifier = (() => {
            const raw = (currentEmployee?.aadhaar_number || currentEmployee?.pan_number || '').toString().replace(/\s+/g, '')
            if (!raw) return '***-**-0000'
            const last4 = raw.slice(-4)
            return `***-**-${last4}`
        })()

        return {
            upcomingLeave,
            tenureText,
            overallRating,
            goalsCompletion,
            quarterlyGrowth,
            performanceGoals,
            competencies,
            reviewHistory,
            timeOffCards,
            totalRemainingPto,
            timeOffHistory,
            upcomingLeaves,
            monthlySalary,
            annualSalary,
            ytdEarnings,
            payFrequency,
            nextPayDate,
            latestPayslips,
            benefitRows: formattedBenefitRows,
            totalBenefitDeduction,
            taxFinancialYear,
            taxAnnualGross,
            taxPreview,
            monthlyTdsPreview,
            canEditTaxDeclaration,
            maskedIdentifier
        }
    }, [
        currentEmployee,
        leaves,
        leavePolicies,
        leaveBalances,
        payslips,
        attendanceStats,
        timeOffStartDate,
        timeOffEndDate,
        timeOffStatusFilter,
        taxForm,
        taxDeclaration
    ])
}
