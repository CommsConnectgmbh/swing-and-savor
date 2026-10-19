// E2E des echten subscribe-newsletter-Codes (Abmeldung + unveraenderte Anmeldung).
import { aufrufe, handler, SB, json, pgrst, pruefe, ende } from './harness.ts'

// Test-Abmeldetoken im Format der echten Tokens (48 Hex-Zeichen), kein Geheimnis.
const ABMELDE_PROBE = Array.from({ length: 48 }, (_, i) => (i % 16).toString(16)).join('')
const patches: { url: URL; body: string }[] = []
handler.push((a) => {
  if (a.url.origin !== SB || a.url.pathname !== '/rest/v1/newsletter_subscribers') return null
  if (a.method === 'PATCH') { patches.push({ url: a.url, body: a.body }); return json([]) }
  if (a.method === 'GET') return pgrst(a, [])
  if (a.method === 'POST') return new Response(null, { status: 201 })
  return null
})

await import('../../functions/subscribe-newsletter/index.ts')
console.log('== subscribe-newsletter')
const F = 'http://localhost:8000/subscribe-newsletter'

{
  const r = await fetch(`${F}?unsubscribe=${ABMELDE_PROBE}`, { redirect: 'manual' })
  pruefe(r.status === 302 && r.headers.get('location') === `https://swingandsavor.at/abmelden?t=${ABMELDE_PROBE}`, `GET Abmeldelink -> 302 auf Abmeldeseite (ist ${r.status} ${r.headers.get('location')})`)
  pruefe(patches.length === 0, 'GET aendert nichts (Link-Scanner melden niemanden ab)')
  await r.body?.cancel()
}
{
  // One-Click nach RFC 8058: Mailprogramm sendet form-encoded POST
  const r = await fetch(`${F}?unsubscribe=${ABMELDE_PROBE}`, { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
  const b = await r.json()
  pruefe(r.status === 200 && b.ok === true, 'One-Click-POST -> 200 ok')
  pruefe(patches.length === 1, 'genau ein Update in newsletter_subscribers')
  const p = patches[0]
  pruefe(p?.url.searchParams.get('confirm_token') === `eq.${ABMELDE_PROBE}`, 'Filter confirm_token = Token')
  pruefe(p?.url.searchParams.get('status') === 'neq.unsubscribed', 'Filter status <> unsubscribed')
  const body = JSON.parse(p?.body || '{}')
  pruefe(body.status === 'unsubscribed' && Number.isFinite(Date.parse(body.unsubscribed_at)), 'setzt status=unsubscribed und unsubscribed_at')
}
{
  // Knopf der Abmeldeseite: POST ohne Body
  const r = await fetch(`${F}?unsubscribe=${ABMELDE_PROBE}`, { method: 'POST' })
  pruefe(r.status === 200 && (await r.json()).ok === true && patches.length === 2, 'POST ohne Body (Abmeldeseite) -> 200 ok, Update')
}
{
  const vorher = aufrufe.length
  const r = await fetch(`${F}?unsubscribe=nichtgueltig`, { method: 'POST' })
  pruefe(r.status === 200 && (await r.json()).ok === true && aufrufe.length === vorher, 'ungueltiges Token -> neutrale Antwort ohne DB-Zugriff')
}
{
  // Anmeldung (Double-Opt-In) laeuft unveraendert
  const r = await fetch(F, { method: 'POST', body: JSON.stringify({ email: 'neu@example.org', lang: 'de', source: 'test' }), headers: { 'Content-Type': 'application/json' } })
  const b = await r.json()
  const ins = aufrufe.filter((a) => a.method === 'POST' && a.url.pathname === '/rest/v1/newsletter_subscribers')
  const zeile = JSON.parse(ins[0]?.body || '{}')
  const z = Array.isArray(zeile) ? zeile[0] : zeile
  pruefe(r.status === 200 && b.ok === true, 'Anmeldung -> 200 ok')
  pruefe(z?.status === 'pending' && /^[0-9a-f]{48}$/.test(z?.confirm_token || ''), 'Anmeldung legt pending mit 48-Hex-Token an (Token-Format passt zur Abmeldung)')
}
ende()
