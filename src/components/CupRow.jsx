import { Link } from 'react-router-dom'

// Compact cup list-row used by the public Season / Crew / Hall-of-Fame
// screens, which each shipped a byte-for-byte identical copy. A finished
// cup links to its recap, an ongoing one to the invitational page; the
// meta line joins the (optional) location and date, and an optional
// champion line renders when present.
export default function CupRow({ cup }) {
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
