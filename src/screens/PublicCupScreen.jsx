import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import LanguageQuickSwitch from '../components/LanguageQuickSwitch'
import ShareSheet from '../components/ShareSheet'
import { functionUrl, publicFunctionHeaders } from '../lib/functions'
import { fmtPts } from '../lib/format'

export default function PublicCupScreen() {
  const { t, i18n } = useTranslation()
  const { inviteCode } = useParams()
  const [cup, setCup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${functionUrl('public-cup')}?invite=${encodeURIComponent(inviteCode)}`, {
      headers: publicFunctionHeaders(),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) { setErr(j?.error || 'error'); setLoading(false); return }
        setCup(j.cup)
        setLoading(false)
        // OG-Meta-Tags client-side patchen (für Share-Previews wenn Crawler JS rendert)
        document.title = `${j.cup.name} · Swing & Savor`
      })
      .catch((e) => { if (!cancelled) { setErr(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [inviteCode])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg"><LoadingSpinner /></div>
  if (err || !cup) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="text-inkMuted text-sm mb-4">{t('cup.empty')}</p>
        <Link to="/" className="text-accent text-sm font-bold">{t('app.name')} →</Link>
      </div>
    )
  }

  const winner = cup.status === 'finished'
    ? (cup.score_a > cup.score_b ? cup.team_a_name : cup.score_b > cup.score_a ? cup.team_b_name : null)
    : null

  const dateFmt = new Date(cup.date).toLocaleDateString(i18n.resolvedLanguage || 'en', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = cup.status === 'finished' && winner
    ? t('share.cupResultText', { winner, cup: cup.name, url: shareUrl })
    : t('share.cupShareText', { url: shareUrl })

  const ec = cup.entry_conditions && typeof cup.entry_conditions === 'object' ? cup.entry_conditions : null
  const ecEntries = []
  if (ec) {
    if (ec.handicap_min != null && ec.handicap_max != null) {
      ecEntries.push([null, t('cup.entry.handicapRange', { min: ec.handicap_min, max: ec.handicap_max })])
    } else if (ec.handicap_max != null) {
      ecEntries.push([t('cup.entry.handicapMax'), String(ec.handicap_max)])
    } else if (ec.handicap_min != null) {
      ecEntries.push([t('cup.entry.handicapMin'), String(ec.handicap_min)])
    }
    if (ec.age_min != null)    ecEntries.push([t('cup.entry.ageMin'),    `${ec.age_min}+`])
    if (ec.gender)             ecEntries.push([t('cup.entry.gender'),    String(ec.gender)])
    if (ec.dress_code)         ecEntries.push([t('cup.entry.dressCode'), String(ec.dress_code)])
    if (ec.entry_fee_cents != null) {
      const eur = (ec.entry_fee_cents / 100).toLocaleString(i18n.resolvedLanguage || 'de', { style: 'currency', currency: 'EUR' })
      ecEntries.push([t('cup.entry.entryFee'), eur])
    }
    if (ec.payout)             ecEntries.push([t('cup.entry.payout'),    String(ec.payout)])
    if (ec.equipment)          ecEntries.push([t('cup.entry.equipment'), String(ec.equipment)])
  }
  const joinModeLabel = cup.join_mode === 'open'
    ? t('cup.joinModeOpen')
    : cup.join_mode === 'request'
      ? t('cup.joinModeRequest')
      : null
  const hasMeta = !!(cup.rules_md || ecEntries.length || joinModeLabel || cup.max_participants)

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg" />
          <span className="font-condensed font-black text-sm tracking-wide">{t('app.name')}</span>
        </Link>
        <LanguageQuickSwitch />
      </header>

      <main className="max-w-lg mx-auto px-4 pt-2 pb-10 animate-fade-up">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-accent">{dateFmt}</p>
        <h1 className="font-condensed text-3xl sm:text-4xl font-black mt-1.5 leading-tight">{cup.name}</h1>
        {cup.description && (
          <p className="text-inkMuted text-sm mt-2 leading-relaxed">{cup.description}</p>
        )}

        {/* Score card */}
        <div className="mt-6 rounded-card bg-surface border border-line p-5">
          <div className="grid grid-cols-3 items-center">
            <div className="text-center">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">{t('matchDetail.teamA')}</p>
              <p className="font-condensed font-bold text-sm mt-1 leading-tight">{cup.team_a_name}</p>
              <p className="font-condensed font-black text-4xl text-ink mt-2 tabular-nums">{fmtPts(cup.score_a)}</p>
            </div>
            <div className="text-center text-inkDim font-condensed font-black text-2xl">—</div>
            <div className="text-center">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">{t('matchDetail.teamB')}</p>
              <p className="font-condensed font-bold text-sm mt-1 leading-tight">{cup.team_b_name}</p>
              <p className="font-condensed font-black text-4xl text-ink mt-2 tabular-nums">{fmtPts(cup.score_b)}</p>
            </div>
          </div>

          {cup.status === 'finished' && (
            <div className="mt-5 pt-4 border-t border-lineSoft text-center">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">{t('cup.winnerLabel')}</p>
              <p className="font-condensed font-black text-2xl text-accent mt-1">
                {winner ? `🏆 ${winner}` : `🤝 ${t('cup.tieLabel')}`}
              </p>
            </div>
          )}
          {cup.status !== 'finished' && (
            <div className="mt-4 text-center text-inkMuted text-xs">
              {cup.matches_finished} / {cup.matches_total} {t('matches.title').toLowerCase()}
            </div>
          )}
        </div>

        {hasMeta && (
          <div className="mt-5 space-y-3">
            {(joinModeLabel || cup.max_participants) && (
              <div className="flex flex-wrap items-center gap-2">
                {joinModeLabel && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-wide">
                    {joinModeLabel}
                  </span>
                )}
                {cup.max_participants && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-surface border border-line text-inkMuted text-[11px] font-bold uppercase tracking-wide">
                    {t('cup.maxParticipantsLabel', { count: cup.max_participants })}
                  </span>
                )}
              </div>
            )}

            {ecEntries.length > 0 && (
              <section className="rounded-card bg-surface border border-line p-4">
                <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted mb-2">
                  {t('cup.entryConditionsTitle')}
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {ecEntries.map(([label, value], i) => (
                    label
                      ? <div key={i} className="contents">
                          <dt className="text-inkMuted">{label}</dt>
                          <dd className="text-ink font-medium text-right">{value}</dd>
                        </div>
                      : <dd key={i} className="col-span-2 text-ink font-medium">{value}</dd>
                  ))}
                </dl>
              </section>
            )}

            {cup.rules_md && (
              <section className="rounded-card bg-surface border border-line p-4">
                <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted mb-2">
                  {t('cup.rulesTitle')}
                </p>
                <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
                  {cup.rules_md}
                </p>
              </section>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button onClick={() => setShareOpen(true)}
            className="py-3 rounded-xl text-sm font-bold bg-surface text-ink border border-line active:scale-[0.98] transition-transform">
            {t('common.share')}
          </button>
          <Link to="/"
            className="py-3 rounded-xl text-sm font-bold bg-accent text-brandDark text-center active:scale-[0.98] transition-transform">
            {t('signIn.title')}
          </Link>
        </div>

        {/* DealBuddy hook */}
        {cup.status === 'finished' && (
          <a href="https://deal-buddy.app" target="_blank" rel="noopener"
            className="mt-5 flex items-center justify-between rounded-card bg-surface border border-line p-4 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <p className="font-bold text-sm text-ink leading-tight">{t('dealbuddy.title')}</p>
                <p className="text-[11px] text-inkDim leading-tight mt-0.5">{t('dealbuddy.subtitle')}</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" className="text-inkDim">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </a>
        )}

        <p className="text-center text-[11px] text-inkDim mt-6">
          {t('app.tagline')}
        </p>
      </main>

      <ShareSheet
        open={shareOpen} onClose={() => setShareOpen(false)}
        url={shareUrl} text={shareText} title={t('share.title')}
      />
    </div>
  )
}
