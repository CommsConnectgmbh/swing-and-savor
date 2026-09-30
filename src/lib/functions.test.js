import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { functionUrl, publicFunctionHeaders, authFunctionHeaders, postFunction } from './functions'

describe('lib/functions', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123')
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

  describe('postFunction', () => {
    let fetchMock
    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
    })
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('POSTs to the edge function with the auth headers, JSON content-type and stringified body', async () => {
      await postFunction('create-boost-checkout', {
        token: 'jwt-abc',
        body: { tournament_id: 't1', tier: 'gold' },
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://proj.supabase.co/functions/v1/create-boost-checkout')
      expect(init).toEqual({
        method: 'POST',
        headers: {
          apikey: 'anon-key-123',
          Authorization: 'Bearer jwt-abc',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tournament_id: 't1', tier: 'gold' }),
      })
    })

    it('omits the request body for a bodyless POST but keeps the JSON content-type', async () => {
      await postFunction('delete-account', { token: 'jwt-abc' })
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://proj.supabase.co/functions/v1/delete-account')
      expect('body' in init).toBe(false)
      expect(init.headers['Content-Type']).toBe('application/json')
      expect(init.method).toBe('POST')
    })

    it('passes an undefined token straight through (Bearer undefined), matching the previous inline shape', async () => {
      await postFunction('scorecard-ocr', { body: { upload_id: 'u1' } })
      const [, init] = fetchMock.mock.calls[0]
      expect(init.headers.Authorization).toBe('Bearer undefined')
      expect(init.body).toBe(JSON.stringify({ upload_id: 'u1' }))
    })

    it('returns the fetch Response promise unparsed', async () => {
      const response = { ok: true, json: () => ({}) }
      fetchMock.mockResolvedValueOnce(response)
      await expect(postFunction('widerruf', { token: 't', body: {} })).resolves.toBe(response)
    })

    it('tolerates being called with no options object', async () => {
      await postFunction('claim-referral')
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://proj.supabase.co/functions/v1/claim-referral')
      expect('body' in init).toBe(false)
      expect(init.headers.Authorization).toBe('Bearer undefined')
    })
  })
})
