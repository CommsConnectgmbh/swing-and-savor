import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  functionUrl,
  publicFunctionHeaders,
  authFunctionHeaders,
  fetchPublicFunction,
} from './functions'

describe('lib/functions', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
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

  describe('fetchPublicFunction', () => {
    it('builds the URL with encoded query params and the public headers', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ cup: { name: 'Open' } }),
      })

      const result = await fetchPublicFunction('public-cup', { invite: 'a b/c' })

      expect(fetchMock).toHaveBeenCalledWith(
        'https://proj.supabase.co/functions/v1/public-cup?invite=a%20b%2Fc',
        { headers: { apikey: 'anon-key-123' } },
      )
      expect(result).toEqual({ ok: true, status: 200, body: { cup: { name: 'Open' } } })
    })

    it('omits the query string entirely when no params are given', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true, status: 200, json: async () => ({}),
      })

      await fetchPublicFunction('public-hall')

      expect(fetchMock).toHaveBeenCalledWith(
        'https://proj.supabase.co/functions/v1/public-hall',
        { headers: { apikey: 'anon-key-123' } },
      )
    })

    it('returns ok=false with the parsed body on a non-2xx response (does not throw)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false, status: 404, json: async () => ({ error: 'not_found' }),
      })

      const result = await fetchPublicFunction('public-season', { slug: 'x' })

      expect(result).toEqual({ ok: false, status: 404, body: { error: 'not_found' } })
    })

    it('falls back to an empty body when the response is not valid JSON', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token') },
      })

      const result = await fetchPublicFunction('public-crew', { slug: 'x' })

      expect(result).toEqual({ ok: true, status: 200, body: {} })
    })

    it('rejects on a network-level failure so callers keep their .catch path', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(fetchPublicFunction('public-recap', { invite: 'x' }))
        .rejects.toThrow('Failed to fetch')
    })
  })
})
