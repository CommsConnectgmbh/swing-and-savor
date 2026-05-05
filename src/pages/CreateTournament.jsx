import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Icon } from '../components/Icon'
import { createTournament } from '../hooks/useGolfData'

export default function CreateTournament() {
  const nav = useNavigate()
  const today = new Date().toISOString().slice(0, 10)
  const [name, setName] = useState('')
  const [date, setDate] = useState(today)
  const [teamA, setTeamA] = useState('Team A')
  const [teamB, setTeamB] = useState('Team B')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      const t = await createTournament({ name: name.trim(), date, team_a_name: teamA.trim() || 'Team A', team_b_name: teamB.trim() || 'Team B' })
      nav(`/t/${t.id}`, { replace: true })
    } finally { setBusy(false) }
  }

  return (
    <div className="px-4 pb-safe">
      <Header title="Neues Turnier" subtitle="Match-Play einrichten" back />
      <form onSubmit={submit} className="space-y-4 mt-1 animate-slide-up">
        <div className="card">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z. B. Ryder Cup Stuttgart"
            className="input"
            autoFocus
          />
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mt-4 mb-2">Datum</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        <div className="card">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Teams</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'linear-gradient(135deg,#60a5fa,#6366f1)' }} />
                <span className="text-xs text-ink/70">Team A</span>
              </div>
              <input value={teamA} onChange={e => setTeamA(e.target.value)} className="input" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'linear-gradient(135deg,#f87171,#fb923c)' }} />
                <span className="text-xs text-ink/70">Team B</span>
              </div>
              <input value={teamB} onChange={e => setTeamB(e.target.value)} className="input" />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="btn-primary w-full disabled:opacity-50 disabled:saturate-50"
        >
          {busy ? 'Wird erstellt…' : <><Icon.Check size={18} /> Turnier starten</>}
        </button>
      </form>
    </div>
  )
}
