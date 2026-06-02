const HEADER_ALIASES = {
    employeeCode: ['employee_id', 'employee id', 'employee code', 'emp code', 'emp id', 'user id', 'user_id', 'pin', 'person id', 'no.', 'no'],
    employeeName: ['employee name', 'name', 'user name', 'person name'],
    punchDate: ['date', 'attendance date', 'punch date'],
    punchTime: ['time', 'punch time', 'punch_time'],
    punchDateTime: ['datetime', 'date time', 'punch datetime', 'punch date time', 'timestamp', 'attendance time', 'check time'],
    direction: ['state', 'status', 'punch state', 'direction', 'in/out', 'inout', 'type'],
    device: ['device', 'device name', 'terminal', 'terminal name', 'machine', 'device id'],
    verifyMode: ['verify', 'verify mode', 'verification', 'verification mode']
}

const normalizeHeader = (value = '') => value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')

const parseCsvLine = (line) => {
    const result = []
    let current = ''
    let quoted = false

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i]
        const next = line[i + 1]
        if (char === '"' && quoted && next === '"') {
            current += '"'
            i += 1
        } else if (char === '"') {
            quoted = !quoted
        } else if (char === ',' && !quoted) {
            result.push(current.trim())
            current = ''
        } else {
            current += char
        }
    }

    result.push(current.trim())
    return result
}

const resolveHeaderKey = (header) => {
    const normalized = normalizeHeader(header)
    return Object.entries(HEADER_ALIASES).find(([, aliases]) => aliases.includes(normalized))?.[0] || normalized
}

const normalizeDate = (value = '') => {
    const clean = String(value).trim()
    if (!clean) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean

    const ddmmyyyy = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
    if (ddmmyyyy) {
        const [, dd, mm, yyyy] = ddmmyyyy
        const fullYear = yyyy.length === 2 ? `20${yyyy}` : yyyy
        return `${fullYear}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }

    const parsed = new Date(clean)
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

const normalizeTime = (value = '') => {
    const clean = String(value).trim()
    if (!clean) return ''
    const match = clean.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i)
    if (!match) return ''
    let hour = Number(match[1])
    const minute = match[2]
    const meridiem = match[3]?.toUpperCase()
    if (meridiem === 'PM' && hour < 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${minute}`
}

const splitDateTime = (value = '') => {
    const clean = String(value).trim()
    if (!clean) return { date: '', time: '' }
    const isoLike = clean.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2}(?::\d{2})?)/)
    if (isoLike) return { date: isoLike[1], time: normalizeTime(isoLike[2]) }

    const parts = clean.split(/\s+/)
    if (parts.length >= 2) {
        return { date: normalizeDate(parts[0]), time: normalizeTime(parts.slice(1).join(' ')) }
    }

    const parsed = new Date(clean)
    if (Number.isNaN(parsed.getTime())) return { date: '', time: '' }
    return { date: parsed.toISOString().slice(0, 10), time: parsed.toTimeString().slice(0, 5) }
}

const normalizeDirection = (value = '') => {
    const clean = String(value).trim().toLowerCase()
    if (['in', 'check in', 'check-in', '0', 'i'].includes(clean)) return 'in'
    if (['out', 'check out', 'check-out', '1', 'o'].includes(clean)) return 'out'
    return ''
}

export const parseBiometricCsv = (text, vendor = 'auto') => {
    const lines = String(text || '').split(/\r?\n/).filter(line => line.trim())
    if (lines.length === 0) return { vendor, punches: [], errors: ['CSV file is empty.'] }

    const headers = parseCsvLine(lines[0]).map(resolveHeaderKey)
    const errors = []
    const punches = lines.slice(1).map((line, index) => {
        const values = parseCsvLine(line)
        const row = headers.reduce((acc, header, columnIndex) => ({ ...acc, [header]: values[columnIndex] || '' }), {})
        const dateTime = splitDateTime(row.punchDateTime || row.datetime || '')
        const date = normalizeDate(row.punchDate) || dateTime.date
        const time = normalizeTime(row.punchTime) || dateTime.time

        return {
            rowNumber: index + 2,
            vendor,
            employeeCode: String(row.employeeCode || '').trim(),
            employeeName: String(row.employeeName || '').trim(),
            date,
            time,
            direction: normalizeDirection(row.direction),
            device: row.device || '',
            verifyMode: row.verifyMode || '',
            raw: row
        }
    }).filter(punch => {
        const valid = punch.employeeCode && punch.date && punch.time
        if (!valid) errors.push(`Row ${punch.rowNumber}: missing employee code, date, or time.`)
        return valid
    })

    return { vendor, punches, errors }
}

export const buildBiometricAttendanceRows = (punches = [], employees = [], overrides = {}) => {
    const employeeMap = new Map()
    employees.forEach(employee => {
        if (employee.employee_id) employeeMap.set(String(employee.employee_id).trim().toLowerCase(), employee)
        if (employee.biometric_id) employeeMap.set(String(employee.biometric_id).trim().toLowerCase(), employee)
        if (employee.id) employeeMap.set(String(employee.id).trim().toLowerCase(), employee)
    })

    const grouped = new Map()
    punches.forEach(punch => {
        const overrideId = overrides[punch.employeeCode]
        const employee = overrideId
            ? employees.find(item => item.id === overrideId)
            : employeeMap.get(String(punch.employeeCode).trim().toLowerCase())

        const key = `${employee?.id || punch.employeeCode}|${punch.date}`
        const current = grouped.get(key) || { punch, employee, punches: [] }
        current.punches.push(punch)
        if (employee) current.employee = employee
        grouped.set(key, current)
    })

    return Array.from(grouped.values()).map(group => {
        const sorted = group.punches.slice().sort((a, b) => a.time.localeCompare(b.time))
        const inPunch = sorted.find(item => item.direction === 'in') || sorted[0]
        const outPunch = [...sorted].reverse().find(item => item.direction === 'out') || sorted[sorted.length - 1]
        const checkIn = inPunch?.time || ''
        const checkOut = outPunch?.time && outPunch?.time !== checkIn ? outPunch.time : ''
        const workMinutes = checkIn && checkOut ? minutesBetween(checkIn, checkOut) : 0

        return {
            employee: group.employee,
            employeeCode: group.punch.employeeCode,
            employeeName: group.punch.employeeName,
            date: group.punch.date,
            check_in: checkIn ? `${group.punch.date}T${checkIn}:00` : null,
            check_out: checkOut ? `${group.punch.date}T${checkOut}:00` : null,
            status: workMinutes >= 480 ? 'present' : workMinutes >= 240 ? 'half_day' : 'present',
            workMinutes,
            punchCount: sorted.length,
            device: sorted.map(item => item.device).filter(Boolean)[0] || '',
            remarks: `Biometric import: ${sorted.length} punch(es)`
        }
    })
}

export const readBiometricFile = (file, vendor = 'auto') => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = event => resolve(parseBiometricCsv(event.target.result, vendor))
    reader.onerror = () => reject(reader.error || new Error('Unable to read biometric file.'))
    reader.readAsText(file)
})

const minutesBetween = (start, end) => {
    const [startHour, startMinute] = start.split(':').map(Number)
    const [endHour, endMinute] = end.split(':').map(Number)
    return Math.max(0, (endHour * 60 + endMinute) - (startHour * 60 + startMinute))
}
