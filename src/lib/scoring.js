// Match-Play scoring helpers

export function holeOutcome(strokesA, strokesB, advantage = 'none') {
  const a = advantage === 'A' ? strokesA - 1 : strokesA
  const b = advantage === 'B' ? strokesB - 1 : strokesB
  if (a < b) return 'A'
  if (b < a) return 'B'
  return 'halved'
}

// Match-play status: returns "{n} UP", "AS" (all square), or "DORMIE"
export function matchStatus(holes) {
  let aWins = 0
  let bWins = 0
  for (const h of holes) {
    if (h.winner === 'A') aWins++
    else if (h.winner === 'B') bWins++
  }
  const diff = aWins - bWins
  if (diff === 0) return { lead: 'AS', value: 0, leader: null }
  return { lead: `${Math.abs(diff)} UP`, value: Math.abs(diff), leader: diff > 0 ? 'A' : 'B' }
}

export function matchFinished(holes) {
  const played = holes.length
  if (played === 0) return false
  const { value, leader } = matchStatus(holes)
  const remaining = 18 - played
  return value > remaining && leader !== null
}

export function teamPoints(matches) {
  let a = 0, b = 0
  for (const m of matches) {
    if (m.status !== 'finished') continue
    if (m.winner === 'A') a++
    else if (m.winner === 'B') b++
    else if (m.winner === 'halved') { a += 0.5; b += 0.5 }
  }
  return { a, b }
}
