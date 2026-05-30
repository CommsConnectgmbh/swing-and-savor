import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import PasswordGate from '../components/PasswordGate'
import { isUnlocked } from '../lib/tournamentGate'

function validateHC(val) {
  const n = parseFloat(val)
  if (val === '' || val === null || val === undefined) return 'Handicap ist erforderlich'
  if (isNaN(n)) return 'Muss eine Zahl sein'
  if (n < 0 || n > 54) return 'Handicap zwischen 0,0 und 54,0'
  return null
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
        <p className="text-xs mt-1 text-inkMuted">Passwort eingeben, um Spieler zu sehen</p>
      </div>
      <button onClick={onUnlock}
        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform">
        Passwort eingeben
      </button>
    </div>
  )
}


const emptyForm = { name: '', handicap: '', team: 'A' }

export default function TeamsScreen() {
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [hcError, setHcError] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showGate, setShowGate] = useState(false)
  const [showViewGate, setShowViewGate] = useState(false)
  const pendingRef = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('tournaments').select('*').order('date', { ascending: false })
      .then(({ data }) => {
        const list = data || []
        setTournaments(list)
        const tid = searchParams.get('tid')
        const preselect = tid && list.find(t => t.id === tid)
        if (preselect) {
          setSelectedTournament(preselect)
          setSearchParams({}, { replace: true })
        } else if (list.length > 0) {
          setSelectedTournament(list[0])
        }
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (selectedTournament) {
      if (isUnlocked(selectedTournament)) {
        setShowViewGate(false); loadPlayers()
      } else {
        setPlayers([]); setShowViewGate(true)
      }
    }
  }, [selectedTournament])

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*')
      .eq('tournament_id', selectedTournament.id).order('team').order('name')
    setPlayers(data || [])
  }

  function guarded(action) {
    if (isUnlocked(selectedTournament)) action()
    else { pendingRef.current = action; setShowGate(true) }
  }

  function handleGateSuccess() {
    setShowGate(false)
    if (pendingRef.current) { pendingRef.current(); pendingRef.current = null }
  }

  function handleViewGateSuccess() { setShowViewGate(false); loadPlayers() }

  function openCreate() {
    guarded(() => { setForm(emptyForm); setEditId(null); setHcError(null); setMode('create') })
  }

  function openEdit(p) {
    guarded(() => {
      setForm({ name: p.name, handicap: String(p.handicap), team: p.team })
      setEditId(p.id); setHcError(null); setMode('edit')
    })
  }

  function closeForm() { setMode(null); setEditId(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validateHC(form.handicap)
    if (err) { setHcError(err); return }
    const payload = { name: form.name, handicap: parseFloat(form.handicap), team: form.team }
    if (mode === 'create') await supabase.from('players').insert([{ ...payload, tournament_id: selectedTournament.id }])
    else                   await supabase.from('players').update(payload).eq('id', editId)
    closeForm(); loadPlayers()
  }

  async function handleDelete() {
    await supabase.from('players').delete().eq('id', deleteId)
    setDeleteId(null); loadPlayers()
  }

  const teamA = players.filter(p => p.team === 'A')
  const teamB = players.filter(p => p.team === 'B')
  const inputCls = 'w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60'
  const locked = !isUnlocked(selectedTournament)

  return (
    <div className="max-w-lg mx-auto animate-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-5">
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">Teams</h1>
        <button
          onClick={mode ? closeForm : openCreate}
          disabled={!selectedTournament}
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
          {mode ? 'Schließen' : '+ Spieler'}
        </button>
      </div>

      {/* Tournament selector */}
      {tournaments.length > 1 && (
        <div className="px-4 mb-4">
          <select className={inputCls} value={selectedTournament?.id || ''}
            onChange={e => setSelectedTournament(tournaments.find(t => t.id === e.target.value))}>
            {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* No tournament — direct CTA */}
      {!loading && tournaments.length === 0 && (
        <div className="mx-4 mb-4 p-4 rounded-card bg-surface border border-line text-center">
          <p className="text-sm font-bold text-ink">Erst ein Turnier anlegen</p>
          <p className="text-xs text-inkMuted mt-1">
            Spieler und Teams gehören immer zu einem Turnier.
          </p>
          <button
            onClick={() => navigate('/cup?new=1')}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform">
            + Turnier anlegen
          </button>
        </div>
      )}

      {/* Form */}
      {mode && (
        <form onSubmit={handleSubmit}
          className="mx-4 mb-4 rounded-card p-4 flex flex-col gap-3 bg-surface border border-line animate-fade-up">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-inkMuted">
            {mode === 'edit' ? 'Spieler bearbeiten' : 'Neuer Spieler'}
          </p>
          <input className={inputCls} placeholder="Name *"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <div>
            <input type="number" step="0.1" min="0" max="54"
              className={`${inputCls} ${hcError ? 'border-danger' : ''}`}
              placeholder="Handicap * (0,0 – 54,0)"
              value={form.handicap}
              onChange={e => { setForm(f => ({ ...f, handicap: e.target.value })); setHcError(null) }} />
            {hcError && <p className="text-danger text-xs mt-1.5 pl-1">{hcError}</p>}
          </div>
          <div className="flex gap-2">
            {['A', 'B'].map(team => (
              <button key={team} type="button"
                onClick={() => setForm(f => ({ ...f, team }))}
                className={`flex-1 py-3 rounded-xl font-bold text-sm active:scale-[0.97] transition-all ${
                  form.team === team
                    ? team === 'A'
                      ? 'bg-teamA/20 text-teamA border border-teamA/40'
                      : 'bg-teamB/20 text-teamB border border-teamB/40'
                    : 'bg-bg text-inkMuted border border-line'
                }`}
              >
                {selectedTournament
                  ? (team === 'A' ? selectedTournament.team_a_name : selectedTournament.team_b_name)
                  : `Team ${team}`}
              </button>
            ))}
          </div>
          <button type="submit"
            className="py-3 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform">
            {mode === 'edit' ? 'Speichern' : 'Spieler hinzufügen'}
          </button>
        </form>
      )}

      {/* Player lists */}
      {loading ? <LoadingSpinner /> : locked && !showViewGate ? (
        <LockPlaceholder onUnlock={() => setShowViewGate(true)} />
      ) : !locked && (
        <>
          {[
            ['A', teamA, 'teamA', selectedTournament?.team_a_name],
            ['B', teamB, 'teamB', selectedTournament?.team_b_name],
          ].map(([team, list, klass, name]) => (
            <div key={team}>
              <div className="flex items-center gap-3 px-4 py-3 border-t border-lineSoft">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  team === 'A' ? 'bg-teamA/15 border-[1.5px] border-teamA' : 'bg-teamB/15 border-[1.5px] border-teamB'
                }`} />
                <p className={`text-[10px] font-bold tracking-[0.2em] uppercase ${
                  team === 'A' ? 'text-teamA' : 'text-teamB'
                }`}>
                  {name || `Team ${team}`}
                  <span className="ml-2 opacity-50 tabular-nums">{list.length}</span>
                </p>
              </div>

              {list.length === 0 ? (
                <p className="text-xs px-4 py-3 text-inkDim border-b border-lineSoft">
                  Noch keine Spieler
                </p>
              ) : (
                list.map((p, idx) => (
                  <div key={p.id}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-lineSoft"
                    style={{ animationDelay: `${idx * 25}ms` }}>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-ink">{p.name}</span>
                    </div>
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-md tabular-nums bg-bg text-inkMuted border border-line">
                      HC {Number(p.handicap).toFixed(1)}
                    </span>
                    <button onClick={() => openEdit(p)}
                      className="p-1.5 rounded-lg active:scale-90 transition-transform text-inkMuted hover:text-ink">
                      <PencilIcon />
                    </button>
                    <button onClick={() => guarded(() => setDeleteId(p.id))}
                      className="p-1.5 rounded-lg active:scale-90 transition-transform text-inkMuted hover:text-danger">
                      <CloseIcon />
                    </button>
                  </div>
                ))
              )}
            </div>
          ))}

          {players.length === 0 && !mode && (
            <div className="text-center py-16 px-6">
              <p className="text-sm text-inkMuted">Noch keine Spieler</p>
              <p className="text-xs mt-1 text-inkDim">
                Tippe <span className="text-accent font-semibold">+ Spieler</span>, um anzulegen
              </p>
            </div>
          )}
        </>
      )}

      {deleteId && (
        <ConfirmDialog message="Spieler löschen?" confirmText="Löschen"
          onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
      )}

      {showGate && selectedTournament && (
        <PasswordGate
          tournamentId={selectedTournament.id}
          onSuccess={handleGateSuccess}
          onCancel={() => { setShowGate(false); pendingRef.current = null }}
        />
      )}

      {showViewGate && selectedTournament && (
        <PasswordGate
          viewMode
          tournamentId={selectedTournament.id}
          onSuccess={handleViewGateSuccess}
          onCancel={() => setShowViewGate(false)}
        />
      )}
    </div>
  )
}
