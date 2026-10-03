// Shared inline SVG icon components.
//
// These small, prop-less icons were copy-pasted verbatim across several
// screens (edit-pencil and close-cross in TeamsScreen/MatchesScreen, plus a
// stray unused pencil in CasualScreen). Keeping a single definition prevents
// the stroke/size/path variants from drifting apart over time.
//
// NOTE: only the 14×14 variants live here. CupScreen intentionally renders a
// 15×15 pencil at its own call site, so it is left untouched.

export function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
