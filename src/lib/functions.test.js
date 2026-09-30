import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { functionUrl, publicFunctionHeaders, authFunctionHeaders, readPublicJson } from './functions'

/** Minimal Response stand-in: only the bits readPublicJson touches. */
function fakeResponse({ ok = true, body } = {}) {
  return {
    ok,
    json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)),
  }
}

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
})

describe('readPublicJson', () => {
  it('returns ok with the parsed body for a 2xx response', async () => {
    const r = fakeResponse({ ok: true, body: { cup: { name: 'Spring Cup' } } })
    expect(await readPublicJson(r)).toEqual({
      ok: true,
      error: null,
      data: { cup: { name: 'Spring Cup' } },
    })
  })

  it('surfaces the body error field for a non-2xx response', async () => {
    const r = fakeResponse({ ok: false, body: { error: 'not_found' } })
    expect(await readPublicJson(r)).toEqual({
      ok: false,
      error: 'not_found',
      data: { error: 'not_found' },
    })
  })

  it('falls back to the string "error" when the failed body has no error field', async () => {
    const r = fakeResponse({ ok: false, body: {} })
    const { ok, error } = await readPublicJson(r)
    expect(ok).toBe(false)
    expect(error).toBe('error')
  })

  it('treats a non-JSON body as an empty object instead of throwing', async () => {
    const r = fakeResponse({ ok: true, body: new Error('Unexpected token < in JSON') })
    expect(await readPublicJson(r)).toEqual({ ok: true, error: null, data: {} })
  })

  it('a non-JSON body on a failed response yields the generic error', async () => {
    const r = fakeResponse({ ok: false, body: new Error('bad gateway html') })
    expect(await readPublicJson(r)).toEqual({ ok: false, error: 'error', data: {} })
  })
})
