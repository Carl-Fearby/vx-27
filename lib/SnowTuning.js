export const SNOW_ENABLED_KEY = "fps-snow-enabled";
export const SNOW_INTENSITY_KEY = "fps-snow-intensity";
export const SNOW_STICK_RATE_KEY = "fps-snow-stick-rate";
/** @deprecated Migrated to {@link SNOW_INTENSITY_KEY} */
const SNOW_SHOW_RATE_KEY = "fps-snow-show-rate";

/** Slider runs 5%–500% (0.05–5.0). */
export const MIN_SNOW_INTENSITY = 0.05;
export const MAX_SNOW_INTENSITY = 5;
export const DEFAULT_SNOW_INTENSITY = 2.05;

export const MIN_SNOW_STICK_RATE = 0.05;
export const MAX_SNOW_STICK_RATE = 5;
export const DEFAULT_SNOW_STICK_RATE = 2.75;

/** @returns {boolean} */
export function loadSnowEnabled() {
  try {
    return localStorage.getItem(SNOW_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

/** @param {boolean} enabled */
export function saveSnowEnabled(enabled) {
  try {
    localStorage.setItem(SNOW_ENABLED_KEY, String(enabled));
  } catch {
    /* ignore */
  }
}

/** @returns {number} */
export function loadSnowIntensity() {
  try {
    let raw = localStorage.getItem(SNOW_INTENSITY_KEY);
    if (raw == null) raw = localStorage.getItem(SNOW_SHOW_RATE_KEY);
    const value = raw == null ? DEFAULT_SNOW_INTENSITY : parseFloat(raw);
    if (!Number.isFinite(value)) return DEFAULT_SNOW_INTENSITY;
    return Math.min(MAX_SNOW_INTENSITY, Math.max(MIN_SNOW_INTENSITY, value));
  } catch {
    return DEFAULT_SNOW_INTENSITY;
  }
}

/** @param {number} intensity */
export function saveSnowIntensity(intensity) {
  try {
    const clamped = Math.min(
      MAX_SNOW_INTENSITY,
      Math.max(MIN_SNOW_INTENSITY, intensity)
    );
    localStorage.setItem(SNOW_INTENSITY_KEY, String(clamped));
  } catch {
    /* ignore */
  }
}

/** @returns {number} */
export function loadSnowStickRate() {
  try {
    const raw = localStorage.getItem(SNOW_STICK_RATE_KEY);
    const value = raw == null ? DEFAULT_SNOW_STICK_RATE : parseFloat(raw);
    if (!Number.isFinite(value)) return DEFAULT_SNOW_STICK_RATE;
    return Math.min(MAX_SNOW_STICK_RATE, Math.max(MIN_SNOW_STICK_RATE, value));
  } catch {
    return DEFAULT_SNOW_STICK_RATE;
  }
}

/** @param {number} rate */
export function saveSnowStickRate(rate) {
  try {
    const clamped = Math.min(
      MAX_SNOW_STICK_RATE,
      Math.max(MIN_SNOW_STICK_RATE, rate)
    );
    localStorage.setItem(SNOW_STICK_RATE_KEY, String(clamped));
  } catch {
    /* ignore */
  }
}
