import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Empty } from '../components/Empty'
import { useTournament, usePlayerLookup, addPlayer, addMatch } from '../hooks/useGolfData'
import { teamPoints } from '../lib/scoring'

function ScoreHero({ tournament, points }) {
  const target = 4.5 // visual reference; works for typical 8-match Ryder-style cups
  const aWidth = Math.max(8, Math.min(92, (points.a / Math.max(target, points.a + points.b || 1)) * 100))
  const bWidth = 100 - aWidth
  return (
    <div className="card relative overflow-hidden animate-fade-in">
      <div className="absolute -top-16 -left-12 w-48 h-48 rounded-full opacity-50 pointer-events-none animate-aurora"
           style={{ background: 'radial-gradient(closest-side, rgba(59,130,246,0.40), transparent)' }} />
      <div className="absolute -bottom-16 -right-12 w-48 h-48 rounded-full opacity-50 pointer-events-none animate-aurora"
           style={{ background: 'radial-gradient(closest-side, rgba(239,68,68,0.40), transparent)', animationDelay: '-8s' }} />
      <div className="relative">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">{tournament.team_a_name}</div>
            <div className="font-display text-5xl font-bold tabular-nums text-gradient-team-a leading-none mt-1">{points.a.toFixed(1)}</div>
          </div>
          <div className="text-xs text-muted px-2 pb-1">Punkte</div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">{tournament.team_b_name}</div>
            <div className="font-display text-5xl font-bold tabular-nums text-gradient-team-b leading-none mt-1">{points.b.toFixed(1)}</div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
          <div className="h-full transition-all duration-700"
               style={{ width: `${aWidth}%`, background: 'linear-gradient(90deg,#60a5fa,#6366f1)' }} />
          <div className="h-full transition-all duration-700"
               style={{ width: `${bWidth}%`, background: 'linear-gradient(90deg,#fb923c,#f87171)' }} />
        </div>
      </div>
    </div>
  )
}

function MatchRow({ match, lookup, tournamentId }) {
  const a1 = lookup(match.team_a_player1_id)
  const a2 = lookup(match.team_a_player2_id)
  const b1 = lookup(match.team_b_player1_id)
  const b2 = lookup(match.team_b_player2_id)

  const statusBadge = match.status === 'finished'
    ? <span className="chip text-ink/80">Beendet</span>
    : match.status === 'active'
      ? <span className="chip text-fairway" style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-fairway animate-pulse" /> Live
        </span>
      : <span className="chip text-muted">Offen</span>

  const winnerTint = match.winner === 'A' ? 'ring-1 ring-teamA/40' : match.winner === 'B' ? 'ring-1 ring-teamB/40' : ''

  return (
    <Link to={`/t/${tournamentId}/m/${match.id}`} className={`card block tap ${winnerTint}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="chip text-ink/80">
          {match.type === 'singles' ? 'Einzel' : 'Doppel'}
        </span>
        {statusBadge}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex -space-x-2">
            {a1 && <Avatar name={a1.name} team="A" size={36} />}
            {a2 && <Avatar name={a2.name} team="A" size={36} />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{a1?.name || '—'}{a2 ? ` & ${a2.name}` : ''}</div>
            {(a1 || a2) && <div className="text-[11px] text-muted">HCP {[a1?.handicap, a2?.handicap].filter(x => x != null).join(' / ') || '—'}</div>}
          </div>
        </div>
        <div className="text-muted text-xs font-semibold">vs</div>
        <div className="flex items-center gap-2 min-w-0 justify-end text-right">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{b1?.name || '—'}{b2 ? ` & ${b2.name}` : ''}</div>
            {(b1 || b2) && <div className="text-[11px] text-muted">HCP {[b1?.handicap, b2?.handicap].filter(x => x != null).join(' / ') || '—'}</div>}
          </div>
          <div className="flex -space-x-2">
            {b1 && <Avatar name={b1.name} team="B" size={36} />}
            {b2 && <Avatar name={b2.name} team="B" size={36} />}
          </div>
        </div>
      </div>
    </Link>
  )
}

function PlayerChip({ p }) {
  return (
    <div className="flex items-center gap-2 glass rounded-2xl px-2.5 py-1.5">
      <Avatar name={p.name} team={p.team} size={28} />
      <div className="min-w-0">
        <div className="text-[13px] font-medium truncate leading-tight">{p.name}</div>
        <div className="text-[10px] text-muted leading-tight">HCP {p.handicap}</div>
      </div>
    </div>
  )
}

function AddPlayerSheet({ tournamentId, onClose }) {
  const [name, setName] = useState('')
  const [hcp, setHcp] = useState('18.0')
  const [team, setTeam] = useState('A')
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await addPlayer({ tournament_id: tournamentId, name: name.trim(), handicap: parseFloat(hcp) || 0, team })
      onClose()
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={save} className="relative glass-strong rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5 m-0 sm:m-4 animate-slide-up shadow-glass-lg">
        <div className="w-12 h-1 rounded-full bg-white/15 mx-auto mb-4 sm:hidden" />
        <h3 className="heading mb-4">Spieler hinzufügen</h3>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="input mb-3" autoFocus />
        <input type="number" step="0.1" min="0" max="54" value={hcp} onChange={e => setHcp(e.target.value)} placeholder="Handicap" className="input mb-3" />
        <div className="flex gap-2 mb-5">
          {['A', 'B'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTeam(t)}
              className={`flex-1 px-4 py-3 rounded-2xl tap font-medium border transition ${
                team === t
                  ? t === 'A'
                    ? 'border-teamA/60 bg-teamA/15 text-ink'
                    : 'border-teamB/60 bg-teamB/15 text-ink'
                  : 'border-white/10 bg-white/[0.03] text-muted'
              }`}
            >
              Team {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-glass flex-1">Abbrechen</button>
          <button type="submit" disabled={busy || !name.trim()} className="btn-primary flex-1 disabled:opacity-50">
            {busy ? '…' : 'Hinzufügen'}
          </button>
        </div>
      </form>
    </div>
  )
}

function AddMatchSheet({ tournamentId, players, onClose }) {
  const [type, setType] = useState('singles')
  const [a1, setA1] = useState('')
  const [a2, setA2] = useState('')
  const [b1, setB1] = useState('')
  const [b2, setB2] = useState('')
  const [busy, setBusy] = useState(false)
  const teamA = players.filter(p => p.team === 'A')
  const teamB = players.filter(p => p.team === 'B')

  const save = async (e) => {
    e.preventDefault()
    if (!a1 || !b1) return
    if (type === 'doubles' && (!a2 || !b2)) return
    setBusy(true)
    try {
      await addMatch({
        tournament_id: tournamentId,
        type,
        team_a_player1_id: a1, team_a_player2_id: type === 'doubles' ? a2 : null,
        team_b_player1_id: b1, team_b_player2_id: type === 'doubles' ? b2 : null,
      })
      onClose()
    } finally { setBusy(false) }
  }

  const Select = ({ value, onChange, options, placeholder, accent }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`input ${accent === 'A' ? 'focus:border-teamA/60' : 'focus:border-teamB/60'}`}>
      <option value="" className="bg-bg">{placeholder}</option>
      {options.map(p => <option key={p.id} value={p.id} className="bg-bg">{p.name} (HCP {p.handicap})</option>)}
    </select>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={save} className="relative glass-strong rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5 m-0 sm:m-4 animate-slide-up shadow-glass-lg max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="w-12 h-1 rounded-full bg-white/15 mx-auto mb-4 sm:hidden" />
        <h3 className="heading mb-4">Match anlegen</h3>
        <div className="pill rounded-full p-1 grid grid-cols-2 gap-1 mb-4">
          {[['singles', 'Einzel'], ['doubles', 'Doppel']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setType(k)}
              className={`py-2 rounded-full text-sm font-medium tap ${type === k ? 'bg-white/15 text-ink' : 'text-muted'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="space-y-2 mb-3">
          <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Team A</div>
          <Select value={a1} onChange={setA1} options={teamA} placeholder="Spieler 1" accent="A" />
          {type === 'doubles' && <Select value={a2} onChange={setA2} options={teamA.filter(p => p.id !== a1)} placeholder="Spieler 2" accent="A" />}
        </div>
        <div className="space-y-2 mb-5">
          <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Team B</div>
          <Select value={b1} onChange={setB1} options={teamB} placeholder="Spieler 1" accent="B" />
          {type === 'doubles' && <Select value={b2} onChange={setB2} options={teamB.filter(p => p.id !== b1)} placeholder="Spieler 2" accent="B" />}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-glass flex-1">Abbrechen</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1 disabled:opacity-50">
            {busy ? '…' : 'Anlegen'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function TournamentDetail() {
  const { id } = useParams()
  const { tournament, players, matches, loading } = useTournament(id)
  const lookup = usePlayerLookup(players)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [showAddMatch, setShowAddMatch] = useState(false)

  if (loading) {
    return <div className="px-4 pb-safe space-y-3 mt-4">{[0,1,2].map(i => <div key={i} className="h-32 rounded-3xl shimmer" />)}</div>
  }
  if (!tournament) {
    return <div className="px-4 pb-safe">
      <Header title="Nicht gefunden" back />
      <Empty icon="Flag" title="Turnier nicht gefunden" hint="Vielleicht wurde es gelöscht oder die URL stimmt nicht." />
    </div>
  }

  const points = teamPoints(matches)
  const teamA = players.filter(p => p.team === 'A')
  const teamB = players.filter(p => p.team === 'B')

  return (
    <div className="px-4 pb-safe">
      <Header title={tournament.name} subtitle={new Date(tournament.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })} back />
      <main className="space-y-4 mt-1">
        <ScoreHero tournament={tournament} points={points} />

        {/* Matches */}
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
              <Icon.Flag size={14} stroke={2} /> Matches
            </h2>
            <button onClick={() => setShowAddMatch(true)} className="text-xs text-fairway font-medium tap flex items-center gap-1">
              <Icon.Plus size={14} stroke={2.4} /> Match
            </button>
          </div>
          {matches.length === 0 ? (
            <Empty
              icon="Flag"
              title="Keine Matches"
              hint="Lege das erste Einzel- oder Doppel-Match an."
              action={
                <button onClick={() => setShowAddMatch(true)} className="btn-primary">
                  <Icon.Plus size={18} /> Match anlegen
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {matches.map(m => <MatchRow key={m.id} match={m} lookup={lookup} tournamentId={tournament.id} />)}
            </div>
          )}
        </section>

        {/* Players */}
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
              <Icon.Players size={14} stroke={2} /> Spieler ({players.length})
            </h2>
            <button onClick={() => setShowAddPlayer(true)} className="text-xs text-fairway font-medium tap flex items-center gap-1">
              <Icon.Plus size={14} stroke={2.4} /> Spieler
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="card !p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: 'linear-gradient(135deg,#60a5fa,#6366f1)' }} />
                <span className="text-xs font-semibold text-ink/80 truncate">{tournament.team_a_name}</span>
              </div>
              <div className="space-y-2">
                {teamA.map(p => <PlayerChip key={p.id} p={p} />)}
                {teamA.length === 0 && <div className="text-xs text-muted py-2">Noch keine Spieler.</div>}
              </div>
            </div>
            <div className="card !p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: 'linear-gradient(135deg,#f87171,#fb923c)' }} />
                <span className="text-xs font-semibold text-ink/80 truncate">{tournament.team_b_name}</span>
              </div>
              <div className="space-y-2">
                {teamB.map(p => <PlayerChip key={p.id} p={p} />)}
                {teamB.length === 0 && <div className="text-xs text-muted py-2">Noch keine Spieler.</div>}
              </div>
            </div>
          </div>
        </section>
      </main>

      {showAddPlayer && <AddPlayerSheet tournamentId={tournament.id} onClose={() => setShowAddPlayer(false)} />}
      {showAddMatch && <AddMatchSheet tournamentId={tournament.id} players={players} onClose={() => setShowAddMatch(false)} />}
    </div>
  )
}
