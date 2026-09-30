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

  it('returns the access token from the active session', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'jwt-123' } },
    })
    expect(await getAccessToken()).toBe('jwt-123')
  })

  it('returns undefined when there is no active session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    expect(await getAccessToken()).toBeUndefined()
  })

  it('returns undefined when data has no session key', async () => {
    getSessionMock.mockResolvedValue({ data: {} })
    expect(await getAccessToken()).toBeUndefined()
  })

  it('reads a fresh session on every call', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 't' } },
    })
    await getAccessToken()
    await getAccessToken()
    expect(getSessionMock).toHaveBeenCalledTimes(2)
  })
})
