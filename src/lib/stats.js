import { supabase } from './supabase'

// Aggregates per-profile match-play stats by joining matches/holes via tournament players.
// Returns: { matchesPlayed, wins, losses, halved, holesWon, holesPlayed, winRate, holePct }
export async function fetchPlayerStats(profileId) {
  // 1) tournaments the player ever played in via name match — but we need a stable link.
  //    For now we link by tournament_invites+owner OR by player rows where name matches profile display_name.
  //    Simplest stable approach: only count matches where this user owns the tournament OR is owner of joined-match.
  //    For richer stats we'd add a profile_id FK to players (next iteration).

  const { data: invites } = await supabase
    .from('tournament_invites')
    .select('tournament_id')
    .eq('profile_id', profileId)

  const { data: owned } = await supabase
    .from('tournaments')
    .select('id')
    .eq('owner_id', profileId)

  const tournamentIds = new Set([
    ...(owned ?? []).map(t => t.id),
    ...(invites ?? []).map(i => i.tournament_id),
  ])

  if (tournamentIds.size === 0) {
    return { matchesPlayed: 0, wins: 0, losses: 0, halved: 0, winRate: 0,
             holesWon: 0, holesPlayed: 0, holePct: 0 }
  }

  const { data: matches } = await supabase
    .from('matches')
    .select('id, status, winner, tournament_id')
    .in('tournament_id', Array.from(tournamentIds))
    .eq('status', 'finished')

  const matchesPlayed = matches?.length ?? 0
  const wins   = matches?.filter(m => m.winner === 'A').length ?? 0   // owner is conventionally team A
  const losses = matches?.filter(m => m.winner === 'B').length ?? 0
  const halved = matches?.filter(m => m.winner === 'halved').length ?? 0

  const matchIds = (matches ?? []).map(m => m.id)
  let holesWon = 0, holesPlayed = 0
  if (matchIds.length) {
    const { data: holes } = await supabase
      .from('hole_results')
      .select('winner')
      .in('match_id', matchIds)
    holesPlayed = holes?.length ?? 0
    holesWon    = holes?.filter(h => h.winner === 'A').length ?? 0
  }

  return {
    matchesPlayed,
    wins, losses, halved,
    winRate: matchesPlayed ? (wins + halved * 0.5) / matchesPlayed : 0,
    holesWon, holesPlayed,
    holePct: holesPlayed ? holesWon / holesPlayed : 0,
  }
}
