import { initials as nameInitials } from '../lib/names'

// Shared round avatar used across the public share screens (Recap, Crew, Hall
// of Fame, Invitational), which each previously carried a byte-for-byte copy of
// this markup. Renders the image when a `src` is present, otherwise the name's
// initials centred in a surface-coloured circle.
//
// `fontSize` (px) controls the initials scale so every caller reproduces its
// own sizing: some screens use a fixed size, others scale it relative to the
// avatar (`size / n`). It defaults to `size / 3.2`.
export default function Avatar({ src, name, size = 40, fontSize = size / 3.2 }) {
  return (
    <div
      className="rounded-full overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, border: '1px solid rgba(244,241,234,0.16)' }}
    >
      {src
        ? <img src={src} alt={name || ''} className="w-full h-full object-cover" loading="lazy" />
        : <span className="font-display text-ink uppercase tracking-wider" style={{ fontSize }}>
            {nameInitials(name)}
          </span>}
    </div>
  )
}
