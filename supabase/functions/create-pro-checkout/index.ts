// Create a Stripe Checkout Session for a per-USER "Pro" unlock (e.g. the embedded
// QuickLaunch AR launch monitor). Mirrors create-premium-checkout, but the
// entitlement is attached to the buyer's profile rather than a tournament.
//
// Auth-required: any signed-in user may buy Pro for themselves.
//
// IMPORTANT (App Store policy): unlocking a digital feature INSIDE the iOS app via
// Stripe (not Apple In-App Purchase) is the path chosen for this project, but it is
// a known App Review risk for native in-app purchases. See INTEGRATION_LAUNCH_MONITOR.md
// "Monetization & App Store policy". Switching to StoreKit later only changes how
// `pro_entitlements` rows are activated — the gate (isPro) stays the same.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLANS = {
  launch_monitor_lifetime: { amount: 2999, plan: 'lifetime', label: 'Launch Monitor Pro (Lifetime)' },
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
  const planKey = (body.plan_key || 'launch_monitor_lifetime') as keyof typeof PLANS
  // §356 Abs. 5 BGB: explicit consent to immediate execution + acknowledgement that
  // the right of withdrawal lapses (mandatory checkbox before payment).
  const instantConsent = body.instant_execution_consent === true
  if (!PLANS[planKey]) return j({ error: 'unknown_plan' }, { status: 400 })
  if (!instantConsent) return j({ error: 'consent_required' }, { status: 400 })

  // Auth client (validates user via JWT)
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${userJwt}` } }, auth: { persistSession: false } },
  )
  const { data: userData, error: uErr } = await supabaseUser.auth.getUser()
  if (uErr || !userData?.user) return j({ error: 'unauthorized' }, { status: 401 })
  const userId = userData.user.id

  // Service-role for entitlement check + ledger insert
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  // Already Pro? Don't sell it twice.
  const { data: profile } = await supabase
    .from('profiles').select('id, pro_until, is_pro')
    .eq('id', userId).maybeSingle()
  if (!profile) return j({ error: 'profile_not_found' }, { status: 404 })
  const alreadyPro = profile.is_pro === true ||
    (profile.pro_until && new Date(profile.pro_until) > new Date())
  if (alreadyPro) return j({ error: 'already_pro' }, { status: 400 })

  const pkg = PLANS[planKey]
  const baseUrl = req.headers.get('Origin') || 'https://app.swingandsavor.at'

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-09-30.acacia' })
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: pkg.label,
          description: 'One-time unlock. AR launch monitor (carry/spin/launch metrics) + green reader. Requires a LiDAR iPhone.',
        },
        unit_amount: pkg.amount,
      },
      quantity: 1,
    }],
    metadata: {
      buyer_profile_id: userId,
      product: 'launch_monitor',
      plan: pkg.plan,
      app: 'swing-and-savor',
    },
    success_url: `${baseUrl}/range?pro=success`,
    cancel_url:  `${baseUrl}/range?pro=cancel`,
  })

  // Write pending ledger row. A payment reconciler (Stripe webhook or the same
  // mechanism used for premium_purchases) must flip status -> 'active' AND set
  // profiles.pro_until / is_pro when the session completes.
  await supabase.from('pro_entitlements').insert({
    profile_id: userId,
    product: 'launch_monitor',
    plan: pkg.plan,
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
