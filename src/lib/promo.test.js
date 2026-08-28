import { describe, it, expect, vi, afterEach } from 'vitest'
import { isPromoActive, promoState } from './promo'

const NOW = new Date('2026-06-14T12:00:00Z').getTime()
const FUTURE = '2026-06-20T12:00:00Z'
const PAST = '2026-06-01T12:00:00Z'

describe('isPromoActive', () => {
  afterEach(() => vi.useRealTimers())

  it('is false when there is no promoted_until', () => {
    expect(isPromoActive(null, NOW)).toBe(false)
    expect(isPromoActive(undefined, NOW)).toBe(false)
    expect(isPromoActive({}, NOW)).toBe(false)
    expect(isPromoActive({ promoted_until: null }, NOW)).toBe(false)
  })

  it('is true only while promoted_until is in the future', () => {
    expect(isPromoActive({ promoted_until: FUTURE }, NOW)).toBe(true)
    expect(isPromoActive({ promoted_until: PAST }, NOW)).toBe(false)
  })

  it('treats the exact boundary as expired (strictly greater)', () => {
    expect(isPromoActive({ promoted_until: '2026-06-14T12:00:00Z' }, NOW)).toBe(false)
  })

  it('defaults now to the current time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    expect(isPromoActive({ promoted_until: FUTURE })).toBe(true)
    expect(isPromoActive({ promoted_until: PAST })).toBe(false)
  })
})

describe('promoState', () => {
  it('is fully inactive when the promotion has lapsed', () => {
    expect(promoState({ promoted_until: PAST, promo_tier: 'both' }, NOW)).toEqual({
      active: false, isTop: false, isHighlight: false,
    })
  })

  it("'top' tier pins to the top but does not highlight", () => {
    expect(promoState({ promoted_until: FUTURE, promo_tier: 'top' }, NOW)).toEqual({
      active: true, isTop: true, isHighlight: false,
    })
  })

  it("'highlight' tier highlights but does not pin", () => {
    expect(promoState({ promoted_until: FUTURE, promo_tier: 'highlight' }, NOW)).toEqual({
      active: true, isTop: false, isHighlight: true,
    })
  })

  it("'both' tier pins and highlights", () => {
    expect(promoState({ promoted_until: FUTURE, promo_tier: 'both' }, NOW)).toEqual({
      active: true, isTop: true, isHighlight: true,
    })
  })

  it('an unknown/missing tier is active but unlocks no slots', () => {
    expect(promoState({ promoted_until: FUTURE }, NOW)).toEqual({
      active: true, isTop: false, isHighlight: false,
    })
  })
})
