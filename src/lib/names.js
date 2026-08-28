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

// Single-letter monogram from a profile, preferring its display name and
// falling back to the handle, e.g. { display_name: 'Ada' } → "A".
// Always returns one upper-case character ('?' when nothing is available).
export function profileInitial(profile) {
  return (profile?.display_name || profile?.handle || '?')[0]?.toUpperCase() || '?'
}

// First-two-characters monogram from a name string, e.g.
//   "Ada"        → "AD"
//   "bob lee"    → "BO"
//   "" / null    → ""
// This is the compact avatar fallback used by the match & casual friend
// pickers — a *character* slice, distinct from `initials()` which takes the
// first letter of each word. Centralised so the copy-pasted `.slice(0, 2)`
// variants can't drift.
export function monogram(name) {
  return (name || '').slice(0, 2).toUpperCase()
}
