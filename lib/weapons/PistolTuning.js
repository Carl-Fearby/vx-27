import { formatPoseForCopy } from "./WeaponTuning.js";

export const PISTOL_TUNE_ENABLED_KEY = "fps-pistol-tune-enabled";
export const PISTOL_TUNING_HIP_KEY = "fps-pistol-hip";
export const PISTOL_TUNING_ADS_KEY = "fps-pistol-ads";

/** @typedef {import("./WeaponTuning.js").WeaponPose} WeaponPose */

/** Azure Pulse Pistol — starter hip carry. */
/** @type {WeaponPose} */
export const DEFAULT_PISTOL_HIP_POSE = {
  posX: -0.022,
  posY: -0.225,
  posZ: -0.473,
  rotX: 0.1114,
  rotY: -0.0516,
  rotZ: -0.0266,
  scale: 1.39,
};

/** Azure Pulse Pistol — tuned ADS. */
/** @type {WeaponPose} */
export const DEFAULT_PISTOL_ADS_POSE = {
  posX: -0.098,
  posY: -0.193,
  posZ: -0.525,
  rotX: -0.0052,
  rotY: -0.1745,
  rotZ: -0.0122,
  scale: 1.414,
};

/** Always baked defaults on reload — dev panel saves are session-only. */
export function loadPistolTuning() {
  try {
    localStorage.removeItem(PISTOL_TUNING_HIP_KEY);
    localStorage.removeItem(PISTOL_TUNING_ADS_KEY);
  } catch {
    // ignore
  }
  return { hip: { ...DEFAULT_PISTOL_HIP_POSE }, ads: { ...DEFAULT_PISTOL_ADS_POSE } };
}

/** @param {WeaponPose} hip @param {WeaponPose} ads */
export function savePistolTuning(hip, ads) {
  localStorage.setItem(PISTOL_TUNING_HIP_KEY, JSON.stringify(hip));
  localStorage.setItem(PISTOL_TUNING_ADS_KEY, JSON.stringify(ads));
}

export function loadPistolTuneEnabled() {
  return localStorage.getItem(PISTOL_TUNE_ENABLED_KEY) === "true";
}

export function savePistolTuneEnabled(enabled) {
  localStorage.setItem(PISTOL_TUNE_ENABLED_KEY, String(enabled));
}

export { formatPoseForCopy };
