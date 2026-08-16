import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import { SAVOR_FUNCTIONS_URL, formatOfferPrice } from '../lib/savor'
import { pluralize } from '../lib/format'

const DISCORD_INVITE = 'https://discord.gg/jT2GpZqZVE'

const ICON_STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function CategoryIcon({ kind }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', ...ICON_STROKE, 'aria-hidden': true }
  switch (kind) {
    case 'tee_times':
      return (
        <svg {...common}>
          <path d="M6 21V4" />
          <path d="M6 4l11 3-5 3 5 3-11 2" />
        </svg>
      )
    case 'experiences':
      return (
        <svg {...common}>
          <path d="M12 3l1.8 4.6L18.5 9l-4 3.2L15.8 17 12 14.4 8.2 17l1.3-4.8L5.5 9l4.7-1.4z" />
        </svg>
      )
    case 'dining':
      return (
        <svg {...common}>
          <path d="M7 3v8a2 2 0 002 2v8" />
          <path d="M5 3v6" />
          <path d="M9 3v6" />
          <path d="M16 3c-1.5 0-3 2-3 5s1 4 3 4v9" />
        </svg>
      )
    case 'travel':
      return (
        <svg {...common}>
          <path d="M2.5 12l19-7-3 9 3 9-19-7 7-2z" />
        </svg>
      )
    case 'apparel':
      return (
        <svg {...common}>
          <path d="M4 7l4-3 2 2a2 2 0 004 0l2-2 4 3-2 4-2-1v10H8V10L6 11z" />
        </svg>
      )
    case 'equipment':
      return (
        <svg {...common}>
          <circle cx="6" cy="18" r="2" />
          <path d="M7.5 16.5l11-13a2 2 0 113 3l-13 11" />
          <path d="M14 8l3 3" />
        </svg>
      )
    case 'discord':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
        </svg>
      )
    default:
      return null
  }
}

const CATEGORIES = [
  { key: 'tee_times',   label: 'Tee Times',   blurb: 'Greenfees auf kuratierten Plätzen.' },
  { key: 'experiences', label: 'Experiences', blurb: 'Pro-Lessons, Clinics & Member-Events.' },
  { key: 'dining',      label: 'Dining',      blurb: '19th-Hole-Reservierungen & Clubhaus-Tische.' },
  { key: 'travel',      label: 'Travel',      blurb: 'Golfreisen, Luxus-Resorts & Trip Cups.' },
  { key: 'apparel',     label: 'Apparel',     blurb: 'Polos, Caps, Knit & Outerwear.' },
  { key: 'equipment',   label: 'Equipment',   blurb: 'Schläger, Bags, Bälle & Pro-Shop-Picks.' },
]

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
          {formatOfferPrice(offer)}
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
    fetch(`${SAVOR_FUNCTIONS_URL}?mode=home`, {
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
              {totalOffers} {pluralize(totalOffers, 'offer', 'offers')}
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
                    <span className="text-accent w-7 flex items-center justify-center" aria-hidden="true">
                      <CategoryIcon kind={c.key} />
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
          <li>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer"
               className="flex items-center justify-between gap-3 hairline px-4 py-4 bg-surface/40 active:scale-[0.995] transition-transform">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <span className="w-7 flex items-center justify-center" style={{ color: '#5865F2' }} aria-hidden="true">
                  <CategoryIcon kind="discord" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-ink text-[18px] leading-tight" style={{ fontWeight: 500 }}>
                    Community
                  </p>
                  <p className="text-[11px] text-inkDim tracking-wide truncate">Discord — Cups, 19th Hole & Drops zuerst.</p>
                </div>
              </div>
              <span className="text-[10px] tracking-[0.28em] uppercase text-accent">
                Join →
              </span>
            </a>
          </li>
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
