import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client before importing the module under test so the
// import-time `import { supabase }` binds to the mock. The tournaments query is
// `from('tournaments').select('*').order('date', { ascending: false })`, so the
// terminal awaited call is `.order(...)`.
const orderMock = vi.fn()
const selectMock = vi.fn(() => ({ order: orderMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))
vi.mock('./supabase', () => ({ supabase: { from: (...a) => fromMock(...a) } }))

import { fetchTournaments } from './tournaments'

describe('fetchTournaments', () => {
  beforeEach(() => {
    orderMock.mockReset()
    selectMock.mockClear()
    fromMock.mockClear()
  })

  it('queries the tournaments table, newest first by date', async () => {
    orderMock.mockResolvedValue({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    const list = await fetchTournaments()
    expect(list).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(fromMock).toHaveBeenCalledWith('tournaments')
    expect(selectMock).toHaveBeenCalledWith('*')
    expect(orderMock).toHaveBeenCalledWith('date', { ascending: false })
  })

  it('degrades to an empty array when the query returns no data', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await fetchTournaments()).toEqual([])
  })
})
