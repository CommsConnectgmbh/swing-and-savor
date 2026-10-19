// Test-Harness: startet den ECHTEN Code einer Edge Function (Deno.serve auf :8000) und
// faengt alle ausgehenden Requests (Supabase Auth/REST, Stripe, Resend) ab.
// Nur Anfragen an localhost gehen durch. Unbekannte Ziele liefern 599 und gelten als Fehler.
export type Aufruf = { method: string; url: URL; body: string; headers: Headers }
export const aufrufe: Aufruf[] = []
type Handler = (a: Aufruf) => Response | null | Promise<Response | null>
export const handler: Handler[] = []

const echtesFetch = globalThis.fetch
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init)
  const url = new URL(req.url)
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return echtesFetch(input, init)
  const a: Aufruf = { method: req.method, url, body: req.body ? await req.clone().text() : '', headers: req.headers }
  aufrufe.push(a)
  for (const h of handler) {
    const r = await h(a)
    if (r) return r
  }
  return new Response(JSON.stringify({ error: 'nicht gemockt: ' + req.method + ' ' + url }), { status: 599 })
}

export const SB = 'http://supabase.mock'
Deno.env.set('SUPABASE_URL', SB)
Deno.env.set('SUPABASE_ANON_KEY', 'anon-test')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-test')
Deno.env.set('STRIPE_SECRET_KEY', ['sk', 'test', 'harness'].join('_'))
Deno.env.set('RESEND_API_KEY', '')

export const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } })

/** PostgREST-Antwort: bei Objekt-Accept ein Objekt, sonst Array. */
export function pgrst(a: Aufruf, rows: unknown[]) {
  const accept = a.headers.get('accept') || ''
  if (accept.includes('vnd.pgrst.object')) return rows.length ? json(rows[0]) : json({ message: 'no rows' }, 406)
  return json(rows)
}

/** Stripe Checkout-Session: Formular-Body zurueck als Objekt mit metadata. */
export function stripeSession(a: Aufruf) {
  const f = new URLSearchParams(a.body)
  const metadata: Record<string, string> = {}
  for (const [k, v] of f) {
    const m = k.match(/^metadata\[(.+)\]$/)
    if (m) metadata[m[1]] = v
  }
  return json({ id: 'cs_test_harness', object: 'checkout.session', url: 'https://checkout.stripe.com/c/pay/cs_test_harness', metadata })
}

let fehler = 0
export function pruefe(bedingung: unknown, text: string) {
  if (bedingung) console.log('  ok   ' + text)
  else { console.log('  FEHL ' + text); fehler++ }
}
export function ende() {
  console.log(fehler ? `FEHLGESCHLAGEN (${fehler})` : 'ALLE PRUEFUNGEN OK')
  Deno.exit(fehler ? 1 : 0)
}
export async function post(pfad: string, body: unknown, headers: Record<string, string> = {}) {
  const r = await fetch('http://localhost:8000' + pfad, {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user-jwt', Origin: 'https://app.swingandsavor.at', ...headers },
  })
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers }
}
