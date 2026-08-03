import { describe, it, expect } from 'vitest'
import { SITE_URL, APP_URL, cupInviteUrl, matchUrl } from './links'

describe('links', () => {
  it('exposes the canonical hosts', () => {
    expect(SITE_URL).toBe('https://swingandsavor.at')
    expect(APP_URL).toBe('https://app.swingandsavor.at')
  })

  it('builds cup invite links on the marketing host', () => {
    expect(cupInviteUrl('ABC123')).toBe('https://swingandsavor.at/i/ABC123')
  })

  it('builds match deep links on the app host', () => {
    expect(matchUrl('7f3c9d2e')).toBe('https://app.swingandsavor.at/matches/7f3c9d2e')
  })
})
