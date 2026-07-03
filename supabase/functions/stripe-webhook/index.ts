// Stripe Webhook handler for Swing & Savor.
// Handles: premium (package_type upgrade) + boost (promoted_until + promo_tier)
//          + per-user Pro unlock (launch monitor -> pro_entitlements + profiles).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })

  const stripeKey      = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret  = Deno.env.get('STRIPE_WEBHOOK_SECRET_SNS')
                       || Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!stripeKey || !webhookSecret) return new Response('stripe_not_configured', { status: 500 })

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-09-30.acacia' })
  const sig = req.headers.get('stripe-signature') || ''
  const raw = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] sig verify failed', err)
    return new Response('bad_signature', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.app !== 'swing-and-savor') break

      const piId = typeof session.payment_intent === 'string'
                     ? session.payment_intent : session.payment_intent?.id || null

      // Per-USER Pro unlock (embedded launch monitor). No tournament involved.
      if (session.metadata?.product === 'launch_monitor') {
        const plan      = session.metadata?.plan || 'lifetime'
        const profileId = session.metadata?.buyer_profile_id
        // Activate the ledger row (idempotent via unique stripe_session_id).
        await supabase.from('pro_entitlements').update({
          status: 'active',
          activated_at: new Date().toISOString(),
          stripe_payment_intent_id: piId,
        }).eq('stripe_session_id', session.id)
        // Grant on the profile. lifetime -> is_pro; time-boxed -> pro_until.
        if (profileId) {
          const patch = plan === 'lifetime'
            ? { is_pro: true }
            : { pro_until: new Date(Date.now() + (plan === 'annual' ? 365 : 30) * 86_400_000).toISOString() }
          await supabase.from('profiles').update(patch).eq('id', profileId)
        }
        break
      }

      const tournamentId = session.metadata?.tournament_id
      if (!tournamentId) break
      const purpose = session.metadata?.purpose || 'premium'

      if (purpose === 'boost') {
        const tier     = session.metadata?.tier as 'top'|'highlight'|'both'
        const duration = parseInt(String(session.metadata?.duration_days || '3'), 10)
        if (!tier || !duration) break
        const now     = new Date()
        const expires = new Date(now.getTime() + duration * 86_400_000)

        await supabase.from('tournament_promotions').update({
          status: 'paid',
          paid_at: now.toISOString(),
          starts_at: now.toISOString(),
          expires_at: expires.toISOString(),
          stripe_payment_intent_id: piId,
        }).eq('stripe_session_id', session.id)

        // Stack-Logik: längere/bessere Promo gewinnt
        const { data: cup } = await supabase.from('tournaments')
          .select('promoted_until, promo_tier').eq('id', tournamentId).maybeSingle()
        const currentTier = cup?.promo_tier as 'top'|'highlight'|'both'|null
        const currentUntil = cup?.promoted_until ? new Date(cup.promoted_until) : null
        const rank: Record<string, number> = { highlight: 1, top: 2, both: 3 }
        const newTier: 'top'|'highlight'|'both' =
          currentTier && currentUntil && currentUntil > now && rank[currentTier] >= rank[tier]
            ? currentTier : tier
        const newUntil = currentUntil && currentUntil > expires ? currentUntil : expires

        await supabase.from('tournaments').update({
          promoted_until: newUntil.toISOString(),
          promo_tier: newTier,
        }).eq('id', tournamentId)
        break
      }

      // Premium / Club / League upgrade
      const packageType = session.metadata?.package_type as 'premium'|'club'|'league'|undefined
      if (!packageType) break
      await supabase.from('premium_purchases').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: piId,
      }).eq('stripe_session_id', session.id)
      await supabase.from('tournaments')
        .update({ package_type: packageType })
        .eq('id', tournamentId)
      break
    }
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.metadata?.app !== 'swing-and-savor') break
      if (session.metadata?.product === 'launch_monitor') {
        await supabase.from('pro_entitlements').update({ status: 'failed' })
          .eq('stripe_session_id', session.id)
        break
      }
      const purpose = session.metadata?.purpose || 'premium'
      const table = purpose === 'boost' ? 'tournament_promotions' : 'premium_purchases'
      await supabase.from(table).update({ status: 'failed' })
        .eq('stripe_session_id', session.id)
      break
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      const piId = typeof charge.payment_intent === 'string'
                     ? charge.payment_intent : charge.payment_intent?.id
      if (!piId) break
      await supabase.from('premium_purchases').update({ status: 'refunded' })
        .eq('stripe_payment_intent_id', piId)
      await supabase.from('tournament_promotions').update({ status: 'refunded' })
        .eq('stripe_payment_intent_id', piId)
      // Pro: revoke the entitlement + profile flags on refund.
      const { data: ent } = await supabase.from('pro_entitlements')
        .select('profile_id').eq('stripe_payment_intent_id', piId)
        .in('status', ['active']).maybeSingle()
      if (ent) {
        await supabase.from('pro_entitlements').update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', piId)
        await supabase.from('profiles').update({ is_pro: false, pro_until: null })
          .eq('id', ent.profile_id)
      }
      break
    }
    default:
      break
  }

  return new Response('ok', { status: 200 })
})
