// E2E of the REAL Edge Function code against a LOCAL Supabase stack
// (real GoTrue/PostgREST/Storage, migration 043 applied). External services
// (Overpass, golfcourseapi, Resend) are mocked; only localhost passes through.
//
//   SNS_API=http://127.0.0.1:57321 SNS_ANON=... SNS_SERVICE=... \
//     deno run -A --no-lock edge-local.deno.ts <osm|import|newsletter|delete>
const API = Deno.env.get('SNS_API') ?? ''
const ANON = Deno.env.get('SNS_ANON') ?? ''
const SERVICE = Deno.env.get('SNS_SERVICE') ?? ''
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(API) || !ANON || !SERVICE) {
  console.error('local SNS_API/SNS_ANON/SNS_SERVICE required'); Deno.exit(2)
}
Deno.env.set('SUPABASE_URL', API)
Deno.env.set('SUPABASE_ANON_KEY', ANON)
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE)
Deno.env.set('GOLFCOURSEAPI_KEY', 'test-key')
Deno.env.set('RESEND_API_KEY', 'test-resend')

const extern: URL[] = []
const realFetch = globalThis.fetch
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init)
  const url = new URL(req.url)
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return realFetch(input, init)
  extern.push(url)
  const j = (d: unknown) => new Response(JSON.stringify(d), { headers: { 'Content-Type': 'application/json' } })
  if (url.pathname.endsWith('/api/interpreter')) {
    return j({ elements: [{ type: 'way', id: Number(Date.now() % 1e9), center: { lat: 48.1, lon: 11.5 }, tags: { name: 'OSM Test GC', website: 'https://gc.example' } }] })
  }
  if (url.hostname === 'api.golfcourseapi.com') {
    return j({ courses: [{ id: 'gca-' + Date.now(), club_name: 'GCA Test Club', location: { city: 'X', latitude: 47, longitude: 11 } }] })
  }
  if (url.hostname === 'api.resend.com') return j({ id: 'mail' })
  return new Response('unmocked', { status: 599 })
}

let fehler = 0
const pruefe = (ok: unknown, t: string) => { console.log((ok ? '  ok   ' : '  FEHL ') + t); if (!ok) fehler++ }
const run = Date.now().toString(36)
const F = 'http://localhost:8000/fn'

async function svc(method: string, path: string, body?: unknown) {
  const r = await realFetch(API + path, { method, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const t = await r.text()
  try { return { status: r.status, json: JSON.parse(t) } } catch { return { status: r.status, json: null } }
}
async function user(tag: string) {
  const email = `${tag}-${run}@example.test`, password = `pw-${run}-Aa1!`
  const c = await svc('POST', '/auth/v1/admin/users', { email, password, email_confirm: true })
  const s = await (await realFetch(API + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()
  await realFetch(API + '/rest/v1/profiles', { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.json.id, handle: `${tag}_${run}`.slice(0, 20), display_name: tag }) })
  return { id: c.json.id as string, email, token: s.access_token as string }
}
async function call(body: unknown, token = ANON, headers: Record<string, string> = {}) {
  const r = await realFetch(F, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  return { status: r.status, json: await r.json().catch(() => null) }
}

const which = Deno.args[0]
const fn = { osm: 'osm-seed-courses', import: 'import-courses', newsletter: 'subscribe-newsletter', delete: 'delete-account' }[which as 'osm']
if (!fn) { console.error('usage: osm|import|newsletter|delete'); Deno.exit(2) }
await import(`../../functions/${fn}/index.ts`)
console.log('== ' + fn)

if (which === 'osm') {
  const u = await user('osm')
  const anon = await call({ lat: 48.1, lng: 11.5 })
  pruefe(anon.status === 401 && extern.length === 0, `anon key -> 401, no Overpass call (${anon.status})`)
  const bbox = await call({ bbox: ['1);out;(', 11, 48, 12] }, u.token)
  pruefe(bbox.status === 403 && extern.length === 0, `user bbox -> 403 (${bbox.status})`)
  const ctry = await call({ country: 'AT' }, u.token)
  pruefe(ctry.status === 403, `user country seed -> 403 (${ctry.status})`)
  const bad = await call({ lat: '48', lng: 11 }, u.token)
  pruefe(bad.status === 400, `string coordinates -> 400 (${bad.status})`)
  const ok = await call({ lat: 48.1, lng: 11.5, radius_m: 999999 }, u.token)
  const q = extern.length ? decodeURIComponent(String(extern[0].search || '')) : ''
  pruefe(ok.status === 200 && ok.json?.inserted === 1, `user near-seed -> 200, 1 course inserted (${ok.status} ${JSON.stringify(ok.json)})`)
  void q
  const st = []
  for (let i = 0; i < 5; i++) st.push((await call({ lat: 48.1, lng: 11.5 }, u.token)).status)
  pruefe(st.join(',') === '200,200,200,200,429', `6th call in the hour -> 429 (${st.join(',')})`)
}

if (which === 'import') {
  const u = await user('imp')
  const anon = await call({ q: 'Muenchen' })
  pruefe(anon.status === 401 && extern.length === 0, `anon key -> 401, no paid API call (${anon.status})`)
  const long = await call({ q: 'x'.repeat(101) }, u.token)
  pruefe(long.status === 400 && extern.length === 0, `q > 100 chars -> 400 (${long.status})`)
  const ok = await call({ q: 'Muenchen' }, u.token)
  pruefe(ok.status === 200 && ok.json?.count === 1, `user import -> 200 (${ok.status} count ${ok.json?.count})`)
}

if (which === 'newsletter') {
  const ip = `203.0.113.${Math.floor(Math.random() * 200)}`
  const mails = () => extern.filter((u) => u.hostname === 'api.resend.com').length
  const addr = `nl-${run}@example.test`
  const r = []
  for (let i = 0; i < 4; i++) r.push(await call({ email: addr, lang: 'de', source: 't' }, ANON, { 'x-forwarded-for': ip }))
  pruefe(r.every((x) => x.status === 200 && x.json?.ok === true && !('already' in x.json)), 'same address 4x -> always {ok:true}')
  pruefe(mails() === 3, `only 3 confirmation mails per address and day (${mails()})`)
  await svc('PATCH', `/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(addr)}`, { status: 'confirmed' })
  const conf = await call({ email: `c2-${run}@example.test` }, ANON, { 'x-forwarded-for': ip + '1' })
  await svc('PATCH', `/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(`c2-${run}@example.test`)}`, { status: 'confirmed' })
  const again = await call({ email: `c2-${run}@example.test` }, ANON, { 'x-forwarded-for': ip + '1' })
  pruefe(conf.status === 200 && JSON.stringify(again.json) === JSON.stringify(conf.json), `confirmed address answers like a new one (no status oracle): ${JSON.stringify(again.json)}`)
  const st = []
  for (let i = 0; i < 11; i++) st.push((await call({ email: `ip${i}-${run}@example.test` }, ANON, { 'x-forwarded-for': ip + '2' })).status)
  pruefe(st.slice(0, 10).every((s) => s === 200) && st[10] === 429, `11th sign-up from one IP in the hour -> 429 (${st.join(',')})`)
}

if (which === 'delete') {
  const u = await user('del')
  const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
  const up = await realFetch(`${API}/storage/v1/object/avatars/${u.id}/a.png`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${u.token}`, 'Content-Type': 'image/png' }, body: PNG })
  await svc('POST', '/rest/v1/newsletter_subscribers', { email: u.email, confirm_token: 'b'.repeat(48), status: 'confirmed' })
  pruefe(up.status === 200, `avatar fixture (${up.status})`)
  const anon = await call({}, ANON)
  pruefe(anon.status === 401, `anon key -> 401 (${anon.status})`)
  const ok = await call({}, u.token)
  pruefe(ok.status === 200 && ok.json?.ok === true, `delete -> 200 (${ok.status} ${JSON.stringify(ok.json)})`)
  const obj = await svc('POST', '/storage/v1/object/list/avatars', { prefix: u.id, limit: 10 })
  pruefe(Array.isArray(obj.json) && obj.json.length === 0, `avatar file removed (${JSON.stringify(obj.json)?.slice(0, 80)})`)
  const nl = await svc('GET', `/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(u.email)}&select=id`)
  pruefe(nl.json?.length === 0, 'newsletter row removed')
  const au = await svc('GET', `/auth/v1/admin/users/${u.id}`)
  pruefe(au.status === 404, `auth user removed (${au.status})`)
}

console.log(fehler ? `FAILED (${fehler})` : 'ALL CHECKS PASSED')
Deno.exit(fehler ? 1 : 0)
