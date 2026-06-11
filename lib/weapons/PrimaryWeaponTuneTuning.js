import { LASER_EMITTER_TUNE_ENABLED_KEY } from "./LaserEmitterTuning.js";
import { PISTOL_TUNE_ENABLED_KEY } from "./PistolTuning.js";
import { WEAPON_TUNE_ENABLED_KEY } from "./WeaponTuning.js";

/** Settings → Development. Gun pose + laser emitter in one wizard. */
export const PRIMARY_WEAPON_TUNE_ENABLED_KEY = "fps-primary-weapon-tune-enabled";

export function loadPrimaryWeaponTuneEnabled() {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(PRIMARY_WEAPON_TUNE_ENABLED_KEY) === "true") {
      return true;
    }
    return (
      localStorage.getItem(LASER_EMITTER_TUNE_ENABLED_KEY) === "true" ||
      localStorage.getItem(PISTOL_TUNE_ENABLED_KEY) === "true" ||
      localStorage.getItem(WEAPON_TUNE_ENABLED_KEY) === "true"
    );
  } catch {
    return false;
  }
}

/** @param {boolean} enabled */
export function savePrimaryWeaponTuneEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRIMARY_WEAPON_TUNE_ENABLED_KEY, String(enabled));
  if (!enabled) {
    localStorage.setItem(LASER_EMITTER_TUNE_ENABLED_KEY, "false");
    localStorage.setItem(PISTOL_TUNE_ENABLED_KEY, "false");
    localStorage.setItem(WEAPON_TUNE_ENABLED_KEY, "false");
  }
}
