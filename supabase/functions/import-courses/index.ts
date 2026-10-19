// Edge Function: import courses from golfcourseapi.com into our courses table.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const KEY = Deno.env.get('GOLFCOURSEAPI_KEY')
  if (!KEY) return json({ error: 'GOLFCOURSEAPI_KEY not configured', courses: [] }, 503)

  let body: { q?: string } = {}
  try { body = await req.json() } catch {}
  const q = (body.q ?? '').trim()
  if (!q || q.length < 2) return json({ error: 'q required (min 2 chars)' }, 400)

  const upstream = await fetch(
    `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(q)}`,
    { headers: { 'Authorization': `Key ${KEY}` } },
  )
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    return json({ error: `upstream ${upstream.status}: ${text}` }, 502)
  }
  const remote = await upstream.json()
  const rawCourses = remote?.courses ?? []

  const rows = rawCourses.slice(0, 30).map((c: any) => {
    const id = String(c.id ?? c.club_id ?? c.course_id ?? '')
    if (!id) return null
    const tee = c.tees?.male?.[0] ?? c.tees?.female?.[0] ?? null
    const holes = tee?.holes ?? c.holes ?? []
    const pars = Array.isArray(holes) ? holes.map((h: any) => Number(h.par) || 4) : []
    const hcps = Array.isArray(holes) ? holes.map((h: any) => Number(h.handicap ?? h.stroke_index) || 0) : []
    const lat = Number(c.location?.latitude ?? c.lat)
    const lng = Number(c.location?.longitude ?? c.lng)
    return {
      source: 'golfcourseapi',
      source_id: id,
      name: c.club_name ?? c.course_name ?? c.name ?? 'Unbekannter Platz',
      city: c.location?.city ?? null,
      country: c.location?.country ?? null,
      postal_code: c.location?.postal_code ?? null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      hole_pars: pars.length === 18 ? pars : [],
      hole_handicaps: hcps.length === 18 ? hcps : [],
      num_holes: pars.length || 18,
    }
  }).filter(Boolean) as any[]

  if (rows.length === 0) return json({ courses: [], count: 0 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Find-or-update per row (partial unique index can't drive ON CONFLICT)
  const sourceIds = rows.map(r => r.source_id)
  const { data: existing } = await supabase
    .from('courses')
    .select('id, source, source_id')
    .eq('source', 'golfcourseapi')
    .in('source_id', sourceIds)
  const bySrcId = new Map((existing ?? []).map((e: any) => [e.source_id, e.id]))

  const toInsert = rows.filter(r => !bySrcId.has(r.source_id))
  const toUpdate = rows.filter(r =>  bySrcId.has(r.source_id))

  const insertedIds: string[] = []
  if (toInsert.length) {
    const { data, error } = await supabase
      .from('courses').insert(toInsert).select('id')
    if (error) return json({ error: `insert: ${error.message}` }, 500)
    insertedIds.push(...(data ?? []).map((r: any) => r.id))
  }
  for (const r of toUpdate) {
    await supabase.from('courses')
      .update({
        name: r.name, city: r.city, country: r.country, postal_code: r.postal_code,
        lat: r.lat, lng: r.lng,
        hole_pars: r.hole_pars, hole_handicaps: r.hole_handicaps, num_holes: r.num_holes,
      })
      .eq('id', bySrcId.get(r.source_id))
  }

  const allIds = [...insertedIds, ...toUpdate.map(r => bySrcId.get(r.source_id))]
  const { data: full } = await supabase
    .from('courses')
    .select('id, name, city, country, total_par, hole_pars, hole_handicaps, lat, lng')
    .in('id', allIds)

  return json({ courses: full ?? [], count: full?.length ?? 0 })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
