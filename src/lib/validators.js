/**
 * Shared validation utilities for all forms in Yukti Smart HRMS.
 * All regex patterns are aligned with VALIDATION_STANDARDS.md and Indian statutory requirements.
 *
 * Usage:
 *   import { REGEX, validateRegistrationField, validateCompanyLegalField } from '../lib/validators'
 */

// ─── Regex Patterns (Indian Statutory + General) ─────────────────────────────

export const REGEX = {
    /** Standard RFC 5322 email pattern */
    EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

    /** Name fields: letters and spaces only */
    NAME: /^[A-Za-z\s]+$/,

    /** Indian mobile number: exactly 10 digits */
    PHONE: /^\d{10}$/,

    /**
     * PAN: 5 uppercase letters + 4 digits + 1 uppercase letter.
     * e.g., ABCDE1234F
     */
    PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,

    /**
     * TAN: 4 uppercase letters + 5 digits + 1 uppercase letter.
     * e.g., DELA12345B
     */
    TAN: /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/,

    /**
     * GSTIN: 15-character alphanumeric Indian GST Identification Number.
     * Format: 2-digit state code + 10-char PAN + 1 entity code + 1 check char + Z
     * e.g., 07AAAAA1111A1Z1
     */
    GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,

    /**
     * Aadhaar: exactly 12 numeric digits.
     * Must not start with 0 or 1 (per UIDAI spec).
     */
    AADHAAR: /^[2-9]{1}\d{11}$/,

    /**
     * IFSC: 4 uppercase letters (bank code) + 0 + 6 alphanumeric (branch code).
     * e.g., SBIN0001234
     */
    IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,

    /**
     * UAN (Universal Account Number): exactly 12 numeric digits.
     */
    UAN: /^\d{12}$/,

    /**
     * EPFO employer code: 15-character alphanumeric.
     * e.g., DLCPM0012345000
     */
    EPFO: /^[A-Z]{2}[A-Z]{3}[A-Z0-9]{7}\d{3}$/,

    /**
     * ESIC employer code: exactly 17 numeric digits.
     */
    ESIC: /^\d{17}$/,

    /**
     * Password strength: at least 8 chars, 1 uppercase, 1 lowercase, 1 digit.
     */
    PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,

    /**
     * Company code: 2–10 uppercase alphanumeric characters.
     */
    COMPANY_CODE: /^[A-Z0-9]{2,10}$/,
}

// ─── Registration Form Validation (Step 1 & 2) ───────────────────────────────

/**
 * Validates individual fields for RegisterUserForm and RegisterCompanyForm.
 * Returns an error string, or '' if valid.
 *
 * @param {string} name - Field name (e.g. 'firstName', 'email')
 * @param {string} value - Current field value
 * @param {{ password?: string }} [context] - Optional sibling values (e.g. for confirmPassword)
 * @returns {string}
 */
export const validateRegistrationField = (name, value, context = {}) => {
    const v = (value || '').trim()

    switch (name) {
        case 'firstName':
            if (!v) return 'First name is required'
            if (!REGEX.NAME.test(v)) return 'First name must contain only letters'
            if (v.length < 2) return 'First name must be at least 2 characters'
            return ''

        case 'lastName':
            if (!v) return 'Last name is required'
            if (!REGEX.NAME.test(v)) return 'Last name must contain only letters'
            return ''

        case 'email':
            if (!v) return 'Email address is required'
            if (!REGEX.EMAIL.test(v)) return 'Please enter a valid email address (e.g., name@company.com)'
            return ''

        case 'password':
            if (!v) return 'Password is required'
            if (v.length < 8) return 'Password must be at least 8 characters'
            if (!REGEX.PASSWORD_STRONG.test(v)) return 'Password must include an uppercase letter, a lowercase letter, and a number'
            return ''

        case 'confirmPassword':
            if (!v) return 'Please confirm your password'
            if (v !== (context.password || '')) return 'Passwords do not match'
            return ''

        case 'companyName':
            if (!v) return 'Company name is required'
            if (v.length < 3) return 'Company name must be at least 3 characters'
            return ''

        case 'companyCode': {
            const upper = v.toUpperCase()
            if (!upper) return 'Company code is required'
            if (!REGEX.COMPANY_CODE.test(upper)) return 'Company code must be 2–10 uppercase letters or digits (e.g., ACME)'
            return ''
        }

        default:
            return ''
    }
}

// ─── Company Legal / Statutory Form Validation ───────────────────────────────

/**
 * Validates individual fields for CompanyLegalTab (Company Settings → Legal IDs).
 * All fields are optional — only validates format if a value is provided.
 * Returns an error string, or '' if valid.
 *
 * @param {string} name - Field name (e.g. 'pan_number', 'gst_number')
 * @param {string} value - Current field value
 * @returns {string}
 */
export const validateCompanyLegalField = (name, value) => {
    if (!value || !value.trim()) return '' // All legal fields are optional

    const v = value.trim().toUpperCase()

    switch (name) {
        case 'pan_number':
            if (!REGEX.PAN.test(v)) return 'Invalid PAN format (e.g., ABCDE1234F)'
            return ''

        case 'tan_number':
            if (!REGEX.TAN.test(v)) return 'Invalid TAN format (e.g., DELA12345B)'
            return ''

        case 'gst_number':
            if (!REGEX.GSTIN.test(v)) return 'Invalid GSTIN format (e.g., 07AAAAA1111A1Z1)'
            return ''

        case 'epfo_number':
            if (v.length < 12 || v.length > 15) return 'EPFO number must be 12–15 characters'
            return ''

        case 'esic_number':
            if (!REGEX.ESIC.test(value.trim())) return 'ESIC number must be exactly 17 digits'
            return ''

        default:
            return ''
    }
}
