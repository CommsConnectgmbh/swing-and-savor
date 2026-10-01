import { supabase } from './supabase'

const EMPTY = Object.freeze({
  matchesPlayed: 0, wins: 0, losses: 0, halved: 0, winRate: 0,
  holesWon: 0, holesPlayed: 0, holePct: 0,
})

// Auf welcher Seite ('A' | 'B') steht einer der Spieler-Slots in diesem Match?
// Berücksichtigt Singles/Doubles-Slots und Flight-Arrays. null = nicht dabei.
export function sideInMatch(match, playerIds) {
  if (!match || !playerIds?.size) return null
  const a = [match.team_a_player1_id, match.team_a_player2_id, ...(match.team_a_player_ids || [])]
  const b = [match.team_b_player1_id, match.team_b_player2_id, ...(match.team_b_player_ids || [])]
  if (a.some(id => id && playerIds.has(id))) return 'A'
  if (b.some(id => id && playerIds.has(id))) return 'B'
  return null
}

// Reine Auswertung, getrennt von den Abfragen (testbar).
//  playerIds:          Set der players.id, die per profile_id mit dem Profil verknüpft sind
//  matches:            beendete Matches mit Slot-Spalten und tournament_id
//  holes:              hole_results ({ match_id, winner }) dieser Matches
//  legacyTournamentIds Set der eigenen Cups, in denen das Profil mit keinem Spieler
//                      verknüpft ist (Altbestand vor profile_id). Nur dort gilt die
//                      alte Konvention „Ersteller spielt Team A“.
export function computeStats({ playerIds = new Set(), matches = [], holes = [], legacyTournamentIds = new Set() }) {
  const sideByMatch = new Map()
  for (const m of matches) {
    let side = sideInMatch(m, playerIds)
    if (!side && legacyTournamentIds.has(m.tournament_id)) side = 'A'
    if (side) sideByMatch.set(m.id, { side, winner: m.winner })
  }

  let wins = 0, losses = 0, halved = 0
  for (const { side, winner } of sideByMatch.values()) {
    if (winner === 'halved') halved++
    else if (winner === side) wins++
    else if (winner === 'A' || winner === 'B') losses++
  }
  const matchesPlayed = sideByMatch.size

  let holesWon = 0, holesPlayed = 0
  for (const h of holes) {
    const entry = sideByMatch.get(h.match_id)
    if (!entry) continue
    holesPlayed++
    if (h.winner === entry.side) holesWon++
  }

  return {
    matchesPlayed,
    wins, losses, halved,
    winRate: matchesPlayed ? (wins + halved * 0.5) / matchesPlayed : 0,
    holesWon, holesPlayed,
    holePct: holesPlayed ? holesWon / holesPlayed : 0,
  }
}

const MATCH_COLUMNS = 'id, status, winner, tournament_id, team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id, team_a_player_ids, team_b_player_ids'

// Profil-Statistik über die tatsächliche Team-Zugehörigkeit (players.profile_id).
export async function fetchPlayerStats(profileId) {
  const [{ data: players }, { data: owned }] = await Promise.all([
    supabase.from('players').select('id, tournament_id').eq('profile_id', profileId),
    supabase.from('tournaments').select('id').eq('owner_id', profileId),
  ])

  const playerIds = new Set((players ?? []).map(p => p.id))
  const linkedTournaments = new Set((players ?? []).map(p => p.tournament_id))
  const legacyTournamentIds = new Set(
    (owned ?? []).map(t => t.id).filter(id => !linkedTournaments.has(id))
  )

  const tournamentIds = [...new Set([...linkedTournaments, ...legacyTournamentIds])]
  if (tournamentIds.length === 0) return { ...EMPTY }

  const { data: matches } = await supabase
    .from('matches')
    .select(MATCH_COLUMNS)
    .in('tournament_id', tournamentIds)
    .eq('status', 'finished')

  const matchIds = (matches ?? []).map(m => m.id)
  let holes = []
  if (matchIds.length) {
    const { data } = await supabase
      .from('hole_results')
      .select('match_id, winner')
      .in('match_id', matchIds)
    holes = data ?? []
  }

  return computeStats({ playerIds, matches: matches ?? [], holes, legacyTournamentIds })
}
