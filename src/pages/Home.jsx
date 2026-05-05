import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { Empty } from '../components/Empty'
import { Icon } from '../components/Icon'
import { useTournaments } from '../hooks/useGolfData'
import { hasSupabase } from '../lib/supabase'

function formatDate(d) {
  try {
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d))
  } catch { return d }
}

function TournamentCard({ t }) {
  const live = t.status === 'active'
  return (
    <Link to={`/t/${t.id}`} className="block animate-slide-up tap">
      <div className="card relative overflow-hidden">
        {/* color wash */}
        <div className="absolute inset-0 opacity-60 pointer-events-none"
             style={{
               background:
                 'radial-gradient(80% 60% at 0% 0%, rgba(34,197,94,0.18), transparent 60%),' +
                 'radial-gradient(60% 60% at 100% 100%, rgba(56,189,248,0.14), transparent 60%)',
             }} />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <span className="chip text-ink/80">
              <Icon.Calendar size={14} stroke={2} /> {formatDate(t.date)}
            </span>
            {live ? (
              <span className="chip text-fairway" style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-fairway animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="chip text-muted">Beendet</span>
            )}
          </div>
          <h3 className="text-xl font-semibold tracking-tight font-display mb-3 leading-tight">{t.name}</h3>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'linear-gradient(135deg,#60a5fa,#6366f1)' }} />
              <span className="truncate text-ink/90">{t.team_a_name}</span>
            </div>
            <span className="text-muted text-xs font-medium">VS</span>
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <span className="truncate text-ink/90">{t.team_b_name}</span>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'linear-gradient(135deg,#f87171,#fb923c)' }} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function HeroBanner() {
  return (
    <div className="card relative overflow-hidden animate-fade-in mb-4">
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-50 animate-aurora pointer-events-none"
           style={{ background: 'radial-gradient(closest-side, rgba(34,197,94,0.45), transparent)' }} />
      <div className="absolute -bottom-16 -left-16 w-52 h-52 rounded-full opacity-40 animate-aurora pointer-events-none"
           style={{ background: 'radial-gradient(closest-side, rgba(56,189,248,0.40), transparent)', animationDelay: '-6s' }} />
      <div className="relative">
        <span className="chip text-ink/80 mb-3">
          <Icon.Sparkles size={14} stroke={2} /> Saison 2026
        </span>
        <h2 className="font-display text-3xl font-bold tracking-tight leading-[1.1]">
          <span className="text-gradient-brand">Golf Cup.</span><br/>
          <span className="text-ink">Match-Play, live.</span>
        </h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          Hole-by-hole-Scoring mit Echtzeit-Updates für dein Team. Kein Setup, kein Stift, kein Stress.
        </p>
      </div>
    </div>
  )
}

export default function Home() {
  const { tournaments, loading } = useTournaments()
  const live = tournaments.filter(t => t.status === 'active')
  const past = tournaments.filter(t => t.status !== 'active')

  return (
    <div className="px-4 pb-safe">
      <Header
        title="Golf Cup"
        subtitle={hasSupabase ? 'Realtime · Sync aktiv' : 'Demo-Modus'}
        right={
          <Link to="/create" className="w-10 h-10 rounded-2xl glass tap flex items-center justify-center text-fairway" aria-label="Neues Turnier">
            <Icon.Plus />
          </Link>
        }
      />

      <main className="space-y-4 mt-1">
        <HeroBanner />

        {loading ? (
          <div className="space-y-3">
            {[0,1,2].map(i => <div key={i} className="h-32 rounded-3xl shimmer" />)}
          </div>
        ) : tournaments.length === 0 ? (
          <Empty
            icon="Trophy"
            title="Noch keine Turniere"
            hint="Starte ein neues Turnier und lade dein Team in unter einer Minute ein."
            action={<Link to="/create" className="btn-primary"><Icon.Plus size={18} /> Turnier erstellen</Link>}
          />
        ) : (
          <>
            {live.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted px-1 mb-2 flex items-center gap-2">
                  <Icon.Live size={14} stroke={2} /> Live & geplant
                </h2>
                <div className="space-y-3">
                  {live.map(t => <TournamentCard key={t.id} t={t} />)}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted px-1 mb-2 mt-2 flex items-center gap-2">
                  <Icon.Trophy size={14} stroke={2} /> Archiv
                </h2>
                <div className="space-y-3">
                  {past.map(t => <TournamentCard key={t.id} t={t} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
