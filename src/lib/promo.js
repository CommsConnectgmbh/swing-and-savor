// Shared boost/promotion state for cups (tournaments).
//
// A cup is "boosted" while its `promoted_until` timestamp is still in the
// future. The paid tier (`promo_tier`) decides *where* the boost surfaces in
// the Discover feed:
//   • 'top'       → pinned to the top of the feed
//   • 'highlight' → the feed row is highlighted
//   • 'both'      → both of the above
//
// This gating was inlined across DiscoverScreen (feed sort + row), CupScreen
// (the Boost button) and BoostSheet, and had already drifted between two
// equivalent-but-different comparisons (`new Date(x).getTime() > now` vs
// `new Date(x) > new Date()`). Centralising keeps the boost logic in one place
// so future tweaks touch a single source of truth.

// Is the cup's promotion still active at `now` (epoch ms; defaults to now)?
export function isPromoActive(cup, now = Date.now()) {
  if (!cup?.promoted_until) return false
  return new Date(cup.promoted_until).getTime() > now
}

// Resolve the promo display state: whether the boost is active and which
// Discover slots the paid tier unlocks (top pin / row highlight).
export function promoState(cup, now = Date.now()) {
  const active = isPromoActive(cup, now)
  const tier = cup?.promo_tier
  return {
    active,
    isTop:       active && (tier === 'top' || tier === 'both'),
    isHighlight: active && (tier === 'highlight' || tier === 'both'),
  }
}
