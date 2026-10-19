// Public Invitational endpoint v3 — includes team identity (color + logo).
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
  const invite = (url.searchParams.get('invite') || '').trim()
  if (!invite) return j({ error: 'invite_required' }, { status: 400 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: cup, error: cErr } = await supabase
    .from('tournaments')
    .select('id, name, description, date, status, team_a_name, team_b_name, team_a_color, team_b_color, team_a_logo_url, team_b_logo_url, invite_code, owner_id, cover_url, location_name, format, package_type, visibility')
    .eq('invite_code', invite)
    .maybeSingle()
  if (cErr) return j({ error: cErr.message }, { status: 500 })
  if (!cup)  return j({ error: 'not_found' }, { status: 404 })
  if (cup.visibility !== 'public') return j({ error: 'private' }, { status: 403 })

  let captain: any = null
  if (cup.owner_id) {
    const { data: prof } = await supabase
      .from('profiles').select('handle, display_name, avatar_url')
      .eq('id', cup.owner_id).maybeSingle()
    if (prof) captain = prof
  }

  const { data: players } = await supabase
    .from('players').select('name, team, profile_id')
    .eq('tournament_id', cup.id)
  const profileIds = (players || []).map((p) => p.profile_id).filter(Boolean)
  const profileMap = new Map<string, any>()
  if (profileIds.length) {
    const { data: profs } = await supabase
      .from('profiles').select('id, display_name, handle, avatar_url').in('id', profileIds)
    for (const p of profs || []) profileMap.set(p.id, p)
  }
  const participants = (players || []).map((p) => ({
    name: p.profile_id && profileMap.get(p.profile_id)?.display_name || p.name,
    handle: p.profile_id ? (profileMap.get(p.profile_id)?.handle || null) : null,
    avatar_url: p.profile_id ? (profileMap.get(p.profile_id)?.avatar_url || null) : null,
    team: p.team,
  }))

  const { data: matches } = await supabase
    .from('matches').select('status, winner').eq('tournament_id', cup.id)
  const matches_total = (matches || []).length
  const matches_finished = (matches || []).filter((m) => m.status === 'finished').length
  let score_a = 0, score_b = 0
  for (const m of matches || []) {
    if (m.status !== 'finished') continue
    if (m.winner === 'A') score_a += 1
    else if (m.winner === 'B') score_b += 1
    else if (m.winner === 'halved') { score_a += 0.5; score_b += 0.5 }
  }

  const { data: placements } = await supabase
    .from('sponsor_placements')
    .select('placement_type, sponsor:sponsor_id (id, name, logo_url, website_url, type)')
    .eq('tournament_id', cup.id).eq('status', 'active')
  const sponsors = (placements || [])
    .filter((p: any) => p.sponsor)
    .map((p: any) => ({ ...p.sponsor, placement_type: p.placement_type }))

  return j({
    cup: {
      id: cup.id, name: cup.name, description: cup.description, date: cup.date, status: cup.status,
      team_a_name: cup.team_a_name, team_b_name: cup.team_b_name,
      team_a_color: cup.team_a_color, team_b_color: cup.team_b_color,
      team_a_logo_url: cup.team_a_logo_url, team_b_logo_url: cup.team_b_logo_url,
      invite_code: cup.invite_code,
      cover_url: cup.cover_url, location_name: cup.location_name, format: cup.format,
      package_type: cup.package_type,
      score_a, score_b, matches_total, matches_finished,
    },
    captain, participants, sponsors,
  })
})
