import * as THREE from "three";

export const CROSSHAIR_TUNING_KEY = "fps-crosshair-tuning";
export const CROSSHAIR_TUNING_VERSION_KEY = "fps-crosshair-tuning-version";

const CROSSHAIR_TUNING_VERSION = 7;

/** ADS gun reticule (WebGL, behind viewmodel). */
export const GUN_CROSSHAIR_URL = "/crosshair/gun-crosshair.png?v=2";
/** @deprecated Use {@link GUN_CROSSHAIR_URL}. */
export const RETICULE_CROSSHAIR_URL = GUN_CROSSHAIR_URL;

/**
 * @typedef {{
 *   standardWidth: number,
 *   standardHeight: number,
 *   gunWidth: number,
 *   gunHeight: number,
 *   gunOffsetX: number,
 *   gunOffsetY: number,
 * }} CrosshairTuning
 */

/** @type {CrosshairTuning} */
export const DEFAULT_CROSSHAIR_TUNING = {
  standardWidth: 24,
  standardHeight: 24,
  gunWidth: 423,
  gunHeight: 345,
  gunOffsetX: 0,
  gunOffsetY: 0,
};

const FIELDS = [
  "standardWidth",
  "standardHeight",
  "gunWidth",
  "gunHeight",
  "gunOffsetX",
  "gunOffsetY",
];

/** Always baked defaults on reload — dev panel saves are session-only. */
export function loadCrosshairTuning() {
  try {
    localStorage.removeItem(CROSSHAIR_TUNING_KEY);
    localStorage.removeItem(CROSSHAIR_TUNING_VERSION_KEY);
  } catch {
    // ignore
  }
  return { ...DEFAULT_CROSSHAIR_TUNING };
}

/** @param {CrosshairTuning} tuning */
export function saveCrosshairTuning(tuning) {
  localStorage.setItem(CROSSHAIR_TUNING_KEY, JSON.stringify(tuning));
  localStorage.setItem(
    CROSSHAIR_TUNING_VERSION_KEY,
    String(CROSSHAIR_TUNING_VERSION),
  );
}

/** @param {CrosshairTuning} tuning */
export function formatCrosshairTuningForCopy(tuning) {
  const rounded = {};
  for (const field of FIELDS) {
    rounded[field] = Math.round(tuning[field] * 100) / 100;
  }
  return JSON.stringify(rounded, null, 2);
}

/**
 * Hip — simple white CSS cross. Rifle ADS fades this out when the gun reticule takes over.
 * Pistol ADS keeps the same cross (aim still zooms pose/FOV separately).
 * @param {HTMLElement} el
 * @param {number} aimBlend 0 hip → 1 ADS
 * @param {CrosshairTuning} tuning
 * @param {{ standardCrosshairOnly?: boolean }} [options]
 */
export function applyStandardCrosshairToElement(el, aimBlend, tuning, options = {}) {
  const t = THREE.MathUtils.clamp(aimBlend, 0, 1);
  const opacity = options.standardCrosshairOnly
    ? 1
    : THREE.MathUtils.clamp(1 - t / 0.48, 0, 1);
  if (opacity < 0.01) {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  el.style.opacity = String(opacity);

  const width = tuning.standardWidth;
  const height = tuning.standardHeight;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.marginLeft = `${-width / 2}px`;
  el.style.marginTop = `${-height / 2}px`;
  el.style.backgroundImage = "none";
}
