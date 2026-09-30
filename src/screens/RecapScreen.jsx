import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../components/LoadingSpinner'
import LanguageQuickSwitch from '../components/LanguageQuickSwitch'
import ShareSheet from '../components/ShareSheet'
import WinnerCardSheet from '../components/WinnerCardSheet'
import { functionUrl, publicFunctionHeaders } from '../lib/functions'
import Avatar from '../components/Avatar'

function AwardCard({ award }) {
  return (
    <div className="hairline p-5 bg-surface/40">
      <p className="text-[9px] tracking-[0.36em] uppercase text-accent mb-3">
        {award.award_type === 'champion'        ? 'Champion'
        : award.award_type === 'runner_up'      ? 'Runner-Up'
        : award.award_type === 'longest_drive'  ? 'Longest Drive'
        : award.award_type === 'closest_to_pin' ? 'Closest to the Pin'
        : award.award_type === 'mvp'            ? 'MVP'
        : award.award_type === 'rivalry'        ? 'Rivalry Winner'
        : 'Honour'}
      </p>
      <p className="font-display text-ink text-[22px] leading-tight mb-2"
         style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
        {award.title}
      </p>
      <div className="flex items-center gap-2.5 mt-3">
        <Avatar src={award.recipient_avatar_url} name={award.recipient_display_name} size={28} fontSize={10} />
        <span className="text-[13px] text-inkMuted truncate">
          {award.recipient_display_name || '—'}
        </span>
      </div>
      {award.description && (
        <p className="text-[12px] text-inkDim mt-3 leading-relaxed">{award.description}</p>
      )}
    </div>
  )
}

export default function RecapScreen() {
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
    fetch(`${functionUrl('public-recap')}?invite=${encodeURIComponent(inviteCode)}`, {
      headers: publicFunctionHeaders(),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) { setErr(j?.error || 'error'); setLoading(false); return }
        setData(j)
        document.title = `${j.cup.name} · Recap · Swing & Savor`
        // Patch OG meta tags so re-shares to messaging apps look on-brand
        upsertMeta('og:title',       `${j.cup.name} · Recap`)
        upsertMeta('og:description', j.cup.description
                                      || `${j.cup.champion || 'Champions'} · ${j.cup.name}`)
        if (j.cup.cover_url) upsertMeta('og:image', j.cup.cover_url)
        upsertMeta('og:type',         'article')
        upsertMeta('og:site_name',    'Swing & Savor')
        setLoading(false)
      })
      .catch((e) => { if (!cancelled) { setErr(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [inviteCode])

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = useMemo(() => {
    if (!data) return ''
    return t('share.cupResultText', {
      winner: data.cup.champion || data.cup.team_a_name,
      cup: data.cup.name,
      url: shareUrl,
    })
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

  const { cup, captain, participants, finished_matches: matches, photos, awards, sponsors = [] } = data
  const poweredBy = sponsors.find((s) => s.placement_type === 'powered_by')
  const dateFmt = new Date(cup.date).toLocaleDateString(i18n.resolvedLanguage || 'de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
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

      {/* HERO — Magazine cover */}
      <section className="relative px-5 pt-12 pb-14">
        {cup.cover_url ? (
          <div className="absolute inset-x-0 top-0 h-[560px] overflow-hidden pointer-events-none">
            <img src={cup.cover_url} alt="" aria-hidden="true"
                 className="w-full h-full object-cover opacity-[0.36]" />
            <div className="absolute inset-0"
                 style={{ background: 'linear-gradient(180deg, rgba(10,10,10,0.12) 0%, rgba(10,10,10,1) 82%)' }} />
          </div>
        ) : (
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
               style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(217,201,168,0.10), transparent 60%)' }} />
        )}

        <div className="relative max-w-lg mx-auto">
          <p className="font-sans text-[10px] tracking-[0.42em] uppercase text-accent mb-6">
            The Recap · Vol. {String(new Date(cup.date).getFullYear())}
          </p>
          <h1 className="font-display text-ink leading-[0.9] mb-6"
              style={{ fontSize: 'clamp(44px, 10vw, 76px)', fontWeight: 500, letterSpacing: '-0.025em' }}>
            {cup.champion
              ? <>Champion <br/><span className="text-accent">{cup.champion}</span></>
              : cup.name}
          </h1>
          <p className="font-sans text-inkMuted text-[14px] tracking-[0.18em] uppercase mb-2">
            {cup.name}
          </p>
          <p className="font-sans text-inkDim text-[13px] tracking-[0.18em] uppercase">
            {[cup.location_name, dateFmt].filter(Boolean).join('  ·  ')}
          </p>

          {cup.description && (
            <p className="font-sans text-ink/80 text-[16px] leading-[1.7] mt-8 max-w-[460px]">
              {cup.description}
            </p>
          )}
        </div>
      </section>

      <div className="hairline-t" />

      {/* FINAL LEADERBOARD */}
      <section className="px-5 py-12 max-w-lg mx-auto">
        <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-6">
          {t('recap.leaderboardTitle')}
        </p>
        <div className="hairline p-6 bg-surface/40">
          <div className="grid grid-cols-3 items-center">
            <div className="text-left">
              <div className="flex items-center gap-2">
                {cup.team_a_logo_url && <img src={cup.team_a_logo_url} alt="" className="w-7 h-7 object-contain" />}
                <p className="text-[10px] tracking-[0.28em] uppercase truncate"
                   style={{ color: cup.team_a_color || 'rgba(244,241,234,0.7)' }}>
                  {cup.team_a_name}
                </p>
              </div>
              <p className="font-display mt-2 tabular-nums"
                 style={{ fontSize: 56, fontWeight: 500, color: cup.score_a >= cup.score_b ? (cup.team_a_color || '#F4F1EA') : '#9C968C' }}>
                {cup.score_a}
              </p>
            </div>
            <div className="text-center text-inkDim font-display text-2xl">·</div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <p className="text-[10px] tracking-[0.28em] uppercase truncate"
                   style={{ color: cup.team_b_color || 'rgba(244,241,234,0.7)' }}>
                  {cup.team_b_name}
                </p>
                {cup.team_b_logo_url && <img src={cup.team_b_logo_url} alt="" className="w-7 h-7 object-contain" />}
              </div>
              <p className="font-display mt-2 tabular-nums"
                 style={{ fontSize: 56, fontWeight: 500, color: cup.score_b > cup.score_a ? (cup.team_b_color || '#F4F1EA') : '#9C968C' }}>
                {cup.score_b}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AWARDS */}
      {awards && awards.length > 0 && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-12 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-6">
              {t('recap.awardsTitle')}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {awards.map((a) => <AwardCard key={a.id} award={a} />)}
            </div>
          </section>
        </>
      )}

      {/* PHOTOS */}
      {photos && photos.length > 0 && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-12 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-6">
              {t('recap.moments')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((url, i) => (
                <div key={i} className="aspect-square overflow-hidden hairline">
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* LINEUP */}
      <div className="hairline-t" />
      <section className="px-5 py-12 max-w-lg mx-auto">
        <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-6">
          The Lineup
        </p>
        <div className="grid grid-cols-2 gap-6">
          {[
            { name: cup.team_a_name, list: teamAList },
            { name: cup.team_b_name, list: teamBList },
          ].map((team, idx) => (
            <div key={idx} className="flex flex-col">
              <p className="text-[10px] tracking-[0.32em] uppercase text-inkDim mb-3">{team.name}</p>
              {team.list.length === 0 ? (
                <p className="text-[12px] text-inkDim italic">—</p>
              ) : (
                <ul className="space-y-2.5">
                  {team.list.map((p, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <Avatar src={p.avatar_url} name={p.name} size={28} fontSize={10} />
                      <span className="text-[13px] text-ink truncate">{p.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CAPTAIN'S NOTE */}
      {captain && (
        <>
          <div className="hairline-t" />
          <section className="px-5 py-12 max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-5">
              Captain
            </p>
            <div className="flex items-center gap-3">
              <Avatar src={captain.avatar_url} name={captain.display_name || captain.handle} size={48} fontSize={10} />
              <div>
                <p className="font-display text-ink text-[20px]" style={{ fontWeight: 500 }}>
                  {captain.display_name || (captain.handle ? `@${captain.handle}` : '—')}
                </p>
                {captain.handle && (
                  <p className="text-[12px] text-inkDim tracking-wide">@{captain.handle}</p>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* CTA — Next Edition + Share */}
      <div className="hairline-t" />
      <section className="px-5 py-14 max-w-lg mx-auto">
        <p className="font-display text-ink text-[28px] leading-tight mb-6"
           style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
          {t('recap.nextEditionCta')}
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setCardOpen(true)}
            className="w-full text-center py-5 bg-accent text-bg text-[13px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform"
          >
            {t('share.storyOverlayCta')}
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="w-full text-center py-5 hairline text-ink text-[13px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform"
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

        <p className="text-center text-[11px] text-inkDim mt-10 tracking-[0.22em] uppercase">
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
          playerName:   cup.champion || cup.team_a_name,
          championName: cup.champion || cup.team_a_name,
          award:        'Champion · ' + cup.name,
          cupName:      cup.name,
          courseName:   cup.location_name || '',
          dateLabel:    dateFmt,
          score:        `${cup.score_a} – ${cup.score_b}`,
          scoreLabel:   t('cup.finalStand'),
          isChampion:   true,
        }}
      />
    </div>
  )
}

function upsertMeta(property, content) {
  if (typeof document === 'undefined' || !content) return
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}
