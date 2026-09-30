// Helpers for symmetric two-party rows — tables that store a relationship as an
// unordered `{ user_a, user_b }` pair (friendships, conversations, …).
//
// "Which of the two is the *other* person, relative to me?" was re-derived
// inline as `row.user_a === myId ? row.user_b : row.user_a` in a handful of
// screens. Same expression, copied by hand, easy to get backwards. One source
// of truth here; `friendships.js` re-exports it for its own callers.

/**
 * Given a row with `user_a` / `user_b`, return the id of the participant that
 * is *not* `myId`. If `myId` matches neither side, `user_a` is returned — the
 * historical behaviour of the inlined expression this replaces.
 */
export function otherUserId(row, myId) {
  return row.user_a === myId ? row.user_b : row.user_a
}
