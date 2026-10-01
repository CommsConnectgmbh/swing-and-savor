// Shared helpers for rendering a person's name as avatar-fallback initials.
// These were copy-pasted across several screens; centralising them keeps the
// monogram fallbacks visually consistent and prevents the variants drifting.

// Word-based initials (up to two letters) from a free-text name, e.g.
//   "Ada Lovelace"  → "AL"
//   "Madonna"        → "M"
//   "" / null        → "·"
// Used by the read-only Avatar/Initials fallbacks on the public profile pages.
export function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '·'
}

// Single upper-case initial from a free-text name string, e.g.
//   "Ada"    → "A"
//   "" / null → "?"
// This is the avatar-monogram fallback that was inlined (in two interchangeable
// `?? '?'` / `|| '?'` spellings) across FriendsScreen, ProfileScreen,
// AvatarPicker, ChallengesScreen and CupExtrasSheet. For the name strings the
// app renders, both spellings yield the same character, so they collapse here.
export function nameInitial(name) {
  return name?.[0]?.toUpperCase() ?? '?'
}

// Single-letter monogram from a profile, preferring its display name and
// falling back to the handle, e.g. { display_name: 'Ada' } → "A".
// Always returns one upper-case character ('?' when nothing is available).
export function profileInitial(profile) {
  return nameInitial(profile?.display_name || profile?.handle)
}
