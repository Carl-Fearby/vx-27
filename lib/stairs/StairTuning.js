import * as THREE from "three";
import {
  STAIRS_STEP_COUNT,
  STAIRS_STEP_RISE,
  STAIRS_STEP_RUN,
  STAIRS_TOTAL_RISE,
  STAIRS_TOTAL_RUN,
  STAIR_EXTRA_RISE,
  STAIRS_EFFECTIVE_TOTAL_RISE,
  STAIRS_WIDTH,
} from "./LevelStairs.js";

export {
  STAIRS_WIDTH,
  STAIRS_STEP_COUNT,
  STAIRS_STEP_RISE,
  STAIRS_STEP_RUN,
  STAIRS_TOTAL_RISE,
  STAIRS_TOTAL_RUN,
  STAIR_EXTRA_RISE,
  STAIRS_EFFECTIVE_TOTAL_RISE,
};

// Baked-in defaults (single source of truth — level JSON does not author placement).
export const STAIR_X_DEFAULT = -0.779;
export const STAIR_Y_DEFAULT = -0.034;
export const STAIR_Z_DEFAULT = -4.416;
export const STAIR_ROTATION_DEFAULT = 90;

/** @type {Readonly<import("./LevelStairs.js").StairPlacement>} */
export const DEFAULT_STAIR_PLACEMENT = Object.freeze({
  position: Object.freeze({
    x: STAIR_X_DEFAULT,
    y: STAIR_Y_DEFAULT,
    z: STAIR_Z_DEFAULT,
  }),
  rotationY: STAIR_ROTATION_DEFAULT,
});

/** @returns {import("./LevelStairs.js").StairPlacement} */
export function getDefaultStairPlacement() {
  return {
    position: { ...DEFAULT_STAIR_PLACEMENT.position },
    rotationY: DEFAULT_STAIR_PLACEMENT.rotationY,
  };
}

/** @typedef {import("./LevelStairs.js").StairPlacement} StairPlacement */

const CEILING_OVERLAP = 0;

/** Walkable top of the main arena floor (matches Level.js floor slab). */
export function getArenaFloorDeckY() {
  return 0;
}

/** Top of the arena catwalk / ceiling deck (upper landing walk surface). */
export function getArenaCatwalkDeckY(arena) {
  const wallHeight = arena?.wallHeight ?? 4;
  const ceilingThickness = arena?.ceilingThickness ?? 0.35;
  const ceilingBottomY = wallHeight - CEILING_OVERLAP;
  return ceilingBottomY + ceilingThickness;
}

/**
 * @param {Record<string, unknown> | null | undefined} arenaStairs
 * @param {number} [floorDeckY]
 * @returns {StairPlacement}
 */
export function normalizeArenaStairs(arenaStairs, floorDeckY = STAIR_Y_DEFAULT) {
  if (arenaStairs?.position && typeof arenaStairs.rotationY === "number") {
    const p = arenaStairs.position;
    const y =
      p.y == null || p.y === 0 ? floorDeckY : p.y;
    const catwalkDeckY = getArenaCatwalkDeckY();
    const resolvedY =
      Math.abs(y - catwalkDeckY) < 0.05 ? floorDeckY : y;
    return {
      position: {
        x: p.x ?? STAIR_X_DEFAULT,
        y: resolvedY,
        z: p.z ?? STAIR_Z_DEFAULT,
      },
      rotationY: arenaStairs.rotationY,
    };
  }

  const legacy = arenaStairs;
  if (legacy?.start && legacy?.end) {
    const dx = legacy.end.x - legacy.start.x;
    const dz = legacy.end.z - legacy.start.z;
    return {
      position: {
        x: legacy.start.x ?? STAIR_X_DEFAULT,
        y: 0,
        z: legacy.start.z ?? STAIR_Z_DEFAULT,
      },
      rotationY: THREE.MathUtils.radToDeg(Math.atan2(dx, dz)),
    };
  }

  return getDefaultStairPlacement();
}

/**
 * @param {Record<string, unknown> | null | undefined} arenaStairs
 * @param {import("../level/loadArena.js").ArenaConfig | null | undefined} [arena]
 * @returns {StairPlacement}
 */
export function loadStairTuning(arenaStairs, arena = null) {
  const floorDeckY = getArenaFloorDeckY();
  const base = normalizeArenaStairs(arenaStairs, floorDeckY);
  const catwalkDeckY = getArenaCatwalkDeckY(arena);

  let y = base.position.y;
  if (Math.abs(y - catwalkDeckY) < 0.05) {
    y = floorDeckY;
  }

  return {
    position: { ...base.position, y },
    rotationY: base.rotationY,
  };
}
