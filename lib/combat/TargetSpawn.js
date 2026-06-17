/**
 * Target spawn placement rules — Rust via game_core (WASM required).
 * JS still resolves foot Y, collider blocking, and floor holes.
 */

import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";
import { playerColliderToInput } from "@/lib/physics/CollisionCore.js";

/** @typedef {import("@/lib/game-core/types.ts").GameCoreEngine} GameCoreEngine */
/** @typedef {import("@/lib/game-core/types.ts").ArenaBounds} ArenaBounds */
/** @typedef {import("@/lib/game-core/types.ts").TargetOccupant} TargetOccupant */

const MAX_RANDOM_SPAWN_ATTEMPTS = 100;

function toFiniteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeArenaBounds(bounds) {
  return {
    minX: toFiniteOr(bounds?.minX, 0),
    maxX: toFiniteOr(bounds?.maxX, 0),
    minZ: toFiniteOr(bounds?.minZ, 0),
    maxZ: toFiniteOr(bounds?.maxZ, 0),
  };
}

function normalizeFloorHole(hole) {
  return {
    x: toFiniteOr(hole?.x, 0),
    z: toFiniteOr(hole?.z, 0),
    radius: toFiniteOr(hole?.radius, 0),
  };
}

function normalizeSpawnGroundSurface(surface) {
  return {
    minX: Number.isFinite(surface?.minX) ? surface.minX : null,
    maxX: Number.isFinite(surface?.maxX) ? surface.maxX : null,
    minZ: Number.isFinite(surface?.minZ) ? surface.minZ : null,
    maxZ: Number.isFinite(surface?.maxZ) ? surface.maxZ : null,
    y: Number.isFinite(surface?.y) ? surface.y : null,
    stairRamp: Boolean(surface?.stairRamp),
    stairFlight: Boolean(surface?.stairFlight),
  };
}

function normalizeTargetOccupant(target, skipTarget = null) {
  if (target?.position) {
    return {
      x: toFiniteOr(target.position.x, 0),
      z: toFiniteOr(target.position.z, 0),
      alive: (target.userData?.health ?? 0) > 0,
      visible: target.visible !== false,
      skip: target === skipTarget,
    };
  }
  return {
    x: toFiniteOr(target?.x, 0),
    z: toFiniteOr(target?.z, 0),
    alive: target?.alive !== false,
    visible: target?.visible !== false,
    skip: Boolean(target?.skip),
  };
}

/**
 * @param {THREE.Mesh[]} targets
 * @param {THREE.Mesh | null | undefined} skip
 * @returns {TargetOccupant[]}
 */
export function buildTargetOccupants(targets, skip = null) {
  const occupants = [];
  for (const mesh of targets) {
    occupants.push({
      x: mesh.position.x,
      z: mesh.position.z,
      alive: mesh.userData.health > 0,
      visible: mesh.visible !== false,
      skip: mesh === skip,
    });
  }
  return occupants;
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @param {number} margin
 * @param {THREE.Mesh[]} targets
 * @param {THREE.Mesh | null | undefined} skip
 */
export function overlapsTargets(gameCore, x, z, radius, margin, targets, skip) {
  return requireWasmMethod(gameCore, "overlapsTargets")(
    x,
    z,
    radius,
    margin,
    buildTargetOccupants(targets, skip),
  );
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {number} x
 * @param {number} z
 * @param {ArenaBounds} bounds
 * @param {number} radius
 * @param {number} margin
 */
export function positionInAuthoredBounds(gameCore, x, z, bounds, radius, margin) {
  return requireWasmMethod(gameCore, "positionInAuthoredBounds")(
    x,
    z,
    bounds,
    radius,
    margin,
  );
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {boolean} isRandom
 * @param {number} [chance=0.5]
 */
export function shouldSpawnAuthoredPoint(gameCore, isRandom, chance = 0.5) {
  if (!isRandom) return true;
  const roll = Math.random();
  return requireWasmMethod(gameCore, "shouldSpawnAuthoredPoint")(isRandom, roll, chance);
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {object} opts
 * @param {ArenaBounds} opts.bounds
 * @param {number} opts.radius
 * @param {number} opts.margin
 * @param {THREE.Mesh[]} opts.targets
 * @param {THREE.Mesh | null | undefined} [opts.skip]
 * @param {(x: number, z: number) => { x: number, z: number, y: number } | null} opts.validate
 */
export function pickRandomSpawnPositionCore(gameCore, opts) {
  const { bounds, radius, margin, targets, skip, validate } = opts;
  const pad = radius + margin;
  const minX = bounds.minX + pad;
  const maxX = bounds.maxX - pad;
  const minZ = bounds.minZ + pad;
  const maxZ = bounds.maxZ - pad;
  if (minX >= maxX || minZ >= maxZ) return null;

  for (let attempt = 0; attempt < MAX_RANDOM_SPAWN_ATTEMPTS; attempt += 1) {
    const x = minX + (maxX - minX) * Math.random();
    const z = minZ + (maxZ - minZ) * Math.random();
    if (overlapsTargets(gameCore, x, z, radius, margin, targets, skip)) continue;
    const pos = validate(x, z);
    if (pos) return pos;
  }
  return null;
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {object} opts
 * @param {ArenaBounds} opts.bounds
 * @param {number} opts.radius
 * @param {number} opts.margin
 * @param {THREE.Mesh[]} opts.targets
 * @param {THREE.Mesh | null | undefined} [opts.skip]
 */
export function pickRandomSpawnXz(gameCore, opts) {
  const { bounds, radius, margin, targets, skip } = opts;
  const pad = radius + margin;
  const minX = bounds.minX + pad;
  const maxX = bounds.maxX - pad;
  const minZ = bounds.minZ + pad;
  const maxZ = bounds.maxZ - pad;
  if (minX >= maxX || minZ >= maxZ) {
    return { found: false, x: 0, z: 0 };
  }

  for (let attempt = 0; attempt < MAX_RANDOM_SPAWN_ATTEMPTS; attempt += 1) {
    const x = minX + (maxX - minX) * Math.random();
    const z = minZ + (maxZ - minZ) * Math.random();
    if (overlapsTargets(gameCore, x, z, radius, margin, targets, skip)) continue;
    return { found: true, x, z };
  }
  return { found: false, x: 0, z: 0 };
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {object} input
 */
export function resolveTargetRespawnPlacementCore(gameCore, input) {
  const normalized = {
    ...input,
    bounds: normalizeArenaBounds(input.bounds),
    floorBounds: input.floorBounds ? normalizeArenaBounds(input.floorBounds) : null,
    floorHoles: (input.floorHoles ?? []).map(normalizeFloorHole),
    groundSurfaces: (input.groundSurfaces ?? [])
      .map(normalizeSpawnGroundSurface)
      .filter(Boolean),
    colliders: (input.colliders ?? [])
      .map(playerColliderToInput)
      .filter(Boolean),
    targets: (input.targets ?? []).map((target) =>
      normalizeTargetOccupant(target, input.skip),
    ),
  };
  return requireWasmMethod(gameCore, "resolveTargetRespawnPlacement")(normalized);
}
