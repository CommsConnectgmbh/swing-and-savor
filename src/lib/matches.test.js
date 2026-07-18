import { describe, it, expect } from 'vitest'
import { teamPlayerIds, matchTypeLabel, matchTypeFormatLabel } from './matches'

describe('teamPlayerIds', () => {
  it('prefers the modern player-ids array', () => {
    const m = { team_a_player_ids: ['x', 'y'], team_a_player1_id: 'legacy' }
    expect(teamPlayerIds(m, 'a')).toEqual(['x', 'y'])
  })

  it('falls back to the legacy player1/player2 columns', () => {
    const m = { team_b_player1_id: 'p1', team_b_player2_id: 'p2' }
    expect(teamPlayerIds(m, 'b')).toEqual(['p1', 'p2'])
  })

  it('drops falsy legacy ids (singles has only player1)', () => {
    const m = { team_a_player1_id: 'p1', team_a_player2_id: null }
    expect(teamPlayerIds(m, 'a')).toEqual(['p1'])
  })

  it('drops falsy ids inside the array too', () => {
    const m = { team_a_player_ids: ['p1', null, 'p3'] }
    expect(teamPlayerIds(m, 'a')).toEqual(['p1', 'p3'])
  })

  it('treats an empty array as "not present" and falls back', () => {
    const m = { team_a_player_ids: [], team_a_player1_id: 'p1' }
    expect(teamPlayerIds(m, 'a')).toEqual(['p1'])
  })

  it('returns an empty array for a missing match', () => {
    expect(teamPlayerIds(null, 'a')).toEqual([])
    expect(teamPlayerIds(undefined, 'b')).toEqual([])
  })
})

describe('matchTypeLabel', () => {
  it('labels singles and doubles', () => {
    expect(matchTypeLabel({ type: 'singles' }, 1, 1)).toBe('Singles')
    expect(matchTypeLabel({ type: 'doubles' }, 2, 2)).toBe('Doubles')
  })

  it('labels a flight with the roster counts', () => {
    expect(matchTypeLabel({ type: 'flight' }, 3, 2)).toBe('Flight 3v2')
  })

  it('treats an unknown/missing type as a flight', () => {
    expect(matchTypeLabel({}, 0, 0)).toBe('Flight 0v0')
    expect(matchTypeLabel(null, 1, 4)).toBe('Flight 1v4')
  })
})

describe('matchTypeFormatLabel', () => {
  it('appends the Stableford suffix only for stableford matches', () => {
    expect(matchTypeFormatLabel({ type: 'singles', format: 'stableford' }, 1, 1))
      .toBe('Singles · Stableford')
    expect(matchTypeFormatLabel({ type: 'flight', format: 'stableford' }, 3, 2))
      .toBe('Flight 3v2 · Stableford')
  })

  it('leaves the bare label for non-stableford matches', () => {
    expect(matchTypeFormatLabel({ type: 'singles', format: 'matchplay' }, 1, 1))
      .toBe('Singles')
    expect(matchTypeFormatLabel({ type: 'doubles' }, 2, 2)).toBe('Doubles')
  })
})
