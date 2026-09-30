// Canonical external URLs for the app.
//
// The marketing domain, the app subdomain, and the shape of the shareable
// deep-links were previously re-typed as string literals across screens and
// sheets (the cup-invite URL alone lived in QrCodeSheet/CupScreen/HomeScreen,
// the match deep-link in HomeScreen/ChallengesScreen/MatchDetailScreen). Keeping
// a single source of truth here prevents the domain or the path shape from
// drifting apart the next time one call site is edited in isolation.

// Public marketing site. Also hosts the `/i/<code>` cup-invite landing pages
// that shared links point at.
export const SITE_ORIGIN = 'https://swingandsavor.at'

// The installed PWA / app shell, used for match deep-links.
export const APP_ORIGIN = 'https://app.swingandsavor.at'

// Shareable landing page for a cup / invitational, keyed by its invite code.
export function cupInviteUrl(inviteCode) {
  return `${SITE_ORIGIN}/i/${inviteCode}`
}

// Deep-link to a single match inside the app shell.
export function matchDeepLink(matchId) {
  return `${APP_ORIGIN}/matches/${matchId}`
}
