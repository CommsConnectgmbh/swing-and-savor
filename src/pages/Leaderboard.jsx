import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { Empty } from '../components/Empty'
import { Icon } from '../components/Icon'
import { useTournaments, useAllMatches } from '../hooks/useGolfData'
import { teamPoints } from '../lib/scoring'

// Lightweight per-tournament summary using only tournaments + matches in store.
// Subscribes to a few tournaments at once via the existing useTournament hook would
// over-fetch — here we render a static, aesthetic standings summary instead.
function StandingsRow({ t }) {
  const points = teamPoints(t.matches || [])
  const lead = points.a > points.b ? 'A' : points.b > points.a ? 'B' : null
  const isFinished = t.status !== 'active'

  return (
    <Link to={`/t/${t.id}`} className="block tap">
      <div className="card relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1"
             style={{
               background: lead === 'A'
                 ? 'linear-gradient(180deg,#60a5fa,#6366f1)'
                 : lead === 'B'
                   ? 'linear-gradient(180deg,#f87171,#fb923c)'
                   : 'linear-gradient(180deg,#94a3b8,#475569)',
             }} />
        <div className="flex items-start justify-between gap-3 mb-2 pl-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{t.name}</div>
            <div className="text-[11px] text-muted">{new Date(t.date).toLocaleDateString('de-DE')}</div>
          </div>
          {isFinished
            ? <span className="chip text-muted">Final</span>
            : <span className="chip text-fairway" style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-fairway animate-pulse" /> Live
              </span>}
        </div>
        <div className="grid grid-cols-2 gap-2 pl-2">
          <div className="flex items-center justify-between glass rounded-2xl px-3 py-2">
            <span className="text-xs text-ink/80 truncate">{t.team_a_name}</span>
            <span className="font-display text-lg font-bold tabular-nums text-gradient-team-a">{points.a.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between glass rounded-2xl px-3 py-2">
            <span className="text-xs text-ink/80 truncate">{t.team_b_name}</span>
            <span className="font-display text-lg font-bold tabular-nums text-gradient-team-b">{points.b.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function Leaderboard() {
  const { tournaments, loading } = useTournaments()
  const allMatches = useAllMatches()
  const enriched = tournaments.map(t => ({
    ...t,
    matches: allMatches.filter(m => m.tournament_id === t.id),
  }))

  return (
    <div className="px-4 pb-safe">
      <Header title="Standings" subtitle="Punktestand pro Turnier" />
      <main className="space-y-3 mt-1">
        {loading ? (
          [0,1,2].map(i => <div key={i} className="h-28 rounded-3xl shimmer" />)
        ) : enriched.length === 0 ? (
          <Empty icon="Stats" title="Keine Daten" hint="Lege ein Turnier an und das Leaderboard erscheint hier." />
        ) : (
          enriched.map(t => <StandingsRow key={t.id} t={t} />)
        )}

        <div className="card !p-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center text-fairway">
              <Icon.Sparkles />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Echtzeit-Sync</div>
              <div className="text-xs text-muted">Punkte aktualisieren sich automatisch beim Loch-Eintrag.</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
