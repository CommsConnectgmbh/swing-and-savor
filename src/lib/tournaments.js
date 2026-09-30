import { supabase } from './supabase'

// Centralised tournament (a.k.a. "cup") data-access. Before this module the
// Board, Cup, Matches and Teams screens each inlined the identical
// `from('tournaments').select('*').order('date', { ascending: false })` query,
// so the same fetch — and any future change to it — lived in four places.
//
// The projection is deliberately `select('*')`: every list screen reads a
// different mix of columns and historically relied on the full row. Narrowing
// it is a worthwhile follow-up (see .planning/codebase/CONCERNS.md — "Widely
// Used select('*')") but has to be done per-consumer to stay
// behaviour-preserving, so it is intentionally left out of scope here.

// Fetch all tournaments the caller can see (RLS-scoped), newest first by date.
// Returns an empty array on error, matching the historical
// `({ data }) => data || []` behaviour of the call sites this replaces.
export async function fetchTournaments() {
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .order('date', { ascending: false })
  return data ?? []
}
