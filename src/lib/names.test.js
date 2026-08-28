import { describe, it, expect } from 'vitest'
import { initials, nameInitial, profileInitial } from './names'

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

describe('nameInitial', () => {
  it('takes the upper-cased first letter of a name', () => {
    expect(nameInitial('Ada')).toBe('A')
    expect(nameInitial('ada lovelace')).toBe('A')
  })

  it('falls back to ? for empty / missing input', () => {
    expect(nameInitial('')).toBe('?')
    expect(nameInitial(null)).toBe('?')
    expect(nameInitial(undefined)).toBe('?')
  })

  // The five migrated call sites used two interchangeable spellings — the new
  // `?? '?'` form and the older `|| '?'` form — plus the guard-before-index
  // shape in CupExtrasSheet. For real name strings all three collapse to the
  // same character, which is what makes the migration behaviour-preserving.
  it('matches the `?? "?"` spelling it replaces', () => {
    for (const s of ['Ada', 'x', '', null, undefined]) {
      expect(nameInitial(s)).toBe(s?.[0]?.toUpperCase() ?? '?')
    }
  })

  it('matches the `|| "?"` spelling it replaces', () => {
    for (const s of ['Ada', 'x', '', null, undefined]) {
      expect(nameInitial(s)).toBe(s?.[0]?.toUpperCase() || '?')
    }
  })

  it('matches the `(x || "?")[0]` guard-first spelling it replaces', () => {
    for (const s of ['Ada', 'x', '', null, undefined]) {
      expect(nameInitial(s)).toBe((s || '?')[0]?.toUpperCase())
    }
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
