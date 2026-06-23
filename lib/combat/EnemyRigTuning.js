export const ENEMY_RIG_TUNING_KEY = "fps-enemy-rig-tuning";
export const ENEMY_RIG_MATERIAL_MODEL_KEY = "fps-enemy-rig-material-model";
export const ENEMY_RIG_MATERIAL_MODEL_VERSION = 4;

export const ENEMY_RIG_POSE_KEYS = Object.freeze([
  "positionX",
  "positionY",
  "positionZ",
  "rotationX",
  "rotationY",
  "rotationZ",
]);

/** @typedef {{
 *   positionX: number,
 *   positionY: number,
 *   positionZ: number,
 *   rotationX: number,
 *   rotationY: number,
 *   rotationZ: number,
 * }} EnemyRigPose */

/** PX-27 GLB holder offsets — tune in the rig wizard if needed. */
export const DEFAULT_ENEMY_RIG_IDLE = Object.freeze({
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 0,
  rotationY: 2,
  rotationZ: 0,
});

/** Walking holder offset while the walk clip plays. */
export const DEFAULT_ENEMY_RIG_WALK = Object.freeze({
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 0,
  rotationY: 2,
  rotationZ: 0,
});

/** Laser blast origin on the enemy capsule (fractions of target height). */
export const DEFAULT_ENEMY_RIG_MUZZLE = Object.freeze({
  x: 0.015,
  y: 0.18,
  z: 0.19,
});

export const DEFAULT_ENEMY_RIG_MATERIAL = Object.freeze({
  brightness: 1.65,
  emissiveFill: 0.12,
  accentGlow: 0.6,
  metalness: 0.25,
  roughness: 0.84,
});

export const DEFAULT_ENEMY_RIG_TUNING = Object.freeze({
  idle: { ...DEFAULT_ENEMY_RIG_IDLE },
  walk: { ...DEFAULT_ENEMY_RIG_WALK },
  muzzle: { ...DEFAULT_ENEMY_RIG_MUZZLE },
  material: { ...DEFAULT_ENEMY_RIG_MATERIAL },
  previewAnimation: false,
  previewReverse: false,
  damageEnabled: false,
});

export const ENEMY_RIG_MUZZLE_LIMITS = Object.freeze({
  x: { min: -0.15, max: 0.15, step: 0.005 },
  y: { min: 0.15, max: 0.55, step: 0.005 },
  z: { min: 0.15, max: 0.65, step: 0.005 },
});

export const ENEMY_RIG_MATERIAL_LIMITS = Object.freeze({
  brightness: { min: 0.5, max: 2.5, step: 0.05 },
  emissiveFill: { min: 0, max: 0.4, step: 0.01 },
  accentGlow: { min: 0, max: 6, step: 0.1 },
  metalness: { min: 0, max: 1, step: 0.01 },
  roughness: { min: 0.1, max: 1, step: 0.01 },
});

export const ENEMY_RIG_TUNING_LIMITS = Object.freeze({
  positionX: { min: -1, max: 1, step: 0.01 },
  positionY: { min: -1, max: 1, step: 0.01 },
  positionZ: { min: -1, max: 1, step: 0.01 },
  rotationX: { min: -180, max: 180, step: 1 },
  rotationY: { min: -180, max: 180, step: 1 },
  rotationZ: { min: -180, max: 180, step: 1 },
});

let _current = null;
let _wizardPreviewActive = false;

/** Wizard-only: preview walk in place without affecting gameplay AI. */
export function setEnemyRigWizardPreviewActive(active) {
  _wizardPreviewActive = active === true;
}

export function isEnemyRigWizardPreviewActive() {
  return _wizardPreviewActive;
}

function clampNumber(value, key) {
  const limits = ENEMY_RIG_TUNING_LIMITS[key];
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_ENEMY_RIG_IDLE[key];
  return Math.min(limits.max, Math.max(limits.min, number));
}

function clampMaterialNumber(value, key) {
  const limits = ENEMY_RIG_MATERIAL_LIMITS[key];
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_ENEMY_RIG_MATERIAL[key];
  return Math.min(limits.max, Math.max(limits.min, number));
}

function clampMuzzleNumber(value, key) {
  const limits = ENEMY_RIG_MUZZLE_LIMITS[key];
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_ENEMY_RIG_MUZZLE[key];
  return Math.min(limits.max, Math.max(limits.min, number));
}

export function normalizeEnemyRigMuzzle(value = {}) {
  return {
    x: clampMuzzleNumber(value.x, "x"),
    y: clampMuzzleNumber(value.y, "y"),
    z: clampMuzzleNumber(value.z, "z"),
  };
}

export function normalizeEnemyRigMaterial(value = {}) {
  return {
    brightness: clampMaterialNumber(value.brightness, "brightness"),
    emissiveFill: clampMaterialNumber(value.emissiveFill, "emissiveFill"),
    accentGlow: clampMaterialNumber(
      value.accentGlow ?? DEFAULT_ENEMY_RIG_MATERIAL.accentGlow,
      "accentGlow",
    ),
    metalness: clampMaterialNumber(value.metalness, "metalness"),
    roughness: clampMaterialNumber(value.roughness, "roughness"),
  };
}

/** @param {Partial<EnemyRigPose>} value @param {EnemyRigPose} fallback */
export function normalizeEnemyRigPose(value = {}, fallback = DEFAULT_ENEMY_RIG_IDLE) {
  return {
    positionX: clampNumber(value.positionX, "positionX"),
    positionY: clampNumber(value.positionY, "positionY"),
    positionZ: clampNumber(value.positionZ, "positionZ"),
    rotationX: clampNumber(value.rotationX, "rotationX"),
    rotationY: clampNumber(value.rotationY, "rotationY"),
    rotationZ: clampNumber(value.rotationZ, "rotationZ"),
  };
}

function isLegacyFlatTuning(value) {
  return value && typeof value === "object" && "positionX" in value && !("idle" in value);
}

/** @param {Record<string, unknown>} value */
export function normalizeEnemyRigTuning(value = {}) {
  if (isLegacyFlatTuning(value)) {
    const legacyPose = normalizeEnemyRigPose(value, DEFAULT_ENEMY_RIG_IDLE);
    return {
      idle: legacyPose,
      walk: { ...DEFAULT_ENEMY_RIG_WALK },
      muzzle: normalizeEnemyRigMuzzle(value.muzzle),
      material: normalizeEnemyRigMaterial(value.material),
      previewAnimation: value.previewAnimation === true,
      previewReverse: value.previewReverse === true,
      damageEnabled: value.damageEnabled === true,
    };
  }
  return {
    idle: normalizeEnemyRigPose(value.idle, DEFAULT_ENEMY_RIG_IDLE),
    walk: normalizeEnemyRigPose(value.walk, DEFAULT_ENEMY_RIG_WALK),
    muzzle: normalizeEnemyRigMuzzle(value.muzzle),
    material: normalizeEnemyRigMaterial(value.material),
    previewAnimation: value.previewAnimation === true,
    previewReverse: value.previewReverse === true,
    damageEnabled: value.damageEnabled === true,
  };
}

function migrateLegacyEnemyRigTuning(tuning) {
  let changed = false;
  const next = {
    ...tuning,
    idle: { ...tuning.idle },
    walk: { ...tuning.walk },
    muzzle: { ...tuning.muzzle },
    material: { ...tuning.material },
  };
  if (next.idle.rotationY === -46) {
    next.idle.rotationY = 0;
    changed = true;
  }
  if (next.walk.rotationY === -30) {
    next.walk.rotationY = 0;
    changed = true;
  }
  if (next.walk.rotationY === 0 && next.idle.rotationY === DEFAULT_ENEMY_RIG_IDLE.rotationY) {
    next.walk.rotationY = DEFAULT_ENEMY_RIG_WALK.rotationY;
    changed = true;
  }
  const mat = next.material;
  const materialModelVersion =
    typeof window !== "undefined"
      ? Number.parseInt(localStorage.getItem(ENEMY_RIG_MATERIAL_MODEL_KEY) ?? "0", 10)
      : ENEMY_RIG_MATERIAL_MODEL_VERSION;
  if (materialModelVersion < ENEMY_RIG_MATERIAL_MODEL_VERSION) {
    if (materialModelVersion < 3) {
      next.material = { ...DEFAULT_ENEMY_RIG_MATERIAL };
      next.idle.rotationY = DEFAULT_ENEMY_RIG_IDLE.rotationY;
    }
    if (materialModelVersion < 4) {
      next.muzzle = { ...DEFAULT_ENEMY_RIG_MUZZLE };
    }
    changed = true;
    if (typeof window !== "undefined") {
      localStorage.setItem(
        ENEMY_RIG_MATERIAL_MODEL_KEY,
        String(ENEMY_RIG_MATERIAL_MODEL_VERSION),
      );
    }
  } else if (
    next.muzzle &&
    next.muzzle.x === -0.035 &&
    next.muzzle.y === 0.38 &&
    next.muzzle.z === 0.42
  ) {
    next.muzzle = { ...DEFAULT_ENEMY_RIG_MUZZLE };
    changed = true;
  } else if (
    mat &&
    (
      mat.brightness === 2.5 ||
      mat.brightness === 1 ||
      (mat.brightness === 1.06 && mat.emissiveFill === 0.02) ||
      (mat.brightness === 1.35 && mat.emissiveFill === 0.1) ||
      (mat.accentGlow === 2.5 && mat.emissiveFill === 0)
    )
  ) {
    next.material = { ...DEFAULT_ENEMY_RIG_MATERIAL };
    changed = true;
  }
  if (!changed) return tuning;
  if (typeof window !== "undefined") {
    localStorage.setItem(
      ENEMY_RIG_TUNING_KEY,
      JSON.stringify(persistableTuning(next)),
    );
  }
  return next;
}

export function loadEnemyRigTuning() {
  if (_current) {
    return {
      ..._current,
      idle: { ..._current.idle },
      walk: { ..._current.walk },
      muzzle: { ..._current.muzzle },
      material: { ..._current.material },
    };
  }
  if (typeof window === "undefined") {
    _current = normalizeEnemyRigTuning(DEFAULT_ENEMY_RIG_TUNING);
    return loadEnemyRigTuning();
  }
  try {
    const raw = localStorage.getItem(ENEMY_RIG_TUNING_KEY);
    _current = raw
      ? migrateLegacyEnemyRigTuning({
        ...normalizeEnemyRigTuning(JSON.parse(raw)),
        previewAnimation: false,
        previewReverse: false,
      })
      : normalizeEnemyRigTuning(DEFAULT_ENEMY_RIG_TUNING);
  } catch {
    _current = normalizeEnemyRigTuning(DEFAULT_ENEMY_RIG_TUNING);
  }
  return loadEnemyRigTuning();
}

export function getEnemyRigTuning() {
  return _current ?? loadEnemyRigTuning();
}

/** @param {boolean} moving @param {ReturnType<typeof getEnemyRigTuning>} [tuning] */
export function getEnemyRigPoseForState(moving, tuning = getEnemyRigTuning()) {
  const useWalkPose =
    moving || (tuning.previewAnimation && isEnemyRigWizardPreviewActive());
  return useWalkPose ? tuning.walk : tuning.idle;
}

function persistableTuning(tuning) {
  return {
    idle: tuning.idle,
    walk: tuning.walk,
    muzzle: tuning.muzzle,
    material: tuning.material,
    damageEnabled: tuning.damageEnabled,
  };
}

export function saveEnemyRigTuning(value) {
  const normalized = normalizeEnemyRigTuning(value);
  _current = {
    ...normalized,
    previewAnimation: value.previewAnimation === true,
    previewReverse: value.previewReverse === true,
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(
      ENEMY_RIG_TUNING_KEY,
      JSON.stringify(persistableTuning(_current)),
    );
  }
  return loadEnemyRigTuning();
}

/** Flat JSON block for the rig wizard copy button (current edit mode). */
export function formatEnemyRigTuningForCopy(tuning = getEnemyRigTuning()) {
  const pose = tuning.previewAnimation ? tuning.walk : tuning.idle;
  return JSON.stringify({
    ...pose,
    muzzle: tuning.muzzle,
    material: tuning.material,
    previewAnimation: tuning.previewAnimation,
    previewReverse: tuning.previewReverse,
    damageEnabled: tuning.damageEnabled,
  }, null, 2);
}
