/**
 * Hijri calendar.
 *
 * Uses the platform `Intl` Islamic calendar (Umm al-Qura) rather than a
 * hand-rolled astronomical approximation. The user can still apply an offset of
 * ±2 days, which every serious prayer app exposes because local moon sighting
 * legitimately differs from the tabular calendar.
 *
 * The offset is stored, never silently applied, and the UI states that the
 * date is computed — the authoritative date is the local sighting.
 */

export interface HijriParts {
  day: number;
  month: number; // 1..12
  year: number;
}

const AR_MONTHS = [
  'مُحَرَّم',
  'صَفَر',
  'رَبيع الأوّل',
  'رَبيع الآخِر',
  'جُمادى الأولى',
  'جُمادى الآخرة',
  'رَجَب',
  'شَعبان',
  'رَمَضان',
  'شَوّال',
  'ذو القِعدة',
  'ذو الحِجّة',
];

const EN_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
];

const FR_MONTHS = [
  'Mouharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi ath-Thani',
  'Joumada al-Oula',
  'Joumada ath-Thania',
  'Rajab',
  "Chaabane",
  'Ramadan',
  'Chawwal',
  'Dhou al-Qi`da',
  'Dhou al-Hijja',
];

export function hijriMonthName(month: number, lang: 'ar' | 'fr' | 'en'): string {
  const table = lang === 'ar' ? AR_MONTHS : lang === 'fr' ? FR_MONTHS : EN_MONTHS;
  return table[Math.min(11, Math.max(0, month - 1))];
}

/** Decomposes a Gregorian date (+ day offset) into Hijri parts. */
export function toHijri(date: Date, dayOffset = 0): HijriParts {
  const shifted = dayOffset === 0 ? date : new Date(date.getTime() + dayOffset * 86400000);

  // `islamic-umalqura` is supported by every modern engine (ICU). Fall back to
  // `islamic` (tabular) if a runtime only ships that.
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-u-ca-islamic', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  }

  const parts = formatter.formatToParts(shifted);
  const get = (type: string) => {
    const raw = parts.find((p) => p.type === type)?.value ?? '';
    return Number.parseInt(raw.replace(/\D/g, ''), 10);
  };

  const day = get('day');
  const month = get('month');
  // Intl returns e.g. "1447 AH"; strip the era text.
  const year = get('year');

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    throw new Error(`Unable to resolve a Hijri date for ${shifted.toISOString()}`);
  }

  return { day, month, year };
}

export interface HijriDateParts extends HijriParts {
  /** Localised month name. */
  monthName: string;
  /** "12 Rabi' al-Awwal 1447 AH" */
  formatted: string;
  /** Same string in Arabic numerals-free Latin form, for compact chips. */
  short: string;
  /** True when a user offset was applied. */
  adjusted: boolean;
}

export function formatHijri(
  date: Date,
  lang: 'ar' | 'fr' | 'en',
  dayOffset = 0,
): HijriDateParts {
  const parts = toHijri(date, dayOffset);
  const monthName = hijriMonthName(parts.month, lang);
  const formatted =
    lang === 'ar'
      ? `${parts.day} ${monthName} ${parts.year} هـ`
      : `${parts.day} ${monthName} ${parts.year} AH`;

  return {
    ...parts,
    monthName,
    formatted,
    short: `${parts.day}/${parts.month}/${parts.year}`,
    adjusted: dayOffset !== 0,
  };
}

/** Ramadan / Eid awareness used by the home screen and Adhkar suggestions. */
export function specialDay(hijri: HijriParts): 'ramadan' | 'eid-al-fitr' | 'eid-al-adha' | 'arafah' | 'ashura' | null {
  if (hijri.month === 9) return 'ramadan';
  if (hijri.month === 10 && hijri.day === 1) return 'eid-al-fitr';
  if (hijri.month === 12 && hijri.day === 10) return 'eid-al-adha';
  if (hijri.month === 12 && hijri.day === 9) return 'arafah';
  if (hijri.month === 1 && hijri.day === 10) return 'ashura';
  return null;
}
