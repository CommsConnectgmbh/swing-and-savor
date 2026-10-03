// Löschen von Scorecard-Fotos (Bucket scorecard-photos) mit Nachweis.
//
// Scorekarten zeigen Namen und Handicaps. Das Foto wird nur für die
// Auswertung gebraucht und muss danach weg. supabase-js wirft bei
// API-Fehlern nicht, sondern liefert { data, error }; deshalb prüft dieser
// Code jedes `error` und bestätigt das Löschen zusätzlich über die Datenbank
// (scorecard_photos_existing). Nur ein bestätigt gelöschtes Foto bekommt
// scorecard_uploads.photo_deleted_at; scheitert das Löschen, bleibt die Spalte
// leer und photo_delete_error hält den Grund fest, damit der geplante Sweep
// (Edge-Function scorecard-photo-sweep, per pg_cron) es erneut versucht.
//
// Bewusst ohne Imports, damit Deno (Edge-Functions) und Vitest dieselbe Datei
// nutzen können.

export const SCORECARD_BUCKET = 'scorecard-photos'

// Ein Aufruf von storage.remove() nimmt höchstens 1000 Pfade.
const REMOVE_CHUNK = 1000

// deno-lint-ignore no-explicit-any
type Svc = any
type Log = (...args: unknown[]) => void

export interface DeleteOutcome {
  deleted: string[]
  failed: string[]
  error: string | null
}

function errText(e: unknown): string {
  if (!e) return 'unknown'
  if (typeof e === 'string') return e
  const m = (e as { message?: unknown }).message
  return typeof m === 'string' && m ? m : String(e)
}

// Löscht die Objekte, bestätigt das Ergebnis und hält es in scorecard_uploads
// fest. Wirft nie; Fehler stehen im Rückgabewert und im Log.
export async function deleteScorecardPhotos(
  svc: Svc,
  paths: string[],
  log: Log = console.error,
): Promise<DeleteOutcome> {
  const unique = [...new Set(paths.filter((p) => typeof p === 'string' && p))]
  if (!unique.length) return { deleted: [], failed: [], error: null }

  let removeError: string | null = null
  for (let i = 0; i < unique.length; i += REMOVE_CHUNK) {
    const chunk = unique.slice(i, i + REMOVE_CHUNK)
    try {
      const { error } = await svc.storage.from(SCORECARD_BUCKET).remove(chunk)
      if (error) removeError = `remove:${errText(error)}`
    } catch (e) {
      removeError = `remove:${errText(e)}`
    }
  }

  // Bestätigung: was steht nach dem Löschen noch in storage.objects?
  let stillThere: Set<string> | null = null
  let verifyError: string | null = null
  try {
    const { data, error } = await svc.rpc('scorecard_photos_existing', { p_paths: unique })
    if (error) verifyError = `verify:${errText(error)}`
    else stillThere = new Set(((data || []) as unknown[]).map((r) =>
      typeof r === 'string' ? r : String((r as Record<string, unknown>)?.scorecard_photos_existing ?? '')))
  } catch (e) {
    verifyError = `verify:${errText(e)}`
  }

  let deleted: string[]
  let failed: string[]
  if (stillThere) {
    deleted = unique.filter((p) => !stillThere!.has(p))
    failed = unique.filter((p) => stillThere!.has(p))
  } else {
    // Ohne Bestätigung gilt nichts als gelöscht; der Sweep prüft erneut.
    deleted = []
    failed = unique
  }
  const error = failed.length ? (removeError || verifyError || 'remove:object_still_present') : null

  if (failed.length) {
    log(`[scorecard-photos] DELETE FAILED for ${failed.length} photo(s): ${error}`, failed)
  }

  if (deleted.length) {
    try {
      const { error: mErr } = await svc.from('scorecard_uploads')
        .update({ photo_deleted_at: new Date().toISOString(), photo_delete_error: null })
        .in('storage_path', deleted)
        .is('photo_deleted_at', null)
      if (mErr) log('[scorecard-photos] could not mark photos as deleted', errText(mErr), deleted)
    } catch (e) {
      log('[scorecard-photos] could not mark photos as deleted', errText(e), deleted)
    }
  }
  if (failed.length) {
    try {
      const { error: fErr } = await svc.from('scorecard_uploads')
        .update({ photo_delete_error: String(error).slice(0, 500) })
        .in('storage_path', failed)
        .is('photo_deleted_at', null)
      if (fErr) log('[scorecard-photos] could not record delete failure', errText(fErr), failed)
    } catch (e) {
      log('[scorecard-photos] could not record delete failure', errText(e), failed)
    }
  }

  return { deleted, failed, error }
}

export interface SweepOptions {
  batchSize?: number
  deadline?: number // Zeitpunkt (ms), ab dem keine neue Seite mehr begonnen wird
  startAfter?: string | null // gespeicherter Keyset-Cursor des letzten Laufs
  now?: () => number
  log?: Log
}

export interface SweepResult {
  scanned: number
  deleted: number
  failed: number
  batches: number
  reconciled: number
  complete: boolean // Ende der Kandidatenliste erreicht
  cursor: string | null // wo der nächste Lauf weitermacht (null = vorne)
  error: string | null
}

// Geht alle Löschkandidaten seitenweise durch (Keyset über den Objektnamen,
// damit dauerhaft fehlschlagende Objekte die Schleife nicht blockieren),
// löscht sie über die Storage-API und gleicht danach scorecard_uploads ab.
export async function sweepScorecardPhotos(svc: Svc, opts: SweepOptions = {}): Promise<SweepResult> {
  const batchSize = opts.batchSize ?? 500
  const log = opts.log ?? console.error
  const now = opts.now ?? Date.now
  const res: SweepResult = {
    scanned: 0, deleted: 0, failed: 0, batches: 0, reconciled: 0,
    complete: false, cursor: null, error: null,
  }

  let after: string | null = opts.startAfter || null
  for (;;) {
    if (opts.deadline && now() > opts.deadline) {
      log('[scorecard-photos] sweep stopped at time budget, continues next run', { after })
      break
    }
    const { data, error }: { data: unknown[] | null; error: unknown } =
      await svc.rpc('scorecard_photo_sweep_candidates', { p_after: after, p_limit: batchSize })
    if (error) {
      res.error = `candidates:${errText(error)}`
      log('[scorecard-photos] sweep could not list candidates', res.error)
      break
    }
    const names: string[] = (data || []).map((r) =>
      typeof r === 'string' ? r : String((r as Record<string, unknown>)?.name ?? ''))
      .filter(Boolean)
    if (!names.length) { res.complete = true; break }

    res.batches++
    res.scanned += names.length
    const out = await deleteScorecardPhotos(svc, names, log)
    res.deleted += out.deleted.length
    res.failed += out.failed.length
    after = names[names.length - 1]
    if (names.length < batchSize) { res.complete = true; break }
  }

  // Zeilen, deren Foto nicht mehr existiert (z. B. vor Einführung von
  // photo_deleted_at gelöscht), als gelöscht markieren.
  try {
    const { data, error } = await svc.rpc('scorecard_photo_reconcile')
    if (error) {
      res.error = res.error || `reconcile:${errText(error)}`
      log('[scorecard-photos] reconcile failed', errText(error))
    } else {
      res.reconciled = Number(data) || 0
    }
  } catch (e) {
    res.error = res.error || `reconcile:${errText(e)}`
    log('[scorecard-photos] reconcile failed', errText(e))
  }

  // Fertig: nächster Lauf beginnt vorne (und versucht Fehlschläge erneut).
  // Sonst dort weitermachen, wo dieser Lauf aufgehört hat, damit vordere
  // Dauerfehler die hinteren Kandidaten nicht für immer verdrängen.
  res.cursor = res.complete ? null : after
  return res
}

export interface ScheduledSweepResult extends SweepResult {
  skipped: boolean // ein anderer Lauf hält die Lease
}

// Ein geplanter Lauf: Lease + gespeicherten Cursor holen, sweepen, Cursor
// speichern und Lease freigeben (scorecard_photo_sweep_begin/_save).
export async function runScheduledSweep(
  svc: Svc,
  opts: Omit<SweepOptions, 'startAfter'> & { leaseSeconds?: number } = {},
): Promise<ScheduledSweepResult> {
  const log = opts.log ?? console.error
  const { data, error }: { data: unknown; error: unknown } =
    await svc.rpc('scorecard_photo_sweep_begin', { p_lease_seconds: opts.leaseSeconds ?? 120 })
  const empty: ScheduledSweepResult = {
    scanned: 0, deleted: 0, failed: 0, batches: 0, reconciled: 0,
    complete: false, cursor: null, error: null, skipped: false,
  }
  if (error) {
    log('[scorecard-photos] sweep could not acquire lease', errText(error))
    return { ...empty, error: `lease:${errText(error)}` }
  }
  const rows = Array.isArray(data) ? data : (data ? [data] : [])
  if (!rows.length) return { ...empty, skipped: true }
  const startAfter = (rows[0] as { cursor_name?: string | null })?.cursor_name ?? null

  const res = await sweepScorecardPhotos(svc, { ...opts, startAfter })
  // Bei Listenfehler den alten Cursor behalten statt vorne neu zu beginnen.
  const saveCursor = res.error && !res.batches ? startAfter : res.cursor
  const { error: saveErr }: { error: unknown } =
    await svc.rpc('scorecard_photo_sweep_save', { p_cursor: saveCursor })
  if (saveErr) {
    log('[scorecard-photos] sweep could not save cursor', errText(saveErr))
    res.error = res.error || `save:${errText(saveErr)}`
  }
  return { ...res, cursor: saveCursor, skipped: false }
}

// Vergleich in konstanter Zeit für das Shared Secret des Cron-Aufrufs.
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0)
  }
  return diff === 0 && a.length > 0
}
