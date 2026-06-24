import * as THREE from "three";

export const CROSSHAIR_TUNING_KEY = "fps-crosshair-tuning";
export const CROSSHAIR_TUNING_VERSION_KEY = "fps-crosshair-tuning-version";

const CROSSHAIR_TUNING_VERSION = 24;

/** ADS gun reticule (WebGL, behind viewmodel). */
export const GUN_CROSSHAIR_URL = "/crosshair/gun-crosshair.png?v=2";
/** @deprecated Use {@link GUN_CROSSHAIR_URL}. */
export const RETICULE_CROSSHAIR_URL = GUN_CROSSHAIR_URL;

/**
 * @typedef {{
 *   standardWidth: number,
 *   standardHeight: number,
 *   gunHipWidth: number,
 *   gunHipHeight: number,
 *   gunHipOffsetX: number,
 *   gunHipOffsetY: number,
 *   gunHipOffsetZ: number,
 *   gunHipRotX: number,
 *   gunHipRotY: number,
 *   gunHipRotZ: number,
 *   gunAimWidth: number,
 *   gunAimHeight: number,
 *   gunAimOffsetX: number,
 *   gunAimOffsetY: number,
 *   gunAimOffsetZ: number,
 *   gunAimRotX: number,
 *   gunAimRotY: number,
 *   gunAimRotZ: number,
 * }} CrosshairTuning
 */

/** @type {CrosshairTuning} — offsets are deltas from rifle ammo-display hip/aim anchors. */
export const DEFAULT_CROSSHAIR_TUNING = {
  standardWidth: 24,
  standardHeight: 24,
  gunHipWidth: 68,
  gunHipHeight: 36,
  gunHipOffsetX: -194,
  gunHipOffsetY: 194,
  gunHipOffsetZ: -340,
  gunHipRotX: 39.5,
  gunHipRotY: 1,
  gunHipRotZ: -1,
  gunAimWidth: 680,
  gunAimHeight: 444,
  gunAimOffsetX: 1375,
  gunAimOffsetY: 171,
  gunAimOffsetZ: 1716,
  gunAimRotX: -9.5,
  gunAimRotY: 0,
  gunAimRotZ: 0,
};

/** Legacy wizard px at 1× plane — never use baked defaults as denominator. */
export const RETICLE_PLANE_LEGACY_REF = Object.freeze({
  gunHipWidth: 58,
  gunHipHeight: 37,
  gunAimWidth: 423,
  gunAimHeight: 345,
});

export const RETICLE_BASE_PLANE = Object.freeze({
  width: 0.052,
  height: 0.05,
  opacity: 0.72,
});

/** @param {CrosshairTuning} tuning @param {"hip" | "aim"} mode */
export function reticlePlaneSizeFromTuning(tuning, mode) {
  const prefix = mode === "aim" ? "gunAim" : "gunHip";
  const wKey = `${prefix}Width`;
  const hKey = `${prefix}Height`;
  const wRef = RETICLE_PLANE_LEGACY_REF[wKey];
  const hRef = RETICLE_PLANE_LEGACY_REF[hKey];
  const w = tuning[wKey] ?? DEFAULT_CROSSHAIR_TUNING[wKey];
  const h = tuning[hKey] ?? DEFAULT_CROSSHAIR_TUNING[hKey];
  return {
    planeWidth: RETICLE_BASE_PLANE.width * (w / wRef),
    planeHeight: RETICLE_BASE_PLANE.height * (h / hRef),
  };
}

const FIELDS = [
  "standardWidth",
  "standardHeight",
  "gunHipWidth",
  "gunHipHeight",
  "gunHipOffsetX",
  "gunHipOffsetY",
  "gunHipOffsetZ",
  "gunHipRotX",
  "gunHipRotY",
  "gunHipRotZ",
  "gunAimWidth",
  "gunAimHeight",
  "gunAimOffsetX",
  "gunAimOffsetY",
  "gunAimOffsetZ",
  "gunAimRotX",
  "gunAimRotY",
  "gunAimRotZ",
];

/** @param {Partial<CrosshairTuning> & Record<string, number>} [raw] */
export function normalizeCrosshairTuning(raw = {}) {
  const legacyWidth = Number.isFinite(raw.gunWidth) ? raw.gunWidth : undefined;
  const legacyHeight = Number.isFinite(raw.gunHeight) ? raw.gunHeight : undefined;
  const legacyOffsetX = Number.isFinite(raw.gunOffsetX) ? raw.gunOffsetX : undefined;
  const legacyOffsetY = Number.isFinite(raw.gunOffsetY) ? raw.gunOffsetY : undefined;
  const normalized = { ...DEFAULT_CROSSHAIR_TUNING };
  for (const field of FIELDS) {
    if (Number.isFinite(raw[field])) normalized[field] = raw[field];
  }
  if (legacyWidth !== undefined && !Number.isFinite(raw.gunAimWidth)) {
    normalized.gunAimWidth = legacyWidth;
  }
  if (legacyHeight !== undefined && !Number.isFinite(raw.gunAimHeight)) {
    normalized.gunAimHeight = legacyHeight;
  }
  if (legacyOffsetX !== undefined && !Number.isFinite(raw.gunAimOffsetX)) {
    normalized.gunAimOffsetX = legacyOffsetX;
  }
  if (legacyOffsetY !== undefined && !Number.isFinite(raw.gunAimOffsetY)) {
    normalized.gunAimOffsetY = legacyOffsetY;
  }
  return normalized;
}

export function loadCrosshairTuning() {
  if (typeof window === "undefined") return { ...DEFAULT_CROSSHAIR_TUNING };
  try {
    const version = localStorage.getItem(CROSSHAIR_TUNING_VERSION_KEY);
    if (version !== String(CROSSHAIR_TUNING_VERSION)) {
      localStorage.removeItem(CROSSHAIR_TUNING_KEY);
      localStorage.setItem(
        CROSSHAIR_TUNING_VERSION_KEY,
        String(CROSSHAIR_TUNING_VERSION),
      );
      return { ...DEFAULT_CROSSHAIR_TUNING };
    }
    return normalizeCrosshairTuning(
      JSON.parse(localStorage.getItem(CROSSHAIR_TUNING_KEY) || "null") ?? {},
    );
  } catch {
    return { ...DEFAULT_CROSSHAIR_TUNING };
  }
}

/** @param {CrosshairTuning} tuning */
export function saveCrosshairTuning(tuning) {
  if (typeof window === "undefined") return normalizeCrosshairTuning(tuning);
  const normalized = normalizeCrosshairTuning(tuning);
  try {
    localStorage.setItem(CROSSHAIR_TUNING_KEY, JSON.stringify(normalized));
    localStorage.setItem(
      CROSSHAIR_TUNING_VERSION_KEY,
      String(CROSSHAIR_TUNING_VERSION),
    );
  } catch {
    // Ignore storage-denied browser modes; live tuning still works this session.
  }
  return normalized;
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
