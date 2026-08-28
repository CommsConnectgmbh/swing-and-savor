// Shared helpers for the Savor marketplace screens (home / category / offer).
//
// Each of the three Savor screens previously carried a byte-identical copy of
// the offer-price formatter and the public-savor edge-function URL. Keeping
// three copies in sync by hand is a drift risk (the label format and the
// endpoint must stay identical across screens), so they live here now.

import { useEffect, useState } from 'react'
import { functionUrl, publicFunctionHeaders } from './functions'

// Base URL of the public-savor Supabase edge function. Append a query string
// such as `?mode=home`, `?mode=category&category=…` or `?mode=offer&slug=…`.
// Built via functionUrl() so the `/functions/v1/` path can't drift from the
// rest of the app's edge-function call sites.
export const SAVOR_FUNCTIONS_URL = functionUrl('public-savor')

// Display label for an offer's price.
// Priority: an explicit price_label, then a formatted EUR amount, then a
// fallback. The locale is intentionally pinned to de-DE — Savor offers are
// priced for the Austrian/German market regardless of the UI language.
export function formatOfferPrice(offer) {
  if (!offer) return ''
  if (offer.price_label) return offer.price_label
  if (offer.price_eur_cents) {
    return `${(offer.price_eur_cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 0 })} €`
  }
  return 'Auf Anfrage'
}

// --- Savor availability -----------------------------------------------------
// The Savor world (Tee Times, Dining, Travel, Shop) is only worth surfacing once
// at least one real offer is live. Until then we hide the Swing|Savor switch and
// keep users inside the Swing app rather than teasing an empty shopping world.
//
// This is DATA-COUPLED, not a hard kill-switch: we ask the same public-savor
// edge function for its offer counts. As soon as it reports >= 1 offer, the
// switch and the /savor routes light up again automatically — no code change or
// redeploy needed.
//
// To FORCE a state regardless of the data (e.g. for a demo or a hard launch),
// set SAVOR_FORCE to `true` (always on) or `false` (always off). Leave it at
// `null` to follow the live offer count (the default, recommended).
const SAVOR_FORCE = null

let _savorState = null   // null = unknown/not yet resolved, true/false once known
let _savorPromise = null

function resolveSavor() {
  if (_savorPromise) return _savorPromise
  _savorPromise = fetch(`${SAVOR_FUNCTIONS_URL}?mode=home`, {
    headers: publicFunctionHeaders(),
  })
    .then((r) => (r.ok ? r.json() : { counts: {} }))
    .then((j) => {
      const total = Object.values(j?.counts || {}).reduce((a, n) => a + (n || 0), 0)
      _savorState = total > 0
      return _savorState
    })
    .catch(() => { _savorState = false; return false })
  return _savorPromise
}

// React hook: is the Savor world live?
//   true  → at least one offer exists (show the switch / allow the routes)
//   false → no offers yet (hide the switch / redirect the routes to Swing)
//   null  → still resolving on first load (callers should wait, not redirect)
// The result is cached at module scope, so the always-mounted header triggers
// exactly one lightweight counts request per session.
export function useSavorEnabled() {
  const [state, setState] = useState(SAVOR_FORCE !== null ? SAVOR_FORCE : _savorState)
  useEffect(() => {
    if (SAVOR_FORCE !== null) return
    if (_savorState !== null) { setState(_savorState); return }
    let cancelled = false
    resolveSavor().then((v) => { if (!cancelled) setState(v) })
    return () => { cancelled = true }
  }, [])
  return state
}
