// Single source of truth for Supabase Edge Function endpoints.
//
// The base URL (`${VITE_SUPABASE_URL}/functions/v1/<name>`) and the anon-key
// auth headers were previously hand-copied into ~15 call sites across screens,
// components and lib modules. That magic path string and the header shapes had
// to stay byte-identical everywhere but nothing enforced it — they could
// silently drift (e.g. a typo in `/functions/v1/`, or a missing `apikey`).
// Centralising them here keeps every edge-function request consistent.

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
 * The current user's Supabase access token, or `null` when there is no active
 * session. Centralises the `getSession() → session.access_token` lookup that
 * every authenticated edge-function caller repeated (in two slightly different
 * spellings). Callers keep their own "no session" handling — the guard message
 * and whether it throws or bails out silently differ per screen.
 */
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}

/**
 * POST to an authenticated edge function and return the raw `Response`.
 *
 * Builds the `apikey` + `Authorization: Bearer` + JSON `Content-Type` headers
 * from `token` and JSON-encodes `body`. The caller supplies the token (see
 * `getAccessToken`) and is responsible for parsing and validating the
 * response — the success shape differs per function (`checkout_url`, `ok`,
 * `result`, …). Omit `body` for functions that take no request payload.
 */
export function postAuthedFunction(name, token, body) {
  return fetch(functionUrl(name), {
    method: 'POST',
    headers: { ...authFunctionHeaders(token), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
