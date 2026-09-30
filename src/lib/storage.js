// SSR- and quota-safe wrappers around Web Storage (localStorage / sessionStorage).
//
// Any Web Storage access can throw: private-mode Safari rejects reads and
// writes outright, SSR/prerender has no `window`, and a full quota throws on
// write. Every call site therefore wrapped its get/set/remove in the same
// `try {} catch {}` guard (theme, referral, tournamentGate, MatchDetailScreen,
// OnboardingScreen …). That boilerplate had to be repeated verbatim to stay
// crash-proof, and a single forgotten guard is a hard reload-loop bug in
// exactly the browsers we can least reproduce.
//
// This module owns the guard once. Callers use `localStore` / `sessionStore`
// as if storage always exists; reads fall back gracefully and writes report
// success via a boolean instead of throwing.

// Resolve the underlying Storage object, or null when it is unavailable.
// Accessing `window.localStorage` can itself throw (Safari private mode), so
// even this lookup is guarded.
function backend(area) {
  try {
    if (typeof window === 'undefined') return null
    return area === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

function makeStore(area) {
  return {
    // Raw string value for `key`, or `fallback` when missing/unavailable.
    get(key, fallback = null) {
      const store = backend(area)
      if (!store) return fallback
      try {
        const v = store.getItem(key)
        return v === null ? fallback : v
      } catch {
        return fallback
      }
    },

    // Persist a string value. Returns true on success, false if storage was
    // unavailable or the write threw (e.g. quota exceeded).
    set(key, value) {
      const store = backend(area)
      if (!store) return false
      try {
        store.setItem(key, value)
        return true
      } catch {
        return false
      }
    },

    // Delete `key`. Returns true on success, false if storage was unavailable.
    remove(key) {
      const store = backend(area)
      if (!store) return false
      try {
        store.removeItem(key)
        return true
      } catch {
        return false
      }
    },

    // Parsed JSON value for `key`, or `fallback` when the key is missing,
    // storage is unavailable, or the stored text is not valid JSON.
    getJSON(key, fallback = null) {
      const raw = this.get(key, null)
      if (raw === null) return fallback
      try {
        return JSON.parse(raw)
      } catch {
        return fallback
      }
    },

    // Serialise `value` as JSON and persist it. Returns true on success.
    setJSON(key, value) {
      try {
        return this.set(key, JSON.stringify(value))
      } catch {
        return false
      }
    },

    // Clear the whole store. Returns true on success.
    clear() {
      const store = backend(area)
      if (!store) return false
      try {
        store.clear()
        return true
      } catch {
        return false
      }
    },
  }
}

export const localStore = makeStore('local')
export const sessionStore = makeStore('session')
