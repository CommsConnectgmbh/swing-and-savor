import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import PasswordGate from '../components/PasswordGate'

const emptyForm = {
  name: '', date: '',
  team_a_name: 'Team A', team_b_name: 'Team B',
  edit_password: '',
  visibility: 'friends',
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  )
}

function LockIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  )
}

function isUnlocked(t) {
  if (!t?.edit_password) return true
  try { return sessionStorage.getItem(`golf_unlocked_${t.id}`) === '1' } catch { return false }
}

export default function CupScreen() {
  const { user } = useAuth()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showGate, setShowGate] = useState(false)
  const [gateTournament, setGateTournament] = useState(null)
  const pendingRef = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => { loadTournaments() }, [])

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setForm(emptyForm); setEditId(null); setMode('create')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  async function loadTournaments() {
    const { data } = await supabase.from('tournaments').select('*').order('date', { ascending: false })
    setTournaments(data || [])
    setLoading(false)
  }

  function guarded(t, action) {
    if (isUnlocked(t)) { action() }
    else { setGateTournament(t); pendingRef.current = action; setShowGate(true) }
  }

  function handleGateSuccess() {
    setShowGate(false)
    if (pendingRef.current) { pendingRef.current(); pendingRef.current = null }
  }

  function openCreate() { setForm(emptyForm); setEditId(null); setMode('create') }

  function openEdit(t) {
    guarded(t, () => {
      setForm({
        name: t.name, date: t.date,
        team_a_name: t.team_a_name, team_b_name: t.team_b_name,
        edit_password: t.edit_password || '',
        visibility: t.visibility || 'friends',
      })
      setEditId(t.id); setMode('edit')
    })
  }

  function closeForm() { setMode(null); setEditId(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.date) return
    const payload = {
      name: form.name, date: form.date,
      team_a_name: form.team_a_name, team_b_name: form.team_b_name,
      edit_password: form.edit_password.trim() || null,
      visibility: form.visibility,
    }
    if (mode === 'create') {
      if (user) payload.owner_id = user.id
      await supabase.from('tournaments').insert([payload])
    } else {
      await supabase.from('tournaments').update(payload).eq('id', editId)
    }
    closeForm(); loadTournaments()
  }

  async function handleDelete() {
    await supabase.from('tournaments').delete().eq('id', deleteId)
    setDeleteId(null); loadTournaments()
  }

  async function toggleStatus(t) {
    guarded(t, async () => {
      const next = t.status === 'active' ? 'finished' : 'active'
      await supabase.from('tournaments').update({ status: next }).eq('id', t.id)
      loadTournaments()
    })
  }

  const inputCls = 'w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm transition-colors focus:border-accent/60'

  return (
    <div className="max-w-lg mx-auto animate-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-5">
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">Turniere</h1>
        <button
          onClick={mode ? closeForm : openCreate}
          className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wide active:scale-[0.97] transition-all ${
            mode
              ? 'bg-surface text-inkMuted border border-line'
              : 'bg-accent text-brandDark'
          }`}
        >
          {mode ? 'Schließen' : '+ Neu'}
        </button>
      </div>

      {/* Form */}
      {mode && (
        <form onSubmit={handleSubmit}
          className="mx-4 mb-4 rounded-card p-4 flex flex-col gap-3 bg-surface border border-line animate-fade-up">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-inkMuted">
            {mode === 'edit' ? 'Turnier bearbeiten' : 'Neues Turnier'}
          </p>
          <input className={inputCls} placeholder="Turnier-Name *"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input type="date" className={inputCls}
            value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} placeholder="Team A"
              value={form.team_a_name} onChange={e => setForm(f => ({ ...f, team_a_name: e.target.value }))} />
            <input className={inputCls} placeholder="Team B"
              value={form.team_b_name} onChange={e => setForm(f => ({ ...f, team_b_name: e.target.value }))} />
          </div>
          {/* Visibility */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">Sichtbarkeit</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['public',  'Öffentlich', 'Alle sehen es'],
                ['friends', 'Freunde',    'Nur Freunde'],
                ['private', 'Privat',     'Nur eingeladen'],
              ].map(([val, label, hint]) => (
                <button key={val} type="button"
                  onClick={() => setForm(f => ({ ...f, visibility: val }))}
                  className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl active:scale-[0.97] transition-all ${
                    form.visibility === val
                      ? 'bg-accent/15 text-accent border border-accent/40'
                      : 'bg-bg text-inkMuted border border-line'
                  }`}>
                  <span className="text-xs font-bold">{label}</span>
                  <span className="text-[9px] tracking-wide opacity-75">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Legacy password (optional) */}
          <div>
            <input
              className={inputCls}
              placeholder="Schreibschutz-Passwort (optional)"
              value={form.edit_password}
              onChange={e => setForm(f => ({ ...f, edit_password: e.target.value }))}
              autoComplete="off"
            />
            <p className="text-[10px] mt-1.5 pl-1 text-inkDim">
              Zusatz-Schutz für Edits — Login regelt schon, wer es sieht.
            </p>
          </div>
          <button type="submit"
            className="py-3 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform">
            {mode === 'edit' ? 'Speichern' : 'Turnier anlegen'}
          </button>
        </form>
      )}

      {/* List */}
      {loading ? <LoadingSpinner /> : (
        <div className="border-t border-lineSoft">
          {tournaments.map((t, idx) => (
            <div key={t.id}
              className="flex items-center gap-3 px-4 py-4 border-b border-lineSoft"
              style={{ animationDelay: `${idx * 30}ms` }}>
              {/* Status dot */}
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                t.status === 'active' ? 'bg-accent shadow-glow' : 'bg-line'
              }`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight text-ink flex items-center gap-1.5">
                  {t.name}
                  {t.edit_password && <span className="text-lock"><LockIcon /></span>}
                </p>
                <p className="text-xs mt-0.5 text-inkMuted flex items-center gap-1.5 flex-wrap">
                  <span>{new Date(t.date + 'T12:00:00').toLocaleDateString('de-DE')}</span>
                  <span className="text-inkDim">·</span>
                  <span className="text-teamA">{t.team_a_name}</span>
                  <span className="text-inkDim">vs</span>
                  <span className="text-teamB">{t.team_b_name}</span>
                  {t.visibility && t.invite_code && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation();
                        navigator.clipboard?.writeText(t.invite_code) }}
                      className="text-[10px] font-bold tracking-[0.15em] uppercase text-inkDim hover:text-accent transition-colors tabular-nums"
                      title="Code kopieren">
                      #{t.invite_code}
                    </button>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleStatus(t)}
                  className={`text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-md active:scale-95 transition-transform ${
                    t.status === 'active'
                      ? 'bg-accent/12 text-accent border border-accent/30'
                      : 'bg-surface text-inkMuted border border-line'
                  }`}
                >
                  {t.status === 'active' ? 'Aktiv' : 'Beendet'}
                </button>
                <button onClick={() => openEdit(t)}
                  className="p-2 rounded-lg active:scale-90 transition-transform text-inkMuted hover:text-ink">
                  <PencilIcon />
                </button>
                <button onClick={() => guarded(t, () => setDeleteId(t.id))}
                  className="p-2 rounded-lg active:scale-90 transition-transform text-inkMuted hover:text-danger">
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}

          {tournaments.length === 0 && !mode && (
            <div className="text-center py-16 px-6">
              <p className="text-sm text-inkMuted">Noch keine Turniere</p>
              <p className="text-xs mt-1 text-inkDim">Tippe <span className="text-accent font-semibold">+ Neu</span>, um anzufangen</p>
            </div>
          )}
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          message="Turnier löschen? Alle Matches und Ergebnisse gehen verloren."
          confirmText="Löschen"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {showGate && gateTournament && (
        <PasswordGate
          correctPassword={gateTournament.edit_password}
          tournamentId={gateTournament.id}
          onSuccess={handleGateSuccess}
          onCancel={() => { setShowGate(false); pendingRef.current = null }}
        />
      )}
    </div>
  )
}
