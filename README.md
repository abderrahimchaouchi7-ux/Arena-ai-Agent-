# RABT — Connect customers with trusted tradespeople

A mobile-first, bilingual (**French / Arabic**, full RTL) platform that connects
people who need work done with verified tradespeople: **water, gas, electricity,
plumbing, tiling, painting and construction**.

The problem it solves: customers struggle to *find* tradespeople, and even when
they do, they cannot tell whether they are **reliable**. RABT makes reliability
visible — rating, equipment level and years of experience are always public and
cannot be hidden.

> **Read the free-tier research first:**
> [`docs/FREE-TIER-RESEARCH.md`](docs/FREE-TIER-RESEARCH.md) verifies, with
> sources, that RABT can run completely free on mobile for ≥ 10 users — and
> explains why **Firebase alone cannot** (its free plan no longer includes photo
> storage).

---

## Quick start

```bash
npm install
npm run seed     # 12 tradespeople, 5 customers, reviews, teams, chat
npm run dev      # http://localhost:3000
```

Open the site on a phone (or in DevTools device mode). On a phone, use the
browser's **"Add to Home Screen"** to install it as an app.

### Demo accounts

Every seeded account uses the password **`rabt1234`**.

| Role | Email | What it shows |
|---|---|---|
| Artisan | `youssef.amrani@rabt.test` | Plumber, 12 yrs, professional kit, full portfolio |
| Artisan | `mehdi.berrada@rabt.test` | Construction, 20 yrs, owns a 4-person team |
| Artisan | `hamza.lahlou@rabt.test` | **Hides his phone number and real name** |
| Artisan | `amina.zerhouni@rabt.test` | **Hides her real name** |
| Artisan | `said.ouahbi@rabt.test` | **Private profile** — absent from search |
| Customer | `salma.client@rabt.test` | Has an existing conversation and reviews |

---

## How the requirements are implemented

### 1. Personal information
Name, surname, address, city, phone number and profile picture. Uploaded from
the phone gallery **or straight from the camera** (`capture="environment"`).
*Screen: Profile → "Mes informations".*

### 2. Experience and certificate
Years of experience (0–60) and an optional certificate/diploma photo. The
certificate is **access-controlled** — signed-in users can see it, anonymous
visitors get HTTP 403 (`src/lib/media.ts`).
*Screen: Profile → "Mon métier".*

### 3. Photos of previous work
Up to 12 portfolio photos per tradesperson, captioned, shown in a grid on the
public profile.
*Screen: Profile → "Photos de mes travaux".*

### 4. Equipment rating
Two levels — **Basique** (basic tools, small jobs) and **Professionnel** (full
kit, large sites). Always visible.
*Screen: Profile → "Niveau d'équipement".*

### Privacy — what a tradesperson can and cannot hide

| Field | Can hide? | Notes |
|---|:--:|---|
| Phone number | ✅ | Hidden from everyone |
| Real name | ✅ | Username is shown instead |
| Address / city | ✅ | Contact block hidden with the phone switch |
| Whole profile | ✅ | "Profil privé" removes it from search; direct link still works |
| Which regions they work in | ✅ | Choose one or several; drives regional search |
| **Rating** | ❌ | Always public |
| **Username** | ❌ | Always public |
| **Equipment level** | ❌ | Always public |
| **Years of experience** | ❌ | Always public |

**These rules are enforced on the server, not in the UI.** Every public read goes
through `serializeTrade()` in `src/lib/model.ts`, which strips the masked fields
before the response is built — a client cannot call the API and read them anyway.

### Other features

- **Search & filters** — free text, trade, region, equipment level, minimum
  rating. Private profiles are excluded from results by design.
- **Reviews** — 1–5 stars plus a comment. You cannot review yourself.
- **Teams** — create a work group for jobs needing more than two people
  (e.g. construction), invite other tradespeople, and every team automatically
  gets a **group chat**. Only tradespeople can be team members.
- **Chat** — text and images, 1-to-1 or group. Images are only readable by
  conversation participants.
- **18+ gate** — required at sign-up, for both roles: confirm the checkbox or
  provide a date of birth that proves it. The server rejects sign-ups without it.
- **Bilingual + RTL** — French and Arabic, switchable at any moment from the
  header. Arabic flips the entire layout to right-to-left.
- **Built for low literacy** — 18 px base type, 56 px minimum tap targets,
  icons on every button, pictograms for each trade, numbered step-by-step
  profile sections, and short plain-language sentences.

---

## Architecture

```
src/
  app/
    page.tsx              Landing — "Are you a tradesperson or a customer?"
    signup/  login/       Email + password, Google Sign-In, 18+ gate
    home/                 Dashboard
    search/               Filterable directory
    pro/[username]/       Public profile, portfolio, reviews, rating
    me/                   Profile editor (5 numbered sections + privacy)
    teams/  teams/[id]/   Team list, creation, members
    chat/   chat/[id]/    Conversations, text + image messaging
    api/                  Route handlers (auth, profile, search, teams, chat, media)
  components/             UI kit, language provider, bottom navigation
  lib/
    db.ts                 SQLite connection + schema bootstrap
    model.ts              Queries + privacy serialisation  ← the security boundary
    media.ts              Uploads + per-kind access control  ← the other boundary
    auth.ts               Sessions, scrypt passwords, Google OAuth
    i18n.ts               FR/AR dictionary
    config.ts             Trades, regions, equipment levels, limits
db/schema.mjs             Single source of truth for the schema
scripts/seed.mjs          Demo data + placeholder image generation
```

**Deliberate design choices**

- **Zero runtime dependencies** beyond Next.js and React. Passwords use
  `node:crypto` scrypt; the database is the built-in `node:sqlite`; Google OAuth
  is two `fetch` calls. `npm install` pulls 49 packages and there is nothing to
  compile — so it runs on the smallest free tier.
- **Chat polls every 3 s instead of using websockets.** Websockets are excluded
  from several free tiers and complicate serverless hosting; polling is free
  everywhere. `POLL_MS` in `src/app/chat/[id]/page.tsx`.
- **Two swappable files** are all that stand between this and a hosted backend:
  `src/lib/db.ts` (database) and `src/lib/media.ts` (file storage). Point them at
  Supabase/Postgres and Supabase Storage and the rest of the app is unchanged.
- **SQLite writes go through `data/`, which is git-ignored** — no user data or
  uploaded images ever enter version control.

---

## Google Sign-In

Works out of the box in **demo mode** (the button is clearly labelled and creates
a throw-away account) so you can evaluate the flow without credentials.

To enable the real thing:

1. Create OAuth credentials at
   <https://console.cloud.google.com/apis/credentials> → *OAuth 2.0 Client ID* →
   *Web application*.
2. Add this authorised redirect URI:
   `http://localhost:3000/api/auth/google/callback`
3. Copy `.env.example` to `.env.local` and set `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`.
4. Restart the dev server. The button switches from demo to real automatically
   (`/api/config` reports which mode is active).

---

## Running it free, on mobile, for 10+ users

Summary — full analysis with sources in [`docs/FREE-TIER-RESEARCH.md`](docs/FREE-TIER-RESEARCH.md):

| | Firebase Spark | **Supabase Free** | Appwrite Cloud Free |
|---|---|---|---|
| Card required | No | **No** | No |
| Photo storage | ❌ none | **1 GB** | 2 GB |
| Monthly active users | 50,000 | **50,000** | 75,000 |
| Concurrent realtime | 100 | **200** | included |

- **A 10-user trial needs ~85 MB of storage** — under 9 % of Supabase's free 1 GB.
- **Firebase Spark cannot host RABT** because Cloud Storage has required the
  Blaze plan since 3 Feb 2026, and photos are central to the product.
- **Mobile** is handled by the PWA: installable from the browser on iOS and
  Android, no app-store fee, camera access for work photos.
- ⚠️ Supabase and Appwrite free projects **pause after 1 week of inactivity**.

**Recommended: Supabase Free** (no card, includes storage) or **Appwrite Cloud
Free** (2 GB). See the research doc for the trade-offs and the Firebase Blaze
alternative.

---

## Roadmap before a real pilot

1. **Client-side image compression before upload** (resize ≈1600 px, quality 0.7).
   This is the highest-priority item: uncompressed phone photos are 3–6 MB and
   would exhaust 1 GB in a handful of portfolios.
2. Move file storage to Supabase Storage / S3.
3. Password reset and email verification.
4. Reporting and moderation before opening public search.
5. Push notifications for new messages.
6. In-app voice notes — useful where reading is difficult.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server on `0.0.0.0:3000` |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run seed` | Reset and reseed demo data |
| `npm run typecheck` | TypeScript, no emit |
