/** True when running the game on a local dev machine (not production deploy). */
export function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.startsWith("192.168.") ||
    h.endsWith(".local")
  );
}

/**
 * Read a tuning-panel toggle. Defaults to OFF until enabled in Settings.
 * @param {string} storageKey
 */
export function resolveDevTuneEnabled(storageKey) {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) return stored === "true";
  } catch {
    /* ignore */
  }
  return false;
}

/** One-time boot flag — v4 resets panels closed (v3 auto-enabled them on localhost). */
export const DEV_TUNE_BOOT_KEY = "fps-tune-boot-v4";
