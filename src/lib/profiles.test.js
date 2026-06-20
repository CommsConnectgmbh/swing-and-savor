import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client before importing the module under test so the
// import-time `import { supabase }` binds to the mock.
const inMock = vi.fn()
const selectMock = vi.fn(() => ({ in: inMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))
vi.mock('./supabase', () => ({ supabase: { from: (...a) => fromMock(...a) } }))

import { indexById, fetchProfileMap, fetchProfileList, PROFILE_CARD_COLUMNS } from './profiles'

describe('indexById', () => {
  it('keys rows by id', () => {
    const rows = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }]
    expect(indexById(rows)).toEqual({ a: { id: 'a', n: 1 }, b: { id: 'b', n: 2 } })
  })

  it('returns an empty object for null/undefined', () => {
    expect(indexById(null)).toEqual({})
    expect(indexById(undefined)).toEqual({})
  })

  it('last write wins on duplicate keys', () => {
    const rows = [{ id: 'a', n: 1 }, { id: 'a', n: 2 }]
    expect(indexById(rows)).toEqual({ a: { id: 'a', n: 2 } })
  })
})

describe('fetchProfileMap', () => {
  beforeEach(() => {
    inMock.mockReset()
    selectMock.mockClear()
    fromMock.mockClear()
  })

  it('short-circuits on empty/falsy ids without hitting the network', async () => {
    expect(await fetchProfileMap([])).toEqual({})
    expect(await fetchProfileMap(null)).toEqual({})
    expect(await fetchProfileMap([null, undefined, ''])).toEqual({})
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('de-dupes ids and returns a map keyed by id', async () => {
    inMock.mockResolvedValue({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    const map = await fetchProfileMap(['a', 'b', 'a'])
    expect(map).toEqual({ a: { id: 'a' }, b: { id: 'b' } })
    expect(inMock).toHaveBeenCalledWith('id', ['a', 'b'])
    expect(selectMock).toHaveBeenCalledWith(PROFILE_CARD_COLUMNS)
  })

  it('honours a custom column projection', async () => {
    inMock.mockResolvedValue({ data: [], error: null })
    await fetchProfileMap(['a'], 'id, handle, hcp')
    expect(selectMock).toHaveBeenCalledWith('id, handle, hcp')
  })

  it('degrades to an empty map when the query returns no data', async () => {
    inMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await fetchProfileMap(['a'])).toEqual({})
  })
})

describe('fetchProfileList', () => {
  beforeEach(() => {
    inMock.mockReset()
    selectMock.mockClear()
    fromMock.mockClear()
  })

  it('returns a flat array of rows', async () => {
    inMock.mockResolvedValue({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    expect(await fetchProfileList(['a', 'b'])).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('returns an empty array for no ids', async () => {
    expect(await fetchProfileList([])).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })
})
