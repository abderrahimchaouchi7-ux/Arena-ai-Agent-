/** Shared domain types. */

export type LanguageId = 'ar' | 'fr' | 'en';

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

/** The five obligatory prayers (sunrise is tracked but is not a prayer). */
export const OBLIGATORY_PRAYERS: PrayerKey[] = [
  'fajr',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
];

export const ALL_PRAYERS: PrayerKey[] = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
];

export type CalculationMethodId =
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'UmmAlQura'
  | 'Dubai'
  | 'MoonsightingCommittee'
  | 'NorthAmerica'
  | 'Kuwait'
  | 'Qatar'
  | 'Singapore'
  | 'Tehran'
  | 'Turkey';

export type MadhabId = 'shafi' | 'hanafi';

export type HighLatitudeRuleId = 'middleofthenight' | 'seventhofthenight' | 'twilightangle';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  /** Human-readable label, e.g. "Makkah, Saudi Arabia". */
  label: string;
  /** ISO country code when known. */
  country?: string;
  /** IANA zone, informational — the browser resolves the real offset. */
  timezone?: string;
  /** true when resolved from the geolocation API rather than picked by hand. */
  automatic: boolean;
  /** Epoch ms of when this location was captured. */
  updatedAt: number;
}

export interface LocationStatus {
  state: 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable' | 'error';
  message?: string;
}

export type NotificationStyle = 'adhan' | 'tone' | 'silent' | 'off';

export interface PrayerNotificationConfig {
  style: NotificationStyle;
  /** Minutes before the prayer time to fire a reminder (0 = no reminder). */
  reminderMinutes: number;
  /** Play even when the device is in silent/do-not-disturb, where the OS allows it. */
  bypassSilent: boolean;
}

export interface QuranBookmark {
  surah: number;
  ayah: number;
  label?: string;
  createdAt: number;
}

export interface ContentBookmark {
  /** Namespaced so Quran / dua / adhkar / hadith never collide. */
  id: string;
  kind: 'ayah' | 'dua' | 'adhkar' | 'hadith';
  title: string;
  excerpt: string;
  createdAt: number;
}

export interface RecentlyViewed {
  id: string;
  kind: 'surah' | 'ayah' | 'dua' | 'adhkar' | 'hadith';
  title: string;
  path: string;
  viewedAt: number;
}

/* ------------------------------------------------------------------ Quran -- */

export interface ChapterMeta {
  id: number;
  name: string;
  transliteration: string;
  translation: string;
  revelation: 'meccan' | 'medinan';
  verses: number;
}

export interface IndexEntry {
  index: number;
  sura: number;
  aya: number;
  type?: string;
}

export interface QuranMeta {
  script: string;
  reading: string;
  verseNumbering: string;
  chapters: ChapterMeta[];
  juz: IndexEntry[];
  hizb: IndexEntry[];
  quarterHizb: IndexEntry[];
  pages: IndexEntry[];
  sajda: IndexEntry[];
}

export type VerseMap = Record<string, string[]>;

/* ----------------------------------------------------------------- Adhkar -- */

export interface AdhkarItem {
  id: string;
  categoryId: number;
  arabic: string;
  english: string | null;
  transliteration: string | null;
  count: number;
}

export interface AdhkarCategory {
  id: number;
  arabicTitle: string;
  englishTitle: string | null;
  reference: string;
  items: AdhkarItem[];
}

export interface MorningEveningItem {
  id: string;
  order: number;
  period: 'morning' | 'evening';
  arabic: string;
  english: string | null;
  count: number;
  countDescription: string | null;
  source: string | null;
  virtue: string | null;
}

/* ----------------------------------------------------------------- Hadith -- */

export interface Hadith {
  id: string;
  number: number;
  numberLabel: string;
  numberRange: number[] | null;
  chapterId: string;
  chapter: { chapterEnglish?: string; chapterArabic?: string } | null;
  headingEnglish: string | null;
  headingArabic: string | null;
  arabic: string;
  english: string;
  narrator: string;
  volume: number | null;
  textRepeatsPrevious: boolean;
}

export interface HadithChapter {
  id: number;
  number: string;
  english: string;
  arabic: string;
}

export interface HadithPack {
  collection: string;
  name: string;
  compiler: string;
  offlinePack: boolean;
  chapters: HadithChapter[];
  hadiths: Hadith[];
}

export interface HadithCollectionSummary {
  id: string;
  name: string;
  compiler: string;
  totalInCollection: number;
  offlineCount: number;
  offlineChapters: number;
  chapters: number;
}

/* ------------------------------------------------------------------ Adhan -- */

export interface AdhanRecording {
  id: string;
  /** Muezzin or mosque attribution. */
  muezzin: string;
  /** Mosque / city where recorded, when known. */
  location?: string;
  /** i18n key holding the provenance / licence note. */
  provenanceKey: string;
  /**
   * Remote URL, resolved against VITE_ADHAN_BASE_URL when relative.
   * `null` means the recording has no configured source and the UI must say so
   * instead of pretending to play something.
   */
  src: string | null;
  /** Set once a real recording is imported by the user and stored in IndexedDB. */
  localKey?: string;
}
