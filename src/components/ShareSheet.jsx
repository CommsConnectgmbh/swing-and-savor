import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { copyToClipboard, shareTargets } from '../lib/share'

export default function ShareSheet({ open, onClose, url, text, title }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  if (!open) return null
  const targets = shareTargets({ url, text })

  async function handleCopy() {
    const ok = await copyToClipboard(url)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 animate-fade-up" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-surface border-t sm:border border-line sm:rounded-2xl rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold tracking-[0.25em] uppercase text-inkMuted">{title || t('share.title')}</p>
          <button onClick={onClose} className="text-inkMuted text-xl leading-none p-1">×</button>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mb-4">
          {targets.map((target) => (
            <a key={target.id} href={target.href} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
              <ShareTargetIcon id={target.id} />
              <span className="text-[10px] text-inkMuted">{target.label}</span>
            </a>
          ))}
        </div>

        <button onClick={handleCopy}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-bg border border-line active:scale-[0.98] transition-transform">
          <span className="text-xs text-inkMuted truncate pr-2">{url}</span>
          <span className={`text-[11px] font-bold tracking-wider uppercase ${copied ? 'text-accent' : 'text-ink'}`}>
            {copied ? t('share.linkCopied') : t('share.copyLink')}
          </span>
        </button>
      </div>
    </div>
  )
}

function ShareTargetIcon({ id }) {
  const bg = {
    whatsapp: '#25D366',
    telegram: '#0088cc',
    twitter:  '#000000',
    facebook: '#1877F2',
    email:    '#6b7280',
  }[id] || '#374151'
  return (
    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white" style={{ background: bg }}>
      <ShareTargetGlyph id={id} />
    </div>
  )
}

function ShareTargetGlyph({ id }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true }
  switch (id) {
    case 'whatsapp':
      return <svg {...common}><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.157 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.34 11.894-11.893 11.894a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.519 5.276l-.999 3.648 3.969-1.023z"/></svg>
    case 'telegram':
      return <svg {...common}><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
    case 'twitter':
      return <svg {...common}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    case 'facebook':
      return <svg {...common}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    case 'email':
      return <svg {...common}><path d="M12 12.713l-11.985-9.713h23.97zm0 2.574l-12-9.725v15.438h24v-15.438z"/></svg>
    default:
      return null
  }
}
