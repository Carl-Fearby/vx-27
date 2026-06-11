/** Base bullet damage before zone mult and weapon profile scale. */
export const TARGET_DAMAGE = 6;

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
    headshotHealthFraction: 0.5,
    upperBodyScale: 0.5,
    lowerBodyScale: 0.25,
    armScale: 0.25,
  },
};

/** @param {string} weaponId */
export function getWeaponDamageProfile(weaponId) {
  return (
    WEAPON_DAMAGE_PROFILES[/** @type {WeaponDamageId} */ (weaponId)] ??
    WEAPON_DAMAGE_PROFILES.rifle
  );
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
 */
export function resolveHeadshotDamage(profile, currentHealth, maxHealth) {
  if (profile.headshotHealthFraction >= 1) {
    return currentHealth;
  }
  return maxHealth * profile.headshotHealthFraction;
}

/**
 * @param {WeaponDamageProfile} profile
 * @param {string} zoneId
 * @param {number} zoneMult
 */
export function resolveBodyZoneDamage(profile, zoneId, zoneMult) {
  const category = hitZoneBodyCategory(zoneId);
  let scale = profile.upperBodyScale;
  if (category === "lower") scale = profile.lowerBodyScale;
  else if (category === "arm") scale = profile.armScale;
  return profile.baseDamage * zoneMult * scale;
}
