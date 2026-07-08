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
 * GET a public (anon-key only) Edge Function, with optional query params.
 *
 * Collapses the
 *   `fetch(`${functionUrl(name)}?key=${encodeURIComponent(value)}`,
 *          { headers: publicFunctionHeaders() })`
 * idiom that was copy-pasted verbatim across every public share screen
 * (public-cup, public-season, public-recap, public-crew, public-invitational,
 * public-hall, public-rivalries). Each copy re-assembled the same URL string and
 * header object by hand — the exact drift risk `functionUrl` was introduced to
 * remove, one level up.
 *
 * The raw `fetch` Promise (a `Response`) is returned, so callers keep full
 * control over response handling and this is a behaviour-preserving swap for the
 * inline `fetch(...)` calls it replaces.
 *
 * @param {string} name  Edge-function name, e.g. 'public-cup'.
 * @param {Record<string, string|number>} [params]  Query params, serialised in
 *   insertion order as `key=encodeURIComponent(value)`. Keys are emitted as-is
 *   (the call sites this replaces use URL-safe keys like `invite`/`slug`/`handle`).
 * @returns {Promise<Response>}
 */
export function getPublicFunction(name, params) {
  let url = functionUrl(name)
  if (params) {
    const qs = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')
    if (qs) url += `?${qs}`
  }
  return fetch(url, { headers: publicFunctionHeaders() })
}
