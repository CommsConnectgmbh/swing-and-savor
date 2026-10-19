import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

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

function buildQuery(opts: { country?: string; bbox?: number[]; lat?: number; lng?: number; radius_m?: number }) {
  const head = '[out:json][timeout:180];'
  if (opts.country) {
    const cc = opts.country.toUpperCase().replace(/[^A-Z0-9]/g, '')
    // Drop admin_level filter (some countries have multiple admin levels for ISO3166-1)
    return `${head}area["ISO3166-1"="${cc}"]->.a;(way["leisure"="golf_course"](area.a);relation["leisure"="golf_course"](area.a);node["leisure"="golf_course"](area.a););out center tags;`
  }
  if (opts.bbox && opts.bbox.length === 4) {
    const [s, w, n, e] = opts.bbox
    return `${head}(way["leisure"="golf_course"](${s},${w},${n},${e});relation["leisure"="golf_course"](${s},${w},${n},${e});node["leisure"="golf_course"](${s},${w},${n},${e}););out center tags;`
  }
  if (Number.isFinite(opts.lat) && Number.isFinite(opts.lng)) {
    const r = Math.max(1000, Math.min(100000, opts.radius_m ?? 50000))
    return `${head}(way["leisure"="golf_course"](around:${r},${opts.lat},${opts.lng});relation["leisure"="golf_course"](around:${r},${opts.lat},${opts.lng});node["leisure"="golf_course"](around:${r},${opts.lat},${opts.lng}););out center tags;`
  }
  return null
}

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

  let body: any = {}
  try { body = await req.json() } catch {}
  const query = buildQuery(body)
  if (!query) return json({ error: 'provide country, bbox, or lat/lng' }, 400)

  let osm: any
  try { osm = await runOverpass(query) }
  catch (e: any) { return json({ error: e.message }, 502) }

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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

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
    if (error) return json({ error: `insert: ${error.message}`, partial: { inserted } }, 500)
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
