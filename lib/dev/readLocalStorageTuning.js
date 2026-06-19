/** Prefix for game tuning / settings keys in browser localStorage. */
export const GAME_LOCAL_STORAGE_PREFIX = "fps-";

/**
 * Parse a raw localStorage string into JSON, number, boolean, or string.
 * @param {string | null} raw
 */
export function parseLocalStorageValue(raw) {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    if (raw === "true") return true;
    if (raw === "false") return false;
    const n = Number(raw);
    if (raw !== "" && Number.isFinite(n)) return n;
    return raw;
  }
}

/**
 * Read all localStorage entries whose keys start with `fps-` (sorted).
 * @param {{ prefix?: string }} [options]
 * @returns {Record<string, unknown>}
 */
export function readGameLocalStorage(options = {}) {
  const prefix = options.prefix ?? GAME_LOCAL_STORAGE_PREFIX;
  if (typeof window === "undefined") return {};

  const out = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    out[key] = parseLocalStorageValue(window.localStorage.getItem(key));
  }

  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * Pretty JSON for clipboard / baking into `lib/*Tuning.js` defaults.
 * @param {{ prefix?: string }} [options]
 */
export function formatGameLocalStorageJson(options = {}) {
  return JSON.stringify(readGameLocalStorage(options), null, 2);
}

/**
 * Remove all localStorage entries whose keys start with `fps-`.
 * @param {{ prefix?: string }} [options]
 * @returns {number} Keys removed
 */
export function clearGameLocalStorage(options = {}) {
  const prefix = options.prefix ?? GAME_LOCAL_STORAGE_PREFIX;
  if (typeof window === "undefined") return 0;

  const keys = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) {
    window.localStorage.removeItem(key);
  }
  return keys.length;
}
