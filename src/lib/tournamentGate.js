import { supabase } from './supabase'
import { sessionStore } from './storage'

// Liefert true, wenn das Turnier ein Schreib-/Sicht-Passwort besitzt.
// Liest NUR das boolesche Schatten-Flag (has_edit_password); das Klartext-
// Passwort verlässt die DB nie mehr (Spalten-SELECT serverseitig revoked).
export function hasPassword(t) {
  return !!(t?.has_edit_password)
}

// Lokaler Unlock-State pro Turnier (sessionStorage). Wird erst nach
// erfolgreicher serverseitiger Prüfung gesetzt.
export function isUnlocked(t) {
  if (!hasPassword(t)) return true
  return sessionStore.get(`golf_unlocked_${t.id}`) === '1'
}

export function markUnlocked(tournamentId) {
  sessionStore.set(`golf_unlocked_${tournamentId}`, '1')
}

// Serverseitige Passwort-Prüfung via security-definer RPC. Gibt boolean.
export async function verifyPassword(tournamentId, pw) {
  const { data, error } = await supabase.rpc('verify_tournament_password', {
    t_id: tournamentId, pw,
  })
  if (error) { console.error('[gate] verify failed', error); return false }
  return data === true
}
