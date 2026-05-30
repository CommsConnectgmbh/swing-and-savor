// Stripe Checkout für Boost/Highlight (eBay-Kleinanzeigen-Style).
// Tiers: top (3 Tage 4,99€ · 7 Tage 9,99€), highlight (3 Tage 2,99€ · 7 Tage 4,99€), both (3 Tage 6,99€ · 7 Tage 12,99€)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIERS = {
  top: {
    label: 'Nach oben schieben',
    desc:  'Dein Turnier landet ganz oben in Entdecken',
    prices: { 3: 499, 7: 999, 14: 1499 },
  },
  highlight: {
    label: 'Highlight',
    desc:  'Farbiger Rahmen + Highlight-Badge im Feed',
    prices: { 3: 299, 7: 499, 14: 799 },
  },
  both: {
    label: 'Top + Highlight',
    desc:  'Beides kombiniert — maximale Sichtbarkeit',
    prices: { 3: 699, 7: 1299, 14: 1999 },
  },
} as const

function j(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...CORS, ...(init.headers || {}) },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST')    return j({ error: 'method_not_allowed' }, { status: 405 })

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) return j({ error: 'stripe_not_configured' }, { status: 500 })

  const authHeader = req.headers.get('Authorization') || ''
  const userJwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!userJwt) return j({ error: 'unauthorized' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* ignore */ }
  const tournamentId = body.tournament_id
  const tier         = body.tier || 'top'
  const duration     = parseInt(String(body.duration_days || 3), 10)
  // §356 Abs. 5 BGB: ausdrückliche Zustimmung zur sofortigen Ausführung +
  // Kenntnis vom Erlöschen des Widerrufsrechts (Pflicht-Checkbox vor Zahlung).
  const instantConsent = body.instant_execution_consent === true
  if (!tournamentId)            return j({ error: 'tournament_required' }, { status: 400 })
  if (!instantConsent)         return j({ error: 'consent_required' }, { status: 400 })
  if (!TIERS[tier as keyof typeof TIERS]) return j({ error: 'unknown_tier' }, { status: 400 })
  const def = TIERS[tier as keyof typeof TIERS]
  if (!(duration in def.prices)) return j({ error: 'unknown_duration' }, { status: 400 })
  const amount = def.prices[duration as 3|7|14]

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${userJwt}` } }, auth: { persistSession: false } },
  )
  const { data: userData, error: uErr } = await supabaseUser.auth.getUser()
  if (uErr || !userData?.user) return j({ error: 'unauthorized' }, { status: 401 })
  const userId = userData.user.id

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: cup } = await supabase
    .from('tournaments').select('id, name, owner_id, invite_code')
    .eq('id', tournamentId).maybeSingle()
  if (!cup)                       return j({ error: 'not_found' }, { status: 404 })
  if (cup.owner_id !== userId)    return j({ error: 'not_owner' }, { status: 403 })

  const baseUrl = req.headers.get('Origin') || 'https://app.swingandsavor.at'
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-09-30.acacia' })

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${def.label} (${duration} Tage) — ${cup.name}`,
          description: def.desc,
        },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    metadata: {
      app: 'swing-and-savor',
      purpose: 'boost',
      tournament_id: cup.id,
      tier,
      duration_days: String(duration),
      buyer_profile_id: userId,
    },
    success_url: `${baseUrl}/cup?boost=success&cup=${encodeURIComponent(cup.invite_code)}`,
    cancel_url:  `${baseUrl}/cup?boost=cancel`,
  })

  await supabase.from('tournament_promotions').insert({
    tournament_id: cup.id,
    buyer_profile_id: userId,
    tier,
    duration_days: duration,
    amount_eur_cents: amount,
    currency: 'eur',
    stripe_session_id: session.id,
    stripe_checkout_url: session.url,
    status: 'pending',
    instant_execution_consent: true,
    instant_execution_consent_at: new Date().toISOString(),
    metadata: { session_metadata: session.metadata },
  })

  return j({ checkout_url: session.url, session_id: session.id, amount_eur_cents: amount })
})
