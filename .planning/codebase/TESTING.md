# Testing Patterns

**Analysis Date:** 2026-06-14

## Test Framework

**Runner:**
- Vitest v4 (`"vitest": "^4.1.6"` in `package.json`)
- Config embedded in `vite.config.js` under the `test` key (no separate `vitest.config.*` file)

**Test environment:** jsdom (set in `vite.config.js`)

**Globals:** enabled (`globals: true` in `vite.config.js`) — `describe`, `it`, `expect` can be used without importing, but the single existing test file explicitly imports them from `vitest`

**Setup file:** `src/test-setup.js` — imports `@testing-library/jest-dom` to add DOM matchers

**Assertion Library:**
- Vitest built-in `expect` with `@testing-library/jest-dom` matchers available globally after setup

**Available (installed, not yet used in test files):**
- `@testing-library/react` v14 — for rendering React components
- `@testing-library/user-event` v14 — for simulating user interactions
- `playwright` v1.60 — installed but no Playwright config or test files exist

**Run Commands:**
```bash
npm test          # Run all tests (vitest)
npx vitest        # Same, explicit
npx vitest --watch  # Watch mode
npx vitest --coverage  # Coverage (no reporter configured)
```

## Test File Organization

**Location:**
- Co-located with the source file being tested in the same directory
- Example: `src/lib/scoring.js` → `src/lib/scoring.test.js`

**Naming:**
- `{module-name}.test.js` pattern
- `.jsx` extension not used for test files even when testing React components

**Scope:**
- Only one test file exists in the entire codebase: `src/lib/scoring.test.js`
- No component tests, no screen tests, no integration tests

**Structure:**
```
src/
  lib/
    scoring.js
    scoring.test.js   ← only test file
  test-setup.js       ← global setup
```

## Test Structure

**Suite Organization:**
```js
import { describe, it, expect } from 'vitest'
import { calcMatchStanding, calcTeamPoints, suggestFactors, stablefordPoints, calcStablefordTotals } from './scoring'

describe('calcMatchStanding', () => {
  it('returns all square with no holes', () => {
    expect(calcMatchStanding([])).toEqual({ holesUp: 0, leader: 'none', label: 'ALL SQ', holesPlayed: 0 })
  })

  it('tracks A winning a hole', () => {
    const holes = [{ winner: 'A' }]
    expect(calcMatchStanding(holes)).toEqual({ holesUp: 1, leader: 'A', label: '1 UP', holesPlayed: 1 })
  })
})
```

**Patterns:**
- One `describe` block per exported function
- Multiple `it` cases per block — edge cases covered explicitly (empty input, boundary values, type coercion)
- No `beforeEach` / `afterEach` / `beforeAll` — tests are stateless and self-contained
- No mocks, spies, or stubs in the existing test file (pure functions only)
- Inline fixture data (plain JS objects/arrays) — no external fixture files

## Mocking

**Framework:** Vitest's built-in `vi` utilities are available but not yet used.

**Patterns observed:** None — the sole test file covers only pure utility functions in `src/lib/scoring.js` that have no side effects or external dependencies.

**Available (for future use):**
```js
import { vi } from 'vitest'

// Module mock
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: { … } }
}))

// Spy
vi.spyOn(module, 'functionName').mockReturnValue(value)
```

**What to Mock (guidance for new tests):**
- `src/lib/supabase.js` — the Supabase client; mock the `from()` chain and `auth.*` methods
- `src/lib/toast.js` — `pushToast` when testing components that trigger toasts
- `import.meta.env` values — via Vitest's `vi.stubEnv()` for modules reading `VITE_*` vars

**What NOT to Mock:**
- Pure calculation functions in `src/lib/scoring.js` — test these directly
- Utility functions with no I/O (debounce, referral URL parsing, avatar downscaling logic)

## Fixtures and Factories

**Test Data:**
```js
// Inline object literals — the only pattern in use
const holes = [
  { strokes_a: 4, strokes_b: 3, par: 4 },
  { strokes_a: 5, strokes_b: 6, par: 4 },
  { strokes_a: '', strokes_b: 4, par: 4 },
]
expect(calcStablefordTotals(holes)).toEqual({ a: 3, b: 5 })
```

**Location:**
- No external fixture files; all test data is declared inline within `it()` blocks
- No factory functions or builder patterns

## Coverage

**Requirements:** None enforced — no coverage threshold configured in `vite.config.js`

**View Coverage:**
```bash
npx vitest --coverage
```

**Current coverage:** Extremely limited — only `src/lib/scoring.js` is tested. The following modules have zero test coverage:
- All 28 components in `src/components/`
- All 26 screens in `src/screens/`
- `src/lib/auth.jsx` — complex auth state machine
- `src/lib/liveEvents.js` — Supabase Realtime subscriptions
- `src/lib/toast.js` — event bus
- `src/lib/social.js`, `src/lib/stats.js`, `src/lib/avatar.js`, `src/lib/photo.js`
- All 6 Supabase Edge Functions in `supabase/functions/`

## Test Types

**Unit Tests:**
- Scope: pure utility functions only
- Location: `src/lib/scoring.test.js`
- Approach: direct import and `expect().toEqual()` assertions on return values
- Status: covers `calcMatchStanding`, `calcTeamPoints`, `suggestFactors`, `stablefordPoints`, `calcStablefordTotals` — notably `strokesPerHole`, `holeWinnerNet`, `calcCasualMatchStanding` are exported from `scoring.js` but not tested

**Integration Tests:**
- Not implemented

**E2E Tests:**
- Playwright is installed (`"playwright": "^1.60.0"`) but no config file or test files exist. Not in active use.

**Component Tests:**
- `@testing-library/react` and `@testing-library/user-event` are installed but no component tests exist

## Common Patterns

**Async Testing:**
Not yet used. For future async tests with Vitest:
```js
it('fetches data', async () => {
  const result = await myAsyncFn()
  expect(result).toEqual(expected)
})
```

**Error Testing:**
```js
// Observed pattern — null/invalid input returns null sentinel, not a thrown error
it('rejects strokes < 1 and par < 3 as null', () => {
  expect(stablefordPoints(0, 4)).toBe(null)
  expect(stablefordPoints(4, 2)).toBe(null)
  expect(stablefordPoints('', 4)).toBe(null)
})
```

**Type coercion testing (observed):**
```js
it('coerces numeric strings', () => {
  expect(stablefordPoints('4', '4')).toBe(2)
  expect(stablefordPoints('3', '4')).toBe(3)
})
```

**Boundary / edge case testing (observed pattern):**
```js
it('handles empty/undefined input', () => {
  expect(calcStablefordTotals([])).toEqual({ a: 0, b: 0 })
  expect(calcStablefordTotals(undefined)).toEqual({ a: 0, b: 0 })
})
```

## Adding New Tests

**For new pure utility functions** (place test file co-located):
```
src/lib/newModule.js
src/lib/newModule.test.js
```

**For React components** (pattern to establish):
```
src/components/MyComponent.jsx
src/components/MyComponent.test.jsx
```

Minimal component test scaffold using installed libraries:
```js
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('renders', () => {
    render(<MyComponent />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
```

Note: Components that use `useAuth`, `useTranslation`, or `react-router-dom` hooks will require wrapper providers in the `render()` call.

---

*Testing analysis: 2026-06-14*
