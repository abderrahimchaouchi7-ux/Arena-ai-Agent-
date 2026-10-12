import { describe, expect, it } from 'vitest';
import { formatHijri, hijriMonthName, specialDay, toHijri } from './hijri';

describe('toHijri', () => {
  it('resolves well-known dates', () => {
    // 1 Muharram 1447 AH began on 26 June 2025 (Umm al-Qura).
    const muharram = toHijri(new Date(2025, 5, 26));
    expect(muharram.month).toBe(1);
    expect(muharram.year).toBe(1447);

    // 1 Ramadan 1446 AH began on 1 March 2025.
    const ramadan = toHijri(new Date(2025, 2, 1));
    expect(ramadan.month).toBe(9);
    expect(ramadan.year).toBe(1446);
  });

  it('throws rather than returning a bogus date', () => {
    // A Date the platform cannot format must surface as an error, not a guess.
    expect(() => toHijri(new Date(Number.NaN))).toThrow();
  });

  it('shifts the day by the requested offset', () => {
    const base = toHijri(new Date(2026, 9, 12));
    const plusOne = toHijri(new Date(2026, 9, 12), 1);
    const minusOne = toHijri(new Date(2026, 9, 12), -1);
    // Consecutive Hijri days differ by one, except at a month boundary.
    const diff = (a: number, b: number) => Math.abs(a - b);
    expect(diff(base.day, plusOne.day) === 1 || diff(base.day, plusOne.day) > 20).toBe(true);
    expect(diff(base.day, minusOne.day) === 1 || diff(base.day, minusOne.day) > 20).toBe(true);
  });
});

describe('hijriMonthName', () => {
  it('covers all twelve months in every language', () => {
    for (const lang of ['ar', 'fr', 'en'] as const) {
      for (let month = 1; month <= 12; month += 1) {
        expect(hijriMonthName(month, lang).length).toBeGreaterThan(1);
      }
    }
  });

  it('names Ramadan correctly', () => {
    expect(hijriMonthName(9, 'en')).toBe('Ramadan');
    expect(hijriMonthName(9, 'ar')).toBe('رَمَضان');
    expect(hijriMonthName(9, 'fr')).toBe('Ramadan');
  });

  it('clamps out-of-range months instead of returning undefined', () => {
    expect(hijriMonthName(0, 'en')).toBe(hijriMonthName(1, 'en'));
    expect(hijriMonthName(13, 'en')).toBe(hijriMonthName(12, 'en'));
  });
});

describe('formatHijri', () => {
  it('formats per language with the right era marker', () => {
    const date = new Date(2026, 9, 12);
    expect(formatHijri(date, 'en').formatted).toContain('AH');
    expect(formatHijri(date, 'fr').formatted).toContain('AH');
    expect(formatHijri(date, 'ar').formatted).toContain('هـ');
  });

  it('reports whether an offset was applied', () => {
    const date = new Date(2026, 9, 12);
    expect(formatHijri(date, 'en').adjusted).toBe(false);
    expect(formatHijri(date, 'en', 1).adjusted).toBe(true);
  });

  it('produces a compact numeric form', () => {
    const result = formatHijri(new Date(2026, 9, 12), 'en');
    expect(result.short).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });
});

describe('specialDay', () => {
  it('recognises the notable days', () => {
    expect(specialDay({ day: 15, month: 9, year: 1447 })).toBe('ramadan');
    expect(specialDay({ day: 1, month: 10, year: 1447 })).toBe('eid-al-fitr');
    expect(specialDay({ day: 10, month: 12, year: 1447 })).toBe('eid-al-adha');
    expect(specialDay({ day: 9, month: 12, year: 1447 })).toBe('arafah');
    expect(specialDay({ day: 10, month: 1, year: 1447 })).toBe('ashura');
  });

  it('returns null on an ordinary day', () => {
    expect(specialDay({ day: 14, month: 3, year: 1447 })).toBeNull();
  });
});
