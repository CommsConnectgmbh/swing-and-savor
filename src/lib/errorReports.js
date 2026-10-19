// Einwilligung fuer Fehlerberichte (Sentry), § 25 Abs. 1 TDDDG / Art. 6 Abs. 1 lit. a DSGVO.
// Ohne ausdrueckliche Zustimmung wird Sentry gar nicht erst gestartet.
// Gespeichert wird nur die Wahl selbst (localStorage, technisch notwendig).
export const ERROR_REPORTS_KEY = 'sns_error_reports'
export const ERROR_REPORTS_EVENT = 'sns:error-reports'

export function getErrorReportChoice() {
  try {
    const v = localStorage.getItem(ERROR_REPORTS_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

function announce(choice) {
  try {
    window.dispatchEvent(new CustomEvent(ERROR_REPORTS_EVENT, { detail: choice }))
  } catch { /* ignore */ }
}

export function setErrorReportChoice(choice) {
  if (choice !== 'granted' && choice !== 'denied') throw new Error('invalid choice')
  try { localStorage.setItem(ERROR_REPORTS_KEY, choice) } catch { /* ignore */ }
  announce(choice)
}

// Oeffnet die Abfrage erneut (Widerruf / Aenderung jederzeit).
export function resetErrorReportChoice() {
  try { localStorage.removeItem(ERROR_REPORTS_KEY) } catch { /* ignore */ }
  announce(null)
}
