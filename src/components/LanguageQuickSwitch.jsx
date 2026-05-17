import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../lib/i18n'

export default function LanguageQuickSwitch() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) || SUPPORTED_LANGUAGES[0]

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-line text-xs font-semibold text-inkMuted active:scale-95 transition-transform">
        <span>{current.flag}</span>
        <span className="uppercase tracking-wider">{current.code}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1.5 rounded-xl bg-surface border border-line py-1 min-w-[160px] z-20 shadow-xl">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button key={l.code}
                onClick={() => { i18n.changeLanguage(l.code); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-bg ${l.code === current.code ? 'text-accent font-semibold' : 'text-inkMuted'}`}>
                <span>{l.flag}</span>
                <span className="flex-1">{l.name}</span>
                {l.code === current.code && <span className="text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
