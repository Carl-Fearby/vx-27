/**
 * Weapon damage profiles and falloff — Rust via game_core (WASM required).
 */

import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";

/** @typedef {import("@/lib/game-core/types.ts").GameCoreEngine} GameCoreEngine */

/** Base bullet damage before zone mult and weapon profile scale. */
export const TARGET_DAMAGE = 6;

/** At full ADS, bullet damage is multiplied by this factor (linear blend from hip). */
export const ADS_DAMAGE_MULTIPLIER = 1.3;

/** At full ADS, recoil strength is multiplied by (1 - this). */
export const ADS_RECOIL_REDUCTION = 0.4;

/** @param {number} aimBlend 0 hip → 1 ADS @param {GameCoreEngine} gameCore */
export function resolveAdsDamageScale(aimBlend, gameCore) {
  return requireWasmMethod(gameCore, "resolveAdsDamageScale")(aimBlend);
}

/** @param {number} aimBlend 0 hip → 1 ADS @param {GameCoreEngine} gameCore */
export function resolveAdsRecoilScale(aimBlend, gameCore) {
  return requireWasmMethod(gameCore, "resolveAdsRecoilScale")(aimBlend);
}

/** @typedef {'rifle' | 'pistol'} WeaponDamageId */

/** Legs + pelvis + feet — pistol uses {@link WeaponDamageProfile.lowerBodyScale}. */
export const LOWER_BODY_HIT_ZONES = new Set([
  "pelvis",
  "thigh",
  "knee",
  "lower_leg",
  "foot",
]);

/**
 * Per-weapon damage against humanoid hit zones (multiplies zone `mult` × base).
 * @typedef {{
 *   id: WeaponDamageId,
 *   label: string,
 *   baseDamage: number,
 *   headshotHealthFraction: number,
 *   upperBodyScale: number,
 *   lowerBodyScale: number,
 *   armScale: number,
 * }} WeaponDamageProfile
 */

/** @type {Record<WeaponDamageId, WeaponDamageProfile>} */
export const WEAPON_DAMAGE_PROFILES = {
  rifle: {
    id: "rifle",
    label: "Rifle",
    baseDamage: TARGET_DAMAGE,
    headshotHealthFraction: 1,
    upperBodyScale: 1,
    lowerBodyScale: 1,
    armScale: 1,
  },
  pistol: {
    id: "pistol",
    label: "Pistol",
    baseDamage: TARGET_DAMAGE,
    headshotHealthFraction: 1,
    upperBodyScale: 0.5,
    lowerBodyScale: 0.25,
    armScale: 0.25,
  },
};

/** Damage multiplier by camera-to-hit distance. Tuned around 30HP targets. */
export const WEAPON_DAMAGE_FALLOFF = {
  pistol: [
    { distance: 0, multiplier: 1 },
    { distance: 3, multiplier: 1 },
    { distance: 5, multiplier: 0.5 },
    { distance: 10, multiplier: 1 / 3 },
    { distance: 50, multiplier: 0.25 },
  ],
  rifle: [
    { distance: 0, multiplier: 1 },
    { distance: 10, multiplier: 1 },
    { distance: 50, multiplier: 0.5 },
  ],
};

/** @param {string} weaponId */
export function getWeaponDamageProfile(weaponId) {
  return (
    WEAPON_DAMAGE_PROFILES[/** @type {WeaponDamageId} */ (weaponId)] ??
    WEAPON_DAMAGE_PROFILES.rifle
  );
}

/**
 * @param {WeaponDamageProfile | WeaponDamageId} profileOrId
 * @param {number} shotDistance Camera-to-hit distance in metres.
 * @param {GameCoreEngine} gameCore
 */
export function resolveDamageFalloff(profileOrId, shotDistance = 0, gameCore) {
  const id =
    typeof profileOrId === "string"
      ? profileOrId
      : profileOrId?.id ?? "rifle";
  return requireWasmMethod(gameCore, "resolveDamageFalloff")(id, shotDistance);
}

/** @param {string} zoneId */
export function hitZoneBodyCategory(zoneId) {
  if (zoneId === "head") return "head";
  if (zoneId === "arm") return "arm";
  if (LOWER_BODY_HIT_ZONES.has(zoneId)) return "lower";
  return "upper";
}

/**
 * @param {WeaponDamageProfile} profile
 * @param {number} currentHealth
 * @param {number} maxHealth
 * @param {number} [shotDistance]
 * @param {GameCoreEngine} gameCore
 */
export function resolveHeadshotDamage(
  profile,
  currentHealth,
  maxHealth,
  shotDistance = 0,
  gameCore,
) {
  return requireWasmMethod(gameCore, "resolveHeadshotDamage")(
    profile?.id ?? "rifle",
    currentHealth,
    maxHealth,
    shotDistance,
  );
}

/**
 * @param {WeaponDamageProfile} profile
 * @param {string} zoneId
 * @param {number} zoneMult
 * @param {number} [shotDistance]
 * @param {GameCoreEngine} gameCore
 */
export function resolveBodyZoneDamage(
  profile,
  zoneId,
  zoneMult,
  shotDistance = 0,
  gameCore,
) {
  return requireWasmMethod(gameCore, "resolveBodyZoneDamage")(
    profile?.id ?? "rifle",
    zoneId,
    zoneMult,
    shotDistance,
  );
}
