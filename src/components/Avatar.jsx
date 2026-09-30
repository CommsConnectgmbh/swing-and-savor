import { initials as nameInitials } from '../lib/names'

// Read-only circular avatar shared by the public share screens
// (Recap, Crew, Invitational, Hall of Fame). Renders the profile image when a
// `src` is present, otherwise a monogram fallback derived from `name` via
// `lib/names#initials`.
//
// Each of those screens previously carried its own copy of this container +
// `<img>` markup. The copies were identical except for the fallback monogram's
// font size, so that stays configurable via `initialsFontSize`:
//   • a number   → a fixed size in px (Recap used 10, Invitational 12)
//   • a function → derived from `size`, e.g. (s) => s / 3.4 (Crew).
// The default `(s) => s / 3.2` matches the Hall of Fame sizing.
export default function Avatar({ src, name, size = 32, initialsFontSize = (s) => s / 3.2 }) {
  const fontSize = typeof initialsFontSize === 'function' ? initialsFontSize(size) : initialsFontSize
  return (
    <div
      className="rounded-full overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, border: '1px solid rgba(244,241,234,0.16)' }}
    >
      {src
        ? <img src={src} alt={name || ''} className="w-full h-full object-cover" loading="lazy" />
        : <span className="font-display text-ink uppercase tracking-wider" style={{ fontSize }}>{nameInitials(name)}</span>}
    </div>
  )
}
