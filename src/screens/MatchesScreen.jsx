import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { suggestSingles, suggestDoubles } from '../lib/autopair'
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

const emptyForm = { type: 'singles', a1: '', a2: '', b1: '', b2: '', course: null }

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
      setForm({
        type: m.type,
        a1: m.team_a_player1_id || '',
        a2: m.team_a_player2_id || '',
        b1: m.team_b_player1_id || '',
        b2: m.team_b_player2_id || '',
      })
      setEditId(m.id); setMode('edit')
    })
  }

  function closeForm() { setMode(null); setEditId(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      type: form.type,
      team_a_player1_id: form.a1 || null,
      team_a_player2_id: form.type === 'doubles' ? (form.a2 || null) : null,
      team_b_player1_id: form.b1 || null,
      team_b_player2_id: form.type === 'doubles' ? (form.b2 || null) : null,
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
      const pairs = type === 'singles' ? suggestSingles(teamA, teamB) : suggestDoubles(teamA, teamB)
      if (pairs.length === 0) return
      const payload = pairs.map(p => type === 'singles'
        ? {
            type: 'singles',
            tournament_id: selected.id,
            team_a_player1_id: p.a.id, team_b_player1_id: p.b.id,
          }
        : {
            type: 'doubles',
            tournament_id: selected.id,
            team_a_player1_id: p.a.p1.id, team_a_player2_id: p.a.p2.id,
            team_b_player1_id: p.b.p1.id, team_b_player2_id: p.b.p2.id,
          })
      await supabase.from('matches').insert(payload)
      loadMatches()
    })
  }

  const teamA = players.filter(p => p.team === 'A')
  const teamB = players.filter(p => p.team === 'B')
  const inputCls = 'w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink text-sm focus:border-accent/60'
  const locked = !isUnlocked(selected)

  // Match-state colors using new tokens
  const statusDot  = { pending: '#244a37', active: '#98cd02', finished: 'rgba(168,181,173,0.5)' }
  const statusLbl  = { pending: 'Offen', active: 'Live', finished: 'Beendet' }
  const statusCls  = { pending: 'text-inkMuted', active: 'text-accent', finished: 'text-inkMuted' }

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

      {/* Smart auto-pair */}
      {!mode && !locked && selected && teamA.length >= 1 && teamB.length >= 1 && matches.length === 0 && (
        <div className="mx-4 mb-4 p-3 rounded-card bg-surface border border-line">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-accent mb-2">⚡ Faire Paarung</p>
          <p className="text-xs text-inkMuted mb-3">
            Automatische Paarung nach Handicap — minimiert die Differenz pro Match.
          </p>
          <div className="flex gap-2">
            <button onClick={() => autoPair('singles')}
              disabled={teamA.length < 1 || teamB.length < 1}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide bg-bg text-ink border border-line active:scale-[0.97] transition-transform disabled:opacity-40">
              Singles auto-pairen ({Math.min(teamA.length, teamB.length)})
            </button>
            <button onClick={() => autoPair('doubles')}
              disabled={teamA.length < 2 || teamB.length < 2}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide bg-bg text-ink border border-line active:scale-[0.97] transition-transform disabled:opacity-40">
              Doubles auto-pairen ({Math.min(Math.floor(teamA.length/2), Math.floor(teamB.length/2))})
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

          <div className="flex gap-2">
            {[['singles', 'Singles'], ['doubles', 'Doubles']].map(([type, label]) => (
              <button key={type} type="button"
                onClick={() => setForm(f => ({ ...f, type }))}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm active:scale-[0.97] transition-all ${
                  form.type === type
                    ? 'bg-accent text-brandDark'
                    : 'bg-bg text-inkMuted border border-line'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-teamA">{selected?.team_a_name}</p>
          <PlayerSelect label={`Spieler ${selected?.team_a_name || 'A'} 1`} value={form.a1} options={teamA}
            onChange={v => setForm(f => ({ ...f, a1: v }))} />
          {form.type === 'doubles' && (
            <PlayerSelect label={`Spieler ${selected?.team_a_name || 'A'} 2`} value={form.a2} options={teamA}
              onChange={v => setForm(f => ({ ...f, a2: v }))} />
          )}

          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-teamB">{selected?.team_b_name}</p>
          <PlayerSelect label={`Spieler ${selected?.team_b_name || 'B'} 1`} value={form.b1} options={teamB}
            onChange={v => setForm(f => ({ ...f, b1: v }))} />
          {form.type === 'doubles' && (
            <PlayerSelect label={`Spieler ${selected?.team_b_name || 'B'} 2`} value={form.b2} options={teamB}
              onChange={v => setForm(f => ({ ...f, b2: v }))} />
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
            const playersA = [m.pa1?.name, m.pa2?.name].filter(Boolean).join(' & ')
            const playersB = [m.pb1?.name, m.pb2?.name].filter(Boolean).join(' & ')
            return (
              <div key={m.id} className="px-4 py-4 border-b border-lineSoft"
                style={{ animationDelay: `${idx * 30}ms` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${m.status === 'active' ? 'animate-pulse' : ''}`}
                      style={{ background: statusDot[m.status] }} />
                    <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-inkMuted">
                      {m.type === 'singles' ? 'Singles' : 'Doubles'}
                    </span>
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

function PlayerSelect({ label, value, options, onChange }) {
  return (
    <select
      className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink text-sm focus:border-accent/60"
      value={value} onChange={e => onChange(e.target.value)}
    >
      <option value="">{label} wählen…</option>
      {options.map(p => (
        <option key={p.id} value={p.id}>{p.name} (HC {Number(p.handicap).toFixed(1)})</option>
      ))}
    </select>
  )
}
