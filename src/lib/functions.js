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
 * Normalise a public edge-function Response into a plain result object.
 *
 * Every public share screen (cup, recap, crew, season, invitational,
 * hall-of-fame, savor-offer) read the response body and mapped a non-2xx
 * status to an error the exact same way, byte-for-byte:
 *
 *   const j = await r.json().catch(() => ({}))
 *   if (!r.ok) { setErr(j?.error || 'error'); … }
 *
 * The body is parsed defensively — a non-JSON payload yields `{}` instead of
 * throwing — and a failed request surfaces the body's `error` field, falling
 * back to the string 'error' when it is absent. Callers keep ownership of
 * their own loading flags and cancellation, so this stays a side-effect-free
 * reader that is trivial to unit-test.
 *
 * @param {Response} r
 * @returns {Promise<{ ok: boolean, error: string|null, data: any }>}
 */
export async function readPublicJson(r) {
  const data = await r.json().catch(() => ({}))
  if (!r.ok) return { ok: false, error: data?.error || 'error', data }
  return { ok: true, error: null, data }
}
