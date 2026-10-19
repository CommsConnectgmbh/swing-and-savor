// Public Season endpoint — aggregates Cups under a Season for league/city-rivalry views.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function j(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...CORS, ...(init.headers || {}) },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'GET')     return j({ error: 'method_not_allowed' }, { status: 405 })

  const url = new URL(req.url)
  const slug = (url.searchParams.get('slug') || '').trim().toLowerCase()
  if (!slug) return j({ error: 'slug_required' }, { status: 400 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: season, error: sErr } = await supabase
    .from('seasons')
    .select('id, name, slug, starts_on, ends_on, type, cover_url, description, owner_id, visibility, scoring, group_id')
    .eq('slug', slug).maybeSingle()
  if (sErr) return j({ error: sErr.message }, { status: 500 })
  if (!season) return j({ error: 'not_found' }, { status: 404 })
  if (season.visibility !== 'public') return j({ error: 'private' }, { status: 403 })

  let captain: any = null
  if (season.owner_id) {
    const { data: prof } = await supabase
      .from('profiles').select('handle, display_name, avatar_url').eq('id', season.owner_id).maybeSingle()
    if (prof) captain = prof
  }

  let group: any = null
  if (season.group_id) {
    const { data: g } = await supabase
      .from('community_groups').select('name, slug, type, region').eq('id', season.group_id).maybeSingle()
    if (g) group = g
  }

  const { data: cups } = await supabase
    .from('tournaments')
    .select('id, name, date, status, team_a_name, team_b_name, invite_code, cover_url, location_name, package_type')
    .eq('season_id', season.id)
    .order('date', { ascending: true })

  const cupIds = (cups || []).map((c) => c.id)
  const scoresById = new Map<string, { score_a: number, score_b: number, champion: string | null }>()
  if (cupIds.length) {
    const { data: matches } = await supabase
      .from('matches').select('tournament_id, status, winner').in('tournament_id', cupIds)
    for (const c of cups || []) scoresById.set(c.id, { score_a: 0, score_b: 0, champion: null })
    for (const m of matches || []) {
      const a = scoresById.get(m.tournament_id); if (!a) continue
      if (m.status !== 'finished') continue
      if (m.winner === 'A') a.score_a += 1
      else if (m.winner === 'B') a.score_b += 1
      else if (m.winner === 'halved') { a.score_a += 0.5; a.score_b += 0.5 }
    }
    for (const c of cups || []) {
      const a = scoresById.get(c.id)!
      a.champion = a.score_a === a.score_b ? null : a.score_a > a.score_b ? c.team_a_name : c.team_b_name
    }
  }

  const enrichedCups = (cups || []).map((c) => ({ ...c, ...scoresById.get(c.id)! }))

  // Season standings — count cups won per team-name across all Cups
  const standings = new Map<string, { name: string, wins: number, points: number }>()
  const addPoint = (name: string, pts: number) => {
    const s = standings.get(name) || { name, wins: 0, points: 0 }
    s.points += pts
    if (pts >= 2) s.wins += 1
    standings.set(name, s)
  }
  for (const c of enrichedCups) {
    if (c.status !== 'finished') continue
    if (c.score_a > c.score_b)      { addPoint(c.team_a_name, 3); addPoint(c.team_b_name, 0) }
    else if (c.score_b > c.score_a) { addPoint(c.team_b_name, 3); addPoint(c.team_a_name, 0) }
    else                            { addPoint(c.team_a_name, 1); addPoint(c.team_b_name, 1) }
  }
  const standingsList = Array.from(standings.values()).sort((a, b) => b.points - a.points)

  return j({
    season, captain, group,
    stats: {
      cups_total:    enrichedCups.length,
      cups_finished: enrichedCups.filter((c) => c.status === 'finished').length,
      cups_active:   enrichedCups.filter((c) => c.status !== 'finished').length,
    },
    standings: standingsList,
    cups: enrichedCups,
  })
})
