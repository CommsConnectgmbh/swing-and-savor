import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import { computeStats, sideInMatch } from './stats'

const singles = (id, a, b, winner, tournament_id = 't1') => ({
  id, tournament_id, winner, status: 'finished',
  team_a_player1_id: a, team_b_player1_id: b,
})

describe('sideInMatch', () => {
  it('findet Singles-, Doubles- und Flight-Slots', () => {
    expect(sideInMatch(singles('m', 'pA', 'pB'), new Set(['pA']))).toBe('A')
    expect(sideInMatch(singles('m', 'pA', 'pB'), new Set(['pB']))).toBe('B')
    expect(sideInMatch({ team_a_player2_id: 'x' }, new Set(['x']))).toBe('A')
    expect(sideInMatch({ team_a_player_ids: ['a'], team_b_player_ids: ['b', 'me'] }, new Set(['me']))).toBe('B')
    expect(sideInMatch(singles('m', 'pA', 'pB'), new Set(['other']))).toBe(null)
  })
})

describe('computeStats', () => {
  it('angenommenes Duell: Besitzer in Team B gewinnt, wenn B gewinnt', () => {
    const s = computeStats({
      playerIds: new Set(['pB']),
      matches: [singles('m1', 'pA', 'pB', 'B')],
      holes: [{ match_id: 'm1', winner: 'B' }, { match_id: 'm1', winner: 'A' }, { match_id: 'm1', winner: 'B' }],
    })
    expect(s).toMatchObject({ matchesPlayed: 1, wins: 1, losses: 0, holesWon: 2, holesPlayed: 3 })
  })

  it('Herausforderer in Team A verliert dasselbe Duell', () => {
    const s = computeStats({ playerIds: new Set(['pA']), matches: [singles('m1', 'pA', 'pB', 'B')] })
    expect(s).toMatchObject({ wins: 0, losses: 1, winRate: 0 })
  })

  it('zählt nur Matches, in denen das Profil spielt, und Halbierte halb', () => {
    const s = computeStats({
      playerIds: new Set(['me']),
      matches: [singles('m1', 'me', 'x', 'halved'), singles('m2', 'y', 'z', 'A')],
      holes: [{ match_id: 'm2', winner: 'A' }],
    })
    expect(s).toMatchObject({ matchesPlayed: 1, halved: 1, winRate: 0.5, holesPlayed: 0 })
  })

  it('Altbestand ohne profile_id-Verknüpfung: eigener Cup zählt als Team A', () => {
    const s = computeStats({
      legacyTournamentIds: new Set(['old']),
      matches: [singles('m1', 'n1', 'n2', 'A', 'old'), singles('m2', 'n3', 'n4', 'B', 'old')],
    })
    expect(s).toMatchObject({ matchesPlayed: 2, wins: 1, losses: 1 })
  })

  it('leere Eingabe ergibt Nullen', () => {
    expect(computeStats({})).toMatchObject({ matchesPlayed: 0, winRate: 0, holePct: 0 })
  })
})
