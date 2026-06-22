# Coding Conventions

**Analysis Date:** 2026-06-14

## Naming Patterns

**Files:**
- React components: PascalCase `.jsx` — `BottomNav.jsx`, `LoadingSpinner.jsx`, `ConfirmDialog.jsx`
- Screens (route-level components): PascalCase with `Screen` suffix `.jsx` — `HomeScreen.jsx`, `CupScreen.jsx`, `MatchDetailScreen.jsx`
- Library / utility modules: camelCase `.js` — `scoring.js`, `toast.js`, `debounce.js`, `liveEvents.js`
- Custom hooks (TypeScript): camelCase starting with `use`, `.ts` extension — `src/lib/cc/useHideOnScroll.ts`
- Test files: co-located, same name as module with `.test.js` suffix — `scoring.test.js` next to `scoring.js`
- Supabase Edge Functions: `index.ts` inside a named subdirectory — `supabase/functions/send-push/index.ts`

**Functions:**
- React components: PascalCase — `export default function HomeScreen()`, `function HeaderForRoute()`
- Helper/utility functions: camelCase — `calcMatchStanding()`, `pushToast()`, `fetchSocialCounts()`
- Async data-fetching functions: camelCase starting with a verb — `fetchProfileOnce()`, `loadProfile()`, `refreshMine()`
- Private (non-exported) helpers within a module: camelCase — `factor()`, `round2()`, `cupColor()`, `fmtPts()`

**Variables / State:**
- Local state: camelCase descriptive nouns — `[loading, setLoading]`, `[sheetOpen, setSheetOpen]`, `[holesByMatch, setHolesByMatch]`
- Refs: camelCase with `Ref` suffix — `channelRef`, `loadRef`, `inflightUidRef`, `inflightPromiseRef`
- Constants (module-level, semantic colour tokens): UPPER_SNAKE — `TEAM_A`, `TEAM_B`, `LIVE`, `CUP_HUES`, `BUCKET`, `STORAGE_KEY`
- i18n translation calls: always with fallback string — `t('nav.home', 'Home')`

**Types (TypeScript, rare):**
- Interfaces in PascalCase — `HideOnScrollOptions` in `src/lib/cc/useHideOnScroll.ts`

**React Contexts:**
- Context object named with `Ctx` suffix: `AuthCtx` in `src/lib/auth.jsx`
- Provider exported separately: `export function AuthProvider({ children })`
- Hook exported separately: `export function useAuth()`

**SVG Icon Components:**
- Inline, named with `Icon` suffix, defined as arrow-function components at the top of the file that uses them — `HomeIcon`, `SwordsIcon`, `PlusIcon` in `src/components/BottomNav.jsx`; `PencilIcon`, `TrashIcon`, `LockIcon` in `src/screens/CupScreen.jsx`

## Code Style

**Formatting:**
- No Prettier or ESLint config file present at the project root. Code style is enforced via `"lint"` script in `package.json`: `eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`
- Indentation: 2 spaces throughout (observed in all `.jsx`/`.js` files)
- Single quotes for string literals in JS/JSX
- Semicolons omitted (no-semicolon style)
- Maximum line length is not formally enforced; long lines do appear (especially in `vite.config.js` and `src/lib/auth.jsx`)
- Trailing commas used in object/array literals and function parameters

**Booleans / Guards:**
- Early return pattern used consistently throughout screens and lib modules
- Nullish coalescing (`??`) and optional chaining (`?.`) used extensively — `session?.user ?? null`, `holes?.length ?? 0`

**Async:**
- `async/await` exclusively; no `.then()` chains in source files except `src/lib/auth.jsx` promise chaining inside `startLiveEvents`
- Fire-and-forget fetches never awaited, always followed by `.catch(() => {})` — see `src/lib/debug.js`
- Catch-all empty catch blocks (`catch {}`) used for non-fatal errors — `src/lib/referral.js`, `src/lib/auth.jsx`

## Import Organization

**Order (observed pattern):**
1. React and React ecosystem (`react`, `react-dom`, `react-router-dom`, `react-i18next`)
2. Third-party packages (`@supabase/supabase-js`, `i18next`, etc.)
3. Internal lib imports (`../lib/supabase`, `../lib/auth`, `../lib/toast`)
4. Internal component imports (`../components/LoadingSpinner`, `../components/ConfirmDialog`)
5. CSS / side-effect imports last (`import './index.css'`)

**No path aliases** — all internal imports use relative paths (`./`, `../`).

**Lazy loading pattern** — route-level screens are lazy-loaded in `src/App.jsx`:
```js
const HomeScreen = lazy(() => import('./screens/HomeScreen'))
```
Only `SignInScreen` and `OnboardingScreen` are eagerly imported (they render before auth).

## Error Handling

**Patterns:**
- Supabase calls: destructure `{ data, error }`, check `if (error)` before using `data`
- Throwing: utility functions throw on hard errors (`if (error) throw error` — `src/lib/auth.jsx`, `src/lib/photo.js`, `src/lib/avatar.js`)
- Non-fatal errors: `console.warn('[module] message', e)` or `console.error('[module] message', e)` with a bracketed module prefix
- Silent failures for telemetry/analytics: entire fetch wrapped in `try { … } catch { }` — `src/lib/debug.js`
- Retry logic: manual retry loop with exponential back-off used in `fetchProfileWithRetry()` in `src/lib/auth.jsx`
- User-facing error state: local `const [error, setError] = useState(null)` in screen components, rendered inline

**Module prefix convention** for `console.warn`/`console.error`:
- `[auth]` — `src/lib/auth.jsx`
- `[avatar]` — `src/lib/avatar.js`

## Logging / Telemetry

**Framework:** Custom `logDebug()` in `src/lib/debug.js`

**Patterns:**
- Telemetry only fires in dev or when `VITE_DEBUG_TELEMETRY=1` is set; completely silent in production
- Never `await` debug calls — fire-and-forget only
- Structured events with an `event` string and a `payload` object — `logDebug('auth.event', { event, has_user: !!u, … }, u?.id)`
- Third argument is `userId` for server-side correlation

## Comments

**When to Comment:**
- Block comment above a function when the "why" is non-obvious — `src/lib/auth.jsx` extensively documents the auth-lock deadlock risk and the INITIAL_SESSION behaviour
- Inline comments for German business-logic context (codebase mixes German and English comments freely)
- `// eslint-disable-next-line react-hooks/exhaustive-deps` used with intent when intentionally omitting deps from `useEffect`

**JSDoc/TSDoc:**
- Not used in `.jsx`/`.js` files
- TypeScript interface JSDoc used in `src/lib/cc/useHideOnScroll.ts`

## Function Design

**Size:** Screen-level components are large (200–600+ lines) and contain all data fetching, subscriptions, and render logic in one file. Library modules are small and focused (< 60 lines typical).

**Parameters:** Plain objects for option bags (`{ force, reason }` in `loadProfile()`); simple positional args for pure utility functions (`calcMatchStanding(holeResults)`).

**Return Values:**
- Pure utility functions return plain objects or primitives — `{ holesUp, leader, label, holesPlayed }`
- Async data functions return `data` directly (unwrapped from Supabase response) or `null`/empty array on failure

## Module Design

**Exports:**
- Screens and components: single default export (the component function)
- Lib modules: named exports only — no default export except `src/lib/i18n.js` (exporting the configured `i18n` instance as default alongside named exports)
- Context: provider and hook as named exports from the same file — `export function AuthProvider`, `export function useAuth`

**Barrel Files:** Not used — no `index.js` re-export files. All imports resolve directly to the source file.

## Styling Conventions

**Framework:** Tailwind CSS v3 (`tailwind.config.js`)

**Design tokens (custom Tailwind colours — use these, not hex literals in JSX):**
- Backgrounds: `bg-bg`, `bg-surface`, `bg-surface2`
- Borders: `border-line`, `border-lineSoft`
- Text: `text-ink`, `text-inkMuted`, `text-inkDim`
- Brand accent: `text-accent`, `bg-accent`
- Semantic: `text-danger`, `text-warn`, `text-course`
- Team colours: `text-teamA` / `text-teamB` (also available as hex constants `TEAM_A = '#9BB5C9'`, `TEAM_B = '#D9A38E'` in screen files that render them via inline `style`)

**Inline styles:** Used only when Tailwind cannot express the value — `env(safe-area-inset-top)` padding, CSS custom properties for the nav glass effect (`--ccnav-surface`), and per-item dynamic colours (team colour dots).

**CSS classes for the glass bottom nav:** Use the `ccnav` BEM class family defined in `src/index.css` — do not replicate the animation logic in Tailwind utilities.

**Component structure pattern (sheets/dialogs):**
- Sheets lock body scroll and register `Escape` key handler via `useEffect` — see `src/components/CreateSheet.jsx`
- `document.body.classList.add('sheet-open')` hides the bottom nav while a sheet is open

## Internationalisation

- All user-facing strings go through `useTranslation()` / `t('key', 'Fallback')`
- Fallback strings are always provided inline — never leave `t('key')` without a fallback
- Language detection via `i18next-browser-languagedetector` with localStorage key `sns_lang`
- Translation files live in `src/locales/{de,en,es,fr,ja}.json`

---

*Convention analysis: 2026-06-14*
