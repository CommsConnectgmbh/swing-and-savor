import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import LanguageQuickSwitch from '../components/LanguageQuickSwitch'
import ShareSheet from '../components/ShareSheet'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-cup`

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
    fetch(`${FUNCTIONS_URL}?invite=${encodeURIComponent(inviteCode)}`, {
      headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
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

  const fmt = (n) => Number.isInteger(n) ? String(n) : n.toFixed(1)

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = cup.status === 'finished' && winner
    ? t('share.cupResultText', { winner, cup: cup.name, url: shareUrl })
    : t('share.cupShareText', { url: shareUrl })

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
              <p className="font-condensed font-black text-4xl text-ink mt-2 tabular-nums">{fmt(cup.score_a)}</p>
            </div>
            <div className="text-center text-inkDim font-condensed font-black text-2xl">—</div>
            <div className="text-center">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">{t('matchDetail.teamB')}</p>
              <p className="font-condensed font-bold text-sm mt-1 leading-tight">{cup.team_b_name}</p>
              <p className="font-condensed font-black text-4xl text-ink mt-2 tabular-nums">{fmt(cup.score_b)}</p>
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
