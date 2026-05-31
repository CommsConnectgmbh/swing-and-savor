/* =========================================================
   Comms CI — useHideOnScroll
   Canonical hide-on-scroll behaviour for the glass bottom nav.
   Framework-agnostic React hook (works in React 18 + 19; Next + Vite).

   Returns `true` while the nav should be HIDDEN (user scrolling DOWN,
   away from the top). The nav reappears on any upward scroll and is
   always shown near the top of the page.

   Usage:
     const hidden = useHideOnScroll();
     <nav className={`ccnav${hidden ? " ccnav--hidden" : ""}`}>…</nav>

   Keep in sync with the copy in Comms CI/components/glass-bottom-nav.
   ========================================================= */
import { useEffect, useRef, useState } from "react";

export interface HideOnScrollOptions {
  /** Px the page must scroll before any hide is considered. */
  topThreshold?: number;
  /** Min delta between samples to count as a real scroll (debounces jitter). */
  delta?: number;
  /** Optional scroll container; defaults to window. */
  getScrollTop?: () => number;
  /** Element the scroll listener attaches to; defaults to window. */
  target?: () => Window | HTMLElement | null;
}

export function useHideOnScroll(options: HideOnScrollOptions = {}): boolean {
  const { topThreshold = 64, delta = 6 } = options;
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // Honour reduced-motion: never auto-hide.
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const readTop =
      options.getScrollTop ??
      (() =>
        window.scrollY ??
        document.documentElement.scrollTop ??
        0);

    const targetEl: Window | HTMLElement =
      (options.target?.() as Window | HTMLElement | null) ?? window;

    lastY.current = readTop();

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = readTop();
        const diff = y - lastY.current;

        if (Math.abs(diff) > delta) {
          if (y <= topThreshold) {
            setHidden(false); // always visible near the top
          } else if (diff > 0) {
            setHidden(true); // scrolling down → hide
          } else {
            setHidden(false); // scrolling up → show
          }
          lastY.current = y;
        }
        ticking.current = false;
      });
    };

    targetEl.addEventListener("scroll", onScroll, { passive: true });
    return () => targetEl.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topThreshold, delta]);

  return hidden;
}

export default useHideOnScroll;
