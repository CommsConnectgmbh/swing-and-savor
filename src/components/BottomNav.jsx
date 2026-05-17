import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CreateSheet from './CreateSheet'

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1v-9.5z"/>
  </svg>
)

const SwordsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
    <line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/>
    <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/>
    <line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="3" y2="21"/>
  </svg>
)

const ChartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

const UserIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const PlusIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

export default function BottomNav() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [sheetOpen, setSheetOpen] = useState(false)

  const tabs = [
    { to: '/home',       Icon: HomeIcon,   label: t('nav.home',       'Home')    },
    { to: '/challenges', Icon: SwordsIcon, label: t('nav.challenges', 'Duelle')  },
    { fab: true,         label: t('nav.create',     'Neu')     },
    { to: '/matches',    Icon: ChartIcon,  label: t('nav.matches',    'Matches') },
    { to: '/me',         Icon: UserIcon,   label: t('nav.profile',    'Profil')  },
  ]

  // Aktive Match-/Profile-Routes mitfärben
  const isActive = (to) => {
    if (to === '/me') return pathname.startsWith('/me') || pathname.startsWith('/u/')
    if (to === '/matches') return pathname.startsWith('/matches')
    return pathname.startsWith(to)
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'rgba(13, 39, 30, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(152,205,2,0.14)',
        }}
      >
        <div className="flex max-w-lg mx-auto">
          {tabs.map((tab, i) => {
            if (tab.fab) {
              return (
                <div key="fab" className="flex-1 flex items-start justify-center -mt-5">
                  <button
                    onClick={() => setSheetOpen(true)}
                    aria-label={tab.label}
                    className="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                    style={{
                      background: '#98cd02',
                      color: '#0d271e',
                      boxShadow: '0 8px 20px rgba(152,205,2,0.35), 0 0 0 4px rgba(13,39,30,0.92)',
                    }}
                  >
                    <PlusIcon />
                  </button>
                </div>
              )
            }
            const active = isActive(tab.to)
            const Icon = tab.Icon
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={`flex-1 flex flex-col items-center pt-2.5 pb-2 gap-1 transition-all duration-150 active:scale-[0.94] ${
                  active ? 'text-accent' : 'text-inkDim'
                }`}
              >
                <span className={`transition-transform duration-200 ${active ? 'scale-110' : 'scale-100'}`}>
                  <Icon />
                </span>
                <span className="text-[9px] font-semibold tracking-[0.14em] uppercase">{tab.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      <CreateSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
