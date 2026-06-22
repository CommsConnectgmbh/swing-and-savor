import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { functionUrl, publicFunctionHeaders, authFunctionHeaders } from './functions'

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
