// Canonical outbound URLs.
//
// The marketing host (swingandsavor.at) and the app host
// (app.swingandsavor.at) were previously hard-coded as string literals in
// every place that built a cup-invite link, a match deep-link or a plain
// site link (QrCodeSheet, CupScreen, HomeScreen, MatchDetailScreen,
// ChallengesScreen, CasualScreen, referral.js …). Scattering the hosts like
// that means a domain change has to be chased across the whole tree and the
// `/i/…` and `/matches/…` path shapes can silently drift apart.
//
// Keep every externally shareable link flowing through these helpers so the
// hosts and path shapes have a single source of truth.

// Marketing / public site (invite landing pages, referral links).
export const SITE_URL = 'https://swingandsavor.at'

// Installed web app (deep links into a specific match).
export const APP_URL = 'https://app.swingandsavor.at'

// Public landing page for a cup invite code: https://swingandsavor.at/i/ABC123
export function cupInviteUrl(inviteCode) {
  return `${SITE_URL}/i/${inviteCode}`
}

// Deep link to a match inside the app: https://app.swingandsavor.at/matches/<id>
export function matchUrl(matchId) {
  return `${APP_URL}/matches/${matchId}`
}
