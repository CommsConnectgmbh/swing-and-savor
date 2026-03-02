import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'

export default function CupScreen() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState({ name: '', date: '', team_a_name: 'Team A', team_b_name: 'Team B' })

  useEffect(() => { loadTournaments() }, [])

  async function loadTournaments() {
    const { data } = await supabase.from('tournaments').select('*').order('date', { ascending: false })
    setTournaments(data || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name || !form.date) return
    await supabase.from('tournaments').insert([form])
    setForm({ name: '', date: '', team_a_name: 'Team A', team_b_name: 'Team B' })
    setShowForm(false)
    loadTournaments()
  }

  async function handleDelete() {
    await supabase.from('tournaments').delete().eq('id', deleteId)
    setDeleteId(null)
    loadTournaments()
  }

  async function toggleStatus(t) {
    const next = t.status === 'active' ? 'finished' : 'active'
    await supabase.from('tournaments').update({ status: next }).eq('id', t.id)
    loadTournaments()
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6 pt-4">
        <h1 className="text-2xl font-bold">Turniere</h1>
        <button onClick={() => setShowForm(v => !v)} className="bg-accent text-black font-bold px-4 py-2 rounded-xl text-sm">
          + Neu
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-2xl p-4 mb-4 flex flex-col gap-3">
          <input className="bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted"
            placeholder="Turniername *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input type="date" className="bg-bg border border-border rounded-xl px-4 py-3 text-white"
            value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          <input className="bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted"
            placeholder="Team A Name" value={form.team_a_name} onChange={e => setForm(f => ({ ...f, team_a_name: e.target.value }))} />
          <input className="bg-bg border border-border rounded-xl px-4 py-3 text-white placeholder-muted"
            placeholder="Team B Name" value={form.team_b_name} onChange={e => setForm(f => ({ ...f, team_b_name: e.target.value }))} />
          <button type="submit" className="bg-accent text-black font-bold py-3 rounded-xl">Turnier erstellen</button>
        </form>
      )}

      {loading ? <LoadingSpinner /> : (
        <div className="flex flex-col gap-3">
          {tournaments.map(t => (
            <div key={t.id} className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-lg">{t.name}</div>
                  <div className="text-muted text-sm">{new Date(t.date).toLocaleDateString('de-DE')}</div>
                  <div className="text-sm mt-1">{t.team_a_name} vs {t.team_b_name}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button onClick={() => toggleStatus(t)}
                    className={`text-xs px-3 py-1 rounded-full font-medium ` +
                      (t.status === 'active' ? 'bg-accent/20 text-accent' : 'bg-muted/20 text-muted')}>
                    {t.status === 'active' ? 'Aktiv' : 'Beendet'}
                  </button>
                  <button onClick={() => setDeleteId(t.id)} className="text-danger text-xs px-3 py-1 rounded-full border border-danger/30">
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          ))}
          {tournaments.length === 0 && <p className="text-muted text-center py-8">Noch keine Turniere. Erstelle dein erstes!</p>}
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          message="Turnier wirklich löschen? Alle Matches und Ergebnisse werden ebenfalls gelöscht."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
