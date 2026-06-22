# Codebase Concerns

**Analysis Date:** 2026-06-14

---

## Security Considerations

### Hardcoded Anon Key in Source-Tracked Edge Function

**Risk:** The Supabase anon key (JWT string) is committed directly inside `api/og.js` as a literal fallback. Although the anon key is a public-role credential with no elevated privileges, embedding it as a literal in version-controlled code means it cannot be rotated without a code change, and it removes the operational habit of treating credentials as external configuration.
**Files:** `api/og.js` lines 7–12
**Current mitigation:** The function checks `process.env.VITE_SUPABASE_ANON_KEY` first and only falls back to the literal. The project ID (`rcqichlyllhwougopfkg`) is also exposed as a URL literal in the same file and in `supabase/migrations/007_push_triggers.sql`.
**Recommendations:** Remove all inline fallback literals. Require the env var to be present; fail fast in the edge function if missing.

---

### Admin Access Gated Only by Hardcoded Email String (Client-Side)

**Risk:** `AdminScreen.jsx` controls access to the admin panel by comparing `user.email` against a hardcoded constant (`rainer.roloff@comms-connect.de`). This is purely a client-side UI gate — the actual Supabase RLS policies on `ambassadors`, `savor_partners`, `savor_offers`, and `event_ambassadors` must be doing the real enforcement, but the admin-role check is not enforced in any server-side function; it is only a rendering condition.
**Files:** `src/screens/AdminScreen.jsx` lines 7, 90
**Current mitigation:** Supabase RLS restricts what data can be read, so the worst case is a non-admin seeing an empty admin panel. However, write operations through the UI (inserting/updating ambassadors, Savor partners, offers) depend entirely on RLS. If those policies have any gap, the email check provides no backstop.
**Recommendations:** Add a server-validated `is_admin` column or a `roles` table in Supabase. Guard write operations with a DB-level check rather than a UI string comparison. Replace hardcoded email with an environment variable at minimum.

---

### `send-push` Edge Function Does Not Validate the Internal Caller

**Risk:** `send-push/index.ts` accepts any POST request that provides valid JSON with `user_ids`. The `x-internal-key` header is sent by the DB trigger (`call_send_push`), but `send-push` never reads or validates it — meaning any caller on the public internet who discovers the function URL and the user-id UUIDs can trigger push notifications to arbitrary users.
**Files:** `supabase/functions/send-push/index.ts`, `supabase/migrations/007_push_triggers.sql` line 32, `supabase/migrations/024_fix_call_send_push_ambiguous_key.sql` line 30
**Current mitigation:** The function uses the service-role key to look up subscriptions, so an outside caller cannot enumerate subscriptions without knowing target UUIDs. Push content is caller-controlled, creating a notification-spoofing vector.
**Recommendations:** Read the `x-internal-key` from the request header and compare it against `Deno.env.get('PUSH_INTERNAL_KEY')`. Return 403 on mismatch before processing.

---

### Tournament Edit Password Stored Plain-Text in Tournament Secrets Table

**Risk:** Migration `029_audit_fix_2026_05_30.sql` moved the edit password from a publicly readable `tournaments` column into `tournament_secrets`, which has RLS that blocks client reads. However, the password is still stored as plain text (`edit_password text`) without hashing. Anyone with service-role access (admins, edge functions) can read all tournament passwords in clear text.
**Files:** `supabase/migrations/029_audit_fix_2026_05_30.sql` lines 25–55, `verify_tournament_password` RPC (same file)
**Current mitigation:** RLS completely blocks client reads of `tournament_secrets`. The verify RPC is `security definer` and returns only a boolean.
**Recommendations:** Hash the password at rest (e.g., `pgcrypto.crypt`). Update `verify_tournament_password` to use `pgcrypto.crypt(pw, edit_password) = edit_password` comparison. This is a secondary risk given RLS, but a defence-in-depth improvement.

---

### `scorecard_uploads` RLS Retains Legacy `owner_id is null` Clause

**Risk:** Migration 022 was written before the `owner_id is null` global-write bug was fixed in migration 029. Its RLS policies still include `or t.owner_id is null` conditions on the `scu_read` and `scu_insert` policies, which means scorecard uploads for tournaments with a null `owner_id` remain world-accessible for read/insert. Migration 029 backfilled null `owner_id` values, but the RLS clauses were not updated.
**Files:** `supabase/migrations/022_scorecard_ocr.sql` lines 29–44
**Current mitigation:** Migration 029 should have eliminated null `owner_id` rows in production. The clause is now a dead branch, but it leaves a latent risk if any null row ever gets created.
**Recommendations:** Create a migration to drop and recreate the `scu_read` and `scu_insert` policies without the `or t.owner_id is null` branches, matching the pattern established in migration 029.

---

### CORS Policy `Access-Control-Allow-Origin: *` on All Edge Functions

**Risk:** All five auth-aware edge functions (`create-premium-checkout`, `create-boost-checkout`, `delete-account`, `reviewer-bypass`, `widerruf`) respond with `'Access-Control-Allow-Origin': '*'`. This means any origin can call these endpoints. The functions validate JWTs themselves, so real auth is enforced, but the wildcard origin removes the browser's same-origin pre-flight protection as a secondary layer.
**Files:** `supabase/functions/create-premium-checkout/index.ts` line 7, `supabase/functions/create-boost-checkout/index.ts` line 7, `supabase/functions/delete-account/index.ts` line 13, `supabase/functions/reviewer-bypass/index.ts` line 20, `supabase/functions/widerruf/index.ts` line 20
**Current mitigation:** All state-changing operations require a valid user JWT.
**Recommendations:** Restrict `Access-Control-Allow-Origin` to `https://app.swingandsavor.at` (and localhost for dev). Eliminates CSRF-style scenarios where a malicious third-party site prompts an authenticated user's browser.

---

## Tech Debt

### Missing Migrations 003, 009–016

**Issue:** The migration sequence has two large gaps: migration 003 is absent entirely, and migrations 009–016 are all missing. The `027_baseline_undocumented_schema.sql` migration explicitly documents that several tables were created ad-hoc through the Supabase dashboard and never captured as migrations.
**Files:** `supabase/migrations/` directory
**Impact:** A fresh `supabase db reset` or CI environment that applies migrations sequentially will not reproduce the full live schema. The `027` baseline is a reconstruction of what was live; correctness is untested. Any new contributor setting up a local Supabase instance will get a schema that diverges from production.
**Fix approach:** Generate a canonical `supabase db dump --schema public` from the linked project and reconcile it against what migrations 001–032 produce. Backfill the missing migration numbers with no-op stubs or real content.

---

### Widely Used `select('*')` Across Screen Components

**Issue:** Multiple screens and library files fetch entire table rows with `select('*')` instead of selecting only the columns they use. This over-fetches data, increases payload size, and means that adding a sensitive column to a table can inadvertently expose it to the client without any code change.
**Files:**
- `src/lib/auth.jsx` line 48 (`profiles.select('*')`)
- `src/screens/CupScreen.jsx` line 154 (`tournaments.select('*')`)
- `src/screens/TeamsScreen.jsx` lines 77, 104
- `src/screens/BoardScreen.jsx` lines 32, 73
- `src/screens/MatchesScreen.jsx` lines 116, 161, 905
- `src/screens/CasualScreen.jsx` lines 51, 640, 654, 681, 682
- `src/screens/FriendsScreen.jsx` line 39
- `src/screens/AdminScreen.jsx` lines 100, 103
- `src/screens/ChallengesScreen.jsx` line 47
- `src/screens/ProfileScreen.jsx` lines 137, 156, 224, 285
**Impact:** Any future column added to `tournaments`, `profiles`, or `friendships` is automatically sent to every client that loads these screens, including sensitive internal fields. Also degrades performance on the `profiles` table which is fetched in auth.
**Fix approach:** Enumerate explicit column lists in all Supabase `.select()` calls. Start with the auth profile fetch in `src/lib/auth.jsx` (highest traffic) and `tournaments` fetches (highest data risk).

---

### Overly Large Monolithic Screen Files

**Issue:** Five screens exceed 700 lines, with the largest (`CasualScreen.jsx`) at 1,120 lines. These files combine data fetching, realtime subscriptions, complex business logic, and all UI rendering in a single component tree.
**Files:**
- `src/screens/CasualScreen.jsx` — 1,120 lines
- `src/screens/MatchesScreen.jsx` — 1,079 lines
- `src/screens/MatchDetailScreen.jsx` — 978 lines
- `src/screens/AdminScreen.jsx` — 961 lines
- `src/screens/CupScreen.jsx` — 750 lines
- `src/screens/HomeScreen.jsx` — 734 lines
**Impact:** High cognitive load for changes. Local sub-components (e.g., `FriendPickerSheet` defined inside `CasualScreen.jsx`) cannot be tested in isolation. Any regression in one logical area (e.g., scorecard OCR in `MatchDetailScreen`) requires understanding the entire 978-line file.
**Fix approach:** Extract self-contained sub-components (sheets, pickers, data hooks) into dedicated files under `src/components/` or custom hooks in `src/hooks/`.

---

### Multiple Edge Functions Referenced in Client Code That Have No Local Source

**Issue:** The client calls nine Edge Functions that have no corresponding source directory in `supabase/functions/`. These are presumably deployed directly to the Supabase project but are absent from the repository.
**Functions missing source:**
- `public-cup` (called by `src/screens/PublicCupScreen.jsx`)
- `public-invitational` (called by `src/screens/InvitationalScreen.jsx`)
- `public-recap` (called by `src/screens/RecapScreen.jsx`)
- `public-hall` and `public-rivalries` (called by `src/screens/HallOfFameScreen.jsx`)
- `public-crew` (called by `src/screens/CrewScreen.jsx`)
- `public-season` (called by `src/screens/SeasonScreen.jsx`)
- `public-savor` (called by `src/screens/SavorScreen.jsx`, `SavorCategoryScreen.jsx`, `SavorOfferScreen.jsx`)
- `claim-referral` (called by `src/lib/auth.jsx`)
- `scorecard-ocr` (called by `src/components/ScorecardSheet.jsx`)
**Impact:** These functions cannot be iterated on locally, cannot be reviewed for security, and are invisible to CI. A deployment of the repository to a new Supabase project would result in broken screens.
**Fix approach:** Add each function's source to `supabase/functions/<name>/index.ts` and commit it. If source was lost, recreate from the Supabase dashboard's function editor output.

---

### Referral Claim Edge Function Never Retries on Failure

**Issue:** `claimReferralIfAny` in `src/lib/auth.jsx` makes a single fetch to the `claim-referral` edge function and silently swallows all errors (`console.warn` only). If the function is temporarily unavailable or the JWT has just been issued and the session isn't fully propagated, the referral is cleared from localStorage (`clearStoredReferralCode()`) only on HTTP success (`res.ok`). However, the error path still proceeds with `catch (e) { console.warn(…) }` and does NOT clear the code, meaning the same referral could be claimed on the next SIGNED_IN event. This is potentially correct but the flow is fragile.
**Files:** `src/lib/auth.jsx` lines 6–29
**Impact:** Referral credits may be double-claimed if the edge function fails with a transient error and the user re-authenticates.
**Fix approach:** Track a "claim attempted" flag (e.g., in localStorage with the code) to prevent re-attempts once a claim has been sent, regardless of the response.

---

## Performance Bottlenecks

### HomeScreen Loads Up to 60 Matches Plus Multiple Waterfall Queries

**Issue:** `HomeScreen.jsx` loads up to 60 matches in a single query, then makes multiple sequential queries for player names, owner profiles, hole results for active matches, and sponsor placements. The load function triggers four to six separate round-trips.
**Files:** `src/screens/HomeScreen.jsx` lines 66–200
**Impact:** On slower connections this creates noticeable latency on the app's primary screen. The 60-match limit is a hard pagination cap; there's no infinite scroll or cursor-based pagination.
**Fix approach:** Create a Supabase Edge Function or PostgREST view that returns pre-joined match feed data in a single round-trip. Reduce the initial limit to 20 and implement cursor-based pagination.

---

### `liveEvents.js` Re-fetches All Conversations and Tournament IDs on Every Realtime Event

**Issue:** `startLiveEvents` calls `debouncedRefreshMine` on realtime events for unknown match updates. `refreshMine` fetches all of the user's conversation IDs and tournament IDs from the DB. Under heavy realtime traffic (active tournament with many hole updates), this can trigger a database fan-out of profile lookups plus a full conversation/tournament fetch every second.
**Files:** `src/lib/liveEvents.js` lines 25–43
**Impact:** Unnecessary query volume on Supabase's shared infrastructure. Could contribute to rate-limiting or slow the live-scoring experience.
**Fix approach:** Cache the conversation and tournament ID sets in module scope and only invalidate on a `SIGNED_IN` or explicit navigation event, not on every incoming realtime push.

---

### `ensurePartner` in `reviewer-bypass` Calls `listUsers` on Every Invocation

**Issue:** The `ensurePartner` helper in `reviewer-bypass/index.ts` calls `admin.auth.admin.listUsers({ page: 1, perPage: 200 })` for each of the three demo chat partners on every reviewer login, totalling three full user-list fetches per reviewer-bypass call.
**Files:** `supabase/functions/reviewer-bypass/index.ts` lines 304–333
**Impact:** Slow reviewer bypass endpoint; unnecessary load on the Auth Admin API. The function is called infrequently (only by App Store reviewers) so impact is low in production but could cause timeouts if the user table is large.
**Fix approach:** Fetch all users once and share the result across all `ensurePartner` calls, or look up users by email directly via `admin.auth.admin.listUsers` with a filter if the API supports it.

---

## Fragile Areas

### Auth Profile Load Has a Multi-Step Retry Loop with Silent State Risk

**Issue:** `loadProfile` in `src/lib/auth.jsx` performs up to three retries with exponential back-off, followed by a second `refreshSession` attempt and a final retry if the profile row is not found. The entire retry sequence shares mutable ref state (`inflightUidRef`, `loadedUidRef`). If a second auth event (e.g., `TOKEN_REFRESHED`) fires while the first sequence is mid-flight, the `inflightUidRef !== uid` guard aborts the second attempt, but the first call's result may then land and set state that does not correspond to the current session.
**Files:** `src/lib/auth.jsx` lines 59–146
**Impact:** Could cause the profile context to hold stale data after a rapid sign-out/sign-in cycle. The safety timeout (10 s) eventually sets `profileChecked = true`, which can render the app with `profile = null` even for a logged-in user.
**Fix approach:** Use an incrementing `epoch` counter instead of uid-based deduplication; abort any call whose epoch does not match the current epoch at the time of resolution.

---

### `tournamentGate.js` Uses `sessionStorage` for Unlock State

**Issue:** Password-protected tournament unlock state is stored in `sessionStorage` keyed by tournament ID (`golf_unlocked_<id>`). This means that if the user opens a second browser tab or navigates away and returns, or if the session is restored after a browser restart (which clears sessionStorage), they must re-enter the password. Additionally, there is no expiry: once unlocked in a session, the tournament remains unlocked for the entire session even if the owner changes the password.
**Files:** `src/lib/tournamentGate.js` lines 12–18
**Impact:** Minor UX friction (repeated password prompts across tabs). Security non-issue since the DB enforces the password, but a user who shares a device may find their session still unlocked hours later.
**Fix approach:** This is an acceptable trade-off for a lightweight gate. If multi-tab unlock is desired, use `localStorage` with a short TTL (e.g., 30 minutes).

---

### Realtime Channel Cleanup in `MatchDetailScreen` Depends on React Effect Order

**Issue:** `MatchDetailScreen.jsx` stores the Supabase realtime channel in `channelRef.current` and cleans it up in the `useEffect` cleanup (line 117–119) and also on direct teardown in `subscribeRealtime`. The `loadTokenRef` counter is used to guard against stale async closures. If the component re-renders with a new `matchId` prop, the effect cleanup increments the token and removes the channel — but `subscribeRealtime` is also called from within `loadAll`, which is async. A race between the unmount cleanup and an in-progress `loadAll` can result in a channel being subscribed after cleanup.
**Files:** `src/screens/MatchDetailScreen.jsx` lines 114–122, 308–327
**Impact:** Potential ghost Supabase channels (channels opened but never cleaned up) leading to memory leaks and duplicate realtime events in long sessions with frequent match switching.
**Fix approach:** Pass the `loadToken` into `subscribeRealtime` and guard the `supabase.channel().subscribe()` call with a check that the token still matches `loadTokenRef.current` after the async operations complete.

---

### Stripe Webhook Not Implemented — Payment Confirmation Depends on Checkout Redirect

**Issue:** The `create-premium-checkout` and `create-boost-checkout` functions write a `status: 'pending'` ledger row before the Stripe checkout. There is no webhook handler (no `supabase/functions/stripe-webhook/` directory) to mark purchases as `paid` upon Stripe payment completion. The application apparently relies on the Stripe-hosted `success_url` redirect to trigger promotion activation.
**Files:** `supabase/functions/create-premium-checkout/index.ts` lines 99–112, `supabase/functions/create-boost-checkout/index.ts`
**Impact:** If a user completes payment but closes the browser before the redirect completes, the purchase is never marked `paid`. The `widerruf` function explicitly checks `status !== 'paid'` and returns `not_refundable`, so users with orphaned `pending` purchases cannot exercise their statutory right of withdrawal. This is a legal risk as well as a functional one.
**Fix approach:** Implement a `stripe-webhook` Edge Function that listens for `checkout.session.completed` events, validates the Stripe signature, and sets `status = 'paid'` plus activates the promotion. This is also required for the `widerruf` function to operate correctly.

---

### `widerruf` Proceeds Even When Stripe Refund Fails

**Issue:** In `supabase/functions/widerruf/index.ts` lines 172–197, if the Stripe refund API call fails (non-ok response or thrown exception), the function logs the error but continues to mark the purchase as `refunded` and `widerrufen_at` in the database, and sends the confirmation email. The consumer receives a withdrawal confirmation but the refund may never actually be processed.
**Files:** `supabase/functions/widerruf/index.ts` lines 167–215
**Impact:** Consumers could receive legally required confirmation of withdrawal (Art. 11a Abs. 4) while the actual money refund silently fails. This creates a manual reconciliation burden and potential regulatory exposure.
**Fix approach:** Either block the withdrawal confirmation on a successful Stripe refund (returning a 500 with a user-friendly message to try again later), or implement a separate reconciliation job that detects `widerruf_requests` with no `refund_id` and retries the Stripe refund.

---

## Test Coverage Gaps

### Only `scoring.js` Has Unit Tests

**What's not tested:** All business logic outside `src/lib/scoring.js` is completely untested. This includes: auth flow and profile retry logic, autopair algorithm, handicap-stroke calculation, course data utilities, share card Canvas rendering, referral capture/claim, watchBridge message serialization, and all 30+ screen components.
**Files:** `src/lib/scoring.test.js` is the only test file. `src/test-setup.js` configures the testing environment. The `package.json` includes `vitest` and `@testing-library/react` but they are unused beyond scoring.
**Risk:** Regressions in scoring edge cases (Stableford, factor-weighted match-play) are caught. Everything else — auth, payments, legal flows, realtime — has zero automated coverage.
**Priority:** High

### Payment and Legal Flows Have No Integration Tests

**What's not tested:** The `widerruf`, `create-premium-checkout`, and `create-boost-checkout` edge functions have no tests at all — no unit tests for validation logic, no integration tests with Stripe test-mode fixtures.
**Files:** `supabase/functions/create-premium-checkout/index.ts`, `supabase/functions/create-boost-checkout/index.ts`, `supabase/functions/widerruf/index.ts`
**Risk:** A silent regression (e.g., wrong Stripe amount, missing consent check, refund logic failure) would only be discovered by a real user going through checkout. Legal compliance (§356 BGB, Art. 11a EU directive) depends on these functions working correctly.
**Priority:** High

### RLS Policies Are Untested

**What's not tested:** None of the 32 migrations' RLS policies are covered by automated tests. Critical policies (tournament ownership gate, `can_view_tournament`, friendship acceptance) were discovered to be buggy only in production (see migrations 025, 028, 029).
**Files:** All files in `supabase/migrations/`
**Risk:** Future policy changes may re-introduce privilege escalation bugs (like the `owner_id is null` world-write issue) without automated detection.
**Priority:** High — use `supabase test db` with pgTAP or a separate test script that connects as different roles.

---

## Known Bugs (Fixed — Historical Record)

### Friendship Accept Blocked by RLS WITH CHECK (Fixed: migration 025)

Recipients of friend requests could not accept them because the `WITH CHECK` clause on the combined `friendships_rw` policy required `requested_by = auth.uid()`, which blocked the recipient (who did not initiate the request) from updating the row.
**Fix:** `supabase/migrations/025_fix_friendship_accept_rls.sql`

### Community Group Self-Comparison Prevented Members From Reading Private Groups (Fixed: migration 028)

The `groups_select_public` policy checked `m.group_id = m.id` (member FK against member PK — always false) instead of `m.group_id = community_groups.id`. Additionally exposed an infinite recursion in RLS (`42P17`) when a policy on `community_groups` triggered a SELECT on `community_group_members` whose own policy re-queried `community_groups`.
**Fix:** `supabase/migrations/028_fix_groups_select_public.sql`

### Edit Password Exposed in Plain Text to Clients (Fixed: migration 029)

The `edit_password` column on `tournaments` was directly readable by any authenticated client via `select('*')`. This was the most significant security issue.
**Fix:** `supabase/migrations/029_audit_fix_2026_05_30.sql` — column moved to `tournament_secrets`, exposed only via `security definer` RPCs.

### ELO/Winner Manipulable by Client (Fixed: migration 029)

The `matches.winner` field was set entirely by the client. Any user could set an arbitrary winner value on `UPDATE`. A `BEFORE` trigger now recomputes winner from `hole_results` server-side.
**Fix:** `supabase/migrations/029_audit_fix_2026_05_30.sql` — `trg_match_finish_validate_winner` trigger.

---

*Concerns audit: 2026-06-14*
