/**
 * Target spawn placement rules — Rust via game_core (WASM required).
 * JS still resolves foot Y, collider blocking, and floor holes.
 */

import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";
import { playerColliderToInput } from "@/lib/physics/CollisionCore.js";

/** @typedef {import("@/lib/game-core/types.ts").GameCoreEngine} GameCoreEngine */
/** @typedef {import("@/lib/game-core/types.ts").ArenaBounds} ArenaBounds */
/** @typedef {import("@/lib/game-core/types.ts").TargetOccupant} TargetOccupant */

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
