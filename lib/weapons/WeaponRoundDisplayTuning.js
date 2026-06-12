import * as THREE from "three";

export const WEAPON_ROUND_DISPLAY_TUNE_ENABLED_KEY =
  "fps-weapon-round-display-tune-enabled";
export const WEAPON_ROUND_DISPLAY_HIP_KEY = "fps-weapon-round-display-hip";
export const WEAPON_ROUND_DISPLAY_AIM_KEY = "fps-weapon-round-display-aim";
export const PISTOL_ROUND_DISPLAY_TUNE_ENABLED_KEY =
  "fps-pistol-round-display-tune-enabled";
export const PISTOL_ROUND_DISPLAY_HIP_KEY = "fps-pistol-round-display-hip";
export const PISTOL_ROUND_DISPLAY_AIM_KEY = "fps-pistol-round-display-aim";
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
  planeHeight: 0.1,
  fontSize: 30,
};

/** @type {WeaponRoundDisplayPose} */
export const DEFAULT_AIM_ROUND_DISPLAY = {
  posX: -1.164,
  posY: 0.375,
  posZ: -2,
  rotX: 0.1524,
  rotY: 0.6274,
  rotZ: -0.0446,
  scale: 3.343,
  planeWidth: 0.078,
  planeHeight: 0.077,
  fontSize: 32,
};

/** Azure Pulse Pistol — hip screen on slide (model-local, after fit). */
/** @type {WeaponRoundDisplayPose} */
export const DEFAULT_PISTOL_HIP_ROUND_DISPLAY = {
  posX: 0.342,
  posY: 0.41,
  posZ: 0.146,
  rotX: -0.7226,
  rotY: 0.1604,
  rotZ: 0.0404,
  scale: 0.54,
  planeWidth: 0.087,
  planeHeight: 0.1,
  fontSize: 88,
};

/** @type {WeaponRoundDisplayPose} */
export const DEFAULT_PISTOL_AIM_ROUND_DISPLAY = {
  posX: 0.329,
  posY: 0.419,
  posZ: 0.165,
  rotX: -0.7806,
  rotY: 0.1354,
  rotZ: 0.0264,
  scale: 0.495,
  planeWidth: 0.089,
  planeHeight: 0.118,
  fontSize: 88,
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
/** @returns {{ hip: WeaponRoundDisplayPose, aim: WeaponRoundDisplayPose }} */
export function getWeaponRoundDisplayTuning() {
  return {
    hip: { ...DEFAULT_HIP_ROUND_DISPLAY },
    aim: { ...DEFAULT_AIM_ROUND_DISPLAY },
  };
}

/** Clears wizard session keys, then returns baked defaults. */
export function loadWeaponRoundDisplayTuning() {
  try {
    localStorage.removeItem(WEAPON_ROUND_DISPLAY_HIP_KEY);
    localStorage.removeItem(WEAPON_ROUND_DISPLAY_AIM_KEY);
    localStorage.removeItem(WEAPON_ROUND_DISPLAY_VERSION_KEY);
    localStorage.removeItem(WEAPON_ROUND_DISPLAY_TUNING_KEY);
  } catch {
    // ignore
  }
  return getWeaponRoundDisplayTuning();
}

/** @returns {{ hip: WeaponRoundDisplayPose, aim: WeaponRoundDisplayPose }} */
export function getPistolRoundDisplayTuning() {
  return {
    hip: { ...DEFAULT_PISTOL_HIP_ROUND_DISPLAY },
    aim: { ...DEFAULT_PISTOL_AIM_ROUND_DISPLAY },
  };
}

/** Clears wizard session keys, then returns baked defaults. */
export function loadPistolRoundDisplayTuning() {
  try {
    localStorage.removeItem(PISTOL_ROUND_DISPLAY_HIP_KEY);
    localStorage.removeItem(PISTOL_ROUND_DISPLAY_AIM_KEY);
  } catch {
    // ignore
  }
  return getPistolRoundDisplayTuning();
}

/** @param {"rifle" | "pistol"} weaponId */
export function loadRoundDisplayTuningForWeapon(weaponId) {
  return weaponId === "pistol"
    ? loadPistolRoundDisplayTuning()
    : loadWeaponRoundDisplayTuning();
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

/** @param {WeaponRoundDisplayPose} hip @param {WeaponRoundDisplayPose} aim */
export function savePistolRoundDisplayTuning(hip, aim) {
  localStorage.setItem(PISTOL_ROUND_DISPLAY_HIP_KEY, JSON.stringify(hip));
  localStorage.setItem(PISTOL_ROUND_DISPLAY_AIM_KEY, JSON.stringify(aim));
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

/** Hip or aim only — no in-between (rifle reticule alignment). */
export function resolveSnappedRoundDisplayPose(hip, aim, aimBlend) {
  return aimBlend >= 0.5 ? { ...aim } : { ...hip };
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

export function loadPistolRoundDisplayTuneEnabled() {
  return (
    localStorage.getItem(PISTOL_ROUND_DISPLAY_TUNE_ENABLED_KEY) === "true"
  );
}

export function savePistolRoundDisplayTuneEnabled(enabled) {
  localStorage.setItem(
    PISTOL_ROUND_DISPLAY_TUNE_ENABLED_KEY,
    String(enabled),
  );
}
