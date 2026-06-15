import { describe, it, expect } from 'vitest'
import { formatOfferPrice } from './savor'

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
