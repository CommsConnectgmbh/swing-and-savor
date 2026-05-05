// Initials avatar with team-tinted gradient — small but recognisable.
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
}

const teamGrad = {
  A: 'linear-gradient(135deg, #60a5fa 0%, #6366f1 100%)',
  B: 'linear-gradient(135deg, #f87171 0%, #fb923c 100%)',
  N: 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)',
}

export function Avatar({ name, team = 'N', size = 40 }) {
  return (
    <div
      className="rounded-2xl flex items-center justify-center font-semibold text-white shadow-glass shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35, background: teamGrad[team] || teamGrad.N }}
    >
      {initials(name)}
    </div>
  )
}
