import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client before importing the module under test so the
// import-time `import { supabase }` binds to the mock.
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

  it('queries the tournaments table ordered by date descending', async () => {
    orderMock.mockResolvedValue({ data: [{ id: 't1' }], error: null })
    const rows = await fetchTournaments()
    expect(rows).toEqual([{ id: 't1' }])
    expect(fromMock).toHaveBeenCalledWith('tournaments')
    expect(selectMock).toHaveBeenCalledWith('*')
    expect(orderMock).toHaveBeenCalledWith('date', { ascending: false })
  })

  it('degrades to an empty array when the query returns no data', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await fetchTournaments()).toEqual([])
  })
})
