import * as THREE from "three";

export const RECOIL_TUNING_KEY = "fps-recoil-tuning";
export const RECOIL_TUNING_VERSION = 4;

/**
 * @typedef {{
 *   aimRecoilPitch: number,
 *   aimRecoilYaw: number,
 *   springStiffness: number,
 *   springDamping: number,
 *   kickVelScale: number,
 *   fireRecoilBack: number,
 *   fireRecoilStiffness: number,
 *   fireRecoilDamping: number,
 *   fireRecoilKickVelScale: number,
 *   fireRecoilPitch: number,
 *   fireRecoilPitchVelScale: number,
 * }} RecoilTuning
 */

/** @type {RecoilTuning} */
export const DEFAULT_RECOIL_TUNING = {
  aimRecoilPitch: 0.032,
  aimRecoilYaw: 0.001,
  springStiffness: 260,
  springDamping: 14,
  kickVelScale: 10,
  fireRecoilBack: 0.07,
  fireRecoilStiffness: 445,
  fireRecoilDamping: 20.5,
  fireRecoilKickVelScale: 9.7,
  fireRecoilPitch: -0.09,
  fireRecoilPitchVelScale: 9.2,
};

export const RECOIL_TUNING_LIMITS = {
  aimRecoilPitch: { min: 0.004, max: 0.04, step: 0.001, nudge: 0.001, decimals: 3 },
  aimRecoilYaw: { min: 0.001, max: 0.015, step: 0.001, nudge: 0.001, decimals: 3 },
  springStiffness: { min: 80, max: 500, step: 5, nudge: 10, decimals: 0 },
  springDamping: { min: 5, max: 40, step: 0.5, nudge: 1, decimals: 1 },
  kickVelScale: { min: 1, max: 10, step: 0.1, nudge: 0.25, decimals: 1 },
  fireRecoilBack: { min: 0.01, max: 0.08, step: 0.001, nudge: 0.002, decimals: 3 },
  fireRecoilStiffness: { min: 80, max: 500, step: 5, nudge: 10, decimals: 0 },
  fireRecoilDamping: { min: 5, max: 40, step: 0.5, nudge: 1, decimals: 1 },
  fireRecoilKickVelScale: { min: 1, max: 12, step: 0.1, nudge: 0.25, decimals: 1 },
  fireRecoilPitch: { min: -0.2, max: 0, step: 0.005, nudge: 0.01, decimals: 3 },
  fireRecoilPitchVelScale: { min: 1, max: 12, step: 0.1, nudge: 0.25, decimals: 1 },
};

function clampField(value, key) {
  const d = DEFAULT_RECOIL_TUNING[key];
  const lim = RECOIL_TUNING_LIMITS[key];
  const n = Number(value);
  if (!Number.isFinite(n)) return d;
  return THREE.MathUtils.clamp(n, lim.min, lim.max);
}

/** @param {Partial<RecoilTuning>} [patch] @returns {RecoilTuning} */
export function normalizeRecoilTuning(patch = {}) {
  /** @type {RecoilTuning} */
  const out = { ...DEFAULT_RECOIL_TUNING };
  for (const key of Object.keys(DEFAULT_RECOIL_TUNING)) {
    out[key] = clampField(patch[key], key);
  }
  return out;
}

/** @returns {RecoilTuning} */
export function loadRecoilTuning() {
  if (typeof window === "undefined") return { ...DEFAULT_RECOIL_TUNING };
  try {
    const raw = localStorage.getItem(RECOIL_TUNING_KEY);
    if (!raw) return { ...DEFAULT_RECOIL_TUNING };
    const parsed = JSON.parse(raw);
    const storedVersion =
      typeof parsed.version === "number" ? parsed.version : 0;
    if (storedVersion < RECOIL_TUNING_VERSION) {
      saveRecoilTuning(DEFAULT_RECOIL_TUNING);
      return { ...DEFAULT_RECOIL_TUNING };
    }
    return normalizeRecoilTuning(parsed);
  } catch {
    return { ...DEFAULT_RECOIL_TUNING };
  }
}

/** @param {RecoilTuning} tuning */
export function saveRecoilTuning(tuning) {
  if (typeof window === "undefined") return;
  const normalized = normalizeRecoilTuning(tuning);
  localStorage.setItem(
    RECOIL_TUNING_KEY,
    JSON.stringify({ ...normalized, version: RECOIL_TUNING_VERSION }),
  );
}


/** @param {RecoilTuning} tuning */
export function formatRecoilTuningForCopy(tuning) {
  return JSON.stringify(normalizeRecoilTuning(tuning), null, 2);
}
