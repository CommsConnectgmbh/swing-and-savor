// Suggest fair singles pairings by minimizing handicap delta.
// Greedy: pair Team A players with Team B players where HC difference is smallest.
export function suggestSingles(teamA, teamB) {
  const a = [...teamA].sort((x, y) => x.handicap - y.handicap)
  const b = [...teamB].sort((x, y) => x.handicap - y.handicap)
  const n = Math.min(a.length, b.length)
  const pairs = []
  for (let i = 0; i < n; i++) pairs.push({ a: a[i], b: b[i], delta: Math.abs(a[i].handicap - b[i].handicap) })
  return pairs
}

// Doubles: pair high+low within each team, then match averages across teams.
export function suggestDoubles(teamA, teamB) {
  function pairUp(team) {
    const sorted = [...team].sort((x, y) => x.handicap - y.handicap)
    const pairs = []
    let i = 0, j = sorted.length - 1
    while (i < j) {
      pairs.push({ p1: sorted[i], p2: sorted[j], avg: (sorted[i].handicap + sorted[j].handicap) / 2 })
      i++; j--
    }
    return pairs
  }
  const a = pairUp(teamA).sort((x, y) => x.avg - y.avg)
  const b = pairUp(teamB).sort((x, y) => x.avg - y.avg)
  const n = Math.min(a.length, b.length)
  const out = []
  for (let i = 0; i < n; i++) out.push({ a: a[i], b: b[i], delta: Math.abs(a[i].avg - b[i].avg) })
  return out
}

// Flights: alle verfügbaren Spieler pro Team in einen Flight stecken (max 4 je Seite).
// Verteilt nach Handicap-Balance — beide Seiten bekommen je den Top-Player, Mid-Player, etc.
// Bei asymmetrischer Größe wird die kleinere Seite voll besetzt, die größere kappt bei 4.
export function suggestFlight(teamA, teamB, { maxSize = 4 } = {}) {
  const a = [...teamA].sort((x, y) => x.handicap - y.handicap).slice(0, maxSize)
  const b = [...teamB].sort((x, y) => x.handicap - y.handicap).slice(0, maxSize)
  if (a.length === 0 || b.length === 0) return null
  const avgA = a.reduce((s, p) => s + p.handicap, 0) / a.length
  const avgB = b.reduce((s, p) => s + p.handicap, 0) / b.length
  return { a, b, sizeA: a.length, sizeB: b.length, delta: Math.abs(avgA - avgB) }
}
