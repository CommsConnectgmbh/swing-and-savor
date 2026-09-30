import { supabase } from './supabase'

// Centralised profile data-access. Before this module every screen built its
// own `from('profiles').select(...).in('id', ids)` query and hand-rolled the
// `{ [id]: profile }` lookup, so the same logic (and its bugs) lived in a
// dozen places. Keep the column lists here narrow and explicit — selecting
// `*` over a list of ids ships columns the UI never reads.

// The profile fields the social/friend UI renders for a person "card".
export const PROFILE_CARD_COLUMNS = 'id, handle, display_name, avatar_url, hcp'

// Build a `{ [id]: row }` lookup from a (possibly null) row array. Generic on
// purpose: also used to index players, owners, etc. by their `id`.
export function indexById(rows) {
  return Object.fromEntries((rows ?? []).map((r) => [r.id, r]))
}

// Normalise an id collection (array or Set): drop falsy values and
// de-duplicate. `.in()` with duplicates returns the same rows, so this only
// trims the request, never the result set.
function normaliseIds(ids) {
  return Array.from(new Set(Array.from(ids ?? []).filter(Boolean)))
}

// Fetch the given profiles as a flat array (empty if no ids).
export async function fetchProfileList(ids, columns = PROFILE_CARD_COLUMNS) {
  const list = normaliseIds(ids)
  if (!list.length) return []
  const { data } = await supabase.from('profiles').select(columns).in('id', list)
  return data ?? []
}

// Fetch the given profiles indexed by id (empty object if no ids).
export async function fetchProfileMap(ids, columns = PROFILE_CARD_COLUMNS) {
  return indexById(await fetchProfileList(ids, columns))
}

// Fetch a single profile by id (null when the id is falsy or the row is
// missing). The `.eq().maybeSingle()` shape mirrors the inline single-profile
// lookups that screens (ConversationScreen, …) previously hand-rolled.
export async function fetchProfile(id, columns = PROFILE_CARD_COLUMNS) {
  if (!id) return null
  const { data } = await supabase.from('profiles').select(columns).eq('id', id).maybeSingle()
  return data ?? null
}

// Search profiles by handle (prefix) or display name (contains). `query` may
// include a leading `@`. Callers are still responsible for any minimum-length
// gating before they choose to search.
export async function searchProfiles(query, { excludeId, limit = 20, columns = PROFILE_CARD_COLUMNS } = {}) {
  const term = String(query || '').toLowerCase().replace(/^@/, '')
  let q = supabase
    .from('profiles')
    .select(columns)
    .or(`handle.ilike.${term}%,display_name.ilike.%${term}%`)
  if (excludeId) q = q.neq('id', excludeId)
  const { data } = await q.limit(limit)
  return data ?? []
}
