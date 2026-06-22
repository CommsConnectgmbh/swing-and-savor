# Codebase Structure

**Analysis Date:** 2026-06-14

## Directory Layout

```
swing-and-savor/
├── src/                        # React SPA source
│   ├── main.jsx                # App entry point (ReactDOM.createRoot)
│   ├── App.jsx                 # Router root, auth gate, persistent chrome
│   ├── sentry.js               # Sentry init (imported first by main.jsx)
│   ├── index.css               # Global CSS (Tailwind base + custom tokens)
│   ├── cc-glassnav.css         # Comms CI glass nav component styles
│   ├── test-setup.js           # Vitest/JSDOM test configuration
│   ├── screens/                # Full-page route components (25 screens)
│   ├── components/             # Shared/reusable UI components
│   │   └── support/            # Support center sub-component
│   ├── lib/                    # Services, utilities, bridges, pure logic
│   │   └── cc/                 # Comms CI design system hooks (TypeScript)
│   └── locales/                # i18n translation files (JSON)
│       ├── de.json
│       ├── en.json
│       ├── es.json
│       ├── fr.json
│       └── ja.json
├── supabase/                   # Backend-as-a-service configuration
│   ├── functions/              # Deno Edge Functions (6 functions)
│   └── migrations/             # SQL migration files (032 migrations)
├── native/                     # Capacitor native shells
│   ├── ios/                    # Xcode project (iOS + Apple Watch)
│   │   ├── App/                # Main iOS Capacitor app
│   │   └── SwingSavorWatch/    # watchOS companion app
│   ├── android/                # Android Capacitor app
│   ├── assets/                 # Shared native assets
│   ├── icons/                  # App icon sources
│   ├── scripts/                # Native build helper scripts
│   └── www/                    # Built web assets synced by Capacitor
├── public/                     # Vite public assets (served as-is)
│   ├── icons/                  # PWA/favicon icons
│   └── .well-known/            # Apple App Site Association, etc.
├── api/                        # Vercel serverless functions
│   └── og.js                   # Open Graph image generation
├── .github/
│   └── workflows/              # CI/CD pipelines (iOS release, Android release, keystore bootstrap)
├── .apple-bootstrap/           # ASC (App Store Connect) automation scripts (Node.js)
├── discord/                    # Discord community bot scripts
├── docs/                       # Internal documentation + design plans
├── marketing/                  # Marketing assets + screenshot scripts
├── scripts/                    # App Store screenshot generation scripts
├── .planning/                  # GSD planning artefacts
│   └── codebase/               # Codebase map documents (this directory)
├── index.html                  # Vite HTML entry point
├── vite.config.js              # Vite + Vitest build/test config
├── package.json                # npm manifest
├── tailwind.config.js          # (if present) Tailwind configuration
└── SETUP.md                    # Developer setup guide
```

## Directory Purposes

**`src/screens/`:**
- Purpose: One file per app route — full-page views
- Contains: 25 `.jsx` files, each a default-exported React component
- Key files:
  - `src/screens/HomeScreen.jsx` — social feed, active matches, cup cards
  - `src/screens/CupScreen.jsx` — tournament management (create, edit, manage players)
  - `src/screens/MatchDetailScreen.jsx` — live hole-by-hole scoring, Apple Watch sync
  - `src/screens/CasualScreen.jsx` — casual match-play (no tournament, HCP-aware)
  - `src/screens/SavorScreen.jsx` — marketplace/deals browse (calls `public-savor` Edge Function)
  - `src/screens/ProfileScreen.jsx` — own and public player profiles
  - `src/screens/AdminScreen.jsx` — admin-only moderation tools
  - `src/screens/SignInScreen.jsx` — auth entry (eager, not lazy-loaded)
  - `src/screens/OnboardingScreen.jsx` — new user profile setup (eager, not lazy-loaded)
  - `src/screens/PublicCupScreen.jsx` — unauthenticated cup share page (`/c/:inviteCode`)

**`src/components/`:**
- Purpose: Shared UI composed by multiple screens
- Contains: Bottom sheet modals, dialogs, social UI, persistent chrome
- Key files:
  - `src/components/BottomNav.jsx` — glass pill navigation bar (Swing vs. Savor mode tabs)
  - `src/components/BrandHeader.jsx` — top header with route title
  - `src/components/Toaster.jsx` — in-app toast notification overlay
  - `src/components/CreateSheet.jsx` — FAB "New" sheet (create cup/match/casual)
  - `src/components/SocialBar.jsx` — like + comment bar for match cards
  - `src/components/CommentsThread.jsx` — expandable comments thread
  - `src/components/CourseEditor.jsx` / `CoursePicker.jsx` — course search + par/HCP editing
  - `src/components/ScorecardSheet.jsx` — match scorecard bottom sheet
  - `src/components/BoostSheet.jsx` — premium boost purchase flow
  - `src/components/QrCodeSheet.jsx` — QR invite code display
  - `src/components/WinnerCardSheet.jsx` — winner card canvas export sheet
  - `src/components/support/SupportCenter.jsx` — in-app support center

**`src/lib/`:**
- Purpose: Domain services, platform bridges, pure utilities — no JSX
- Key files:
  - `src/lib/supabase.js` — singleton Supabase client (import this everywhere)
  - `src/lib/auth.jsx` — AuthProvider + useAuth hook
  - `src/lib/scoring.js` — pure golf scoring math (no imports)
  - `src/lib/liveEvents.js` — Supabase Realtime channel manager
  - `src/lib/toast.js` — module-level pub/sub toast bus
  - `src/lib/watchBridge.js` — Capacitor Apple Watch plugin bridge
  - `src/lib/i18n.js` — i18next initialisation with 5 locales
  - `src/lib/social.js` — likes, comments, reactions CRUD
  - `src/lib/courses.js` — course search (`search_courses` RPC) + CRUD
  - `src/lib/photo.js` — Supabase Storage upload for match photos and cup covers
  - `src/lib/shareCard.js` — Canvas 1080×1080 match recap card renderer
  - `src/lib/cardRenderer.js` — Canvas winner card + story overlay renderers
  - `src/lib/stats.js` — player match statistics aggregation
  - `src/lib/autopair.js` — handicap-based pairing suggestions (pure, no I/O)
  - `src/lib/tournamentGate.js` — tournament password gating
  - `src/lib/referral.js` — referral code capture + `localStorage` storage
  - `src/lib/dealbuddy.js` — cross-promotion deep links to DealBuddy app
  - `src/lib/webPush.js` — Web Push subscription management
  - `src/lib/widerruf.js` — German right-of-withdrawal (Widerruf) logic
  - `src/lib/avatar.js` — avatar URL resolution
  - `src/lib/share.js` — native share API wrapper
  - `src/lib/debug.js` — dev telemetry to `client_debug` Supabase table
  - `src/lib/debounce.js` — debounce utility

**`src/lib/cc/`:**
- Purpose: Comms CI design-system hooks (TypeScript, framework-independent)
- Key files:
  - `src/lib/cc/useHideOnScroll.ts` — glass bottom nav hide-on-scroll behaviour

**`src/locales/`:**
- Purpose: i18n translation JSON bundles
- Supported languages: German (`de`), English (`en`), Spanish (`es`), French (`fr`), Japanese (`ja`)
- Fallback language: `en`

**`supabase/functions/`:**
- Purpose: Deno Edge Functions for server-side operations requiring secrets
- Key files:
  - `supabase/functions/create-premium-checkout/index.ts` — Stripe premium checkout session
  - `supabase/functions/create-boost-checkout/index.ts` — Stripe boost checkout session
  - `supabase/functions/send-push/index.ts` — VAPID Web Push delivery (called by DB trigger)
  - `supabase/functions/delete-account/index.ts` — GDPR account deletion
  - `supabase/functions/reviewer-bypass/index.ts` — App Store reviewer bypass
  - `supabase/functions/widerruf/index.ts` — Widerruf email + logging

**`supabase/migrations/`:**
- Purpose: Ordered SQL schema migrations (001–032)
- Key migrations:
  - `001_initial.sql` — core tables: `tournaments`, `players`, `matches`, `hole_results`
  - `005_social_layer_v2.sql` — friendships, conversations, messages
  - `006_reactions_comments_push_format.sql` — `match_reactions`, `match_comments`, `push_subscriptions`
  - `017_savor_marketplace.sql` — Savor marketplace tables
  - `030_casual_rounds.sql` — casual (non-tournament) match-play rounds
  - `031_widerruf_requests.sql` / `032_widerruf_consent_columns.sql` — legal Widerruf tracking

**`native/`:**
- Purpose: Capacitor native app shells (not part of the React source build)
- `native/ios/App/` — iOS Xcode project (loads `native/www/` as the webview)
- `native/ios/SwingSavorWatch/` — watchOS companion app (Swift, communicates via `WatchBridge` plugin)
- `native/android/` — Android Gradle project

**`public/`:**
- Purpose: Static files served verbatim by Vite (not bundled)
- Contains: PWA manifest, favicon, app icons, Service Worker (`sw-push.js`), `.well-known/` (Apple App Site Association)

**`api/`:**
- Purpose: Vercel serverless functions for edge-rendered API endpoints
- `api/og.js` — Open Graph image generation for social share previews

## Key File Locations

**Entry Points:**
- `src/main.jsx` — React root mount, providers, CSS + i18n imports
- `index.html` — Vite HTML template (single div#root)

**Configuration:**
- `vite.config.js` — build config, manual chunks, Vitest test config
- `package.json` — dependencies, scripts (`dev`, `build`, `test`, `lint`)

**Core Logic:**
- `src/App.jsx` — all route definitions and auth-gate logic
- `src/lib/auth.jsx` — complete auth + profile lifecycle
- `src/lib/supabase.js` — the single Supabase client instance
- `src/lib/scoring.js` — all golf scoring calculations

**Testing:**
- `src/lib/scoring.test.js` — unit tests for scoring utilities
- `src/test-setup.js` — Vitest + JSDOM setup

## Naming Conventions

**Files:**
- Screens: `PascalCase` + `Screen` suffix — `HomeScreen.jsx`, `MatchDetailScreen.jsx`
- Components: `PascalCase` — `BottomNav.jsx`, `SocialBar.jsx`
- Sheets (modal overlays): `PascalCase` + `Sheet` suffix — `CreateSheet.jsx`, `BoostSheet.jsx`
- Lib/services: `camelCase` — `supabase.js`, `liveEvents.js`, `shareCard.js`
- Hooks: `camelCase` starting with `use` — `useHideOnScroll.ts`
- Migrations: zero-padded number + snake_case description — `030_casual_rounds.sql`

**Directories:**
- `src/screens/` — all screen components flat (no subdirectories per feature)
- `src/components/` — shared components flat; `support/` subdirectory is the one exception
- `src/lib/` — flat; `cc/` subdirectory holds the Comms CI design system hooks
- `supabase/functions/` — one subdirectory per Edge Function named as `kebab-case`

## Where to Add New Code

**New Screen:**
- Implementation: `src/screens/NewFeatureScreen.jsx`
- Add lazy import + Route in: `src/App.jsx` (follow the existing `lazy(() => import(...))` pattern)
- Add nav label to `HeaderForRoute` titles map in `src/App.jsx` if it needs a header title
- If it needs a nav tab, add to `swingTabs` or `savorTabs` in `src/components/BottomNav.jsx`

**New Shared Component:**
- Implementation: `src/components/NewComponent.jsx`
- If it's a bottom-sheet modal: follow naming pattern `NewThingSheet.jsx`
- Sheet open state is managed by the parent screen or component that triggers it

**New Data Access / Domain Logic:**
- If it wraps Supabase calls: `src/lib/newDomain.js` — import `{ supabase }` from `./supabase`
- If it's pure math/utils: `src/lib/newUtil.js` — no imports required
- If it needs server-side secrets: create a new Supabase Edge Function in `supabase/functions/new-function/index.ts`

**New Database Table:**
- Create migration: `supabase/migrations/033_description.sql` (next sequential number)
- Enable RLS and define policies in the same migration file
- Add the table to `supabase_realtime` publication if realtime events are needed

**New Locale String:**
- Add key/value to all 5 locale files: `src/locales/de.json`, `en.json`, `es.json`, `fr.json`, `ja.json`
- Use `const { t } = useTranslation()` in the component, then `t('key', 'fallback')`

**New Canvas Card Template:**
- Add export to the appropriate renderer — match share cards go in `src/lib/shareCard.js`; winner/social cards go in `src/lib/cardRenderer.js`

## Special Directories

**`native/www/`:**
- Purpose: Built web assets synced into the Capacitor native shell by `npx cap sync`
- Generated: Yes (copy of `dist/` output)
- Committed: No (excluded from source control, built during CI)

**`supabase/.temp/`:**
- Purpose: Supabase CLI temporary state (linked project config)
- Generated: Yes
- Committed: Partially (`.temp/linked-project.json` may be committed for team consistency)

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents consumed by `/gsd:plan-phase` and `/gsd:execute-phase`
- Generated: Yes (by `/gsd:map-codebase`)
- Committed: Yes

**`scripts/asc-screenshots/output/`:**
- Purpose: Generated App Store Connect screenshot images
- Generated: Yes
- Committed: No

**`.apple-bootstrap/`:**
- Purpose: One-time App Store Connect bootstrap automation (Node.js scripts using App Store Connect API)
- Generated: No
- Committed: Yes (scripts are source, not output)

---

*Structure analysis: 2026-06-14*
