import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'

const items = [
  { to: '/',           label: 'Turniere',    icon: 'Home' },
  { to: '/leaderboard', label: 'Standings', icon: 'Stats' },
  { to: '/create',      label: 'Neu',       icon: 'Plus' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 px-3 pointer-events-none"
         style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
      <div className="glass-strong specular pointer-events-auto rounded-full px-2 py-2 flex items-center justify-between gap-1 max-w-md mx-auto shadow-glass-lg border-white/10">
        {items.map(({ to, label, icon }) => {
          const Cmp = Icon[icon]
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2 rounded-full tap text-[11px] font-medium transition ${
                  isActive
                    ? 'text-ink bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                    : 'text-muted hover:text-ink/90'
                }`
              }
            >
              <Cmp size={22} />
              <span className="leading-none">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
