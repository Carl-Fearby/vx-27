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
    spareMagazines: 4,
    lowAmmoThreshold: 15,
    fireModes: ["auto", "burst", "single"],
    viewOptions: {
      fitProfile: "rifle",
      roundDisplay: true,
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
    spareMagazines: 4,
    lowAmmoThreshold: 4,
    fireModes: ["single"],
    viewOptions: {
      fitProfile: "pistol",
      roundDisplay: false,
      flashlight: false,
      gunReticule: false,
      standardCrosshairOnly: true,
    },
  },
};

/** @param {PrimaryWeaponId} id */
export function getPrimaryWeaponConfig(id) {
  return PRIMARY_WEAPONS[id] ?? PRIMARY_WEAPONS.rifle;
}

/** @param {PrimaryWeaponId} activeId @returns {PrimaryWeaponId} */
export function getOtherPrimaryWeaponId(activeId) {
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

/** @returns {Record<PrimaryWeaponId, { rounds: number, spare: number }>} */
export function createDefaultAmmoPool() {
  return {
    rifle: {
      rounds: PRIMARY_WEAPONS.rifle.magazineSize,
      spare: PRIMARY_WEAPONS.rifle.spareMagazines,
    },
    pistol: {
      rounds: PRIMARY_WEAPONS.pistol.magazineSize,
      spare: PRIMARY_WEAPONS.pistol.spareMagazines,
    },
  };
}
