import { Icon } from './Icon'

export function Empty({ icon = 'Sparkles', title, hint, action }) {
  const Cmp = Icon[icon] ?? Icon.Sparkles
  return (
    <div className="glass specular rounded-3xl p-8 text-center animate-fade-in">
      <div className="w-14 h-14 mx-auto rounded-2xl glass flex items-center justify-center text-fairway mb-4">
        <Cmp size={28} />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {hint && <p className="text-sm text-muted mt-1.5 leading-relaxed">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
