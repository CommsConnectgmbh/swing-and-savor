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
 * GETs a public (anon-key only) edge function and parses its JSON body.
 *
 * The public share screens (cup, recap, invitational, crew, hall-of-fame,
 * season) each hand-rolled the same three mechanical steps: build the function
 * URL, attach `publicFunctionHeaders()`, and parse the response with a
 * swallow-on-failure `.json().catch(() => ({}))`. Centralising them keeps the
 * request shape identical everywhere while leaving each screen's own
 * loading / error / title handling untouched.
 *
 * `query` is an optional map of query-string params; values are percent-encoded
 * exactly as the call sites did by hand with `encodeURIComponent`.
 *
 * Resolves to `{ ok, status, body }` and never rejects on a non-2xx response,
 * so callers keep their existing `if (!ok) …` branch. A network-level failure
 * still rejects, preserving the existing `.catch()` paths.
 */
export async function fetchPublicFunction(name, query) {
  const qs = query
    ? '?' + Object.entries(query)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&')
    : ''
  const res = await fetch(`${functionUrl(name)}${qs}`, { headers: publicFunctionHeaders() })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}
