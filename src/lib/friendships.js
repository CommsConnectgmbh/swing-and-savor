import { supabase } from './supabase'
import { fetchProfileList } from './profiles'
import { otherUserId } from './pairs'

// Centralised friendship data-access. A friendship row is symmetric
// (`user_a` / `user_b`), so resolving "the other person relative to me" and
// "all my accepted friends" was re-derived in MatchesScreen, CasualScreen and
// FriendsScreen with subtly different code. One source of truth here.

// The profile columns the friend-picker UIs render.
export const FRIEND_PROFILE_COLUMNS = 'id, handle, display_name, hcp, avatar_url'

// `otherUserId` is a generic symmetric-pair helper (see lib/pairs.js). Re-export
// it here so friendship callers keep a single, on-topic import.
export { otherUserId }

// All friendship rows that touch me, in any status.
export async function fetchFriendships(myId) {
  const { data } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_a.eq.${myId},user_b.eq.${myId}`)
  return data ?? []
}

// Ids of my accepted friends.
export async function fetchFriendIds(myId) {
  const rows = await fetchFriendships(myId)
  return rows.filter((r) => r.status === 'accepted').map((r) => otherUserId(r, myId))
}

// Accepted friends as profile rows, sorted by display name — the exact shape
// the "pick a friend" sheets consume.
export async function fetchFriendProfiles(myId, columns = FRIEND_PROFILE_COLUMNS) {
  const ids = await fetchFriendIds(myId)
  if (!ids.length) return []
  const profs = await fetchProfileList(ids, columns)
  return profs.sort((a, b) => a.display_name.localeCompare(b.display_name))
}
