/* eslint-env node */
/* global process, console, fetch, crypto, Buffer */
// Security regression tests for migration 043, run as real REST calls
// (PostgREST, GoTrue, Storage) against a LOCAL Supabase stack. Never point this
// at production: it creates users and writes data.
//
//   SNS_API=http://127.0.0.1:57321 SNS_ANON=... SNS_SERVICE=... node security-rest.mjs
//
// The local stack is loaded with a schema-only dump of the live database
// (supabase db dump) plus the live storage policies/buckets, then 043.
// Every check states the SECURE expectation; against the pre-043 schema the
// failing checks are the confirmed findings.
const API = process.env.SNS_API
const ANON = process.env.SNS_ANON
const SERVICE = process.env.SNS_SERVICE
if (!API || !ANON || !SERVICE) { console.error('SNS_API, SNS_ANON, SNS_SERVICE required'); process.exit(2) }
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(API)) { console.error('refusing non-local API'); process.exit(2) }

let fehler = 0
const pruefe = (ok, text) => { console.log((ok ? '  ok   ' : '  FEHL ') + text); if (!ok) fehler++ }
const run = Date.now().toString(36)

async function req(method, path, { token = ANON, body, headers = {}, raw } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      ...(raw ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: r.status, json, text }
}
const svc = (method, path, opts = {}) => req(method, path, { ...opts, token: SERVICE, headers: { apikey: SERVICE, ...(opts.headers || {}) } })
const rest = (method, table, token, body, query = '') =>
  req(method, `/rest/v1/${table}${query}`, { token, body, headers: { Prefer: 'return=representation' } })
const rpc = (fn, token, body) => req('POST', `/rest/v1/rpc/${fn}`, { token, body })

async function user(tag) {
  const email = `${tag}-${run}@example.test`
  const password = `pw-${run}-${tag}-Aa1!`
  const c = await svc('POST', '/auth/v1/admin/users', { body: { email, password, email_confirm: true } })
  if (c.status >= 300) throw new Error('create user ' + c.text)
  const s = await req('POST', '/auth/v1/token?grant_type=password', { body: { email, password } })
  if (!s.json?.access_token) throw new Error('login ' + s.text)
  const id = c.json.id
  const p = await rest('POST', 'profiles', s.json.access_token,
    { id, handle: `${tag}_${run}`.slice(0, 20), display_name: `Name ${tag}` })
  if (p.status >= 300) throw new Error('profile ' + p.text)
  return { id, email, token: s.json.access_token }
}

const A = await user('ua')
const B = await user('ub')

console.log('== profiles: ranking columns')
{
  const r = await rest('PATCH', 'profiles', A.token, { elo_rating: 9999, wins: 999, games_played: 999 }, `?id=eq.${A.id}`)
  const p = await svc('GET', `/rest/v1/profiles?id=eq.${A.id}&select=elo_rating,wins,games_played`)
  pruefe(r.status >= 400 && p.json?.[0]?.elo_rating === 1500, `own elo_rating/wins/games_played not writable (status ${r.status}, elo ${p.json?.[0]?.elo_rating})`)
  const r2 = await rest('PATCH', 'profiles', A.token, { ref_code: 'HACKED01' }, `?id=eq.${A.id}`)
  pruefe(r2.status >= 400, `own ref_code not writable (status ${r2.status})`)
  const ok = await rest('PATCH', 'profiles', A.token, { display_name: 'Neuer Name', hcp: 12.3, updated_at: new Date().toISOString() }, `?id=eq.${A.id}`)
  pruefe(ok.status === 200 && ok.json?.[0]?.display_name === 'Neuer Name', `profile edit (display_name/hcp) still works (status ${ok.status})`)
  const C = await svc('POST', '/auth/v1/admin/users', { body: { email: `uc-${run}@example.test`, password: `pw-${run}-Cc1!`, email_confirm: true } })
  const cs = await req('POST', '/auth/v1/token?grant_type=password', { body: { email: `uc-${run}@example.test`, password: `pw-${run}-Cc1!` } })
  const ins = await rest('POST', 'profiles', cs.json.access_token, { id: C.json.id, handle: `uc_${run}`.slice(0, 20), display_name: 'C', elo_rating: 5000, is_pro: false })
  pruefe(ins.status >= 400, `onboarding insert with elo_rating rejected (status ${ins.status})`)
  const ins2 = await rest('POST', 'profiles', cs.json.access_token, { id: C.json.id, handle: `uc_${run}`.slice(0, 20), display_name: 'C', hcp: 20, home_club: 'X', avatar_url: null })
  pruefe(ins2.status === 201, `onboarding insert with normal columns works (status ${ins2.status})`)
}

console.log('== courses')
let courseB
{
  const c = await rest('POST', 'courses', B.token, { source: 'user', name: `B-Course ${run}`, hole_pars: Array(18).fill(4), hole_handicaps: [] })
  courseB = c.json?.[0]
  pruefe(c.status === 201 && courseB?.created_by === B.id, `user creates a course, created_by defaults to self (status ${c.status}, created_by ${courseB?.created_by === B.id ? 'self' : courseB?.created_by})`)
  const u = await rest('PATCH', 'courses', A.token, { name: 'pwned', website: 'https://evil.example' }, `?id=eq.${courseB.id}`)
  const after = await svc('GET', `/rest/v1/courses?id=eq.${courseB.id}&select=name`)
  pruefe(after.json?.[0]?.name === `B-Course ${run}`, `other user cannot rewrite a course (status ${u.status}, name now "${after.json?.[0]?.name}")`)
  const spoof = await rest('POST', 'courses', A.token, { source: 'user', name: `spoof ${run}`, created_by: B.id })
  pruefe(spoof.status >= 400, `created_by cannot be spoofed (status ${spoof.status})`)
  const src = await rest('POST', 'courses', A.token, { source: 'golfcourseapi', source_id: 'x', name: `src ${run}` })
  pruefe(src.status >= 400, `client cannot insert non-user sources (status ${src.status})`)
  const own = await rest('PATCH', 'courses', B.token, { city: 'Wien' }, `?id=eq.${courseB.id}`)
  pruefe(own.status === 200 && own.json?.[0]?.city === 'Wien', `creator can still edit own course (status ${own.status})`)
  const sys = await rest('PATCH', 'courses', B.token, { contributor_count: 999 }, `?id=eq.${courseB.id}`)
  pruefe(sys.status >= 400, `creator cannot write system columns (status ${sys.status})`)
  const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4]
  const e = await rpc('apply_course_edit', A.token, { p_course_id: courseB.id, p_hole_pars: pars, p_hole_handicaps: null, p_source_match_id: null })
  pruefe(e.status === 200 && e.json?.total_par === 72 && e.json?.contributor_count === 1, `audited community edit via apply_course_edit works, total_par synced (status ${e.status}, total_par ${e.json?.total_par})`)
  const bad = await rpc('apply_course_edit', A.token, { p_course_id: courseB.id, p_hole_pars: [99], p_hole_handicaps: null, p_source_match_id: null })
  pruefe(bad.status >= 400, `apply_course_edit rejects implausible pars (status ${bad.status})`)
  const an = await rpc('apply_course_edit', ANON, { p_course_id: courseB.id, p_hole_pars: pars, p_hole_handicaps: null, p_source_match_id: null })
  pruefe(an.status >= 400, `apply_course_edit not callable logged out (status ${an.status})`)
}

console.log('== join_open_tournament')
async function cup(owner, visibility, join_mode = 'open') {
  // Like the app: client-generated id, no RETURNING (the read policy uses a
  // STABLE helper that cannot see the row inside the inserting statement).
  const id = crypto.randomUUID()
  const r = await req('POST', '/rest/v1/tournaments', { token: owner.token, body: { id, name: `Cup ${visibility} ${run}`, date: '2026-11-01', owner_id: owner.id, visibility, join_mode } })
  if (r.status !== 201) throw new Error('cup ' + r.text)
  return { id }
}
const privCup = await cup(B, 'private')
const pubCup = await cup(B, 'public')
{
  const r = await rpc('join_open_tournament', A.token, { t_id: privCup.id, accepted: true })
  const pl = await svc('GET', `/rest/v1/players?tournament_id=eq.${privCup.id}&profile_id=eq.${A.id}&select=id`)
  pruefe(r.status >= 400 && pl.json?.length === 0, `private open cup cannot be self-joined by a stranger (status ${r.status}, players ${pl.json?.length})`)
  const fr = await cup(B, 'friends')
  const r2 = await rpc('join_open_tournament', A.token, { t_id: fr.id, accepted: true })
  pruefe(r2.status >= 400, `friends-only open cup cannot be joined by a non-friend (status ${r2.status})`)
  const r3 = await rpc('join_open_tournament', A.token, { t_id: pubCup.id, accepted: true })
  pruefe(r3.status === 200 && typeof r3.json === 'string', `public open cup can still be joined (status ${r3.status})`)
}

console.log('== storage: public buckets')
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex')
async function upload(token, bucket, path, body, type) {
  return req('POST', `/storage/v1/object/${bucket}/${path}`, { token, raw: body, headers: { 'Content-Type': type, 'x-upsert': 'false' } })
}
{
  // match B owns via pubCup; A joined pubCup as a player but is not in a match.
  const pa = await svc('POST', '/rest/v1/players', { body: { tournament_id: pubCup.id, name: 'B', handicap: 10, team: 'A', profile_id: B.id }, headers: { Prefer: 'return=representation' } })
  const m = await svc('POST', '/rest/v1/matches', { body: { tournament_id: pubCup.id, type: 'singles', team_a_player1_id: pa.json[0].id }, headers: { Prefer: 'return=representation' } })
  const matchId = m.json?.[0]?.id
  const html = await upload(A.token, 'match-photos', `x-${run}/evil.html`, '<script>alert(1)</script>', 'text/html')
  pruefe(html.status >= 400, `match-photos rejects HTML at an arbitrary path (status ${html.status})`)
  const svg = await upload(B.token, 'match-photos', `${matchId}/a.svg`, '<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml')
  pruefe(svg.status >= 400, `match-photos rejects SVG even for the participant (status ${svg.status})`)
  const foreign = await upload(A.token, 'match-photos', `${matchId}/${run}.png`, PNG, 'image/png')
  pruefe(foreign.status >= 400, `non-participant cannot upload into a match folder (status ${foreign.status})`)
  const okm = await upload(B.token, 'match-photos', `${matchId}/own-${run}.png`, PNG, 'image/png')
  pruefe(okm.status === 200, `participant uploads a match photo (status ${okm.status})`)
  const okc = await upload(B.token, 'match-photos', `cups/${pubCup.id}/${run}.png`, PNG, 'image/png')
  pruefe(okc.status === 200, `cup owner uploads cups/<id> cover in match-photos (status ${okc.status})`)
  const big = await upload(B.token, 'match-photos', `${matchId}/big-${run}.png`, Buffer.alloc(11 * 1024 * 1024, 1), 'image/png')
  pruefe(big.status >= 400, `match-photos rejects >10 MB (status ${big.status})`)

  const cc = await upload(A.token, 'cup-covers', `${pubCup.id}/cover-${run}.png`, PNG, 'image/png')
  pruefe(cc.status >= 400, `cup-covers: stranger cannot upload into someone else's cup (status ${cc.status})`)
  const cco = await upload(B.token, 'cup-covers', `${pubCup.id}/own-cover-${run}.png`, PNG, 'image/png')
  pruefe(cco.status === 200, `cup-covers: owner uploads cover (status ${cco.status})`)

  const sl = await upload(A.token, 'sponsor-logos', `${B.id}/sponsor-${run}.png`, PNG, 'image/png')
  pruefe(sl.status >= 400, `sponsor-logos: cannot upload into another user's folder (status ${sl.status})`)
  const slo = await upload(A.token, 'sponsor-logos', `${A.id}/own-sponsor-${run}.png`, PNG, 'image/png')
  pruefe(slo.status === 200, `sponsor-logos: own folder works (status ${slo.status})`)
  const anon = await upload(ANON, 'sponsor-logos', `x/${run}.png`, PNG, 'image/png')
  pruefe(anon.status >= 400, `anon cannot upload (status ${anon.status})`)
}

console.log('== edge rate limit RPC')
{
  const anon = await rpc('edge_rate_limit_register', ANON, { p_keys: [`osm-seed:${run}`] })
  const auth = await rpc('edge_rate_limit_register', A.token, { p_keys: [`osm-seed:${run}`] })
  pruefe(anon.status >= 400 && auth.status >= 400, `rate-limit RPC not callable by anon/authenticated (${anon.status}/${auth.status})`)
  const res = []
  for (let i = 0; i < 6; i++) res.push((await svc('POST', '/rest/v1/rpc/edge_rate_limit_register', { body: { p_keys: [`osm-seed:${run}`] } })).json)
  pruefe(JSON.stringify(res) === JSON.stringify([true, true, true, true, true, false]), `osm-seed: 5 per hour, 6th blocked (${res.join(',')})`)
  const bad = await svc('POST', '/rest/v1/rpc/edge_rate_limit_register', { body: { p_keys: [`unknown:${run}`] } })
  pruefe(bad.status >= 400, `unknown bucket rejected (status ${bad.status})`)
  const par = await Promise.all(Array.from({ length: 20 }, () => svc('POST', '/rest/v1/rpc/edge_rate_limit_register', { body: { p_keys: [`newsletter-email:par-${run}`] } })))
  pruefe(par.filter((r) => r.json === true).length === 3, `20 parallel calls admit exactly 3 (newsletter-email) (${par.filter((r) => r.json === true).length})`)
}

console.log('== account erasure')
{
  // PII of A spread across tables and buckets.
  await svc('POST', '/rest/v1/newsletter_subscribers', { body: { email: A.email.toUpperCase(), confirm_token: 'a'.repeat(48), status: 'confirmed' } })
  await svc('POST', '/rest/v1/client_debug', { body: { user_id: A.id, event: 'x', user_agent: 'UA' } })
  const pa = await svc('POST', '/rest/v1/players', { body: { tournament_id: pubCup.id, name: 'A Klarname', handicap: 10, team: 'B', profile_id: A.id }, headers: { Prefer: 'return=representation' } })
  const m = await svc('POST', '/rest/v1/matches', { body: { tournament_id: pubCup.id, type: 'singles', team_a_player1_id: pa.json[0].id }, headers: { Prefer: 'return=representation' } })
  await svc('POST', '/rest/v1/scorecard_uploads', { body: { match_id: m.json[0].id, uploaded_by_user_id: A.id, storage_path: `${m.json[0].id}/sc.jpg` } })
  const av = await upload(A.token, 'avatars', `${A.id}/avatar-${run}.png`, PNG, 'image/png')
  const sc = await upload(A.token, 'scorecard-photos', `${m.json[0].id}/sc-${run}.jpg`, PNG, 'image/jpeg')
  pruefe(av.status === 200 && sc.status === 200, `fixtures uploaded (avatar ${av.status}, scorecard ${sc.status})`)

  const anonCall = await rpc('delete_account_data', A.token, { p_uid: A.id, p_email: A.email })
  pruefe(anonCall.status >= 400, `delete_account_data not callable by users (status ${anonCall.status})`)
  const d = await svc('POST', '/rest/v1/rpc/delete_account_data', { body: { p_uid: A.id, p_email: A.email } })
  const objs = (Array.isArray(d.json) ? d.json : []).map((o) => `${o.bucket}/${o.object_name}`)
  pruefe(d.status === 200 && objs.length >= 3, `erasure returns the user's storage objects (${objs.length})`)
  const left = async (path) => (await svc('GET', path)).json?.length
  pruefe(await left(`/rest/v1/profiles?id=eq.${A.id}&select=id`) === 0, 'profile deleted')
  pruefe(await left(`/rest/v1/newsletter_subscribers?email=ilike.${encodeURIComponent(A.email)}&select=id`) === 0, 'newsletter row (any case) deleted')
  pruefe(await left(`/rest/v1/client_debug?user_id=eq.${A.id}&select=id`) === 0, 'client_debug rows deleted')
  pruefe(await left(`/rest/v1/scorecard_uploads?uploaded_by_user_id=eq.${A.id}&select=id`) === 0, 'scorecard_uploads rows deleted')
  const names = (await svc('GET', `/rest/v1/players?id=eq.${pa.json[0].id}&select=name,profile_id`)).json
  pruefe(names?.[0]?.name === 'Gelöschter Spieler' && names?.[0]?.profile_id === null, `name in other people's cups anonymised ("${names?.[0]?.name}")`)
}

console.log(fehler ? `FAILED (${fehler})` : 'ALL CHECKS PASSED')
process.exit(fehler ? 1 : 0)
