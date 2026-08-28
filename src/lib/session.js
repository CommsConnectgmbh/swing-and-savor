import { supabase } from './supabase'

// Single source of truth for "read the signed-in user's JWT before calling an
// authenticated edge function".
//
// Screens, sheets and lib helpers each hand-fetched the session and dug the
// `access_token` out of it before POSTing to a privileged Supabase Edge
// Function — the Boost / Pro / Premium checkouts (BoostSheet, RangeScreen,
// CupScreen), scorecard OCR (ScorecardSheet), account deletion (ProfileScreen),
// the Widerruf flow (WiderrufScreen) and the referral claim (auth.jsx). The two
// lines were copy-pasted ~7 times in two slightly different spellings
// (`{ data: sess } → sess?.session?.access_token` vs
// `{ data: { session } } → session?.access_token`), so the token plumbing could
// quietly drift. This is the one place that knows how to read it.
//
// Returns the raw `access_token`, so a missing session yields `undefined` —
// byte-identical to the previous inline expressions — and each caller keeps its
// own `if (!token)` handling.
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token
}
