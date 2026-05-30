import { supabase } from './supabase'

// Online-Widerrufsfunktion (Art. 11a Verbraucherrechte-RL, verpflichtend ab 19.06.2026).
// Lädt die widerrufbaren Käufe eines Nutzers: status='paid', innerhalb 14 Tage ab paid_at,
// noch nicht widerrufen. Quelle: tournament_promotions (Boosts) + premium_purchases (Pakete).
// RLS erlaubt dem Käufer (buyer_profile_id = auth.uid()) das Lesen seiner eigenen Zeilen.

const WIDERRUF_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

const TIER_LABEL = {
  top: 'Boost „Nach oben schieben“',
  highlight: 'Boost „Highlight“',
  both: 'Boost „Top + Highlight“',
}
const PACKAGE_LABEL = {
  premium: 'Premium-Paket',
  club: 'Club-Paket',
  league: 'League-Paket',
}

function daysRemaining(paidAt) {
  const elapsed = Date.now() - new Date(paidAt).getTime()
  return Math.max(0, Math.ceil((WIDERRUF_WINDOW_MS - elapsed) / 86_400_000))
}

function withinWindow(paidAt) {
  if (!paidAt) return false
  return Date.now() - new Date(paidAt).getTime() <= WIDERRUF_WINDOW_MS
}

export async function loadWiderrufbareKaeufe(profileId) {
  if (!profileId) return []

  const [promos, premium] = await Promise.all([
    supabase
      .from('tournament_promotions')
      .select('id, tier, duration_days, amount_eur_cents, paid_at, status, widerrufen_at')
      .eq('buyer_profile_id', profileId)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false }),
    supabase
      .from('premium_purchases')
      .select('id, package_type, amount_eur_cents, paid_at, status, widerrufen_at')
      .eq('buyer_profile_id', profileId)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false }),
  ])

  const items = []

  for (const r of promos.data || []) {
    if (r.widerrufen_at || !withinWindow(r.paid_at)) continue
    items.push({
      table: 'tournament_promotions',
      id: r.id,
      label: TIER_LABEL[r.tier] || 'Boost',
      amount_eur_cents: r.amount_eur_cents,
      paid_at: r.paid_at,
      days_remaining: daysRemaining(r.paid_at),
    })
  }

  for (const r of premium.data || []) {
    if (r.widerrufen_at || !withinWindow(r.paid_at)) continue
    items.push({
      table: 'premium_purchases',
      id: r.id,
      label: PACKAGE_LABEL[r.package_type] || 'Premium-Kauf',
      amount_eur_cents: r.amount_eur_cents,
      paid_at: r.paid_at,
      days_remaining: daysRemaining(r.paid_at),
    })
  }

  items.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
  return items
}

// Schnell-Check für Banner-Sichtbarkeit: gibt es mind. 1 widerrufbaren Kauf?
export async function hasWiderrufbareKaeufe(profileId) {
  const items = await loadWiderrufbareKaeufe(profileId)
  return items.length > 0
}
