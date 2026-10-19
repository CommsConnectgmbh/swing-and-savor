// Public Hall-of-Fame endpoint. Returns a captain's career: all their public finished cups,
// champion tally per team, total cups, recent recap links.
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
  const handle = (url.searchParams.get('handle') || '').trim().toLowerCase()
  if (!handle) return j({ error: 'handle_required' }, { status: 400 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: captain, error: cErr } = await supabase
    .from('profiles')
    .select('id, handle, display_name, avatar_url, home_club, country_code, created_at')
    .eq('handle', handle)
    .maybeSingle()
  if (cErr) return j({ error: cErr.message }, { status: 500 })
  if (!captain) return j({ error: 'not_found' }, { status: 404 })

  const { data: cups } = await supabase
    .from('tournaments')
    .select('id, name, date, status, team_a_name, team_b_name, invite_code, cover_url, location_name, package_type, visibility')
    .eq('owner_id', captain.id)
    .eq('visibility', 'public')
    .order('date', { ascending: false })
    .limit(100)

  // For each cup, compute final score from matches
  const cupIds = (cups || []).map((c) => c.id)
  const scoresById = new Map<string, { score_a: number, score_b: number, champion: string | null, matches_total: number, matches_finished: number }>()
  if (cupIds.length) {
    const { data: matches } = await supabase
      .from('matches')
      .select('tournament_id, status, winner')
      .in('tournament_id', cupIds)
    for (const c of cups || []) scoresById.set(c.id, { score_a: 0, score_b: 0, champion: null, matches_total: 0, matches_finished: 0 })
    for (const m of matches || []) {
      const agg = scoresById.get(m.tournament_id)
      if (!agg) continue
      agg.matches_total += 1
      if (m.status === 'finished') {
        agg.matches_finished += 1
        if (m.winner === 'A') agg.score_a += 1
        else if (m.winner === 'B') agg.score_b += 1
        else if (m.winner === 'halved') { agg.score_a += 0.5; agg.score_b += 0.5 }
      }
    }
    for (const c of cups || []) {
      const agg = scoresById.get(c.id)!
      agg.champion = agg.score_a === agg.score_b ? null : agg.score_a > agg.score_b ? c.team_a_name : c.team_b_name
    }
  }

  const enrichedCups = (cups || []).map((c) => ({
    ...c, ...scoresById.get(c.id)!,
  }))
  const finishedCups = enrichedCups.filter((c) => c.status === 'finished')
  const activeCups   = enrichedCups.filter((c) => c.status !== 'finished')

  // Champion-Tally: how many times has each team-name won under this captain?
  const tally = new Map<string, number>()
  for (const c of finishedCups) {
    if (c.champion) tally.set(c.champion, (tally.get(c.champion) || 0) + 1)
  }
  const championTally = Array.from(tally.entries())
    .map(([name, wins]) => ({ name, wins }))
    .sort((a, b) => b.wins - a.wins)

  return j({
    captain: {
      handle: captain.handle,
      display_name: captain.display_name,
      avatar_url: captain.avatar_url,
      home_club: captain.home_club,
      country_code: captain.country_code,
      member_since: captain.created_at,
    },
    stats: {
      cups_total: enrichedCups.length,
      cups_finished: finishedCups.length,
      cups_active: activeCups.length,
    },
    champion_tally: championTally,
    finished_cups: finishedCups,
    active_cups:   activeCups,
  })
})
