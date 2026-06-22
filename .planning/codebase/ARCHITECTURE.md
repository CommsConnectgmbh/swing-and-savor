<!-- refreshed: 2026-06-14 -->
# Architecture

**Analysis Date:** 2026-06-14

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Browser / Capacitor Shell                           │
│                     (iOS, Android, PWA, Web)                                │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│   Public Routes      │   Auth Guard         │   Native Bridge               │
│  `/c/`, `/i/`,       │  `<AuthProvider>`    │  `src/lib/watchBridge.js`     │
│  `/recap/`, `/hall/` │  `src/lib/auth.jsx`  │  Capacitor WatchBridge plugin │
└──────────┬───────────┴────────┬─────────────┴───────────────────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       src/App.jsx  (Router Root)                            │
│  React Router v6 · Lazy-loaded screens · BrandHeader + BottomNav shells     │
└──────────────────────────┬──────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────────────────────────┐
           ▼               ▼                                   ▼
┌──────────────┐  ┌──────────────────────────────┐  ┌─────────────────────────┐
│   Screens    │  │        Components             │  │       Lib Layer         │
│ src/screens/ │  │      src/components/          │  │      src/lib/           │
│ (25 screens) │  │  (shared UI, sheets, dialogs) │  │ (services, utilities,   │
│              │  │                               │  │  bridges, pure logic)   │
└──────┬───────┘  └──────────────┬────────────────┘  └──────────┬──────────────┘
       │                         │                               │
       └─────────────────────────┴───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Supabase (BaaS)                                        │
│  PostgreSQL · RLS · Realtime Channels · Storage Buckets · Edge Functions    │
│  `src/lib/supabase.js`                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                     ┌───────────┴────────────┐
                     ▼                        ▼
            ┌─────────────────┐    ┌───────────────────────┐
            │  Edge Functions │    │  Supabase Storage     │
            │ supabase/       │    │  bucket: match-photos │
            │ functions/      │    │  (match photos,       │
            │ (Deno/TypeScript│    │   cup covers,         │
            │  — 6 functions) │    │   avatars)            │
            └─────────────────┘    └───────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `App` | Route tree, auth gating, live-events bootstrap | `src/App.jsx` |
| `AuthProvider` | Session hydration, profile loading, auth state context | `src/lib/auth.jsx` |
| `supabase` | Singleton Supabase client (shared across all lib modules) | `src/lib/supabase.js` |
| Screens (`/screens/*.jsx`) | Full-page views — own local state, fetch data, compose components | `src/screens/` |
| Shared Components | Reusable UI: sheets, dialogs, social bar, toaster | `src/components/` |
| `startLiveEvents` | App-wide Supabase Realtime channels; pushes in-app toasts | `src/lib/liveEvents.js` |
| `toast` bus | Pub/sub event bus (module-level Set); no React dependency | `src/lib/toast.js` |
| `scoring` | Pure golf scoring math (match standing, Stableford, casualplay) | `src/lib/scoring.js` |
| `watchBridge` | Capacitor plugin bridge to Apple Watch companion app | `src/lib/watchBridge.js` |
| `i18n` | i18next init; 5-language locale bundle (de, en, es, fr, ja) | `src/lib/i18n.js` |
| `Sentry` | Error + performance monitoring (browser tracing) | `src/sentry.js` |
| Edge Functions | Server-side logic: payments, push delivery, account deletion | `supabase/functions/` |

## Pattern Overview

**Overall:** Single-Page Application (SPA) with BaaS backend — no custom server.

**Key Characteristics:**
- All screens are React components that query Supabase directly from the client via RLS-protected PostgREST
- No Redux, Zustand, or global state library — state is managed locally per screen with `useState`/`useEffect`, with auth state the only global context
- Lazy code-splitting at screen level (`React.lazy`) keeps the initial bundle small; only `SignInScreen` and `OnboardingScreen` are eagerly loaded
- Realtime push (in-app toasts) is handled via Supabase Realtime Postgres Changes channels started once per session
- The app runs inside Capacitor on iOS/Android (native shell) and as a PWA on web — platform detection occurs at runtime

## Layers

**Auth Layer:**
- Purpose: Provides `user` (Supabase auth user) and `profile` (profiles row) to all screens via React context
- Location: `src/lib/auth.jsx`
- Contains: `AuthProvider`, `useAuth` hook, profile fetch with retry logic
- Depends on: `src/lib/supabase.js`, `src/lib/referral.js`, `src/lib/debug.js`
- Used by: `src/main.jsx` (Provider wraps App), every screen via `useAuth()`

**Router / App Shell Layer:**
- Purpose: Declares all routes, handles auth redirect logic, mounts persistent chrome (header, bottom nav, toaster)
- Location: `src/App.jsx`
- Contains: Route definitions (public vs. authenticated), `HeaderForRoute`, `ScreenFallback`
- Depends on: React Router v6, `useAuth`, `startLiveEvents`, `captureReferralFromUrl`
- Used by: `src/main.jsx`

**Screens Layer:**
- Purpose: Full-page views — each screen is self-contained; fetches its own data from Supabase, manages local UI state
- Location: `src/screens/`
- Contains: 25 screen components (see list below)
- Depends on: `src/lib/supabase.js` directly, lib utilities, shared components
- Used by: `src/App.jsx` route tree

**Shared Components Layer:**
- Purpose: Reusable UI elements composed by screens
- Location: `src/components/`
- Contains: Modal sheets (bottom-slide), dialogs, social interactions, navigation, course picking
- Depends on: lib layer (supabase, toast, scoring, etc.)
- Used by: Screens

**Lib / Services Layer:**
- Purpose: Domain logic, Supabase data access helpers, platform bridges, pure utilities
- Location: `src/lib/`
- Contains: Data fetchers, pure scoring math, the toast bus, Capacitor bridges, Canvas card renderers
- Depends on: `src/lib/supabase.js` (data), browser/Capacitor APIs (bridges)
- Used by: Screens and components

**Edge Functions Layer:**
- Purpose: Server-side operations that require service-role access or secret keys
- Location: `supabase/functions/`
- Contains: Stripe checkout creation, Web Push delivery, account deletion, referral claiming, Widerruf handler, reviewer bypass
- Runtime: Deno (TypeScript)
- Called by: React app (via `fetch` to `/functions/v1/…`) or Supabase DB triggers

## Data Flow

### Primary Authenticated Screen Request Path

1. User navigates to a route (`/cup`, `/matches`, etc.) — `src/App.jsx`
2. Lazy-loaded screen component mounts, calls `useEffect(() => { load() }, [])`
3. `load()` calls Supabase PostgREST directly: `supabase.from('table').select('...')` — `src/lib/supabase.js`
4. Data stored in local `useState`, component re-renders with data
5. Supabase RLS enforces access control on the server; client never bypasses it

### Realtime Push / Toast Flow

1. `startLiveEvents(user)` called in `App.jsx` `useEffect` when `user.id` is set — `src/lib/liveEvents.js`
2. Three Supabase Realtime channels subscribed: `live-msgs`, `live-social`, `live-matches`
3. On `INSERT`/`UPDATE` event, lib filters by user-relevant IDs (conversation IDs, match IDs)
4. `pushToast({ ... })` called — `src/lib/toast.js`
5. `Toaster` component (subscribed via `onToast`) renders the in-app toast — `src/components/Toaster.jsx`

### Auth Session Hydration

1. `main.jsx` renders `<AuthProvider>` wrapping `<App>`
2. `AuthProvider` subscribes to `supabase.auth.onAuthStateChange` — `src/lib/auth.jsx:168`
3. On `INITIAL_SESSION` event, `loadProfile(uid)` fetches the `profiles` row with retry logic
4. `user` + `profile` values propagate via `AuthCtx`
5. `App.jsx` gates routes: no `user` → `<SignInScreen>`, no `profile` → `<OnboardingScreen>`

### Apple Watch Score Entry

1. Active match screen (`MatchDetailScreen`) calls `publishMatchToWatch(payload)` — `src/lib/watchBridge.js`
2. Capacitor `WatchBridge` plugin sends match state to Apple Watch via WatchConnectivity
3. User enters hole score on watch; plugin fires `watchScoreEntered` event
4. Screen receives score via `onWatchScore(handler)` listener and updates hole state

### Web Push Delivery

1. Supabase DB trigger (after `INSERT` on `messages`, etc.) calls `send-push` Edge Function via `pg_net`
2. `send-push` function loads VAPID keys from secrets, fetches affected users' `push_subscriptions`
3. VAPID-signed push notifications sent to each registered endpoint
4. Browser Service Worker (`/sw-push.js` in `public/`) renders OS-level notifications

**State Management:**
- Global: `AuthCtx` (user + profile) via React Context — `src/lib/auth.jsx`
- Toast bus: module-level `Set` of listeners, zero React dependency — `src/lib/toast.js`
- Screen state: `useState` local to each screen component (no cross-screen sharing)
- Session unlock state (tournament passwords): `sessionStorage` per tournament ID — `src/lib/tournamentGate.js`
- Referral code: `localStorage` key `sns_ref_code` — `src/lib/referral.js`
- Language preference: `localStorage` key `sns_lang` — `src/lib/i18n.js`

## Key Abstractions

**AuthProvider / useAuth:**
- Purpose: Single source of truth for auth identity; exposes `{ user, profile, loading, refreshProfile, setProfileDirect, signOut }`
- Location: `src/lib/auth.jsx`
- Pattern: React Context with internal loading states (`sessionChecked`, `profileChecked`); profile fetch deduplication via `inflightUidRef`

**Toast Bus:**
- Purpose: Decoupled pub/sub for in-app notifications; works outside React (called from Realtime handlers)
- Location: `src/lib/toast.js`
- Pattern: Module-level `Set<listener>` — `pushToast()` / `onToast()` / `dismissToast()`

**Scoring Utilities:**
- Purpose: Pure, framework-free golf scoring math — match-play standing, Stableford points, HCP strokes per hole, team points
- Location: `src/lib/scoring.js`
- Pattern: Pure functions (no imports, no side effects); unit-tested in `src/lib/scoring.test.js`

**Canvas Card Renderers:**
- Purpose: Generate shareable image cards without external image libraries
- Location: `src/lib/shareCard.js` (match recap, 1080×1080), `src/lib/cardRenderer.js` (winner card, story overlay, portrait card)
- Pattern: Canvas 2D API only, `document.createElement('canvas')` at runtime

**WatchBridge:**
- Purpose: Isolates all Apple Watch (Capacitor) interaction; no-ops cleanly on non-iOS platforms
- Location: `src/lib/watchBridge.js`
- Pattern: Plugin accessor `plugin()` returns `null` if not native iOS; all exported functions guard against this

**tournamentGate:**
- Purpose: Password-protecting cups — local unlock state + server-side verify via RPC
- Location: `src/lib/tournamentGate.js`
- Pattern: `sessionStorage` for unlock flag; `supabase.rpc('verify_tournament_password')` for validation

## Entry Points

**Web App Entry:**
- Location: `src/main.jsx`
- Triggers: Browser loading `index.html` → Vite serves `src/main.jsx`
- Responsibilities: Mount React root, wrap with `BrowserRouter` + `AuthProvider`, import `i18n` and CSS

**App Shell:**
- Location: `src/App.jsx`
- Triggers: Mounted by `main.jsx`
- Responsibilities: Evaluate auth state → render correct screen tree; start live events; define all routes

**Public Shareable Views (unauthenticated):**
- Routes: `/c/:inviteCode` (`PublicCupScreen`), `/i/:inviteCode` (`InvitationalScreen`), `/recap/:inviteCode` (`RecapScreen`), `/hall/:handle` (`HallOfFameScreen`), `/crew/:slug` (`CrewScreen`), `/season/:slug` (`SeasonScreen`)
- These bypass auth checks — rendered inside a minimal wrapper without `BrandHeader`/`BottomNav`

**Vite Config:**
- Location: `vite.config.js`
- Manual chunks: `supabase`, `router`, `react` (prevents circular chunk bug), `vendor`

**Sentry Init:**
- Location: `src/sentry.js`
- Loaded first via `import './sentry'` in `src/main.jsx`; 10% trace sample rate

## Architectural Constraints

- **No SSR:** Pure CSR SPA. `index.html` is the only HTML entry; all routing is client-side via React Router
- **Global state:** Only `AuthCtx` (React Context) and the `toast` module-level Set. No Redux/Zustand
- **Supabase singleton:** `src/lib/supabase.js` exports a single `createClient` instance imported by all lib modules — changing auth config here affects the whole app
- **Capacitor platform:** Some lib files (`watchBridge.js`, `webPush.js`) detect iOS/native via `window.Capacitor`; these must remain no-ops on web
- **Edge Functions caller:** Auth-sensitive functions (checkout, delete-account) are called via `fetch` with Bearer token; do not call them without an active session
- **RLS enforcement:** All data access uses the anon client with user JWT. Never import or use the service role key on the frontend
- **Auth lock caution:** `supabase.auth.onAuthStateChange` callback runs under a `navigator.locks` lock — any `supabase.from()` or `auth.*` call inside this callback will deadlock. All such calls are deferred with `setTimeout(0)` — `src/lib/auth.jsx:191`

## Anti-Patterns

### Calling Supabase inside onAuthStateChange synchronously

**What happens:** `supabase.auth.onAuthStateChange` callback calls `supabase.from()` or `supabase.auth.*` directly
**Why it's wrong:** The callback runs while supabase-js holds an internal `navigator.locks` auth lock; PostgREST also acquires the same lock — results in a deadlock that freezes the app
**Do this instead:** Wrap any supabase call in `setTimeout(() => { ... }, 0)` inside the callback, as done in `src/lib/auth.jsx:191`

### Importing supabase client in multiple places independently

**What happens:** Creating a new `createClient(...)` call outside `src/lib/supabase.js`
**Why it's wrong:** Multiple clients = separate session stores, competing auth state, double realtime subscriptions
**Do this instead:** Always import `{ supabase }` from `src/lib/supabase.js`

### Screen-level state for cross-screen data

**What happens:** Lifting state that should remain global (e.g., profile data) into individual screens
**Why it's wrong:** Data goes stale, screens show inconsistent profiles, extra fetches on every navigation
**Do this instead:** Use `useAuth()` for the profile; for other cross-screen needs, fetch fresh in each screen's `useEffect`

## Error Handling

**Strategy:** Defensive — errors are caught locally, logged to console and optionally to Sentry. Non-fatal errors keep previous state untouched rather than clearing it.

**Patterns:**
- Profile fetch failures preserve the previous `profile` value (no flash to `null` / Onboarding on transient network errors) — `src/lib/auth.jsx:135`
- Lib functions (courses, photo, social) log errors and return `null` / `[]` / `false` rather than throwing to callers
- `logDebug()` posts structured debug telemetry to the `client_debug` Supabase table in dev; disabled in production — `src/lib/debug.js`
- Sentry captures unhandled exceptions via `@sentry/react` browser tracing integration — `src/sentry.js`
- Toast bus errors are silently swallowed (never propagate into callers) — `src/lib/toast.js`

## Cross-Cutting Concerns

**Logging:** `logDebug(event, payload, userId)` in `src/lib/debug.js` — dev/telemetry only; `console.warn/error` for runtime issues in lib functions
**Validation:** Input validation inline within lib functions (e.g., `scoring.js` validates strokes/par as positive integers; `referral.js` validates ref code format with regex)
**Authentication:** `useAuth()` hook everywhere; `AuthProvider` in `src/lib/auth.jsx` is the single gate
**Internationalisation:** `useTranslation()` hook in all UI components; 5 locales in `src/locales/`; language stored in `localStorage` key `sns_lang`
**Canvas rendering:** Two independent canvas modules (`shareCard.js`, `cardRenderer.js`) both use only Canvas 2D API primitives with no shared code — consider extracting shared helpers if a third renderer is needed

---

*Architecture analysis: 2026-06-14*
