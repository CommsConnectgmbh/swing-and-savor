import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import LoadingSpinner from '../components/LoadingSpinner'
import CoursePicker from '../components/CoursePicker'
import ConfirmDialog from '../components/ConfirmDialog'

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
    let cancelled = false
    async function load() {
      const { data: rows } = await supabase.from('friendships').select('*')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      const accepted = (rows || []).filter(r => r.status === 'accepted')
      const ids = accepted.map(r => r.user_a === user.id ? r.user_b : r.user_a)
      if (!ids.length) { if (!cancelled) { setFriends([]); setLoading(false) }; return }
      const { data: profs } = await supabase.from('profiles')
        .select('id, handle, display_name, hcp, avatar_url').in('id', ids)
      if (!cancelled) {
        setFriends((profs || []).sort((a, b) => a.display_name.localeCompare(b.display_name)))
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

// ─── Scorecard ──────────────────────────────────────────────────────────────
function Scorecard({ round, playersList, scores, isOwner, onScoreChange }) {
  const pars = round.hole_pars?.length === 18 ? round.hole_pars : Array(18).fill(0)
  const totalPar = pars.reduce((s, p) => s + (Number.isFinite(p) ? p : 0), 0)

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
      {/* Front 9 + Back 9 in two rows per player */}
      {playersList.map(p => {
        const total = totalFor(p.idx)
        const played = countFor(p.idx)
        const diff = totalPar > 0 && played > 0
          ? scores.filter(s => s.player_idx === p.idx)
              .reduce((d, s) => d + (s.strokes - (pars[s.hole_number - 1] || 0)), 0)
          : null
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
                  {pars.some(x => x > 0) && (
                    <tr>
                      <td className="text-[10px] text-inkDim uppercase tracking-wider pr-2 w-12">Par</td>
                      {HOLES.map(h => (
                        <td key={h} className="w-12 text-center text-[10px] text-inkMuted tabular-nums">
                          {pars[h - 1] || '—'}
                        </td>
                      ))}
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

// ─── Main Screen ────────────────────────────────────────────────────────────
export default function CasualScreen() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
  }

  function removeSlot(idx) {
    setForm(f => ({ ...f, slots: f.slots.filter((_, i) => i !== idx) }))
  }

  async function submitCreate() {
    if (form.slots.length === 0) return
    setCreating(true)
    try {
      const pars = form.course?.hole_pars?.length === 18 ? form.course.hole_pars : []
      const hcps = form.course?.hole_handicaps?.length === 18 ? form.course.hole_handicaps : []
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

      {active?.course_name && (
        <p className="px-4 -mt-1 mb-3 text-[11px] text-inkMuted">
          {active.course_name}
          {active.hole_pars?.length === 18 &&
            <> · Par {active.hole_pars.reduce((s, p) => s + (p || 0), 0)}</>}
        </p>
      )}

      <div className="px-4 pb-4">
        <Scorecard
          round={active}
          playersList={players}
          scores={scores}
          isOwner={!!isOwner}
          onScoreChange={changeScore}
        />
      </div>

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
    </div>
  )
}
