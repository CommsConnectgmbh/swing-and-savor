import { supabase } from './supabase'

export async function searchCourses(q, max = 20) {
  if (!q || q.length < 2) return []
  const { data, error } = await supabase.rpc('search_courses', { q, max_results: max })
  if (error) { console.error('[courses] search:', error); return [] }
  return data || []
}

export async function coursesNear(lat, lng, radiusKm = 25, max = 30) {
  const { data, error } = await supabase.rpc('courses_near', {
    lat, lng, radius_m: Math.round(radiusKm * 1000), max_results: max,
  })
  if (error) { console.error('[courses] near:', error); return [] }
  return data || []
}

export async function getCourse(id) {
  if (!id) return null
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).maybeSingle()
  if (error) { console.error('[courses] get:', error); return null }
  return data
}

export async function createCourse({ name, city, country, lat, lng, hole_pars, hole_handicaps, notes }) {
  const payload = {
    source: 'user',
    name: name?.trim(),
    city: city?.trim() || null,
    country: country?.trim() || null,
    lat: lat ?? null,
    lng: lng ?? null,
    hole_pars: hole_pars && hole_pars.length ? hole_pars : new Array(18).fill(4),
    hole_handicaps: hole_handicaps && hole_handicaps.length ? hole_handicaps : [],
    notes: notes?.trim() || null,
  }
  const { data, error } = await supabase.from('courses').insert(payload).select('*').single()
  if (error) { console.error('[courses] create:', error); throw error }
  return data
}

export async function applyCourseEdit(courseId, holePars, holeHandicaps, sourceMatchId = null) {
  const { data, error } = await supabase.rpc('apply_course_edit', {
    p_course_id:      courseId,
    p_hole_pars:      holePars,
    p_hole_handicaps: holeHandicaps,
    p_source_match_id: sourceMatchId,
  })
  if (error) { console.error('[courses] edit:', error); throw error }
  return data
}

// Pull more courses into our DB from golfcourseapi via our edge function.
// Returns [] if the key isn't configured yet (503 from function).
export async function importCoursesFromUpstream(q) {
  try {
    const { data, error } = await supabase.functions.invoke('import-courses', { body: { q } })
    if (error) { console.warn('[courses] import:', error); return [] }
    return data?.courses ?? []
  } catch (e) {
    console.warn('[courses] import exception:', e)
    return []
  }
}

// Seed an entire region from OSM via our overpass edge function.
// Pass either { country: 'TR' }, { bbox: [s,w,n,e] }, or { lat, lng, radius_m }.
export async function seedFromOsm(opts) {
  try {
    const { data, error } = await supabase.functions.invoke('osm-seed-courses', { body: opts })
    if (error) { console.warn('[courses] osm seed:', error); return { count: 0 } }
    return data
  } catch (e) {
    console.warn('[courses] osm exception:', e)
    return { count: 0, error: String(e) }
  }
}

// Convenience: import a region around the user's current location (radius km)
export async function seedFromOsmNear(lat, lng, radiusKm = 50) {
  return seedFromOsm({ lat, lng, radius_m: Math.round(radiusKm * 1000) })
}

// Browser-Geolocation helper, returns {lat,lng} or null
export function getCurrentLocation(opts = { timeout: 8000, maximumAge: 60_000 }) {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => { console.warn('[geo]', err); resolve(null) },
      opts,
    )
  })
}
