// Single source of truth for Supabase Edge Function calls.
//
// The base URL (`${VITE_SUPABASE_URL}/functions/v1/<name>`) and the anon-key
// auth headers were previously hand-copied into ~15 call sites across screens,
// components and lib modules. That magic path string and the header shapes had
// to stay byte-identical everywhere but nothing enforced it — they could
// silently drift (e.g. a typo in `/functions/v1/`, or a missing `apikey`).
//
// The URL/header builders below centralise that. On top of them, `callFunction`
// / `callPublicFunction` centralise the *request* itself — the `getSession()`
// token dance, the `Content-Type` header, `JSON.stringify`, the query-string
// assembly and the defensive `res.json().catch(() => ({}))` were all duplicated
// verbatim at every call site. Callers keep their own response handling
// (`res.ok` checks, error extraction) but no longer re-implement the plumbing.
import { supabase } from './supabase'

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
 * The current session's access token, or null when signed out.
 * Replaces the `const { data } = await supabase.auth.getSession()` /
 * `data?.session?.access_token` two-liner that was copied into every
 * authenticated edge-function call site.
 */
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}

function urlWithQuery(name, query) {
  const url = functionUrl(name)
  if (!query) return url
  const qs = new URLSearchParams(query).toString()
  return qs ? `${url}?${qs}` : url
}

async function invokeFunction(name, headers, { method, body, query, signal }) {
  const init = { method, headers, signal }
  if (body !== undefined) {
    init.headers = { ...headers, 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(urlWithQuery(name, query), init)
  // Defensive parse: edge functions may return an empty body (e.g. 204) or a
  // non-JSON error page. Callers inspect `res.ok` / fields on `data`.
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

/**
 * Call an authenticated edge function. Returns `{ res, data }` where `data` is
 * the parsed JSON body (or `{}` if the body is empty/not JSON). Rejects only on
 * a network-level failure, exactly like `fetch`.
 *
 *   const { res, data } = await callFunction('delete-account', { token })
 *   if (!res.ok) throw new Error(data.error)
 *
 * Pass a JSON `body` to send a POST payload, or `query` for query-string params.
 * `method` defaults to POST (the shape every authenticated call site uses).
 */
export function callFunction(name, { token, method = 'POST', body, query, signal } = {}) {
  return invokeFunction(name, authFunctionHeaders(token), { method, body, query, signal })
}

/**
 * Call a public (anon-key only) edge function. Same `{ res, data }` contract as
 * `callFunction`. `method` defaults to GET (the shape every public call site
 * uses); pass `method: 'POST'` with a `body` for public mutations.
 */
export function callPublicFunction(name, { method = 'GET', body, query, signal } = {}) {
  return invokeFunction(name, publicFunctionHeaders(), { method, body, query, signal })
}
