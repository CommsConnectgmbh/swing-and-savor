import { pushToast } from './toast'

// Score-Eingaben dürfen nie still scheitern. Supabase meldet fehlende Rechte
// (RLS) als 42501 bzw. "row-level security"; bei UPDATE ohne Treffer kommt gar
// kein Fehler, dann liefert der Aufrufer `noRows: true`.
export function isPermissionError(error) {
  if (!error) return false
  if (error.code === '42501') return true
  return /row-level security|permission denied|participants may only/i.test(error.message || '')
}

export function saveErrorToast(error, { noRows = false } = {}) {
  if (noRows || isPermissionError(error)) {
    return {
      icon: '⚠️',
      title: 'Nicht gespeichert',
      body: 'Eintragen dürfen nur die Spieler dieses Matches und der Cup-Ersteller.',
    }
  }
  return {
    icon: '⚠️',
    title: 'Nicht gespeichert',
    body: 'Bitte Verbindung prüfen und erneut eintragen.',
  }
}

// Gleiche Meldung nicht bei jedem Tastendruck erneut zeigen.
let lastShownAt = 0
export function notifySaveFailed(error, opts = {}, now = Date.now()) {
  if (now - lastShownAt < 3000) return false
  lastShownAt = now
  pushToast(saveErrorToast(error, opts))
  return true
}
