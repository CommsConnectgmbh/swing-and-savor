import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { suggestSingles, suggestDoubles, suggestFlight } from '../lib/autopair'
import { suggestFactors } from '../lib/scoring'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import PasswordGate from '../components/PasswordGate'
import CoursePicker from '../components/CoursePicker'

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

function LockPlaceholder({ onUnlock }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 gap-4 animate-fade-up">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-lock/10 border border-lock/30">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5b94a"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="font-bold text-sm text-ink">Turnier geschützt</p>
        <p className="text-xs mt-1 text-inkMuted">Passwort eingeben, um Matches zu sehen</p>
      </div>
      <button onClick={onUnlock}
        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform">
        Passwort eingeben
      </button>
    </div>
  )
}

function isUnlocked(t) {
  if (!t?.edit_password) return true
  try { return sessionStorage.getItem(`golf_unlocked_${t.id}`) === '1' } catch { return false }
}

// Form-State unterstützt jetzt Arrays für Flight.
// singles → a:[id], b:[id]  doubles → a:[id,id], b:[id,id]  flight → a:[…], b:[…]
const emptyForm = {
  type: 'singles',
  sizeA: 1, sizeB: 1,
  a: ['', ''], b: ['', ''],     // bei Flight bis zu [_,_,_,_]
  team_a_factor: 1, team_b_factor: 1,
  factorTouched: false,
  course: null,
}

function expandedSize(type, size) {
  if (type === 'singles') return 1
  if (type === 'doubles') return 2
  return Math.max(1, Math.min(4, size | 0))
}

// 1..4 chip-selector
function SizeChips({ value, onChange, label }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">{label}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map(n => (
          <button key={n} type="button"
            onClick={() => onChange(n)}
            className={`py-2 rounded-lg font-bold text-sm tabular-nums active:scale-[0.95] transition-all ${
              value === n
                ? 'bg-accent text-brandDark'
                : 'bg-bg text-inkMuted border border-line'
            }`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function MatchesScreen() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [selected, setSelected] = useState(null)
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showGate, setShowGate] = useState(false)
  const [showViewGate, setShowViewGate] = useState(false)
  const [showCoursePicker, setShowCoursePicker] = useState(false)
  const pendingRef = useRef(null)

  useEffect(() => {
    supabase.from('tournaments').select('*').order('date', { ascending: false })
      .then(({ data }) => {
        setTournaments(data || [])
        if (data?.length > 0) setSelected(data[0])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (selected) {
      if (isUnlocked(selected)) {
        setShowViewGate(false)
        loadMatches()
        loadPlayers()
      } else {
        setMatches([]); setPlayers([])
        setShowViewGate(true)
      }
    }
  }, [selected])

  async function loadMatches() {
    const { data } = await supabase.from('matches').select(`
      *,
      pa1:team_a_player1_id(name),
      pa2:team_a_player2_id(name),
      pb1:team_b_player1_id(name),
      pb2:team_b_player2_id(name)
    `).eq('tournament_id', selected.id).order('created_at')
    setMatches(data || [])
  }

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*')
      .eq('tournament_id', selected.id).order('team').order('name')
    setPlayers(data || [])
  }

  function guarded(action) {
    if (isUnlocked(selected)) action()
    else { pendingRef.current = action; setShowGate(true) }
  }

  function handleGateSuccess() {
    setShowGate(false)
    if (pendingRef.current) { pendingRef.current(); pendingRef.current = null }
  }

  function handleViewGateSuccess() { setShowViewGate(false); loadMatches(); loadPlayers() }

  function openCreate() {
    guarded(() => { setForm(emptyForm); setEditId(null); setMode('create') })
  }

  function openEdit(m) {
    guarded(() => {
      const a = (m.team_a_player_ids?.length ? m.team_a_player_ids
                : [m.team_a_player1_id, m.team_a_player2_id]).filter(Boolean)
      const b = (m.team_b_player_ids?.length ? m.team_b_player_ids
                : [m.team_b_player1_id, m.team_b_player2_id]).filter(Boolean)
      const padded = (arr) => [...arr, '', '', '', ''].slice(0, 4)
      setForm({
        type: m.type,
        sizeA: m.type === 'singles' ? 1 : m.type === 'doubles' ? 2 : Math.max(1, a.length),
        sizeB: m.type === 'singles' ? 1 : m.type === 'doubles' ? 2 : Math.max(1, b.length),
        a: padded(a),
        b: padded(b),
        team_a_factor: Number(m.team_a_factor ?? 1),
        team_b_factor: Number(m.team_b_factor ?? 1),
        factorTouched: false,
        course: null,
      })
      setEditId(m.id); setMode('edit')
    })
  }

  function closeForm() { setMode(null); setEditId(null) }

  function setType(type) {
    setForm(f => {
      const nextSizeA = type === 'singles' ? 1 : type === 'doubles' ? 2 : Math.max(1, f.sizeA)
      const nextSizeB = type === 'singles' ? 1 : type === 'doubles' ? 2 : Math.max(1, f.sizeB)
      const suggested = type === 'flight' && !f.factorTouched
        ? suggestFactors(nextSizeA, nextSizeB)
        : { team_a_factor: f.team_a_factor, team_b_factor: f.team_b_factor }
      return { ...f, type, sizeA: nextSizeA, sizeB: nextSizeB, ...suggested }
    })
  }

  function setSize(side, n) {
    setForm(f => {
      const next = { ...f, [side === 'A' ? 'sizeA' : 'sizeB']: n }
      if (!f.factorTouched) {
        const s = suggestFactors(side === 'A' ? n : f.sizeA, side === 'B' ? n : f.sizeB)
        next.team_a_factor = s.team_a_factor
        next.team_b_factor = s.team_b_factor
      }
      return next
    })
  }

  function setSlot(side, idx, value) {
    setForm(f => {
      const arr = [...f[side === 'A' ? 'a' : 'b']]
      arr[idx] = value
      return { ...f, [side === 'A' ? 'a' : 'b']: arr }
    })
  }

  function setFactor(side, raw) {
    const v = Math.max(0.1, Math.min(5, parseFloat(String(raw).replace(',', '.')) || 0))
    setForm(f => ({
      ...f,
      factorTouched: true,
      ...(side === 'A' ? { team_a_factor: v } : { team_b_factor: v }),
    }))
  }

  function applySuggestedFactors() {
    setForm(f => {
      const s = suggestFactors(f.sizeA, f.sizeB)
      return { ...f, factorTouched: false, ...s }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const sA = expandedSize(form.type, form.sizeA)
    const sB = expandedSize(form.type, form.sizeB)
    const aIds = form.a.slice(0, sA).map(v => v || null)
    const bIds = form.b.slice(0, sB).map(v => v || null)
    const aClean = aIds.filter(Boolean)
    const bClean = bIds.filter(Boolean)

    if (aClean.length === 0 || bClean.length === 0) return

    const payload = {
      type: form.type,
      // Legacy columns für Backwards-Compat
      team_a_player1_id: aIds[0] || null,
      team_a_player2_id: form.type !== 'singles' ? (aIds[1] || null) : null,
      team_b_player1_id: bIds[0] || null,
      team_b_player2_id: form.type !== 'singles' ? (bIds[1] || null) : null,
      // Array-Columns (Source-of-Truth ab jetzt)
      team_a_player_ids: aClean,
      team_b_player_ids: bClean,
      team_a_factor: form.type === 'flight' ? Number(form.team_a_factor) : 1,
      team_b_factor: form.type === 'flight' ? Number(form.team_b_factor) : 1,
      course_id: form.course?.id || null,
      hole_pars: form.course?.hole_pars?.length ? form.course.hole_pars : [],
      hole_handicaps: form.course?.hole_handicaps?.length ? form.course.hole_handicaps : [],
    }

    if (mode === 'create') await supabase.from('matches').insert([{ ...payload, tournament_id: selected.id }])
    else                   await supabase.from('matches').update(payload).eq('id', editId)
    closeForm(); loadMatches()
  }

  async function handleDelete() {
    await supabase.from('matches').delete().eq('id', deleteId)
    setDeleteId(null); loadMatches()
  }

  async function autoPair(type) {
    guarded(async () => {
      let payload = []
      if (type === 'singles') {
        const pairs = suggestSingles(teamA, teamB)
        if (pairs.length === 0) return
        payload = pairs.map(p => ({
          type: 'singles', tournament_id: selected.id,
          team_a_player1_id: p.a.id, team_b_player1_id: p.b.id,
          team_a_player_ids: [p.a.id], team_b_player_ids: [p.b.id],
        }))
      } else if (type === 'doubles') {
        const pairs = suggestDoubles(teamA, teamB)
        if (pairs.length === 0) return
        payload = pairs.map(p => ({
          type: 'doubles', tournament_id: selected.id,
          team_a_player1_id: p.a.p1.id, team_a_player2_id: p.a.p2.id,
          team_b_player1_id: p.b.p1.id, team_b_player2_id: p.b.p2.id,
          team_a_player_ids: [p.a.p1.id, p.a.p2.id],
          team_b_player_ids: [p.b.p1.id, p.b.p2.id],
        }))
      } else if (type === 'flight') {
        const f = suggestFlight(teamA, teamB, { maxSize: 4 })
        if (!f) return
        const fac = suggestFactors(f.sizeA, f.sizeB)
        payload = [{
          type: 'flight', tournament_id: selected.id,
          team_a_player1_id: f.a[0]?.id || null,
          team_a_player2_id: f.a[1]?.id || null,
          team_b_player1_id: f.b[0]?.id || null,
          team_b_player2_id: f.b[1]?.id || null,
          team_a_player_ids: f.a.map(p => p.id),
          team_b_player_ids: f.b.map(p => p.id),
          team_a_factor: fac.team_a_factor,
          team_b_factor: fac.team_b_factor,
        }]
      }
      if (payload.length === 0) return
      await supabase.from('matches').insert(payload)
      loadMatches()
    })
  }

  const teamA = players.filter(p => p.team === 'A')
  const teamB = players.filter(p => p.team === 'B')
  const inputCls = 'w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink text-sm focus:border-accent/60'
  const locked = !isUnlocked(selected)

  const statusDot  = { pending: '#244a37', active: '#98cd02', finished: 'rgba(168,181,173,0.5)' }
  const statusLbl  = { pending: 'Offen', active: 'Live', finished: 'Beendet' }
  const statusCls  = { pending: 'text-inkMuted', active: 'text-accent', finished: 'text-inkMuted' }

  const playerById = (id) => players.find(p => p.id === id)

  return (
    <div className="max-w-lg mx-auto animate-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-5">
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">Matches</h1>
        <button
          onClick={mode ? closeForm : openCreate}
          disabled={!selected}
          className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wide active:scale-[0.97] transition-all disabled:opacity-30 flex items-center gap-1.5 ${
            mode
              ? 'bg-surface text-inkMuted border border-line'
              : 'bg-accent text-brandDark'
          }`}
        >
          {!mode && locked && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          )}
          {mode ? 'Schließen' : '+ Match'}
        </button>
      </div>

      {/* Tournament selector */}
      {tournaments.length > 1 && (
        <div className="px-4 mb-4">
          <select className={inputCls} value={selected?.id || ''}
            onChange={e => setSelected(tournaments.find(t => t.id === e.target.value))}>
            {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* Teams-Empty-State: Wenn keine Spieler da sind, klar zu Teams führen */}
      {!mode && !locked && selected && (teamA.length === 0 || teamB.length === 0) && (
        <div className="mx-4 mb-4 p-4 rounded-card bg-surface border border-line">
          <p className="text-sm font-bold text-ink">Erst Spieler anlegen</p>
          <p className="text-xs text-inkMuted mt-1">
            Damit du Matches starten kannst, brauchst du Spieler in {selected.team_a_name} und {selected.team_b_name}.
          </p>
          <button
            onClick={() => navigate('/teams')}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform">
            → Zu Teams
          </button>
        </div>
      )}

      {/* Smart auto-pair */}
      {!mode && !locked && selected && teamA.length >= 1 && teamB.length >= 1 && matches.length === 0 && (
        <div className="mx-4 mb-4 p-3 rounded-card bg-surface border border-line">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-accent mb-2">Faire Paarung</p>
          <p className="text-xs text-inkMuted mb-3">
            Automatische Paarung nach Handicap — minimiert die Differenz pro Match.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => autoPair('singles')}
              disabled={teamA.length < 1 || teamB.length < 1}
              className="py-2.5 rounded-xl text-[11px] font-bold tracking-wide bg-bg text-ink border border-line active:scale-[0.97] transition-transform disabled:opacity-40">
              Singles<br/><span className="text-inkMuted">×{Math.min(teamA.length, teamB.length)}</span>
            </button>
            <button onClick={() => autoPair('doubles')}
              disabled={teamA.length < 2 || teamB.length < 2}
              className="py-2.5 rounded-xl text-[11px] font-bold tracking-wide bg-bg text-ink border border-line active:scale-[0.97] transition-transform disabled:opacity-40">
              Doubles<br/><span className="text-inkMuted">×{Math.min(Math.floor(teamA.length/2), Math.floor(teamB.length/2))}</span>
            </button>
            <button onClick={() => autoPair('flight')}
              disabled={teamA.length < 1 || teamB.length < 1}
              className="py-2.5 rounded-xl text-[11px] font-bold tracking-wide bg-bg text-ink border border-line active:scale-[0.97] transition-transform disabled:opacity-40">
              Flight<br/><span className="text-inkMuted">{Math.min(teamA.length,4)}v{Math.min(teamB.length,4)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      {mode && (
        <form onSubmit={handleSubmit}
          className="mx-4 mb-4 rounded-card p-4 flex flex-col gap-3 bg-surface border border-line animate-fade-up">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-inkMuted">
            {mode === 'edit' ? 'Match bearbeiten' : 'Neues Match'}
          </p>

          {/* Type-Selector */}
          <div className="grid grid-cols-3 gap-2">
            {[
              ['singles', 'Singles', '1 v 1'],
              ['doubles', 'Doubles', '2 v 2'],
              ['flight',  'Flight',  'bis 4 v 4'],
            ].map(([type, label, hint]) => (
              <button key={type} type="button"
                onClick={() => setType(type)}
                className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl active:scale-[0.97] transition-all ${
                  form.type === type
                    ? 'bg-accent text-brandDark'
                    : 'bg-bg text-inkMuted border border-line'
                }`}>
                <span className="text-sm font-bold">{label}</span>
                <span className="text-[9px] tracking-wide opacity-75">{hint}</span>
              </button>
            ))}
          </div>

          {/* Flight: Team-Größen-Picker */}
          {form.type === 'flight' && (
            <div className="grid grid-cols-2 gap-3">
              <SizeChips value={form.sizeA} onChange={(n) => setSize('A', n)}
                label={`${selected?.team_a_name || 'Team A'} · Spieler`} />
              <SizeChips value={form.sizeB} onChange={(n) => setSize('B', n)}
                label={`${selected?.team_b_name || 'Team B'} · Spieler`} />
            </div>
          )}

          {/* Team A Spieler-Slots */}
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-teamA pt-1">{selected?.team_a_name}</p>
          {Array.from({ length: expandedSize(form.type, form.sizeA) }).map((_, i) => (
            <PlayerSelect key={`a${i}`}
              label={`Spieler ${i + 1}`}
              value={form.a[i] || ''}
              options={teamA}
              taken={form.a.filter((id, idx) => idx !== i && id)}
              onChange={(v) => setSlot('A', i, v)} />
          ))}

          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-teamB pt-1">{selected?.team_b_name}</p>
          {Array.from({ length: expandedSize(form.type, form.sizeB) }).map((_, i) => (
            <PlayerSelect key={`b${i}`}
              label={`Spieler ${i + 1}`}
              value={form.b[i] || ''}
              options={teamB}
              taken={form.b.filter((id, idx) => idx !== i && id)}
              onChange={(v) => setSlot('B', i, v)} />
          ))}

          {/* Faktor (nur Flight) */}
          {form.type === 'flight' && (
            <div className="rounded-xl p-3 bg-bg border border-line">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted">
                  Punktefaktor
                </p>
                {form.sizeA !== form.sizeB && (
                  <button type="button" onClick={applySuggestedFactors}
                    className="text-[10px] font-bold tracking-wide uppercase text-accent active:scale-95 transition-transform">
                    Auto ausgleichen
                  </button>
                )}
              </div>
              {form.sizeA !== form.sizeB && (
                <p className="text-[11px] text-inkMuted mt-1.5 leading-snug">
                  Ungleicher Flight ({form.sizeA} v {form.sizeB}) — das größere Team bekommt einen kleineren Punktefaktor.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <FactorInput label={selected?.team_a_name || 'Team A'} color="teamA"
                  value={form.team_a_factor} onChange={(v) => setFactor('A', v)} />
                <FactorInput label={selected?.team_b_name || 'Team B'} color="teamB"
                  value={form.team_b_factor} onChange={(v) => setFactor('B', v)} />
              </div>
            </div>
          )}

          {/* Course */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">Golfplatz (optional)</p>
            <button type="button" onClick={() => setShowCoursePicker(true)}
              className="w-full text-left bg-bg border border-line rounded-xl px-4 py-3 text-sm active:border-accent/60 transition-colors flex items-center justify-between">
              <span className={form.course ? 'text-ink' : 'text-inkDim'}>
                {form.course ? form.course.name : 'Platz wählen…'}
                {form.course?.total_par > 0 && <span className="text-inkMuted text-xs ml-2">· Par {form.course.total_par}</span>}
              </span>
              {form.course && (
                <span onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, course: null })) }}
                  className="text-inkMuted text-lg leading-none px-2 hover:text-danger">×</span>
              )}
            </button>
          </div>

          <button type="submit"
            className="py-3 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform">
            {mode === 'edit' ? 'Speichern' : 'Match anlegen'}
          </button>
        </form>
      )}

      {showCoursePicker && (
        <CoursePicker
          value={form.course}
          onChange={(c) => setForm(f => ({ ...f, course: c }))}
          onClose={() => setShowCoursePicker(false)}
        />
      )}

      {/* Match list */}
      {loading ? <LoadingSpinner /> : locked && !showViewGate ? (
        <LockPlaceholder onUnlock={() => setShowViewGate(true)} />
      ) : !locked && (
        <div className="border-t border-lineSoft">
          {matches.map((m, idx) => {
            const aIds = m.team_a_player_ids?.length ? m.team_a_player_ids
                       : [m.team_a_player1_id, m.team_a_player2_id].filter(Boolean)
            const bIds = m.team_b_player_ids?.length ? m.team_b_player_ids
                       : [m.team_b_player1_id, m.team_b_player2_id].filter(Boolean)
            const playersA = aIds.map(id => playerById(id)?.name).filter(Boolean).join(' · ')
            const playersB = bIds.map(id => playerById(id)?.name).filter(Boolean).join(' · ')
            const typeLabel = m.type === 'singles' ? 'Singles'
                            : m.type === 'doubles' ? 'Doubles'
                            : `Flight ${aIds.length}v${bIds.length}`
            const hasFactor = Number(m.team_a_factor ?? 1) !== 1 || Number(m.team_b_factor ?? 1) !== 1
            return (
              <div key={m.id} className="px-4 py-4 border-b border-lineSoft"
                style={{ animationDelay: `${idx * 30}ms` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${m.status === 'active' ? 'animate-pulse' : ''}`}
                      style={{ background: statusDot[m.status] }} />
                    <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-inkMuted">
                      {typeLabel}
                    </span>
                    {hasFactor && (
                      <span className="text-[9px] font-bold tracking-wider uppercase text-accent bg-accent/10 border border-accent/25 px-1.5 py-0.5 rounded">
                        ×{Number(m.team_a_factor).toFixed(2)}/{Number(m.team_b_factor).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold tracking-wider uppercase tabular-nums ${statusCls[m.status]}`}>
                      {statusLbl[m.status]}
                    </span>
                    <button onClick={() => openEdit(m)}
                      className="p-1.5 rounded-lg ml-1 active:scale-90 transition-transform text-inkMuted hover:text-ink">
                      <PencilIcon />
                    </button>
                    <button onClick={() => guarded(() => setDeleteId(m.id))}
                      className="p-1.5 rounded-lg active:scale-90 transition-transform text-inkMuted hover:text-danger">
                      <CloseIcon />
                    </button>
                  </div>
                </div>

                <button className="w-full flex items-center gap-3 text-left active:opacity-75 transition-opacity"
                  onClick={() => navigate(`/matches/${m.id}`)}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate text-teamA">{playersA || '—'}</p>
                  </div>
                  <span className="text-xs font-bold flex-shrink-0 text-line">vs</span>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="font-semibold text-sm truncate text-teamB">{playersB || '—'}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" className="text-inkDim flex-shrink-0">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            )
          })}

          {matches.length === 0 && !mode && (
            <div className="text-center py-16 px-6">
              <p className="text-sm text-inkMuted">Noch keine Matches</p>
              <p className="text-xs mt-1 text-inkDim">
                Tippe <span className="text-accent font-semibold">+ Match</span>, um eine Paarung anzulegen
              </p>
            </div>
          )}
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          message="Match löschen? Alle Ergebnisse gehen verloren."
          confirmText="Löschen"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {showGate && selected && (
        <PasswordGate
          correctPassword={selected.edit_password}
          tournamentId={selected.id}
          onSuccess={handleGateSuccess}
          onCancel={() => { setShowGate(false); pendingRef.current = null }}
        />
      )}

      {showViewGate && selected && (
        <PasswordGate
          viewMode
          correctPassword={selected.edit_password}
          tournamentId={selected.id}
          onSuccess={handleViewGateSuccess}
          onCancel={() => setShowViewGate(false)}
        />
      )}
    </div>
  )
}

function PlayerSelect({ label, value, options, taken = [], onChange }) {
  return (
    <select
      className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink text-sm focus:border-accent/60"
      value={value} onChange={e => onChange(e.target.value)}
    >
      <option value="">{label} wählen…</option>
      {options.map(p => (
        <option key={p.id} value={p.id} disabled={taken.includes(p.id) && p.id !== value}>
          {p.name} (HC {Number(p.handicap).toFixed(1)}){taken.includes(p.id) && p.id !== value ? ' · vergeben' : ''}
        </option>
      ))}
    </select>
  )
}

function FactorInput({ label, color, value, onChange }) {
  const colorCls = color === 'teamA' ? 'text-teamA' : 'text-teamB'
  return (
    <label className="flex flex-col">
      <span className={`text-[10px] font-bold tracking-wider uppercase mb-1 ${colorCls}`}>{label}</span>
      <input type="number" step="0.05" min="0.1" max="5" inputMode="decimal"
        className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-ink text-sm tabular-nums text-center focus:border-accent/60"
        value={value}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
