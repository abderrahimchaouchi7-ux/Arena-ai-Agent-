# Acceptance checklist

Fifteen points, each with the command that verifies it and the result observed.
Anything not verified is marked **not verified** rather than left ambiguous.

Verified in an environment with Node 22.22.3 and npm 10.9.8, **no JDK, no
Gradle and no Android SDK** — so no APK was built, signed or tested. See point
12.

| # | Requirement | How to verify | Result |
| --- | --- | --- | --- |
| 1 | Every navigation destination is functional | `npm test` → *navigation* journey tests | **Pass** — 10 destinations render; unknown route hits 404 |
| 2 | i18n and RTL are correct | `npm test` → *i18n* + *language and theme persistence* | **Pass** — key parity across ar/fr/en; `dir="rtl"` `lang="ar"` applied |
| 3 | The countdown is correct | `npm test` → *prayer times journey* | **Pass** — real `h:mm` times and a live `h:mm:ss` countdown |
| 4 | Audio controls work | `npm test` → *accessibility* (player controls reachable and named) | **Partial** — controls render and are labelled; playback not exercised |
| 5 | Notification behaviour | `npm test` → Settings render; `docs/ANDROID.md` §7–8 | **Partial** — channels declared; delivery not exercised without a device |
| 6 | Quran content is complete | `npm run data:verify` | **Pass** — 114 surahs, 6,236 verses, 13/13 |
| 7 | Hadith and du'a sources are traceable | `npm run data:verify` | **Pass** — every adhkar item sourced; upstream commits pinned |
| 8 | Qibla bearing is correct | `npm test` → `src/lib/qibla.test.ts` | **Pass** — 36 tests vs independently computed fixtures |
| 9 | Theme and language persist | `npm test` → *language and theme persistence* | **Pass** — survives rehydration from `localStorage` |
| 10 | Content is available offline | `npm run build` | **Pass** — service worker precaches 58 entries (~8.5 MB) |
| 11 | The layout is responsive | `npm run dev` | **Not verified** — no browser in this environment |
| 12 | The Android build is documented | `docs/ANDROID.md` | **Pass** — project present; **no APK built, signed or tested** |
| 13 | Accessibility, empty and error states | `npm test` → *accessibility and states* | **Pass** — skip link, landmarks, named controls, no emoji in nav |
| 14 | No decorative placeholders | `npm test` + `npm run data:verify` | **Pass** — unavailable sources report honestly |
| 15 | Type-safe and tested | `npm run typecheck && npm test` | **Pass** — `tsc` 0 errors; 173/173 tests |

---

## 1. Navigation

`src/test/journeys.test.tsx` renders the real `App` with the real router and
visits every destination:

```
#/  #/prayer-times  #/quran  #/dua  #/adhkar  #/hadith
#/qibla  #/adhan  #/search  #/bookmarks  #/settings
```

Each must produce a non-empty `<main>`. `/does-not-exist` must render the 404
page. A click on the home dashboard's prayer-times link must navigate.

## 2. i18n and RTL

`src/i18n/i18n.test.ts` asserts that `fr.ts` and `ar.ts` are **exact structural
mirrors** of `en.ts` — same keys, no missing or extra entries — and that no
string was left in English by copy-paste. Switching to Arabic must set
`document.documentElement.dir = "rtl"` and `lang = "ar"`; the journey test
asserts both.

## 3. Countdown

Prayer times are computed by `adhan` from real coordinates, so they are genuine
`Date` objects and inherit the platform's time zone and DST handling.
`src/lib/prayer.test.ts` proves the mechanism by showing the same instant sits at
UTC+1 in July and UTC+0 in January for `Europe/London`.

## 4. Audio controls

The player renders play/pause, seek and volume, and every icon-only control has
an accessible name. **Playback itself is not exercised** — jsdom has no media
engine. Verify manually with `npm run dev`.

## 5. Notifications

Two Android channels are created in `MainActivity.onCreate`
(`prayer-times` at HIGH, `prayer-reminders` at DEFAULT), because notifications
posted to an unknown channel are silently dropped on Android 8+.

**Not verified by execution.** Notification delivery needs a device or emulator,
which this environment does not have. The Settings screen states the platform
limits honestly rather than promising unrestricted operation.

## 6. Quran completeness

```
npm run data:verify
```

114 surahs; exactly 6,236 verses; metadata and text agree per surah; tashkeel
present on every verse; Uthmani and search scripts align 6,236/6,236; English
and French each cover all 6,236; 30 juz, 60 hizb, 604 pages, 15 sajda.

The Basmala is embedded in verse 1 of all 113 surahs that have one, and the
reader is asserted **not** to print a second copy.

## 7. Source traceability

Every adhkar item carries a source reference. The 34 morning-and-evening items
carry real hadith references with gradings. All four upstream datasets are
pinned to full commit SHAs in `src/data/generated/sources.json`.

Hadith grades are **never** taken from the upstream `status` field, which its own
README flags as inaccurate.

## 8. Qibla

`src/lib/qibla.test.ts` compares against bearings computed by an independent
spherical implementation:

| From | Bearing | Distance |
| --- | --- | --- |
| London | 118.988° | 4,793.7 km |
| New York | 58.482° | 10,306.2 km |
| Paris | 119.164° | 4,496.1 km |
| Jakarta | 295.151° | 7,920.2 km |
| Istanbul | 151.623° | 2,405.0 km |
| Cairo | 136.141° | 1,287.2 km |
| Sydney | 277.499° | 13,236.3 km |
| Casablanca | 93.676° | 4,823.5 km |
| Toronto | 54.581° | 10,495.8 km |

Edge cases: due north and due south of the Kaaba both return 0.0°; distance at
the Kaaba is 0. The computed bearing and the sensor heading are separate values
in the UI and are never merged into one number.

## 9. Persistence

`nur-settings` in `localStorage` (read before first paint by `index.html`) and
`nur-user-data`, backed up to IndexedDB `nur-al-iman`. The journey test writes
the persisted shape, calls `useSettings.persist.rehydrate()`, and asserts the
language and theme are restored.

## 10. Offline

```
npm run build
```

Reports `precache 58 entries (8547.76 KiB)` and generates `dist/sw.js`. Quran
translations and hadith packs use cache-first routes and are cached on first use.

Prayer-time calculation, Qibla bearing, Hijri conversion and all bundled content
work with no network at all.

## 11. Responsive layout

**Not verified.** This environment has no browser, so breakpoints, RTL mirroring
at narrow widths and touch targets were not visually inspected. Run
`npm run dev` and check at 360 px, 768 px and 1280 px.

## 12. Android

`android/` is a real Capacitor 6 project: Gradle files, manifest with declared
permissions, launcher icons at all five densities plus adaptive foreground,
notification channels, `MainActivity` lifecycle handling, and a release signing
block reading `android/keystore.properties` (git-ignored).

**No APK was built, signed or tested.** The authoring environment has no `java`,
no `gradle` and no `ANDROID_HOME`. `docs/ANDROID.md` gives the exact commands to
produce and verify the artefact.

## 13. Accessibility and states

A skip link targets `#main`; landmarks are present; every icon-only button has an
accessible name; navigation contains no emoji. Empty states (no bookmarks, no
search results) and error states (unavailable audio source, denied location,
missing IndexedDB) render real messages.

## 14. No decorative placeholders

Unreachable audio reports "source unavailable" with a reason. A denied location
falls back to a manual city. A collection with no configured remote source shows
a setup message rather than fabricated results. Nothing is labelled real content
when it is not.

## 15. Type safety and tests

```bash
npm run typecheck   # tsc --noEmit → 0 errors
npm test            # 173 passed (9 files)
npm run build       # succeeds; dist/ + service worker emitted
```

---

## Reproduce

```bash
npm ci
npm run data:verify
npm run typecheck
npm test
npm run build
```

Expected: **13/13 PASS**, **0 TypeScript errors**, **173 tests passed**, and a
clean production build with a generated service worker.
