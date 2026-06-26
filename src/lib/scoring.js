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

// Live-Lochspiel-Status für die Match-Detailansicht. Anders als calcMatchStanding
// (nur Stand) liefert dies zusätzlich die noch offenen Löcher und ob das Match
// damit bereits "dormie" (Vorsprung = Rest) oder entschieden (Vorsprung > Rest)
// ist — genau das, was man braucht, um auf einen Blick zu sehen, wer führt.
// holes = UI-Holes mit .winner ('A' | 'B' | 'halved' | null), totalHoles default 18.
export function calcMatchPlayStatus(holes, totalHoles = 18) {
  const played = (holes || []).filter((h) => h && h.winner !== null)
  const { holesUp, leader } = calcMatchStanding(played)
  const holesPlayed = played.length
  const remaining = Math.max(0, totalHoles - holesPlayed)
  const decided = leader !== 'none' && holesUp > remaining
  const dormie = leader !== 'none' && !decided && holesUp === remaining && remaining > 0
  return { leader, holesUp, holesPlayed, remaining, decided, dormie }
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

// HCP-Schläge pro Loch nach Stroke-Index (SI).
// playingHcp = ganze Schläge, die der Spieler über 18 Löcher kriegt.
// hcps = Array[18] mit SI 1..18 (1 = schwerstes, 18 = leichtestes).
// Liefert Array[18] mit Zusatz-Schlägen pro Loch.
//   Bsp HCP 18, SI=[…1..18…]: jedes Loch +1.
//   Bsp HCP 22: jedes Loch +1, plus +1 auf SI 1..4 → 4 Löcher mit +2.
//   Bsp HCP 34: jedes Loch +1, plus +1 auf SI 1..16 → 16 Löcher mit +2.
export function strokesPerHole(playingHcp, hcps) {
  const out = Array(18).fill(0)
  const hcp = Math.max(0, Math.round(Number(playingHcp) || 0))
  if (!hcp) return out
  if (!Array.isArray(hcps) || hcps.length !== 18) return out
  const base = Math.floor(hcp / 18)
  const extra = hcp % 18
  for (let i = 0; i < 18; i++) {
    const si = Number(hcps[i])
    out[i] = base + (Number.isFinite(si) && si >= 1 && si <= extra ? 1 : 0)
  }
  return out
}

// Loch-Sieger im Casual Match-Play (Netto).
// strokesA/strokesB sind die Bruttoschläge auf diesem Loch (oder null).
// addA/addB sind die HCP-Strokes, die der Spieler auf diesem Loch kriegt.
// Liefert 'A' | 'B' | 'halved' | null (wenn unkomplett).
export function holeWinnerNet(strokesA, strokesB, addA, addB) {
  if (!Number.isFinite(strokesA) || !Number.isFinite(strokesB) || strokesA < 1 || strokesB < 1) return null
  const netA = strokesA - (addA || 0)
  const netB = strokesB - (addB || 0)
  if (netA < netB) return 'A'
  if (netB < netA) return 'B'
  return 'halved'
}

// Match-Play-Stand für 2 Casual-Spieler.
// scoresByHole = { holeNumber → { a, b } } Bruttoscores.
// strokesA/strokesB = Array[18] der HCP-Strokes pro Loch.
// Liefert { upA, upB, halved, played, leader: 'A'|'B'|'AS', label }
export function calcCasualMatchStanding(scoresByHole, strokesA, strokesB) {
  let upA = 0, upB = 0, halved = 0, played = 0
  for (let h = 1; h <= 18; h++) {
    const s = scoresByHole[h]
    if (!s) continue
    const w = holeWinnerNet(s.a, s.b, strokesA?.[h - 1] || 0, strokesB?.[h - 1] || 0)
    if (!w) continue
    played++
    if (w === 'A') upA++
    else if (w === 'B') upB++
    else halved++
  }
  const diff = upA - upB
  const leader = diff > 0 ? 'A' : diff < 0 ? 'B' : 'AS'
  const remaining = 18 - played
  let label
  if (leader === 'AS') label = played === 0 ? '—' : 'All Square'
  else {
    const up = Math.abs(diff)
    label = (up > remaining && played === 18) ? `${up}&${remaining}` : `${up} Up`
  }
  return { upA, upB, halved, played, leader, label, remaining }
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
