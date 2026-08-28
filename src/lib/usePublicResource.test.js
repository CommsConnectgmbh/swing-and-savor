import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePublicResource } from './usePublicResource'

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: () => Promise.resolve(body) }
}

describe('lib/usePublicResource', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('starts in a loading state', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { result } = renderHook(() => usePublicResource('public-cup', { invite: 'abc' }))
    expect(result.current).toEqual({ data: null, loading: true, error: null })
  })

  it('requests the edge function with query params and the anon-key header', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ cup: { name: 'Ryder' } })))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => usePublicResource('public-cup', { invite: 'a b/c' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://proj.supabase.co/functions/v1/public-cup?invite=a%20b%2Fc')
    expect(opts.headers).toEqual({ apikey: 'anon-key-123' })
    expect(result.current.data).toEqual({ cup: { name: 'Ryder' } })
    expect(result.current.error).toBeNull()
  })

  it('drops nullish and empty params from the query string', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({})))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() =>
      usePublicResource('public-hall', { handle: 'ace', extra: undefined, blank: '' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchMock.mock.calls[0][0])
      .toBe('https://proj.supabase.co/functions/v1/public-hall?handle=ace')
  })

  it('surfaces the server error field on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(jsonResponse({ error: 'not_found' }, { ok: false, status: 404 }))))

    const { result } = renderHook(() => usePublicResource('public-cup', { invite: 'x' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('not_found')
    expect(result.current.data).toBeNull()
  })

  it('falls back to a generic error string when the body has no error field', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(jsonResponse({}, { ok: false, status: 500 }))))

    const { result } = renderHook(() => usePublicResource('public-cup', { invite: 'x' }))
    await waitFor(() => expect(result.current.error).toBe('error'))
  })

  it('reports network failures as a stringified error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))

    const { result } = renderHook(() => usePublicResource('public-cup', { invite: 'x' }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Error: offline')
  })

  it('runs onLoad once with the parsed body after a successful load', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse({ cup: { name: 'Ace' } }))))
    const onLoad = vi.fn()

    const { result } = renderHook(() =>
      usePublicResource('public-cup', { invite: 'x' }, { onLoad }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onLoad).toHaveBeenCalledWith({ cup: { name: 'Ace' } })
  })

  it('does not run onLoad on an error response', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(jsonResponse({ error: 'nope' }, { ok: false, status: 400 }))))
    const onLoad = vi.fn()

    const { result } = renderHook(() =>
      usePublicResource('public-cup', { invite: 'x' }, { onLoad }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(onLoad).not.toHaveBeenCalled()
  })

  it('ignores a resolved response after the params change (cancellation)', async () => {
    let resolveFirst
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((res) => { resolveFirst = () => res(jsonResponse({ tag: 'first' })) }))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ tag: 'second' })))
    vi.stubGlobal('fetch', fetchMock)

    const { result, rerender } = renderHook(
      ({ code }) => usePublicResource('public-cup', { invite: code }),
      { initialProps: { code: 'one' } },
    )

    rerender({ code: 'two' })
    await waitFor(() => expect(result.current.data).toEqual({ tag: 'second' }))

    // The superseded first request resolves late and must be ignored.
    resolveFirst()
    await Promise.resolve()
    expect(result.current.data).toEqual({ tag: 'second' })
  })
})
