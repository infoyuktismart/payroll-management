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
