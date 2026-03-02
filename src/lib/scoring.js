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

export function calcTeamPoints(matches) {
  let A = 0
  let B = 0

  for (const match of matches) {
    if (match.status !== 'finished') continue
    if (match.winner === 'A') A += 1
    else if (match.winner === 'B') B += 1
    else if (match.winner === 'halved') { A += 0.5; B += 0.5 }
  }

  return { A, B }
}
