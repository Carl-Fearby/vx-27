/** Base bullet damage before zone mult and weapon profile scale. */
export const TARGET_DAMAGE = 6;

/** At full ADS, bullet damage is multiplied by this factor (linear blend from hip). */
export const ADS_DAMAGE_MULTIPLIER = 1.3;

/** At full ADS, recoil strength is multiplied by (1 - this). */
export const ADS_RECOIL_REDUCTION = 0.4;

/** @param {number} aimBlend 0 hip → 1 ADS */
export function resolveAdsDamageScale(aimBlend) {
  const t = Math.max(0, Math.min(1, aimBlend));
  return 1 + t * (ADS_DAMAGE_MULTIPLIER - 1);
}

/** @param {number} aimBlend 0 hip → 1 ADS */
export function resolveAdsRecoilScale(aimBlend) {
  const t = Math.max(0, Math.min(1, aimBlend));
  return 1 - t * ADS_RECOIL_REDUCTION;
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
 */
export function resolveDamageFalloff(profileOrId, shotDistance = 0) {
  const id =
    typeof profileOrId === "string"
      ? profileOrId
      : profileOrId?.id ?? "rifle";
  const points =
    WEAPON_DAMAGE_FALLOFF[/** @type {WeaponDamageId} */ (id)] ??
    WEAPON_DAMAGE_FALLOFF.rifle;
  const distance = Math.max(
    0,
    Number.isFinite(shotDistance) ? shotDistance : 0
  );

  if (distance <= points[0].distance) return points[0].multiplier;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    if (distance > next.distance) continue;
    const span = Math.max(0.0001, next.distance - prev.distance);
    const t = (distance - prev.distance) / span;
    return prev.multiplier + (next.multiplier - prev.multiplier) * t;
  }
  return points[points.length - 1].multiplier;
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
 */
export function resolveHeadshotDamage(
  profile,
  currentHealth,
  maxHealth,
  shotDistance = 0
) {
  const falloff = resolveDamageFalloff(profile, shotDistance);
  if (profile.headshotHealthFraction >= 1 && falloff >= 0.999) {
    return currentHealth;
  }
  return maxHealth * profile.headshotHealthFraction * falloff;
}

/**
 * @param {WeaponDamageProfile} profile
 * @param {string} zoneId
 * @param {number} zoneMult
 * @param {number} [shotDistance]
 */
export function resolveBodyZoneDamage(
  profile,
  zoneId,
  zoneMult,
  shotDistance = 0
) {
  const category = hitZoneBodyCategory(zoneId);
  let scale = profile.upperBodyScale;
  if (category === "lower") scale = profile.lowerBodyScale;
  else if (category === "arm") scale = profile.armScale;
  return (
    profile.baseDamage *
    zoneMult *
    scale *
    resolveDamageFalloff(profile, shotDistance)
  );
}
