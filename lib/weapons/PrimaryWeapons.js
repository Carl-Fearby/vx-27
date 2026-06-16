import { RIFLE_MODEL_URL } from "./ViewWeapon.js";

export const PISTOL_MODEL_URL = "/models/azure_pulse_pistol.glb?v=0606224725";

/** @typedef {'rifle' | 'pistol'} PrimaryWeaponId */

/**
 * @typedef {{
 *   id: PrimaryWeaponId,
 *   label: string,
 *   modelUrl: string,
 *   magazineSize: number,
 *   spareMagazines: number,
 *   lowAmmoThreshold: number,
 *   fireModes: ('auto' | 'burst' | 'single')[],
 *   viewOptions: {
 *     fitProfile: 'rifle' | 'pistol',
 *     roundDisplay: boolean,
 *     roundDisplaySnapAim?: boolean,
 *     flashlight: boolean,
 *     gunReticule: boolean,
 *     standardCrosshairOnly: boolean,
 *   },
 * }} PrimaryWeaponConfig
 */

/** @type {Record<PrimaryWeaponId, PrimaryWeaponConfig>} */
export const PRIMARY_WEAPONS = {
  rifle: {
    id: "rifle",
    label: "RIFLE",
    modelUrl: RIFLE_MODEL_URL,
    magazineSize: 80,
    spareMagazines: 2,
    lowAmmoThreshold: 15,
    fireModes: ["auto", "burst", "single"],
    viewOptions: {
      fitProfile: "rifle",
      roundDisplay: true,
      roundDisplaySnapAim: true,
      flashlight: true,
      gunReticule: true,
      standardCrosshairOnly: false,
    },
  },
  pistol: {
    id: "pistol",
    label: "PISTOL",
    modelUrl: PISTOL_MODEL_URL,
    magazineSize: 12,
    spareMagazines: 2,
    lowAmmoThreshold: 4,
    fireModes: ["single"],
    viewOptions: {
      fitProfile: "pistol",
      roundDisplay: true,
      roundDisplaySnapAim: true,
      flashlight: true,
      gunReticule: false,
      standardCrosshairOnly: true,
    },
  },
};

/** @param {PrimaryWeaponId} id */
export function getPrimaryWeaponConfig(id) {
  return PRIMARY_WEAPONS[id] ?? PRIMARY_WEAPONS.rifle;
}

/** @param {PrimaryWeaponId} activeId @param {boolean} [rifleUnlocked] @returns {PrimaryWeaponId | null} */
export function getOtherPrimaryWeaponId(activeId, rifleUnlocked = true) {
  if (activeId === "pistol" && !rifleUnlocked) return null;
  return activeId === "rifle" ? "pistol" : "rifle";
}

/** @typedef {'auto' | 'burst' | 'single'} FireMode */

/** @returns {Record<PrimaryWeaponId, FireMode>} */
export function createDefaultFireModePool() {
  return {
    rifle: "auto",
    pistol: "single",
  };
}

/** @param {PrimaryWeaponId} id @param {FireMode} mode */
export function resolveFireModeForWeapon(id, mode) {
  const cfg = getPrimaryWeaponConfig(id);
  return cfg.fireModes.includes(mode) ? mode : cfg.fireModes[0];
}

/** One loaded mag + spareMagazines spare — e.g. pistol 3 mags / 36 rounds. */
export function getPrimaryWeaponStartingAmmo(id) {
  const cfg = getPrimaryWeaponConfig(id);
  return {
    rounds: cfg.magazineSize,
    spare: cfg.spareMagazines,
  };
}

/** @returns {Record<PrimaryWeaponId, { rounds: number, spare: number }>} */
export function createDefaultAmmoPool() {
  return {
    rifle: { rounds: 0, spare: 0 },
    pistol: getPrimaryWeaponStartingAmmo("pistol"),
  };
}
