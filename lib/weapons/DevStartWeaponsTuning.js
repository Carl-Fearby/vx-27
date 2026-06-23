import { getPrimaryWeaponStartingAmmo } from "./PrimaryWeapons.js";

/** Settings → Development. Applies on next Start Game. */
export const DEV_START_BOTH_PRIMARY_WEAPONS_KEY =
  "fps-dev-start-both-primary-weapons";

export function loadDevStartBothPrimaryWeapons() {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(DEV_START_BOTH_PRIMARY_WEAPONS_KEY) === "true"
    );
  } catch {
    return false;
  }
}

/** @param {boolean} enabled */
export function saveDevStartBothPrimaryWeapons(enabled) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DEV_START_BOTH_PRIMARY_WEAPONS_KEY,
      enabled ? "true" : "false",
    );
  } catch {
    // Ignore storage-denied browser modes; the setting simply won't persist.
  }
}

/**
 * Match default rifle loadout — full mag + two spare (3 mags / 240 rounds).
 * @param {ReturnType<import("./PrimaryWeapons.js").createDefaultAmmoPool>} ammoPool
 */
export function applyDevStartBothPrimaryWeapons(ammoPool) {
  ammoPool.rifle = getPrimaryWeaponStartingAmmo("rifle");
}
