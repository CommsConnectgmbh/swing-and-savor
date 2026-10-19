import * as Sentry from '@sentry/react'
import { getErrorReportChoice, ERROR_REPORTS_EVENT } from './lib/errorReports'

// Fehlerberichte nur nach Einwilligung (Banner, siehe ErrorReportsBanner).
// Ohne Zustimmung wird Sentry nicht initialisiert; captureException ist dann
// ein No-op und es geht keinerlei Anfrage an Sentry.
// Nur Fehlerberichte: kein Performance-Tracing und kein Session-Tracking.
let started = false

export function startErrorReports() {
  if (started) return
  started = true
  Sentry.init({
    dsn: 'https://4ce1f09bfcdb2525763ce4466564c158@o4511507613089792.ingest.de.sentry.io/4511507636093008',
    integrations: (defaults) => defaults.filter((i) => i.name !== 'BrowserSession'),
    tracesSampleRate: 0,
    sendDefaultPii: false,
  })
}

export async function stopErrorReports() {
  if (!started) return
  started = false
  try { await Sentry.close() } catch { /* ignore */ }
}

export function errorReportsActive() {
  return started
}

if (getErrorReportChoice() === 'granted') startErrorReports()

// Genau ein Listener, auch bei erneutem Laden des Moduls (HMR, Tests).
if (typeof window !== 'undefined') {
  if (window.__snsErrorReportsHandler) {
    window.removeEventListener(ERROR_REPORTS_EVENT, window.__snsErrorReportsHandler)
  }
  window.__snsErrorReportsHandler = (e) => {
    if (e.detail === 'granted') startErrorReports()
    else stopErrorReports()
  }
  window.addEventListener(ERROR_REPORTS_EVENT, window.__snsErrorReportsHandler)
}
