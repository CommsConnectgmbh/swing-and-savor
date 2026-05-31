import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CreateSheet from './CreateSheet'
import { useHideOnScroll } from '../lib/cc/useHideOnScroll'

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
  const hidden = useHideOnScroll()

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
      {/* Comms CI glass pill — hide-on-scroll. Keeps the .bottom-nav class so the
          existing `body.sheet-open .bottom-nav { display:none }` rule still hides
          it behind sheets (FAB never sits under a sheet). No inline `transform`
          here — the canonical .ccnav owns transform for the slide animation. */}
      <nav
        aria-label="Hauptnavigation"
        className={`ccnav bottom-nav${hidden ? ' ccnav--hidden' : ''}`}
        style={{
          // Forest-tinted dark glass + champagne accent.
          '--ccnav-surface': 'rgba(10,26,18,0.72)',
          '--ccnav-border': 'rgba(244,241,234,0.10)',
          '--ccnav-accent': '#D9C9A8',
          '--ccnav-accent-ink': '#0A1A12',
          '--ccnav-ink': '#9CAFA4',
        }}
      >
        <div className="ccnav__row">
          {tabs.map((tab) => {
            if (tab.fab) {
              return (
                <div key="fab" className="ccnav__fab-slot">
                  <button
                    onClick={() => setSheetOpen(true)}
                    aria-label={tab.label}
                    className="ccnav__fab"
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
                className={`ccnav__tab${active ? ' is-active' : ''}`}
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
