# External Integrations

**Analysis Date:** 2026-06-14

## APIs & External Services

**Backend-as-a-Service:**
- Supabase - Core data, auth, storage, realtime, and edge functions
  - SDK/Client: `@supabase/supabase-js` ^2.98.0
  - Project URL: `https://rcqichlyllhwougopfkg.supabase.co` (also readable via `VITE_SUPABASE_URL`)
  - Auth: `VITE_SUPABASE_ANON_KEY` (frontend), `SUPABASE_SERVICE_ROLE_KEY` (Edge Functions)
  - Client config: `src/lib/supabase.js`

**Payments:**
- Stripe - One-time payment checkout for Premium upgrades and Boost promotions
  - SDK: `stripe@14` via `https://esm.sh/stripe@14?target=deno` (Deno only)
  - API version: `2024-09-30.acacia`
  - Auth: `STRIPE_SECRET_KEY` (server-side only, never exposed to frontend)
  - Premium checkout: `supabase/functions/create-premium-checkout/index.ts`
    - Packages: premium (€49), club (€199), league (€999) — one-time payments
  - Boost checkout: `supabase/functions/create-boost-checkout/index.ts`
    - Tiers: top, highlight, both — 3/7/14 day durations, €2.99–€19.99
  - Refunds: `supabase/functions/widerruf/index.ts` — EU statutory withdrawal within 14 days
  - No Stripe webhooks detected; checkout session IDs stored in `premium_purchases` and `tournament_promotions` tables with `status: 'pending'`

**Error Monitoring:**
- Sentry - Frontend error tracking and performance monitoring
  - SDK: `@sentry/react` ^10.56.0 + `@sentry/vite-plugin` ^5.3.0
  - DSN: `https://4ce1f09bfcdb2525763ce4466564c158@o4511507613089792.ingest.de.sentry.io/4511507636093008`
  - Org: `comms-connect-gmbh`, project: `swing-and-savor`
  - Traces sample rate: 10% (`tracesSampleRate: 0.1`)
  - PII: disabled (`sendDefaultPii: false`)
  - Init: `src/sentry.js`, loaded before React in `src/main.jsx`
  - Source maps uploaded at build time via `vite.config.js` Sentry plugin (requires `SENTRY_AUTH_TOKEN`)

**Transactional Email:**
- Resend - Withdrawal confirmation emails (EU legal requirement)
  - Auth: `RESEND_API_KEY` (Edge Function secret)
  - From address: `hi@swingandsavor.at`
  - Used in: `supabase/functions/widerruf/index.ts`

**Cross-Promotion:**
- DealBuddy - External golf challenge app, deep-link cross-promotion only
  - Web: `https://app.deal-buddy.app`
  - iOS App Store: `https://apps.apple.com/de/app/id6763754507`
  - Android Play: `https://play.google.com/store/apps/details?id=de.dealbuddy.app`
  - Integration: `src/lib/dealbuddy.js` — builds UTM-tagged deep links, no SDK, no API calls
  - Used in: `src/screens/FriendsScreen.jsx`, `src/screens/ProfileScreen.jsx`

**Golf Course Data:**
- GolfCourseAPI (upstream) - Course import via Supabase Edge Function
  - Invoked via: `supabase.functions.invoke('import-courses', { body: { q } })` in `src/lib/courses.js`
  - Edge function `import-courses` not present in local repo (deployed separately or not yet scaffolded)
- OpenStreetMap (Overpass API) - Regional course seeding
  - Invoked via: `supabase.functions.invoke('osm-seed-courses', { body: opts })` in `src/lib/courses.js`
  - Edge function `osm-seed-courses` not present in local repo

**Community/Social:**
- Discord - Optional Discord bot for guild setup
  - SDK: `discord.js` ^14.16.3
  - Implementation: `discord/` subdirectory (standalone Node.js scripts)
  - Auth: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CLIENT_ID` (see `discord/.env.example`)
  - Not integrated into the main React app

## Data Storage

**Databases:**
- Supabase Postgres (hosted)
  - Connection: `VITE_SUPABASE_URL` / `SUPABASE_URL`
  - Client: `@supabase/supabase-js` (PostgREST REST API + RLS)
  - Schema managed via migrations in `supabase/migrations/` (29 migration files)
  - Key tables: `profiles`, `tournaments`, `matches`, `hole_results`, `players`, `courses`, `conversations`, `messages`, `match_reactions`, `match_comments`, `push_subscriptions`, `premium_purchases`, `tournament_promotions`, `friendships`, `widerruf_requests`
  - Realtime subscriptions: `messages`, `match_reactions`, `match_comments`, `matches` tables (`src/lib/liveEvents.js`)
  - RLS enabled throughout; `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS in Edge Functions

**File Storage:**
- Supabase Storage
  - Bucket `avatars`: user profile photos, max 512px, JPEG/PNG (`src/lib/avatar.js`)
  - Bucket `match-photos`: match photos + cup cover images (`src/lib/photo.js`)
  - Public URLs served directly from Supabase CDN

**Caching:**
- None (no Redis/Memcache)
- Browser localStorage used for: auth session (`sas-auth`), referral codes (`sns_ref_code`), language preference (`sns_lang`)
- Service worker (`public/sw.js`, `public/sw-push.js`) for PWA offline/push

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in)
  - Magic link / email-based login (passwordless)
  - Session persistence via localStorage key `sas-auth`
  - Auto token refresh enabled
  - Implementation: `src/lib/auth.jsx` — `AuthProvider` context wraps the entire app
  - Profile fetching: `profiles` table (separate from `auth.users`)
  - Reviewer bypass for Apple/Google store review: `supabase/functions/reviewer-bypass/index.ts` — generates magic links for `apple-review@swingandsavor.at` and `play-review@swingandsavor.at`

## Push Notifications

**Web Push (VAPID):**
- Self-hosted VAPID via Supabase Edge Function
  - Library: `@negrel/webpush@0.3.0` (Deno) in `supabase/functions/send-push/index.ts`
  - VAPID keys: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (Edge Function secrets)
  - Frontend key: `VITE_VAPID_PUBLIC_KEY` (public, safe to expose)
  - Service worker: `public/sw-push.js`
  - Subscription storage: `push_subscriptions` table
  - Frontend registration: `src/lib/webPush.js`
  - Delivery triggered by DB triggers via `pg_net` → `send-push` Edge Function

**Native Push (iOS/Android):**
- `@capacitor/push-notifications` 7.0.6 — native push via APNs (iOS) and FCM (Android)
  - Configured in `native/package.json`; platform-level setup via Capacitor

## Device / Platform Integrations

**Apple Watch:**
- Custom `WatchBridge` Capacitor plugin (Swift + ObjC)
  - Source: `native/ios/App/App/Plugins/WatchBridge.swift` + `WatchBridge.m`
  - JS bridge: `src/lib/watchBridge.js`
  - Publishes active match data to the watch; receives hole-by-hole score entries back
  - Separate watchOS app: `native/ios/SwingSavorWatch/`
  - iOS-only; no-ops on all other platforms

**Geolocation:**
- Browser native `navigator.geolocation` API
  - Used in: `src/lib/courses.js` (`getCurrentLocation()`) for "courses near me" feature

**Web Share API:**
- Browser native `navigator.share` (with `navigator.canShare` feature detection)
  - Used in: `src/lib/shareCard.js` (`shareOrDownload()`) for sharing Canvas-rendered match cards
  - Falls back to file download when Share API unavailable

**Canvas Rendering:**
- Browser native Canvas 2D — no external library
  - `src/lib/shareCard.js` — 1080×1080 match recap card
  - `src/lib/cardRenderer.js` — 1080×1920 story overlay, 1080×1080 champion card, 1080×1350 portrait card

## Monitoring & Observability

**Error Tracking:**
- Sentry (see APIs section above)
  - `browserTracingIntegration` enabled for performance spans

**Logs:**
- Edge Functions: `console.error` / `console.warn` → Supabase function logs
- Frontend: `src/lib/debug.js` — `logDebug()` utility for structured debug output

## CI/CD & Deployment

**Hosting:**
- Web app: Vercel — `vercel.json` at repo root
  - Framework: vite, output: `dist/`
  - Edge Function `api/og.js` — OG meta-tag server-side rendering for social crawlers
  - Crawler routes: `/i/:slug*`, `/recap/:slug*`, `/hall/:slug*`, `/crew/:slug*`, `/season/:slug*`, `/savor/o/:slug*`
- Marketing site: separate Vercel project — `marketing/vercel.json`

**CI Pipeline:**
- GitHub Actions (`.github/workflows/`)
  - `ios-release.yml` — builds IPA on `macos-26`, optionally uploads to TestFlight; triggered by `ios-v*` tags or manual dispatch
  - `android-release.yml` — builds AAB on `ubuntu-latest` (JDK 21, Android SDK 35), optionally uploads to Play Internal Track; triggered by `android-v*` tags or manual dispatch
  - `android-keystore-bootstrap.yml` — one-time keystore generation helper

## Webhooks & Callbacks

**Incoming:**
- No inbound webhook endpoints detected for Stripe (no `/api/webhook` route). Stripe session status is reconciled via client-side redirect to success/cancel URLs, with `stripe_session_id` stored for lookup.
- Supabase Realtime used for live data push instead of webhooks

**Outgoing:**
- Supabase `pg_net` (DB trigger) → `send-push` Edge Function — triggered on new messages/reactions/comments to deliver Web Push notifications (`supabase/migrations/007_push_triggers.sql`)

## Environment Configuration

**Required frontend env vars:**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key

**Optional frontend env vars:**
- `VITE_VAPID_PUBLIC_KEY` — Web Push VAPID public key (push disabled if absent)
- `SENTRY_AUTH_TOKEN` — Build-time only, for source map upload

**Required Edge Function secrets (set in Supabase dashboard):**
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `RESEND_API_KEY`

**Secrets location:**
- Frontend: `.env` file (not committed); Vercel environment variables for production
- Edge Functions: Supabase project secrets (set via `supabase secrets set` or dashboard)
- CI: GitHub Actions secrets (keystore password, App Store Connect API key, Play JSON key)

---

*Integration audit: 2026-06-14*
