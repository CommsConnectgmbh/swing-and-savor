// scorecard-ocr — nimmt eine hochgeladene Scorekarte (Foto), schickt sie an
// OpenAI Vision (gpt-4o-mini) und gibt strukturierte Hole-Scores zurück.
// Body: { upload_id }  →  { players: [{ name, holes:[{ hole, strokes }] }] }
//
// Datensparsamkeit: Das Foto wird nur für die Auswertung gebraucht. Es wird
// direkt danach aus dem Bucket gelöscht, auch wenn die Auswertung scheitert.
// Erst ein bestätigtes Löschen setzt scorecard_uploads.photo_deleted_at;
// schlägt es fehl, wird das laut geloggt und in photo_delete_error vermerkt.
// Liegengebliebene Fotos (Abbruch zwischen Upload und Aufruf, gescheitertes
// Löschen) räumt die geplante Edge-Function scorecard-photo-sweep ab.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { deleteScorecardPhotos } from '../_shared/scorecardPhotos.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function j(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...CORS, ...(init.headers || {}) },
  })
}

const SYS_PROMPT = `Du erhältst ein Foto einer Golf-Scorekarte (analog, handschriftlich oder gedruckt).
Lies pro Spieler die Schläge pro Loch (Strokes) sauber aus.
Gib ausschließlich JSON in diesem Schema zurück:
{
  "course_name": string|null,
  "date": string|null,
  "players": [
    { "name": string, "handicap": number|null,
      "holes": [ { "hole": 1..18, "strokes": number|null } ],
      "total": number|null
    }
  ],
  "confidence": 0..1,
  "notes": string|null
}
Regeln:
- holes hat genau 18 Einträge (1–18); fehlende = strokes:null.
- Bei nicht eindeutiger Erkennung lieber null statt raten.
- Antworten OHNE Markdown-Codefences, reines JSON.`

const BUCKET = 'scorecard-photos'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST')    return j({ error: 'method_not_allowed' }, { status: 405 })

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) return j({ error: 'ocr_not_configured' }, { status: 500 })

  const auth = req.headers.get('Authorization') || ''
  const userJwt = auth.replace(/^Bearer\s+/i, '')
  if (!userJwt) return j({ error: 'unauthorized' }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* */ }
  const uploadId = body.upload_id
  if (!uploadId) return j({ error: 'upload_id_required' }, { status: 400 })

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${userJwt}` } }, auth: { persistSession: false } },
  )
  const { data: userData, error: uErr } = await supabaseUser.auth.getUser()
  if (uErr || !userData?.user) return j({ error: 'unauthorized' }, { status: 401 })

  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: upload, error: upErr } = await svc.from('scorecard_uploads')
    .select('id, match_id, storage_path, ocr_status, uploaded_by_user_id').eq('id', uploadId).maybeSingle()
  if (upErr || !upload) return j({ error: 'upload_not_found' }, { status: 404 })
  // Nur wer das Foto hochgeladen hat, darf es auswerten lassen. Maßgeblich ist
  // der Besitzer des Storage-Objekts (nicht die vom Nutzer angelegte Zeile),
  // und der Pfad muss zum Match der Zeile passen.
  if (upload.uploaded_by_user_id !== userData.user.id) return j({ error: 'forbidden' }, { status: 403 })
  // Bereits ausgewertet: Ergebnis zurückgeben. Das Foto ist zu diesem Zeitpunkt
  // gelöscht, die Besitzerprüfung über storage.objects ginge daher ins Leere.
  if (upload.ocr_status === 'done') {
    const { data: full, error: fullErr } = await svc.from('scorecard_uploads')
      .select('ocr_result').eq('id', uploadId).maybeSingle()
    if (fullErr) return j({ error: 'result_unavailable' }, { status: 500 })
    return j({ ok: true, cached: true, result: full?.ocr_result })
  }
  if (typeof upload.storage_path !== 'string' || !upload.storage_path.startsWith(`${upload.match_id}/`)) {
    return j({ error: 'forbidden' }, { status: 403 })
  }
  const { data: photoOwner, error: ownErr } = await svc.rpc('scorecard_photo_owner', { p_path: upload.storage_path })
  if (ownErr || photoOwner !== userData.user.id) return j({ error: 'forbidden' }, { status: 403 })

  await svc.from('scorecard_uploads').update({ ocr_status: 'processing' }).eq('id', uploadId)
  // Wirft nie; prüft jedes Storage-Ergebnis, loggt Fehlschläge und hält sie in
  // scorecard_uploads fest (photo_deleted_at nur bei bestätigtem Löschen).
  const deletePhoto = () => deleteScorecardPhotos(svc, [upload.storage_path])

  // signierte URL für das Bild
  const { data: signed, error: sErr } = await svc.storage
    .from(BUCKET).createSignedUrl(upload.storage_path, 300)
  if (sErr || !signed?.signedUrl) {
    await svc.from('scorecard_uploads').update({ ocr_status: 'failed', ocr_error: 'signed_url_failed' }).eq('id', uploadId)
    await deletePhoto()
    return j({ error: 'signed_url_failed' }, { status: 500 })
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.0,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: SYS_PROMPT },
          { role: 'user', content: [
              { type: 'text', text: 'Bitte parse diese Scorekarte. Wenn unklar: lieber null.' },
              { type: 'image_url', image_url: { url: signed.signedUrl, detail: 'high' } },
            ],
          },
        ],
      }),
    })
    if (!resp.ok) {
      const text = await resp.text()
      await svc.from('scorecard_uploads').update({
        ocr_status: 'failed', ocr_error: `openai:${resp.status}:${text.slice(0,300)}`,
      }).eq('id', uploadId)
      return j({ error: 'openai_failed', status: resp.status }, { status: 502 })
    }
    const data = await resp.json()
    const raw  = data?.choices?.[0]?.message?.content || '{}'
    let parsed: any
    try { parsed = JSON.parse(raw) }
    catch {
      await svc.from('scorecard_uploads').update({
        ocr_status: 'failed', ocr_error: 'json_parse_failed', ocr_result: { raw },
      }).eq('id', uploadId)
      return j({ error: 'json_parse_failed', raw }, { status: 502 })
    }

    await svc.from('scorecard_uploads').update({
      ocr_status: 'done', ocr_result: parsed,
    }).eq('id', uploadId)
    return j({ ok: true, result: parsed })
  } catch (e: any) {
    await svc.from('scorecard_uploads').update({
      ocr_status: 'failed', ocr_error: String(e?.message || e),
    }).eq('id', uploadId)
    return j({ error: 'ocr_exception', message: String(e?.message || e) }, { status: 500 })
  } finally {
    // OpenAI hat das Bild über die signierte URL bereits geladen.
    await deletePhoto()
  }
})
