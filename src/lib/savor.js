import { functionUrl } from './functions'

// Shared helpers for the Savor marketplace screens (home / category / offer).
//
// Each of the three Savor screens previously carried a byte-identical copy of
// the offer-price formatter and the public-savor edge-function URL. Keeping
// three copies in sync by hand is a drift risk (the label format and the
// endpoint must stay identical across screens), so they live here now.

// Base URL of the public-savor Supabase edge function. Append a query string
// such as `?mode=home`, `?mode=category&category=…` or `?mode=offer&slug=…`.
// Derived from `functionUrl` so the `/functions/v1/` path lives in exactly one
// place (this module previously hand-built the same string that `functions.js`
// already owns).
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
