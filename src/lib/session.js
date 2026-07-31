// Session / access-token helpers.
//
// `supabase.auth.getSession()` followed by digging out
// `?.session?.access_token` was hand-copied into every screen/component that
// calls an authenticated Edge Function (BoostSheet, ScorecardSheet, CupScreen,
// WiderrufScreen, RangeScreen, ProfileScreen). Centralising the retrieval keeps
// that reach into the auth client in one place and out of the view layer.
// Callers keep their own "not signed in" guard because the user-facing message
// differs per flow (i18n `mustLogin`, `'no_session'`, …).

import { supabase } from './supabase'

/**
 * The current session's access token (JWT), or `undefined` when there is no
 * active session. Byte-for-byte equivalent to the previous inline
 * `const { data } = await supabase.auth.getSession(); data?.session?.access_token`.
 *
 * @returns {Promise<string | undefined>}
 */
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token
}
