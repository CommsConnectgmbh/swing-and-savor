import { Link } from 'react-router-dom'

// Shared public-cup list row. This exact markup was copy-pasted, byte for byte,
// as a local `CupRow` in CrewScreen, HallOfFameScreen and SeasonScreen — three
// independent copies that had to be kept in sync by hand. It links to the recap
// for a finished cup and to the live invitational view otherwise, and renders
// the cup name, a "location · date" line and (optionally) the champion.
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
