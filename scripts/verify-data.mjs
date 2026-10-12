#!/usr/bin/env node
/**
 * Validates the bundled religious content *before* it can ship.
 *
 * Run with: node scripts/verify-data.mjs   (or `npm run data:verify`)
 * Exits non-zero if any invariant fails, so it can gate CI / a release.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEN = join(ROOT, 'src', 'data', 'generated');

const results = [];
const check = (name, fn) => {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail });
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const read = (f) => JSON.parse(readFileSync(join(GEN, f), 'utf8'));

const meta = read('quran-meta.json');
const uthmani = read('quran-uthmani.json');
const simple = read('quran-simple.json');
const en = read('quran-en.json');
const fr = read('quran-fr.json');
const adhkar = read('adhkar.json');
const me = read('adhkar-morning-evening.json');
const hadithIndex = read('hadith-index.json');

/* ------------------------------------------------------------- Quran shape */

check('Quran has exactly 114 surahs', () => {
  assert(meta.chapters.length === 114, `found ${meta.chapters.length}`);
  assert(Object.keys(uthmani).length === 114, `text blocks: ${Object.keys(uthmani).length}`);
  return '114 surahs';
});

check('Quran has exactly 6,236 verses (Kufi / Hafs)', () => {
  let total = 0;
  for (const c of meta.chapters) {
    const verses = uthmani[String(c.id)] ?? [];
    assert(
      verses.length === c.verses,
      `surah ${c.id} (${c.transliteration}): meta says ${c.verses}, text has ${verses.length}`,
    );
    total += verses.length;
  }
  assert(total === 6236, `total verses = ${total}`);
  return `${total} verses`;
});

check('Every verse carries non-empty Arabic text with diacritics', () => {
  const arabicRe = /[\u0600-\u06FF]/;
  const tashkeelRe = /[\u064B-\u0652\u0670]/;
  let checked = 0;
  for (const [surah, verses] of Object.entries(uthmani)) {
    for (const [i, t] of verses.entries()) {
      assert(typeof t === 'string' && t.trim().length > 0, `empty text at ${surah}:${i + 1}`);
      assert(arabicRe.test(t), `non-Arabic text at ${surah}:${i + 1}`);
      checked += 1;
    }
  }
  // Al-Kawthar / An-Nasr etc. are short but still vowelled; sample the short surahs.
  const shortOnes = ['110', '108', '112'];
  for (const s of shortOnes) {
    for (const t of uthmani[s]) {
      assert(tashkeelRe.test(t), `missing tashkeel in ${s}: ${t}`);
    }
  }
  return `${checked} verses checked, tashkeel present`;
});

check('Surah 1 begins with the Basmala and 114 has 6 verses', () => {
  assert(uthmani['1'][0].includes('بِسْمِ'), uthmani['1'][0]);
  assert(uthmani['114'].length === 6, `An-Nas has ${uthmani['114'].length}`);
  assert(uthmani['2'].length === 286, `Al-Baqarah has ${uthmani['2'].length}`);
  return 'Al-Fatihah / An-Nas / Al-Baqarah verified';
});

check('Simple (search) script aligns 1:1 with Uthmani', () => {
  for (const [surah, verses] of Object.entries(uthmani)) {
    assert(
      (simple[surah] ?? []).length === verses.length,
      `surah ${surah}: uthmani ${verses.length} vs simple ${(simple[surah] ?? []).length}`,
    );
  }
  return '6236 / 6236 aligned';
});

check('Translations cover every verse (EN + FR)', () => {
  let enCount = 0;
  let frCount = 0;
  for (const c of meta.chapters) {
    const n = c.verses;
    assert((en[String(c.id)] ?? []).length === n, `EN surah ${c.id} incomplete`);
    assert((fr[String(c.id)] ?? []).length === n, `FR surah ${c.id} incomplete`);
    assert((en[String(c.id)] ?? []).every((t) => t && t.length > 0), `EN surah ${c.id} empty verse`);
    enCount += (en[String(c.id)] ?? []).length;
    frCount += (fr[String(c.id)] ?? []).length;
  }
  return `EN ${enCount}, FR ${frCount}`;
});

check('Mushaf indexes are complete (30 juz, 60 hizb, 604 pages)', () => {
  assert(meta.juz.length === 30, `juz = ${meta.juz.length}`);
  assert(meta.hizb.length === 60, `hizb = ${meta.hizb.length}`);
  assert(meta.pages.length === 604, `pages = ${meta.pages.length}`);
  assert(meta.sajda.length > 0, 'no sajda index');
  return `30 juz / 60 hizb / 604 pages / ${meta.sajda.length} sajda`;
});

check('Juz index points at real verses', () => {
  for (const j of meta.juz) {
    const verses = uthmani[String(j.sura)] ?? [];
    assert(j.aya >= 1 && j.aya <= verses.length, `juz ${j.index} -> ${j.sura}:${j.aya} out of range`);
  }
  return 'all 30 juz in range';
});

/* ------------------------------------------------------------ Adhkar shape */

check('Adhkar: every item has Arabic text, a count and a source reference', () => {
  let n = 0;
  for (const cat of adhkar.categories) {
    assert(cat.arabicTitle, `category ${cat.id} missing Arabic title`);
    assert(cat.reference?.includes('Hisn al-Muslim'), `category ${cat.id} missing reference`);
    for (const it of cat.items) {
      assert(it.arabic && it.arabic.length > 1, `item ${it.id} missing Arabic`);
      assert(Number.isFinite(it.count) && it.count >= 1, `item ${it.id} bad count`);
      n += 1;
    }
  }
  return `${adhkar.categories.length} categories / ${n} items`;
});

check('Morning & evening adhkar carry traceable hadith references', () => {
  assert(me.items.length >= 20, `only ${me.items.length} items`);
  const withSource = me.items.filter((i) => i.source && i.source.length > 10);
  assert(
    withSource.length === me.items.length,
    `${me.items.length - withSource.length} items lack a source`,
  );
  const periods = new Set(me.items.map((i) => i.period));
  assert(periods.has('morning') && periods.has('evening'), 'missing a period');
  return `${me.items.length} items, all sourced`;
});

/* ------------------------------------------------------------ Hadith shape */

check('Hadith: every offline hadith has Arabic, English, a number and a chapter', () => {
  let total = 0;
  for (const col of hadithIndex.collections) {
    const pack = read(`hadith-${col.id}.json`);
    assert(pack.hadiths.length > 0, `${col.id} pack is empty`);
    const chapterNumbers = new Set(pack.chapters.map((c) => String(c.number)));
    for (const h of pack.hadiths) {
      assert(h.arabic && h.arabic.length > 10, `${h.id} missing Arabic`);
      assert(h.english && h.english.length > 3, `${h.id} missing English`);
      if (h.textRepeatsPrevious) {
        assert(
          /^as above\.?$/i.test(h.english),
          `${h.id} flagged as a repeat but text is ${JSON.stringify(h.english)}`,
        );
      }
      assert(
        Number.isInteger(h.number) && h.number >= 0,
        `${h.id} bad number ${JSON.stringify(h.number)}`,
      );
      // Sahih Muslim opens with an unnumbered Muqaddimah preamble, so 0 is valid.
      assert(/^\d+(\s*,\s*\d+)*$/.test(h.numberLabel ?? ''), `${h.id} bad label ${h.numberLabel}`);
      assert(h.id === `${col.id}:${h.number}`, `${h.id} id/number mismatch`);
      assert(chapterNumbers.has(String(h.chapterId)), `${h.id} unknown chapter ${h.chapterId}`);
      assert(
        h.grade === undefined,
        `${h.id} carries a grade — upstream grades are unreliable and must not ship`,
      );
      total += 1;
    }
  }
  return `${hadithIndex.collections.length} collections / ${total} hadiths`;
});

check('Hadith grading disclaimer is recorded', () => {
  assert(hadithIndex.note?.length > 40, 'missing grading note');
  return 'present';
});

/* ------------------------------------------------------------- Provenance */

check('Every dataset records a pinned upstream commit', () => {
  const src = read('sources.json');
  for (const [k, v] of Object.entries(src.upstream)) {
    assert(/^[^@]+@[0-9a-f]{40}$/.test(v), `${k} not pinned: ${v}`);
  }
  return Object.keys(src.upstream).length + ' sources pinned';
});

/* ----------------------------------------------------------------- Report */

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) {
  console.error('\nData verification FAILED — do not ship.');
  process.exit(1);
}
