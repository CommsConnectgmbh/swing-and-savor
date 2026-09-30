import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import LanguageQuickSwitch from '../components/LanguageQuickSwitch'
import ShareSheet from '../components/ShareSheet'
import { functionUrl, publicFunctionHeaders } from '../lib/functions'
import Avatar from '../components/Avatar'

function CupRow({ cup }) {
  const finished = cup.status === 'finished'
  const date = new Date(cup.date).toLocaleDateString('de-DE',
    { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <Link to={finished ? `/recap/${cup.invite_code}` : `/i/${cup.invite_code}`}
          className="flex items-center justify-between hairline-b py-5 active:bg-surface/40 transition-colors">
      <div className="min-w-0 flex-1 pr-4">
        <p className="font-display text-ink text-[20px] leading-tight"
           style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
          {cup.name}
        </p>
        <p className="text-[11px] tracking-[0.22em] uppercase text-inkDim mt-1">
          {[cup.location_name, date].filter(Boolean).join('  ·  ')}
        </p>
        {cup.champion && (
          <p className="text-[12px] text-accent tracking-wide mt-1">
            Champion: {cup.champion}
          </p>
        )}
      </div>
      <span className="text-[10px] tracking-[0.28em] uppercase text-inkMuted">
        {finished ? 'Recap' : 'Live'}
      </span>
    </Link>
  )
}

export default function CrewScreen() {
  const { t } = useTranslation()
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null)
    fetch(`${functionUrl('public-crew')}?slug=${encodeURIComponent(slug)}`, {
      headers: publicFunctionHeaders(),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) { setErr(j?.error || 'error'); setLoading(false); return }
        setData(j)
        document.title = `${j.group.name} · Crew · Swing & Savor`
        setLoading(false)
      })
      .catch((e) => { if (!cancelled) { setErr(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [slug])

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg"><LoadingSpinner /></div>
  if (err || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="text-inkMuted text-sm mb-4">Crew nicht verfügbar.</p>
        <Link to="/" className="text-accent text-sm font-medium tracking-[0.22em] uppercase">{t('app.name')} →</Link>
      </div>
    )
  }

  const { group, captain, members, stats, champion_tally: tally, finished_cups, active_cups } = data
  const typeLabel = { crew: 'Crew', club: 'Club', company: 'Company', city: 'City' }[group.type] || 'Crew'

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
      <section className="relative px-5 pt-12 pb-10">
        {group.cover_url ? (
          <div className="absolute inset-x-0 top-0 h-[460px] overflow-hidden pointer-events-none">
            <img src={group.cover_url} alt="" aria-hidden="true"
                 className="w-full h-full object-cover opacity-[0.32]" />
            <div className="absolute inset-0"
                 style={{ background: 'linear-gradient(180deg, rgba(10,26,18,0.16) 0%, rgba(10,26,18,1) 78%)' }} />
          </div>
        ) : (
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[360px] pointer-events-none"
               style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(217,201,168,0.10), transparent 60%)' }} />
        )}

        <div className="relative max-w-lg mx-auto">
          <p className="font-sans text-[10px] tracking-[0.42em] uppercase text-accent mb-5">
            {typeLabel}
          </p>
          <h1 className="font-display text-ink leading-[0.92] mb-3"
              style={{ fontSize: 'clamp(40px, 9vw, 64px)', fontWeight: 500, letterSpacing: '-0.02em' }}>
            {group.name}
          </h1>
          <p className="text-[12px] tracking-[0.22em] uppercase text-inkMuted">
            {[group.region, `${stats.members_total} members`].filter(Boolean).join('  ·  ')}
          </p>
          {group.description && (
            <p className="text-ink/80 text-[15px] leading-[1.65] mt-7 max-w-[460px]">
              {group.description}
            </p>
          )}
        </div>
      </section>

      <div className="hairline-t" />

      {/* Stats row */}
      <section className="px-5 py-8 max-w-lg mx-auto">
        <div className="grid grid-cols-3 hairline-t hairline-b">
          {[
            { label: 'Cups',      value: stats.cups_total },
            { label: 'Live',      value: stats.cups_active },
            { label: 'Champions', value: tally.reduce((a, c) => a + c.wins, 0) },
          ].map((s, i) => (
            <div key={i} className={`py-5 text-center ${i < 2 ? 'border-r border-[rgba(244,241,234,0.08)]' : ''}`}>
              <p className="font-display text-ink tabular-nums" style={{ fontSize: 32, fontWeight: 500 }}>{s.value}</p>
              <p className="text-[10px] tracking-[0.32em] uppercase text-inkDim mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Members */}
      {members.length > 0 && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-10 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-5">The Crew</p>
            <ul className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {members.map((m) => (
                <li key={m.profile.id} className="flex flex-col items-center text-center">
                  <Link to={`/u/${m.profile.handle}`} className="contents">
                    <Avatar src={m.profile.avatar_url} name={m.profile.display_name || m.profile.handle} size={56} fontSize={56 / 3.4} />
                    <p className="text-[12px] text-ink truncate mt-2 w-full">{m.profile.display_name || `@${m.profile.handle}`}</p>
                    {m.role === 'captain' && (
                      <p className="text-[8px] tracking-[0.32em] uppercase text-accent mt-0.5">Captain</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Active Cups */}
      {active_cups.length > 0 && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-10 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">In Play</p>
            <div>{active_cups.map((c) => <CupRow key={c.id} cup={c} />)}</div>
          </section>
        </>
      )}

      {/* Legacy */}
      {finished_cups.length > 0 && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-10 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">Legacy</p>
            <div>{finished_cups.map((c) => <CupRow key={c.id} cup={c} />)}</div>
          </section>
        </>
      )}

      {/* CTA */}
      <div className="hairline-t" />
      <section className="px-5 py-12 max-w-lg mx-auto">
        <button onClick={() => setShareOpen(true)}
                className="w-full text-center py-5 hairline text-ink text-[13px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform">
          Share Crew
        </button>
        <p className="text-center text-[11px] text-inkDim mt-10 tracking-[0.22em] uppercase">
          Powered by Swing &amp; Savor
        </p>
      </section>

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)}
        url={shareUrl}
        text={`${group.name} on Swing & Savor — ${shareUrl}`}
        title="Share Crew" />
    </div>
  )
}
