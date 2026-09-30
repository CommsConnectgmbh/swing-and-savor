// Single source of truth for Supabase Edge Function endpoints.
//
// The base URL (`${VITE_SUPABASE_URL}/functions/v1/<name>`) and the anon-key
// auth headers were previously hand-copied into ~15 call sites across screens,
// components and lib modules. That magic path string and the header shapes had
// to stay byte-identical everywhere but nothing enforced it — they could
// silently drift (e.g. a typo in `/functions/v1/`, or a missing `apikey`).
// Centralising them here keeps every edge-function request consistent.

/** Absolute URL for a Supabase Edge Function, e.g. functionUrl('public-cup'). */
export function functionUrl(name) {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`
}

/** Headers for a public (anon-key only) edge-function request. */
export function publicFunctionHeaders() {
  return { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }
}

/**
 * Headers for an authenticated edge-function request.
 * Spread extra headers (e.g. Content-Type) at the call site as needed:
 *   { ...authFunctionHeaders(token), 'Content-Type': 'application/json' }
 */
export function authFunctionHeaders(token) {
  return {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  }
}

/**
 * Fire an authenticated `POST` at an edge function.
 *
 * Wraps the request shape that was hand-copied across every checkout / account
 * flow (BoostSheet, CupScreen, RangeScreen, ProfileScreen, WiderrufScreen,
 * ScorecardSheet, claim-referral): `POST` to `functionUrl(name)`, the
 * `authFunctionHeaders(token)` pair plus a JSON `Content-Type`, and a
 * JSON-stringified body. Callers keep owning session retrieval and response
 * handling — this only standardises the request the same way `functionUrl` /
 * `authFunctionHeaders` already standardise the URL and headers, so the last
 * hand-rolled `/functions/v1/` string (RangeScreen) is retired too.
 *
 * @param {string} name  edge-function name, e.g. 'create-boost-checkout'
 * @param {{ token?: string, body?: unknown }} [opts]
 *   `token` — bearer access token; `body` — JSON payload (omit for a bodyless
 *   POST, e.g. delete-account).
 * @returns {Promise<Response>} the raw fetch `Response`, unparsed.
 */
export function postFunction(name, { token, body } = {}) {
  const init = {
    method: 'POST',
    headers: { ...authFunctionHeaders(token), 'Content-Type': 'application/json' },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  return fetch(functionUrl(name), init)
}
