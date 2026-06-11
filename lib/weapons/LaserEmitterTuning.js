export const LASER_EMITTER_TUNE_ENABLED_KEY =
  "fps-laser-emitter-tune-enabled";
export const LASER_EMITTER_TUNING_KEY = "fps-laser-emitter-tuning";

export const DEFAULT_LASER_EMITTER_TUNING = {
  pistol: { x: 0.133, y: 0.475, z: -0.601 },
  rifle: { x: -0.136, y: 0.079, z: -1.24 },
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

export function normalizeLaserEmitterOffset(offset = {}) {
  const next = {};
  for (const field of OFFSET_FIELDS) {
    next[field] = clampOffsetAxis(field, offset[field]);
  }
  return next;
}

export function normalizeLaserEmitterTuning(tuning = {}) {
  return {
    pistol: normalizeLaserEmitterOffset({
      ...DEFAULT_LASER_EMITTER_TUNING.pistol,
      ...(tuning.pistol ?? {}),
    }),
    rifle: normalizeLaserEmitterOffset({
      ...DEFAULT_LASER_EMITTER_TUNING.rifle,
      ...(tuning.rifle ?? {}),
    }),
  };
}

export function loadLaserEmitterTuning() {
  try {
    const raw = localStorage.getItem(LASER_EMITTER_TUNING_KEY);
    if (raw) return normalizeLaserEmitterTuning(JSON.parse(raw));
  } catch {
    // ignore
  }
  return normalizeLaserEmitterTuning(DEFAULT_LASER_EMITTER_TUNING);
}

export function saveLaserEmitterTuning(tuning) {
  localStorage.setItem(
    LASER_EMITTER_TUNING_KEY,
    JSON.stringify(normalizeLaserEmitterTuning(tuning))
  );
}

export function loadLaserEmitterTuneEnabled() {
  try {
    return localStorage.getItem(LASER_EMITTER_TUNE_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveLaserEmitterTuneEnabled(enabled) {
  localStorage.setItem(LASER_EMITTER_TUNE_ENABLED_KEY, String(enabled));
}

export function formatLaserEmitterTuningForCopy(tuning) {
  const normalized = normalizeLaserEmitterTuning(tuning);
  const rounded = {};
  for (const weaponId of ["pistol", "rifle"]) {
    rounded[weaponId] = {};
    for (const field of OFFSET_FIELDS) {
      rounded[weaponId][field] =
        Math.round(normalized[weaponId][field] * 10000) / 10000;
    }
  }
  return JSON.stringify(rounded, null, 2);
}
