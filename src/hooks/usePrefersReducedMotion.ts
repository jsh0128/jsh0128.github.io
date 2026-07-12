import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Track the user agent's reduced-motion preference (REQ-SL3-020). When true,
 * callers suppress non-essential motion (decorative loops, parallax, the 3D
 * hero, text animations) and present static fallbacks / static text end-states.
 * Updates live if the preference toggles.
 *
 * Copied (not imported) from `/landing` per plan DP6/D9: a pure, visual-neutral
 * leaf helper duplicated into landing3 so `/landing` carries zero regression
 * risk (REQ-SL3-004 / AC-23).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent): void => setReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
