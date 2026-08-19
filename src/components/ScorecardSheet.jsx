import { useEffect, useRef, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { getAccessToken, postAuthedFunction } from '../lib/functions'
import { fileExt } from '../lib/format'

// Echte Scorekarte: pro Spieler eigene 18-Loch-Karte, Zähler-Zuweisung,
// Shuffle, Score-Eintrag, Foto-OCR und Digital-Unterschrift.
export default function ScorecardSheet({ match, players, holes, onClose }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || 'de'
  const { user } = useAuth()
  const [markers, setMarkers]     = useState({})
  const [scores,  setScores]      = useState({})
  const [signatures, setSignatures] = useState({})
  const [activeId, setActiveId]   = useState(players?.[0]?.id || null)
  const [shuffling, setShuffling] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [ocrPreview, setOcrPreview] = useState(null) // { uploadId, result }
  const [ocrErr,   setOcrErr]     = useState(null)
  const fileRef = useRef(null)

  const isOwner = match?.tournament?.owner_id === user?.id

  useEffect(() => { loadAll() }, [match?.id])

  async function loadAll() {
    const [{ data: mm }, { data: phs }, { data: ms }] = await Promise.all([
      supabase.from('match_markers').select('player_id, marker_player_id').eq('match_id', match.id),
      supabase.from('player_hole_scores').select('player_id, hole_number, strokes').eq('match_id', match.id),
      supabase.from('match_signatures').select('player_id, role, signed_at').eq('match_id', match.id),
    ])
    const mmap = {}; (mm || []).forEach(r => { mmap[r.player_id] = r.marker_player_id })
    setMarkers(mmap)
    const smap = {}; (phs || []).forEach(r => {
      smap[r.player_id] = smap[r.player_id] || {}
      smap[r.player_id][r.hole_number] = r.strokes
    })
    setScores(smap)
    const sigMap = {}; (ms || []).forEach(r => {
      sigMap[r.player_id] = sigMap[r.player_id] || {}
      sigMap[r.player_id][r.role] = r.signed_at
    })
    setSignatures(sigMap)
  }

  async function shuffleMarkers() {
    if (!isOwner) return
    setShuffling(true)
    try {
      const { error } = await supabase.rpc('shuffle_match_markers', { m_id: match.id })
      if (error) throw error
      await loadAll()
    } catch (e) {
      alert(e.message || t('sheets.scorecard.shuffleFail'))
    } finally { setShuffling(false) }
  }

  async function setMarkerFor(playerId, markerId) {
    if (!isOwner)             return
    if (playerId === markerId) return
    setMarkers(m => ({ ...m, [playerId]: markerId }))
    await supabase.from('match_markers').upsert({
      match_id: match.id, player_id: playerId, marker_player_id: markerId,
    }, { onConflict: 'match_id,player_id' })
  }

  async function setStroke(playerId, holeNum, val) {
    const n = val === '' ? null : parseInt(val, 10)
    if (val !== '' && (!Number.isFinite(n) || n < 1 || n > 20)) return
    setScores(s => ({
      ...s,
      [playerId]: { ...(s[playerId] || {}), [holeNum]: n }
    }))
    const playerLocked = !!signatures[playerId]?.player && !!signatures[playerId]?.marker
    if (playerLocked) return
    if (n == null) {
      await supabase.from('player_hole_scores')
        .delete().eq('match_id', match.id).eq('player_id', playerId).eq('hole_number', holeNum)
    } else {
      await supabase.from('player_hole_scores').upsert({
        match_id: match.id, player_id: playerId, hole_number: holeNum,
        strokes: n, entered_by_user_id: user?.id || null, source: 'manual',
      }, { onConflict: 'match_id,player_id,hole_number' })
    }
  }

  async function signCard(playerId, role) {
    if (!user) { alert(t('sheets.scorecard.mustLogin')); return }
    const { error } = await supabase.from('match_signatures').insert({
      match_id: match.id, player_id: playerId, role,
      signer_user_id: user.id, signer_label: null,
      device_label: navigator?.userAgent?.slice(0, 60) || null,
    })
    if (error) { alert(error.message); return }
    await loadAll()
  }

  async function clearSignature(playerId, role) {
    if (!user) return
    await supabase.from('match_signatures').delete()
      .eq('match_id', match.id).eq('player_id', playerId).eq('role', role)
    await loadAll()
  }

  async function handleOcrUpload(file) {
    if (!file || !user) return
    setUploading(true); setOcrErr(null); setOcrPreview(null)
    try {
      const ext = fileExt(file)
      const path = `${match.id}/${Date.now()}.${ext}`
      const up = await supabase.storage.from('scorecard-photos')
        .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
      if (up.error) throw up.error
      const { data: row, error: insErr } = await supabase.from('scorecard_uploads').insert({
        match_id: match.id,
        uploaded_by_user_id: user.id,
        storage_path: path,
        ocr_status: 'pending',
      }).select('id').single()
      if (insErr) throw insErr

      const jwt = await getAccessToken()
      const res = await postAuthedFunction('scorecard-ocr', jwt, { upload_id: row.id })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'ocr_failed')
      setOcrPreview({ uploadId: row.id, result: j.result })
    } catch (e) {
      setOcrErr(e.message || t('sheets.scorecard.ocrUploadFail'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function applyOcrToPlayer(playerId, ocrPlayer) {
    const upserts = []
    for (const h of ocrPlayer.holes || []) {
      if (h.strokes == null) continue
      const n = parseInt(h.strokes, 10)
      if (!Number.isFinite(n) || n < 1 || n > 20) continue
      upserts.push({
        match_id: match.id, player_id: playerId, hole_number: h.hole,
        strokes: n, entered_by_user_id: user.id, source: 'ocr',
      })
    }
    if (!upserts.length) return
    const { error } = await supabase.from('player_hole_scores').upsert(upserts, {
      onConflict: 'match_id,player_id,hole_number',
    })
    if (error) { alert(error.message); return }
    if (ocrPreview?.uploadId) {
      await supabase.from('scorecard_uploads')
        .update({ applied_at: new Date().toISOString(), applied_by_user_id: user.id })
        .eq('id', ocrPreview.uploadId)
    }
    setOcrPreview(null)
    await loadAll()
  }

  const activePlayer = players.find(p => p.id === activeId)
  const activeMarker = activePlayer && markers[activePlayer.id]
                      ? players.find(p => p.id === markers[activePlayer.id])
                      : null
  const canIWriteForActive = isOwner
    || (activeMarker && activeMarker.profile_id === user?.id)
  const playerLocked = activePlayer
    && !!signatures[activePlayer.id]?.player
    && !!signatures[activePlayer.id]?.marker

  const total = useMemo(() => {
    if (!activePlayer) return { strokes: 0, holes: 0 }
    const row = scores[activePlayer.id] || {}
    let s = 0, n = 0
    for (let i = 1; i <= 18; i++) if (row[i] != null) { s += row[i]; n++ }
    return { strokes: s, holes: n }
  }, [scores, activePlayer])

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-surface w-full max-w-2xl rounded-t-3xl sm:rounded-3xl border border-line max-h-[92vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="px-5 py-4 border-b border-lineSoft flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted">{t('sheets.scorecard.title')}</p>
            <p className="font-condensed font-bold text-xl text-ink truncate">
              {match?.tournament?.name || t('sheets.scorecard.matchFallback')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-inkMuted active:scale-90 transition-transform">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Actions Bar */}
        <div className="px-3 py-2 border-b border-lineSoft flex gap-2 flex-wrap flex-shrink-0">
          {isOwner && (
            <button onClick={shuffleMarkers} disabled={shuffling}
              className="text-[11px] font-bold tracking-wide px-3 py-1.5 rounded-lg bg-accent/15 text-accent border border-accent/40 active:scale-95 transition-transform disabled:opacity-50">
              {t('sheets.scorecard.shuffle')}
            </button>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="text-[11px] font-bold tracking-wide px-3 py-1.5 rounded-lg bg-bg text-ink border border-line active:scale-95 transition-transform disabled:opacity-50">
            {uploading ? t('sheets.scorecard.ocrButtonLoading') : t('sheets.scorecard.ocrButton')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={e => handleOcrUpload(e.target.files?.[0])} />
        </div>

        {ocrErr && <div className="px-5 py-2 text-xs text-danger flex-shrink-0">{ocrErr}</div>}

        {/* OCR-Vorschau */}
        {ocrPreview && (
          <OcrPreviewPanel
            t={t}
            preview={ocrPreview}
            players={players}
            onApply={applyOcrToPlayer}
            onDismiss={() => setOcrPreview(null)}
          />
        )}

        {/* Player Tabs */}
        <div className="flex gap-1 px-3 pt-2 overflow-x-auto flex-shrink-0">
          {players.map(p => {
            const sig = signatures[p.id]
            const locked = sig?.player && sig?.marker
            return (
              <button key={p.id}
                onClick={() => setActiveId(p.id)}
                className={`flex items-center gap-1 px-3 py-2 rounded-t-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeId === p.id
                    ? 'bg-bg text-ink border-t border-x border-line'
                    : 'text-inkMuted hover:text-ink'
                }`}>
                <span>{p.name}</span>
                {locked && <span className="text-accent">✓</span>}
              </button>
            )
          })}
        </div>

        {/* Card */}
        <div className="flex-1 overflow-y-auto px-3 py-3 bg-bg border-t border-line">
          {activePlayer ? (
            <PlayerCard
              t={t}
              lang={lang}
              player={activePlayer}
              players={players}
              holes={holes}
              markerId={markers[activePlayer.id]}
              scores={scores[activePlayer.id] || {}}
              signatures={signatures[activePlayer.id] || {}}
              isOwner={isOwner}
              canWrite={canIWriteForActive && !playerLocked}
              locked={playerLocked}
              total={total}
              onAssignMarker={setMarkerFor}
              onSetStroke={setStroke}
              onSign={signCard}
              onClearSig={clearSignature}
            />
          ) : (
            <div className="text-center py-10 text-inkMuted text-sm">
              {t('sheets.scorecard.emptyPlayers')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PlayerCard({ t, lang, player, players, holes, markerId, scores, signatures, isOwner, canWrite, locked, total, onAssignMarker, onSetStroke, onSign, onClearSig }) {
  const otherPlayers = players.filter(p => p.id !== player.id)
  const markerPlayer = players.find(p => p.id === markerId)
  return (
    <div>
      <div className="mb-3 px-3 py-2 rounded-xl bg-surface border border-line flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold tracking-wider uppercase text-inkMuted">{t('sheets.scorecard.counter')}</p>
          {isOwner ? (
            <select
              value={markerId || ''}
              onChange={e => onAssignMarker(player.id, e.target.value)}
              className="mt-0.5 bg-bg border border-line rounded-md px-2 py-1 text-sm text-ink"
            >
              <option value="">{t('sheets.scorecard.counterChoose')}</option>
              {otherPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <p className="text-sm font-bold text-ink truncate">{markerPlayer?.name || t('sheets.scorecard.counterNone')}</p>
          )}
        </div>
        {locked && (
          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded bg-accent/15 text-accent border border-accent/30">
            {t('sheets.scorecard.signed')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-9 sm:grid-cols-18 gap-1">
        {Array.from({ length: 18 }, (_, i) => {
          const hn = i + 1
          const par = holes?.[i]?.par ?? 4
          const v = scores[hn]
          const diff = v != null ? v - par : null
          let bg = 'bg-surface'
          if (v != null) {
            if (diff <= -2) bg = 'bg-accent/40'
            else if (diff === -1) bg = 'bg-accent/20'
            else if (diff === 0) bg = 'bg-bg'
            else if (diff === 1) bg = 'bg-warn/20'
            else if (diff >= 2) bg = 'bg-danger/20'
          }
          return (
            <div key={hn} className={`rounded-lg p-1 border border-line ${bg} text-center`}>
              <p className="text-[9px] text-inkMuted tabular-nums">{hn}</p>
              <p className="text-[8px] text-inkDim tabular-nums">Par {par}</p>
              <input
                type="number" inputMode="numeric" min="1" max="20"
                disabled={!canWrite}
                value={v ?? ''}
                onChange={e => onSetStroke(player.id, hn, e.target.value)}
                placeholder="–"
                className="mt-1 w-full text-center font-condensed font-black text-base bg-transparent text-ink tabular-nums focus:outline-none disabled:opacity-60"
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-surface border border-line py-2">
          <p className="text-[9px] font-bold tracking-wider uppercase text-inkMuted">{t('sheets.scorecard.total')}</p>
          <p className="font-condensed font-black text-2xl text-ink tabular-nums">{total.strokes || '—'}</p>
        </div>
        <div className="rounded-xl bg-surface border border-line py-2">
          <p className="text-[9px] font-bold tracking-wider uppercase text-inkMuted">{t('sheets.scorecard.played')}</p>
          <p className="font-condensed font-black text-2xl text-ink tabular-nums">{total.holes}/18</p>
        </div>
        <div className="rounded-xl bg-surface border border-line py-2">
          <p className="text-[9px] font-bold tracking-wider uppercase text-inkMuted">{t('sheets.scorecard.avg')}</p>
          <p className="font-condensed font-black text-2xl text-ink tabular-nums">
            {total.holes ? (total.strokes / total.holes).toFixed(1) : '—'}
          </p>
        </div>
      </div>

      {/* Unterschriften */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <SignRow
          t={t}
          lang={lang}
          title={t('sheets.scorecard.playerLabel')}
          subtitle={player.name}
          signedAt={signatures.player}
          onSign={() => onSign(player.id, 'player')}
          onClear={() => onClearSig(player.id, 'player')}
        />
        <SignRow
          t={t}
          lang={lang}
          title={t('sheets.scorecard.markerLabel')}
          subtitle={markerPlayer?.name || t('sheets.scorecard.markerNone')}
          signedAt={signatures.marker}
          onSign={() => onSign(player.id, 'marker')}
          onClear={() => onClearSig(player.id, 'marker')}
        />
      </div>
    </div>
  )
}

function SignRow({ t, lang, title, subtitle, signedAt, onSign, onClear }) {
  return (
    <div className={`px-3 py-3 rounded-xl border ${signedAt ? 'border-accent/40 bg-accent/8' : 'border-line bg-surface'}`}>
      <p className="text-[9px] font-bold tracking-wider uppercase text-inkMuted">{title}</p>
      <p className="text-xs font-bold text-ink truncate mt-0.5">{subtitle}</p>
      {signedAt ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] text-accent font-bold flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            {new Date(signedAt).toLocaleString(lang, { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
          </p>
          <button onClick={onClear}
            className="text-[10px] text-inkDim underline">{t('sheets.scorecard.undo')}</button>
        </div>
      ) : (
        <button onClick={onSign}
          className="mt-2 w-full py-2 rounded-lg text-xs font-bold tracking-wide bg-accent text-brandDark active:scale-95 transition-transform">
          {t('sheets.scorecard.sign')}
        </button>
      )}
    </div>
  )
}

function OcrPreviewPanel({ t, preview, players, onApply, onDismiss }) {
  const result = preview.result || {}
  const ocrPlayers = result.players || []
  const pct = result.confidence != null ? Math.round(result.confidence * 100) : '?'
  return (
    <div className="px-3 py-3 border-b border-line bg-accent/8 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-accent">
          {t('sheets.scorecard.ocrPreviewHeader', { pct })}
        </p>
        <button onClick={onDismiss} className="text-[10px] text-inkDim underline">{t('sheets.scorecard.ocrDismiss')}</button>
      </div>
      {result.notes && <p className="text-[11px] text-inkMuted mb-2 italic">{result.notes}</p>}
      <div className="space-y-2">
        {ocrPlayers.map((op, i) => {
          const sum = (op.holes || []).reduce((s, h) => s + (h.strokes || 0), 0)
          const filled = (op.holes || []).filter(h => h.strokes != null).length
          return (
            <div key={i} className="rounded-lg bg-surface border border-line p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink truncate">{op.name || t('sheets.scorecard.ocrPlayerFallback', { n: i + 1 })}</p>
                  <p className="text-[10px] text-inkMuted">
                    {t('sheets.scorecard.ocrRecognized', { filled, sum: sum || '–' })}
                    {op.handicap != null && ` · HC ${op.handicap}`}
                  </p>
                </div>
                <select
                  defaultValue=""
                  onChange={e => e.target.value && onApply(e.target.value, op)}
                  className="bg-bg border border-line rounded-md px-2 py-1.5 text-xs text-ink">
                  <option value="">{t('sheets.scorecard.ocrApplyPh')}</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )
        })}
        {ocrPlayers.length === 0 && (
          <p className="text-xs text-inkMuted">{t('sheets.scorecard.ocrNoPlayers')}</p>
        )}
      </div>
    </div>
  )
}
