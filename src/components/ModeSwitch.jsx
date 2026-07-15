import { Link, useLocation } from 'react-router-dom'
import { useSavorEnabled } from '../lib/savor'

/**
 * Editorial Swing | Savor mode switch.
 *
 *  Swing  → the golf app (Cups, Invitationals, Match Play, Hall of Fame)
 *  Savor  → the lifestyle layer (Tee Times, Experiences, Dining, Apparel, Travel)
 *
 * The active half is filled with Champagne; the inactive half stays hairline-bone.
 * Lives inside BrandHeader so it's always one tap away.
 *
 * The switch only appears once the Savor world actually has live offers (see
 * useSavorEnabled). Until then it stays hidden so we don't tease an empty
 * shopping world — it reappears automatically the moment an offer goes live.
 */
export default function ModeSwitch() {
  const { pathname } = useLocation()
  const savorEnabled = useSavorEnabled()
  if (savorEnabled !== true) return null

  const isSavor = pathname === '/savor' || pathname.startsWith('/savor/')

  return (
    <div
      className="inline-flex items-center hairline rounded-pill p-[2px] select-none"
      style={{ background: 'rgba(244,241,234,0.04)' }}
      role="tablist"
      aria-label="Mode"
    >
      <Link
        to="/home"
        role="tab"
        aria-selected={!isSavor}
        className={`px-3 py-1 rounded-pill text-[10px] tracking-[0.28em] uppercase transition-colors leading-none ${
          !isSavor ? 'bg-accent text-brandDark' : 'text-inkMuted hover:text-ink'
        }`}
      >
        Swing
      </Link>
      <Link
        to="/savor"
        role="tab"
        aria-selected={isSavor}
        className={`px-3 py-1 rounded-pill text-[10px] tracking-[0.28em] uppercase transition-colors leading-none ${
          isSavor ? 'bg-accent text-brandDark' : 'text-inkMuted hover:text-ink'
        }`}
      >
        Savor
      </Link>
    </div>
  )
}
