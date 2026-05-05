import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'

export function Header({ title, subtitle, back, right }) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-30 px-4 pt-safe pb-3">
      <div className="glass specular rounded-3xl px-3 py-2.5 flex items-center gap-2">
        {back ? (
          <button
            onClick={() => nav(-1)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-ink/90 tap hover:bg-white/5"
            aria-label="Zurück"
          >
            <Icon.ChevronLeft />
          </button>
        ) : (
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-fairway">
            <Icon.Flag />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}
