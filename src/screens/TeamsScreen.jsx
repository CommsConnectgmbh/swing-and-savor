import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'

function validateHC(val) {
  const n = parseFloat(val)
  if (val === '' || val === null || val === undefined) return 'Handicap ist Pflicht'
  if (isNaN(n)) return 'Muss eine Zahl sein'
  if (n < 0 || n > 54) return 'Handicap muss zwischen 0.0 und 54.0 liegen'
  return null
}

export default function TeamsScreen() {
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [hcError, setHcError] = useState(null)
  const [form, setForm] = useState({ name: '', handicap: '', team: 'A' })

  useEffect(() => {
    supabase.from('tournaments').select('*').order('date', { ascending: false })
      .then(({ data }) => {
        setTournaments(data || [])
        if (data && data.length > 0) setSelectedTournament(data[0])
        setLoading(false)
      })
  }, [])

  useEffect(() => { if (selectedTournament) loadPlayers() }, [selectedTournament])

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('*')
      .eq('tournament_id', selectedTournament.id).order('team').order('name')
    setPlayers(data || [])
  }

  async function handleCreate(e) {
    e.preventDefault()
    const err = validateHC(form.handicap)
    if (err) { setHcError(err); return }
    await supabase.from('players').insert([{
      ...form,
      handicap: parseFloat(form.handicap),
      tournament_id: selectedTournament.id,
    }])
    setForm({ name: '', handicap: '', team: 'A' })
    setShowForm(false)
    setHcError(null)
    loadPlayers()
  }

  async function handleDelete() {
    await supabase.from('players').delete().eq('id', deleteId)
    setDeleteId(null)
    loadPlayers()
  }

  const teamA = players.filter(p => p.team === 'A')
  const teamB = players.filter(p => p.team === 'B')

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4 pt-4">
        <h1 className="text-2xl font-bold">Teams</h1>
        <button onClick={() => setShowForm(v => !v)}
          className="bg-accent text-black font-bold px-4 py-2 rounded-xl text-sm"
          disabled={!selectedTournament}>
          + Spieler
        </button>
      </div>

      {tournaments.length > 1 && (
        <select className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white mb-4"
          value={selectedTournament?.id || ''}
          onChange={e => setSelectedTournament(tournaments.find(t => t.id === e.target.value))}>
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-2xl p-4 mb-4 flex flex-col gap-3">
          <input className="bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted"
            placeholder="Name *" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <div>
            <input type="number" step="0.1" min="0" max="54"
              className={`w-full bg-bg border rounded-xl px-4 py-3 text-white placeholder-muted ` +
                (hcError ? 'border-danger' : 'border-border')}
              placeholder="Handicap * (0.0 – 54.0)"
              value={form.handicap}
              onChange={e => { setForm(f => ({ ...f, handicap: e.target.value })); setHcError(null) }} />
            {hcError && <p className="text-danger text-xs mt-1 pl-1">{hcError}</p>}
          </div>
          <div className="flex gap-2">
            {['A', 'B'].map(team => (
              <button key={team} type="button" onClick={() => setForm(f => ({ ...f, team }))}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ` +
                  (form.team === team ? 'bg-accent text-black' : 'bg-bg border border-border text-muted')}>
                {selectedTournament ? (team === 'A' ? selectedTournament.team_a_name : selectedTournament.team_b_name) : `Team ${team}`}
              </button>
            ))}
          </div>
          <button type="submit" className="bg-accent text-black font-bold py-3 rounded-xl">Spieler hinzufügen</button>
        </form>
      )}

      {loading ? <LoadingSpinner /> : (
        <>
          {[['A', teamA], ['B', teamB]].map(([team, list]) => (
            <div key={team} className="mb-4">
              <h2 className="text-accent font-bold text-sm uppercase tracking-widest mb-2">
                {team === 'A' ? selectedTournament?.team_a_name : selectedTournament?.team_b_name} · {list.length} Spieler
              </h2>
              <div className="flex flex-col gap-2">
                {list.map(p => (
                  <div key={p.id} className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted text-sm ml-2">HC {Number(p.handicap).toFixed(1)}</span>
                    </div>
                    <button onClick={() => setDeleteId(p.id)} className="text-danger text-sm px-2 py-1">✕</button>
                  </div>
                ))}
                {list.length === 0 && <p className="text-muted text-sm pl-1">Keine Spieler</p>}
              </div>
            </div>
          ))}
        </>
      )}

      {deleteId && (
        <ConfirmDialog message="Spieler wirklich löschen?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  )
}
