import { getPrimaryWeaponStartingAmmo } from "./PrimaryWeapons.js";

/** Settings → Development. Applies on next Start Game. */
export const DEV_START_BOTH_PRIMARY_WEAPONS_KEY =
  "fps-dev-start-both-primary-weapons";

export function loadDevStartBothPrimaryWeapons() {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(DEV_START_BOTH_PRIMARY_WEAPONS_KEY);
  return raw === "true";
}

/** @param {boolean} enabled */
export function saveDevStartBothPrimaryWeapons(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    DEV_START_BOTH_PRIMARY_WEAPONS_KEY,
    enabled ? "true" : "false",
  );
}

/**
 * Match default rifle loadout — full mag + two spare (3 mags / 240 rounds).
 * @param {ReturnType<import("./PrimaryWeapons.js").createDefaultAmmoPool>} ammoPool
 */
export function applyDevStartBothPrimaryWeapons(ammoPool) {
  ammoPool.rifle = getPrimaryWeaponStartingAmmo("rifle");
}
