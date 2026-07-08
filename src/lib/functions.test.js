import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  functionUrl,
  publicFunctionHeaders,
  authFunctionHeaders,
  getPublicFunction,
} from './functions'

describe('lib/functions', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
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

  describe('getPublicFunction', () => {
    it('GETs the base function URL with anon-key headers when no params are given', () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      getPublicFunction('public-hall')

      expect(fetchMock).toHaveBeenCalledWith(
        'https://proj.supabase.co/functions/v1/public-hall',
        { headers: { apikey: 'anon-key-123' } },
      )
    })

    it('appends a single query param, URL-encoding the value', () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      getPublicFunction('public-cup', { invite: 'a b&c' })

      expect(fetchMock).toHaveBeenCalledWith(
        'https://proj.supabase.co/functions/v1/public-cup?invite=a%20b%26c',
        { headers: { apikey: 'anon-key-123' } },
      )
    })

    it('matches the hand-written call site it replaces byte-for-byte', () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      const inviteCode = 'SUMMER25'

      getPublicFunction('public-recap', { invite: inviteCode })

      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toBe(
        `${functionUrl('public-recap')}?invite=${encodeURIComponent(inviteCode)}`,
      )
      expect(opts).toEqual({ headers: publicFunctionHeaders() })
    })

    it('serialises multiple params in insertion order joined by &', () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      getPublicFunction('public-savor', { mode: 'category', category: 'food & drink' })

      expect(fetchMock).toHaveBeenCalledWith(
        'https://proj.supabase.co/functions/v1/public-savor?mode=category&category=food%20%26%20drink',
        { headers: { apikey: 'anon-key-123' } },
      )
    })

    it('returns the fetch Response promise untouched', async () => {
      const response = { ok: true, json: async () => ({ cup: {} }) }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

      await expect(getPublicFunction('public-cup', { invite: 'x' })).resolves.toBe(response)
    })
  })
})
