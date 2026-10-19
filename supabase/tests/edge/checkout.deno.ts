// E2E des echten Checkout-Codes: deno run -A checkout.deno.ts <boost|premium|pro>
import { aufrufe, handler, SB, json, pgrst, stripeSession, pruefe, ende, post } from './harness.ts'

const art = Deno.args[0] as 'boost' | 'premium' | 'pro'
const fn = { boost: 'create-boost-checkout', premium: 'create-premium-checkout', pro: 'create-pro-checkout' }[art]
const ledger = { boost: 'tournament_promotions', premium: 'premium_purchases', pro: 'pro_entitlements' }[art]
const basis = {
  boost: { tournament_id: 't1', tier: 'top', duration_days: 3 },
  premium: { tournament_id: 't1', package_type: 'premium' },
  pro: { plan_key: 'launch_monitor_lifetime' },
}[art]

handler.push((a) => {
  if (a.url.origin === SB && a.url.pathname === '/auth/v1/user') return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'u1@example.org' })
  if (a.url.origin === SB && a.url.pathname === '/rest/v1/tournaments') return pgrst(a, [{ id: 't1', name: 'Test Cup', owner_id: 'u1', invite_code: 'abc123', package_type: 'free' }])
  if (a.url.origin === SB && a.url.pathname === '/rest/v1/profiles') return pgrst(a, [{ id: 'u1', pro_until: null, is_pro: false }])
  if (a.url.origin === SB && a.url.pathname === `/rest/v1/${ledger}` && a.method === 'POST') return new Response(null, { status: 201 })
  if (a.url.hostname === 'api.stripe.com' && a.url.pathname === '/v1/checkout/sessions') return stripeSession(a)
  return null
})

await import(`../../functions/${fn}/index.ts`)
console.log(`== ${fn}`)

const stripe = () => aufrufe.filter((a) => a.url.hostname === 'api.stripe.com')
const ins = () => aufrufe.filter((a) => a.url.pathname === `/rest/v1/${ledger}`)

for (const [name, extra] of [
  ['ohne adult_confirmed', {}],
  ['adult_confirmed false', { adult_confirmed: false }],
  ['adult_confirmed "true" (String)', { adult_confirmed: 'true' }],
] as const) {
  const vorher = aufrufe.length
  const r = await post(`/${fn}`, { ...basis, instant_execution_consent: true, ...extra })
  pruefe(r.status === 400 && r.body?.error === 'adult_confirmation_required', `${name}: 400 adult_confirmation_required (ist ${r.status} ${JSON.stringify(r.body)})`)
  pruefe(aufrufe.length === vorher, `${name}: kein Auth-, DB- oder Stripe-Aufruf`)
}

{
  const r = await post(`/${fn}`, { ...basis, adult_confirmed: true })
  pruefe(r.status === 400 && r.body?.error === 'consent_required', 'ohne Sofort-Zustimmung weiterhin 400 consent_required')
}

{
  const t0 = Date.now()
  const r = await post(`/${fn}`, { ...basis, instant_execution_consent: true, adult_confirmed: true })
  pruefe(r.status === 200 && r.body?.checkout_url?.startsWith('https://checkout.stripe.com/'), `mit beiden Bestaetigungen: 200 + checkout_url (ist ${r.status} ${JSON.stringify(r.body)})`)
  pruefe(stripe().length === 1, 'genau ein Stripe-Aufruf')
  const f = new URLSearchParams(stripe()[0]?.body || '')
  pruefe(f.get('metadata[adult_confirmed]') === 'true', 'Stripe-Metadaten adult_confirmed=true')
  const am = Date.parse(f.get('metadata[adult_confirmed_at]') || '')
  pruefe(Number.isFinite(am) && am >= t0 - 1000 && am <= Date.now() + 1000, 'Stripe-Metadaten adult_confirmed_at = Serverzeitpunkt')
  pruefe(f.get('locale') === 'de' && f.get('submit_type') === 'pay' && f.get('mode') === 'payment', '§ 312j-Basis unveraendert (locale de, submit_type pay, mode payment)')
  pruefe(ins().length === 1, `genau ein Kaufbeleg in ${ledger}`)
  const zeile = JSON.parse(ins()[0]?.body || '{}')
  const z = Array.isArray(zeile) ? zeile[0] : zeile
  pruefe(z?.metadata?.session_metadata?.adult_confirmed_at === f.get('metadata[adult_confirmed_at]'), 'Kaufbeleg enthaelt adult_confirmed_at (ueber session_metadata)')
  pruefe(z?.instant_execution_consent === true && typeof z?.instant_execution_consent_at === 'string', 'Kaufbeleg enthaelt Sofort-Zustimmung wie bisher')
}
ende()
