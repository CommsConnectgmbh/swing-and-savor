// Public Rivalries endpoint — returns head-to-head record between two profiles
// or all rivalries for a single profile.
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

  const { data: me } = await supabase
    .from('profiles').select('id, handle, display_name, avatar_url')
    .eq('handle', handle).maybeSingle()
  if (!me) return j({ error: 'not_found' }, { status: 404 })

  const { data: rows } = await supabase
    .from('rivalries')
    .select('profile_low, profile_high, matches_total, wins_low, wins_high, draws, last_clash_at')
    .or(`profile_low.eq.${me.id},profile_high.eq.${me.id}`)
    .order('last_clash_at', { ascending: false })
    .limit(50)

  const opponentIds = new Set<string>()
  for (const r of rows || []) {
    opponentIds.add(r.profile_low === me.id ? r.profile_high : r.profile_low)
  }
  const oppMap = new Map<string, any>()
  if (opponentIds.size > 0) {
    const { data: profs } = await supabase
      .from('profiles').select('id, handle, display_name, avatar_url')
      .in('id', [...opponentIds])
    for (const p of profs || []) oppMap.set(p.id, p)
  }

  const rivalries = (rows || []).map((r) => {
    const isLow = r.profile_low === me.id
    const myWins  = isLow ? r.wins_low  : r.wins_high
    const oppWins = isLow ? r.wins_high : r.wins_low
    const opponent = oppMap.get(isLow ? r.profile_high : r.profile_low) || null
    return {
      opponent,
      matches_total: r.matches_total,
      wins:   myWins,
      losses: oppWins,
      draws:  r.draws,
      last_clash_at: r.last_clash_at,
      lead: myWins > oppWins ? 'me' : oppWins > myWins ? 'opponent' : 'even',
    }
  }).filter((r) => r.opponent)

  return j({ me, rivalries })
})
