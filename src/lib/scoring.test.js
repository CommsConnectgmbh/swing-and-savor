import { describe, it, expect } from 'vitest'
import { calcMatchStanding, calcTeamPoints } from './scoring'

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
})
