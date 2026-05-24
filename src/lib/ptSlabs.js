/**
 * ptSlabs.js
 * State-wise Professional Tax (PT) slabs and Labour Welfare Fund (LWF) rates.
 * PT is capped at ₹2,500 per annum per the Constitution of India.
 *
 * Each slab entry: { upTo: Number (monthly gross), tax: Number (monthly PT) }
 * upTo: Infinity means "above last threshold"
 */

export const PT_SLABS = {
    'Andhra Pradesh': [
        { upTo: 15000, tax: 0 },
        { upTo: Infinity, tax: 200 }
    ],
    'Karnataka': [
        { upTo: 15000, tax: 0 },
        { upTo: 29999, tax: 200 },
        { upTo: Infinity, tax: 200 }
    ],
    'Maharashtra': [
        { upTo: 7500, tax: 0 },
        { upTo: 10000, tax: 175 },
        // Feb is 300 for the 10001–Inf bracket, rest of months 200
        // We store the standard monthly here; February premium handled in calculator
        { upTo: Infinity, tax: 200 }
    ],
    'West Bengal': [
        { upTo: 8500, tax: 0 },
        { upTo: 10000, tax: 90 },
        { upTo: 15000, tax: 110 },
        { upTo: 25000, tax: 130 },
        { upTo: 40000, tax: 150 },
        { upTo: Infinity, tax: 200 }
    ],
    'Tamil Nadu': [
        { upTo: 3500, tax: 0 },
        { upTo: 5000, tax: 22.5 },
        { upTo: 7500, tax: 52.5 },
        { upTo: 10000, tax: 115 },
        { upTo: 12500, tax: 125 },
        { upTo: Infinity, tax: 208.33 }
    ],
    'Telangana': [
        { upTo: 15000, tax: 0 },
        { upTo: Infinity, tax: 200 }
    ],
    'Gujarat': [
        { upTo: 5999, tax: 0 },
        { upTo: 8999, tax: 80 },
        { upTo: 11999, tax: 150 },
        { upTo: Infinity, tax: 200 }
    ],
    'Madhya Pradesh': [
        { upTo: 18750, tax: 0 },
        { upTo: Infinity, tax: 208.33 }
    ],
    'Odisha': [
        { upTo: 13304, tax: 0 },
        { upTo: 25000, tax: 125 },
        { upTo: Infinity, tax: 200 }
    ],
    'Assam': [
        { upTo: 10000, tax: 0 },
        { upTo: 14999, tax: 150 },
        { upTo: Infinity, tax: 208 }
    ],
    'Kerala': [
        // Kerala PT is charged half-yearly; we represent the monthly equivalent
        { upTo: 1999, tax: 0 },
        { upTo: 3999, tax: 20 },
        { upTo: 4999, tax: 30 },
        { upTo: 7499, tax: 50 },
        { upTo: 9999, tax: 75 },
        { upTo: 14999, tax: 125 },
        { upTo: 19999, tax: 166.67 },
        { upTo: Infinity, tax: 208.33 }
    ],
    'Punjab': [
        { upTo: 24999, tax: 0 },
        { upTo: Infinity, tax: 200 }
    ],
    'Bihar': [
        { upTo: 25000, tax: 0 },
        { upTo: Infinity, tax: 208.33 }
    ],
    'Jharkhand': [
        { upTo: 25000, tax: 0 },
        { upTo: Infinity, tax: 100 }
    ],
    'Chhattisgarh': [
        { upTo: 15000, tax: 0 },
        { upTo: Infinity, tax: 200 }
    ],
    'Meghalaya': [
        { upTo: 4166, tax: 0 },
        { upTo: 6250, tax: 16.67 },
        { upTo: 8333, tax: 25 },
        { upTo: 12500, tax: 41.67 },
        { upTo: 16666, tax: 83.33 },
        { upTo: Infinity, tax: 208.33 }
    ],
    'Tripura': [
        { upTo: 7500, tax: 0 },
        { upTo: 15000, tax: 100 },
        { upTo: Infinity, tax: 150 }
    ],
    'Sikkim': [
        { upTo: 20000, tax: 0 },
        { upTo: 30000, tax: 125 },
        { upTo: Infinity, tax: 200 }
    ],
    'Manipur': [
        { upTo: 5000, tax: 0 },
        { upTo: 8333, tax: 75 },
        { upTo: 12500, tax: 100 },
        { upTo: Infinity, tax: 208 }
    ],
    // States with no PT
    'Delhi': [],
    'Rajasthan': [],
    'Uttar Pradesh': [],
    'Haryana': [],
    'Himachal Pradesh': [],
    'Uttarakhand': [],
    'Jammu & Kashmir': [],
    'Goa': [],
    'Arunachal Pradesh': [],
    'Nagaland': [],
    'Mizoram': []
}

/**
 * Labour Welfare Fund — employer + employee contributions (monthly, in ₹)
 * Format: { employee: Number, employer: Number }
 * Most states have LWF as an annual deduction; we represent monthly equivalent.
 */
export const LWF_RATES = {
    'Maharashtra':       { employee: 6,   employer: 12 },   // Deducted in June & Dec
    'Karnataka':         { employee: 20,  employer: 40 },
    'Gujarat':           { employee: 6,   employer: 12 },
    'Tamil Nadu':        { employee: 10,  employer: 20 },
    'Andhra Pradesh':    { employee: 30,  employer: 70 },
    'Telangana':         { employee: 30,  employer: 70 },
    'Madhya Pradesh':    { employee: 10,  employer: 20 },
    'Punjab':            { employee: 10,  employer: 20 },
    'Kerala':            { employee: 4,   employer: 8  },
    'Haryana':           { employee: 3.17, employer: 6.33 },
    'West Bengal':       { employee: 3,   employer: 6  },
    'Odisha':            { employee: 3,   employer: 6  },
    'Chhattisgarh':      { employee: 10,  employer: 20 },
    'Jharkhand':         { employee: 10,  employer: 20 },
    'Goa':               { employee: 10,  employer: 20 },
}

/**
 * Calculate monthly Professional Tax for a given state and monthly gross.
 * @param {string} state  - Employee's work state
 * @param {number} monthlyGross - Employee's monthly gross salary
 * @param {number} [month=0] - 0-indexed month (0=Jan..11=Dec). Used for Maharashtra Feb rule.
 * @returns {number} Monthly PT amount in ₹
 */
export const calculatePT = (state, monthlyGross, month = new Date().getMonth()) => {
    const slabs = PT_SLABS[state]
    if (!slabs || slabs.length === 0) return 0

    const gross = Math.max(0, Number(monthlyGross) || 0)

    for (const slab of slabs) {
        if (gross <= slab.upTo) {
            let tax = slab.tax
            // Maharashtra special rule: February tax is ₹300 for income > ₹10,000
            if (state === 'Maharashtra' && gross > 10000 && month === 1) {
                tax = 300
            }
            return Math.round(tax)
        }
    }

    return 0
}

/**
 * Calculate annual PT for a given state (approximation: 12 × monthly rate)
 * @param {string} state
 * @param {number} monthlyGross
 * @returns {number}
 */
export const calculateAnnualPT = (state, monthlyGross) => {
    // Maharashtra: 11 months × 200 + 1 month (Feb) × 300 = 2500
    if (state === 'Maharashtra' && monthlyGross > 10000) return 2500

    const monthly = calculatePT(state, monthlyGross)
    return monthly * 12
}

/**
 * Get LWF contributions for a state.
 * @param {string} state
 * @returns {{ employee: number, employer: number }}
 */
export const getLWF = (state) => {
    return LWF_RATES[state] || { employee: 0, employer: 0 }
}

/**
 * All states that have PT enabled
 */
export const PT_STATES = Object.keys(PT_SLABS).filter(s => PT_SLABS[s].length > 0)

/**
 * All states that have LWF enabled
 */
export const LWF_STATES = Object.keys(LWF_RATES)
