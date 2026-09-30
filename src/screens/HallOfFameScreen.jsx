import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import LanguageQuickSwitch from '../components/LanguageQuickSwitch'
import ShareSheet from '../components/ShareSheet'
import { functionUrl, publicFunctionHeaders } from '../lib/functions'
import { initials as nameInitials } from '../lib/names'
import CupRow from '../components/CupRow'

function Avatar({ src, name, size = 80 }) {
  const initials = nameInitials(name)
  return (
    <div
      className="rounded-full overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, border: '1px solid rgba(244,241,234,0.16)' }}
    >
      {src
        ? <img src={src} alt={name || ''} className="w-full h-full object-cover" loading="lazy" />
        : <span className="font-display text-ink uppercase tracking-wider" style={{ fontSize: size / 3.2 }}>{initials}</span>}
    </div>
  )
}

export default function HallOfFameScreen() {
  const { t } = useTranslation()
  const { handle } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [rivalries, setRivalries] = useState([])

  useEffect(() => {
    if (!handle) return
    fetch(`${functionUrl('public-rivalries')}?handle=${encodeURIComponent(handle)}`, {
      headers: publicFunctionHeaders(),
    })
      .then(async (r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.rivalries) setRivalries(j.rivalries) })
      .catch(() => {})
  }, [handle])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    fetch(`${functionUrl('public-hall')}?handle=${encodeURIComponent(handle)}`, {
      headers: publicFunctionHeaders(),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) { setErr(j?.error || 'error'); setLoading(false); return }
        setData(j)
        document.title = `${j.captain.display_name || handle} · Hall of Fame · Swing & Savor`
        setLoading(false)
      })
      .catch((e) => { if (!cancelled) { setErr(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [handle])

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <LoadingSpinner />
      </div>
    )
  }
  if (err || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="text-inkMuted text-sm mb-4">Hall of Fame nicht verfügbar.</p>
        <Link to="/" className="text-accent text-sm font-medium tracking-[0.22em] uppercase">
          {t('app.name')} →
        </Link>
      </div>
    )
  }

  const { captain, stats, champion_tally: tally, finished_cups, active_cups } = data
  const memberSince = captain.member_since
    ? new Date(captain.member_since).getFullYear()
    : ''

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Top bar */}
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
      <section className="px-5 pt-10 pb-10 max-w-lg mx-auto">
        <p className="font-sans text-[10px] tracking-[0.42em] uppercase text-accent mb-6">
          Hall of Fame
        </p>
        <div className="flex items-center gap-5">
          <Avatar src={captain.avatar_url} name={captain.display_name || captain.handle} size={88} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-ink leading-none mb-2"
                style={{ fontSize: 'clamp(28px, 6.5vw, 40px)', fontWeight: 500, letterSpacing: '-0.015em' }}>
              {captain.display_name || `@${captain.handle}`}
            </h1>
            <p className="text-[11px] tracking-[0.22em] uppercase text-inkMuted">
              {[captain.handle ? `@${captain.handle}` : null, captain.home_club, memberSince ? `Since ${memberSince}` : null]
                .filter(Boolean).join('  ·  ')}
            </p>
          </div>
        </div>

        {/* Stat-Row */}
        <div className="grid grid-cols-3 mt-10 hairline-t hairline-b">
          {[
            { label: 'Cups',    value: stats.cups_total    },
            { label: 'Live',    value: stats.cups_active   },
            { label: 'Champions', value: tally.reduce((a, c) => a + c.wins, 0) },
          ].map((s, i) => (
            <div key={i} className={`py-5 text-center ${i < 2 ? 'border-r border-[rgba(244,241,234,0.08)]' : ''}`}>
              <p className="font-display text-ink tabular-nums" style={{ fontSize: 32, fontWeight: 500 }}>
                {s.value}
              </p>
              <p className="text-[10px] tracking-[0.32em] uppercase text-inkDim mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CHAMPION TALLY */}
      {tally.length > 0 && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-10 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-6">
              Champion Tally
            </p>
            <ul className="space-y-3">
              {tally.map((row, i) => (
                <li key={i} className="flex items-center justify-between hairline px-4 py-3 bg-surface/40">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="font-display text-accent text-[18px] tabular-nums w-8" style={{ fontWeight: 500 }}>
                      {i + 1}
                    </span>
                    <span className="text-[14px] text-ink truncate">{row.name}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-ink tabular-nums" style={{ fontSize: 22, fontWeight: 500 }}>
                      {row.wins}
                    </span>
                    <span className="text-[10px] tracking-[0.28em] uppercase text-inkDim">
                      {row.wins === 1 ? 'Win' : 'Wins'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* ACTIVE CUPS */}
      {active_cups.length > 0 && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-10 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">
              In Play
            </p>
            <div>
              {active_cups.map((c) => <CupRow key={c.id} cup={c} />)}
            </div>
          </section>
        </>
      )}

      {/* FINISHED CUPS — LEGACY */}
      {finished_cups.length > 0 && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-10 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">
              Legacy
            </p>
            <div>
              {finished_cups.map((c) => <CupRow key={c.id} cup={c} />)}
            </div>
          </section>
        </>
      )}

      {/* RIVALRIES */}
      {rivalries.length > 0 && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-10 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-5">Rivalries</p>
            <ul className="space-y-2">
              {rivalries.slice(0, 10).map((r, i) => (
                <li key={i} className="hairline px-4 py-3 bg-surface/40 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar src={r.opponent.avatar_url} name={r.opponent.display_name || r.opponent.handle} size={36} />
                    <div className="min-w-0">
                      <p className="text-[14px] text-ink truncate">
                        {r.opponent.display_name || `@${r.opponent.handle}`}
                      </p>
                      <p className="text-[10px] tracking-[0.22em] uppercase text-inkDim">
                        {r.matches_total} {r.matches_total === 1 ? 'duel' : 'duels'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5 tabular-nums">
                    <span className="font-display"
                          style={{ fontSize: 20, fontWeight: 500,
                                   color: r.lead === 'me' ? '#D9C9A8' : r.lead === 'opponent' ? '#9C968C' : '#F4F1EA' }}>
                      {r.wins}
                    </span>
                    <span className="text-inkDim">–</span>
                    <span className="font-display text-inkDim" style={{ fontSize: 20, fontWeight: 500 }}>
                      {r.losses}
                    </span>
                    {r.draws > 0 && (
                      <span className="text-[10px] text-inkDim ml-1">·{r.draws}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* CTA */}
      <div className="hairline-t" />
      <section className="px-5 py-12 max-w-lg mx-auto">
        <button
          onClick={() => setShareOpen(true)}
          className="w-full text-center py-5 hairline text-ink text-[13px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform"
        >
          Share Hall of Fame
        </button>
        <p className="text-center text-[11px] text-inkDim mt-10 tracking-[0.22em] uppercase">
          Powered by Swing &amp; Savor
        </p>
      </section>

      <ShareSheet
        open={shareOpen} onClose={() => setShareOpen(false)}
        url={shareUrl}
        text={`${captain.display_name || '@' + captain.handle} · Hall of Fame on Swing & Savor — ${shareUrl}`}
        title="Share Hall of Fame"
      />
    </div>
  )
}
