import { describe, it, expect } from 'vitest'
import { calcMatchStanding, calcMatchPlayStatus, casualGrossStanding, casualHoleResults, matchPlayHoleRun, calcTeamPoints, suggestFactors, stablefordPoints, calcStablefordTotals, sumPars } from './scoring'

describe('calcMatchStanding', () => {
  it('returns all square with no holes', () => {
    expect(calcMatchStanding([])).toEqual({ holesUp: 0, leader: 'none', label: 'ALL SQ', holesPlayed: 0 })
  })

  it('tracks A winning a hole', () => {
    const holes = [{ winner: 'A' }]
    expect(calcMatchStanding(holes)).toEqual({ holesUp: 1, leader: 'A', label: '1 UP', holesPlayed: 1 })
  })

  it('tracks B winning a hole', () => {
    const holes = [{ winner: 'B' }]
    expect(calcMatchStanding(holes)).toEqual({ holesUp: 1, leader: 'B', label: '1 UP', holesPlayed: 1 })
  })

  it('halved hole does not change standing', () => {
    const holes = [{ winner: 'A' }, { winner: 'halved' }]
    expect(calcMatchStanding(holes)).toEqual({ holesUp: 1, leader: 'A', label: '1 UP', holesPlayed: 2 })
  })

  it('lead changes when opponent wins more', () => {
    const holes = [{ winner: 'A' }, { winner: 'B' }, { winner: 'B' }]
    expect(calcMatchStanding(holes)).toEqual({ holesUp: 1, leader: 'B', label: '1 UP', holesPlayed: 3 })
  })

  it('returns all square when tied', () => {
    const holes = [{ winner: 'A' }, { winner: 'B' }]
    expect(calcMatchStanding(holes)).toEqual({ holesUp: 0, leader: 'none', label: 'ALL SQ', holesPlayed: 2 })
  })
})

describe('calcMatchPlayStatus', () => {
  it('ignores unplayed holes when counting remaining', () => {
    const holes = [{ winner: 'A' }, { winner: 'halved' }, ...Array(16).fill({ winner: null })]
    expect(calcMatchPlayStatus(holes)).toEqual({
      leader: 'A', holesUp: 1, holesPlayed: 2, remaining: 16, decided: false, dormie: false,
    })
  })

  it('reports all square with no leader', () => {
    const holes = [{ winner: 'A' }, { winner: 'B' }, ...Array(16).fill({ winner: null })]
    expect(calcMatchPlayStatus(holes)).toMatchObject({ leader: 'none', holesUp: 0, decided: false, dormie: false })
  })

  it('flags dormie when lead equals holes remaining', () => {
    // B leads by 2 after 16 holes → 2 remaining → dormie, not yet decided
    const holes = [
      ...Array(2).fill({ winner: 'B' }),
      ...Array(14).fill({ winner: 'halved' }),
      ...Array(2).fill({ winner: null }),
    ]
    expect(calcMatchPlayStatus(holes)).toMatchObject({ leader: 'B', holesUp: 2, remaining: 2, dormie: true, decided: false })
  })

  it('flags decided when lead exceeds holes remaining', () => {
    // A leads by 3 after 16 holes → 2 remaining → mathematically decided (3&2)
    const holes = [
      ...Array(3).fill({ winner: 'A' }),
      ...Array(13).fill({ winner: 'halved' }),
      ...Array(2).fill({ winner: null }),
    ]
    expect(calcMatchPlayStatus(holes)).toMatchObject({ leader: 'A', holesUp: 3, remaining: 2, decided: true, dormie: false })
  })

  it('handles empty input', () => {
    expect(calcMatchPlayStatus([])).toEqual({
      leader: 'none', holesUp: 0, holesPlayed: 0, remaining: 18, decided: false, dormie: false,
    })
  })
})

describe('casualGrossStanding', () => {
  const players = [{ idx: 1, display_name: 'Rainer' }, { idx: 2, display_name: 'Oli Hoffmann' }]

  it('names the leader from real 2-player scores (Oli 2 up after 5)', () => {
    // Loch1 4:3(Oli), 2 3:3, 3 4:4, 4 6:5(Oli), 5 4:4 → Oli 2 auf
    const scores = [
      { player_idx: 1, hole_number: 1, strokes: 4 }, { player_idx: 2, hole_number: 1, strokes: 3 },
      { player_idx: 1, hole_number: 2, strokes: 3 }, { player_idx: 2, hole_number: 2, strokes: 3 },
      { player_idx: 1, hole_number: 3, strokes: 4 }, { player_idx: 2, hole_number: 3, strokes: 4 },
      { player_idx: 1, hole_number: 4, strokes: 6 }, { player_idx: 2, hole_number: 4, strokes: 5 },
      { player_idx: 1, hole_number: 5, strokes: 4 }, { player_idx: 2, hole_number: 5, strokes: 4 },
    ]
    const st = casualGrossStanding(players, scores)
    expect(st).toMatchObject({ leader: 'B', label: '2 Up', played: 5, remaining: 13 })
    expect(st.b.display_name).toBe('Oli Hoffmann')
  })

  it('ignores holes only one player has scored', () => {
    const scores = [
      { player_idx: 1, hole_number: 1, strokes: 4 }, { player_idx: 2, hole_number: 1, strokes: 3 },
      { player_idx: 1, hole_number: 2, strokes: 5 }, // nur Rainer → zählt nicht
    ]
    expect(casualGrossStanding(players, scores)).toMatchObject({ leader: 'B', played: 1 })
  })

  it('returns null when not exactly two players', () => {
    expect(casualGrossStanding([{ idx: 1 }], [])).toBe(null)
    expect(casualGrossStanding([{ idx: 1 }, { idx: 2 }, { idx: 3 }], [])).toBe(null)
  })
})

describe('casualHoleResults', () => {
  const players = [{ idx: 1, display_name: 'Rainer' }, { idx: 2, display_name: 'Oli Hoffmann' }]

  it('returns per-hole winner and running standing on real data', () => {
    const scores = [
      { player_idx: 1, hole_number: 1, strokes: 4 }, { player_idx: 2, hole_number: 1, strokes: 3 },
      { player_idx: 1, hole_number: 2, strokes: 3 }, { player_idx: 2, hole_number: 2, strokes: 3 },
      { player_idx: 1, hole_number: 3, strokes: 4 }, { player_idx: 2, hole_number: 3, strokes: 4 },
      { player_idx: 1, hole_number: 4, strokes: 6 }, { player_idx: 2, hole_number: 4, strokes: 5 },
      { player_idx: 1, hole_number: 5, strokes: 4 }, { player_idx: 2, hole_number: 5, strokes: 4 },
    ]
    const r = casualHoleResults(players, scores)
    expect(r.map(h => h.winner)).toEqual(['B', 'halved', 'halved', 'B', 'halved'])
    expect(r.map(h => h.running)).toEqual(['1 Up', '1 Up', '1 Up', '2 Up', '2 Up'])
    expect(r[3]).toMatchObject({ hole: 4, a: 6, b: 5, winner: 'B', diff: -2 })
  })

  it('skips holes only one player scored', () => {
    const scores = [
      { player_idx: 1, hole_number: 1, strokes: 4 }, { player_idx: 2, hole_number: 1, strokes: 5 },
      { player_idx: 1, hole_number: 2, strokes: 4 }, // nur Rainer
    ]
    const r = casualHoleResults(players, scores)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ hole: 1, winner: 'A', running: '1 Up' })
  })

  it('returns empty when not exactly two players', () => {
    expect(casualHoleResults([{ idx: 1 }], [])).toEqual([])
  })
})

describe('matchPlayHoleRun', () => {
  it('builds running standing from precomputed winners', () => {
    const holes = [
      { hole_number: 1, winner: 'A', strokes_a: '4', strokes_b: '5' },
      { hole_number: 2, winner: 'halved', strokes_a: '4', strokes_b: '4' },
      { hole_number: 3, winner: 'B', strokes_a: '6', strokes_b: '4' },
      { hole_number: 4, winner: 'B', strokes_a: '5', strokes_b: '4' },
      { hole_number: 5, winner: null, strokes_a: '', strokes_b: '' },
    ]
    const r = matchPlayHoleRun(holes)
    expect(r).toHaveLength(4)
    expect(r.map(h => h.running)).toEqual(['1 Up', '1 Up', 'AS', '1 Up'])
    expect(r[3]).toMatchObject({ hole: 4, a: 5, b: 4, winner: 'B', diff: -1 })
  })

  it('skips unplayed holes and handles empty input', () => {
    expect(matchPlayHoleRun([{ hole_number: 1, winner: null, strokes_a: '', strokes_b: '' }])).toEqual([])
    expect(matchPlayHoleRun([])).toEqual([])
  })
})

describe('calcTeamPoints', () => {
  it('counts wins as 1 point', () => {
    const matches = [{ winner: 'A', status: 'finished' }]
    expect(calcTeamPoints(matches)).toEqual({ A: 1, B: 0 })
  })

  it('counts halved as 0.5 each', () => {
    const matches = [{ winner: 'halved', status: 'finished' }]
    expect(calcTeamPoints(matches)).toEqual({ A: 0.5, B: 0.5 })
  })

  it('ignores unfinished matches', () => {
    const matches = [{ winner: null, status: 'active' }]
    expect(calcTeamPoints(matches)).toEqual({ A: 0, B: 0 })
  })

  it('applies team factors on finished matches', () => {
    const matches = [
      { winner: 'A', status: 'finished', team_a_factor: 0.75, team_b_factor: 1 },
      { winner: 'B', status: 'finished', team_a_factor: 0.75, team_b_factor: 1 },
    ]
    expect(calcTeamPoints(matches)).toEqual({ A: 0.75, B: 1 })
  })

  it('applies factors on halved matches', () => {
    const matches = [{ winner: 'halved', status: 'finished', team_a_factor: 0.5, team_b_factor: 1 }]
    expect(calcTeamPoints(matches)).toEqual({ A: 0.25, B: 0.5 })
  })
})

describe('suggestFactors', () => {
  it('returns 1.0 / 1.0 for equal team sizes', () => {
    expect(suggestFactors(4, 4)).toEqual({ team_a_factor: 1, team_b_factor: 1 })
    expect(suggestFactors(2, 2)).toEqual({ team_a_factor: 1, team_b_factor: 1 })
  })

  it('discounts the larger side', () => {
    expect(suggestFactors(4, 3)).toEqual({ team_a_factor: 0.75, team_b_factor: 1 })
    expect(suggestFactors(3, 4)).toEqual({ team_a_factor: 1, team_b_factor: 0.75 })
    expect(suggestFactors(4, 2)).toEqual({ team_a_factor: 0.5, team_b_factor: 1 })
  })

  it('clamps inputs to 1..4', () => {
    expect(suggestFactors(0, 5)).toEqual({ team_a_factor: 1, team_b_factor: 0.25 })
  })
})

describe('stablefordPoints', () => {
  it('scores eagle (>=2 under par) as 4', () => {
    expect(stablefordPoints(3, 5)).toBe(4)
    expect(stablefordPoints(2, 4)).toBe(4)
  })

  it('scores birdie as 3, par as 2, bogey as 1', () => {
    expect(stablefordPoints(3, 4)).toBe(3)
    expect(stablefordPoints(4, 4)).toBe(2)
    expect(stablefordPoints(5, 4)).toBe(1)
  })

  it('scores double bogey or worse as 0', () => {
    expect(stablefordPoints(6, 4)).toBe(0)
    expect(stablefordPoints(8, 4)).toBe(0)
  })

  it('rejects strokes < 1 and par < 3 as null', () => {
    expect(stablefordPoints(0, 4)).toBe(null)
    expect(stablefordPoints(4, 2)).toBe(null)
    expect(stablefordPoints('', 4)).toBe(null)
    expect(stablefordPoints(4, '')).toBe(null)
  })

  it('coerces numeric strings', () => {
    expect(stablefordPoints('4', '4')).toBe(2)
    expect(stablefordPoints('3', '4')).toBe(3)
  })
})

describe('calcStablefordTotals', () => {
  it('sums per-team points and ignores invalid holes', () => {
    const holes = [
      { strokes_a: 4, strokes_b: 3, par: 4 }, // A=2, B=3
      { strokes_a: 5, strokes_b: 6, par: 4 }, // A=1, B=0
      { strokes_a: '', strokes_b: 4, par: 4 }, // A=null(skip), B=2
    ]
    expect(calcStablefordTotals(holes)).toEqual({ a: 3, b: 5 })
  })

  it('handles empty/undefined input', () => {
    expect(calcStablefordTotals([])).toEqual({ a: 0, b: 0 })
    expect(calcStablefordTotals(undefined)).toEqual({ a: 0, b: 0 })
  })
})

describe('sumPars', () => {
  it('sums a standard 18-hole par array', () => {
    const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4]
    expect(sumPars(pars)).toBe(72)
  })

  it('treats missing/non-finite entries as 0', () => {
    expect(sumPars([4, null, 3, undefined, 5, NaN])).toBe(12)
  })

  it('counts a legit par of 0', () => {
    expect(sumPars([0, 0, 0])).toBe(0)
  })

  it('matches the two inlined variants it replaced', () => {
    const pars = [4, 0, 5, null, 3]
    const viaOr = pars.reduce((s, p) => s + (p || 0), 0)
    const viaFinite = pars.reduce((s, p) => s + (Number.isFinite(p) ? p : 0), 0)
    expect(sumPars(pars)).toBe(viaOr)
    expect(sumPars(pars)).toBe(viaFinite)
  })

  it('returns 0 for non-array / empty input', () => {
    expect(sumPars(null)).toBe(0)
    expect(sumPars(undefined)).toBe(0)
    expect(sumPars([])).toBe(0)
  })
})
