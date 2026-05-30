// Create Stripe Checkout Session for Premium-Invitational upgrade (49 EUR one-shot).
// Auth-required: only the cup OWNER may upgrade.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PACKAGES = {
  premium: { amount: 4900, label: 'Premium Invitational' },
  club:    { amount: 19900, label: 'Club Cup' },
  league:  { amount: 99900, label: 'League Season' },
}

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
  const packageType  = body.package_type || 'premium'
  // §356 Abs. 5 BGB: ausdrückliche Zustimmung zur sofortigen Ausführung +
  // Kenntnis vom Erlöschen des Widerrufsrechts (Pflicht-Checkbox vor Zahlung).
  const instantConsent = body.instant_execution_consent === true
  if (!tournamentId)                  return j({ error: 'tournament_required' }, { status: 400 })
  if (!instantConsent)                return j({ error: 'consent_required' }, { status: 400 })
  if (!PACKAGES[packageType as keyof typeof PACKAGES]) return j({ error: 'unknown_package' }, { status: 400 })

  // Auth client (validates user via JWT)
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${userJwt}` } }, auth: { persistSession: false } },
  )
  const { data: userData, error: uErr } = await supabaseUser.auth.getUser()
  if (uErr || !userData?.user) return j({ error: 'unauthorized' }, { status: 401 })
  const userId = userData.user.id

  // Service-role for ownership check + ledger insert
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: cup } = await supabase
    .from('tournaments').select('id, name, owner_id, invite_code, package_type')
    .eq('id', tournamentId).maybeSingle()
  if (!cup)                       return j({ error: 'not_found' }, { status: 404 })
  if (cup.owner_id !== userId)    return j({ error: 'not_owner' }, { status: 403 })
  if (cup.package_type === packageType) return j({ error: 'already_upgraded' }, { status: 400 })

  const pkg = PACKAGES[packageType as keyof typeof PACKAGES]
  const baseUrl = req.headers.get('Origin') || 'https://app.swingandsavor.at'

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-09-30.acacia' })
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${pkg.label} — ${cup.name}`,
          description: 'One-time upgrade. Premium Eventpage, Winner Cards, Recap, Branding light.',
        },
        unit_amount: pkg.amount,
      },
      quantity: 1,
    }],
    metadata: {
      tournament_id: cup.id,
      package_type:  packageType,
      buyer_profile_id: userId,
      app: 'swing-and-savor',
    },
    success_url: `${baseUrl}/cup?upgrade=success&cup=${encodeURIComponent(cup.invite_code)}`,
    cancel_url:  `${baseUrl}/cup?upgrade=cancel`,
  })

  // Write pending ledger row
  await supabase.from('premium_purchases').insert({
    tournament_id: cup.id,
    buyer_profile_id: userId,
    package_type: packageType,
    amount_eur_cents: pkg.amount,
    currency: 'eur',
    stripe_session_id: session.id,
    stripe_checkout_url: session.url,
    status: 'pending',
    instant_execution_consent: true,
    instant_execution_consent_at: new Date().toISOString(),
    metadata: { session_metadata: session.metadata },
  })

  return j({ checkout_url: session.url, session_id: session.id })
})
