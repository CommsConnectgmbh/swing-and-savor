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

const FlagIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22V4"/><path d="M4 4l13 2-2 5 2 5-13-2"/>
  </svg>
)
const SparkleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>
  </svg>
)
const CompassIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><polygon points="16 8 12 14 8 16 12 10 16 8"/>
  </svg>
)
const BagIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7V5a3 3 0 016 0v2"/>
  </svg>
)

export default function BottomNav() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [sheetOpen, setSheetOpen] = useState(false)

  const isSavorMode = pathname === '/savor' || pathname.startsWith('/savor/')

  const swingTabs = [
    { to: '/home',       Icon: HomeIcon,   label: t('nav.home',       'Home')    },
    { to: '/challenges', Icon: SwordsIcon, label: t('nav.challenges', 'Duelle')  },
    { fab: true,         label: t('nav.create',     'Neu')     },
    { to: '/matches',    Icon: ChartIcon,  label: t('nav.matches',    'Matches') },
    { to: '/me',         Icon: UserIcon,   label: t('nav.profile',    'Profil')  },
  ]

  const savorTabs = [
    { to: '/savor',                Icon: CompassIcon, label: 'Discover' },
    { to: '/savor/c/tee_times',    Icon: FlagIcon,    label: 'Tee Times' },
    { to: '/savor/c/experiences',  Icon: SparkleIcon, label: 'Erlebnisse' },
    { to: '/savor/c/apparel',      Icon: BagIcon,     label: 'Shop' },
    { to: '/me',                   Icon: UserIcon,    label: t('nav.profile', 'Profil') },
  ]

  const tabs = isSavorMode ? savorTabs : swingTabs

  // Aktive Match-/Profile-Routes mitfärben
  const isActive = (to) => {
    if (to === '/me') return pathname.startsWith('/me') || pathname.startsWith('/u/')
    if (to === '/matches') return pathname.startsWith('/matches')
    if (to === '/savor') return pathname === '/savor'
    if (to.startsWith('/savor/c/')) {
      const cat = to.split('/').pop()
      return pathname.startsWith(`/savor/c/${cat}`)
    }
    return pathname.startsWith(to)
  }

  return (
    <>
      <nav
        className="bottom-nav fixed bottom-0 left-0 right-0 z-50 hairline-t"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          // fixed-Elemente erben das laterale Body-Padding nicht — sonst clippt
          // die Navi im Landscape/iPad unter Notch & abgerundeten Ecken.
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          background: '#0A1A12',
          // GPU-Layer fixiert die Nav: sonst zuckt sie auf iOS bei URL-Bar-Toggle
          // und im Capacitor-1.1.3 mit contentInset='always' beim Scrollen mit.
          transform: 'translateZ(0)',
          willChange: 'transform',
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
                      background: '#D9C9A8',
                      color: '#0A1A12',
                      boxShadow: '0 8px 20px rgba(217,201,168,0.32), 0 0 0 4px #0A1A12',
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
