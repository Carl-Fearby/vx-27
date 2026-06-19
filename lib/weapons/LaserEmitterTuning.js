import * as THREE from "three";

export const LASER_EMITTER_TUNE_ENABLED_KEY =
  "fps-laser-emitter-tune-enabled";
export const LASER_EMITTER_TUNING_KEY = "fps-laser-emitter-tuning";
export const LASER_EMITTER_TUNING_VERSION = 2;

/** @typedef {{ x: number, y: number, z: number }} LaserEmitterOffset */

/** @typedef {{ hip: LaserEmitterOffset, ads: LaserEmitterOffset }} WeaponLaserEmitterOffsets */

export const DEFAULT_LASER_EMITTER_TUNING = {
  pistol: {
    hip: { x: 0.133, y: 0.475, z: -0.601 },
    ads: { x: 0.249, y: 0.352, z: -0.565 },
  },
  rifle: {
    hip: { x: -0.136, y: 0.079, z: -1.24 },
    ads: { x: -0.136, y: 0.079, z: -1.24 },
  },
};

const OFFSET_FIELDS = ["x", "y", "z"];

/** Per-axis emitter offset limits (metres, local muzzle space). */
export const LASER_EMITTER_OFFSET_LIMITS = {
  x: { min: -0.35, max: 2 },
  y: { min: -4, max: 4 },
  z: { min: -6, max: 2 },
};

function clampOffsetAxis(field, value) {
  const limits = LASER_EMITTER_OFFSET_LIMITS[field];
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(limits.max, Math.max(limits.min, n));
}

/** @param {Partial<LaserEmitterOffset>} [offset] @returns {LaserEmitterOffset} */
export function normalizeLaserEmitterOffset(offset = {}) {
  const next = {};
  for (const field of OFFSET_FIELDS) {
    next[field] = clampOffsetAxis(field, offset[field]);
  }
  return next;
}

/** @param {Partial<WeaponLaserEmitterOffsets>} entry @param {WeaponLaserEmitterOffsets} defaults */
function normalizeWeaponLaserOffsets(entry = {}, defaults) {
  if (entry?.hip || entry?.ads) {
    return {
      hip: normalizeLaserEmitterOffset({ ...defaults.hip, ...entry.hip }),
      ads: normalizeLaserEmitterOffset({ ...defaults.ads, ...entry.ads }),
    };
  }
  const legacy = normalizeLaserEmitterOffset({ ...defaults.hip, ...entry });
  return {
    hip: legacy,
    ads: normalizeLaserEmitterOffset({ ...defaults.ads, ...entry?.ads }),
  };
}

/** @param {Partial<Record<"pistol" | "rifle", Partial<WeaponLaserEmitterOffsets>>>} [tuning] */
export function normalizeLaserEmitterTuning(tuning = {}) {
  return {
    pistol: normalizeWeaponLaserOffsets(
      tuning.pistol,
      DEFAULT_LASER_EMITTER_TUNING.pistol,
    ),
    rifle: normalizeWeaponLaserOffsets(
      tuning.rifle,
      DEFAULT_LASER_EMITTER_TUNING.rifle,
    ),
  };
}

/**
 * Blend hip/ads emitter offsets for the current aim amount.
 * @param {Partial<WeaponLaserEmitterOffsets> | Partial<LaserEmitterOffset> | null | undefined} entry
 * @param {number} aimBlend 0 hip · 1 ADS
 * @param {"pistol" | "rifle"} [weaponId]
 * @returns {LaserEmitterOffset}
 */
export function resolveLaserEmitterOffset(entry, aimBlend, weaponId = "rifle") {
  const defaults =
    DEFAULT_LASER_EMITTER_TUNING[weaponId] ??
    DEFAULT_LASER_EMITTER_TUNING.rifle;
  const offsets = normalizeWeaponLaserOffsets(entry, defaults);
  const t = THREE.MathUtils.clamp(aimBlend, 0, 1);
  return {
    x: THREE.MathUtils.lerp(offsets.hip.x, offsets.ads.x, t),
    y: THREE.MathUtils.lerp(offsets.hip.y, offsets.ads.y, t),
    z: THREE.MathUtils.lerp(offsets.hip.z, offsets.ads.z, t),
  };
}

export function loadLaserEmitterTuning() {
  if (typeof window === "undefined") {
    return normalizeLaserEmitterTuning(DEFAULT_LASER_EMITTER_TUNING);
  }
  try {
    const raw = localStorage.getItem(LASER_EMITTER_TUNING_KEY);
    if (!raw) return normalizeLaserEmitterTuning(DEFAULT_LASER_EMITTER_TUNING);
    const parsed = JSON.parse(raw);
    const storedVersion =
      typeof parsed.version === "number" ? parsed.version : 0;
    if (storedVersion < LASER_EMITTER_TUNING_VERSION) {
      saveLaserEmitterTuning(DEFAULT_LASER_EMITTER_TUNING);
      return normalizeLaserEmitterTuning(DEFAULT_LASER_EMITTER_TUNING);
    }
    return normalizeLaserEmitterTuning(parsed);
  } catch {
    return normalizeLaserEmitterTuning(DEFAULT_LASER_EMITTER_TUNING);
  }
}

export function saveLaserEmitterTuning(tuning) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    LASER_EMITTER_TUNING_KEY,
    JSON.stringify({
      ...normalizeLaserEmitterTuning(tuning),
      version: LASER_EMITTER_TUNING_VERSION,
    }),
  );
}



export function formatLaserEmitterTuningForCopy(tuning) {
  const normalized = normalizeLaserEmitterTuning(tuning);
  const rounded = {};
  for (const weaponId of ["pistol", "rifle"]) {
    rounded[weaponId] = {};
    for (const mode of ["hip", "ads"]) {
      rounded[weaponId][mode] = {};
      for (const field of OFFSET_FIELDS) {
        rounded[weaponId][mode][field] =
          Math.round(normalized[weaponId][mode][field] * 10000) / 10000;
      }
    }
  }
  return JSON.stringify(rounded, null, 2);
}
