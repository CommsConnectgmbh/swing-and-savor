// scorecard-photo-sweep — räumt den privaten Bucket scorecard-photos auf.
//
// Wird stündlich von pg_cron über public.call_scorecard_photo_sweep() (pg_net)
// aufgerufen, unabhängig davon, ob jemand die Auswertung benutzt. Löscht über
// die Storage-API (nie per SQL auf storage.objects) alle Fotos, die älter als
// 24 Stunden sind oder deren Auswertung abgeschlossen ist (done/failed), und
// geht dabei alle Seiten durch. Gelöscht gilt nur, was danach nachweislich
// nicht mehr in storage.objects steht (siehe _shared/scorecardPhotos.ts).
//
// Auth: kein Nutzer-JWT (deploy mit --no-verify-jwt), sondern Shared Secret im
// Header x-sweep-secret; Gegenstück ist private_config.scorecard_sweep_secret.
// Secrets: SCORECARD_SWEEP_SECRET, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { safeEqual, sweepScorecardPhotos } from '../_shared/scorecardPhotos.ts'

// Edge-Functions haben ein begrenztes Laufzeitfenster; was nicht fertig wird,
// erledigt der nächste Lauf.
const TIME_BUDGET_MS = 45_000

function j(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return j({ error: 'method_not_allowed' }, 405)

  const secret = Deno.env.get('SCORECARD_SWEEP_SECRET') || ''
  if (!secret) {
    console.error('[scorecard-photo-sweep] SCORECARD_SWEEP_SECRET not configured')
    return j({ error: 'not_configured' }, 500)
  }
  if (!safeEqual(req.headers.get('x-sweep-secret') || '', secret)) {
    return j({ error: 'unauthorized' }, 401)
  }

  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const result = await sweepScorecardPhotos(svc, { deadline: Date.now() + TIME_BUDGET_MS })
  const line = `[scorecard-photo-sweep] scanned=${result.scanned} deleted=${result.deleted} ` +
    `failed=${result.failed} reconciled=${result.reconciled} complete=${result.complete}`
  if (result.failed || result.error) console.error(line, result.error || '')
  else console.log(line)

  return j({ ok: !result.error && !result.failed, ...result }, result.error ? 500 : 200)
})
