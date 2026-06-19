// Shared display formatters.
//
// These helpers were previously copy-pasted across several screens and
// components (relative timestamps in MessagesScreen/CommentsThread, points
// rounding in BoardScreen/MatchDetailScreen, and the noon-anchored cup-date
// pattern in HomeScreen/BoardScreen/DiscoverScreen/QrCodeSheet/…). Keeping a
// single source of truth avoids the formats drifting apart over time.

// Kurze relative Zeit für Listen (DM-Inbox, Kommentare).
// < 1 min → "jetzt", dann min/h/d, ab 7 Tagen das Datum.
export function relTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60)        return 'jetzt'
  if (diff < 3600)      return `${Math.floor(diff / 60)} min`
  if (diff < 86400)     return `${Math.floor(diff / 3600)} h`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} d`
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}

// Punkte ohne überflüssige Nachkommastelle: 3 → "3", 2.5 → "2.5".
export function fmtPts(v) {
  return v % 1 === 0 ? String(v) : v.toFixed(1)
}

// Turnierdatum formatieren. Der 'T12:00:00'-Anker verhindert, dass ein reines
// 'YYYY-MM-DD' je nach Zeitzone auf den Vortag zurückrutscht.
// opts entspricht den Intl.DateTimeFormat-Optionen des jeweiligen Aufrufers;
// gibt bei leerer/ungültiger Eingabe '' zurück.
export function formatCupDate(d, opts, locale = 'de-DE') {
  if (!d) return ''
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString(locale, opts)
  } catch {
    return ''
  }
}

/**
 * Format a cents amount as a localised EUR currency string.
 */
export function fmtEur(cents, lang = 'de') {
  return (cents / 100).toLocaleString(lang, { style: 'currency', currency: 'EUR' })
}

/**
 * Lower-cased file extension for storage keys.
 * @param {File} file
 * @param {{ fallback?: string, max?: number }} [opts]
 */
export function fileExt(file, { fallback = 'jpg', max } = {}) {
  let ext = (file?.name?.split('.').pop() || fallback).toLowerCase()
  if (max) ext = ext.slice(0, max)
  return ext
}
