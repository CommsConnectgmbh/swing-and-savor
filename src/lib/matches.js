// Shared match-domain helpers.
//
// Two derivations were hand-copied across MatchesScreen, MatchDetailScreen,
// HomeScreen and BoardScreen:
//   1. the team roster ids ("prefer the modern `team_<side>_player_ids` array,
//      fall back to the legacy `player1/player2` columns"), and
//   2. the match type label ("Singles" / "Doubles" / "Flight NvM", optionally
//      suffixed with the format).
// The copies had already started to drift (e.g. one site `.filter(Boolean)`s
// both branches, another only the fallback). Centralising them here keeps the
// behaviour identical everywhere and gives it a single place to be tested.

/**
 * Player ids for one side of a match.
 *
 * Prefers the modern `team_<side>_player_ids` array; falls back to the legacy
 * `team_<side>_player1_id` / `team_<side>_player2_id` columns for older rows.
 * Falsy ids are dropped either way.
 *
 * @param {object|null|undefined} match
 * @param {'a'|'b'} side
 * @returns {Array<string>}
 */
export function teamPlayerIds(match, side) {
  if (!match) return []
  const arr = match[`team_${side}_player_ids`]
  if (arr?.length) return arr.filter(Boolean)
  return [match[`team_${side}_player1_id`], match[`team_${side}_player2_id`]].filter(Boolean)
}

/**
 * Base match-type label: `"Singles"`, `"Doubles"`, or `"Flight NvM"`.
 *
 * `countA` / `countB` are the flight roster sizes to display. Call sites differ
 * in what they count (players-by-name vs players-by-id), so the count is passed
 * in rather than derived here.
 *
 * @param {{ type?: string }|null|undefined} match
 * @param {number} countA
 * @param {number} countB
 * @returns {string}
 */
export function matchTypeLabel(match, countA, countB) {
  if (match?.type === 'singles') return 'Singles'
  if (match?.type === 'doubles') return 'Doubles'
  return `Flight ${countA}v${countB}`
}

/**
 * Match-type label with the format suffix: appends `" · Stableford"` when the
 * match is played in Stableford format, otherwise the bare {@link matchTypeLabel}.
 *
 * @param {{ type?: string, format?: string }|null|undefined} match
 * @param {number} countA
 * @param {number} countB
 * @returns {string}
 */
export function matchTypeFormatLabel(match, countA, countB) {
  const base = matchTypeLabel(match, countA, countB)
  return match?.format === 'stableford' ? `${base} · Stableford` : base
}
