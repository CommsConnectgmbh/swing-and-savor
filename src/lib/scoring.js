export function calcMatchStanding(holeResults) {
  let scoreA = 0
  let scoreB = 0

  for (const hole of holeResults) {
    if (hole.winner === 'A') scoreA++
    else if (hole.winner === 'B') scoreB++
  }

  const diff = scoreA - scoreB
  const holesUp = Math.abs(diff)
  const leader = diff > 0 ? 'A' : diff < 0 ? 'B' : 'none'
  const label = leader === 'none' ? 'ALL SQ' : `${holesUp} UP`

  return { holesUp, leader, label, holesPlayed: holeResults.length }
}

export function calcTeamPoints(matches, holesByMatch = {}) {
  let A = 0
  let B = 0

  for (const match of matches) {
    if (match.status === 'finished') {
      if (match.winner === 'A') A += 1
      else if (match.winner === 'B') B += 1
      else if (match.winner === 'halved') { A += 0.5; B += 0.5 }
    } else if (match.status === 'active') {
      // Live projection: current standing counts as projected point
      const holes = holesByMatch[match.id] || []
      if (holes.length > 0) {
        const standing = calcMatchStanding(holes)
        if (standing.leader === 'A') A += 1
        else if (standing.leader === 'B') B += 1
        else { A += 0.5; B += 0.5 }
      }
    }
  }

  return { A, B }
}
