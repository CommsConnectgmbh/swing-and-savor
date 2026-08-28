# Architecture & Refactoring Roadmap

> Reverse-engineered overview of the Swing & Savor web app, the problems found
> while reading the codebase, and the staged plan to pay them down. This is a
> living document; each "one-PR-a-day" cleanup should tick an item below and
> link back to it.

## 1. What the app is

A mobile-first React PWA (also shipped as a Capacitor native app under
`native/`) for casual and tournament golf — match play, cups, leaderboards, a
social feed, DMs, and a "Savor" marketplace. Backend is Supabase (Postgres +
RLS + Realtime + Storage + Edge Functions). No bespoke server; the client talks
to Supabase directly and to a handful of Edge Functions for privileged work
(push, checkout, referral claim, account deletion, OCR).

```
┌──────────────────────────────────────────────────────────┐
│  React SPA (Vite)                                          │
│                                                            │
│  main.jsx → AuthProvider → <App/> (react-router)           │
│     │                                                       │
│     ├─ screens/*  (route-level, lazy-loaded)               │
│     ├─ components/* (sheets, nav, shared UI)               │
│     └─ lib/*  (supabase client, scoring, social, i18n…)    │
│                                                            │
│  Cross-cutting: i18n (i18next), Sentry, liveEvents bridge, │
│  watchBridge (Apple Watch), toast bus                      │
└───────────────┬────────────────────────────────────────────┘
                │ @supabase/supabase-js (single shared client)
                ▼
┌──────────────────────────────────────────────────────────┐
│  Supabase                                                  │
│   • Postgres (32 migrations) + Row Level Security          │
│   • Realtime (postgres_changes) → liveEvents / threads     │
│   • Storage (avatars, scorecards)                          │
│   • Edge Functions (send-push, *-checkout, claim-referral, │
│     delete-account, widerruf, scorecard OCR, course import)│
└──────────────────────────────────────────────────────────┘
```

## 2. Data flow

1. **Boot** — `main.jsx` mounts `<AuthProvider>` (`lib/auth.jsx`). Auth state is
   driven entirely by `supabase.auth.onAuthStateChange`; the provider hydrates
   the `profiles` row for the signed-in user and exposes `{ user, profile,
   loading }` via context. Notably careful code here: it defers all Supabase
   calls out of the auth-lock callback via `setTimeout(0)` to avoid a
   `navigator.locks` deadlock, and distinguishes "row missing" (→ Onboarding)
   from "fetch failed" (→ keep prior state).
2. **Routing** — `App.jsx` gates on `loading → user → profile`, then renders
   either the public, header-less routes (`/c`, `/i`, `/recap`, `/hall`,
   `/crew`, `/season`) or the authenticated shell (header + `<Routes>` + bottom
   nav). All non-entry screens are `React.lazy` code-split.
3. **Per-screen fetch** — each screen owns its data: `useEffect` → one or more
   `supabase.from(...)` calls → local `useState`. There is **no shared
   data/cache layer** (no React Query/SWR); refetch-on-mount is the norm.
4. **Realtime** — `lib/liveEvents.js` opens app-wide channels for DMs, comments,
   reactions and match-status changes and raises toasts/push. Screens like
   `CommentsThread` and `ConversationScreen` open their own scoped channels.
5. **Writes** — mostly direct table writes guarded by RLS; privileged or
   multi-step operations go through Postgres RPCs (`approve_join_request`,
   `apply_course_edit`, `report_comment`, …) or Edge Functions.

## 3. Clean architecture (target layering)

```
screens/ (route + view state)        ← orchestration only
   └─ components/ (presentational + sheets)
        └─ lib/ data modules         ← ALL supabase access lives here
             • auth, profiles, social, courses, scoring, stats …
             └─ lib/supabase.js (single client)
```

The desired rule: **screens should not contain raw `supabase.from(...)` query
shapes.** They should call intention-revealing functions in `lib/` (e.g.
`fetchProfileMap`, `fetchPlayerStats`). `lib/social.js`, `lib/courses.js` and
`lib/stats.js` already model this well; the screens are where the boundary
leaks.

## 4. Problem areas (prioritised)

### P1 — Duplicated data-access idioms in the view layer
The same query+shape is copy-pasted across screens, so a schema change means a
codebase-wide grep:
- **Profile lookup → map** (`from('profiles').select('id,handle,display_name,
  avatar_url').in('id', ids)` then `Object.fromEntries(...[p.id,p])`) appeared in
  ~10 places. **→ extracted to `lib/profiles.js` (`fetchProfileMap`,
  `fetchProfileList`, `indexById`, `searchProfiles`); call sites migrated.**
- **Initials from a name** is computed ~15 ways (`name?.[0]`, `slice(0,2)`,
  word-split) — several produce *different* output, so they must be unified
  deliberately, not blindly. **→ pending: `lib/format.js#initials` variants.**
- **Date formatting** — `new Date(x).toLocaleDateString('de-DE', …)` is inlined
  ~16 times, half hard-coding `de-DE` instead of the active i18n locale.
  **→ pending: `lib/format.js#formatDate` (preserve current locale per site).**

### P2 — God screens
`CasualScreen` (1120 LOC), `MatchesScreen` (1079), `MatchDetailScreen` (978),
`AdminScreen` (961), `CupScreen` (750) each mix data fetching, business rules,
and large JSX. They are the hardest files to change safely and the obvious
targets for extracting hooks (`useCasualRound`, `useMatch`) and subcomponents.

### P3 — No shared fetch/cache layer
Every screen refetches on mount with bespoke `loading`/`error` state; there is no
dedup, caching, or retry except the hand-rolled logic in `auth.jsx`. This is a
**scalability/UX risk** as the app grows (redundant round-trips, flicker). A
lightweight `useQuery`-style hook (or adopting TanStack Query) would remove a lot
of boilerplate.

### P4 — N+1 / over-fetching patterns
Several flows fetch a list, then fetch related rows per id in a follow-up query
(profiles, social counts, holes). Most are already batched with `.in(...)`, but
a few (e.g. per-match stat aggregation in `lib/stats.js`) walk multiple tables
client-side where a Postgres view/RPC would be one round-trip and RLS-safe.

### P5 — Error handling is inconsistent
A mix of `const { data } = …` (errors silently dropped), `console.error`,
`console.warn`, and Sentry. Centralising "log + degrade" in the `lib/` data
functions (rather than each call site reinventing it) would make failures
observable; the `lib/profiles.js` helpers currently degrade to an empty result
but do not yet log.

### P6 — Tooling drift
`package.json`'s `lint` script invokes ESLint with `.eslintrc`-style flags, but
no ESLint config exists in the repo and the installed ESLint is v9+/flat-config
only — so `npm run lint` cannot run. Build (`vite build`) and tests (`vitest`,
21→29 passing) are healthy. Restoring a working lint config is a low-risk,
high-leverage fix.

## 5. Refactoring strategy (rules of engagement)

- **Behaviour-preserving only.** No UX/logic changes; verify with `vitest` +
  `vite build` each PR.
- **Lift duplicated query shapes into `lib/`**, passing the exact column
  projection so output is byte-identical, then migrate call sites incrementally.
- **Cover every new `lib/` helper with a unit test** (pure core + mocked
  supabase), matching the existing `scoring.test.js` style.
- **One concern per PR**, small enough to review by eye against the diff.

## 6. Backlog (tick as PRs land)

- [x] `lib/profiles.js` — `fetchProfileMap` / `fetchProfileList` / `indexById` /
      `searchProfiles` + tests; migrate HomeScreen, ChallengesScreen,
      FriendsScreen, CommentsThread, JoinRequestsSheet.
- [x] `lib/share.js#currentUrl` — SSR-guarded current-page URL (`typeof window
      !== 'undefined' ? window.location.href : ''`) was inlined verbatim in the
      seven public share pages (Savor offer, PublicCup, Season, Recap, Crew,
      Invitational, Hall of Fame); extracted + tested and all call sites migrated,
      so the SSR fallback can no longer drift or be forgotten on a new share page.
- [ ] Migrate remaining profile-map sites (MessagesScreen, DiscoverScreen,
      MatchesScreen, CasualScreen, ConversationScreen, ProfileScreen).
- [ ] `lib/format.js` — `initials`, `formatDate`, `formatRelative` (+ tests),
      replacing the inlined variants without changing rendered output.
- [ ] Restore a working ESLint flat config so `npm run lint` passes in CI.
- [ ] Extract data hooks from the God screens (`useCasualRound`, `useMatch`, …).
- [ ] Evaluate a shared query/cache hook to retire per-screen fetch boilerplate.
- [ ] Move client-side stat aggregation (`lib/stats.js`) behind a Postgres view/RPC.
