export const WEAPON_TUNE_ENABLED_KEY = "fps-weapon-tune-enabled";

export const WEAPON_TUNING_HIP_KEY = "fps-weapon-hip";
export const WEAPON_TUNING_ADS_KEY = "fps-weapon-ads";
export const WEAPON_TUNING_VERSION_KEY = "fps-weapon-tuning-version";
export const BODY_LOOK_UP_AMOUNT_KEY = "fps-body-look-up-amount";
export const BODY_LOOK_DOWN_AMOUNT_KEY = "fps-body-look-down-amount";
export const LOOK_MAX_RATE_KEY = "fps-look-max-rate";
export const LOOK_TUNING_VERSION_KEY = "fps-look-tuning-version";
export const DEFAULT_BODY_LOOK_UP_AMOUNT = 1.35;
export const DEFAULT_BODY_LOOK_DOWN_AMOUNT = 1.35;
export const DEFAULT_MAX_LOOK_RATE = 10;
const WEAPON_TUNING_VERSION = 13;
const LOOK_TUNING_VERSION = 1;

/** @typedef {{ posX: number, posY: number, posZ: number, rotX: number, rotY: number, rotZ: number, scale: number }} WeaponPose */

/** Aurora Pulse Rifle — tuned hip carry (2026-06-06). */
/** @type {WeaponPose} */
export const DEFAULT_HIP_POSE = {
  posX: 0.169,
  posY: -0.581,
  posZ: -1.329,
  rotX: 0.1864,
  rotY: -0.2436,
  rotZ: -0.0526,
  scale: 1.858,
};

/** Aurora Pulse Rifle — tuned ADS (2026-06-06). */
/** @type {WeaponPose} */
export const DEFAULT_ADS_POSE = {
  posX: -0.163,
  posY: -0.304,
  posZ: -0.155,
  rotX: 0.0017,
  rotY: -0.5288,
  rotZ: 0.0489,
  scale: 1.583,
};

const POSE_FIELDS = ["posX", "posY", "posZ", "rotX", "rotY", "rotZ", "scale"];

/** Always baked defaults on reload — dev panel saves are session-only. */
export function loadWeaponTuning() {
  try {
    localStorage.removeItem(WEAPON_TUNING_HIP_KEY);
    localStorage.removeItem(WEAPON_TUNING_ADS_KEY);
    localStorage.removeItem(WEAPON_TUNING_VERSION_KEY);
  } catch {
    // ignore
  }
  return { hip: { ...DEFAULT_HIP_POSE }, ads: { ...DEFAULT_ADS_POSE } };
}

/** @param {WeaponPose} hip @param {WeaponPose} ads */
export function saveWeaponTuning(hip, ads) {
  localStorage.setItem(WEAPON_TUNING_HIP_KEY, JSON.stringify(hip));
  localStorage.setItem(WEAPON_TUNING_ADS_KEY, JSON.stringify(ads));
  localStorage.setItem(WEAPON_TUNING_VERSION_KEY, String(WEAPON_TUNING_VERSION));
}

/** @param {WeaponPose} pose */
export function formatPoseForCopy(pose) {
  const rounded = {};
  for (const field of POSE_FIELDS) {
    rounded[field] = Math.round(pose[field] * 10000) / 10000;
  }
  return JSON.stringify(rounded, null, 2);
}

/** @param {{ maxLookRate: number, bodyLookUpAmount: number, bodyLookDownAmount: number }} look */
export function formatLookTuningForCopy(look) {
  return JSON.stringify(
    {
      maxLookRate: Math.round(look.maxLookRate * 10000) / 10000,
      bodyLookUpAmount:
        Math.round(look.bodyLookUpAmount * 10000) / 10000,
      bodyLookDownAmount:
        Math.round(look.bodyLookDownAmount * 10000) / 10000,
    },
    null,
    2,
  );
}

export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function loadBodyLookAmount(key, fallback) {
  try {
    const v = parseFloat(localStorage.getItem(key));
    if (typeof v === "number" && !Number.isNaN(v)) return v;
  } catch {
    // ignore
  }
  return fallback;
}

export function loadWeaponTuneEnabled() {
  return localStorage.getItem(WEAPON_TUNE_ENABLED_KEY) === "true";
}

export function saveWeaponTuneEnabled(enabled) {
  localStorage.setItem(WEAPON_TUNE_ENABLED_KEY, String(enabled));
}

export function loadBodyLookUpAmount() {
  return loadBodyLookAmount(
    BODY_LOOK_UP_AMOUNT_KEY,
    DEFAULT_BODY_LOOK_UP_AMOUNT
  );
}

export function loadBodyLookDownAmount() {
  return loadBodyLookAmount(
    BODY_LOOK_DOWN_AMOUNT_KEY,
    DEFAULT_BODY_LOOK_DOWN_AMOUNT
  );
}

export function saveBodyLookUpAmount(amount) {
  localStorage.setItem(BODY_LOOK_UP_AMOUNT_KEY, String(amount));
}

export function saveBodyLookDownAmount(amount) {
  localStorage.setItem(BODY_LOOK_DOWN_AMOUNT_KEY, String(amount));
}

/** Always baked defaults on reload — dev panel saves are session-only. */
export function loadLookTuning() {
  try {
    localStorage.removeItem(LOOK_MAX_RATE_KEY);
    localStorage.removeItem(LOOK_TUNING_VERSION_KEY);
    localStorage.removeItem(BODY_LOOK_UP_AMOUNT_KEY);
    localStorage.removeItem(BODY_LOOK_DOWN_AMOUNT_KEY);
  } catch {
    // ignore
  }
  return {
    maxLookRate: DEFAULT_MAX_LOOK_RATE,
    bodyLookUpAmount: DEFAULT_BODY_LOOK_UP_AMOUNT,
    bodyLookDownAmount: DEFAULT_BODY_LOOK_DOWN_AMOUNT,
  };
}
