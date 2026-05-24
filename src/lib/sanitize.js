/**
 * Basic HTML sanitizer to prevent XSS.
 * For an enterprise application, you should consider using a robust library like DOMPurify.
 * This is a lightweight implementation for basic needs.
 */

const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
};

export function escapeHtml(string) {
    if (!string) return '';
    // eslint-disable-next-line no-useless-escape
    return String(string).replace(/[&<>"'`=\/]/g, function (s) {
        return entityMap[s];
    });
}

/**
 * Sanitizes an object deeply, escaping all string properties.
 */
export function sanitizeObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        if (typeof obj === 'string') return escapeHtml(obj);
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const sanitized = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            sanitized[key] = sanitizeObject(obj[key]);
        }
    }
    return sanitized;
}

/**
 * Validates and strips non-numeric characters for phone numbers
 */
export function sanitizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/[^0-9+]/g, '');
}

/**
 * Validates basic email format (without escaping it so it can be used for auth)
 */
export function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}
