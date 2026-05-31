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

    const scrollEl = options.target?.() as HTMLElement | Window | null;
    const targetEl: Window | HTMLElement = scrollEl ?? window;
    const isWindow = targetEl === window;

    const rawTop =
      options.getScrollTop ??
      (() =>
        isWindow
          ? window.scrollY || document.documentElement.scrollTop || 0
          : (targetEl as HTMLElement).scrollTop);

    // Max scrollable distance — used to ignore iOS rubber-band overscroll,
    // which otherwise produces phantom direction flips and a jumpy bar.
    const maxScroll = () => {
      if (isWindow) {
        return Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight
        );
      }
      const el = targetEl as HTMLElement;
      return Math.max(0, el.scrollHeight - el.clientHeight);
    };

    // Clamp out the bounce region so overscroll past either end is ignored.
    const readTop = () => Math.min(Math.max(rawTop(), 0), maxScroll());

    lastY.current = readTop();

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = readTop();
        const diff = y - lastY.current;
        const max = maxScroll();

        // Hysteresis: hiding needs a firmer push than revealing, so small
        // jitter near the threshold can't toggle the bar back and forth.
        if (y <= topThreshold) {
          setHidden(false); // always visible near the top
          lastY.current = y;
        } else if (y >= max - 4) {
          // At the very bottom: don't flip on the rubber-band settle.
          lastY.current = y;
        } else if (diff > delta) {
          setHidden(true); // sustained scroll down → hide
          lastY.current = y;
        } else if (diff < -delta) {
          setHidden(false); // sustained scroll up → show
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
