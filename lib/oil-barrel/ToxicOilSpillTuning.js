export const TOXIC_OIL_SPILL_TUNING_KEY = "fps-toxic-oil-spill-tuning";
export const TOXIC_OIL_SPILL_TUNE_ENABLED_KEY = "fps-toxic-oil-spill-tune-enabled";

/**
 * @typedef {{
 *   x: number,
 *   z: number,
 *   rotationY: number,
 *   scaleX: number,
 *   scaleZ: number,
 *   yOffset: number,
 *   emissiveIntensity: number,
 *   opacity: number,
 * }} ToxicOilSpillTuning
 */

/** @type {ToxicOilSpillTuning} */
export const DEFAULT_TOXIC_OIL_SPILL_TUNING = {
  x: -5.69,
  z: 5.65,
  rotationY: -1.4,
  scaleX: 4.88,
  scaleZ: 5.92,
  yOffset: 0.004,
  emissiveIntensity: 3.65,
  opacity: 0.68,
};

export const TOXIC_OIL_SPILL_TUNING_LIMITS = {
  x: { min: -14, max: 14, step: 0.01, nudge: 0.05 },
  z: { min: -14, max: 14, step: 0.01, nudge: 0.05 },
  rotationY: { min: -3.14, max: 3.14, step: 0.01, nudge: 0.05 },
  scaleX: { min: 0.35, max: 8, step: 0.01, nudge: 0.05 },
  scaleZ: { min: 0.35, max: 8, step: 0.01, nudge: 0.05 },
  yOffset: { min: 0, max: 0.02, step: 0.0005, nudge: 0.001 },
  emissiveIntensity: { min: 0, max: 6, step: 0.05, nudge: 0.1 },
  opacity: { min: 0.15, max: 1, step: 0.01, nudge: 0.05 },
};

/** @param {Partial<ToxicOilSpillTuning>} [patch] @returns {ToxicOilSpillTuning} */
export function normalizeToxicOilSpillTuning(patch) {
  const d = DEFAULT_TOXIC_OIL_SPILL_TUNING;
  const p = patch ?? {};
  const lim = TOXIC_OIL_SPILL_TUNING_LIMITS;
  const clamp = (value, key) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return d[key];
    return Math.min(lim[key].max, Math.max(lim[key].min, n));
  };
  return {
    x: clamp(p.x, "x"),
    z: clamp(p.z, "z"),
    rotationY: clamp(p.rotationY, "rotationY"),
    scaleX: clamp(p.scaleX, "scaleX"),
    scaleZ: clamp(p.scaleZ, "scaleZ"),
    yOffset: clamp(p.yOffset, "yOffset"),
    emissiveIntensity: clamp(p.emissiveIntensity, "emissiveIntensity"),
    opacity: clamp(p.opacity, "opacity"),
  };
}

/** @returns {ToxicOilSpillTuning} */
export function loadToxicOilSpillTuning() {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_TOXIC_OIL_SPILL_TUNING };
  }
  try {
    const raw = localStorage.getItem(TOXIC_OIL_SPILL_TUNING_KEY);
    if (!raw) return { ...DEFAULT_TOXIC_OIL_SPILL_TUNING };
    return normalizeToxicOilSpillTuning(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_TOXIC_OIL_SPILL_TUNING };
  }
}

/** @param {ToxicOilSpillTuning} tuning */
export function saveToxicOilSpillTuning(tuning) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    TOXIC_OIL_SPILL_TUNING_KEY,
    JSON.stringify(normalizeToxicOilSpillTuning(tuning)),
  );
}

/** @returns {boolean} */
export function loadToxicOilSpillTuneEnabled() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(TOXIC_OIL_SPILL_TUNE_ENABLED_KEY) === "true";
}

/** @param {boolean} enabled */
export function saveToxicOilSpillTuneEnabled(enabled) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TOXIC_OIL_SPILL_TUNE_ENABLED_KEY, String(enabled));
}

/** @param {ToxicOilSpillTuning} tuning */
export function formatToxicOilSpillTuningJson(tuning) {
  const t = normalizeToxicOilSpillTuning(tuning);
  return JSON.stringify(
    {
      toxic_oil_spill: {
        x: +t.x.toFixed(3),
        z: +t.z.toFixed(3),
        rotationY: +t.rotationY.toFixed(4),
        scaleX: +t.scaleX.toFixed(3),
        scaleZ: +t.scaleZ.toFixed(3),
        yOffset: +t.yOffset.toFixed(4),
        emissiveIntensity: +t.emissiveIntensity.toFixed(2),
        opacity: +t.opacity.toFixed(2),
      },
    },
    null,
    2,
  );
}
