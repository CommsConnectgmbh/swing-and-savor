import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { buildOverpassQuery, parseSeedRequest } from '../_shared/osmSeed.ts'
import { isAdmin, registerRateLimit, requireUser } from '../_shared/edgeGuard.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function runOverpass(query: string) {
  const errors: string[] = []
  for (const ep of OVERPASS_ENDPOINTS) {
    for (const wait of [0, 5000, 15000]) {
      if (wait) await sleep(wait)
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
        })
        if (res.ok) return await res.json()
        errors.push(`${ep} HTTP ${res.status}`)
        if (res.status !== 429 && res.status !== 504 && res.status !== 502) break
      } catch (e) { errors.push(`${ep} ${e}`); break }
    }
  }
  throw new Error(`overpass failed: ${errors.join(' | ')}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // verify_jwt is satisfied by the public anon key: require a real user.
  const user = await requireUser(req, supabase)
  if (!user) return json({ error: 'login_required' }, 401)

  let body: unknown = {}
  try { body = await req.json() } catch { /* handled by validation */ }
  const parsed = parseSeedRequest(body, { admin: isAdmin(user) })
  if ('error' in parsed) return json({ error: parsed.error }, parsed.error === 'forbidden' ? 403 : 400)

  // Durable per-user limit (migration 043); fail closed if unavailable.
  let allowed = false
  try { allowed = await registerRateLimit(supabase, ['osm-seed:' + user.id]) }
  catch { return json({ error: 'temporarily_unavailable' }, 503) }
  if (!allowed) return json({ error: 'too_many_requests' }, 429)

  const query = buildOverpassQuery(parsed)

  let osm: any
  try { osm = await runOverpass(query) }
  catch (e: any) { console.error('[osm-seed-courses]', e?.message); return json({ error: 'upstream_failed' }, 502) }

  const elements: any[] = osm?.elements ?? []
  if (elements.length === 0) return json({ count: 0, inserted: 0, updated: 0 })

  const rows = elements.map((el) => {
    const tags = el.tags || {}
    const name = tags.name || tags['name:de'] || tags['name:en']
    if (!name) return null
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    return {
      source: 'osm',
      source_id: `osm-${el.type}-${el.id}`,
      name: String(name).slice(0, 200),
      city: tags['addr:city'] || tags['is_in:city'] || null,
      country: tags['addr:country'] || null,
      postal_code: tags['addr:postcode'] || null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      hole_pars: [], hole_handicaps: [],
      num_holes: parseInt(tags['holes']) || 18,
      notes: tags.website || null,
    }
  }).filter(Boolean) as any[]

  if (rows.length === 0) return json({ count: 0, inserted: 0, updated: 0, note: 'no named courses' })

  const sourceIds = rows.map(r => r.source_id)
  const existing = new Map<string, string>()
  for (let i = 0; i < sourceIds.length; i += 1000) {
    const chunk = sourceIds.slice(i, i + 1000)
    const { data } = await supabase.from('courses')
      .select('id, source_id').eq('source', 'osm').in('source_id', chunk)
    ;(data ?? []).forEach((r: any) => existing.set(r.source_id, r.id))
  }

  const toInsert = rows.filter(r => !existing.has(r.source_id))
  const toUpdate = rows.filter(r =>  existing.has(r.source_id))

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 500) {
    const slice = toInsert.slice(i, i + 500)
    const { data, error } = await supabase.from('courses').insert(slice).select('id')
    if (error) { console.error('[osm-seed-courses] insert', error.message); return json({ error: 'insert_failed', partial: { inserted } }, 500) }
    inserted += data?.length ?? 0
  }

  let updated = 0
  for (const r of toUpdate) {
    const id = existing.get(r.source_id)!
    const { error } = await supabase.from('courses').update({
      name: r.name, city: r.city, country: r.country, postal_code: r.postal_code,
      lat: r.lat, lng: r.lng, num_holes: r.num_holes, notes: r.notes,
    }).eq('id', id)
    if (!error) updated += 1
  }

  return json({ count: rows.length, inserted, updated })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
