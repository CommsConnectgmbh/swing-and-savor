import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the supabase client before importing the module under test so the
// import-time `import { supabase }` binds to the mock (the real client throws
// at construction without env-provided project credentials).
const getSessionMock = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: (...a) => getSessionMock(...a) } },
}))

import {
  functionUrl,
  publicFunctionHeaders,
  authFunctionHeaders,
  getAccessToken,
  postAuthedFunction,
} from './functions'

describe('lib/functions', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123')
    getSessionMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds the edge-function base URL from the project URL', () => {
    expect(functionUrl('public-cup'))
      .toBe('https://proj.supabase.co/functions/v1/public-cup')
    expect(functionUrl('create-premium-checkout'))
      .toBe('https://proj.supabase.co/functions/v1/create-premium-checkout')
  })

  it('exposes only the anon key for public requests', () => {
    expect(publicFunctionHeaders()).toEqual({ apikey: 'anon-key-123' })
  })

  it('adds a bearer token alongside the anon key for authenticated requests', () => {
    expect(authFunctionHeaders('jwt-abc')).toEqual({
      apikey: 'anon-key-123',
      Authorization: 'Bearer jwt-abc',
    })
  })

  it('lets callers spread extra headers without losing the auth pair', () => {
    const headers = { ...authFunctionHeaders('jwt-abc'), 'Content-Type': 'application/json' }
    expect(headers).toEqual({
      apikey: 'anon-key-123',
      Authorization: 'Bearer jwt-abc',
      'Content-Type': 'application/json',
    })
  })

  describe('getAccessToken', () => {
    it('returns the access token from the active session', async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: 'jwt-xyz' } } })
      await expect(getAccessToken()).resolves.toBe('jwt-xyz')
    })

    it('returns null when there is no active session', async () => {
      getSessionMock.mockResolvedValue({ data: { session: null } })
      await expect(getAccessToken()).resolves.toBeNull()
    })
  })

  describe('postAuthedFunction', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('POSTs a JSON body to the named function with auth + JSON headers', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await postAuthedFunction('create-boost-checkout', 'jwt-abc', { tier: 'gold' })

      expect(fetchMock).toHaveBeenCalledWith(
        'https://proj.supabase.co/functions/v1/create-boost-checkout',
        {
          method: 'POST',
          headers: {
            apikey: 'anon-key-123',
            Authorization: 'Bearer jwt-abc',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tier: 'gold' }),
        },
      )
    })

    it('omits the body for functions that take no payload', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await postAuthedFunction('delete-account', 'jwt-abc')

      expect(fetchMock).toHaveBeenCalledWith(
        'https://proj.supabase.co/functions/v1/delete-account',
        expect.objectContaining({ method: 'POST', body: undefined }),
      )
    })

    it('returns the raw Response for the caller to parse', async () => {
      const response = { ok: false, status: 402 }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

      await expect(postAuthedFunction('widerruf', 'jwt-abc', {})).resolves.toBe(response)
    })
  })
})
