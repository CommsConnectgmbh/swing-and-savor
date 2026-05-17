import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Bottom-Sheet, das vom zentralen [+] in der BottomNav geöffnet wird.
 * Bietet die drei primären Schöpfungsaktionen: Match, Duell, Turnier.
 */
export default function CreateSheet({ open, onClose }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  function go(path) { onClose(); navigate(path) }

  const items = [
    {
      key: 'match',
      label: 'Neues Match',
      sub: 'Singles, Doubles oder Flight im Turnier',
      to: '/matches?new=1',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
          <line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/>
          <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/>
        </svg>
      ),
    },
    {
      key: 'challenge',
      label: 'Neues Duell',
      sub: '1-on-1 gegen Freunde, direkt herausfordern',
      to: '/challenges?new=1',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
          <line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
      ),
    },
    {
      key: 'cup',
      label: 'Neues Turnier',
      sub: 'Cup mit Teams, Matches und Leaderboard',
      to: '/cup?new=1',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12v6a6 6 0 01-12 0V3z"/>
          <path d="M6 9H4a2 2 0 000 4h2M18 9h2a2 2 0 010 4h-2"/>
          <line x1="12" y1="15" x2="12" y2="19"/><line x1="9" y1="19" x2="15" y2="19"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" role="dialog" aria-modal="true">
      <div onClick={onClose}
        className="absolute inset-0 bg-black/60 animate-fade-up"
        style={{ animationDuration: '180ms' }} />

      <div className="relative w-full max-w-lg rounded-t-3xl bg-surface border-t border-line shadow-lift animate-fade-up"
        style={{ animationDuration: '220ms', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>

        {/* Grabber */}
        <div className="pt-2.5 pb-3 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-line" />
        </div>

        <p className="px-5 text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted">
          Neu anlegen
        </p>

        <div className="px-3 pt-2 pb-1">
          {items.map((it) => (
            <button key={it.key}
              onClick={() => go(it.to)}
              className="w-full flex items-center gap-4 px-3 py-3.5 rounded-2xl active:bg-bg/60 transition-colors">
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0
                bg-accent/12 text-accent border border-accent/25">
                {it.icon}
              </span>
              <span className="flex-1 text-left min-w-0">
                <span className="block font-bold text-base text-ink leading-tight">{it.label}</span>
                <span className="block text-xs text-inkMuted leading-tight mt-0.5 truncate">{it.sub}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" className="text-inkDim flex-shrink-0">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ))}
        </div>

        <button onClick={onClose}
          className="block mx-3 mt-2 w-[calc(100%-1.5rem)] py-3 rounded-2xl text-sm font-bold bg-bg text-inkMuted border border-line active:scale-[0.98] transition-transform">
          Abbrechen
        </button>
      </div>
    </div>
  )
}
