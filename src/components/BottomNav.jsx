import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/cup',     icon: '🏆', label: 'Cup'     },
  { to: '/matches', icon: '⚔️',  label: 'Matches' },
  { to: '/teams',   icon: '👥', label: 'Teams'   },
  { to: '/board',   icon: '📊', label: 'Board'   },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs transition-colors ` +
              (isActive ? 'text-accent' : 'text-muted')
            }
          >
            <span className="text-xl mb-0.5">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
