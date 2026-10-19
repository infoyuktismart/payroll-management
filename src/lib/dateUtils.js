import { format, parseISO } from 'date-fns'

export const formatDate = (date, formatStr = 'MMM d, yyyy') => {
    if (!date) return ''
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date
        return format(dateObj, formatStr)
    } catch {
        return date
    }
}

export const formatMonthYear = (dateStr) => {
    if (!dateStr) return ''
    try {
        const dateObj = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
        return format(dateObj, 'MMMM yyyy')
    } catch {
        return dateStr
    }
}

export const formatShortMonth = (dateStr) => {
    if (!dateStr) return ''
    try {
        const dateObj = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
        return format(dateObj, 'MMM d, yyyy')
    } catch {
        return dateStr
    }
}

export const toISODateString = (date) => {
    if (!date) return ''
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toISOString().split('T')[0]
}

/**
 * Parses Indian (DD-MM-YYYY / DD/MM/YYYY) or ISO (YYYY-MM-DD) date string
 * and returns standard ISO date (YYYY-MM-DD) and Indian date (DD-MM-YYYY).
 */
export const parseDateToISO = (val) => {
    if (val === undefined || val === null) return { isValid: true, isoDate: null, indianDate: null }

    if (val instanceof Date) {
        if (isNaN(val.getTime())) return { isValid: false, isoDate: null, indianDate: null }
        const year = val.getFullYear()
        const month = val.getMonth() + 1
        const day = val.getDate()
        const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const indianDate = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`
        return { isValid: true, isoDate, indianDate }
    }

    const str = String(val).trim()
    if (!str) return { isValid: true, isoDate: null, indianDate: null }

    let day, month, year

    // 1. Indian format: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
    if (dmyMatch) {
        day = parseInt(dmyMatch[1], 10)
        month = parseInt(dmyMatch[2], 10)
        year = parseInt(dmyMatch[3], 10)
    } else {
        // 2. ISO format: YYYY-MM-DD or YYYY/MM/DD
        const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
        if (ymdMatch) {
            year = parseInt(ymdMatch[1], 10)
            month = parseInt(ymdMatch[2], 10)
            day = parseInt(ymdMatch[3], 10)
        } else {
            // 3. Native Date string fallback
            const d = new Date(str)
            if (!isNaN(d.getTime())) {
                year = d.getFullYear()
                month = d.getMonth() + 1
                day = d.getDate()
            } else {
                return { isValid: false, isoDate: null, indianDate: null }
            }
        }
    }

    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2099) {
        return { isValid: false, isoDate: null, indianDate: null }
    }

    const dateObj = new Date(year, month - 1, day)
    if (
        dateObj.getFullYear() !== year ||
        dateObj.getMonth() + 1 !== month ||
        dateObj.getDate() !== day
    ) {
        return { isValid: false, isoDate: null, indianDate: null }
    }

    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const indianDate = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`

    return { isValid: true, isoDate, indianDate }
}

export const formatIndianDate = (date) => {
    if (!date) return ''
    const parsed = parseDateToISO(date)
    return parsed.isValid && parsed.indianDate ? parsed.indianDate : String(date)
}

