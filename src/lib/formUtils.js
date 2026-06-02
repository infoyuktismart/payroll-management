/**
 * Sanitizes all string fields of a form payload before submitting to Supabase.
 * Returns a new object — does not mutate the original. Allows skipping specific keys (e.g. URLs).
 * @param {Record<string, any>} payload
 * @param {string[]} [excludeKeys=[]]
 * @returns {Record<string, any>}
 */
export function sanitizeFormData(payload, excludeKeys = []) {
  if (!payload || typeof payload !== 'object') return payload;

  const sanitizeValue = (val, key) => {
    if (excludeKeys.includes(key)) return val;
    if (val === null || typeof val !== 'object') {
      if (typeof val === 'string') {
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
        // eslint-disable-next-line no-useless-escape
        return String(val).replace(/[&<>"'`=\/]/g, s => entityMap[s]);
      }
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(item => sanitizeValue(item, key));
    }
    const sanitized = {};
    for (const k in val) {
      if (Object.prototype.hasOwnProperty.call(val, k)) {
        sanitized[k] = sanitizeValue(val[k], k);
      }
    }
    return sanitized;
  };

  const sanitizedResult = {};
  for (const key in payload) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      sanitizedResult[key] = sanitizeValue(payload[key], key);
    }
  }
  return sanitizedResult;
}
