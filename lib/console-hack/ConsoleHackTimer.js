/** Default hack countdown shown as MM:SS:CS (centiseconds). */
export const HACK_TIMER_DEFAULT = "01:48:72";

/**
 * @param {string} text MM:SS:CS
 * @returns {number} milliseconds
 */
export function parseHackTimer(text) {
  const parts = String(text).trim().split(":");
  if (parts.length !== 3) return 0;
  const minutes = Number(parts[0]) || 0;
  const seconds = Number(parts[1]) || 0;
  const centiseconds = Number(parts[2]) || 0;
  return minutes * 60_000 + seconds * 1_000 + centiseconds * 10;
}

/**
 * @param {number} remainingMs
 * @returns {string} MM:SS:CS
 */
export function formatHackTimer(remainingMs) {
  const clamped = Math.max(0, Math.floor(remainingMs));
  const minutes = Math.floor(clamped / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1_000);
  const centiseconds = Math.floor((clamped % 1_000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(centiseconds).padStart(2, "0")}`;
}

/** @param {number} remainingMs @param {number} totalMs */
export function hackTimerProgressPct(remainingMs, totalMs) {
  if (totalMs <= 0) return 0;
  const elapsed = totalMs - Math.max(0, remainingMs);
  return Math.min(100, Math.max(0, Math.round((elapsed / totalMs) * 100)));
}
