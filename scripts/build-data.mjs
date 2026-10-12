#!/usr/bin/env node
/**
 * Builds the bundled, offline-first religious content for the app.
 *
 * Everything the app ships with is imported here from a *named upstream source
 * pinned to an exact commit*. Nothing religious is generated, paraphrased or
 * summarised by this script — it only reshapes verified files and records where
 * each one came from in `sources.json`.
 *
 * Usage:  node scripts/build-data.mjs [--force]
 *
 * Sources (see docs/DATA-SOURCES.md for licences and provenance):
 *   - Quran text ........ risan/quran-json  -> data/tanzil/*  (Tanzil, Uthmani + Simple-clean)
 *   - Quran translations  risan/quran-json  -> data/quranenc/*  (QuranEnc: Saheeh EN, Hamidullah FR)
 *   - Adhkar (Hisn) ..... YousefAsalya/Islamic-Pro-azkar-API (MIT)
 *   - Adhkar (M&E) ...... Seen-Arabic/Morning-And-Evening-Adhkar-DB (MIT)
 *   - Hadith ............ AbdullahNaseer01/hadith-books-data
 */

import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.data-cache');
const OUT = join(ROOT, 'src', 'data', 'generated');
const FORCE = process.argv.includes('--force');

const SOURCES = {
  quran: {
    repo: 'risan/quran-json',
    commit: '6523a9ad3b73bb7e8cb3a9cdf0ea774b8bab3123',
    branch: 'main',
  },
  adhkar: {
    repo: 'YousefAsalya/Islamic-Pro-azkar-API',
    commit: 'd793023e3b69c91674023f692425950c8ebbb64d',
    branch: 'main',
  },
  morningEvening: {
    repo: 'Seen-Arabic/Morning-And-Evening-Adhkar-DB',
    commit: '29d7623fede52eca835a789025dfda866e8cfe44',
    branch: 'main',
  },
  hadith: {
    repo: 'AbdullahNaseer01/hadith-books-data',
    commit: 'c4e5e554fc7bd498c8f3e0fac9e627b3d5a2e387',
    branch: 'main',
  },
};

/** How many hadiths of each collection go into the offline pack... */
const HADITH_OFFLINE_TARGET = 300;
/** ...and the most we take from any single chapter. */
const HADITH_PER_CHAPTER = 20;

const log = (...a) => console.log('[data]', ...a);

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

async function fetchSource(key) {
  const { repo, commit, branch } = SOURCES[key];
  ensureDir(CACHE);
  const tarball = join(CACHE, `${key}.tgz`);
  const dir = join(CACHE, key);

  if (existsSync(dir) && !FORCE) {
    log(`using cached ${repo}`);
    return dir;
  }
  rmSync(dir, { recursive: true, force: true });

  if (!existsSync(tarball) || FORCE) {
    const url = `https://codeload.github.com/${repo}/tar.gz/${commit}`;
    log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Failed to download ${url}: ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tarball));
  }

  mkdirSync(dir, { recursive: true });
  execFileSync('tar', ['-xzf', tarball, '-C', dir, '--strip-components=1']);
  log(`extracted ${repo}@${commit.slice(0, 8)} (branch ${branch})`);
  return dir;
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (name, value) => {
  const p = join(OUT, name);
  ensureDir(dirname(p));
  writeFileSync(p, JSON.stringify(value));
  const kb = (Buffer.byteLength(JSON.stringify(value)) / 1024).toFixed(0);
  log(`wrote ${name} (${kb} KB)`);
};

/* ------------------------------------------------------------------ Quran -- */

function buildQuran(srcDir) {
  const tanzil = join(srcDir, 'data', 'tanzil');
  const enc = join(srcDir, 'data', 'quranenc');

  const chaptersRaw = readJson(join(tanzil, 'chapters.json'));
  const uthmani = readJson(join(tanzil, 'uthmani.json'));
  const simple = readJson(join(tanzil, 'simple-clean.json'));
  const enRaw = readJson(join(enc, 'english_saheeh.json'));
  const frRaw = readJson(join(enc, 'french_hameedullah.json'));

  const chapters = chaptersRaw.chapters.map((c) => ({
    id: c.id,
    name: c.name,
    transliteration: c.transliteration,
    translation: c.translation,
    revelation: c.type === 'meccan' ? 'meccan' : 'medinan',
    verses: c.total_verses,
  }));

  // Compact verse arrays: { "1": ["بِسْمِ...", ...], ... }
  const pack = (raw) => {
    const out = {};
    for (const [surah, verses] of Object.entries(raw)) {
      out[surah] = verses.map((v) => v.text);
    }
    return out;
  };

  const arUthmani = pack(uthmani);
  const arSimple = pack(simple);

  // Saheeh International (QuranEnc build) inlines footnote markers like "[2]".
  // Strip them from the verse body; footnotes are dropped from the offline pack.
  const stripNotes = (t) => String(t ?? '').replace(/\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
  const packTranslation = (raw) => {
    const out = {};
    for (const [surah, verses] of Object.entries(raw)) {
      out[surah] = verses.map((v) => stripNotes(v.text));
    }
    return out;
  };

  // Tanzil's `hizbs` index lists the 240 *quarter*-hizb boundaries, not 60 hizb.
  // Keep both: quarters for fine navigation, and the derived 60 hizb for display.
  const quarterHizb = chaptersRaw.indexes.hizbs;
  const hizb = quarterHizb
    .filter((_, i) => i % 4 === 0)
    .map((q, i) => ({ index: i + 1, sura: q.sura, aya: q.aya }));

  writeJson('quran-meta.json', {
    script: 'uthmani',
    reading: 'Hafs an Asim',
    verseNumbering: 'Kufi (Hafs)',
    chapters,
    juz: chaptersRaw.indexes.juzs,
    hizb,
    quarterHizb,
    pages: chaptersRaw.indexes.pages,
    sajda: chaptersRaw.indexes.sajdas,
  });
  writeJson('quran-uthmani.json', arUthmani);
  writeJson('quran-simple.json', arSimple);
  writeJson('quran-en.json', packTranslation(enRaw));
  writeJson('quran-fr.json', packTranslation(frRaw));

  return { chapters, arUthmani, arSimple };
}

/* ----------------------------------------------------------------- Adhkar -- */

function buildAdhkar(hisnDir, meDir) {
  const ar = readJson(join(hisnDir, 'data', 'ar.json'));
  const en = readJson(join(hisnDir, 'data', 'en.json'));

  const enById = new Map(en.map((c) => [c.id, c]));
  const clean = (s) => (typeof s === 'string' ? s.replace(/\s{2,}/g, ' ').trim() : s);

  const categories = [];
  for (const cat of ar) {
    const match = enById.get(cat.id);
    const items = cat.array.map((it, i) => {
      const enItem = match?.array?.[i];
      return {
        id: `${cat.id}-${it.id}`,
        categoryId: cat.id,
        arabic: clean(it.text),
        english: clean(enItem?.text ?? null),
        transliteration: clean(it.transliteration ?? null),
        count: Number(it.count) > 0 ? Number(it.count) : 1,
      };
    });
    categories.push({
      id: cat.id,
      arabicTitle: clean(cat.category),
      englishTitle: clean(match?.category ?? null),
      reference: `Hisn al-Muslim (Fortress of the Muslim), Sa'id bin 'Ali bin Wahf al-Qahtani — chapter ${cat.id}`,
      items,
    });
  }
  categories.sort((a, b) => a.id - b.id);

  const me = {
    ar: readJson(join(meDir, 'ar.json')),
    en: readJson(join(meDir, 'en.json')),
  };
  const morningEvening = me.ar.map((row, i) => ({
    id: `me-${row.order}`,
    order: row.order,
    // type 0 = morning, 1 = evening (see upstream README)
    period: row.type === 1 ? 'evening' : 'morning',
    arabic: clean(row.content),
    english: clean(me.en[i]?.content ?? null),
    count: Number(row.count) > 0 ? Number(row.count) : 1,
    countDescription: clean(row.count_description ?? null),
    source: clean(row.source ?? null),
    virtue: clean(row.fadl ?? null),
  }));

  writeJson('adhkar.json', {
    source: 'Hisn al-Muslim — via YousefAsalya/Islamic-Pro-azkar-API (MIT)',
    categories,
  });
  writeJson('adhkar-morning-evening.json', {
    source: 'Seen-Arabic/Morning-And-Evening-Adhkar-DB (MIT)',
    items: morningEvening,
  });

  return { categories, morningEvening };
}

/* ----------------------------------------------------------------- Hadith -- */

const COLLECTIONS = [
  { file: 'sahih-bukhari.json', id: 'sahih-bukhari', name: 'Sahih al-Bukhari', compiler: "Imam Muhammad ibn Isma'il al-Bukhari (d. 256 AH)" },
  { file: 'sahih-muslim.json', id: 'sahih-muslim', name: 'Sahih Muslim', compiler: 'Imam Muslim ibn al-Hajjaj an-Naysaburi (d. 261 AH)' },
  { file: 'abu-dawood.json', id: 'sunan-abu-dawud', name: 'Sunan Abi Dawud', compiler: "Imam Abu Dawud Sulayman ibn al-Ash'ath as-Sijistani (d. 275 AH)" },
  { file: 'al-tirmidhi.json', id: 'jami-at-tirmidhi', name: "Jami' at-Tirmidhi", compiler: 'Imam Abu Isa Muhammad ibn Isa at-Tirmidhi (d. 279 AH)' },
  { file: 'sunan-nasai.json', id: 'sunan-an-nasai', name: "Sunan an-Nasa'i", compiler: "Imam Ahmad ibn Shu'ayb an-Nasa'i (d. 303 AH)" },
  { file: 'ibn-e-majah.json', id: 'sunan-ibn-majah', name: 'Sunan Ibn Majah', compiler: 'Imam Muhammad ibn Yazid Ibn Majah al-Qazwini (d. 273 AH)' },
];

function buildHadith(srcDir) {
  const summary = [];
  const chaptersById = {};

  for (const col of COLLECTIONS) {
    const raw = readJson(join(srcDir, 'src', col.file));
    // NOTE: upstream `data[].chapterId` holds the *chapter number* as a string
    // (e.g. "1"), not the global `chapters[].id` primary key. Bukhari happens to
    // have both equal, which masks the bug for that collection only. Join on
    // `chapterNumber` instead.
    const chapters = (raw.hadiths.chapters ?? [])
      .map((c) => ({
        id: c.id,
        number: c.chapterNumber,
        english: c.chapterEnglish,
        arabic: c.chapterArabic,
      }))
      .sort((a, b) => Number(a.number) - Number(b.number));
    const all = raw.hadiths.data ?? [];

    // Offline pack: take whole chapters in canonical order until the budget is
    // reached, so nothing is split mid-chapter.
    const byChapter = new Map();
    for (const h of all) {
      const k = String(h.chapterId); // == chapterNumber
      if (!byChapter.has(k)) byChapter.set(k, []);
      byChapter.get(k).push(h);
    }
    // Take up to HADITH_PER_CHAPTER hadiths from each chapter, in canonical
    // chapter order, until the collection budget is spent. This keeps the pack
    // spread across the opening chapters of every collection (belief, purity,
    // prayer, zakat, fasting, manners...) instead of draining one long chapter.
    const picked = [];
    let chaptersIncluded = 0;
    for (const ch of chapters) {
      if (picked.length >= HADITH_OFFLINE_TARGET) break;
      const list = byChapter.get(String(ch.number)) ?? [];
      if (!list.length) continue;
      // Drop upstream records that are genuinely missing text (a handful exist
      // in an-Nasa'i and Ibn Majah). "As above." is kept — it is a real
      // editorial cross-reference, flagged below.
      const take = list
        .filter((h) => (h.hadithArabic ?? '').trim().length > 0)
        .filter((h) => (h.hadithEnglish ?? '').trim().length > 0)
        .slice(0, HADITH_PER_CHAPTER);
      if (!take.length) continue;
      picked.push(...take);
      chaptersIncluded += 1;
    }

    // sunnah.com groups hadiths that share a numbering span, so `hadithNumber`
    // can be "299, 300, 301". Keep the human label and derive a primary number.
    const parseNumbers = (v) =>
      String(v ?? '')
        .split(/[,\s]+/)
        .map((x) => Number.parseInt(x, 10))
        .filter((n) => Number.isFinite(n) && n > 0);

    const hadiths = picked.map((h) => {
      const nums = parseNumbers(h.hadithNumber);
      const label = String(h.hadithNumber ?? '').trim();
      return {
      id: `${col.id}:${nums[0] ?? label}`,
      number: nums[0] ?? 0,
      numberLabel: label,
      numberRange: nums.length > 1 ? nums : null,
      chapterId: String(h.chapterId),
      chapter: h.chapter ?? null,
      headingEnglish: h.headingEnglish ?? null,
      headingArabic: h.headingArabic ?? null,
      arabic: (h.hadithArabic ?? '').replace(/\s{2,}/g, ' ').trim(),
      english: (h.hadithEnglish ?? '').replace(/\s{2,}/g, ' ').trim(),
      narrator: (h.englishNarrator ?? '').replace(/\s{2,}/g, ' ').trim(),
      volume: h.volume ?? null,
      // sunnah.com prints "As above." when the wording is identical to the
      // preceding narration and only the chain differs. Surface that honestly.
      textRepeatsPrevious: /^as above\.?$/i.test((h.hadithEnglish ?? '').trim()),
      };
    });

    writeJson(`hadith-${col.id}.json`, {
      collection: col.id,
      name: col.name,
      compiler: col.compiler,
      offlinePack: true,
      chapters,
      hadiths,
    });

    chaptersById[col.id] = chapters;
    summary.push({
      id: col.id,
      name: col.name,
      compiler: col.compiler,
      totalInCollection: all.length,
      offlineCount: hadiths.length,
      offlineChapters: chaptersIncluded,
      chapters: chapters.length,
    });
  }

  writeJson('hadith-index.json', {
    source: 'AbdullahNaseer01/hadith-books-data (text derived from sunnah.com editions)',
    note:
      'Grading fields in the upstream dataset are documented by its maintainer as unreliable, so this app never displays a per-hadith grade from that dataset. See docs/DATA-SOURCES.md.',
    collections: summary,
  });

  return summary;
}

/* ------------------------------------------------------------------- Main -- */

async function main() {
  ensureDir(OUT);
  const started = Date.now();

  const quranSrc = await fetchSource('quran');
  const hisnSrc = await fetchSource('adhkar');
  const meSrc = await fetchSource('morningEvening');
  const hadithSrc = await fetchSource('hadith');

  const { chapters, arUthmani } = buildQuran(quranSrc);
  const { categories, morningEvening } = buildAdhkar(hisnSrc, meSrc);
  const hadith = buildHadith(hadithSrc);

  const totalVerses = Object.values(arUthmani).reduce((n, v) => n + v.length, 0);

  writeJson('sources.json', {
    generatedAt: new Date().toISOString(),
    quran: {
      text: 'Tanzil — Uthmani script, Hafs an Asim, Kufi verse numbering',
      translations: {
        en: 'Saheeh International (via QuranEnc, key english_saheeh)',
        fr: 'Muhammad Hamidullah (via QuranEnc, key french_hameedullah)',
      },
      surahs: chapters.length,
      verses: totalVerses,
    },
    adhkar: {
      hisnCategories: categories.length,
      hisnItems: categories.reduce((n, c) => n + c.items.length, 0),
      morningEveningItems: morningEvening.length,
    },
    hadith,
    upstream: Object.fromEntries(
      Object.entries(SOURCES).map(([k, v]) => [k, `${v.repo}@${v.commit}`]),
    ),
  });

  log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error('[data] failed:', err);
  process.exit(1);
});
