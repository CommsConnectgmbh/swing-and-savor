import { useEffect } from 'react'

/**
 * Registers the body-level side effects of an open bottom-sheet / modal.
 *
 * A sheet component needs to signal, at the <body> level, that it is open so
 * that shared chrome gets out of the way. This was previously duplicated inline
 * across CreateSheet, and the FriendPicker / Guest / HcpEditor sheets in
 * CasualScreen and the roster picker in MatchesScreen. Centralising it keeps
 * the `sheet-open` contract in one place — the global CSS rule
 * `body.sheet-open .bottom-nav { display: none }` (src/index.css) depends on it.
 *
 * The hook:
 *  - adds the `sheet-open` class to <body> so the bottom nav + FAB hide behind
 *    the sheet,
 *  - optionally locks page scroll (`body.style.overflow = 'hidden'`),
 *  - optionally closes the sheet when the user presses Escape.
 *
 * Every effect is torn down when the component unmounts or when `active` turns
 * false, restoring the previous body state.
 *
 * @param {Object}   [opts]
 * @param {boolean}  [opts.active=true]      Whether the sheet is currently open.
 * @param {boolean}  [opts.lockScroll=false] Also freeze body scroll while open.
 * @param {Function} [opts.onEscape]         Called when Escape is pressed.
 */
export function useSheetBody({ active = true, lockScroll = false, onEscape } = {}) {
  useEffect(() => {
    if (!active) return undefined
    const onKey = onEscape
      ? (e) => { if (e.key === 'Escape') onEscape() }
      : null
    if (onKey) window.addEventListener('keydown', onKey)
    if (lockScroll) document.body.style.overflow = 'hidden'
    document.body.classList.add('sheet-open')
    return () => {
      if (onKey) window.removeEventListener('keydown', onKey)
      if (lockScroll) document.body.style.overflow = ''
      document.body.classList.remove('sheet-open')
    }
  }, [active, lockScroll, onEscape])
}
