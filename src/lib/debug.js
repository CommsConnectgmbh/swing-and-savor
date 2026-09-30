// Lightweight client-side telemetry: posts structured events to the
// `client_debug` table via PostgREST so we can diagnose reload-loop bugs
// from the server side. Sessions are tagged with a stable per-tab id.

import { readLocal, writeLocal } from './storage'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const sessionId = (() => {
  try {
    const k = 'sns_debug_sid'
    let v = sessionStorage.getItem(k)
    if (!v) {
      v = Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36)
      sessionStorage.setItem(k, v)
    }
    return v
  } catch {
    return 'no-storage-' + Date.now().toString(36)
  }
})()

export function getDebugSessionId() {
  return sessionId
}

// Debug-UI (User-ID, Diag-Session, Hard-Reset) nur zeigen, wenn explizit angefordert:
// URL `?debug` oder localStorage `sns_debug=1`. Im Normalbetrieb sieht der Kunde
// keine technischen Diagnose-Elemente. Einmal `?debug` merkt sich die Aktivierung.
export function isDebug() {
  try {
    if (typeof window === 'undefined') return false
    if (new URLSearchParams(window.location.search).has('debug')) {
      writeLocal('sns_debug', '1')
      return true
    }
    return readLocal('sns_debug') === '1'
  } catch {
    return false
  }
}

// Telemetrie nur in Entwicklung — in Produktion komplett aus, damit die
// (jetzt auth-gebundene) client_debug-Senke nicht im Normalbetrieb beschrieben
// wird. Per VITE_DEBUG_TELEMETRY=1 explizit aktivierbar.
const TELEMETRY_ON = import.meta.env.DEV || import.meta.env.VITE_DEBUG_TELEMETRY === '1'

export function logDebug(event, payload = {}, userId = null) {
  if (!TELEMETRY_ON) return
  try {
    if (!SUPABASE_URL || !ANON_KEY) return
    const body = JSON.stringify({
      session_id: sessionId,
      user_id: userId,
      event,
      payload,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    // Fire-and-forget; never await, never throw into caller.
    fetch(`${SUPABASE_URL}/rest/v1/client_debug`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // never let telemetry break the app
  }
}
