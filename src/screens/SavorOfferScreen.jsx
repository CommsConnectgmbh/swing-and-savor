import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import LoadingSpinner from '../components/LoadingSpinner'
import ShareSheet from '../components/ShareSheet'
import { savorFetch, formatOfferPrice } from '../lib/savor'

export default function SavorOfferScreen() {
  const { user } = useAuth()
  const { slug } = useParams()
  const [offer, setOffer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [wishlisted, setWishlisted] = useState(false)
  const [wishBusy, setWishBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(null)
    savorFetch({ mode: 'offer', slug })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) { setErr(j?.error || 'error'); setLoading(false); return }
        setOffer(j.offer)
        document.title = `${j.offer.title} · Savor · Swing & Savor`
        setLoading(false)
      })
      .catch((e) => { if (!cancelled) { setErr(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [slug])

  // Wishlist state (auth users only)
  useEffect(() => {
    if (!user?.id || !offer?.id) { setWishlisted(false); return }
    let cancelled = false
    supabase.from('savor_wishlist').select('id').eq('user_id', user.id).eq('offer_id', offer.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setWishlisted(!!data) })
    return () => { cancelled = true }
  }, [user?.id, offer?.id])

  async function toggleWish() {
    if (!user?.id || !offer?.id || wishBusy) return
    setWishBusy(true)
    if (wishlisted) {
      await supabase.from('savor_wishlist').delete().eq('user_id', user.id).eq('offer_id', offer.id)
      setWishlisted(false)
    } else {
      await supabase.from('savor_wishlist').insert({ user_id: user.id, offer_id: offer.id })
      setWishlisted(true)
    }
    setWishBusy(false)
  }

  if (loading) return <div className="py-20 flex items-center justify-center"><LoadingSpinner /></div>
  if (err || !offer) {
    return (
      <div className="max-w-lg mx-auto py-20 px-6 text-center">
        <p className="text-inkMuted text-sm">Angebot nicht verfügbar.</p>
        <Link to="/savor" className="text-accent text-sm tracking-[0.22em] uppercase mt-4 inline-block">
          ← Savor
        </Link>
      </div>
    )
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div className="max-w-lg mx-auto pb-32 animate-fade-up">

      {/* Cover Hero */}
      <section className="relative">
        <Link to={`/savor/c/${offer.category}`}
              className="absolute top-4 left-4 z-10 text-[10px] tracking-[0.32em] uppercase text-bone bg-bg/70 hairline px-2.5 py-1.5">
          ←
        </Link>
        <div className="aspect-[4/5] bg-bg overflow-hidden">
          {offer.image_url ? (
            <img src={offer.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-inkDim font-display text-5xl">·</div>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 pt-20"
             style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(10,26,18,0.95) 70%)' }}>
          {offer.badge && (
            <span className="inline-block text-[10px] tracking-[0.32em] uppercase px-2 py-1 mb-3 hairline text-accent">
              {offer.badge}
            </span>
          )}
          <h1 className="font-display text-ink leading-[0.95]"
              style={{ fontSize: 'clamp(28px, 7vw, 42px)', fontWeight: 500, letterSpacing: '-0.02em' }}>
            {offer.title}
          </h1>
          {offer.subtitle && (
            <p className="text-[14px] text-inkMuted mt-3 leading-relaxed max-w-[420px]">{offer.subtitle}</p>
          )}
        </div>
      </section>

      {/* Meta strip */}
      <section className="px-5 py-6 grid grid-cols-3 gap-2 hairline-b">
        <div>
          <p className="text-[9px] tracking-[0.32em] uppercase text-inkDim">Price</p>
          <p className="font-display text-accent mt-1" style={{ fontSize: 20, fontWeight: 500 }}>
            {formatOfferPrice(offer)}
          </p>
        </div>
        {offer.city && (
          <div>
            <p className="text-[9px] tracking-[0.32em] uppercase text-inkDim">Location</p>
            <p className="font-display text-ink mt-1" style={{ fontSize: 16, fontWeight: 500 }}>
              {offer.city}
            </p>
          </div>
        )}
        {offer.tee_time_at && (
          <div>
            <p className="text-[9px] tracking-[0.32em] uppercase text-inkDim">Tee Time</p>
            <p className="font-display text-ink mt-1" style={{ fontSize: 16, fontWeight: 500 }}>
              {new Date(offer.tee_time_at).toLocaleString('de-DE',
                { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
      </section>

      {/* Description */}
      {offer.description && (
        <section className="px-5 py-7 hairline-b">
          <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">Details</p>
          <p className="text-[15px] text-ink/85 leading-[1.65] whitespace-pre-line">{offer.description}</p>
        </section>
      )}

      {/* Partner */}
      {offer.partner && (
        <section className="px-5 py-7 hairline-b">
          <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-3">Partner</p>
          <div className="flex items-center gap-3">
            {offer.partner.logo_url ? (
              <img src={offer.partner.logo_url} alt="" className="h-10 object-contain"
                   style={{ filter: 'brightness(0.95)' }} />
            ) : (
              <div className="w-10 h-10 hairline rounded-card flex items-center justify-center bg-bg">
                <span className="font-display text-accent text-[18px]" style={{ fontWeight: 500 }}>
                  {offer.partner.name?.[0] || '·'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-display text-ink text-[18px]" style={{ fontWeight: 500 }}>{offer.partner.name}</p>
              {offer.partner.website_url && (
                <a href={offer.partner.website_url} target="_blank" rel="noopener"
                   className="text-[11px] text-inkDim tracking-wide truncate block">
                  {offer.partner.website_url.replace(/^https?:\/\//, '')} ↗
                </a>
              )}
            </div>
          </div>
          {offer.partner.description && (
            <p className="text-[13px] text-inkMuted mt-4 leading-relaxed">{offer.partner.description}</p>
          )}
        </section>
      )}

      {/* CTAs */}
      <section className="px-5 py-8">
        <div className="flex flex-col gap-3">
          {offer.external_url ? (
            <a href={offer.external_url} target="_blank" rel="noopener"
               className={`block w-full text-center py-5 text-[12px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform ${
                 offer.status === 'sold_out' ? 'hairline text-inkDim cursor-not-allowed pointer-events-none' : 'bg-accent text-brandDark'
               }`}>
              {offer.status === 'sold_out' ? 'Sold out' : 'Book / Reserve'}
            </a>
          ) : (
            <button disabled className="block w-full text-center py-5 hairline text-inkDim text-[12px] font-medium tracking-[0.28em] uppercase">
              Coming soon
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={toggleWish} disabled={!user || wishBusy}
                    className="py-4 hairline text-ink text-[11px] tracking-[0.24em] uppercase active:scale-[0.99] disabled:opacity-50">
              {wishlisted ? '✓ Saved' : 'Save'}
            </button>
            <button onClick={() => setShareOpen(true)}
                    className="py-4 hairline text-ink text-[11px] tracking-[0.24em] uppercase active:scale-[0.99]">
              Share
            </button>
          </div>
        </div>
      </section>

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)}
        url={shareUrl}
        text={`${offer.title} · ${formatOfferPrice(offer)} · Savor by Swing & Savor — ${shareUrl}`}
        title="Share offer" />
    </div>
  )
}
