// Bridges the React app with the iOS WatchBridge Capacitor plugin so the
// paired Apple Watch can mirror the active match and push back hole-by-hole
// score entries. No-ops on non-iOS platforms.

const W = typeof window !== 'undefined' ? window : null
const Capacitor = W?.Capacitor
const isNative = !!Capacitor?.isNativePlatform?.() && Capacitor?.getPlatform?.() === 'ios'

function plugin() {
  if (!isNative) return null
  return Capacitor.Plugins?.WatchBridge || null
}

export function watchIsAvailable() {
  return !!plugin()
}

export async function watchProbe() {
  const p = plugin()
  if (!p) return { available: false, reason: 'not-ios' }
  try { return await p.isAvailable() }
  catch (e) { return { available: false, reason: e?.message || 'probe-failed' } }
}

export async function publishMatchToWatch(payload) {
  const p = plugin()
  if (!p) return false
  try {
    await p.publishMatch(payload)
    return true
  } catch (e) {
    console.warn('[watchBridge] publish failed', e)
    return false
  }
}

export async function clearWatchMatch() {
  const p = plugin()
  if (!p) return
  try { await p.clearMatch() }
  catch (e) { console.warn('[watchBridge] clear failed', e) }
}

// Subscribe to incoming events from the watch. Returns an unsubscribe fn.
export function onWatchScore(handler) {
  if (!isNative) return () => {}
  let cleanup = () => {}
  let cancelled = false
  ;(async () => {
    try {
      const handle = await Capacitor.Plugins.WatchBridge.addListener('watchScoreEntered', handler)
      if (cancelled) { handle?.remove?.(); return }
      cleanup = () => { handle?.remove?.() }
    } catch (e) {
      console.warn('[watchBridge] subscribe failed', e)
    }
  })()
  return () => { cancelled = true; cleanup() }
}

export function onWatchRefreshRequest(handler) {
  if (!isNative) return () => {}
  let cleanup = () => {}
  let cancelled = false
  ;(async () => {
    try {
      const handle = await Capacitor.Plugins.WatchBridge.addListener('watchRequestedRefresh', handler)
      if (cancelled) { handle?.remove?.(); return }
      cleanup = () => { handle?.remove?.() }
    } catch (e) {
      console.warn('[watchBridge] subscribe refresh failed', e)
    }
  })()
  return () => { cancelled = true; cleanup() }
}

// Shape the MatchDetailScreen state into the payload the watch expects.
export function buildWatchPayload({ match, holes, tournament, course, namesA, namesB, typeLabel }) {
  if (!match?.id) return null
  return {
    matchId: match.id,
    teamAName: tournament?.team_a_name || 'Team A',
    teamBName: tournament?.team_b_name || 'Team B',
    playersA: (namesA || []).join(' · '),
    playersB: (namesB || []).join(' · '),
    typeLabel: typeLabel || 'Match',
    format: match.format || 'match_play',
    status: match.status || 'active',
    cupName: tournament?.name || null,
    courseName: course?.name || null,
    holes: (holes || []).map(h => ({
      holeNumber: h.hole_number,
      par: h.par || 4,
      strokesA: parseInt(h.strokes_a) || null,
      strokesB: parseInt(h.strokes_b) || null,
    })),
  }
}
