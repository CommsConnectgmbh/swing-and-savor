import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'

export default function MatchesScreen() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [selected, setSelected] = useState(null)
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState({ type: 'singles', a1: '', a2: '', b1: '', b2: '' })

  useEffect(() => {
    supabase.from('tournaments').select('*').order('date', { ascending: false })
      .then(({ data }) => {
        setTournaments(data || [])
        if (data?.length > 0) setSelected(data[0])
        setLoading(false)
      })
  }, [])

  useEffect(() => { if (selected) { loadMatches(); loadPlayers() } }, [selected])

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
    const { data } = await supabase.from('players').select('*').eq('tournament_id', selected.id).order('team').order('name')
    setPlayers(data || [])
  }

  async function handleCreate(e) {
    e.preventDefault()
    await supabase.from('matches').insert([{
      tournament_id: selected.id,
      type: form.type,
      team_a_player1_id: form.a1 || null,
      team_a_player2_id: form.type === 'doubles' ? (form.a2 || null) : null,
      team_b_player1_id: form.b1 || null,
      team_b_player2_id: form.type === 'doubles' ? (form.b2 || null) : null,
    }])
    setForm({ type: 'singles', a1: '', a2: '', b1: '', b2: '' })
    setShowForm(false)
    loadMatches()
  }

  async function handleDelete() {
    await supabase.from('matches').delete().eq('id', deleteId)
    setDeleteId(null)
    loadMatches()
  }

  const teamA = players.filter(p => p.team === 'A')
  const teamB = players.filter(p => p.team === 'B')

  function matchLabel(m) {
    const a = [m.pa1?.name, m.pa2?.name].filter(Boolean).join(' / ')
    const b = [m.pb1?.name, m.pb2?.name].filter(Boolean).join(' / ')
    return `${a || '—'} vs ${b || '—'}`
  }

  const statusColor = { pending: 'text-muted', active: 'text-warn', finished: 'text-accent' }
  const statusLabel = { pending: 'Ausstehend', active: 'Läuft', finished: 'Beendet' }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4 pt-4">
        <h1 className="text-2xl font-bold">Matches</h1>
        <button onClick={() => setShowForm(v => !v)}
          className="bg-accent text-black font-bold px-4 py-2 rounded-xl text-sm" disabled={!selected}>
          + Match
        </button>
      </div>

      {tournaments.length > 1 && (
        <select className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white mb-4"
          value={selected?.id || ''}
          onChange={e => setSelected(tournaments.find(t => t.id === e.target.value))}>
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-2xl p-4 mb-4 flex flex-col gap-3">
          <div className="flex gap-2">
            {['singles', 'doubles'].map(type => (
              <button key={type} type="button" onClick={() => setForm(f => ({ ...f, type }))}
                className={`flex-1 py-3 rounded-xl font-bold text-sm ` +
                  (form.type === type ? 'bg-accent text-black' : 'bg-bg border border-border text-muted')}>
                {type === 'singles' ? '⚔️ Einzel' : '👥 Doppel'}
              </button>
            ))}
          </div>
          <p className="text-muted text-xs uppercase tracking-widest">{selected?.team_a_name}</p>
          <PlayerSelect label="Spieler A1" value={form.a1} options={teamA} onChange={v => setForm(f => ({ ...f, a1: v }))} />
          {form.type === 'doubles' && (
            <PlayerSelect label="Spieler A2" value={form.a2} options={teamA} onChange={v => setForm(f => ({ ...f, a2: v }))} />
          )}
          <p className="text-muted text-xs uppercase tracking-widest">{selected?.team_b_name}</p>
          <PlayerSelect label="Spieler B1" value={form.b1} options={teamB} onChange={v => setForm(f => ({ ...f, b1: v }))} />
          {form.type === 'doubles' && (
            <PlayerSelect label="Spieler B2" value={form.b2} options={teamB} onChange={v => setForm(f => ({ ...f, b2: v }))} />
          )}
          <button type="submit" className="bg-accent text-black font-bold py-3 rounded-xl">Match anlegen</button>
        </form>
      )}

      {loading ? <LoadingSpinner /> : (
        <div className="flex flex-col gap-3">
          {matches.map(m => (
            <div key={m.id} className="bg-surface border border-border rounded-2xl p-4 active:opacity-80"
              onClick={() => navigate(`/matches/${m.id}`)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xs text-muted mb-1">{m.type === 'singles' ? '⚔️ Einzel' : '👥 Doppel'}</div>
                  <div className="font-medium text-sm">{matchLabel(m)}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs font-medium ${statusColor[m.status]}`}>{statusLabel[m.status]}</span>
                  <button onClick={e => { e.stopPropagation(); setDeleteId(m.id) }} className="text-danger text-xs px-2 py-1">✕</button>
                </div>
              </div>
            </div>
          ))}
          {matches.length === 0 && <p className="text-muted text-center py-8">Noch keine Matches angelegt.</p>}
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          message="Match wirklich löschen? Alle eingetragenen Ergebnisse gehen verloren."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

function PlayerSelect({ label, value, options, onChange }) {
  return (
    <select className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-white"
      value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{label} wählen…</option>
      {options.map(p => (
        <option key={p.id} value={p.id}>{p.name} (HC {Number(p.handicap).toFixed(1)})</option>
      ))}
    </select>
  )
}
