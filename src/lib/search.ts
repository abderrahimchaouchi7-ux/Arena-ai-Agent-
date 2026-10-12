/**
 * Unified search across Quran, Du'a, Adhkar and Hadith.
 *
 * Quran search runs against the *unvowelled* Arabic text (`simple-clean`) so a
 * user typing without diacritics still matches, plus the active translation.
 * Everything is local — there is no search API.
 */
import {
  quranMeta,
  quranSimple,
  adhkarCategories,
  morningEveningItems,
} from './data';
import type { AdhkarCategory, MorningEveningItem } from './types';

/** Strips Arabic diacritics, tatweel and normalises alif/ya forms. */
export function normaliseArabic(input: string): string {
  return input
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normaliseQuery(query: string): string {
  return query.trim().toLowerCase();
}

export interface VerseHit {
  surah: number;
  ayah: number;
  arabic: string;
  matchedTranslation?: string;
}

export interface QuranSearchResult {
  hits: VerseHit[];
  truncated: boolean;
  scanned: number;
}

/**
 * Searches every verse. `translationMap` is optional (translations load lazily).
 * Capped at `limit` so a one-letter query cannot build a 6,236-row list.
 */
export function searchQuran(
  query: string,
  translationMap: Record<string, string[]> | null,
  limit = 200,
): QuranSearchResult {
  const raw = normaliseQuery(query);
  if (raw.length < 2) return { hits: [], truncated: false, scanned: 0 };

  const needleAr = normaliseArabic(query);
  const needleLatin = raw;
  const hits: VerseHit[] = [];
  let scanned = 0;

  for (const chapter of quranMeta.chapters) {
    const simple = quranSimple[String(chapter.id)] ?? [];
    const translated = translationMap?.[String(chapter.id)];
    for (let i = 0; i < simple.length; i += 1) {
      scanned += 1;
      const arabic = simple[i] ?? '';
      const matchedArabic = needleAr.length >= 2 && normaliseArabic(arabic).includes(needleAr);
      const translationText = translated?.[i];
      const matchedTranslation =
        !matchedArabic && translationText && translationText.toLowerCase().includes(needleLatin)
          ? translationText
          : undefined;

      if (matchedArabic || matchedTranslation) {
        hits.push({
          surah: chapter.id,
          ayah: i + 1,
          arabic,
          matchedTranslation,
        });
        if (hits.length >= limit) return { hits, truncated: true, scanned };
      }
    }
  }

  return { hits, truncated: false, scanned };
}

export interface AdhkarHit {
  itemId: string;
  categoryId: number;
  categoryTitle: string;
  arabic: string;
  english: string | null;
  source: string;
  kind: 'hisn' | 'morning-evening';
}

export function searchAdhkar(query: string, limit = 60): AdhkarHit[] {
  const raw = normaliseQuery(query);
  if (raw.length < 2) return [];
  const needleAr = normaliseArabic(query);
  const out: AdhkarHit[] = [];

  const push = (
    kind: 'hisn' | 'morning-evening',
    itemId: string,
    categoryId: number,
    categoryTitle: string,
    arabic: string,
    english: string | null,
    source: string,
  ) => {
    const hit =
      normaliseArabic(arabic).includes(needleAr) ||
      (english ?? '').toLowerCase().includes(raw);
    if (hit) out.push({ itemId, categoryId, categoryTitle, arabic, english, source, kind });
  };

  for (const category of adhkarCategories as AdhkarCategory[]) {
    for (const item of category.items) {
      push(
        'hisn',
        item.id,
        category.id,
        category.englishTitle ?? category.arabicTitle,
        item.arabic,
        item.english,
        category.reference,
      );
      if (out.length >= limit) return out;
    }
  }

  for (const item of morningEveningItems as MorningEveningItem[]) {
    push(
      'morning-evening',
      item.id,
      0,
      item.period === 'morning' ? 'Morning Adhkar' : 'Evening Adhkar',
      item.arabic,
      item.english,
      item.source ?? 'Morning & Evening Adhkar Database',
    );
    if (out.length >= limit) return out;
  }

  return out;
}

export interface HadithHit {
  id: string;
  collectionId: string;
  collectionName: string;
  numberLabel: string;
  arabic: string;
  english: string;
  narrator: string;
}

/**
 * Searches already-loaded hadith packs. Packs load per collection, so the
 * Hadith page passes in whatever it has in memory; the global search page loads
 * all six (about 3 MB, cached by the service worker).
 */
export function searchHadithInPacks(
  packs: { collectionId: string; collectionName: string; hadiths: {
    id: string;
    numberLabel: string;
    arabic: string;
    english: string;
    narrator: string;
  }[] }[],
  query: string,
  limit = 60,
): HadithHit[] {
  const raw = normaliseQuery(query);
  if (raw.length < 2) return [];
  const needleAr = normaliseArabic(query);
  const out: HadithHit[] = [];
  const numeric = Number.parseInt(raw, 10);

  for (const pack of packs) {
    for (const hadith of pack.hadiths) {
      const byNumber =
        Number.isFinite(numeric) && raw.length >= 1 && hadith.numberLabel.includes(raw);
      const byArabic = normaliseArabic(hadith.arabic).includes(needleAr);
      const byEnglish = hadith.english.toLowerCase().includes(raw);
      const byNarrator = hadith.narrator.toLowerCase().includes(raw);
      if (byNumber || byArabic || byEnglish || byNarrator) {
        out.push({
          id: hadith.id,
          collectionId: pack.collectionId,
          collectionName: pack.collectionName,
          numberLabel: hadith.numberLabel,
          arabic: hadith.arabic,
          english: hadith.english,
          narrator: hadith.narrator,
        });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

export interface CityOption {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/**
 * A static list of major cities for the manual picker, so the app never needs a
 * geocoding API key and works offline. For anything else the user can enter
 * coordinates directly in Settings.
 */
export const CITY_LIST: CityOption[] = [
  { name: 'Makkah', country: 'SA', latitude: 21.4225, longitude: 39.8262, timezone: 'Asia/Riyadh' },
  { name: 'Madinah', country: 'SA', latitude: 24.4686, longitude: 39.6142, timezone: 'Asia/Riyadh' },
  { name: 'Jerusalem', country: 'PS', latitude: 31.7683, longitude: 35.2137, timezone: 'Asia/Jerusalem' },
  { name: 'Cairo', country: 'EG', latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo' },
  { name: 'Alexandria', country: 'EG', latitude: 31.2001, longitude: 29.9187, timezone: 'Africa/Cairo' },
  { name: 'Casablanca', country: 'MA', latitude: 33.5731, longitude: -7.5898, timezone: 'Africa/Casablanca' },
  { name: 'Rabat', country: 'MA', latitude: 34.0209, longitude: -6.8416, timezone: 'Africa/Casablanca' },
  { name: 'Algiers', country: 'DZ', latitude: 36.7538, longitude: 3.0588, timezone: 'Africa/Algiers' },
  { name: 'Tunis', country: 'TN', latitude: 36.8065, longitude: 10.1815, timezone: 'Africa/Tunis' },
  { name: 'Tripoli', country: 'LY', latitude: 32.8872, longitude: 13.1913, timezone: 'Africa/Tripoli' },
  { name: 'Khartoum', country: 'SD', latitude: 15.5007, longitude: 32.5599, timezone: 'Africa/Khartoum' },
  { name: 'Dakar', country: 'SN', latitude: 14.7167, longitude: -17.4677, timezone: 'Africa/Dakar' },
  { name: 'Bamako', country: 'ML', latitude: 12.6392, longitude: -8.0029, timezone: 'Africa/Bamako' },
  { name: 'Abidjan', country: 'CI', latitude: 5.36, longitude: -4.0083, timezone: 'Africa/Abidjan' },
  { name: 'Lagos', country: 'NG', latitude: 6.5244, longitude: 3.3792, timezone: 'Africa/Lagos' },
  { name: 'Kano', country: 'NG', latitude: 12.0022, longitude: 8.592, timezone: 'Africa/Lagos' },
  { name: 'Nairobi', country: 'KE', latitude: -1.2921, longitude: 36.8219, timezone: 'Africa/Nairobi' },
  { name: 'Mogadishu', country: 'SO', latitude: 2.0469, longitude: 45.3182, timezone: 'Africa/Mogadishu' },
  { name: 'Djibouti', country: 'DJ', latitude: 11.5721, longitude: 43.1456, timezone: 'Africa/Djibouti' },
  { name: 'Nouakchott', country: 'MR', latitude: 18.0735, longitude: -15.9582, timezone: 'Africa/Nouakchott' },
  { name: 'Amman', country: 'JO', latitude: 31.9454, longitude: 35.9284, timezone: 'Asia/Amman' },
  { name: 'Damascus', country: 'SY', latitude: 33.5138, longitude: 36.2765, timezone: 'Asia/Damascus' },
  { name: 'Beirut', country: 'LB', latitude: 33.8938, longitude: 35.5018, timezone: 'Asia/Beirut' },
  { name: 'Baghdad', country: 'IQ', latitude: 33.3152, longitude: 44.3661, timezone: 'Asia/Baghdad' },
  { name: 'Kuwait City', country: 'KW', latitude: 29.3759, longitude: 47.9774, timezone: 'Asia/Kuwait' },
  { name: 'Doha', country: 'QA', latitude: 25.2854, longitude: 51.531, timezone: 'Asia/Qatar' },
  { name: 'Manama', country: 'BH', latitude: 26.2285, longitude: 50.586, timezone: 'Asia/Bahrain' },
  { name: 'Abu Dhabi', country: 'AE', latitude: 24.4539, longitude: 54.3773, timezone: 'Asia/Dubai' },
  { name: 'Dubai', country: 'AE', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
  { name: 'Riyadh', country: 'SA', latitude: 24.7136, longitude: 46.6753, timezone: 'Asia/Riyadh' },
  { name: 'Jeddah', country: 'SA', latitude: 21.4858, longitude: 39.1925, timezone: 'Asia/Riyadh' },
  { name: 'Muscat', country: 'OM', latitude: 23.588, longitude: 58.3829, timezone: 'Asia/Muscat' },
  { name: "Sana'a", country: 'YE', latitude: 15.3694, longitude: 44.191, timezone: 'Asia/Aden' },
  { name: 'Tehran', country: 'IR', latitude: 35.6892, longitude: 51.389, timezone: 'Asia/Tehran' },
  { name: 'Ankara', country: 'TR', latitude: 39.9334, longitude: 32.8597, timezone: 'Europe/Istanbul' },
  { name: 'Istanbul', country: 'TR', latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul' },
  { name: 'Baku', country: 'AZ', latitude: 40.4093, longitude: 49.8671, timezone: 'Asia/Baku' },
  { name: 'Kabul', country: 'AF', latitude: 34.5553, longitude: 69.2075, timezone: 'Asia/Kabul' },
  { name: 'Islamabad', country: 'PK', latitude: 33.6844, longitude: 73.0479, timezone: 'Asia/Karachi' },
  { name: 'Karachi', country: 'PK', latitude: 24.8607, longitude: 67.0011, timezone: 'Asia/Karachi' },
  { name: 'Lahore', country: 'PK', latitude: 31.5204, longitude: 74.3587, timezone: 'Asia/Karachi' },
  { name: 'New Delhi', country: 'IN', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' },
  { name: 'Mumbai', country: 'IN', latitude: 19.076, longitude: 72.8777, timezone: 'Asia/Kolkata' },
  { name: 'Hyderabad', country: 'IN', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata' },
  { name: 'Dhaka', country: 'BD', latitude: 23.8103, longitude: 90.4125, timezone: 'Asia/Dhaka' },
  { name: 'Jakarta', country: 'ID', latitude: -6.2088, longitude: 106.8456, timezone: 'Asia/Jakarta' },
  { name: 'Kuala Lumpur', country: 'MY', latitude: 3.139, longitude: 101.6869, timezone: 'Asia/Kuala_Lumpur' },
  { name: 'Brunei', country: 'BN', latitude: 4.9031, longitude: 114.9398, timezone: 'Asia/Brunei' },
  { name: 'Tashkent', country: 'UZ', latitude: 41.2995, longitude: 69.2401, timezone: 'Asia/Tashkent' },
  { name: 'Almaty', country: 'KZ', latitude: 43.222, longitude: 76.8512, timezone: 'Asia/Almaty' },
  { name: 'Paris', country: 'FR', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' },
  { name: 'Marseille', country: 'FR', latitude: 43.2965, longitude: 5.3698, timezone: 'Europe/Paris' },
  { name: 'Lyon', country: 'FR', latitude: 45.764, longitude: 4.8357, timezone: 'Europe/Paris' },
  { name: 'Strasbourg', country: 'FR', latitude: 48.5734, longitude: 7.7521, timezone: 'Europe/Paris' },
  { name: 'Brussels', country: 'BE', latitude: 50.8503, longitude: 4.3517, timezone: 'Europe/Brussels' },
  { name: 'London', country: 'GB', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London' },
  { name: 'Birmingham', country: 'GB', latitude: 52.4862, longitude: -1.8904, timezone: 'Europe/London' },
  { name: 'Manchester', country: 'GB', latitude: 53.4808, longitude: -2.2426, timezone: 'Europe/London' },
  { name: 'Berlin', country: 'DE', latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin' },
  { name: 'Cologne', country: 'DE', latitude: 50.9375, longitude: 6.9603, timezone: 'Europe/Berlin' },
  { name: 'Amsterdam', country: 'NL', latitude: 52.3676, longitude: 4.9041, timezone: 'Europe/Amsterdam' },
  { name: 'Rotterdam', country: 'NL', latitude: 51.9244, longitude: 4.4777, timezone: 'Europe/Amsterdam' },
  { name: 'Madrid', country: 'ES', latitude: 40.4168, longitude: -3.7038, timezone: 'Europe/Madrid' },
  { name: 'Rome', country: 'IT', latitude: 41.9028, longitude: 12.4964, timezone: 'Europe/Rome' },
  { name: 'Vienna', country: 'AT', latitude: 48.2082, longitude: 16.3738, timezone: 'Europe/Vienna' },
  { name: 'Zurich', country: 'CH', latitude: 47.3769, longitude: 8.5417, timezone: 'Europe/Zurich' },
  { name: 'Stockholm', country: 'SE', latitude: 59.3293, longitude: 18.0686, timezone: 'Europe/Stockholm' },
  { name: 'Oslo', country: 'NO', latitude: 59.9139, longitude: 10.7522, timezone: 'Europe/Oslo' },
  { name: 'Copenhagen', country: 'DK', latitude: 55.6761, longitude: 12.5683, timezone: 'Europe/Copenhagen' },
  { name: 'Helsinki', country: 'FI', latitude: 60.1699, longitude: 24.9384, timezone: 'Europe/Helsinki' },
  { name: 'Warsaw', country: 'PL', latitude: 52.2297, longitude: 21.0122, timezone: 'Europe/Warsaw' },
  { name: 'Athens', country: 'GR', latitude: 37.9838, longitude: 23.7275, timezone: 'Europe/Athens' },
  { name: 'Sarajevo', country: 'BA', latitude: 43.8563, longitude: 18.4131, timezone: 'Europe/Sarajevo' },
  { name: 'Tirana', country: 'AL', latitude: 41.3275, longitude: 19.8187, timezone: 'Europe/Tirane' },
  { name: 'Moscow', country: 'RU', latitude: 55.7558, longitude: 37.6173, timezone: 'Europe/Moscow' },
  { name: 'Toronto', country: 'CA', latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto' },
  { name: 'Montreal', country: 'CA', latitude: 45.5017, longitude: -73.5673, timezone: 'America/Toronto' },
  { name: 'New York', country: 'US', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
  { name: 'Chicago', country: 'US', latitude: 41.8781, longitude: -87.6298, timezone: 'America/Chicago' },
  { name: 'Houston', country: 'US', latitude: 29.7604, longitude: -95.3698, timezone: 'America/Chicago' },
  { name: 'Los Angeles', country: 'US', latitude: 34.0522, longitude: -118.2437, timezone: 'America/Los_Angeles' },
  { name: 'Dearborn', country: 'US', latitude: 42.3223, longitude: -83.1763, timezone: 'America/Detroit' },
  { name: 'Mexico City', country: 'MX', latitude: 19.4326, longitude: -99.1332, timezone: 'America/Mexico_City' },
  { name: 'São Paulo', country: 'BR', latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo' },
  { name: 'Buenos Aires', country: 'AR', latitude: -34.6037, longitude: -58.3816, timezone: 'America/Argentina/Buenos_Aires' },
  { name: 'Sydney', country: 'AU', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
  { name: 'Melbourne', country: 'AU', latitude: -37.8136, longitude: 144.9631, timezone: 'Australia/Melbourne' },
  { name: 'Auckland', country: 'NZ', latitude: -36.8485, longitude: 174.7633, timezone: 'Pacific/Auckland' },
  { name: 'Tokyo', country: 'JP', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo' },
  { name: 'Beijing', country: 'CN', latitude: 39.9042, longitude: 116.4074, timezone: 'Asia/Shanghai' },
  { name: 'Singapore', country: 'SG', latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore' },
];

export function searchCities(query: string, limit = 12): CityOption[] {
  const raw = normaliseQuery(query);
  if (!raw) return CITY_LIST.slice(0, limit);
  return CITY_LIST.filter(
    (c) => c.name.toLowerCase().includes(raw) || c.country.toLowerCase().includes(raw),
  ).slice(0, limit);
}
