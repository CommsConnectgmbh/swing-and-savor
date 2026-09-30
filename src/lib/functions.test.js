import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// functions.js imports supabase (for getAccessToken). Mock it so the real
// createClient never runs and we can drive getSession() from the tests.
const getSessionMock = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: (...a) => getSessionMock(...a) } },
}))

import {
  functionUrl,
  publicFunctionHeaders,
  authFunctionHeaders,
  getAccessToken,
  callFunction,
  callPublicFunction,
} from './functions'

describe('lib/functions', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    getSessionMock.mockReset()
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
    it('returns the session access token when signed in', async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: 'jwt-xyz' } } })
      expect(await getAccessToken()).toBe('jwt-xyz')
    })

    it('returns null when there is no session', async () => {
      getSessionMock.mockResolvedValue({ data: { session: null } })
      expect(await getAccessToken()).toBeNull()
    })
  })

  describe('callFunction', () => {
    it('POSTs a JSON body with auth + content-type headers and parses the response', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ checkout_url: 'https://pay/x' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { res, data } = await callFunction('create-boost-checkout', {
        token: 'jwt-abc',
        body: { tier: 'gold' },
      })

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
          signal: undefined,
        },
      )
      expect(res.ok).toBe(true)
      expect(data).toEqual({ checkout_url: 'https://pay/x' })
    })

    it('omits Content-Type/body when no body is given', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
      vi.stubGlobal('fetch', fetchMock)

      await callFunction('delete-account', { token: 'jwt-abc' })

      const [, init] = fetchMock.mock.calls[0]
      expect(init.headers).toEqual({ apikey: 'anon-key-123', Authorization: 'Bearer jwt-abc' })
      expect(init.body).toBeUndefined()
    })

    it('returns an empty object when the body is not JSON', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error('not json')),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { res, data } = await callFunction('widerruf', { token: 'jwt-abc', body: {} })
      expect(res.ok).toBe(false)
      expect(data).toEqual({})
    })
  })

  describe('callPublicFunction', () => {
    it('GETs with a query string and only the anon key', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cup: { name: 'Spring Cup' } }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { data } = await callPublicFunction('public-cup', { query: { invite: 'AB CD' } })

      expect(fetchMock).toHaveBeenCalledWith(
        'https://proj.supabase.co/functions/v1/public-cup?invite=AB+CD',
        { method: 'GET', headers: { apikey: 'anon-key-123' }, signal: undefined },
      )
      expect(data.cup.name).toBe('Spring Cup')
    })
  })
})
