// Canonical Swing & Savor link builders.
//
// Two hosts serve the product:
//  - the marketing site `swingandsavor.at` hosts the public, shareable surfaces
//    (cup invites under `/i/<code>`, recaps under `/recap/<code>`);
//  - the installed PWA lives on `app.swingandsavor.at` and owns deep links into
//    individual matches (`/matches/<id>`).
//
// These hosts and path shapes were previously hand-written as string literals
// across half a dozen screens and sheets (QR sheet, cup share, home feed,
// challenges, match detail, …). A single typo or a future domain change would
// silently break sharing in some places but not others. Centralising them keeps
// every share / QR / deep-link target derived from one source of truth.

// Public marketing + invite host (shareable, indexable).
export const SITE_URL = 'https://swingandsavor.at'

// The installed PWA host — deep links open inside the app.
export const APP_URL = 'https://app.swingandsavor.at'

// Absolute, shareable invite link for a cup's invite code.
export function buildInviteUrl(code) {
  return `${SITE_URL}/i/${code}`
}

// Absolute deep link to a single match inside the app.
export function buildMatchUrl(matchId) {
  return `${APP_URL}/matches/${matchId}`
}

// In-app (relative SPA) route for a cup list row: finished cups open their
// recap, live/upcoming cups open the invite/live view. Used by the season,
// crew and hall-of-fame list rows.
export function buildCupRoute(cup) {
  return cup?.status === 'finished'
    ? `/recap/${cup?.invite_code}`
    : `/i/${cup?.invite_code}`
}
