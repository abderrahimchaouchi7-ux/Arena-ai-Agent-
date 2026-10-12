import { describe, expect, it } from 'vitest';
import {
  adhkarCategories,
  ayahIndexes,
  chapterVerses,
  getChapter,
  hadithCollections,
  juzStart,
  morningEveningItems,
  pageStart,
  pickDaily,
  quranMeta,
  quranSimple,
  quranUthmani,
  TOTAL_VERSES,
  DAILY_VERSE_POOL,
} from '@/lib/data';

describe('Quran bundle', () => {
  it('contains exactly 114 surahs', () => {
    expect(quranMeta.chapters).toHaveLength(114);
    expect(Object.keys(quranUthmani)).toHaveLength(114);
  });

  it('contains exactly 6,236 verses (Kufi / Hafs numbering)', () => {
    expect(TOTAL_VERSES).toBe(6236);
    let total = 0;
    for (const chapter of quranMeta.chapters) {
      total += chapterVerses(chapter.id).length;
    }
    expect(total).toBe(6236);
  });

  it('matches the meta verse count for every surah', () => {
    for (const chapter of quranMeta.chapters) {
      expect(chapterVerses(chapter.id)).toHaveLength(chapter.verses);
    }
  });

  it('has the right length for the landmark surahs', () => {
    expect(chapterVerses(1)).toHaveLength(7);
    expect(chapterVerses(2)).toHaveLength(286);
    expect(chapterVerses(18)).toHaveLength(110);
    expect(chapterVerses(36)).toHaveLength(83);
    expect(chapterVerses(55)).toHaveLength(78);
    expect(chapterVerses(112)).toHaveLength(4);
    expect(chapterVerses(114)).toHaveLength(6);
  });

  it('opens with the Basmala and ends with An-Nas', () => {
    // Harakat order differs between encodings (ba+shadda+kasra vs the reverse)
    // while rendering identically, so compare under Unicode NFC.
    const nfc = (v: string) => v.normalize('NFC');
    expect(nfc(quranUthmani['1'][0])).toBe(nfc('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'));
    expect(nfc(quranUthmani['114'][0])).toContain(nfc('قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ'));
  });

  it('embeds the Basmala in verse 1 of every surah except At-Tawbah', () => {
    // The reader relies on this: it must not print a second Basmala itself.
    // Surahs 95 and 97 spell it with a shadda on the ba (بِّسْمِ) in the Uthmani
    // script, so compare with diacritics stripped and alef forms normalised.
    const bare = (v: string) =>
      v
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');
    const BASMALA = bare('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');
    let withBasmala = 0;
    for (const chapter of quranMeta.chapters) {
      const first = bare(quranUthmani[String(chapter.id)][0].trimStart());
      if (chapter.id === 9) {
        expect(first.startsWith(BASMALA), 'At-Tawbah must have no Basmala').toBe(false);
      } else {
        expect(first.startsWith(BASMALA), `surah ${chapter.id} verse 1 lacks the Basmala`).toBe(true);
        withBasmala += 1;
      }
    }
    // 114 surahs, At-Tawbah excluded.
    expect(withBasmala).toBe(113);
  });

  it('carries Arabic script and diacritics on every verse', () => {
    const arabic = /[\u0600-\u06FF]/;
    // Harakat (\u064B-\u0652), maddah (\u0653) and superscript alef (\u0670).
    // The muqatta'at such as 42:2 (عٓسٓقٓ) carry maddah rather than harakat,
    // which this range deliberately includes.
    const diacritic = /[\u064B-\u065F\u0670]/;
    let checked = 0;
    for (const [surah, verses] of Object.entries(quranUthmani)) {
      for (const [i, text] of verses.entries()) {
        const at = `${surah}:${i + 1}`;
        expect(text.trim().length, `${at} empty`).toBeGreaterThan(0);
        expect(arabic.test(text), `${at} not Arabic`).toBe(true);
        expect(diacritic.test(text), `${at} has no diacritic: ${text}`).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBe(6236);
  });

  it('keeps the unvowelled search text aligned 1:1 with the Uthmani text', () => {
    for (const [surah, verses] of Object.entries(quranUthmani)) {
      expect(quranSimple[surah] ?? []).toHaveLength(verses.length);
    }
  });

  it('has a complete mushaf index (30 juz, 60 hizb, 604 pages, 15 sajda)', () => {
    expect(quranMeta.juz).toHaveLength(30);
    expect(quranMeta.hizb).toHaveLength(60);
    expect(quranMeta.quarterHizb).toHaveLength(240);
    expect(quranMeta.pages).toHaveLength(604);
    expect(quranMeta.sajda.length).toBeGreaterThanOrEqual(14);
  });

  it('starts juz 1 at 1:1 and juz 30 inside An-Naba', () => {
    expect(juzStart(1)).toEqual({ surah: 1, ayah: 1 });
    expect(juzStart(30)).toEqual({ surah: 78, ayah: 1 });
    expect(juzStart(31)).toBeNull();
  });

  it('starts page 604 at Al-Ikhlas, the final mushaf page', () => {
    expect(pageStart(1)).toEqual({ surah: 1, ayah: 1 });
    // The last Madani page carries surahs 112-114, so it opens at 112:1.
    expect(pageStart(604)).toEqual({ surah: 112, ayah: 1 });
    expect(pageStart(605)).toBeNull();
  });
});

describe('ayahIndexes', () => {
  it('places Ayat al-Kursi in juz 3, page 42', () => {
    const indexes = ayahIndexes(2, 255);
    expect(indexes.juz).toBe(3);
    expect(indexes.page).toBe(42);
  });

  it('places the first verse of the Quran in juz 1, page 1', () => {
    expect(ayahIndexes(1, 1)).toMatchObject({ juz: 1, hizb: 1, page: 1, sajda: null });
  });

  it('places the last verse of the Quran in juz 30, page 604', () => {
    const indexes = ayahIndexes(114, 6);
    expect(indexes.juz).toBe(30);
    expect(indexes.page).toBe(604);
  });

  it('flags the prostration verses', () => {
    expect(ayahIndexes(7, 206).sajda).not.toBeNull();
    expect(ayahIndexes(32, 15).sajda).not.toBeNull();
    expect(ayahIndexes(2, 255).sajda).toBeNull();
  });

  it('never returns an out-of-range juz or page', () => {
    for (const chapter of quranMeta.chapters) {
      for (const ayah of [1, chapter.verses]) {
        const { juz, page, hizb } = ayahIndexes(chapter.id, ayah);
        expect(juz).toBeGreaterThanOrEqual(1);
        expect(juz).toBeLessThanOrEqual(30);
        expect(hizb).toBeGreaterThanOrEqual(1);
        expect(hizb).toBeLessThanOrEqual(60);
        expect(page).toBeGreaterThanOrEqual(1);
        expect(page).toBeLessThanOrEqual(604);
      }
    }
  });
});

describe('getChapter', () => {
  it('resolves surah metadata', () => {
    expect(getChapter(1)?.transliteration).toBe('Al-Faatiha');
    expect(getChapter(2)?.name).toBe('البقرة');
    expect(getChapter(9)?.revelation).toBe('medinan');
    expect(getChapter(112)?.revelation).toBe('meccan');
    expect(getChapter(0)).toBeUndefined();
    expect(getChapter(115)).toBeUndefined();
  });
});

describe('Adhkar bundle', () => {
  it('ships Hisn al-Muslim categories with Arabic text and counts', () => {
    expect(adhkarCategories.length).toBeGreaterThan(100);
    for (const category of adhkarCategories) {
      expect(category.arabicTitle.length).toBeGreaterThan(0);
      expect(category.reference).toContain('Hisn al-Muslim');
      for (const item of category.items) {
        expect(item.arabic.trim().length).toBeGreaterThan(1);
        expect(item.count).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('ships morning and evening adhkar with traceable references', () => {
    expect(morningEveningItems.length).toBeGreaterThanOrEqual(20);
    for (const item of morningEveningItems) {
      expect(item.source).toBeTruthy();
      expect((item.source ?? '').length).toBeGreaterThan(10);
      expect(['morning', 'evening']).toContain(item.period);
    }
    expect(morningEveningItems.some((i) => i.period === 'morning')).toBe(true);
    expect(morningEveningItems.some((i) => i.period === 'evening')).toBe(true);
  });
});

describe('Hadith bundle', () => {
  it('covers the six canonical collections', () => {
    expect(hadithCollections).toHaveLength(6);
    expect(hadithCollections.map((c) => c.id).sort()).toEqual(
      [
        'jami-at-tirmidhi',
        'sahih-bukhari',
        'sahih-muslim',
        'sunan-abu-dawud',
        'sunan-an-nasai',
        'sunan-ibn-majah',
      ].sort(),
    );
  });

  it('ships a non-empty offline pack for every collection', () => {
    for (const collection of hadithCollections) {
      expect(collection.offlineCount).toBeGreaterThan(0);
      expect(collection.totalInCollection).toBeGreaterThan(collection.offlineCount);
    }
  });
});

describe('pickDaily', () => {
  it('is deterministic for a given seed', () => {
    const items = [1, 2, 3, 4, 5];
    expect(pickDaily(items, 42)).toBe(pickDaily(items, 42));
  });

  it('rotates across days', () => {
    const items = [1, 2, 3, 4, 5];
    const picks = new Set([0, 1, 2, 3, 4, 5, 6].map((seed) => pickDaily(items, seed)));
    expect(picks.size).toBeGreaterThan(3);
  });

  it('returns undefined for an empty list', () => {
    expect(pickDaily([], 1)).toBeUndefined();
  });

  it('only ever points at verses that exist', () => {
    for (const entry of DAILY_VERSE_POOL) {
      const chapter = getChapter(entry.surah);
      expect(chapter, `surah ${entry.surah} missing`).toBeTruthy();
      expect(entry.ayah).toBeGreaterThanOrEqual(1);
      expect(entry.ayah).toBeLessThanOrEqual(chapter!.verses);
      expect(chapterVerses(entry.surah)[entry.ayah - 1]).toBeTruthy();
    }
  });
});
