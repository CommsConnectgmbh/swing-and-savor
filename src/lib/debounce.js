// Trailing debounce: bündelt einen Schwall von Realtime-Events zu einem Aufruf.
export function debounce(fn, wait = 400) {
  let t = null
  const wrapped = (...args) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => { t = null; fn(...args) }, wait)
  }
  wrapped.cancel = () => { if (t) { clearTimeout(t); t = null } }
  return wrapped
}
