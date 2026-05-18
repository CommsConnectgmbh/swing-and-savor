import { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * Tour-Screen v1 — Bridge zur grossen Welt des Pro-Golfs.
 * Embedded YouTube-Channels (CORS-free) + kuratierte Outbound-Links zu den
 * offiziellen Live-Scoring-Seiten. Eigene Live-Daten kämen mit einer
 * Sportradar/SportsData-Lizenz dazu — bewusst (noch) nicht im Scope.
 */
const CHANNELS = [
  { id: 'UCBfPjcKlsXh7HOyJ7Dlpk5w', label: 'PGA Tour',         tag: 'PGA' },
  { id: 'UC5kSk3pTNGdjVk6tlx9_b4w', label: 'DP World Tour',    tag: 'EUR' },
  { id: 'UCmAYxhSwOhEHt-AhepDC59A', label: 'LPGA',             tag: 'LPGA' },
  { id: 'UCt8sUSlz5IGY6m9eipKn79g', label: 'The Masters',      tag: 'MAJ' },
]

const TOUR_LINKS = [
  { url: 'https://www.pgatour.com/leaderboard',           label: 'PGA Tour · Leaderboard',         site: 'pgatour.com' },
  { url: 'https://www.europeantour.com/dpworld-tour/',    label: 'DP World Tour · Live',           site: 'europeantour.com' },
  { url: 'https://www.lpga.com/tournaments',              label: 'LPGA · Schedule + Live',         site: 'lpga.com' },
  { url: 'https://www.masters.com/',                      label: 'The Masters · Augusta',          site: 'masters.com' },
  { url: 'https://www.usopen.com/',                       label: 'US Open',                        site: 'usopen.com' },
  { url: 'https://www.theopen.com/',                      label: 'The Open Championship',          site: 'theopen.com' },
]

const TABS = [
  { key: 'videos', label: 'Videos' },
  { key: 'live',   label: 'Live Scores' },
]

export default function TourScreen() {
  const [tab, setTab]       = useState('videos')
  const [active, setActive] = useState(CHANNELS[0])

  return (
    <div className="max-w-lg mx-auto animate-fade-up">
      <div className="px-4 pt-6 pb-3">
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">Tour</h1>
        <p className="text-xs text-inkMuted mt-0.5">
          PGA · DP World · LPGA · Majors — Highlights und Live-Stände.
        </p>
      </div>

      {/* Tab-Switcher */}
      <div className="px-3 mb-3 flex gap-1.5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide active:scale-95 transition-all ${
              tab === t.key
                ? 'bg-accent text-brandDark'
                : 'bg-surface text-inkMuted border border-line'
            }`}>{t.label}</button>
        ))}
      </div>

      {tab === 'videos' && (
        <>
          {/* Channel-Selector */}
          <div className="px-3 mb-3 flex gap-1.5 overflow-x-auto">
            {CHANNELS.map(c => (
              <button key={c.id} onClick={() => setActive(c)}
                className={`px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap active:scale-95 transition-all ${
                  active.id === c.id
                    ? 'bg-accent/15 text-accent border border-accent/40'
                    : 'bg-surface text-inkMuted border border-line'
                }`}>
                {c.label}
              </button>
            ))}
          </div>

          {/* YouTube-Channel-Embed (Live + neueste Uploads) */}
          <div className="mx-3 mb-4 rounded-card overflow-hidden bg-bg border border-line"
            style={{ aspectRatio: '16/9' }}>
            <iframe key={active.id}
              src={`https://www.youtube.com/embed/videoseries?list=UU${active.id.slice(2)}`}
              title={active.label}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full" />
          </div>

          <p className="px-4 text-[11px] text-inkDim text-center mb-6">
            Spielt der Tour-Channel direkt aus YouTube — Videos siehst du nach Stand
            der jeweiligen Tour.
          </p>
        </>
      )}

      {tab === 'live' && (
        <div className="mx-3 rounded-card overflow-hidden bg-surface border border-line">
          {TOUR_LINKS.map((l, idx) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener"
              className="flex items-center gap-3 px-4 py-3.5 active:bg-bg/40 transition-colors"
              style={{ borderBottom: idx < TOUR_LINKS.length - 1 ? '1px solid #15302A' : 'none' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-accent/12 border border-accent/30 text-accent">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-ink truncate">{l.label}</p>
                <p className="text-[11px] text-inkDim truncate">{l.site}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" className="text-inkDim flex-shrink-0">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          ))}
        </div>
      )}

      <p className="px-4 mt-6 text-[11px] text-inkDim text-center">
        Eigene Live-Leaderboards in der App brauchen eine Datenlizenz — kommt,
        wenn die Community gross genug ist. Bis dahin gehen die Live-Links
        direkt zu den offiziellen Tour-Sites.
      </p>

      <div className="text-center mt-4">
        <Link to="/home" className="text-xs text-accent font-bold">← Zurück zum Feed</Link>
      </div>
      <div className="h-24" />
    </div>
  )
}
