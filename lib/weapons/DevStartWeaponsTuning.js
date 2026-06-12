import { PRIMARY_WEAPONS } from "./PrimaryWeapons.js";
import { SERVICE_ROOM_RIFLE_SHOP_OFFER } from "./WallWeaponShop.js";

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
 * Match wall-shop rifle unlock ammo — full mag + one spare.
 * @param {ReturnType<import("./PrimaryWeapons.js").createDefaultAmmoPool>} ammoPool
 */
export function applyDevStartBothPrimaryWeapons(ammoPool) {
  const rifleCfg = PRIMARY_WEAPONS.rifle;
  const offer = SERVICE_ROOM_RIFLE_SHOP_OFFER;
  ammoPool.rifle.rounds = rifleCfg.magazineSize;
  ammoPool.rifle.spare = Math.max(0, offer.unlockMagCount - 1);
}
