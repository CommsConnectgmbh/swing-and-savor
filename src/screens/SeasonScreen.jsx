import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import LanguageQuickSwitch from '../components/LanguageQuickSwitch'
import ShareSheet from '../components/ShareSheet'
import { functionUrl, publicFunctionHeaders } from '../lib/functions'
import { buildCupRoute } from '../lib/links'

function CupRow({ cup }) {
  const finished = cup.status === 'finished'
  const date = new Date(cup.date).toLocaleDateString('de-DE',
    { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <Link to={buildCupRoute(cup)}
          className="flex items-center justify-between hairline-b py-5 active:bg-surface/40 transition-colors">
      <div className="min-w-0 flex-1 pr-4">
        <p className="font-display text-ink text-[20px] leading-tight"
           style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>{cup.name}</p>
        <p className="text-[11px] tracking-[0.22em] uppercase text-inkDim mt-1">
          {[cup.location_name, date].filter(Boolean).join('  ·  ')}
        </p>
        {cup.champion && (
          <p className="text-[12px] text-accent tracking-wide mt-1">Champion: {cup.champion}</p>
        )}
      </div>
      <span className="text-[10px] tracking-[0.28em] uppercase text-inkMuted">
        {finished ? 'Recap' : 'Live'}
      </span>
    </Link>
  )
}

export default function SeasonScreen() {
  const { t } = useTranslation()
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null)
    fetch(`${functionUrl('public-season')}?slug=${encodeURIComponent(slug)}`, {
      headers: publicFunctionHeaders(),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) { setErr(j?.error || 'error'); setLoading(false); return }
        setData(j)
        document.title = `${j.season.name} · Season · Swing & Savor`
        setLoading(false)
      })
      .catch((e) => { if (!cancelled) { setErr(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [slug])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg"><LoadingSpinner /></div>
  if (err || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="text-inkMuted text-sm mb-4">Season nicht verfügbar.</p>
        <Link to="/" className="text-accent text-sm font-medium tracking-[0.22em] uppercase">{t('app.name')} →</Link>
      </div>
    )
  }

  const { season, stats, standings, cups, group } = data
  const range = [
    season.starts_on && new Date(season.starts_on).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }),
    season.ends_on   && new Date(season.ends_on).toLocaleDateString('de-DE',   { month: 'short', year: 'numeric' }),
  ].filter(Boolean).join('  →  ')
  const typeLabel = { season: 'Season', league: 'League', city_rivalry: 'City Rivalry', tour: 'Tour' }[season.type] || 'Season'
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="px-5 pt-5 flex items-center justify-between">
        <Link to="/" aria-label="Swing & Savor" className="flex items-center gap-2.5 select-none">
          <img src="/logo.png" alt="" aria-hidden="true" width="32" height="32"
               className="rounded-lg flex-shrink-0"
               style={{ boxShadow: 'inset 0 0 0 1px rgba(217,201,168,0.18)' }} />
          <span className="font-display text-ink text-[15px] leading-none" style={{ fontWeight: 600 }}>
            Swing<span style={{ color: '#D9C9A8' }}> &amp; </span>Savor
          </span>
        </Link>
        <LanguageQuickSwitch />
      </header>

      {/* HERO */}
      <section className="relative px-5 pt-12 pb-10">
        {season.cover_url ? (
          <div className="absolute inset-x-0 top-0 h-[460px] overflow-hidden pointer-events-none">
            <img src={season.cover_url} alt="" aria-hidden="true"
                 className="w-full h-full object-cover opacity-[0.32]" />
            <div className="absolute inset-0"
                 style={{ background: 'linear-gradient(180deg, rgba(10,26,18,0.16) 0%, rgba(10,26,18,1) 78%)' }} />
          </div>
        ) : (
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[360px] pointer-events-none"
               style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(217,201,168,0.10), transparent 60%)' }} />
        )}
        <div className="relative max-w-lg mx-auto">
          <p className="font-sans text-[10px] tracking-[0.42em] uppercase text-accent mb-5">{typeLabel}</p>
          <h1 className="font-display text-ink leading-[0.92] mb-3"
              style={{ fontSize: 'clamp(40px, 9vw, 64px)', fontWeight: 500, letterSpacing: '-0.02em' }}>
            {season.name}
          </h1>
          {(range || group) && (
            <p className="text-[12px] tracking-[0.22em] uppercase text-inkMuted">
              {[group?.name, range].filter(Boolean).join('  ·  ')}
            </p>
          )}
          {season.description && (
            <p className="text-ink/80 text-[15px] leading-[1.65] mt-7 max-w-[460px]">{season.description}</p>
          )}
        </div>
      </section>

      <div className="hairline-t" />

      {/* Stats */}
      <section className="px-5 py-8 max-w-lg mx-auto">
        <div className="grid grid-cols-3 hairline-t hairline-b">
          {[
            { label: 'Cups',      value: stats.cups_total },
            { label: 'Played',    value: stats.cups_finished },
            { label: 'Upcoming',  value: stats.cups_total - stats.cups_finished },
          ].map((s, i) => (
            <div key={i} className={`py-5 text-center ${i < 2 ? 'border-r border-[rgba(244,241,234,0.08)]' : ''}`}>
              <p className="font-display text-ink tabular-nums" style={{ fontSize: 32, fontWeight: 500 }}>{s.value}</p>
              <p className="text-[10px] tracking-[0.32em] uppercase text-inkDim mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Season Standings */}
      {standings.length > 0 && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-10 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-5">Standings</p>
            <ul className="hairline bg-surface/40 overflow-hidden">
              {standings.map((row, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3.5"
                    style={{ borderBottom: i < standings.length - 1 ? '1px solid rgba(244,241,234,0.06)' : 'none' }}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="font-display tabular-nums w-8 text-center leading-none"
                          style={{ fontSize: 20, fontWeight: 500,
                                   color: i === 0 ? '#D9C9A8' : i === 1 ? '#C7C0B5' : i === 2 ? '#A8956A' : '#5C7068' }}>
                      {i + 1}
                    </span>
                    <span className="text-[14px] text-ink truncate">{row.name}</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-[10px] tracking-[0.22em] uppercase text-inkDim">{row.wins} wins</span>
                    <span className="font-display text-ink tabular-nums" style={{ fontSize: 20, fontWeight: 500 }}>
                      {row.points}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-[10px] tracking-[0.22em] uppercase text-inkDim mt-3 text-center">
              3 points for a win · 1 for a draw
            </p>
          </section>
        </>
      )}

      {/* Cups */}
      {cups.length > 0 && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-10 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">Schedule</p>
            <div>{cups.map((c) => <CupRow key={c.id} cup={c} />)}</div>
          </section>
        </>
      )}

      {/* CTA */}
      <div className="hairline-t" />
      <section className="px-5 py-12 max-w-lg mx-auto">
        <button onClick={() => setShareOpen(true)}
                className="w-full text-center py-5 hairline text-ink text-[13px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform">
          Share Season
        </button>
        <p className="text-center text-[11px] text-inkDim mt-10 tracking-[0.22em] uppercase">Powered by Swing &amp; Savor</p>
      </section>

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)}
        url={shareUrl} text={`${season.name} · Season on Swing & Savor — ${shareUrl}`} title="Share Season" />
    </div>
  )
}
