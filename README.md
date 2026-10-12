# Nur Al-Iman

An offline-first Islamic companion: prayer times, adhan, the full Quran mushaf,
du'a, adhkar, hadith and a Qibla compass — in Arabic, French and English, with
five themes, working as an installable PWA and as a Capacitor Android app.

No account. No ads. No tracking. Everything computes on the device.

---

## Quick start

```bash
npm ci
npm run data:verify   # 13 checks on the bundled religious content
npm run dev           # http://localhost:5173
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | `tsc --noEmit` then a production build to `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm test` | 169 unit + journey tests (Vitest + Testing Library) |
| `npm run typecheck` | TypeScript, strict, no emit |
| `npm run data:build` | Rebuild `src/data/generated/` from pinned upstream sources |
| `npm run data:verify` | Release-gating content assertions |
| `npm run android:sync` | Build web + copy into the Android project |
| `npm run android:apk` | `./gradlew assembleDebug` |

The data build needs no network: upstream sources are cached in `.data-cache/`
(git-ignored). Copy `.env.example` to `.env.local` only if you want to configure
optional remote audio — **nothing there is required**.

---

## What's actually implemented

**Home dashboard** — next prayer with a live countdown, Hijri date, a daily
verse and du'a, Qibla bearing, resume-reading. Widgets are user-reorderable and
the choice persists.

**Prayer times** — Fajr, Dhuhr, Asr, Maghrib, Isha plus sunrise, Islamic
midnight and the last third of the night. 12 calculation methods, Shafi'i/Hanafi
Asr, high-latitude rules, per-prayer manual offsets. Computed on-device by
`adhan` — no network, no API key, works in airplane mode. Geolocation is asked
for only when the user asks for it, and denial falls back to a city picker or
typed coordinates.

**Adhan library** — named muezzins, a full player (play/pause/seek/volume),
preferred-adhan selection, offline caching of user-imported files. Remote
sources are probed at runtime and report honestly when unavailable. No
redistributed recordings.

**Notifications** — per prayer: full adhan, short tone, or silent, plus optional
pre-prayer reminders. The Android build schedules through `AlarmManager`; the
web build uses an in-page scheduler. Settings states plainly that a closed
browser tab cannot fire an alert, rather than implying otherwise.

**Quran** — all 114 surahs / 6,236 verses in Tanzil Uthmani script (Hafs ʿan
ʿAsim, Kufi numbering), with surah/juz/hizb/page navigation, full-text search
across every verse, bookmarks, last-read position and progress, adjustable font
size, per-ayah recitation, Saheeh International (EN) and Hamidullah (FR)
translations, and share/copy.

**Du'a and Adhkar** — 132 Hisn al-Muslim categories (267 items) plus 34
morning-and-evening adhkar, with repetition counters, bookmarks and the source
reference shown for every item.

**Hadith** — six collections, 1,844 hadiths offline, searchable by keyword,
narrator, number and collection, with chapter browsing and a daily hadith.

**Qibla** — great-circle bearing to the Kaaba (21.4224779° N, 39.8251832° E)
from real coordinates, with magnetometer heading where the device has one. The
**computed geographic bearing** and the **live sensor heading** are displayed as
separate values and never conflated. Calibration guidance is shown, and a
sensor-less device gets the bearing without a fake needle.

**i18n and themes** — Arabic (RTL, fully mirrored), French, English; five themes
× light/dark/auto × six accents. Language and theme persist and are applied
before first paint.

---

## Architecture

```
src/
  lib/         prayer.ts · qibla.ts · hijri.ts · audio.ts · search.ts ·
               share.ts · notifications.ts · db.ts · pwa.ts · types.ts
  state/       zustand stores: settings (persisted) · userData (persisted) ·
               audioPlayer (shared <audio>)
  i18n/        en.ts (canonical) · fr.ts · ar.ts — typed mirrors
  components/  ui.tsx · Layout.tsx · GlobalAudioPlayer.tsx · content.tsx
  pages/       Home · PrayerTimes · AdhanLibrary · QuranIndex · QuranReader ·
               Dua · Adhkar · Hadith · Qibla · Settings · Search · Bookmarks
  data/
    generated/ built, verified content — see docs/DATA-SOURCES.md
scripts/       build-data.mjs · verify-data.mjs · make-icons.sh
android/       Capacitor 6 Android project
docs/          DATA-SOURCES.md · ANDROID.md · ACCEPTANCE.md
```

Prayer times, Hijri conversion and Qibla bearing are pure functions with no DOM
or network dependency, which is why they are unit-tested directly against
independently computed fixtures.

---

## Verification

`npm run data:verify` runs 13 assertions that gate a release — surah and verse
counts, tashkeel on every verse, 1:1 script alignment, translation coverage,
mushaf index completeness, a source reference on every adhkar item, the hadith
grading disclaimer, and pinned upstream commits. **Current result: 13/13 PASS.**

`npm test` runs 169 tests: prayer-time and Qibla maths, Hijri conversion, data
integrity, translation key parity across all three languages, search, clipboard
and share fallbacks, and 18 journey tests that render the real app and drive
navigation, language switching, theme persistence and bookmarks.

See **[docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)** for the 15-point acceptance
checklist with the command that verifies each line.

---

## Deployment

Any static host works — the output is a plain `dist/` directory.

```bash
npm run build
# serve dist/ over HTTPS
```

The app uses `HashRouter` and a relative `base: './'`, so it also works from
`file://` inside the Android WebView and from a sub-path without extra config.
A service worker precaches 58 entries (~8.5 MB) for offline use; Quran
translations and hadith packs are cached on first use.

**HTTPS is required** for geolocation, notifications and the service worker. On
plain HTTP those degrade with an explanatory message instead of failing
silently.

Android: see **[docs/ANDROID.md](docs/ANDROID.md)**.

---

## Content policy

These are enforced in code, not just intended:

- Quranic text is **imported from Tanzil**, never generated, and validated for
  completeness before release.
- **No hadith grade is ever asserted from the upstream `status` field**, which
  its own README warns is inaccurate. Bukhari and Muslim are treated as
  authentic at collection level; the four Sunan are shown without a grade and
  the limitation is disclosed in the UI.
- **No fabricated references.** Where a source gives a reference and grading, it
  is shown verbatim with the grading authority named. Where it does not, the app
  says so instead of inventing one.
- **No adhkar are machine-translated.** No permissive French translation of Hisn
  al-Muslim exists, so the app shows Arabic and English and states that plainly.
- **No adhan recording is redistributed.** Remote sources are configurable and
  probed; users may import their own files.

Full provenance, licences and attribution notices:
**[docs/DATA-SOURCES.md](docs/DATA-SOURCES.md)**.

---

## Privacy

- No account, no registration, no analytics, no ads, no trackers.
- No client-side secrets — everything in `.env.example` is safe to publish.
- Location stays on the device and is never uploaded.
- Settings live in `localStorage`; bookmarks and imported audio live in
  IndexedDB (`nur-al-iman`). Both can be wiped from Settings → Storage.
- Verified religious content is kept separate from user-generated data.

---

## Licence

The Quranic text is CC BY-SA 4.0 (Tanzil). Bundled datasets retain their
upstream MIT and CC BY-SA licences; attribution notices are shipped with the
app and listed in `docs/DATA-SOURCES.md`. Application code is provided as-is for
non-commercial religious use — review each upstream licence before redistributing.
