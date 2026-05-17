/**
 * Minimaler Toast-Bus. Komponenten subscriben, andere pushen via pushToast().
 * Kein Library-Overhead, kein Context — funktioniert auch außerhalb React.
 */
const listeners = new Set()
let lastId = 0

export function pushToast({ title, body, action, icon, ttlMs = 4500 }) {
  const id = ++lastId
  const toast = { id, title, body, action, icon, createdAt: Date.now(), ttlMs }
  for (const fn of listeners) fn({ type: 'add', toast })
  return id
}

export function dismissToast(id) {
  for (const fn of listeners) fn({ type: 'remove', id })
}

export function onToast(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
