import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import { savorFetch, formatOfferPrice } from '../lib/savor'

const CATEGORY_META = {
  tee_times:   { label: 'Tee Times',   blurb: 'Kuratierte Greenfees und Flights.' },
  experiences: { label: 'Experiences', blurb: 'Pro-Lessons, Clinics & Member-Events.' },
  dining:      { label: 'Dining',      blurb: '19th-Hole-Reservierungen & Clubhaus-Tische.' },
  apparel:     { label: 'Apparel',     blurb: 'Polos, Caps, Knit & Outerwear.' },
  travel:      { label: 'Travel',      blurb: 'Golfreisen, Luxus-Resorts und Trip Cups.' },
  equipment:   { label: 'Equipment',   blurb: 'Schläger, Bags, Bälle & Pro-Shop-Picks.' },
}

export default function SavorCategoryScreen() {
  const { category } = useParams()
  const meta = CATEGORY_META[category]
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('')

  useEffect(() => {
    if (!meta) return
    let cancelled = false
    setLoading(true)
    const params = { mode: 'category', category }
    if (city) params.city = city
    savorFetch(params)
      .then(async (r) => r.ok ? r.json() : { offers: [] })
      .then((j) => { if (!cancelled) { setOffers(j.offers || []); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [category, city, meta])

  if (!meta) {
    return (
      <div className="max-w-lg mx-auto py-20 px-6 text-center">
        <p className="text-inkMuted text-sm">Kategorie nicht gefunden.</p>
        <Link to="/savor" className="text-accent text-sm tracking-[0.22em] uppercase mt-4 inline-block">
          ← Savor
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-32 animate-fade-up">
      {/* Editorial header */}
      <section className="px-5 pt-8 pb-5">
        <Link to="/savor" className="text-[10px] tracking-[0.32em] uppercase text-inkDim hover:text-accent">
          ← Savor
        </Link>
        <h1 className="font-display text-ink leading-none mt-3"
            style={{ fontSize: 'clamp(32px, 8vw, 48px)', fontWeight: 500, letterSpacing: '-0.02em' }}>
          {meta.label}
        </h1>
        <p className="text-[13px] text-inkMuted mt-3 tracking-wide">{meta.blurb}</p>
      </section>

      <div className="hairline-b" />

      {/* City filter (tee_times + travel + dining only) */}
      {['tee_times','dining','travel'].includes(category) && (
        <div className="px-5 py-4 hairline-b">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Stadt filtern …"
            className="w-full bg-bg hairline px-3 py-2.5 text-ink text-sm placeholder:text-inkDim"
          />
        </div>
      )}

      {loading ? (
        <div className="py-20 flex items-center justify-center"><LoadingSpinner /></div>
      ) : offers.length === 0 ? (
        <section className="px-5 py-16">
          <div className="hairline p-8 bg-surface/40 text-center">
            <p className="font-display text-ink leading-tight" style={{ fontSize: 22, fontWeight: 500 }}>
              Noch keine Angebote in dieser Kategorie.
            </p>
            <p className="text-[12px] text-inkMuted mt-3 max-w-[300px] mx-auto leading-relaxed">
              Founding partners werden eingeladen. Schau in Kürze wieder vorbei.
            </p>
          </div>
        </section>
      ) : (
        <section className="px-5 py-6">
          <div className="grid grid-cols-2 gap-3">
            {offers.map((o) => (
              <Link key={o.id} to={`/savor/o/${o.slug}`}
                    className="block hairline overflow-hidden bg-surface/40 active:scale-[0.99] transition-transform">
                <div className="relative aspect-[4/5] bg-bg overflow-hidden">
                  {o.image_url ? (
                    <img src={o.image_url} alt="" loading="lazy"
                         className="w-full h-full object-cover opacity-[0.92]" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-inkDim font-display text-3xl">·</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-3"
                       style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(10,26,18,0.92) 80%)' }}>
                    {o.badge && (
                      <span className="inline-block text-[9px] tracking-[0.3em] uppercase px-1.5 py-0.5 mb-1.5 hairline text-accent">
                        {o.badge}
                      </span>
                    )}
                    <p className="font-display text-ink leading-tight" style={{ fontSize: 17, fontWeight: 500 }}>
                      {o.title}
                    </p>
                    {o.city && (
                      <p className="text-[10px] tracking-[0.22em] uppercase text-inkMuted truncate mt-1">{o.city}</p>
                    )}
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] text-inkDim tracking-wide truncate pr-2">
                    {o.partner?.name || ''}
                  </span>
                  <span className="text-[11px] text-accent tracking-wider tabular-nums">
                    {formatOfferPrice(o)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
