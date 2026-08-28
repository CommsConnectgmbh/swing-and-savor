import { describe, it, expect, vi, beforeEach } from 'vitest'

// The real client is never created in tests: stub createClient so we control
// what supabase.auth.getSession() resolves to.
let getSessionResult = { data: { session: null } }
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getSession: () => Promise.resolve(getSessionResult) },
  }),
}))

const { getAccessToken } = await import('./supabase')

describe('getAccessToken', () => {
  beforeEach(() => {
    getSessionResult = { data: { session: null } }
  })

  it('returns the access token when a session is active', async () => {
    getSessionResult = { data: { session: { access_token: 'jwt-xyz' } } }
    expect(await getAccessToken()).toBe('jwt-xyz')
  })

  it('returns null when there is no session', async () => {
    getSessionResult = { data: { session: null } }
    expect(await getAccessToken()).toBeNull()
  })

  it('returns null when getSession yields no data', async () => {
    getSessionResult = { data: null }
    expect(await getAccessToken()).toBeNull()
  })
})
