import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePublicFunctionData } from './usePublicFunctionData'

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: () => Promise.resolve(body) }
}

describe('usePublicFunctionData', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123')
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts in the loading state', () => {
    fetch.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() => usePublicFunctionData('https://x/fn'))
    expect(result.current).toEqual({ data: null, loading: true, err: null })
  })

  it('sends the anon-key public headers to the given url', async () => {
    fetch.mockResolvedValue(jsonResponse({ ok: true }))
    renderHook(() => usePublicFunctionData('https://x/fn?slug=abc'))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith('https://x/fn?slug=abc', {
      headers: { apikey: 'anon-key-123' },
    })
  })

  it('exposes the parsed json as data and clears loading on success', async () => {
    fetch.mockResolvedValue(jsonResponse({ cup: { name: 'Ryder' } }))
    const { result } = renderHook(() => usePublicFunctionData('https://x/fn'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ cup: { name: 'Ryder' } })
    expect(result.current.err).toBe(null)
  })

  it('runs onSuccess with the parsed json after a successful response', async () => {
    const onSuccess = vi.fn()
    fetch.mockResolvedValue(jsonResponse({ season: { name: 'Summer' } }))
    const { result } = renderHook(() =>
      usePublicFunctionData('https://x/fn', onSuccess))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(onSuccess).toHaveBeenCalledWith({ season: { name: 'Summer' } })
  })

  it('surfaces the server error message on a non-2xx response', async () => {
    fetch.mockResolvedValue(jsonResponse({ error: 'not_found' }, { ok: false, status: 404 }))
    const onSuccess = vi.fn()
    const { result } = renderHook(() =>
      usePublicFunctionData('https://x/fn', onSuccess))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.err).toBe('not_found')
    expect(result.current.data).toBe(null)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('falls back to a generic error when the body has no error field', async () => {
    fetch.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }))
    const { result } = renderHook(() => usePublicFunctionData('https://x/fn'))
    await waitFor(() => expect(result.current.err).toBe('error'))
  })

  it('surfaces network/fetch rejections as a string error', async () => {
    fetch.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => usePublicFunctionData('https://x/fn'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.err).toBe('Error: offline')
  })

  it('does not fetch when the url is falsy', () => {
    renderHook(() => usePublicFunctionData(''))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refetches when the url changes', async () => {
    fetch.mockResolvedValue(jsonResponse({ ok: true }))
    const { rerender } = renderHook(({ url }) => usePublicFunctionData(url), {
      initialProps: { url: 'https://x/fn?a=1' },
    })
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    rerender({ url: 'https://x/fn?a=2' })
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith('https://x/fn?a=2', expect.anything())
  })

  it('does not refetch when only onSuccess identity changes', async () => {
    fetch.mockResolvedValue(jsonResponse({ ok: true }))
    const { rerender } = renderHook(({ cb }) => usePublicFunctionData('https://x/fn', cb), {
      initialProps: { cb: () => {} },
    })
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    rerender({ cb: () => {} }) // fresh inline function, same url
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ignores a late response after unmount (no onSuccess, no throw)', async () => {
    let resolveFetch
    fetch.mockReturnValue(new Promise((res) => { resolveFetch = res }))
    const onSuccess = vi.fn()
    const { unmount } = renderHook(() =>
      usePublicFunctionData('https://x/fn', onSuccess))
    unmount()
    resolveFetch(jsonResponse({ cup: { name: 'Late' } }))
    await Promise.resolve()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
