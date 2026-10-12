/**
 * Data access layer.
 *
 * The Quran, Adhkar and Hadith JSON are bundled with the app (see
 * `scripts/build-data.mjs`), so every read here is a local, synchronous or
 * lazily-imported lookup — no network, no API key, works offline.
 *
 * Heavy files (translations, per-collection hadith) are dynamically imported so
 * the initial bundle stays small; the browser caches the chunk afterwards.
 */
import quranMetaRaw from '@/data/generated/quran-meta.json';
import quranUthmaniRaw from '@/data/generated/quran-uthmani.json';
import quranSimpleRaw from '@/data/generated/quran-simple.json';
import adhkarRaw from '@/data/generated/adhkar.json';
import morningEveningRaw from '@/data/generated/adhkar-morning-evening.json';
import hadithIndexRaw from '@/data/generated/hadith-index.json';
import sourcesRaw from '@/data/generated/sources.json';
import type {
  AdhkarCategory,
  ChapterMeta,
  HadithCollectionSummary,
  HadithPack,
  MorningEveningItem,
  QuranMeta,
  VerseMap,
} from './types';

export const quranMeta = quranMetaRaw as unknown as QuranMeta;
export const quranUthmani = quranUthmaniRaw as unknown as VerseMap;
export const quranSimple = quranSimpleRaw as unknown as VerseMap;
export const adhkarCategories = (adhkarRaw as unknown as { categories: AdhkarCategory[] }).categories;
export const morningEveningItems = (
  morningEveningRaw as unknown as { items: MorningEveningItem[] }
).items;
export const hadithCollections = (hadithIndexRaw as unknown as { collections: HadithCollectionSummary[] })
  .collections;
export const hadithGradingNote = (hadithIndexRaw as unknown as { note: string }).note;
export const dataSources = sourcesRaw as unknown as Record<string, unknown>;

export const TOTAL_VERSES = quranMeta.chapters.reduce((sum, c) => sum + c.verses, 0);

export function getChapter(surah: number): ChapterMeta | undefined {
  return quranMeta.chapters.find((c) => c.id === surah);
}

export function chapterVerses(surah: number): string[] {
  return quranUthmani[String(surah)] ?? [];
}

export function chapterSimple(surah: number): string[] {
  return quranSimple[String(surah)] ?? [];
}

export type TranslationId = 'en' | 'fr';

const translationCache = new Map<TranslationId, VerseMap>();

/** Translations are ~1 MB each, so they load on demand and then stay cached. */
export async function loadTranslation(id: TranslationId): Promise<VerseMap> {
  const cached = translationCache.get(id);
  if (cached) return cached;
  const mod =
    id === 'fr'
      ? await import('@/data/generated/quran-fr.json')
      : await import('@/data/generated/quran-en.json');
  const map = (mod.default ?? mod) as unknown as VerseMap;
  translationCache.set(id, map);
  return map;
}

export function getTranslationSync(id: TranslationId): VerseMap | null {
  return translationCache.get(id) ?? null;
}

/** Juz / page / hizb an ayah falls into, from the Tanzil index. */
export function ayahIndexes(surah: number, ayah: number) {
  const beforeOrAt = (list: { index: number; sura: number; aya: number }[]) => {
    let found = list[0];
    for (const entry of list) {
      const entryPos = entry.sura * 10000 + entry.aya;
      const targetPos = surah * 10000 + ayah;
      if (entryPos <= targetPos) found = entry;
      else break;
    }
    return found;
  };
  const juz = beforeOrAt(quranMeta.juz);
  const hizb = beforeOrAt(quranMeta.hizb);
  const page = beforeOrAt(quranMeta.pages);
  const sajda = quranMeta.sajda.find((s) => s.sura === surah && s.aya === ayah) ?? null;
  return { juz: juz.index, hizb: hizb.index, page: page.index, sajda };
}

/** First ayah of a juz — used by the juz browser and "go to juz". */
export function juzStart(juz: number) {
  const entry = quranMeta.juz.find((j) => j.index === juz);
  return entry ? { surah: entry.sura, ayah: entry.aya } : null;
}

export function pageStart(page: number) {
  const entry = quranMeta.pages.find((p) => p.index === page);
  return entry ? { surah: entry.sura, ayah: entry.aya } : null;
}

/* ----------------------------------------------------------------- Adhkar -- */

export function getAdhkarCategory(id: number): AdhkarCategory | undefined {
  return adhkarCategories.find((c) => c.id === id);
}

/** Maps Hisn al-Muslim chapter ids onto the app's user-facing groups. */
export const ADHKAR_GROUPS: {
  id: string;
  key: string;
  /** Hisn al-Muslim chapter titles (English) that belong to this group. */
  match: RegExp;
}[] = [
  { id: 'morning', key: 'adhkar.morning', match: /morning and evening|الصباح والمساء/i },
  { id: 'sleeping', key: 'adhkar.sleeping', match: /sleep|النوم/i },
  { id: 'waking', key: 'adhkar.waking', match: /waking|الاستيقاظ/i },
  { id: 'afterPrayer', key: 'adhkar.afterPrayer', match: /after.*prayer|following the (obligatory|prescribed)|بعد الصلاة|أذكار المساء/i },
  { id: 'mosque', key: 'adhkar.mosque', match: /mosque|المسجد|adhan|الآذان|أذان/i },
  { id: 'home', key: 'adhkar.home', match: /home|house|المنزل|البيت/i },
  { id: 'travel', key: 'adhkar.travel', match: /travel|journey|السفر/i },
  { id: 'food', key: 'adhkar.food', match: /food|drink|eat|الطعام|الشراب|الأكل/i },
  { id: 'protection', key: 'adhkar.protection', match: /protection|forgiv|distress|refuge|الاستعاذة|الاستغفار|الكرب/i },
];

export function adhkarGroupOf(category: AdhkarCategory): string | null {
  const haystack = `${category.englishTitle ?? ''} ${category.arabicTitle}`;
  for (const group of ADHKAR_GROUPS) {
    if (group.match.test(haystack)) return group.id;
  }
  return null;
}

export function adhkarItemsByGroup(groupId: string) {
  return adhkarCategories
    .filter((c) => adhkarGroupOf(c) === groupId)
    .flatMap((c) => c.items.map((item) => ({ ...item, category: c })));
}

/* ----------------------------------------------------------------- Hadith -- */

const hadithCache = new Map<string, HadithPack>();

export async function loadHadithPack(collectionId: string): Promise<HadithPack | null> {
  const cached = hadithCache.get(collectionId);
  if (cached) return cached;
  try {
    const mod = await import(`../data/generated/hadith-${collectionId}.json`);
    const pack = (mod.default ?? mod) as unknown as HadithPack;
    hadithCache.set(collectionId, pack);
    return pack;
  } catch {
    return null;
  }
}

export function hadithSummary(collectionId: string): HadithCollectionSummary | undefined {
  return hadithCollections.find((c) => c.id === collectionId);
}

/* ------------------------------------------------------------- Daily picks -- */

/**
 * Deterministic "of the day" selection: seeded by the Hijri day so the pick is
 * stable all day and rotates over the year, and never random (which would
 * change on every render and feel arbitrary).
 */
export function daySeed(date: Date = new Date(), hijriOffset = 0): number {
  const shifted = new Date(date.getTime() + hijriOffset * 86400000);
  const start = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate()).getTime();
  return Math.floor(start / 86400000);
}

export function pickDaily<T>(items: T[], seed: number): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.abs(seed) % items.length];
}

/** Curated list of verses used for "verse of the day" — all short and complete. */
export const DAILY_VERSE_POOL: { surah: number; ayah: number }[] = [
  { surah: 2, ayah: 255 },
  { surah: 2, ayah: 286 },
  { surah: 3, ayah: 139 },
  { surah: 13, ayah: 28 },
  { surah: 14, ayah: 7 },
  { surah: 65, ayah: 2 },
  { surah: 94, ayah: 5 },
  { surah: 94, ayah: 6 },
  { surah: 2, ayah: 152 },
  { surah: 2, ayah: 186 },
  { surah: 3, ayah: 159 },
  { surah: 29, ayah: 69 },
  { surah: 39, ayah: 53 },
  { surah: 6, ayah: 162 },
  { surah: 11, ayah: 123 },
  { surah: 20, ayah: 114 },
  { surah: 17, ayah: 80 },
  { surah: 25, ayah: 74 },
  { surah: 23, ayah: 115 },
  { surah: 51, ayah: 56 },
  { surah: 99, ayah: 7 },
  { surah: 99, ayah: 8 },
  { surah: 112, ayah: 1 },
  { surah: 1, ayah: 5 },
  { surah: 2, ayah: 201 },
  { surah: 3, ayah: 8 },
  { surah: 7, ayah: 180 },
  { surah: 59, ayah: 22 },
  { surah: 55, ayah: 13 },
  { surah: 67, ayah: 2 },
];
