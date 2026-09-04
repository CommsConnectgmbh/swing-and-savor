import { describe, it, expect } from 'vitest'
import { SITE_ORIGIN, APP_ORIGIN, cupInviteUrl, matchDeepLink } from './links'

describe('links', () => {
  it('exposes the canonical origins', () => {
    expect(SITE_ORIGIN).toBe('https://swingandsavor.at')
    expect(APP_ORIGIN).toBe('https://app.swingandsavor.at')
  })

  it('builds a cup-invite URL from an invite code', () => {
    expect(cupInviteUrl('ABC123')).toBe('https://swingandsavor.at/i/ABC123')
  })

  it('builds a match deep-link from a match id', () => {
    expect(matchDeepLink('42')).toBe('https://app.swingandsavor.at/matches/42')
  })
})
