export const RAIN_ENABLED_KEY = "fps-rain-enabled";
export const RAIN_INTENSITY_KEY = "fps-rain-intensity";

/** Slider runs 5%–500% (0.05–5.0). */
export const MIN_RAIN_INTENSITY = 0.05;
export const MAX_RAIN_INTENSITY = 5;
export const DEFAULT_RAIN_INTENSITY = 1.25;

/** @returns {boolean} */
export function loadRainEnabled() {
  try {
    return localStorage.getItem(RAIN_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

/** @param {boolean} enabled */
export function saveRainEnabled(enabled) {
  try {
    localStorage.setItem(RAIN_ENABLED_KEY, String(enabled));
  } catch {
    /* ignore */
  }
}

/** @returns {number} */
export function loadRainIntensity() {
  try {
    const raw = localStorage.getItem(RAIN_INTENSITY_KEY);
    const value = raw == null ? DEFAULT_RAIN_INTENSITY : parseFloat(raw);
    if (!Number.isFinite(value)) return DEFAULT_RAIN_INTENSITY;
    return Math.min(MAX_RAIN_INTENSITY, Math.max(MIN_RAIN_INTENSITY, value));
  } catch {
    return DEFAULT_RAIN_INTENSITY;
  }
}

/** @param {number} intensity */
export function saveRainIntensity(intensity) {
  try {
    const clamped = Math.min(
      MAX_RAIN_INTENSITY,
      Math.max(MIN_RAIN_INTENSITY, intensity)
    );
    localStorage.setItem(RAIN_INTENSITY_KEY, String(clamped));
  } catch {
    /* ignore */
  }
}
