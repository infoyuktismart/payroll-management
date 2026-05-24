export const normalizeLeaveType = (value = '') =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, '')

export const calculateLeaveDays = (startDate, endDate, holidays = []) => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0

    const holidaySet = new Set((holidays || []).map(holiday => holiday.date || holiday))
    let days = 0
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const date = cursor.toISOString().split('T')[0]
        if (cursor.getDay() !== 0 && !holidaySet.has(date)) {
            days += 1
        }
    }
    return days
}

export const getLeavePolicyOptions = (policies = []) => {
    const active = policies.filter(policy => (policy.status || 'Active') === 'Active')
    if (active.length > 0) return active
    return [
        { leave_type: 'Casual Leave', annual_balance: 8 },
        { leave_type: 'Sick Leave', annual_balance: 12 },
        { leave_type: 'Earned Leave', annual_balance: 15 }
    ]
}

export const getBalanceForType = (balances = [], leaveType) => {
    const normalized = normalizeLeaveType(leaveType)
    const match = balances.find(balance => normalizeLeaveType(balance.leave_type) === normalized)
    return Number(match?.balance || 0)
}
