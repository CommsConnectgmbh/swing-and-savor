import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-savor`

const CATEGORIES = [
  { key: 'tee_times',   label: 'Tee Times',   blurb: 'Greenfees auf kuratierten Plätzen.',          icon: '⛳' },
  { key: 'experiences', label: 'Experiences', blurb: 'Pro-Lessons, Clinics & Member-Events.',       icon: '◌' },
  { key: 'dining',      label: 'Dining',      blurb: '19th-Hole-Reservierungen & Clubhaus-Tische.', icon: '〇' },
  { key: 'travel',      label: 'Travel',      blurb: 'Golfreisen, Luxus-Resorts & Trip Cups.',      icon: '✈' },
  { key: 'apparel',     label: 'Apparel',     blurb: 'Polos, Caps, Knit & Outerwear.',              icon: '◇' },
  { key: 'equipment',   label: 'Equipment',   blurb: 'Schläger, Bags, Bälle & Pro-Shop-Picks.',     icon: '◆' },
]

function priceLabel(o) {
  if (o.price_label) return o.price_label
  if (o.price_eur_cents) return `${(o.price_eur_cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 0 })} €`
  return 'Auf Anfrage'
}

function OfferTile({ offer, compact = false }) {
  return (
    <Link to={`/savor/o/${offer.slug}`}
          className="block hairline overflow-hidden bg-surface/40 active:scale-[0.99] transition-transform">
      <div className={`relative bg-bg ${compact ? 'aspect-[4/3]' : 'aspect-[4/5]'} overflow-hidden`}>
        {offer.image_url ? (
          <img src={offer.image_url} alt="" loading="lazy"
               className="w-full h-full object-cover opacity-[0.92]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-inkDim font-display text-3xl">·</div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3"
             style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(10,26,18,0.92) 80%)' }}>
          {offer.badge && (
            <span className="inline-block text-[9px] tracking-[0.3em] uppercase px-1.5 py-0.5 mb-1.5 hairline text-accent">
              {offer.badge}
            </span>
          )}
          <p className="font-display text-ink leading-tight"
             style={{ fontSize: compact ? 15 : 18, fontWeight: 500 }}>
            {offer.title}
          </p>
          {offer.city && (
            <p className="text-[10px] tracking-[0.22em] uppercase text-inkMuted truncate mt-1">
              {offer.city}
            </p>
          )}
        </div>
        {offer.status === 'sold_out' && (
          <div className="absolute top-2 right-2 hairline px-2 py-0.5 text-[9px] tracking-[0.22em] uppercase text-inkMuted bg-bg/70">
            sold out
          </div>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-[11px] text-inkDim tracking-wide truncate pr-2">
          {offer.partner?.name || ''}
        </span>
        <span className="text-[11px] text-accent tracking-wider tabular-nums">
          {priceLabel(offer)}
        </span>
      </div>
    </Link>
  )
}

export default function SavorScreen() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${FUNCTIONS_URL}?mode=home`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    })
      .then(async (r) => r.ok ? r.json() : { featured: [], counts: {}, preview_by_category: {} })
      .then((j) => { if (!cancelled) { setData(j); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="py-20 flex items-center justify-center"><LoadingSpinner /></div>
  if (!data) return null

  const { featured, counts, preview_by_category: byCat } = data
  const totalOffers = Object.values(counts).reduce((a, n) => a + n, 0)

  return (
    <div className="max-w-lg mx-auto pb-32 animate-fade-up">

      {/* Editorial Hero */}
      <section className="px-5 pt-8 pb-7">
        <p className="text-[10px] tracking-[0.42em] uppercase text-accent mb-3">The Lifestyle</p>
        <h1 className="font-display text-ink leading-none"
            style={{ fontSize: 'clamp(36px, 9vw, 56px)', fontWeight: 500, letterSpacing: '-0.02em' }}>
          Savor
        </h1>
        <p className="text-[14px] text-inkMuted mt-4 leading-relaxed max-w-[420px]">
          Tee Times, Pro-Erlebnisse, Clubhaus-Reservierungen und Reisen — kuratiert für die Crew.
        </p>
      </section>

      <div className="hairline-b" />

      {/* Featured */}
      {featured.length > 0 && (
        <section className="px-5 py-8">
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted">Featured</p>
            <span className="text-[10px] tracking-[0.22em] uppercase text-inkDim">
              {totalOffers} {totalOffers === 1 ? 'offer' : 'offers'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {featured.map((o) => <OfferTile key={o.id} offer={o} />)}
          </div>
        </section>
      )}

      {/* Empty hero state when nothing seeded yet */}
      {featured.length === 0 && totalOffers === 0 && (
        <section className="px-5 py-12">
          <div className="hairline p-8 bg-surface/40 text-center">
            <p className="font-display text-ink leading-tight" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.01em' }}>
              Curating in progress.
            </p>
            <p className="text-[13px] text-inkMuted mt-3 leading-relaxed max-w-[320px] mx-auto">
              Founding partners werden eingeladen. Erste Drops in den nächsten Wochen.
            </p>
          </div>
        </section>
      )}

      {/* Categories */}
      <div className="hairline-t" />
      <section className="px-5 py-8">
        <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted mb-5">Categories</p>
        <ul className="space-y-2">
          {CATEGORIES.map((c) => {
            const count = counts[c.key] || 0
            return (
              <li key={c.key}>
                <Link to={`/savor/c/${c.key}`}
                      className="flex items-center justify-between gap-3 hairline px-4 py-4 bg-surface/40 active:scale-[0.995] transition-transform">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <span className="font-display text-accent text-[22px] leading-none w-7 text-center" aria-hidden="true">
                      {c.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-ink text-[18px] leading-tight" style={{ fontWeight: 500 }}>
                        {c.label}
                      </p>
                      <p className="text-[11px] text-inkDim tracking-wide truncate">{c.blurb}</p>
                    </div>
                  </div>
                  <span className="text-[10px] tracking-[0.28em] uppercase text-inkMuted tabular-nums">
                    {count > 0 ? count : '—'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Category previews — only if there is content */}
      {Object.entries(byCat).map(([catKey, offers]) =>
        offers.length === 0 ? null : (
          <section key={catKey} className="px-5 py-8 hairline-t">
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted">
                {CATEGORIES.find((c) => c.key === catKey)?.label || catKey}
              </p>
              <Link to={`/savor/c/${catKey}`}
                    className="text-[10px] tracking-[0.22em] uppercase text-accent hover:text-accentDeep">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {offers.map((o) => <OfferTile key={o.id} offer={o} compact />)}
            </div>
          </section>
        )
      )}

      <section className="px-5 py-10">
        <p className="text-[11px] text-inkDim tracking-[0.22em] uppercase text-center leading-relaxed">
          Du bist Pro-Shop, Club oder Marke? Werde Savor Partner — partners@swingandsavor.at
        </p>
      </section>
    </div>
  )
}
