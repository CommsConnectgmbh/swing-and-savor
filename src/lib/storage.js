// Safe Web Storage access.
//
// Reading or writing `localStorage`/`sessionStorage` can throw: Safari private
// mode, cookies disabled, storage quota exceeded, or no `window` at all (SSR /
// worker). Every call site used to wrap the access in its own `try {} catch {}`
// — the same guard copy-pasted across referral, theme, debug telemetry and a
// couple of screens, each slightly different. These helpers are the single
// source of truth: a storage hiccup returns the fallback (reads) or reports
// `false` (writes) instead of crashing the caller.
//
// Referencing the storage global directly throws a `ReferenceError` where it is
// undefined, which the surrounding `try` catches — so no `typeof` guard needed.

function safeRead(store, key, fallback) {
  try {
    const v = store.getItem(key)
    return v === null ? fallback : v
  } catch {
    return fallback
  }
}

function safeWrite(store, key, value) {
  try {
    store.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeRemove(store, key) {
  try {
    store.removeItem(key)
    return true
  } catch {
    return false
  }
}

// --- localStorage ---------------------------------------------------------

/** Read a string from localStorage, or `fallback` if missing/unavailable. */
export function readLocal(key, fallback = null) {
  return safeRead(localStorage, key, fallback)
}

/** Write a string to localStorage. Returns whether it persisted. */
export function writeLocal(key, value) {
  return safeWrite(localStorage, key, value)
}

/** Remove a localStorage key. Returns whether the call succeeded. */
export function removeLocal(key) {
  return safeRemove(localStorage, key)
}

/** Clear all of localStorage. Returns whether the call succeeded. */
export function clearLocal() {
  try {
    localStorage.clear()
    return true
  } catch {
    return false
  }
}

/**
 * Read + JSON.parse a localStorage value, or `fallback` when the key is
 * missing, storage is unavailable, or the stored text is not valid JSON.
 */
export function readLocalJson(key, fallback = null) {
  const raw = safeRead(localStorage, key, null)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** JSON.stringify + write a value to localStorage. Returns whether it persisted. */
export function writeLocalJson(key, value) {
  try {
    return safeWrite(localStorage, key, JSON.stringify(value))
  } catch {
    return false
  }
}

// --- sessionStorage -------------------------------------------------------

/** Read a string from sessionStorage, or `fallback` if missing/unavailable. */
export function readSession(key, fallback = null) {
  return safeRead(sessionStorage, key, fallback)
}

/** Write a string to sessionStorage. Returns whether it persisted. */
export function writeSession(key, value) {
  return safeWrite(sessionStorage, key, value)
}

/** Clear all of sessionStorage. Returns whether the call succeeded. */
export function clearSession() {
  try {
    sessionStorage.clear()
    return true
  } catch {
    return false
  }
}
