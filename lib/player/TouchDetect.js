/** @returns {boolean} Coarse pointer + touch capability (iPad, phones). */
export function prefersTouchControls() {
  if (typeof window === "undefined") return false;
  if (navigator.maxTouchPoints <= 0) return false;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return true;
  }
}

/** @returns {boolean} iPad-ish landscape or portrait tablet width. */
export function isTabletViewport() {
  if (typeof window === "undefined") return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const min = Math.min(w, h);
  const max = Math.max(w, h);
  return min >= 600 && max >= 900;
}
