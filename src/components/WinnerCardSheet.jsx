import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { renderStoryOverlay, renderChampionCard, renderPortraitCard, shareCard } from '../lib/cardRenderer'

const TABS = [
  { id: 'story',     label: 'Story',     aspect: '9 / 16', filename: 'swing-savor-story.png',     transparent: true  },
  { id: 'square',    label: 'Champion',  aspect: '1 / 1',  filename: 'swing-savor-champion.png',  transparent: false },
  { id: 'whatsapp',  label: 'WhatsApp',  aspect: '4 / 5',  filename: 'swing-savor-whatsapp.png',  transparent: false },
]

/**
 * Winner-Card / Story-Overlay generator.
 *
 * Pass in the player-stats payload + (optional) avatar URL. The sheet renders
 * three formats on demand, lets the user preview each, and triggers either
 * the native Web Share API or a download fallback.
 *
 * The Story tab produces a TRANSPARENT 1080×1920 PNG — Strava-style — that
 * the player can paste on top of their own golf photo inside Instagram Stories.
 */
export default function WinnerCardSheet({ open, onClose, payload, shareUrl }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('story')
  const [previews, setPreviews] = useState({})   // { story: dataUrl, ... }
  const [blobs,    setBlobs]    = useState({})   // { story: Blob }
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!open) {
      setPreviews({}); setBlobs({}); setStatus(null)
      return
    }
    // Render all three formats up-front so previews are snappy.
    let cancelled = false
    setBusy(true)
    ;(async () => {
      const [story, square, whatsapp] = await Promise.all([
        renderStoryOverlay(payload),
        renderChampionCard(payload),
        renderPortraitCard(payload),
      ])
      if (cancelled) return
      setPreviews({ story: story.dataUrl, square: square.dataUrl, whatsapp: whatsapp.dataUrl })
      setBlobs({ story: story.blob, square: square.blob, whatsapp: whatsapp.blob })
      setBusy(false)
    })().catch(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [open, payload])

  if (!open) return null

  async function handleShare() {
    const meta = TABS.find((t) => t.id === tab)
    const blob = blobs[tab]
    if (!blob) return
    setStatus('sharing')
    const result = await shareCard({
      blob, filename: meta.filename,
      title: `${payload.championName || payload.playerName || 'Swing & Savor'}`,
      text: payload.cupName ? `${payload.cupName} — ${payload.score ?? ''}` : 'Swing & Savor',
      url: shareUrl,
    })
    setStatus(result === 'shared' ? 'shared' : result === 'downloaded' ? 'downloaded' : null)
    setTimeout(() => setStatus(null), 2400)
  }

  const meta = TABS.find((m) => m.id === tab)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-up"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-bg hairline-t sm:hairline sm:rounded-card rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[10px] tracking-[0.32em] uppercase text-inkMuted">
            {t('common.share')} · Winner Card
          </p>
          <button onClick={onClose} className="text-inkMuted text-2xl leading-none p-1" aria-label="Close">×</button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5">
          {TABS.map((tIt) => (
            <button
              key={tIt.id}
              onClick={() => setTab(tIt.id)}
              className={`flex-1 py-2.5 text-[11px] tracking-[0.22em] uppercase transition-colors
                ${tab === tIt.id
                  ? 'text-bg bg-accent'
                  : 'text-inkMuted hairline'
                }`}
            >
              {tIt.label}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="relative w-full flex items-center justify-center mb-5"
             style={{ minHeight: 280 }}>
          <div
            className={`relative w-full hairline overflow-hidden ${
              meta.transparent
                ? 'bg-[length:20px_20px] bg-[linear-gradient(45deg,#16332B_25%,transparent_25%),linear-gradient(-45deg,#16332B_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#16332B_75%),linear-gradient(-45deg,transparent_75%,#16332B_75%)]'
                : 'bg-bg'
            }`}
            style={{ aspectRatio: meta.aspect, maxWidth: tab === 'story' ? 220 : 320, margin: '0 auto' }}
          >
            {previews[tab] ? (
              <img src={previews[tab]} alt={`${meta.label} preview`} className="w-full h-full object-contain" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-inkDim text-xs tracking-[0.2em] uppercase">
                {busy ? 'Rendering…' : '—'}
              </div>
            )}
          </div>
        </div>

        {/* Story-specific hint */}
        {tab === 'story' && (
          <p className="text-[11px] text-inkMuted leading-relaxed mb-4 text-center max-w-[320px] mx-auto">
            {t('share.storyOverlayHint')}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleShare}
            disabled={!blobs[tab] || busy}
            className="w-full py-4 bg-accent text-bg text-[12px] font-medium tracking-[0.28em] uppercase active:scale-[0.99] transition-transform disabled:opacity-50"
          >
            {status === 'shared'     ? t('common.done')
            : status === 'downloaded' ? t('common.copied')
            : tab === 'story'         ? t('share.storyOverlayCta')
            : t('common.share')}
          </button>
        </div>
      </div>
    </div>
  )
}
