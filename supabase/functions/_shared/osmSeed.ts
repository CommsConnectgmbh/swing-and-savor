// Input validation and Overpass query building for osm-seed-courses.
// Only validated numbers / ISO codes ever reach the query string.

export type SeedRequest =
  | { kind: 'near'; lat: number; lng: number; radius_m: number }
  | { kind: 'bbox'; s: number; w: number; n: number; e: number }
  | { kind: 'country'; cc: string }

export const MAX_USER_RADIUS_M = 50_000
export const MIN_RADIUS_M = 1_000
/** Largest bbox an admin may seed in one call (degrees², about 220 km x 220 km in central Europe). */
export const MAX_BBOX_AREA_DEG2 = 4

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null
const isLat = (v: number | null): v is number => v !== null && v >= -90 && v <= 90
const isLng = (v: number | null): v is number => v !== null && v >= -180 && v <= 180

/**
 * Validates the request body. Users may only seed around a point;
 * country and bbox seeding is reserved for the admin.
 */
export function parseSeedRequest(body: unknown, opts: { admin: boolean }): SeedRequest | { error: string } {
  const b = (body && typeof body === 'object') ? body as Record<string, unknown> : {}

  if (b.country !== undefined || b.bbox !== undefined) {
    if (!opts.admin) return { error: 'forbidden' }
    if (b.country !== undefined) {
      if (typeof b.country !== 'string' || !/^[A-Za-z]{2}$/.test(b.country)) return { error: 'invalid country' }
      return { kind: 'country', cc: b.country.toUpperCase() }
    }
    if (!Array.isArray(b.bbox) || b.bbox.length !== 4) return { error: 'invalid bbox' }
    const [s, w, n, e] = b.bbox.map(num)
    if (!isLat(s) || !isLat(n) || !isLng(w) || !isLng(e) || s >= n || w >= e) return { error: 'invalid bbox' }
    if ((n - s) * (e - w) > MAX_BBOX_AREA_DEG2) return { error: 'bbox too large' }
    return { kind: 'bbox', s, w, n, e }
  }

  const lat = num(b.lat)
  const lng = num(b.lng)
  if (!isLat(lat) || !isLng(lng)) return { error: 'provide lat/lng' }
  const r = b.radius_m === undefined ? MAX_USER_RADIUS_M : num(b.radius_m)
  if (r === null) return { error: 'invalid radius_m' }
  return { kind: 'near', lat, lng, radius_m: Math.round(Math.max(MIN_RADIUS_M, Math.min(MAX_USER_RADIUS_M, r))) }
}

export function buildOverpassQuery(req: SeedRequest): string {
  const head = '[out:json][timeout:90];'
  const sel = (filter: string) =>
    `(way["leisure"="golf_course"]${filter};relation["leisure"="golf_course"]${filter};node["leisure"="golf_course"]${filter};);out center tags;`
  switch (req.kind) {
    case 'country':
      return `${head}area["ISO3166-1"="${req.cc}"]->.a;${sel('(area.a)')}`
    case 'bbox':
      return `${head}${sel(`(${req.s},${req.w},${req.n},${req.e})`)}`
    case 'near':
      return `${head}${sel(`(around:${req.radius_m},${req.lat},${req.lng})`)}`
  }
}
