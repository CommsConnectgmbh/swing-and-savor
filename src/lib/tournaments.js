import { supabase } from './supabase'

// Centralised tournament data-access. The "all tournaments, newest first" read
//   supabase.from('tournaments').select('*').order('date', { ascending: false })
// was copy-pasted verbatim into BoardScreen, CupScreen, TeamsScreen and
// MatchesScreen. Identical table name, column set and ordering in four places —
// a schema or ordering change had to be made four times. One source of truth
// here, matching the profiles.js / friendships.js pattern.

// Every tournament, ordered newest first. Returns a flat array (empty on error
// or no rows) — callers previously all normalised `data || []` themselves.
export async function fetchTournaments() {
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .order('date', { ascending: false })
  return data ?? []
}
