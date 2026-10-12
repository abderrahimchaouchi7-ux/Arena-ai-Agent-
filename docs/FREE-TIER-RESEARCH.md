# RABT — Free-tier research: can we run this free, on mobile, for ≥ 10 users?

**Question asked:** confirm, with sources, that RABT can run as a completely free
version on mobile devices supporting at least 10 users.

**Answer: yes — with one important caveat that changes the stack choice.**
RABT is a *photo-heavy* app (profile pictures, certificates, portfolios of past
work, chat images). Firebase's free "Spark" plan **cannot store photos at all**
any more, so the genuine no-card options are Supabase Free or Appwrite Cloud Free.

---

## 1. The headline finding: Firebase Cloud Storage is no longer free

This is the trap. Many blog posts still list "5 GB Cloud Storage" as a Firebase
free-tier benefit. Google's own pricing table now marks every Cloud Storage row
as **"Not applicable"** for the Spark (free) plan — those numbers live in the
Blaze (pay-as-you-go) column. [1](https://firebase.google.com/pricing?hl=en)

Google's dedicated FAQ confirms it:

> "To use Cloud Storage for Firebase, your Firebase project must be on the
> pay-as-you-go Blaze pricing plan. … If your Firebase project is on the Spark
> pricing plan, you won't have access to any Cloud Storage buckets (including
> default buckets), and your API calls to buckets will return 402 or 403 errors."
> [2](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)

> "This requirement went into effect starting **February 03, 2026**."
> [2](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)

Note also that Firebase's own *plans* page still says Spark includes "no-cost
usage quotas for paid Firebase products (like Cloud Firestore, Cloud Storage, and
Hosting)" [3](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans?hl=en) —
that sentence is stale and contradicts the pricing table. The pricing table and
the Storage FAQ are the authoritative sources. Third-party trackers have flagged
and corrected the same discrepancy. [4](https://www.budgetforge.dev/tools/firebase-pricing-2026)

**Consequence for RABT:** on pure Firebase Spark you could do auth, database and
hosting for free, but every photo upload would fail with HTTP 402/403.

---

## 2. Comparison table (verified Oct 2026)

| | **Firebase Spark** | **Supabase Free** | **Appwrite Cloud Free** |
|---|---|---|---|
| Price | $0 | $0 | $0 |
| Credit card required | **No** | **No** | **No** |
| **File storage (photos)** | ❌ **none — Blaze only** | ✅ **1 GB** [5](https://supabase.com/pricing) | ✅ **2 GB** [6](https://appwrite.io/pricing) |
| Auth monthly active users | 50,000 [1](https://firebase.google.com/pricing?hl=en) | 50,000 [5](https://supabase.com/pricing) | 75,000 [6](https://appwrite.io/pricing) |
| Google Sign-In | ✅ (social providers) [1](https://firebase.google.com/pricing?hl=en) | ✅ | ✅ |
| Email + password auth | ✅ | ✅ | ✅ |
| Database | Firestore 1 GiB, 50K reads/day, 20K writes/day [1](https://firebase.google.com/pricing?hl=en) | Postgres 500 MB [5](https://supabase.com/pricing) | 1 DB, 500K reads/mo [6](https://appwrite.io/pricing) |
| Realtime / chat | Realtime DB: 1 GB, **100 simultaneous connections** [1](https://firebase.google.com/pricing?hl=en) | 200 concurrent connections, 2M messages/mo [7](https://designrevision.com/blog/supabase-pricing) | Realtime included [6](https://appwrite.io/pricing) |
| Hosting | 10 GB storage, 360 MB/day transfer [1](https://firebase.google.com/pricing?hl=en) | — (static via others) | Sites: unlimited [6](https://appwrite.io/pricing) |
| Server functions | ❌ Blaze only [1](https://firebase.google.com/pricing?hl=en) | 500K invocations/mo [7](https://designrevision.com/blog/supabase-pricing) | 750K executions/mo [6](https://appwrite.io/pricing) |
| Inactivity behaviour | — | **Pauses after 1 week idle** [5](https://supabase.com/pricing) | **Pauses after 1 week idle** [6](https://appwrite.io/pricing) |
| Max file size | n/a | 50 MB [8](https://infrafree.dev/en-us/provider/supabase) | 50 MB [6](https://appwrite.io/pricing) |
| Project limit | ~5–10 [9](https://agentdeals.dev/vendor/firebase) | 2 active [5](https://supabase.com/pricing) | 2 [6](https://appwrite.io/pricing) |

---

## 3. Does it support "at least 10 users"?

Comfortably — by three to four orders of magnitude on the binding constraint.

| Requirement | Limit on the free tier | Headroom for 10 users |
|---|---|---|
| **10 registered users** | 50,000 MAU (Supabase/Firebase) or 75,000 MAU (Appwrite) | **5,000×** |
| **10 users online at once** | 200 concurrent realtime connections (Supabase) [7](https://designrevision.com/blog/supabase-pricing); 100 simultaneous (Firebase Realtime DB) [1](https://firebase.google.com/pricing?hl=en) | **10–20×** |
| **10 users chatting** | 2,000,000 realtime messages/month (Supabase) [7](https://designrevision.com/blog/supabase-pricing) | **very large** |
| **Database operations** | 50,000 Firestore reads/day (Spark) [1](https://firebase.google.com/pricing?hl=en) | 10 active users generate a few thousand reads/day |
| **Photo storage** | 1 GB (Supabase) / 2 GB (Appwrite) | see below |

**Storage budget for a 10-user trial.** RABT stores four kinds of image. With the
client-side cap already set in the code (6 MB per file, `MAX_UPLOAD_BYTES` in
`src/lib/config.ts`) and a realistic mobile photo of ~250 KB after compression:

| Item | Per user | × 10 users |
|---|---|---|
| Profile picture | 1 × 250 KB | 2.5 MB |
| Certificate | 1 × 250 KB | 2.5 MB |
| Portfolio photos (up to 12) | 12 × 250 KB = 3 MB | 30 MB |
| Chat images | ~20 × 250 KB = 5 MB | 50 MB |
| **Total** | **~9 MB** | **~85 MB** |

85 MB sits at **8.5 % of Supabase's 1 GB** and **4 % of Appwrite's 2 GB**. The
10-user trial is not remotely close to a storage limit.

> ⚠️ The real risk is not the *user count* — it is **uncompressed phone photos**.
> A modern phone photo is 3–6 MB, so 12 portfolio images would be ~50 MB *per
> user* and ten users would reach ~500 MB. **Client-side image compression before
> upload is the single most important thing to add before a real pilot.** It is
> listed as the top item in the roadmap below.

---

## 4. Mobile: yes, via a PWA (no app store, no fee)

RABT ships as an installable Progressive Web App (`public/manifest.webmanifest`
+ `public/sw.js`, icons in `public/icons/`). On both Android and iOS a user taps
"Add to Home Screen" in the browser and gets a full-screen app icon.

- Works on any smartphone with a browser — no App Store / Play Store review,
  no $99/yr Apple fee, no $25 Play fee.
- Camera access works in the browser: the portfolio and chat upload inputs use
  `capture="environment"` so tapping "Photo" opens the camera directly.
- Service worker caches the shell so it still opens with a flaky connection.
- Free hosting for the shell: **Firebase Hosting Spark** (10 GB storage,
  360 MB/day transfer) [1](https://firebase.google.com/pricing?hl=en), or Vercel /
  Netlify / Cloudflare Pages free tiers.

If you later want a *native* app in the stores, the same PWA can be wrapped with
Capacitor at no software cost (you would still pay the store registration fees).

---

## 5. Recommendation

### Option A — "No credit card, ever" → **Supabase Free** (recommended)

- 1 GB photo storage on the free plan, no card required. [5](https://supabase.com/pricing)
- 50,000 MAU and 200 concurrent realtime connections — far beyond 10 users.
- Postgres + Storage + Auth + Realtime in one place, which maps exactly onto
  RABT's needs (profiles, photos, Google login, chat).
- **Watch out:** free projects **pause after 1 week of inactivity** [5](https://supabase.com/pricing)
  and there are **no backups**. If you demo RABT to tradespeople only
  occasionally, expect a cold start; for a pilot with real users this is fine.

### Option B — "No card, want more storage" → **Appwrite Cloud Free**

- 2 GB storage (double Supabase) and 75,000 MAU. [6](https://appwrite.io/pricing)
- Same inactivity pause caveat; only 1 bucket and 1 org member on free.

### Option C — "Google-native, card on file is OK" → **Firebase Blaze**

- Blaze has **no monthly minimum** and still includes the Spark no-cost quotas
  plus 5 GB of Cloud Storage. [1](https://firebase.google.com/pricing?hl=en)
- You must add a payment method, but with a budget alert set to 0 you will not be
  charged while inside the free quotas.
- Best fit if you want Firebase Auth's Google Sign-In, FCM push notifications and
  the Firebase ecosystem as you scale.

**Bottom line:** the free, no-card, mobile-friendly, ≥10-user target is met by
Supabase Free and Appwrite Cloud Free. Firebase alone does **not** meet it,
because photo storage is Blaze-only as of 3 Feb 2026 — and photos are the core of
RABT's trust model.

---

## 6. What this repository does about it

The code in this repo is deliberately **storage-agnostic and dependency-light**:

- `src/lib/db.ts` is the only place that touches the database (SQLite via the
  built-in `node:sqlite`), so swapping in Supabase/Postgres means rewriting one
  file.
- `src/lib/media.ts` is the only place that touches files; it enforces a 6 MB cap
  and per-kind access rules, so swapping in Supabase Storage / S3 is one file.
- No paid SDK, no native dependencies: `npm install` pulls 49 packages.

---

## Roadmap before a real pilot

1. **Client-side image compression** before upload (resize to ~1600 px, quality
   0.7). Highest priority — see the storage warning above.
2. Optional: move uploads to Supabase Storage (or Cloudinary's free 25 GB
   transform credits) so images do not consume the database host's disk.
3. Add password reset and email verification.
4. Add moderation/reporting before opening public search.

---

## Sources

1. Firebase pricing (official) — https://firebase.google.com/pricing?hl=en
2. Firebase, "Default bucket and billing requirements for Cloud Storage for
   Firebase after September 2024" —
   https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
3. Firebase pricing plans (official) —
   https://firebase.google.com/docs/projects/billing/firebase-pricing-plans?hl=en
4. BudgetForge, "Firebase Pricing in 2026" (documents the Spark/Blaze correction) —
   https://www.budgetforge.dev/tools/firebase-pricing-2026
5. Supabase pricing (official) — https://supabase.com/pricing
6. Appwrite pricing (official) — https://appwrite.io/pricing
7. DesignRevision, "Supabase Pricing 2026: Free Tier Limits & Real Costs" —
   https://designrevision.com/blog/supabase-pricing
8. InfraFree, "Supabase Free Tier Guide" — https://infrafree.dev/en-us/provider/supabase
9. AgentDeals, "Firebase Free Tier 2026" — https://agentdeals.dev/vendor/firebase
10. Logto, "2026 Firebase Authentication's latest pricing explained" —
    https://blog.logto.io/firebase-authentication-pricing
