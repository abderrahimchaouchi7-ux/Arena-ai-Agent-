import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRAYER_SETTINGS,
  buildCalculationParameters,
  computePrayerTimes,
  formatCountdown,
  getNextPrayer,
  prayerEntries,
} from './prayer';
import type { PrayerSettings } from './prayer';

/** Makkah — the reference city for the Umm al-Qura method. */
const MAKKAH = { latitude: 21.4224779, longitude: 39.8251832 };
const LONDON = { latitude: 51.5072, longitude: -0.1276 };

/** Builds a Date in the runtime's local zone on a given Y-M-D. */
function localDate(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

const settings = (patch: Partial<PrayerSettings> = {}): PrayerSettings => ({
  ...DEFAULT_PRAYER_SETTINGS,
  ...patch,
});

describe('computePrayerTimes', () => {
  it('produces a chronologically ordered day', () => {
    const times = computePrayerTimes(MAKKAH, localDate(2026, 3, 21), settings());
    expect(times.fajr.getTime()).toBeLessThan(times.sunrise.getTime());
    expect(times.sunrise.getTime()).toBeLessThan(times.dhuhr.getTime());
    expect(times.dhuhr.getTime()).toBeLessThan(times.asr.getTime());
    expect(times.asr.getTime()).toBeLessThan(times.maghrib.getTime());
    expect(times.maghrib.getTime()).toBeLessThan(times.isha.getTime());
  });

  it('sets Maghrib at sunset', () => {
    const times = computePrayerTimes(MAKKAH, localDate(2026, 3, 21), settings());
    expect(times.maghrib.getTime()).toBe(times.sunset.getTime());
  });

  it('rejects invalid coordinates instead of returning nonsense', () => {
    expect(() => computePrayerTimes({ latitude: NaN, longitude: 0 }, new Date(), settings())).toThrow();
    expect(() =>
      computePrayerTimes({ latitude: 91, longitude: 0 }, new Date(), settings()),
    ).toThrow();
    expect(() =>
      computePrayerTimes({ latitude: 0, longitude: 181 }, new Date(), settings()),
    ).toThrow();
  });

  it('returns real Date objects so time zone and DST come from the platform', () => {
    const times = computePrayerTimes(LONDON, localDate(2026, 7, 15), settings());
    expect(times.fajr).toBeInstanceOf(Date);
    expect(Number.isNaN(times.fajr.getTime())).toBe(false);
  });

  it('resolves British Summer Time through Intl, not hand-rolled offsets', () => {
    // The app formats with Intl in the user's zone, so DST correctness comes
    // from the platform. Prove the mechanism: the same city, same clock hour,
    // must sit at different UTC offsets in July and January.
    const offsetIn = (iso: string) => {
      const dtf = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      const parts = Object.fromEntries(
        dtf.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
      );
      const asUtc = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour), Number(parts.minute), Number(parts.second),
      );
      return (asUtc - new Date(iso).getTime()) / 60000;
    };
    expect(offsetIn('2026-07-15T12:00:00Z')).toBe(60); // BST = UTC+1
    expect(offsetIn('2026-01-15T12:00:00Z')).toBe(0); // GMT = UTC+0
  });

  it('changes with the calculation method', () => {
    const mw = localDate(2026, 3, 21);
    const mwl = computePrayerTimes(MAKKAH, mw, settings({ method: 'MuslimWorldLeague' }));
    const umm = computePrayerTimes(MAKKAH, mw, settings({ method: 'UmmAlQura' }));
    // Fajr 18.5° (Umm al-Qura) vs 18° (MWL): the deeper angle is reached
    // earlier in the morning, so Umm al-Qura Fajr comes first.
    expect(umm.fajr.getTime()).toBeLessThan(mwl.fajr.getTime());
    // MWL Isha (17°) is reached before a fixed 90-minute interval elapses.
    expect(mwl.isha.getTime()).toBeLessThan(umm.isha.getTime());
    // Isha: 17° vs a fixed 90 minutes after Maghrib.
    expect(umm.isha.getTime()).toBeCloseTo(umm.maghrib.getTime() + 90 * 60_000, -3);
  });

  it('moves Asr later under the Hanafi madhab', () => {
    const day = localDate(2026, 3, 21);
    const shafi = computePrayerTimes(MAKKAH, day, settings({ madhab: 'shafi' }));
    const hanafi = computePrayerTimes(MAKKAH, day, settings({ madhab: 'hanafi' }));
    expect(hanafi.asr.getTime()).toBeGreaterThan(shafi.asr.getTime());
  });

  it('applies manual adjustments in whole minutes', () => {
    const day = localDate(2026, 3, 21);
    const base = computePrayerTimes(MAKKAH, day, settings());
    const adjusted = computePrayerTimes(
      MAKKAH,
      day,
      settings({ adjustments: { ...DEFAULT_PRAYER_SETTINGS.adjustments, fajr: 5, isha: -10 } }),
    );
    expect(adjusted.fajr.getTime() - base.fajr.getTime()).toBe(5 * 60_000);
    expect(adjusted.isha.getTime() - base.isha.getTime()).toBe(-10 * 60_000);
    // Untouched prayers must not move.
    expect(adjusted.dhuhr.getTime()).toBe(base.dhuhr.getTime());
  });

  it('supports every exposed calculation method without throwing', () => {
    const methods = [
      'MuslimWorldLeague', 'Egyptian', 'Karachi', 'UmmAlQura', 'Dubai',
      'MoonsightingCommittee', 'NorthAmerica', 'Kuwait', 'Qatar', 'Singapore',
      'Tehran', 'Turkey',
    ] as const;
    for (const method of methods) {
      const times = computePrayerTimes(LONDON, localDate(2026, 6, 1), settings({ method }));
      expect(Number.isNaN(times.fajr.getTime())).toBe(false);
      expect(times.fajr.getTime()).toBeLessThan(times.isha.getTime());
    }
  });
});

describe('buildCalculationParameters', () => {
  it('maps the madhab onto the adhan library value', () => {
    expect(buildCalculationParameters(settings({ madhab: 'hanafi' })).madhab).toBe('hanafi');
    expect(buildCalculationParameters(settings({ madhab: 'shafi' })).madhab).toBe('shafi');
  });

  it('maps the high-latitude rule', () => {
    expect(
      buildCalculationParameters(settings({ highLatitudeRule: 'seventhofthenight' })).highLatitudeRule,
    ).toBe('seventhofthenight');
    expect(
      buildCalculationParameters(settings({ highLatitudeRule: 'twilightangle' })).highLatitudeRule,
    ).toBe('twilightangle');
    expect(
      buildCalculationParameters(settings({ highLatitudeRule: 'middleofthenight' })).highLatitudeRule,
    ).toBe('middleofthenight');
  });

  it('clamps non-finite adjustments to zero rather than corrupting the time', () => {
    const params = buildCalculationParameters(
      settings({
        adjustments: {
          fajr: Number.NaN,
          sunrise: 0,
          dhuhr: 0,
          asr: 0,
          maghrib: 0,
          isha: 0,
        },
      }),
    );
    expect(params.adjustments.fajr).toBe(0);
  });
});

describe('prayerEntries', () => {
  it('returns all six times sorted chronologically', () => {
    const times = computePrayerTimes(MAKKAH, localDate(2026, 3, 21), settings());
    const entries = prayerEntries(times);
    expect(entries).toHaveLength(6);
    for (let i = 1; i < entries.length; i += 1) {
      expect(entries[i].time.getTime()).toBeGreaterThanOrEqual(entries[i - 1].time.getTime());
    }
  });
});

describe('getNextPrayer', () => {
  it('finds the upcoming prayer during the day', () => {
    const times = computePrayerTimes(MAKKAH, localDate(2026, 3, 21), settings());
    // One minute after Dhuhr, the next prayer is Asr.
    const now = new Date(times.dhuhr.getTime() + 60_000);
    const next = getNextPrayer(MAKKAH, settings(), now);
    expect(next.key).toBe('asr');
    expect(next.previousKey).toBe('dhuhr');
    expect(next.isTomorrow).toBe(false);
    expect(next.msUntil).toBeGreaterThan(0);
    expect(next.msUntil).toBeLessThan(12 * 3600_000);
  });

  it('rolls over to the next Fajr after Isha', () => {
    const times = computePrayerTimes(MAKKAH, localDate(2026, 3, 21), settings());
    const now = new Date(times.isha.getTime() + 30 * 60_000);
    const next = getNextPrayer(MAKKAH, settings(), now);
    expect(next.key).toBe('fajr');
    expect(next.previousKey).toBe('isha');
    expect(next.isTomorrow).toBe(true);
    expect(next.time.getTime()).toBeGreaterThan(times.isha.getTime());
    // Fajr to Fajr is roughly a day.
    expect(next.msUntil).toBeGreaterThan(6 * 3600_000);
    expect(next.msUntil).toBeLessThan(18 * 3600_000);
  });

  it('reports sunrise (not a prayer) as the next event before Dhuhr', () => {
    const times = computePrayerTimes(MAKKAH, localDate(2026, 3, 21), settings());
    const now = new Date(times.fajr.getTime() + 10 * 60_000);
    const next = getNextPrayer(MAKKAH, settings(), now);
    expect(next.key).toBe('sunrise');
  });

  it('reports progress between 0 and 1 through the interval', () => {
    const times = computePrayerTimes(MAKKAH, localDate(2026, 3, 21), settings());
    const half = new Date((times.dhuhr.getTime() + times.asr.getTime()) / 2);
    const next = getNextPrayer(MAKKAH, settings(), half);
    expect(next.progress).toBeGreaterThan(0.45);
    expect(next.progress).toBeLessThan(0.55);
  });

  it('handles a day before the first prayer', () => {
    const times = computePrayerTimes(MAKKAH, localDate(2026, 3, 21), settings());
    const now = new Date(times.fajr.getTime() - 60_000);
    const next = getNextPrayer(MAKKAH, settings(), now);
    expect(next.key).toBe('fajr');
    expect(next.previousKey).toBeNull();
    expect(next.progress).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('formats minutes and seconds', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(59_000)).toBe('00:59');
    expect(formatCountdown(60_000)).toBe('01:00');
    expect(formatCountdown(9 * 60_000 + 5_000)).toBe('09:05');
  });

  it('switches to h:mm:ss past an hour', () => {
    expect(formatCountdown(3600_000)).toBe('1:00:00');
    expect(formatCountdown(2 * 3600_000 + 14 * 60_000 + 3_000)).toBe('2:14:03');
  });

  it('never returns a negative countdown', () => {
    expect(formatCountdown(-5000)).toBe('00:00');
  });
});
