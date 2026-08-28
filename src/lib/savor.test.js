import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatOfferPrice, savorFetch, SAVOR_FUNCTIONS_URL } from './savor'

describe('formatOfferPrice', () => {
  it('returns empty string for a missing offer', () => {
    expect(formatOfferPrice(null)).toBe('')
    expect(formatOfferPrice(undefined)).toBe('')
  })

  it('prefers an explicit price_label', () => {
    expect(formatOfferPrice({ price_label: 'ab 79 €', price_eur_cents: 12000 })).toBe('ab 79 €')
  })

  it('formats cents as whole-euro de-DE amounts', () => {
    expect(formatOfferPrice({ price_eur_cents: 7900 })).toBe('79 €')
    // de-DE thousands separator is a dot.
    expect(formatOfferPrice({ price_eur_cents: 120000 })).toBe('1.200 €')
  })

  it('keeps fractional cents with a de-DE decimal comma', () => {
    expect(formatOfferPrice({ price_eur_cents: 7950 })).toBe('79,5 €')
  })

  it('falls back to "Auf Anfrage" when no price is set', () => {
    expect(formatOfferPrice({})).toBe('Auf Anfrage')
    expect(formatOfferPrice({ price_eur_cents: 0 })).toBe('Auf Anfrage')
  })
})

describe('savorFetch', () => {
  let fetchMock

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123')
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('hits the public-savor endpoint with the anon-key header', async () => {
    await savorFetch({ mode: 'home' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe(`${SAVOR_FUNCTIONS_URL}?mode=home`)
    expect(opts).toEqual({ headers: { apikey: 'anon-key-123' } })
  })

  it('encodes an object of params into the query string in order', async () => {
    await savorFetch({ mode: 'category', category: 'tee_times', city: 'Wien' })
    expect(fetchMock.mock.calls[0][0])
      .toBe(`${SAVOR_FUNCTIONS_URL}?mode=category&category=tee_times&city=Wien`)
  })

  it('omits params that were not supplied (no empty city)', async () => {
    await savorFetch({ mode: 'category', category: 'dining' })
    expect(fetchMock.mock.calls[0][0])
      .toBe(`${SAVOR_FUNCTIONS_URL}?mode=category&category=dining`)
  })

  it('percent-encodes offer slugs', async () => {
    await savorFetch({ mode: 'offer', slug: 'a b&c' })
    expect(fetchMock.mock.calls[0][0])
      .toBe(`${SAVOR_FUNCTIONS_URL}?mode=offer&slug=a+b%26c`)
  })

  it('returns the underlying fetch promise', async () => {
    const res = await savorFetch({ mode: 'home' })
    expect(res).toEqual({ ok: true })
  })
})
