// Platform-aware deep links for DealBuddy cross-promotion.
//
// Strategy:
//   - On the web (mobile or desktop): open the DealBuddy webapp with pre-filled
//     query params. Universal Links / App Links will hand-off to the native
//     app if installed.
//   - From inside the Capacitor wrapper (native iOS/Android): the same web URL
//     works; OS routes to the installed app where available.
//
// DealBuddy webapp lives at https://app.deal-buddy.app.
// Store links live at https://deal-buddy.app/ios and /android.

export const DEALBUDDY_WEB     = 'https://app.deal-buddy.app'
export const DEALBUDDY_IOS     = 'https://apps.apple.com/de/app/id6763754507'
export const DEALBUDDY_ANDROID = 'https://play.google.com/store/apps/details?id=de.dealbuddy.app'

export function detectPlatform() {
  if (typeof navigator === 'undefined') return 'web'
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/i.test(ua))         return 'android'
  return 'web'
}

// Build a deep link URL to DealBuddy's "new challenge" flow with the friend /
// opponent pre-filled. DealBuddy supports both `opponent` (display name) and
// `opponent_handle` so it can resolve the in-app user when present.
export function buildChallengePostUrl({
  title, opponent, opponentHandle, stake,
  category = 'sports', source = 'swingandsavor',
  challengeId, matchUrl,
} = {}) {
  const params = new URLSearchParams()
  if (title)          params.set('title', title)
  if (opponent)       params.set('opponent', opponent)
  if (opponentHandle) params.set('opponent_handle', opponentHandle)
  if (stake)          params.set('stake', stake)
  if (category)       params.set('category', category)
  if (challengeId)    params.set('source_id', challengeId)
  if (matchUrl)       params.set('match_url', matchUrl)
  params.set('utm_source',   source)
  params.set('utm_medium',   'crosslink')
  params.set('utm_campaign', 'sas-challenge')
  return `${DEALBUDDY_WEB}/challenges/new?${params.toString()}`
}

// Open DealBuddy with smart fallback. window.open with _blank lets the OS
// intercept via Universal/App Links; if no app is installed, the user lands on
// the DealBuddy webapp.
export function openDealBuddyChallenge(opts) {
  const url = buildChallengePostUrl(opts)
  window.open(url, '_blank', 'noopener,noreferrer')
}

// One-click: challenge a friend by passing only their profile object.
// Convenience wrapper used by FriendsScreen / ProfileScreen.
export function challengeFriendOnDealBuddy(friend, extra = {}) {
  if (!friend) return
  openDealBuddyChallenge({
    title: extra.title || `Golf-Duell mit ${friend.display_name || friend.handle}`,
    opponent: friend.display_name || friend.handle,
    opponentHandle: friend.handle,
    ...extra,
  })
}

// Store link for current platform — used in "Get DealBuddy" CTAs.
export function dealBuddyStoreUrl() {
  const p = detectPlatform()
  if (p === 'ios')     return DEALBUDDY_IOS
  if (p === 'android') return DEALBUDDY_ANDROID
  return DEALBUDDY_WEB
}
