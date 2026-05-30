export function calcMatchStanding(holeResults) {
  let scoreA = 0
  let scoreB = 0

  for (const hole of holeResults) {
    if (hole.winner === 'A') scoreA++
    else if (hole.winner === 'B') scoreB++
  }

  const diff = scoreA - scoreB
  const holesUp = Math.abs(diff)
  // 'none' = Live-Standing-Gleichstand (UI-only). Entspricht dem 'halved'-Wert
  // aus calcWinner / hole_results.winner; NICHT in die DB schreiben.
  const leader = diff > 0 ? 'A' : diff < 0 ? 'B' : 'none'
  const label = leader === 'none' ? 'ALL SQ' : `${holesUp} UP`

  return { holesUp, leader, label, holesPlayed: holeResults.length }
}

// Punktefaktoren pro Team. Default 1.0. Bei Flight-Matches mit asymmetrischer
// Spielerzahl gleicht der Faktor die personelle Überzahl aus (z.B. 4v3 → 3er-Team
// Faktor 1.0, 4er-Team Faktor 0.75 = 3/4).
function factor(match, side) {
  const f = side === 'A' ? match.team_a_factor : match.team_b_factor
  const n = Number(f)
  return Number.isFinite(n) && n > 0 ? n : 1
}

// Vorschlag für faire Faktoren bei asymmetrischen Flights.
// Größeres Team bekommt < 1.0, kleineres Team behält 1.0.
export function suggestFactors(sizeA, sizeB) {
  const a = Math.max(1, Math.min(4, sizeA | 0))
  const b = Math.max(1, Math.min(4, sizeB | 0))
  if (a === b) return { team_a_factor: 1, team_b_factor: 1 }
  return a > b
    ? { team_a_factor: round2(b / a), team_b_factor: 1 }
    : { team_a_factor: 1, team_b_factor: round2(a / b) }
}

function round2(n) { return Math.round(n * 100) / 100 }

// Brutto-Stableford pro Loch.
// 4 = Eagle, 3 = Birdie, 2 = Par, 1 = Bogey, 0 = Doppel-Bogey oder schlimmer.
// strokes/par müssen positive Integers sein, sonst null.
export function stablefordPoints(strokes, par) {
  const s = parseInt(strokes), p = parseInt(par)
  if (!s || !p || s < 1 || p < 3) return null
  const diff = s - p
  if (diff <= -2) return 4
  if (diff === -1) return 3
  if (diff ===  0) return 2
  if (diff ===  1) return 1
  return 0
}

export function calcStablefordTotals(holes) {
  let a = 0, b = 0
  for (const h of (holes || [])) {
    const pa = stablefordPoints(h.strokes_a, h.par)
    const pb = stablefordPoints(h.strokes_b, h.par)
    if (pa !== null) a += pa
    if (pb !== null) b += pb
  }
  return { a, b }
}

export function calcTeamPoints(matches, holesByMatch = {}) {
  let A = 0
  let B = 0

  for (const match of matches) {
    const fA = factor(match, 'A')
    const fB = factor(match, 'B')

    if (match.status === 'finished') {
      if (match.winner === 'A')         A += 1 * fA
      else if (match.winner === 'B')    B += 1 * fB
      else if (match.winner === 'halved') { A += 0.5 * fA; B += 0.5 * fB }
    } else if (match.status === 'active') {
      const holes = holesByMatch[match.id] || []
      if (holes.length > 0) {
        const standing = calcMatchStanding(holes)
        if (standing.leader === 'A')      A += 1 * fA
        else if (standing.leader === 'B') B += 1 * fB
        else                              { A += 0.5 * fA; B += 0.5 * fB }
      }
    }
  }

  return { A: round2(A), B: round2(B) }
}
