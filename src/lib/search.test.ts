import { describe, it, expect } from 'vitest';
import {
  normaliseArabic,
  normaliseQuery,
  searchQuran,
  searchAdhkar,
  searchHadithInPacks,
  searchCities,
  CITY_LIST,
} from './search';
import { quranSimple, quranMeta } from './data';

describe('normaliseArabic', () => {
  it('strips harakat, tatweel and Quranic marks', () => {
    // Al-Fatihah 1:1 with and without vocalisation must collapse to one form.
    const vowelled = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
    const plain = 'بسم الله الرحمن الرحيم';
    expect(normaliseArabic(vowelled)).toBe(normaliseArabic(plain));
  });

  it('unifies alef, ya, waw and ta marbuta variants', () => {
    expect(normaliseArabic('أإآٱ')).toBe('اااا');
    expect(normaliseArabic('ى')).toBe('ي');
    expect(normaliseArabic('ؤ')).toBe('و');
    expect(normaliseArabic('ئ')).toBe('ي');
    expect(normaliseArabic('ة')).toBe('ه');
  });

  it('collapses whitespace so a query survives stray spaces', () => {
    expect(normaliseArabic('  الرحمن    الرحيم ')).toBe('الرحمن الرحيم');
  });

  it('is case-insensitive for Latin input', () => {
    expect(normaliseArabic('Mercy')).toBe('mercy');
  });
});

describe('normaliseQuery', () => {
  it('trims and lowercases', () => {
    expect(normaliseQuery('  Rahman ')).toBe('rahman');
  });
});

describe('searchQuran', () => {
  it('ignores queries shorter than two characters', () => {
    const result = searchQuran('a', null);
    expect(result.hits).toEqual([]);
    expect(result.scanned).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('finds a verse by unvowelled Arabic', () => {
    // The user types without diacritics; the index is the simple-clean text.
    const result = searchQuran('الرحمن الرحيم', null);
    expect(result.hits.length).toBeGreaterThan(0);
    // Al-Fatihah 1:1 is the first verse carrying the phrase.
    expect(result.hits[0]).toMatchObject({ surah: 1, ayah: 1 });
  });

  it('finds a verse by vocalised Arabic using the same code path', () => {
    const plain = searchQuran('الرحمن الرحيم', null).hits.length;
    const vowelled = searchQuran('ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', null).hits.length;
    expect(vowelled).toBe(plain);
    expect(vowelled).toBeGreaterThan(0);
  });

  it('scans every verse when nothing is truncated', () => {
    const result = searchQuran('zzzzqqqq', null);
    expect(result.hits).toEqual([]);
    expect(result.scanned).toBe(6236);
    expect(result.truncated).toBe(false);
  });

  it('matches in the active translation when Arabic does not match', () => {
    const fake: Record<string, string[]> = {
      '1': ['In the name of God, the Most Merciful, the Most Compassionate', 'x'],
    };
    const result = searchQuran('merciful', fake);
    expect(result.hits.length).toBeGreaterThanOrEqual(1);
    const first = result.hits[0];
    expect(first.surah).toBe(1);
    expect(first.matchedTranslation).toContain('Merciful');
  });

  it('caps the result list and reports truncation', () => {
    // "الله" appears in most surahs; a small limit must trip the guard.
    const result = searchQuran('الله', null, 5);
    expect(result.hits).toHaveLength(5);
    expect(result.truncated).toBe(true);
    expect(result.scanned).toBeLessThan(6236);
  });

  it('returns verse indexes that exist in the bundled text', () => {
    const result = searchQuran('الرحيم', null, 25);
    expect(result.hits.length).toBeGreaterThan(0);
    for (const hit of result.hits) {
      const verses = quranSimple[String(hit.surah)];
      expect(verses, `surah ${hit.surah} missing from the text bundle`).toBeDefined();
      expect(hit.ayah).toBeGreaterThanOrEqual(1);
      expect(hit.ayah).toBeLessThanOrEqual(verses.length);
    }
  });
});

describe('searchAdhkar', () => {
  it('ignores very short queries', () => {
    expect(searchAdhkar('r')).toEqual([]);
  });

  it('finds Hisn al-Muslim items by English text', () => {
    const hits = searchAdhkar('morning');
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.arabic.trim().length).toBeGreaterThan(0);
      expect(hit.categoryTitle.length).toBeGreaterThan(0);
      expect(hit.source.length).toBeGreaterThan(0);
    }
  });

  it('finds morning-and-evening items by Arabic', () => {
    // "أصبحنا" opens several morning adhkar.
    const hits = searchAdhkar('أصبحنا');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.kind === 'morning-evening' || h.kind === 'hisn')).toBe(true);
  });

  it('never returns an item without a category source reference', () => {
    const hits = searchAdhkar('الله', 60);
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.source.trim().length, `item ${hit.itemId} has no source`).toBeGreaterThan(0);
    }
  });

  it('respects the limit', () => {
    expect(searchAdhkar('الله', 3)).toHaveLength(3);
  });
});

describe('searchHadithInPacks', () => {
  const packs = [
    {
      collectionId: 'sahih-bukhari',
      collectionName: 'Sahih al-Bukhari',
      hadiths: [
        {
          id: 'sahih-bukhari:1',
          numberLabel: '1',
          arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
          english: 'Actions are but by intentions',
          narrator: 'Umar ibn al-Khattab',
        },
        {
          id: 'sahih-bukhari:2',
          numberLabel: '299, 300, 301',
          arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ',
          english: 'Whoever believes in Allah and the Last Day',
          narrator: 'Abu Hurairah',
        },
      ],
    },
  ];

  it('matches on English wording', () => {
    const hits = searchHadithInPacks(packs, 'intentions');
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe('sahih-bukhari:1');
    expect(hits[0].collectionName).toBe('Sahih al-Bukhari');
  });

  it('matches on narrator', () => {
    const hits = searchHadithInPacks(packs, 'abu hurairah');
    expect(hits).toHaveLength(1);
    expect(hits[0].narrator).toBe('Abu Hurairah');
  });

  it('matches an individual number inside a grouped sunnah.com span', () => {
    // Upstream numbers may be spans; searching 300 must still find the hadith.
    const hits = searchHadithInPacks(packs, '300');
    expect(hits).toHaveLength(1);
    expect(hits[0].numberLabel).toBe('299, 300, 301');
  });

  it('matches on Arabic', () => {
    const hits = searchHadithInPacks(packs, 'بالنيات');
    expect(hits).toHaveLength(1);
  });

  it('returns nothing for a single character', () => {
    expect(searchHadithInPacks(packs, 'a')).toEqual([]);
  });

  it('returns nothing when no pack is loaded', () => {
    expect(searchHadithInPacks([], 'intentions')).toEqual([]);
  });
});

describe('city list', () => {
  it('covers at least 30 cities across several regions', () => {
    expect(CITY_LIST.length).toBeGreaterThanOrEqual(30);
    const countries = new Set(CITY_LIST.map((c) => c.country));
    expect(countries.size).toBeGreaterThan(10);
  });

  it('gives every city valid coordinates and an IANA time zone', () => {
    for (const city of CITY_LIST) {
      expect(city.latitude).toBeGreaterThanOrEqual(-90);
      expect(city.latitude).toBeLessThanOrEqual(90);
      expect(city.longitude).toBeGreaterThanOrEqual(-180);
      expect(city.longitude).toBeLessThanOrEqual(180);
      // Intl throws RangeError for an invalid zone.
      expect(() => new Intl.DateTimeFormat('en', { timeZone: city.timezone })).not.toThrow();
    }
  });

  it('lists Makkah, since it is the default location', () => {
    const makkah = CITY_LIST.find((c) => c.name === 'Makkah');
    expect(makkah).toBeDefined();
    expect(makkah?.latitude).toBeCloseTo(21.4225, 3);
    expect(makkah?.longitude).toBeCloseTo(39.8262, 3);
  });

  it('finds cities by name, case-insensitively', () => {
    const hits = searchCities('casabl');
    expect(hits.some((c) => c.name === 'Casablanca')).toBe(true);
  });

  it('finds cities by country code', () => {
    const hits = searchCities('tr');
    expect(hits.some((c) => c.country === 'TR')).toBe(true);
  });

  it('never returns more than the limit', () => {
    expect(searchCities('a', 3)).toHaveLength(3);
  });

  it('returns the default list for a blank query so the picker is never empty', () => {
    const hits = searchCities('   ', 5);
    expect(hits).toHaveLength(5);
    expect(hits[0].name).toBe(CITY_LIST[0].name);
  });
});

describe('searchQuran index integrity', () => {
  it('has a simple-clean entry for every surah in the metadata', () => {
    let total = 0;
    for (const chapter of quranMeta.chapters) {
      const simple = quranSimple[String(chapter.id)];
      expect(simple, `surah ${chapter.id} missing from simple-clean`).toBeDefined();
      expect(simple.length, `surah ${chapter.id} verse count`).toBe(chapter.verses);
      total += simple.length;
    }
    expect(total).toBe(6236);
  });
});
