import { Icon } from './Icon'

// Big-tap stroke counter — used on the scoring screen.
export function Stepper({ value, onChange, label, accent = 'A', min = 1, max = 15 }) {
  const ringColor = accent === 'A' ? 'ring-teamA/60' : 'ring-teamB/60'
  const glowColor = accent === 'A' ? 'shadow-[0_0_40px_-8px_rgba(59,130,246,0.5)]' : 'shadow-[0_0_40px_-8px_rgba(239,68,68,0.5)]'
  const grad = accent === 'A'
    ? 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.20))'
    : 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(251,146,60,0.20))'

  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))

  return (
    <div className={`glass specular rounded-3xl p-4 ring-1 ${ringColor} ${glowColor}`} style={{ background: grad }}>
      <div className="text-[11px] uppercase tracking-wider text-ink/70 mb-2 text-center font-semibold">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={dec}
          aria-label="Schlag weniger"
          className="w-12 h-12 rounded-2xl glass-inset tap text-ink/90 flex items-center justify-center"
        >
          <Icon.Minus />
        </button>
        <div className="flex-1 text-center">
          <div className="font-display text-5xl font-bold tabular-nums tracking-tight leading-none">
            {value}
          </div>
          <div className="text-[10px] text-ink/60 mt-1">Schläge</div>
        </div>
        <button
          onClick={inc}
          aria-label="Schlag mehr"
          className="w-12 h-12 rounded-2xl glass-inset tap text-ink/90 flex items-center justify-center"
        >
          <Icon.Plus />
        </button>
      </div>
    </div>
  )
}
