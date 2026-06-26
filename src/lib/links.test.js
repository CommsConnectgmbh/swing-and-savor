import { describe, it, expect } from 'vitest'
import { SITE_URL, APP_URL, buildInviteUrl, buildMatchUrl, buildCupRoute } from './links'

describe('buildInviteUrl', () => {
  it('builds an absolute invite link on the marketing host', () => {
    expect(buildInviteUrl('ABC123')).toBe(`${SITE_URL}/i/ABC123`)
  })
})

describe('buildMatchUrl', () => {
  it('builds an absolute match deep link on the app host', () => {
    expect(buildMatchUrl('m-42')).toBe(`${APP_URL}/matches/m-42`)
  })
})

describe('buildCupRoute', () => {
  it('routes finished cups to their recap', () => {
    expect(buildCupRoute({ status: 'finished', invite_code: 'X9' })).toBe('/recap/X9')
  })

  it('routes live/upcoming cups to the invite/live view', () => {
    expect(buildCupRoute({ status: 'live', invite_code: 'X9' })).toBe('/i/X9')
    expect(buildCupRoute({ invite_code: 'X9' })).toBe('/i/X9')
  })

  it('tolerates a missing cup', () => {
    expect(buildCupRoute(null)).toBe('/i/undefined')
  })
})
