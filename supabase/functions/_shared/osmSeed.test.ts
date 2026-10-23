import { describe, it, expect } from 'vitest'
import { parseSeedRequest, buildOverpassQuery, MAX_USER_RADIUS_M } from './osmSeed.ts'
import { requireUser, isAdmin, registerRateLimit, clientIp } from './edgeGuard.ts'

describe('parseSeedRequest', () => {
  it('accepts a point for normal users and clamps the radius', () => {
    expect(parseSeedRequest({ lat: 48.1, lng: 11.5, radius_m: 999999 }, { admin: false }))
      .toEqual({ kind: 'near', lat: 48.1, lng: 11.5, radius_m: MAX_USER_RADIUS_M })
    expect(parseSeedRequest({ lat: 48.1, lng: 11.5 }, { admin: false }))
      .toMatchObject({ kind: 'near', radius_m: MAX_USER_RADIUS_M })
  })

  it('rejects strings, out-of-range and missing coordinates', () => {
    expect(parseSeedRequest({ lat: '48', lng: 11 }, { admin: false })).toHaveProperty('error')
    expect(parseSeedRequest({ lat: 91, lng: 11 }, { admin: false })).toHaveProperty('error')
    expect(parseSeedRequest({ lat: 48, lng: -181 }, { admin: false })).toHaveProperty('error')
    expect(parseSeedRequest({ lat: 48, lng: 11, radius_m: '1);out;' }, { admin: false })).toHaveProperty('error')
    expect(parseSeedRequest(null, { admin: false })).toHaveProperty('error')
  })

  it('reserves country and bbox seeding for the admin', () => {
    expect(parseSeedRequest({ country: 'AT' }, { admin: false })).toEqual({ error: 'forbidden' })
    expect(parseSeedRequest({ bbox: [47, 11, 48, 12] }, { admin: false })).toEqual({ error: 'forbidden' })
    expect(parseSeedRequest({ country: 'at' }, { admin: true })).toEqual({ kind: 'country', cc: 'AT' })
  })

  it('blocks Overpass query injection through bbox and country', () => {
    const inj = '1);node(around:1000000,0,0);out;('
    expect(parseSeedRequest({ bbox: [inj, 11, 48, 12] }, { admin: true })).toEqual({ error: 'invalid bbox' })
    expect(parseSeedRequest({ bbox: [48, 11, 47, 12] }, { admin: true })).toEqual({ error: 'invalid bbox' })
    expect(parseSeedRequest({ bbox: [40, 0, 50, 10] }, { admin: true })).toEqual({ error: 'bbox too large' })
    expect(parseSeedRequest({ country: 'A"];out;' }, { admin: true })).toEqual({ error: 'invalid country' })
  })

  it('builds queries only from validated values', () => {
    const q = buildOverpassQuery({ kind: 'near', lat: 48.1, lng: 11.5, radius_m: 5000 })
    expect(q).toContain('(around:5000,48.1,11.5)')
    expect(q.match(/out center tags;/g)).toHaveLength(1)
    expect(buildOverpassQuery({ kind: 'bbox', s: 47, w: 11, n: 48, e: 12 })).toContain('(47,11,48,12)')
  })
})

describe('edgeGuard', () => {
  const req = (h: Record<string, string>) => new Request('http://x', { headers: h })
  const client = (user: unknown, error: unknown = null) => ({ auth: { getUser: async () => ({ data: { user }, error }) } })

  it('requireUser needs a bearer token that resolves to a user', async () => {
    expect(await requireUser(req({}), client({ id: 'u' }))).toBeNull()
    expect(await requireUser(req({ Authorization: 'Bearer anon' }), client(null, { message: 'no sub' }))).toBeNull()
    expect(await requireUser(req({ Authorization: 'Bearer t' }), client({ id: 'u', email: 'a@b.c' })))
      .toEqual({ id: 'u', email: 'a@b.c' })
  })

  it('isAdmin only for the admin address', () => {
    expect(isAdmin({ id: 'u', email: 'Rainer.Roloff@comms-connect.de' })).toBe(true)
    expect(isAdmin({ id: 'u', email: 'x@comms-connect.de' })).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })

  it('registerRateLimit fails closed', async () => {
    await expect(registerRateLimit({ rpc: async () => ({ data: null, error: { message: 'down' } }) }, ['osm-seed:u'])).rejects.toThrow()
    await expect(registerRateLimit({ rpc: async () => ({ data: 'yes', error: null }) }, ['osm-seed:u'])).rejects.toThrow()
    expect(await registerRateLimit({ rpc: async () => ({ data: false, error: null }) }, ['osm-seed:u'])).toBe(false)
  })

  it('clientIp takes the first forwarded hop', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4')
    expect(clientIp(req({}))).toBe('unknown')
  })
})
