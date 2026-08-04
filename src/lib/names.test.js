import { describe, it, expect } from 'vitest'
import { initials, profileInitial, monogram } from './names'

describe('initials', () => {
  it('takes the first letter of up to two words', () => {
    expect(initials('Ada Lovelace')).toBe('AL')
  })

  it('uses a single letter for one-word names', () => {
    expect(initials('Madonna')).toBe('M')
  })

  it('ignores words beyond the second', () => {
    expect(initials('Jean Claude Van Damme')).toBe('JC')
  })

  it('collapses extra whitespace', () => {
    expect(initials('  ada   lovelace  ')).toBe('AL')
  })

  it('upper-cases the letters', () => {
    expect(initials('ada lovelace')).toBe('AL')
  })

  it('falls back to ? for empty / missing names', () => {
    // An empty/missing name resolves to the literal '?' placeholder first.
    expect(initials('')).toBe('?')
    expect(initials(null)).toBe('?')
    expect(initials(undefined)).toBe('?')
  })

  it('falls back to a middle dot for whitespace-only names', () => {
    expect(initials('   ')).toBe('·')
  })
})

describe('profileInitial', () => {
  it('uses the display name first letter', () => {
    expect(profileInitial({ display_name: 'Ada', handle: 'lovelace' })).toBe('A')
  })

  it('falls back to the handle when there is no display name', () => {
    expect(profileInitial({ handle: 'lovelace' })).toBe('L')
  })

  it('returns ? when nothing is available', () => {
    expect(profileInitial({})).toBe('?')
    expect(profileInitial(null)).toBe('?')
    expect(profileInitial(undefined)).toBe('?')
  })

  it('upper-cases the letter', () => {
    expect(profileInitial({ display_name: 'ada' })).toBe('A')
  })

  it('ignores an empty-string display name', () => {
    expect(profileInitial({ display_name: '', handle: 'bob' })).toBe('B')
  })
})

describe('monogram', () => {
  it('takes the first two characters, upper-cased', () => {
    expect(monogram('Ada')).toBe('AD')
    expect(monogram('bob lee')).toBe('BO')
  })

  it('returns the whole (upper-cased) string when shorter than two chars', () => {
    expect(monogram('A')).toBe('A')
  })

  it('is a character slice, not word initials', () => {
    // Distinct from `initials()` which would return "AL" here.
    expect(monogram('Ada Lovelace')).toBe('AD')
  })

  it('returns an empty string for empty / missing names', () => {
    expect(monogram('')).toBe('')
    expect(monogram(null)).toBe('')
    expect(monogram(undefined)).toBe('')
  })
})
