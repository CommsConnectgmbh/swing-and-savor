// Numeric helpers shared across screens/components.
//
// `clamp` was previously copy-pasted as the `Math.max(min, Math.min(max, x))`
// idiom in CourseEditor (par/handicap steppers), scoring (flight sizes),
// MatchesScreen (flight size + team factor) and MatchDetailScreen (par
// stepper). A single source of truth keeps the bounds logic from drifting.

/**
 * Constrain a number to the inclusive range [min, max].
 * Mirrors the `Math.max(min, Math.min(max, value))` idiom exactly, so NaN
 * propagates and callers are responsible for passing min <= max.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
