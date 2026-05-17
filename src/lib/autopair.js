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
