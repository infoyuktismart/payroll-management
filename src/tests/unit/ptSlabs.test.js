import { describe, it, expect } from 'vitest';
import {
    calculatePT,
    calculateAnnualPT,
    getLWF,
    PT_SLABS,
    LWF_RATES
} from '../../lib/ptSlabs';

describe('ptSlabs - calculatePT boundaries, states, and edge cases', () => {
    it('should return 0 for states with no PT (e.g. Rajasthan, Delhi)', () => {
        const nonPtStates = ['Delhi', 'Rajasthan', 'Uttar Pradesh', 'Haryana', 'Goa'];
        nonPtStates.forEach(state => {
            expect(calculatePT(state, 50000)).toBe(0);
        });
    });

    it('should handle unknown or null states without throwing', () => {
        expect(calculatePT(null, 50000)).toBe(0);
        expect(calculatePT(undefined, 50000)).toBe(0);
        expect(calculatePT('InvalidState', 50000)).toBe(0);
    });

    it('should correctly calculate PT for Karnataka boundaries', () => {
        // Karnataka slabs: upTo: 15000 -> 0; upTo: 29999 -> 200; upTo: Infinity -> 200
        expect(calculatePT('Karnataka', 14999)).toBe(0);
        expect(calculatePT('Karnataka', 15000)).toBe(0);
        expect(calculatePT('Karnataka', 15001)).toBe(200);
        expect(calculatePT('Karnataka', 29999)).toBe(200);
        expect(calculatePT('Karnataka', 30000)).toBe(200);
    });

    it('should correctly calculate PT for Maharashtra boundaries including Feb rule', () => {
        // Maharashtra slabs: upTo: 7500 -> 0; upTo: 10000 -> 175; upTo: Infinity -> 200
        // Boundary 7500
        expect(calculatePT('Maharashtra', 7500, 5)).toBe(0);
        expect(calculatePT('Maharashtra', 7501, 5)).toBe(175);

        // Boundary 10000 in standard month (month index 5 = June)
        expect(calculatePT('Maharashtra', 10000, 5)).toBe(175);
        expect(calculatePT('Maharashtra', 10001, 5)).toBe(200);

        // Boundary 10000 in February (month index 1)
        expect(calculatePT('Maharashtra', 10000, 1)).toBe(175);
        expect(calculatePT('Maharashtra', 10001, 1)).toBe(300); // Maharashtra Feb rule
    });

    it('should correctly calculate PT for West Bengal boundaries', () => {
        // West Bengal slabs:
        // upTo: 8500 -> 0
        // upTo: 10000 -> 90
        // upTo: 15000 -> 110
        // upTo: 25000 -> 130
        // upTo: 40000 -> 150
        // upTo: Infinity -> 200
        expect(calculatePT('West Bengal', 8500)).toBe(0);
        expect(calculatePT('West Bengal', 8501)).toBe(90);
        expect(calculatePT('West Bengal', 10000)).toBe(90);
        expect(calculatePT('West Bengal', 10001)).toBe(110);
        expect(calculatePT('West Bengal', 15000)).toBe(110);
        expect(calculatePT('West Bengal', 15001)).toBe(130);
        expect(calculatePT('West Bengal', 25000)).toBe(130);
        expect(calculatePT('West Bengal', 25001)).toBe(150);
        expect(calculatePT('West Bengal', 40000)).toBe(150);
        expect(calculatePT('West Bengal', 40001)).toBe(200);
    });

    it('should correctly calculate PT for other states listed in PT_SLABS', () => {
        // Test a few other states
        expect(calculatePT('Gujarat', 5000)).toBe(0);
        expect(calculatePT('Gujarat', 8000)).toBe(80);
        expect(calculatePT('Gujarat', 11000)).toBe(150);
        expect(calculatePT('Gujarat', 20000)).toBe(200);

        expect(calculatePT('Madhya Pradesh', 10000)).toBe(0);
        expect(calculatePT('Madhya Pradesh', 20000)).toBe(208); // 208.33 rounded is 208
    });
});

describe('ptSlabs - calculateAnnualPT', () => {
    it('should calculate annual PT correctly for Maharashtra', () => {
        expect(calculateAnnualPT('Maharashtra', 15000)).toBe(2500); // 11 * 200 + 300
        expect(calculateAnnualPT('Maharashtra', 9000)).toBe(175 * 12);
    });

    it('should calculate annual PT correctly for other states', () => {
        expect(calculateAnnualPT('Karnataka', 20000)).toBe(2400); // 12 * 200
    });
});

describe('ptSlabs - getLWF', () => {
    it('should return LWF contributions for active LWF states', () => {
        expect(getLWF('Karnataka')).toEqual({ employee: 20, employer: 40 });
        expect(getLWF('Maharashtra')).toEqual({ employee: 6, employer: 12 });
    });

    it('should return 0 employee & employer contribution for non-LWF states', () => {
        expect(getLWF('Delhi')).toEqual({ employee: 0, employer: 0 });
    });
});
