/** True for Google Chrome (desktop, Android, iOS). Excludes Edge, Opera, Samsung, etc. */
export function isChromeBrowser(userAgent) {
  return (
    /Chrome|CriOS/.test(userAgent) &&
    !/Edg\/|EdgA\/|EdgiOS\//.test(userAgent) &&
    !/OPR\/|Opera/.test(userAgent) &&
    !/SamsungBrowser/.test(userAgent)
  );
}

/** @returns {boolean | null} null during SSR before client detection */
export function detectChromeBrowser() {
  if (typeof navigator === "undefined") return null;
  return isChromeBrowser(navigator.userAgent);
}
