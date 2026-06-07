import * as THREE from "three";

export const WEAPON_ROUND_DISPLAY_TUNE_ENABLED_KEY =
  "fps-weapon-round-display-tune-enabled";
export const WEAPON_ROUND_DISPLAY_HIP_KEY = "fps-weapon-round-display-hip";
export const WEAPON_ROUND_DISPLAY_AIM_KEY = "fps-weapon-round-display-aim";
/** @deprecated Legacy single-pose key — ignored after v9. */
export const WEAPON_ROUND_DISPLAY_TUNING_KEY = "fps-weapon-round-display";
export const WEAPON_ROUND_DISPLAY_VERSION_KEY =
  "fps-weapon-round-display-version";

const DISPLAY_VERSION = 13;

/**
 * Local pose on the rifle mesh (after fitRifleModel — barrel +X, stock −X).
 * @typedef {{
 *   posX: number,
 *   posY: number,
 *   posZ: number,
 *   rotX: number,
 *   rotY: number,
 *   rotZ: number,
 *   scale: number,
 *   planeWidth: number,
 *   planeHeight: number,
 *   fontSize: number,
 * }} WeaponRoundDisplayPose
 */

/** @type {WeaponRoundDisplayPose} */
export const DEFAULT_HIP_ROUND_DISPLAY = {
  posX: 0.465,
  posY: 0.364,
  posZ: 0.181,
  rotX: -0.8356,
  rotY: 0.5274,
  rotZ: -0.0156,
  scale: 2.634,
  planeWidth: 0.087,
  planeHeight: 0.053,
  fontSize: 30,
};

/** @type {WeaponRoundDisplayPose} */
export const DEFAULT_AIM_ROUND_DISPLAY = {
  posX: 0.464,
  posY: 0.359,
  posZ: 0.181,
  rotX: -0.7226,
  rotY: 0.3804,
  rotZ: -0.0016,
  scale: 0.893,
  planeWidth: 0.087,
  planeHeight: 0.053,
  fontSize: 128,
};

/** @deprecated Use {@link DEFAULT_HIP_ROUND_DISPLAY}. */
export const DEFAULT_WEAPON_ROUND_DISPLAY = DEFAULT_HIP_ROUND_DISPLAY;

const POSE_FIELDS = [
  "posX",
  "posY",
  "posZ",
  "rotX",
  "rotY",
  "rotZ",
  "scale",
  "planeWidth",
  "planeHeight",
  "fontSize",
];

const TRANSFORM_FIELDS = ["posX", "posY", "posZ", "rotX", "rotY", "rotZ"];
/** Always baked defaults on reload — dev panel saves are session-only. */
export function loadWeaponRoundDisplayTuning() {
  try {
    localStorage.removeItem(WEAPON_ROUND_DISPLAY_HIP_KEY);
    localStorage.removeItem(WEAPON_ROUND_DISPLAY_AIM_KEY);
    localStorage.removeItem(WEAPON_ROUND_DISPLAY_VERSION_KEY);
    localStorage.removeItem(WEAPON_ROUND_DISPLAY_TUNING_KEY);
  } catch {
    // ignore
  }
  return {
    hip: { ...DEFAULT_HIP_ROUND_DISPLAY },
    aim: { ...DEFAULT_AIM_ROUND_DISPLAY },
  };
}

/** @param {WeaponRoundDisplayPose} hip @param {WeaponRoundDisplayPose} aim */
export function saveWeaponRoundDisplayTuning(hip, aim) {
  localStorage.setItem(WEAPON_ROUND_DISPLAY_HIP_KEY, JSON.stringify(hip));
  localStorage.setItem(WEAPON_ROUND_DISPLAY_AIM_KEY, JSON.stringify(aim));
  localStorage.setItem(
    WEAPON_ROUND_DISPLAY_VERSION_KEY,
    String(DISPLAY_VERSION),
  );
}

/**
 * Blend all round-display fields with the weapon ADS aimBlend (same rate as pose/FOV).
 * @param {WeaponRoundDisplayPose} hip
 * @param {WeaponRoundDisplayPose} aim
 * @param {number} aimBlend 0 hip → 1 ADS
 * @returns {WeaponRoundDisplayPose}
 */
export function resolveRoundDisplayPose(hip, aim, aimBlend) {
  const t = THREE.MathUtils.clamp(aimBlend, 0, 1);
  if (t <= 0) return { ...hip };
  if (t >= 1) return { ...aim };
  /** @type {WeaponRoundDisplayPose} */
  const out = { ...hip };
  for (const field of POSE_FIELDS) {
    out[field] = THREE.MathUtils.lerp(hip[field], aim[field], t);
  }
  out.fontSize = Math.round(out.fontSize);
  return out;
}

/** @deprecated Use {@link resolveRoundDisplayPose}. */
export function blendRoundDisplayPose(hip, aim, aimBlend) {
  return resolveRoundDisplayPose(hip, aim, aimBlend);
}

/** @param {WeaponRoundDisplayPose} tuning */
export function formatRoundDisplayForCopy(tuning) {
  const rounded = {};
  for (const field of POSE_FIELDS) {
    rounded[field] = Math.round(tuning[field] * 10000) / 10000;
  }
  return JSON.stringify(rounded, null, 2);
}

export function loadWeaponRoundDisplayTuneEnabled() {
  return (
    localStorage.getItem(WEAPON_ROUND_DISPLAY_TUNE_ENABLED_KEY) === "true"
  );
}

export function saveWeaponRoundDisplayTuneEnabled(enabled) {
  localStorage.setItem(
    WEAPON_ROUND_DISPLAY_TUNE_ENABLED_KEY,
    String(enabled),
  );
}
