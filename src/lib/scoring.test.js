import { describe, it, expect } from 'vitest'
import { calcMatchStanding, calcTeamPoints, suggestFactors, stablefordPoints, calcStablefordTotals } from './scoring'

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
