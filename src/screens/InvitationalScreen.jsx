import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import LanguageQuickSwitch from '../components/LanguageQuickSwitch'
import ShareSheet from '../components/ShareSheet'
import WinnerCardSheet from '../components/WinnerCardSheet'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-invitational`

function Initials({ name }) {
  const parts = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
  const initials = parts.map((p) => p[0]?.toUpperCase() || '').join('')
  return (
    <span className="w-full h-full flex items-center justify-center font-display text-[12px] text-ink uppercase tracking-wider">
      {initials || '·'}
    </span>
  )
}

function Avatar({ src, name, size = 40 }) {
  return (
    <div
      className="rounded-full overflow-hidden bg-surface flex-shrink-0"
      style={{ width: size, height: size, border: '1px solid rgba(244,241,234,0.16)' }}
    >
      {src
        ? <img src={src} alt={name || ''} className="w-full h-full object-cover" loading="lazy" />
        : <Initials name={name} />}
    </div>
  )
}

function PackageBadge({ pkg }) {
  if (!pkg || pkg === 'free') return null
  const labels = { premium: 'Premium', club: 'Club Cup', league: 'League' }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full hairline text-[10px] uppercase tracking-[0.28em] text-accent">
      <span className="w-1 h-1 rounded-full bg-accent" />
      {labels[pkg] || pkg}
    </span>
  )
}

export default function InvitationalScreen() {
  const { t, i18n } = useTranslation()
  const { inviteCode } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    fetch(`${FUNCTIONS_URL}?invite=${encodeURIComponent(inviteCode)}`, {
      headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) { setErr(j?.error || 'error'); setLoading(false); return }
        setData(j)
        document.title = `${j.cup.name} · Swing & Savor`
        setLoading(false)
      })
      .catch((e) => { if (!cancelled) { setErr(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [inviteCode])

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  const shareText = useMemo(() => {
    if (!data) return ''
    return t('share.inviteText', { url: shareUrl })
      .replace('Founder Invitational', data.cup.name || 'Founder Invitational')
  }, [data, shareUrl, t])

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
        <p className="text-inkMuted text-sm mb-4">{t('cup.empty')}</p>
        <Link to="/" className="text-accent text-sm font-medium tracking-[0.22em] uppercase">
          {t('app.name')} →
        </Link>
      </div>
    )
  }

  const { cup, captain, participants, sponsors = [] } = data
  const titleSponsor = sponsors.find((s) => s.placement_type === 'title_sponsor')
  const poweredBy    = sponsors.find((s) => s.placement_type === 'powered_by')
  const dateFmt = new Date(cup.date).toLocaleDateString(i18n.resolvedLanguage || 'de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const isLive = cup.status === 'active' && cup.matches_finished > 0 && cup.matches_finished < cup.matches_total
  const finished = cup.status === 'finished'
  const teamAList = participants.filter((p) => p.team === 'A')
  const teamBList = participants.filter((p) => p.team === 'B')

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
      <section className="relative px-5 pt-10 pb-12">
        {cup.cover_url ? (
          <div className="absolute inset-x-0 top-0 h-[420px] overflow-hidden pointer-events-none">
            <img src={cup.cover_url} alt="" aria-hidden="true"
                 className="w-full h-full object-cover opacity-[0.32]" />
            <div className="absolute inset-0"
                 style={{ background: 'linear-gradient(180deg, rgba(10,10,10,0.2) 0%, rgba(10,10,10,1) 78%)' }} />
          </div>
        ) : (
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[320px] pointer-events-none"
               style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(217,201,168,0.08), transparent 65%)' }} />
        )}

        <div className="relative max-w-lg mx-auto">
          <p className="font-sans text-[10px] tracking-[0.42em] uppercase text-accent mb-5">
            {finished ? 'Hall of Fame' : isLive ? 'Live' : 'You\'re invited'}
          </p>
          <h1 className="font-display text-ink leading-[0.92] mb-5"
              style={{ fontSize: 'clamp(40px, 9vw, 64px)', fontWeight: 500, letterSpacing: '-0.025em' }}>
            {cup.name}
          </h1>
          <p className="font-sans text-inkMuted text-[14px] tracking-[0.18em] uppercase mb-2">
            {dateFmt}
          </p>
          {cup.location_name && (
            <p className="font-sans text-inkMuted text-[13px] tracking-[0.18em] uppercase">
              {cup.location_name}
            </p>
          )}
          {cup.format && (
            <p className="font-sans text-inkDim text-[12px] tracking-[0.22em] uppercase mt-1">
              {cup.format}
            </p>
          )}

          {cup.description && (
            <p className="font-sans text-ink/80 text-[15px] leading-[1.65] mt-7 max-w-[460px]">
              {cup.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-7">
            <PackageBadge pkg={cup.package_type} />
            {captain && (
              <div className="flex items-center gap-2">
                <Avatar src={captain.avatar_url} name={captain.display_name || captain.handle} size={26} />
                <div className="flex flex-col">
                  <span className="text-[9px] tracking-[0.32em] uppercase text-inkDim leading-none">Captain</span>
                  <span className="text-[12px] text-inkMuted leading-tight">
                    {captain.display_name || (captain.handle ? `@${captain.handle}` : '—')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="hairline-t" />

      {/* TEAMS / PARTICIPANTS */}
      <section className="px-5 py-10 max-w-lg mx-auto">
        <div className="flex items-end justify-between mb-6">
          <h2 className="font-display text-ink text-[24px]" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
            The Lineup
          </h2>
          <span className="text-[11px] tracking-[0.28em] uppercase text-inkDim">
            {participants.length} {participants.length === 1 ? 'Player' : 'Players'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {[
            { name: cup.team_a_name, list: teamAList, color: cup.team_a_color, logo: cup.team_a_logo_url },
            { name: cup.team_b_name, list: teamBList, color: cup.team_b_color, logo: cup.team_b_logo_url },
          ].map((team, idx) => (
            <div key={idx} className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                {team.logo
                  ? <img src={team.logo} alt="" className="w-7 h-7 object-contain flex-shrink-0" />
                  : team.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: team.color }} />}
                <p className="text-[10px] tracking-[0.32em] uppercase truncate"
                   style={{ color: team.color || 'rgba(244,241,234,0.7)' }}>
                  {team.name}
                </p>
              </div>
              {team.list.length === 0 ? (
                <p className="text-[12px] text-inkDim italic">—</p>
              ) : (
                <ul className="space-y-2.5">
                  {team.list.map((p, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <Avatar src={p.avatar_url} name={p.name} size={28} />
                      <span className="text-[13px] text-ink truncate">{p.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="hairline-t" />

      {/* LIVE / FINAL BANNER */}
      {(isLive || finished) && (
        <section className="px-5 py-10 max-w-lg mx-auto">
          <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-4">
            {finished ? t('cup.finalStand') : 'Live Score'}
          </p>
          <div className="grid grid-cols-3 items-center hairline rounded-card px-5 py-6 bg-surface/60">
            <div className="text-center">
              <p className="text-[10px] tracking-[0.28em] uppercase truncate"
                 style={{ color: cup.team_a_color || 'rgba(244,241,234,0.7)' }}>
                {cup.team_a_name}
              </p>
              <p className="font-display mt-1 tabular-nums"
                 style={{ fontSize: 44, fontWeight: 500, color: cup.score_a >= cup.score_b ? (cup.team_a_color || '#F4F1EA') : '#9C968C' }}>
                {cup.score_a}
              </p>
            </div>
            <div className="text-center text-inkDim font-display text-3xl">·</div>
            <div className="text-center">
              <p className="text-[10px] tracking-[0.28em] uppercase truncate"
                 style={{ color: cup.team_b_color || 'rgba(244,241,234,0.7)' }}>
                {cup.team_b_name}
              </p>
              <p className="font-display mt-1 tabular-nums"
                 style={{ fontSize: 44, fontWeight: 500, color: cup.score_b > cup.score_a ? (cup.team_b_color || '#F4F1EA') : '#9C968C' }}>
                {cup.score_b}
              </p>
            </div>
          </div>
          {finished && (
            <p className="mt-4 text-center text-[12px] text-accent tracking-[0.22em] uppercase">
              {cup.score_a === cup.score_b
                ? t('cup.tieLabel')
                : `${t('cup.winnerLabel')}: ${cup.score_a > cup.score_b ? cup.team_a_name : cup.team_b_name}`}
            </p>
          )}
        </section>
      )}

      {/* CTA Block */}
      <section className="px-5 pt-2 pb-12 max-w-lg mx-auto">
        <div className="flex flex-col gap-3">
          {finished ? (
            <button
              onClick={() => setCardOpen(true)}
              className="block w-full text-center py-5 bg-accent text-bg text-[13px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform"
            >
              {t('share.storyOverlayCta')}
            </button>
          ) : (
            <Link
              to="/home"
              className="block w-full text-center py-5 bg-accent text-bg text-[13px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform"
            >
              {"I'm in"}
            </Link>
          )}
          <button
            onClick={() => setShareOpen(true)}
            className="block w-full text-center py-5 hairline text-ink text-[13px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform"
          >
            {t('common.share')}
          </button>
        </div>

        {poweredBy && (
          <div className="mt-10 flex flex-col items-center gap-3 hairline-t pt-8">
            <span className="text-[9px] tracking-[0.36em] uppercase text-inkDim">Powered by</span>
            <a href={poweredBy.website_url || '#'} target="_blank" rel="noopener"
               className="flex items-center gap-3">
              {poweredBy.logo_url && (
                <img src={poweredBy.logo_url} alt={poweredBy.name} className="h-8 object-contain"
                     style={{ filter: 'brightness(0.95)' }} />
              )}
              <span className="font-display text-ink text-[18px]" style={{ fontWeight: 500 }}>
                {poweredBy.name}
              </span>
            </a>
          </div>
        )}

        <p className="text-center text-[11px] text-inkDim mt-8 tracking-[0.22em] uppercase">
          {t('winnerCard.poweredBy')}
        </p>
      </section>

      <ShareSheet
        open={shareOpen} onClose={() => setShareOpen(false)}
        url={shareUrl} text={shareText} title={t('share.title')}
      />

      <WinnerCardSheet
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        shareUrl={shareUrl}
        payload={{
          playerName:   (cup.score_a > cup.score_b ? cup.team_a_name : cup.score_b > cup.score_a ? cup.team_b_name : '—'),
          championName: (cup.score_a > cup.score_b ? cup.team_a_name : cup.score_b > cup.score_a ? cup.team_b_name : '—'),
          award:        cup.score_a === cup.score_b ? 'Tied' : 'Champion · Founder Invitational',
          cupName:      cup.name,
          courseName:   cup.location_name || '',
          dateLabel:    dateFmt,
          score:        `${cup.score_a} – ${cup.score_b}`,
          scoreLabel:   t('cup.finalStand'),
          birdies:      null,
          longestDrive: null,
          closestToPin: null,
          isChampion:   true,
        }}
      />
    </div>
  )
}
