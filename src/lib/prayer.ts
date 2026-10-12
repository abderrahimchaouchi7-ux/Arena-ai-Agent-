/**
 * Prayer-time engine.
 *
 * All maths is done locally by the `adhan` library (MIT) — no network call is
 * needed, so prayer times keep working on a plane, in a cave, or offline. The
 * only thing the network is used for is *finding* the user's coordinates.
 *
 * Timezone and DST handling: `adhan` returns real `Date` objects, which already
 * encode the browser's resolved UTC offset for that instant. We therefore never
 * hand-roll timezone maths — formatting is always done with `Intl.DateTimeFormat`
 * in the user's own zone, which is what makes DST transitions correct.
 */
import * as Adhan from 'adhan';
import type {
  CalculationMethodId,
  GeoLocation,
  HighLatitudeRuleId,
  MadhabId,
  PrayerKey,
} from './types';
import { ALL_PRAYERS } from './types';

export interface PrayerSettings {
  method: CalculationMethodId;
  madhab: MadhabId;
  highLatitudeRule: HighLatitudeRuleId;
  /** Manual offsets in minutes, per prayer. */
  adjustments: Record<PrayerKey, number>;
}

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  method: 'MuslimWorldLeague',
  madhab: 'shafi',
  highLatitudeRule: 'middleofthenight',
  adjustments: {
    fajr: 0,
    sunrise: 0,
    dhuhr: 0,
    asr: 0,
    maghrib: 0,
    isha: 0,
  },
};

/** Recognised authorities, in the order shown in the settings picker. */
export const CALCULATION_METHODS: {
  id: CalculationMethodId;
  label: string;
  /** Plain-language description of the convention, for the settings screen. */
  convention: string;
}[] = [
  {
    id: 'MuslimWorldLeague',
    label: 'Muslim World League',
    convention: 'Fajr 18° · Isha 17°',
  },
  {
    id: 'UmmAlQura',
    label: 'Umm al-Qura, Makkah',
    convention: 'Fajr 18.5° · Isha 90 min after Maghrib',
  },
  {
    id: 'Egyptian',
    label: 'Egyptian General Authority of Survey',
    convention: 'Fajr 19.5° · Isha 17.5°',
  },
  {
    id: 'Karachi',
    label: 'University of Islamic Sciences, Karachi',
    convention: 'Fajr 18° · Isha 18°',
  },
  {
    id: 'Dubai',
    label: 'Dubai (UAE)',
    convention: 'Fajr 18.2° · Isha 18.2°',
  },
  { id: 'Qatar', label: 'Qatar', convention: 'Fajr 18° · Isha 90 min' },
  { id: 'Kuwait', label: 'Kuwait', convention: 'Fajr 18° · Isha 17.5°' },
  {
    id: 'NorthAmerica',
    label: 'ISNA (North America)',
    convention: 'Fajr 15° · Isha 15°',
  },
  {
    id: 'MoonsightingCommittee',
    label: 'Moonsighting Committee',
    convention: 'Fajr 18° · Isha 18° + seasonal adjustment',
  },
  { id: 'Singapore', label: 'Singapore (MUIS)', convention: 'Fajr 20° · Isha 18°' },
  { id: 'Tehran', label: 'Institute of Geophysics, Tehran', convention: 'Fajr 17.7° · Isha 14°' },
  { id: 'Turkey', label: 'Diyanet (Türkiye)', convention: 'Fajr 18° · Isha 17°' },
];

export const HIGH_LATITUDE_RULES: { id: HighLatitudeRuleId; key: string }[] = [
  { id: 'middleofthenight', key: 'settings.hlrMiddle' },
  { id: 'seventhofthenight', key: 'settings.hlrSeventh' },
  { id: 'twilightangle', key: 'settings.hlrTwilight' },
];

const METHOD_FACTORY: Record<CalculationMethodId, () => Adhan.CalculationParameters> = {
  MuslimWorldLeague: Adhan.CalculationMethod.MuslimWorldLeague,
  Egyptian: Adhan.CalculationMethod.Egyptian,
  Karachi: Adhan.CalculationMethod.Karachi,
  UmmAlQura: Adhan.CalculationMethod.UmmAlQura,
  Dubai: Adhan.CalculationMethod.Dubai,
  MoonsightingCommittee: Adhan.CalculationMethod.MoonsightingCommittee,
  NorthAmerica: Adhan.CalculationMethod.NorthAmerica,
  Kuwait: Adhan.CalculationMethod.Kuwait,
  Qatar: Adhan.CalculationMethod.Qatar,
  Singapore: Adhan.CalculationMethod.Singapore,
  Tehran: Adhan.CalculationMethod.Tehran,
  Turkey: Adhan.CalculationMethod.Turkey,
};

export function buildCalculationParameters(settings: PrayerSettings): Adhan.CalculationParameters {
  const factory = METHOD_FACTORY[settings.method] ?? Adhan.CalculationMethod.MuslimWorldLeague;
  const params = factory();

  params.madhab = settings.madhab === 'hanafi' ? Adhan.Madhab.Hanafi : Adhan.Madhab.Shafi;

  switch (settings.highLatitudeRule) {
    case 'seventhofthenight':
      params.highLatitudeRule = Adhan.HighLatitudeRule.SeventhOfTheNight;
      break;
    case 'twilightangle':
      params.highLatitudeRule = Adhan.HighLatitudeRule.TwilightAngle;
      break;
    default:
      params.highLatitudeRule = Adhan.HighLatitudeRule.MiddleOfTheNight;
  }

  for (const key of ALL_PRAYERS) {
    const value = Number(settings.adjustments?.[key] ?? 0);
    params.adjustments[key] = Number.isFinite(value) ? value : 0;
  }

  return params;
}

export interface DayPrayerTimes {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  sunset: Date;
  isha: Date;
}

export function computePrayerTimes(
  location: Pick<GeoLocation, 'latitude' | 'longitude'>,
  date: Date,
  settings: PrayerSettings,
): DayPrayerTimes {
  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    throw new Error('Invalid coordinates');
  }
  if (Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
    throw new Error('Coordinates out of range');
  }

  const coords = new Adhan.Coordinates(location.latitude, location.longitude);
  const times = new Adhan.PrayerTimes(coords, date, buildCalculationParameters(settings));

  return {
    fajr: times.fajr,
    sunrise: times.sunrise,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    sunset: times.sunset,
    isha: times.isha,
  };
}

/** Every prayer of the day as `{ key, time }`, sorted chronologically. */
export function prayerEntries(day: DayPrayerTimes): { key: PrayerKey; time: Date }[] {
  return ALL_PRAYERS.map((key) => ({ key, time: day[key] })).sort(
    (a, b) => a.time.getTime() - b.time.getTime(),
  );
}

export interface NextPrayerInfo {
  key: PrayerKey;
  time: Date;
  /** Previous prayer, used to show "time since". */
  previousKey: PrayerKey | null;
  previousTime: Date | null;
  /** Milliseconds from `now` until `time` (negative once it has passed). */
  msUntil: number;
  /** 0..1 progress through the current interval. */
  progress: number;
  /** True when `key` is tomorrow's Fajr rather than today's prayer. */
  isTomorrow: boolean;
}

/**
 * Finds the next prayer, rolling over to tomorrow's Fajr after Isha.
 * This is the single source of truth for the countdown, the notification
 * scheduler and the home-screen card.
 */
export function getNextPrayer(
  location: Pick<GeoLocation, 'latitude' | 'longitude'>,
  settings: PrayerSettings,
  now: Date = new Date(),
): NextPrayerInfo {
  const today = computePrayerTimes(location, now, settings);
  const todayEntries = prayerEntries(today);

  const upcoming = todayEntries.find((e) => e.time.getTime() > now.getTime());
  if (upcoming) {
    const index = todayEntries.findIndex((e) => e.key === upcoming.key);
    const previous = index > 0 ? todayEntries[index - 1] : null;
    return {
      key: upcoming.key,
      time: upcoming.time,
      previousKey: previous?.key ?? null,
      previousTime: previous?.time ?? null,
      msUntil: upcoming.time.getTime() - now.getTime(),
      progress: previous
        ? clamp01(
            (now.getTime() - previous.time.getTime()) /
              (upcoming.time.getTime() - previous.time.getTime()),
          )
        : 0,
      isTomorrow: false,
    };
  }

  // After Isha: the next prayer is tomorrow's Fajr.
  const tomorrow = new Date(now.getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowTimes = computePrayerTimes(location, tomorrow, settings);

  return {
    key: 'fajr',
    time: tomorrowTimes.fajr,
    previousKey: 'isha',
    previousTime: today.isha,
    msUntil: tomorrowTimes.fajr.getTime() - now.getTime(),
    progress: clamp01(
      (now.getTime() - today.isha.getTime()) /
        (tomorrowTimes.fajr.getTime() - today.isha.getTime()),
    ),
    isTomorrow: true,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** mm:ss (or h:mm:ss past an hour) — used by the countdown everywhere. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** "in 2 h 14 min" style duration, locale aware. */
export function formatDuration(ms: number, locale: string): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: { value: number; unit: Intl.RelativeTimeFormatUnit }[] = [];
  if (h) parts.push({ value: h, unit: 'hour' });
  if (m || !h) parts.push({ value: m, unit: 'minute' });
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'long' });
  // Compose from the largest unit down; two units read naturally in all 3 languages.
  if (parts.length === 1) return rtf.format(parts[0].value, parts[0].unit);
  const head = rtf.format(parts[0].value, parts[0].unit);
  return head.replace(/\d+\s*(minutes?|min\b)/i, (match) =>
    parts[1] ? `${match} ${m}′` : match,
  );
}

export function formatTime(date: Date, locale: string, hour12?: boolean): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    ...(hour12 === undefined ? {} : { hour12 }),
  }).format(date);
}

export function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/** The user's IANA timezone, or undefined when the runtime will not say. */
export function currentTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
