// Lightweight inline SVG icon set — keeps bundle tiny, sharp at any size.
const wrap = (children, size = 22, stroke = 1.8) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
       stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

export const Icon = {
  Trophy:   ({ size, stroke }) => wrap(<><path d="M8 21h8M12 17v4M7 4h10v3a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></>, size, stroke),
  Flag:     ({ size, stroke }) => wrap(<><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></>, size, stroke),
  Plus:     ({ size, stroke }) => wrap(<><path d="M12 5v14M5 12h14"/></>, size, stroke),
  ChevronLeft:  ({ size, stroke }) => wrap(<path d="M15 6l-6 6 6 6"/>, size, stroke),
  ChevronRight: ({ size, stroke }) => wrap(<path d="M9 6l6 6-6 6"/>, size, stroke),
  Home:     ({ size, stroke }) => wrap(<><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></>, size, stroke),
  Players:  ({ size, stroke }) => wrap(<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M14.5 20c.4-2.2 2.5-3.5 4.5-3.5"/></>, size, stroke),
  Calendar: ({ size, stroke }) => wrap(<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>, size, stroke),
  Check:    ({ size, stroke }) => wrap(<path d="M5 12l5 5L20 7"/>, size, stroke),
  X:        ({ size, stroke }) => wrap(<path d="M6 6l12 12M18 6l-12 12"/>, size, stroke),
  Minus:    ({ size, stroke }) => wrap(<path d="M5 12h14"/>, size, stroke),
  Sparkles: ({ size, stroke }) => wrap(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></>, size, stroke),
  Stats:    ({ size, stroke }) => wrap(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>, size, stroke),
  Live:     ({ size, stroke }) => wrap(<><circle cx="12" cy="12" r="3"/><path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14M8 8a6 6 0 0 0 0 8M16 8a6 6 0 0 1 0 8"/></>, size, stroke),
  Pin:      ({ size, stroke }) => wrap(<><path d="M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></>, size, stroke),
}
