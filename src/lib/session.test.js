import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client before importing the module under test so the
// import-time `import { supabase }` binds to the mock.
const getSessionMock = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: (...a) => getSessionMock(...a) } },
}))

import { getAccessToken } from './session'

describe('getAccessToken', () => {
  beforeEach(() => {
    getSessionMock.mockReset()
  })

  it('returns the access token when a session exists', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'jwt-123' } }, error: null })
    expect(await getAccessToken()).toBe('jwt-123')
  })

  it('returns undefined when there is no active session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null })
    expect(await getAccessToken()).toBeUndefined()
  })

  it('returns undefined when getSession yields empty data', async () => {
    getSessionMock.mockResolvedValue({ data: {} })
    expect(await getAccessToken()).toBeUndefined()
  })
})
