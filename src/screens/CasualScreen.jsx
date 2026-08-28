import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { strokesPerHole, calcCasualMatchStanding, casualGrossStanding, casualHoleResults, sumPars } from '../lib/scoring'
import { renderCasualShareCard, shareOrDownload } from '../lib/shareCard'
import HoleByHoleTable from '../components/HoleByHoleTable'
import LoadingSpinner from '../components/LoadingSpinner'
import CoursePicker from '../components/CoursePicker'
import ConfirmDialog from '../components/ConfirmDialog'
import { fetchFriendProfiles } from '../lib/friendships'

// ─── Helpers ────────────────────────────────────────────────────────────────
const HOLES = Array.from({ length: 18 }, (_, i) => i + 1)

function emptySlot() {
  return { profile_id: null, display_name: '', handicap: 0 }
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" className="text-inkDim flex-shrink-0">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

// ─── Friend Picker Sheet ────────────────────────────────────────────────────
function FriendPickerSheet({ excludeIds, onPick, onClose }) {
  const { user } = useAuth()
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    document.body.classList.add('sheet-open')
    return () => document.body.classList.remove('sheet-open')
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const profs = await fetchFriendProfiles(user.id)
      if (!cancelled) {
        setFriends(profs)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user.id])

  const filtered = query.trim()
    ? friends.filter(f =>
        f.display_name.toLowerCase().includes(query.toLowerCase()) ||
        f.handle.toLowerCase().includes(query.toLowerCase()))
    : friends

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center" role="dialog" aria-modal="true">
      <div onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-t-3xl bg-surface border-t border-line shadow-lift"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <div className="pt-2.5 pb-3 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-line" />
        </div>
        <p className="px-5 text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">
          Freund hinzufügen
        </p>

        <div className="px-3 pt-2">
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Suchen…" autoFocus
            className="w-full bg-bg border border-line rounded-xl px-4 py-2.5 text-ink text-sm focus:border-accent/60" />
        </div>

        <div className="px-3 pt-2 pb-1 overflow-y-auto flex-1">
          {loading ? <div className="py-8 flex justify-center"><LoadingSpinner /></div> :
           filtered.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <p className="text-sm text-inkMuted">
                {friends.length === 0 ? 'Noch keine Freunde verknüpft.' : 'Keine Treffer.'}
              </p>
            </div>
           ) : filtered.map(f => {
            const taken = excludeIds.includes(f.id)
            return (
              <button key={f.id} disabled={taken}
                onClick={() => { onPick(f); onClose() }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl active:bg-bg/60 transition-colors disabled:opacity-30">
                <div className="w-9 h-9 rounded-full bg-bg border border-line flex items-center justify-center overflow-hidden flex-shrink-0">
                  {f.avatar_url
                    ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xs font-bold text-inkMuted">
                        {f.display_name.slice(0, 2).toUpperCase()}
                      </span>}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-sm text-ink truncate">{f.display_name}</p>
                  <p className="text-[11px] text-inkMuted truncate">
                    @{f.handle}{f.hcp != null && ` · HC ${Number(f.hcp).toFixed(1)}`}
                  </p>
                </div>
                {taken && <span className="text-[10px] uppercase tracking-wider text-inkDim">drin</span>}
              </button>
            )
          })}
        </div>

        <button onClick={onClose}
          className="block mx-3 mt-2 w-[calc(100%-1.5rem)] py-3 rounded-2xl text-sm font-bold bg-bg text-inkMuted border border-line">
          Schließen
        </button>
      </div>
    </div>
  )
}

// ─── Guest Player Sheet ────────────────────────────────────────────────────
function GuestSheet({ onAdd, onClose }) {
  const [name, setName] = useState('')
  const [hcp, setHcp] = useState('')

  useEffect(() => {
    document.body.classList.add('sheet-open')
    return () => document.body.classList.remove('sheet-open')
  }, [])

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    const h = parseFloat(String(hcp).replace(',', '.'))
    onAdd({
      profile_id: null,
      display_name: name.trim().slice(0, 40),
      handicap: Number.isFinite(h) && h >= 0 && h <= 54 ? h : 0,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center" role="dialog" aria-modal="true">
      <div onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-lg rounded-t-3xl bg-surface border-t border-line shadow-lift"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <div className="pt-2.5 pb-3 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-line" />
        </div>
        <p className="px-5 text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">
          Mitspieler ohne Account
        </p>
        <form onSubmit={submit} className="px-5 pt-3 pb-2 flex flex-col gap-3">
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Name" autoFocus maxLength={40}
            className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink text-sm focus:border-accent/60" />
          <input value={hcp} onChange={e => setHcp(e.target.value)}
            placeholder="Handicap (optional)" inputMode="decimal"
            className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink text-sm focus:border-accent/60" />
          <button type="submit" disabled={!name.trim()}
            className="py-3 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-40">
            Hinzufügen
          </button>
          <button type="button" onClick={onClose}
            className="py-2.5 rounded-xl text-sm text-inkMuted bg-bg border border-line">
            Abbrechen
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Course-Setup Sheet (Par + SI pro Loch nachtragen) ─────────────────────
function CourseSetupSheet({ initialPars, initialHcps, onSave, onClose }) {
  const [pars, setPars] = useState(() => {
    const a = Array.isArray(initialPars) && initialPars.length === 18 ? [...initialPars] : Array(18).fill(4)
    return a.map(p => Number.isFinite(p) && p > 0 ? p : 4)
  })
  const [hcps, setHcps] = useState(() => {
    const a = Array.isArray(initialHcps) && initialHcps.length === 18 ? [...initialHcps] : null
    if (a && a.every(v => Number.isFinite(v) && v >= 1 && v <= 18)) return a
    return Array.from({ length: 18 }, (_, i) => i + 1)
  })

  useEffect(() => {
    document.body.classList.add('sheet-open')
    return () => document.body.classList.remove('sheet-open')
  }, [])

  function setPar(i, v) {
    const n = parseInt(v, 10)
    setPars(arr => arr.map((p, idx) => idx === i ? (Number.isFinite(n) && n >= 3 && n <= 6 ? n : p) : p))
  }
  function setHcp(i, v) {
    const n = parseInt(v, 10)
    setHcps(arr => arr.map((h, idx) => idx === i ? (Number.isFinite(n) && n >= 1 && n <= 18 ? n : h) : h))
  }

  const totalPar = sumPars(pars)
  const hcpsValid = (() => {
    const set = new Set(hcps)
    return set.size === 18 && [...set].every(v => v >= 1 && v <= 18)
  })()

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center" role="dialog" aria-modal="true">
      <div onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-lg max-h-[88vh] flex flex-col rounded-t-3xl bg-surface border-t border-line shadow-lift"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <div className="pt-2.5 pb-3 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-line" />
        </div>
        <div className="px-5 pb-1 flex items-baseline justify-between">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">Loch-Setup</p>
          <p className="text-[11px] text-inkMuted tabular-nums">Par {totalPar}</p>
        </div>
        <p className="px-5 pb-2 text-[11px] text-inkDim leading-snug">
          Par pro Loch (3–6) und Vorgabe-Rang/SI (1 = schwerstes, 18 = leichtestes).
          Wird für Live-Stand und Pro-Loch-Vorgabe genutzt.
        </p>

        <div className="px-3 pt-2 pb-1 overflow-y-auto flex-1">
          <table className="w-full" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-inkDim">
                <th className="text-left py-1 pl-2">Loch</th>
                <th className="text-center py-1 w-20">Par</th>
                <th className="text-center py-1 w-20">SI</th>
              </tr>
            </thead>
            <tbody>
              {HOLES.map((h, i) => (
                <tr key={h} className="border-t border-lineSoft">
                  <td className="py-1.5 pl-2 text-sm text-ink tabular-nums">{h}</td>
                  <td className="py-1.5 text-center">
                    <input type="number" inputMode="numeric" min={3} max={6} value={pars[i]}
                      onChange={e => setPar(i, e.target.value)}
                      className="w-14 h-9 text-center bg-bg border border-line rounded-lg text-ink text-sm focus:border-accent/60 tabular-nums" />
                  </td>
                  <td className="py-1.5 text-center">
                    <input type="number" inputMode="numeric" min={1} max={18} value={hcps[i]}
                      onChange={e => setHcp(i, e.target.value)}
                      className={`w-14 h-9 text-center bg-bg border rounded-lg text-sm focus:border-accent/60 tabular-nums ${
                        hcpsValid ? 'border-line text-ink' : 'border-danger/60 text-ink'
                      }`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!hcpsValid && (
            <p className="px-2 py-2 text-[11px] text-danger">
              SI muss jede Zahl 1–18 genau einmal enthalten.
            </p>
          )}
        </div>

        <div className="px-3 pt-2 grid grid-cols-2 gap-2">
          <button onClick={onClose}
            className="py-3 rounded-xl text-sm font-bold bg-bg text-inkMuted border border-line">
            Abbrechen
          </button>
          <button onClick={() => onSave({ pars, hcps })} disabled={!hcpsValid}
            className="py-3 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-40">
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Score Cell ─────────────────────────────────────────────────────────────
function ScoreCell({ value, par, onChange, disabled }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function open() {
    if (disabled) return
    setDraft(value != null ? String(value) : '')
    setEditing(true)
  }
  function commit() {
    const n = parseInt(draft, 10)
    if (Number.isFinite(n) && n >= 1 && n <= 30) onChange(n)
    else if (draft === '') onChange(null)
    setEditing(false)
  }

  // Relative-to-par tint
  let tint = 'text-ink'
  if (value != null && par > 0) {
    const d = value - par
    if (d <= -2) tint = 'text-accent'
    else if (d === -1) tint = 'text-course'
    else if (d === 0) tint = 'text-ink'
    else if (d === 1) tint = 'text-inkMuted'
    else tint = 'text-danger'
  } else if (value == null) {
    tint = 'text-inkDim'
  }

  if (editing) {
    return (
      <input type="number" inputMode="numeric" min={1} max={30} autoFocus
        value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-12 h-10 text-center text-base font-bold tabular-nums bg-bg border border-accent rounded-lg text-ink focus:outline-none" />
    )
  }

  return (
    <button type="button" onClick={open} disabled={disabled}
      className={`w-12 h-10 rounded-lg border text-base font-bold tabular-nums active:scale-95 transition-transform ${tint} ${
        value != null ? 'bg-bg border-line' : 'bg-transparent border-dashed border-line'
      } ${disabled ? 'opacity-60' : ''}`}>
      {value != null ? value : '—'}
    </button>
  )
}

// Antippbare Par-Zelle (3–6) — Par direkt in der Scorecard ändern.
function ParCell({ value, onChange, disabled }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function open() {
    if (disabled) return
    setDraft(value ? String(value) : '')
    setEditing(true)
  }
  function commit() {
    const n = parseInt(draft, 10)
    if (Number.isFinite(n) && n >= 3 && n <= 6) onChange(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <input type="number" inputMode="numeric" min={3} max={6} autoFocus
        value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-10 h-7 text-center text-[11px] font-bold tabular-nums bg-bg border border-accent rounded text-ink focus:outline-none" />
    )
  }
  if (disabled) {
    return <span className="text-[10px] text-inkMuted tabular-nums">{value || '—'}</span>
  }
  return (
    <button type="button" onClick={open}
      className="w-10 h-7 rounded text-[11px] font-bold tabular-nums text-inkMuted border border-dashed border-line active:scale-95 transition-transform">
      {value || '—'}
    </button>
  )
}

// ─── Live-Stand (groß über der Scorecard) ──────────────────────────────────
function LiveStanding({ round, playersList, scores }) {
  const pars = round.hole_pars?.length === 18 ? round.hole_pars : null
  const hcps = round.hole_handicaps?.length === 18 ? round.hole_handicaps : null
  const totalPar = sumPars(pars)

  const rows = playersList.map(p => {
    const own = scores.filter(s => s.player_idx === p.idx)
    const played = own.length
    const total = own.reduce((sum, s) => sum + s.strokes, 0)
    const playerStrokes = strokesPerHole(p.handicap, hcps)
    const playerAdd = own.reduce((sum, s) => sum + (playerStrokes[s.hole_number - 1] || 0), 0)
    const grossDiff = pars
      ? own.reduce((d, s) => d + (s.strokes - (pars[s.hole_number - 1] || 0)), 0)
      : null
    const netDiff = grossDiff != null ? grossDiff - playerAdd : null
    return { p, played, total, grossDiff, netDiff, hasHcp: p.handicap > 0 }
  })

  // Match-Play nur bei genau 2 Spielern. Brutto immer; Netto zusätzlich
  // wenn SI vorhanden und mind. ein Spieler HCP > 0.
  const matchPlay = (() => {
    if (playersList.length !== 2) return null
    const a = playersList[0], b = playersList[1]
    const byHole = {}
    for (const s of scores) {
      if (!byHole[s.hole_number]) byHole[s.hole_number] = {}
      byHole[s.hole_number][s.player_idx === a.idx ? 'a' : 'b'] = s.strokes
    }
    const zero = Array(18).fill(0)
    const gross = calcCasualMatchStanding(byHole, zero, zero)
    const showNet = hcps && (Number(a.handicap) > 0 || Number(b.handicap) > 0)
    const net = showNet ? calcCasualMatchStanding(byHole,
      strokesPerHole(a.handicap, hcps),
      strokesPerHole(b.handicap, hcps)) : null
    return { a, b, gross, net }
  })()

  if (rows.every(r => r.played === 0)) return null

  return (
    <div className="rounded-card bg-surface border border-line overflow-hidden mb-3">
      <div className="px-3 py-2 flex items-baseline justify-between">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">Stand</p>
        <p className="text-[10px] tabular-nums text-inkDim">
          {Math.max(...rows.map(r => r.played))}/18
          {totalPar > 0 && ` · Par ${totalPar}`}
        </p>
      </div>
      <div className="divide-y divide-lineSoft">
        {rows.map(r => (
          <div key={r.p.idx} className="px-3 py-2 flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {r.p.idx}
            </span>
            <span className="flex-1 font-semibold text-sm text-ink truncate">{r.p.display_name}</span>
            <div className="text-right tabular-nums">
              <p className="text-2xl font-display font-bold text-ink leading-none">
                {r.played > 0 ? r.total : '—'}
              </p>
              {r.played > 0 && r.grossDiff != null && (
                <p className="text-[11px] text-inkMuted mt-0.5">
                  <span className={r.grossDiff > 0 ? 'text-danger' : r.grossDiff < 0 ? 'text-course' : 'text-inkMuted'}>
                    Brutto {r.grossDiff === 0 ? 'E' : r.grossDiff > 0 ? `+${r.grossDiff}` : r.grossDiff}
                  </span>
                  {r.hasHcp && r.netDiff != null && (
                    <>
                      {' · '}
                      <span className={r.netDiff > 0 ? 'text-danger' : r.netDiff < 0 ? 'text-course' : 'text-inkMuted'}>
                        Netto {r.netDiff === 0 ? 'E' : r.netDiff > 0 ? `+${r.netDiff}` : r.netDiff}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {matchPlay && matchPlay.gross.played > 0 && (() => {
        const isFinished = round.status === 'finished' || matchPlay.gross.played === 18
        function renderLine(s, label) {
          const winnerName = s.leader === 'A' ? matchPlay.a.display_name
                           : s.leader === 'B' ? matchPlay.b.display_name : null
          return (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted w-12 flex-shrink-0">
                  {label}
                </span>
                <span className="text-sm font-semibold text-ink truncate">
                  {winnerName ? `${winnerName} ${isFinished ? 'gewinnt' : 'führt'}` : 'All Square'}
                </span>
                {s.leader !== 'AS' && (
                  <span className="px-2 py-0.5 rounded-md bg-accent/20 text-accent text-[11px] font-bold tracking-wider flex-shrink-0">
                    {s.label}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-inkMuted tabular-nums flex-shrink-0">
                {s.upA}–{s.upB}–{s.halved}
              </p>
            </div>
          )
        }
        return (
          <div className="px-3 py-2 border-t border-line bg-bg/40">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">Lochspiel</p>
              <p className="text-[11px] tabular-nums text-inkDim">
                {matchPlay.gross.played}/18
                {matchPlay.gross.remaining > 0 ? ` · ${matchPlay.gross.remaining} offen` : ''}
              </p>
            </div>
            <div className="mt-1.5 space-y-1.5">
              {renderLine(matchPlay.gross, matchPlay.net ? 'Brutto' : '')}
              {matchPlay.net && renderLine(matchPlay.net, 'Netto')}
            </div>
            <p className="mt-1.5 text-[10px] text-inkDim tabular-nums">
              {matchPlay.a.display_name.split(' ')[0]} ↑ – {matchPlay.b.display_name.split(' ')[0]} ↑ – halbiert
            </p>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Scorecard ──────────────────────────────────────────────────────────────
function Scorecard({ round, playersList, scores, isOwner, onScoreChange, onParChange }) {
  const pars = round.hole_pars?.length === 18 ? round.hole_pars : Array(18).fill(0)
  const hcps = round.hole_handicaps?.length === 18 ? round.hole_handicaps : null
  const totalPar = sumPars(pars)
  const hasPars = pars.some(x => x > 0)

  function strokesFor(playerIdx, hole) {
    const r = scores.find(s => s.player_idx === playerIdx && s.hole_number === hole)
    return r ? r.strokes : null
  }
  function totalFor(playerIdx) {
    return scores.filter(s => s.player_idx === playerIdx)
      .reduce((sum, s) => sum + s.strokes, 0)
  }
  function countFor(playerIdx) {
    return scores.filter(s => s.player_idx === playerIdx).length
  }

  return (
    <div className="rounded-card bg-surface border border-line overflow-hidden">
      {playersList.map(p => {
        const total = totalFor(p.idx)
        const played = countFor(p.idx)
        const diff = totalPar > 0 && played > 0
          ? scores.filter(s => s.player_idx === p.idx)
              .reduce((d, s) => d + (s.strokes - (pars[s.hole_number - 1] || 0)), 0)
          : null
        const playerStrokes = strokesPerHole(p.handicap, hcps)
        const hasVorgabe = hcps && p.handicap > 0
        return (
          <div key={p.idx} className="border-b border-lineSoft last:border-b-0">
            <div className="px-3 py-2 flex items-center justify-between bg-bg/40">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center">
                  {p.idx}
                </span>
                <span className="font-semibold text-sm text-ink truncate">{p.display_name}</span>
                <span className="text-[11px] text-inkMuted tabular-nums">
                  HC {Number(p.handicap).toFixed(1)}
                </span>
              </div>
              <div className="text-right tabular-nums">
                <p className="text-lg font-display font-bold text-ink leading-none">
                  {total > 0 ? total : '—'}
                </p>
                {diff != null && played > 0 && (
                  <p className="text-[10px] tracking-wider text-inkMuted mt-0.5">
                    {played}/18 · {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
                  </p>
                )}
              </div>
            </div>

            <div className="px-2 py-2 overflow-x-auto">
              <table className="border-separate" style={{ borderSpacing: '4px' }}>
                <tbody>
                  <tr>
                    <td className="text-[10px] text-inkDim uppercase tracking-wider pr-2 w-12">Loch</td>
                    {HOLES.map(h => (
                      <td key={h} className="w-12 text-center text-[10px] text-inkDim tabular-nums">
                        {h}
                      </td>
                    ))}
                  </tr>
                  {(hasPars || (isOwner && onParChange)) && (
                    <tr>
                      <td className="text-[10px] text-inkDim uppercase tracking-wider pr-2 w-12">Par</td>
                      {HOLES.map(h => (
                        <td key={h} className="w-12 text-center text-[10px] text-inkMuted tabular-nums">
                          {isOwner && onParChange
                            ? <ParCell value={pars[h - 1] || 0} onChange={(v) => onParChange(h, v)} />
                            : (pars[h - 1] || '—')}
                        </td>
                      ))}
                    </tr>
                  )}
                  {hcps && (
                    <tr>
                      <td className="text-[10px] text-inkDim uppercase tracking-wider pr-2 w-12">SI</td>
                      {HOLES.map(h => (
                        <td key={h} className="w-12 text-center text-[10px] text-inkDim tabular-nums">
                          {hcps[h - 1] || '—'}
                        </td>
                      ))}
                    </tr>
                  )}
                  {hasVorgabe && (
                    <tr>
                      <td className="text-[10px] text-accent uppercase tracking-wider pr-2 w-12">Vor</td>
                      {HOLES.map(h => {
                        const add = playerStrokes[h - 1]
                        return (
                          <td key={h} className="w-12 text-center text-[10px] tabular-nums">
                            {add > 0 ? (
                              <span className="text-accent">
                                {add === 1 ? '•' : add === 2 ? '••' : add === 3 ? '•••' : `${add}×`}
                              </span>
                            ) : <span className="text-inkDim">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )}
                  <tr>
                    <td className="text-[10px] text-inkDim uppercase tracking-wider pr-2 w-12">Score</td>
                    {HOLES.map(h => (
                      <td key={h} className="w-12">
                        <ScoreCell
                          value={strokesFor(p.idx, h)}
                          par={pars[h - 1] || 0}
                          onChange={(v) => onScoreChange(p.idx, h, v)}
                          disabled={!isOwner && p.profile_id !== (window.__caUid__ || null)}
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Spielerfarben für die Lochspiel-Tabelle (Spieler 1 blau, Spieler 2 orange).
const CAS_A = '#9BB5C9'
const CAS_B = '#D9A38E'

// ─── Main Screen ────────────────────────────────────────────────────────────
export default function CasualScreen() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { roundId: roundIdParam } = useParams()
  const { user, profile } = useAuth()
  if (typeof window !== 'undefined') window.__caUid__ = user?.id || null

  const [view, setView] = useState('list') // 'list' | 'create' | 'detail'
  const [loading, setLoading] = useState(true)
  const [rounds, setRounds] = useState([])
  const [active, setActive] = useState(null)
  const [players, setPlayers] = useState([])
  const [scores, setScores] = useState([])

  // Create-Form
  const [form, setForm] = useState({
    name: '',
    course: null,
    slots: [], // ordered list of {profile_id, display_name, handicap}
  })
  const [showCoursePicker, setShowCoursePicker] = useState(false)
  const [showFriendPicker, setShowFriendPicker] = useState(false)
  const [showGuestSheet, setShowGuestSheet] = useState(false)
  const [showSetupSheet, setShowSetupSheet] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const chRef = useRef(null)

  // Initial-Load: vom Plus-FAB ?new=1 → direkt zum Form
  useEffect(() => {
    if (!user) return
    loadRounds()
  }, [user?.id])

  useEffect(() => {
    if (searchParams.get('new') === '1' && view === 'list') {
      setSearchParams({}, { replace: true })
      openCreate()
    }
  }, [searchParams, view])

  // Deeplink: /casual/:roundId direkt in den Detail-View
  useEffect(() => {
    if (!user || !roundIdParam) return
    if (active?.id === roundIdParam) return
    let cancelled = false
    async function load() {
      const { data: r } = await supabase.from('casual_rounds').select('*').eq('id', roundIdParam).maybeSingle()
      if (cancelled || !r) return
      setActive(r)
      setView('detail')
      await loadDetail(r.id)
      subscribeRealtime(r.id)
    }
    load()
    return () => { cancelled = true }
  }, [user?.id, roundIdParam])

  async function loadRounds() {
    setLoading(true)
    const { data } = await supabase.from('casual_rounds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setRounds(data || [])
    setLoading(false)
  }

  function openCreate() {
    // Slot 1 = der eingeloggte User (Owner) selbst
    const ownerSlot = {
      profile_id: user.id,
      display_name: profile?.display_name || 'Ich',
      handicap: Number(profile?.hcp ?? 0),
    }
    setForm({ name: '', course: null, slots: [ownerSlot] })
    setView('create')
  }

  async function openDetail(round) {
    setActive(round)
    setView('detail')
    await loadDetail(round.id)
    subscribeRealtime(round.id)
  }

  async function loadDetail(roundId) {
    const [{ data: ps }, { data: ss }] = await Promise.all([
      supabase.from('casual_round_players').select('*').eq('round_id', roundId).order('idx'),
      supabase.from('casual_scores').select('*').eq('round_id', roundId),
    ])
    setPlayers(ps || [])
    setScores(ss || [])
  }

  function subscribeRealtime(roundId) {
    if (chRef.current) { supabase.removeChannel(chRef.current); chRef.current = null }
    const ch = supabase.channel(`casual-${roundId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'casual_scores', filter: `round_id=eq.${roundId}` },
        () => loadDetail(roundId))
      .subscribe()
    chRef.current = ch
  }

  useEffect(() => () => {
    if (chRef.current) supabase.removeChannel(chRef.current)
  }, [])

  function backToList() {
    if (chRef.current) { supabase.removeChannel(chRef.current); chRef.current = null }
    setActive(null); setPlayers([]); setScores([])
    setView('list'); loadRounds()
    if (roundIdParam) navigate('/casual', { replace: true })
  }

  function removeSlot(idx) {
    setForm(f => ({ ...f, slots: f.slots.filter((_, i) => i !== idx) }))
  }

  async function submitCreate() {
    if (form.slots.length === 0) return
    setCreating(true)
    try {
      // Default-Setup: Par 4 × 18 (Total 72) + SI 1..18. Owner kann
      // jederzeit per Loch-Setup-Sheet die echten Werte nachtragen.
      const DEFAULT_PARS = Array(18).fill(4)
      const DEFAULT_HCPS = Array.from({ length: 18 }, (_, i) => i + 1)
      const pars = form.course?.hole_pars?.length === 18 ? form.course.hole_pars : DEFAULT_PARS
      const hcps = form.course?.hole_handicaps?.length === 18 ? form.course.hole_handicaps : DEFAULT_HCPS
      const { data: round, error: roundErr } = await supabase.from('casual_rounds').insert({
        owner_id: user.id,
        name: form.name.trim() || null,
        course_id: form.course?.id || null,
        course_name: form.course?.name || null,
        hole_pars: pars,
        hole_handicaps: hcps,
      }).select('*').single()
      if (roundErr || !round) throw roundErr

      const playerRows = form.slots.map((s, i) => ({
        round_id: round.id,
        idx: i + 1,
        profile_id: s.profile_id,
        display_name: s.display_name,
        handicap: s.handicap,
      }))
      const { error: pErr } = await supabase.from('casual_round_players').insert(playerRows)
      if (pErr) throw pErr

      await openDetail(round)
    } catch (e) {
      console.error('casual create failed', e)
      alert('Anlegen fehlgeschlagen: ' + (e?.message || 'unbekannter Fehler'))
    } finally {
      setCreating(false)
    }
  }

  async function changeScore(playerIdx, hole, strokes) {
    if (!active) return
    // Optimistic
    setScores(prev => {
      const others = prev.filter(s => !(s.player_idx === playerIdx && s.hole_number === hole))
      return strokes != null
        ? [...others, { round_id: active.id, player_idx: playerIdx, hole_number: hole, strokes }]
        : others
    })
    if (strokes == null) {
      await supabase.from('casual_scores').delete()
        .eq('round_id', active.id).eq('player_idx', playerIdx).eq('hole_number', hole)
    } else {
      await supabase.from('casual_scores').upsert({
        round_id: active.id, player_idx: playerIdx, hole_number: hole, strokes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'round_id,player_idx,hole_number' })
    }
  }

  async function finishRound() {
    if (!active) return
    await supabase.from('casual_rounds').update({
      status: 'finished', finished_at: new Date().toISOString(),
    }).eq('id', active.id)
    setActive(a => ({ ...a, status: 'finished' }))
  }

  async function reopenRound() {
    if (!active) return
    await supabase.from('casual_rounds').update({
      status: 'active', finished_at: null,
    }).eq('id', active.id)
    setActive(a => ({ ...a, status: 'active', finished_at: null }))
  }

  async function deleteRound(id) {
    await supabase.from('casual_rounds').delete().eq('id', id)
    setDeleteId(null)
    if (active?.id === id) backToList()
    else loadRounds()
  }

  // Par eines einzelnen Lochs direkt aus der Scorecard heraus anpassen
  // (ohne den Loch-Setup-Dialog). Fehlt noch ein Par-Set, starten wir bei
  // Par 4 pro Loch und überschreiben nur das angetippte Loch.
  async function changePar(hole, value) {
    if (!active) return
    const v = Number(value)
    if (!Number.isFinite(v) || v < 3 || v > 6) return
    const base = active.hole_pars?.length === 18 ? [...active.hole_pars] : Array(18).fill(4)
    if (base[hole - 1] === v) return
    base[hole - 1] = v
    setActive(a => ({ ...a, hole_pars: base }))
    const { error } = await supabase.from('casual_rounds')
      .update({ hole_pars: base }).eq('id', active.id)
    if (error) alert('Par speichern fehlgeschlagen: ' + (error.message || 'unbekannt'))
  }

  // Ergebnis-Karte der Runde rendern und ins WhatsApp-/Share-Sheet geben.
  // Funktioniert für alle Teilnehmer (nicht nur den Owner), sobald gewertet ist.
  const [sharing, setSharing] = useState(false)
  async function handleShareCasual() {
    if (!active || sharing) return
    const pars = active.hole_pars?.length === 18 ? active.hole_pars : null
    const hcps = active.hole_handicaps?.length === 18 ? active.hole_handicaps : null
    const fmt = d => d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`

    const rows = players.map(p => {
      const own = scores.filter(s => s.player_idx === p.idx)
      const total = own.reduce((s, x) => s + x.strokes, 0)
      const grossDiff = pars
        ? own.reduce((d, s) => d + (s.strokes - (pars[s.hole_number - 1] || 0)), 0)
        : null
      const playerStrokes = strokesPerHole(p.handicap, hcps)
      const playerAdd = own.reduce((sum, s) => sum + (playerStrokes[s.hole_number - 1] || 0), 0)
      const netDiff = grossDiff != null ? grossDiff - playerAdd : null
      const hasHcp = hcps && Number(p.handicap) > 0
      return { name: p.display_name, total, played: own.length, grossDiff, netDiff, hasHcp }
    }).filter(r => r.played > 0)

    if (!rows.length) return
    // Bestes Ergebnis zuerst: nach Netto, sonst Brutto, sonst Gesamt.
    rows.sort((a, b) => (a.netDiff ?? a.grossDiff ?? a.total) - (b.netDiff ?? b.grossDiff ?? b.total))

    const maxPlayed = Math.max(...rows.map(r => r.played))
    const finished = active.status === 'finished' || maxPlayed === 18

    // Lochspiel-Ergebnis (nur 2 Spieler): wer mit wie vielen Löchern führt/gewinnt.
    let matchResult = null
    if (players.length === 2) {
      const a = players[0], b = players[1]
      const byHole = {}
      for (const s of scores) {
        (byHole[s.hole_number] || (byHole[s.hole_number] = {}))[s.player_idx === a.idx ? 'a' : 'b'] = s.strokes
      }
      const zero = Array(18).fill(0)
      const gross = calcCasualMatchStanding(byHole, zero, zero)
      if (gross.played > 0) {
        const first = n => (n || '').split(' ')[0]
        const winner = gross.leader === 'A' ? a : gross.leader === 'B' ? b : null
        const showNet = hcps && (Number(a.handicap) > 0 || Number(b.handicap) > 0)
        const net = showNet
          ? calcCasualMatchStanding(byHole, strokesPerHole(a.handicap, hcps), strokesPerHole(b.handicap, hcps))
          : null
        // Lead als Löcher-Vorsprung ("N Up") — wie im Live-Banner, statt der
        // "3&2"-Schreibweise.
        const upLabel = st => st.leader === 'AS' ? 'AS' : `${Math.abs(st.upA - st.upB)} Up`
        let sub = `${first(a.display_name)} ${gross.upA} · ${first(b.display_name)} ${gross.upB} · ½ ${gross.halved}`
        if (net && (net.leader !== gross.leader || upLabel(net) !== upLabel(gross))) {
          const netName = net.leader === 'A' ? first(a.display_name) : net.leader === 'B' ? first(b.display_name) : 'All Square'
          sub += `   ·   Netto: ${net.leader === 'AS' ? 'All Square' : `${netName} ${upLabel(net)}`}`
        }
        matchResult = {
          text: winner ? `${first(winner.display_name)} ${finished ? 'gewinnt' : 'führt'}` : 'All Square',
          label: upLabel(gross),
          sub,
        }
      }
    }

    const cardRows = rows.slice(0, 6).map((r, i) => ({
      name: r.name,
      total: r.total,
      sub: r.grossDiff != null
        ? `Brutto ${fmt(r.grossDiff)}${r.hasHcp && r.netDiff != null ? ` · Netto ${fmt(r.netDiff)}` : ''}`
        : `${r.played}/18`,
      winner: i === 0 && (finished || rows.length >= 2),
    }))

    setSharing(true)
    try {
      const { blob } = await renderCasualShareCard({
        title: active.course_name || 'Casual-Runde',
        statusLabel: finished ? 'Endstand' : `Live · ${maxPlayed}/18`,
        rows: cardRows,
        matchResult,
        dateLabel: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }),
      })
      const shareText = matchResult
        ? `${matchResult.text}${matchResult.label && matchResult.label !== 'AS' ? ` ${matchResult.label}` : ''} — ${active.course_name || 'Casual-Runde'}`
        : finished
          ? `${rows[0].name} gewinnt — ${active.course_name || 'Casual-Runde'}`
          : `Live: ${active.course_name || 'Casual-Runde'}`
      await shareOrDownload({
        blob,
        filename: `swingandsavor-casual-${String(active.id).slice(0, 8)}.png`,
        title: 'Swing & Savor',
        text: shareText,
        url: 'https://swingandsavor.at',
      })
    } catch (e) {
      console.error('[casual] share', e)
    } finally {
      setSharing(false)
    }
  }

  async function saveCourseSetup({ pars, hcps }) {
    if (!active) return
    const { error } = await supabase.from('casual_rounds').update({
      hole_pars: pars,
      hole_handicaps: hcps,
    }).eq('id', active.id)
    if (error) {
      alert('Speichern fehlgeschlagen: ' + (error.message || 'unbekannt'))
      return
    }
    setActive(a => ({ ...a, hole_pars: pars, hole_handicaps: hcps }))
    setShowSetupSheet(false)

    // Community-Sourcing: wenn der Course noch keine 18-Loch-Werte hat
    // UND die Eingabe nicht das pure Default-Set (Par 4 × 18, SI 1..18)
    // ist, mit dieser Eingabe befruchten. Künftige Runden auf demselben
    // Platz erben die Werte automatisch. Default-Set wird NICHT in
    // courses gespiegelt, sonst pollutet sich die Course-DB selbst.
    if (active.course_id) {
      const isDefaultPars = pars.every(p => p === 4)
      const isDefaultHcps = hcps.every((h, i) => h === i + 1)
      if (!isDefaultPars || !isDefaultHcps) {
        const { data: course } = await supabase.from('courses')
          .select('hole_pars, hole_handicaps').eq('id', active.course_id).maybeSingle()
        const courseHasPars = course?.hole_pars?.length === 18 && course.hole_pars.some(x => x > 0)
        const courseHasHcps = course?.hole_handicaps?.length === 18
        if (!courseHasPars || !courseHasHcps) {
          const patch = {}
          if (!courseHasPars && !isDefaultPars) {
            patch.hole_pars = pars
            patch.total_par = sumPars(pars)
          }
          if (!courseHasHcps && !isDefaultHcps) {
            patch.hole_handicaps = hcps
          }
          if (Object.keys(patch).length > 0) {
            await supabase.from('courses').update(patch).eq('id', active.course_id)
          }
        }
      }
    }
  }

  // ─────────────────────────── List view ───────────────────────────────────
  if (view === 'list') {
    return (
      <div className="max-w-lg mx-auto animate-fade-up">
        <div className="flex items-center justify-between px-4 pt-6 pb-5">
          <div>
            <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">Casual</h1>
            <p className="text-xs text-inkMuted mt-0.5">Just for fun — Runde ohne Turnier</p>
          </div>
          <button onClick={openCreate}
            className="px-4 py-2 rounded-lg text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.97] transition-transform">
            + Runde
          </button>
        </div>

        {loading ? <LoadingSpinner /> : rounds.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-sm text-inkMuted">Noch keine Runden</p>
            <p className="text-xs mt-1 text-inkDim">
              Tippe <span className="text-accent font-semibold">+ Runde</span>, um eine Casual-Runde zu starten.
            </p>
          </div>
        ) : (
          <div className="border-t border-lineSoft">
            {rounds.map(r => (
              <button key={r.id} onClick={() => openDetail(r)}
                className="w-full px-4 py-4 border-b border-lineSoft flex items-center gap-3 active:bg-bg/40 transition-colors text-left">
                <div className={`w-2 h-2 rounded-full ${
                  r.status === 'active' ? 'bg-accent animate-pulse' : 'bg-line'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-ink truncate">
                    {r.name || r.course_name || 'Casual Runde'}
                  </p>
                  <p className="text-[11px] text-inkMuted truncate">
                    {new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                    {r.course_name && ` · ${r.course_name}`}
                    {r.status === 'finished' && ' · beendet'}
                  </p>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────── Create view ─────────────────────────────────
  if (view === 'create') {
    return (
      <div className="max-w-lg mx-auto animate-fade-up">
        <div className="flex items-center justify-between px-4 pt-6 pb-3">
          <button onClick={() => setView('list')}
            className="text-xs font-bold tracking-wider uppercase text-inkMuted active:scale-95">
            ← Zurück
          </button>
          <h1 className="font-condensed text-xl font-bold tracking-wide text-ink">Neue Runde</h1>
          <div className="w-12" />
        </div>

        <div className="mx-4 mb-4 rounded-card p-4 flex flex-col gap-3 bg-surface border border-line">
          {/* Name (optional) */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">
              Name (optional)
            </p>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={'z.B. "Samstag Vormittag"'}
              maxLength={60}
              className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink text-sm focus:border-accent/60" />
          </div>

          {/* Course */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">
              Golfplatz (optional)
            </p>
            <button type="button" onClick={() => setShowCoursePicker(true)}
              className="w-full text-left bg-bg border border-line rounded-xl px-4 py-3 text-sm flex items-center justify-between">
              <span className={form.course ? 'text-ink' : 'text-inkDim'}>
                {form.course ? form.course.name : 'Platz wählen…'}
                {form.course?.total_par > 0 && <span className="text-inkMuted text-xs ml-2">· Par {form.course.total_par}</span>}
              </span>
              {form.course && (
                <span onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, course: null })) }}
                  className="text-inkMuted text-lg leading-none px-2">×</span>
              )}
            </button>
          </div>

          {/* Spieler */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">
              Spieler ({form.slots.length}/4)
            </p>
            <div className="flex flex-col gap-2">
              {form.slots.map((s, i) => (
                <div key={i} className="flex items-center gap-3 bg-bg border border-line rounded-xl px-3 py-2.5">
                  <span className="w-7 h-7 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-ink truncate">{s.display_name}</p>
                    <p className="text-[10px] text-inkMuted tabular-nums">
                      HC {Number(s.handicap).toFixed(1)}
                      {s.profile_id ? ' · Account' : ' · Gast'}
                      {i === 0 ? ' · du' : ''}
                    </p>
                  </div>
                  {i !== 0 && (
                    <button onClick={() => removeSlot(i)}
                      className="text-inkDim hover:text-danger px-2 text-lg leading-none">×</button>
                  )}
                </div>
              ))}
            </div>

            {form.slots.length < 4 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button onClick={() => setShowFriendPicker(true)}
                  className="py-2.5 rounded-xl text-xs font-bold bg-bg text-ink border border-line active:scale-[0.97] transition-transform">
                  + Freund
                </button>
                <button onClick={() => setShowGuestSheet(true)}
                  className="py-2.5 rounded-xl text-xs font-bold bg-bg text-inkMuted border border-line active:scale-[0.97] transition-transform">
                  + Gast (ohne Account)
                </button>
              </div>
            )}
          </div>

          <button onClick={submitCreate} disabled={creating || form.slots.length === 0}
            className="py-3 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-40 mt-1">
            {creating ? '…' : 'Runde starten'}
          </button>
        </div>

        {showCoursePicker && (
          <CoursePicker
            value={form.course}
            onChange={(c) => setForm(f => ({ ...f, course: c }))}
            onClose={() => setShowCoursePicker(false)}
          />
        )}
        {showFriendPicker && (
          <FriendPickerSheet
            excludeIds={form.slots.map(s => s.profile_id).filter(Boolean)}
            onPick={(f) => setForm(prev => ({
              ...prev,
              slots: [...prev.slots, {
                profile_id: f.id,
                display_name: f.display_name,
                handicap: Number(f.hcp ?? 0),
              }],
            }))}
            onClose={() => setShowFriendPicker(false)}
          />
        )}
        {showGuestSheet && (
          <GuestSheet
            onAdd={(g) => setForm(prev => ({ ...prev, slots: [...prev.slots, g] }))}
            onClose={() => setShowGuestSheet(false)}
          />
        )}
      </div>
    )
  }

  // ─────────────────────────── Detail view ─────────────────────────────────
  const isOwner = active && user?.id === active.owner_id

  return (
    <div className="max-w-lg mx-auto animate-fade-up">
      <div className="flex items-center justify-between px-4 pt-6 pb-3">
        <button onClick={backToList}
          className="text-xs font-bold tracking-wider uppercase text-inkMuted active:scale-95">
          ← Casual
        </button>
        <h1 className="font-condensed text-xl font-bold tracking-wide text-ink truncate max-w-[60%]">
          {active?.name || active?.course_name || 'Runde'}
        </h1>
        {isOwner ? (
          <button onClick={() => setDeleteId(active.id)}
            className="text-xs font-bold tracking-wider uppercase text-inkDim hover:text-danger active:scale-95">
            Löschen
          </button>
        ) : <div className="w-12" />}
      </div>

      {/* ── Lochspiel-Banner: wer führt, prominent über allem ── */}
      {active && players.length === 2 && (() => {
        const st = casualGrossStanding(players, scores)
        if (!st || st.played === 0) return null
        const leaderName = st.leader === 'A' ? st.a.display_name
                         : st.leader === 'B' ? st.b.display_name : null
        const finished = active.status === 'finished' || st.played === 18
        return (
          <div
            className="mx-4 mb-3 rounded-card border px-4 py-3"
            style={{
              borderColor: leaderName ? 'rgba(212,201,168,0.45)' : 'rgba(255,255,255,0.12)',
              background: leaderName ? 'rgba(212,201,168,0.10)' : 'rgba(255,255,255,0.03)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted mb-0.5">
                  {finished ? 'Lochspiel · Endstand' : 'Lochspiel · Live'}
                </p>
                <p className="font-condensed font-black text-xl leading-tight text-ink truncate">
                  {leaderName ? `${leaderName} ${finished ? 'gewinnt' : 'führt'}` : 'Gleichstand'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-condensed font-black text-2xl leading-none tabular-nums"
                   style={{ color: leaderName ? '#D9C9A8' : '#9ca3af' }}>
                  {leaderName ? st.label : 'AS'}
                </p>
                <p className="text-[10px] font-semibold text-inkDim mt-0.5">
                  {st.played}/18{st.remaining > 0 ? ` · ${st.remaining} offen` : ''}
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {active?.course_name && (
        <p className="px-4 -mt-1 mb-3 text-[11px] text-inkMuted flex items-center gap-2 flex-wrap">
          <span>{active.course_name}</span>
          {active.hole_pars?.length === 18 && active.hole_pars.some(x => x > 0) && (
            <span>· Par {sumPars(active.hole_pars)}</span>
          )}
          {isOwner && (
            <button onClick={() => setShowSetupSheet(true)}
              className="ml-auto text-[10px] font-bold tracking-wider uppercase text-accent active:scale-95">
              Loch-Setup
            </button>
          )}
        </p>
      )}

      {active && players.length > 0 && (() => {
        const hasPars = active.hole_pars?.length === 18 && active.hole_pars.some(x => x > 0)
        const hasHcps = active.hole_handicaps?.length === 18
        if (hasPars && hasHcps) return null
        return (
          <div className="mx-4 mb-3 p-3 rounded-card border border-accent/40 bg-accent/5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink">
                {!hasPars && !hasHcps ? 'Par und Vorgabe-Rang fehlen' :
                 !hasPars ? 'Par fehlt' : 'Vorgabe-Rang (SI) fehlt'}
              </p>
              <p className="text-[10px] text-inkMuted mt-0.5">
                Ohne diese Werte kein Live-Stand, keine Pro-Loch-Vorgabe.
              </p>
            </div>
            {isOwner && (
              <button onClick={() => setShowSetupSheet(true)}
                className="px-3 py-2 rounded-lg text-[11px] font-bold bg-accent text-brandDark active:scale-[0.97] transition-transform whitespace-nowrap">
                Nachtragen
              </button>
            )}
          </div>
        )
      })()}

      {active && players.length > 0 && (
        <div className="px-4">
          <LiveStanding round={active} playersList={players} scores={scores} />
          {players.length === 2 && (
            <div className="mb-3">
              <HoleByHoleTable
                rows={casualHoleResults(players, scores)}
                labelA={players[0]?.display_name}
                labelB={players[1]?.display_name}
                colorA={CAS_A}
                colorB={CAS_B}
                totalHoles={18}
              />
            </div>
          )}
        </div>
      )}

      <div className="px-4 pb-4">
        <Scorecard
          round={active}
          playersList={players}
          scores={scores}
          isOwner={!!isOwner}
          onScoreChange={changeScore}
          onParChange={changePar}
        />
      </div>

      {active && scores.length > 0 && (
        <div className="px-4 pb-4">
          <button onClick={handleShareCasual} disabled={sharing}
            className="w-full py-3 rounded-xl text-sm font-bold tracking-wide bg-surface text-ink border border-line active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
            </svg>
            {sharing ? 'Erstelle Karte …' : 'Ergebnis teilen'}
          </button>
        </div>
      )}

      {isOwner && (
        <div className="px-4 pb-8">
          {active.status === 'active' ? (
            <button onClick={finishRound}
              className="w-full py-3 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform">
              Runde abschließen
            </button>
          ) : (
            <button onClick={reopenRound}
              className="w-full py-3 rounded-xl text-sm font-bold tracking-wide bg-bg text-inkMuted border border-line active:scale-[0.97] transition-transform">
              Wieder öffnen
            </button>
          )}
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          message="Runde löschen? Alle Scores gehen verloren."
          confirmText="Löschen"
          onConfirm={() => deleteRound(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {showSetupSheet && active && (
        <CourseSetupSheet
          initialPars={active.hole_pars}
          initialHcps={active.hole_handicaps}
          onSave={saveCourseSetup}
          onClose={() => setShowSetupSheet(false)}
        />
      )}
    </div>
  )
}
