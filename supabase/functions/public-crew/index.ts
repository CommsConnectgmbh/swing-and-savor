// Public Crew endpoint — returns a crew/community-group with its cups, members and stats.
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

  const { data: group, error: gErr } = await supabase
    .from('community_groups')
    .select('id, name, slug, description, cover_url, region, type, owner_id, visibility, created_at')
    .eq('slug', slug).maybeSingle()
  if (gErr) return j({ error: gErr.message }, { status: 500 })
  if (!group) return j({ error: 'not_found' }, { status: 404 })
  if (group.visibility !== 'public') return j({ error: 'private' }, { status: 403 })

  let captain: any = null
  if (group.owner_id) {
    const { data: prof } = await supabase
      .from('profiles').select('handle, display_name, avatar_url').eq('id', group.owner_id).maybeSingle()
    if (prof) captain = prof
  }

  // Members
  const { data: memberRows } = await supabase
    .from('community_group_members')
    .select('role, joined_at, profile:profile_id(id, handle, display_name, avatar_url)')
    .eq('group_id', group.id)
    .order('joined_at', { ascending: true })
  const members = (memberRows || []).map((m: any) => ({
    role: m.role, joined_at: m.joined_at,
    profile: m.profile || null,
  })).filter((m: any) => m.profile)

  // Cups tagged to this group
  const { data: cups } = await supabase
    .from('tournaments')
    .select('id, name, date, status, team_a_name, team_b_name, invite_code, cover_url, location_name, package_type')
    .eq('group_id', group.id)
    .order('date', { ascending: false })
    .limit(100)

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
  const finishedCups = enrichedCups.filter((c) => c.status === 'finished')
  const activeCups   = enrichedCups.filter((c) => c.status !== 'finished')

  // Champion tally
  const tally = new Map<string, number>()
  for (const c of finishedCups) {
    if (c.champion) tally.set(c.champion, (tally.get(c.champion) || 0) + 1)
  }
  const championTally = Array.from(tally.entries())
    .map(([name, wins]) => ({ name, wins }))
    .sort((a, b) => b.wins - a.wins)

  return j({
    group,
    captain,
    members,
    stats: {
      members_total: members.length,
      cups_total:    enrichedCups.length,
      cups_finished: finishedCups.length,
      cups_active:   activeCups.length,
    },
    champion_tally: championTally,
    finished_cups: finishedCups,
    active_cups:   activeCups,
  })
})
