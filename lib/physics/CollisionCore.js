/**
 * Box/circle collision geometry — Rust via game_core (WASM required).
 */

/** @typedef {import("@/lib/game-core/types.ts").GameCoreEngine} GameCoreEngine */
/** @typedef {import("@/lib/game-core/types.ts").ColliderBoxInput} ColliderBoxInput */
/** @typedef {import("@/lib/game-core/types.ts").ProjectileColliderInput} ProjectileColliderInput */

import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";

/**
 * @param {object} box
 * @returns {ColliderBoxInput}
 */
export function colliderToInput(box) {
  return {
    x: box.x,
    z: box.z,
    halfX: box.halfX,
    halfZ: box.halfZ,
    rotationY: box.rotationY ?? 0,
    cornerRadius: box.cornerRadius ?? 0,
  };
}

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 * @param {object} box
 * @param {number} x
 * @param {number} z
 */
export function worldToBoxLocal(gameCore, box, x, z) {
  return requireWasmMethod(gameCore, "worldToBoxLocal")(colliderToInput(box), x, z);
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {object} box
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 */
export function rotatedBoxOverlapsCircle(gameCore, box, x, z, radius) {
  return requireWasmMethod(gameCore, "rotatedBoxOverlapsCircle")(
    colliderToInput(box),
    x,
    z,
    radius,
  );
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {object} box
 * @param {number} x
 * @param {number} z
 * @param {number} [radius=0]
 */
export function pointInRoundedBoxFootprint(gameCore, box, x, z, radius = 0) {
  return requireWasmMethod(gameCore, "pointInRoundedBoxFootprint")(
    colliderToInput(box),
    x,
    z,
    radius,
  );
}

/**
 * @param {{ x: number, z: number }} position
 * @param {number} radius
 * @param {object} box
 * @param {GameCoreEngine} gameCore
 */
export function resolveBoxCollider(position, radius, box, gameCore) {
  const result = requireWasmMethod(gameCore, "resolveBoxCollider")(
    position.x,
    position.z,
    radius,
    colliderToInput(box),
  );
  position.x = result.x;
  position.z = result.z;
}

/**
 * @param {object} box
 * @returns {ProjectileColliderInput}
 */
export function projectileColliderToInput(box) {
  return {
    x: box.x,
    z: box.z,
    halfX: box.halfX,
    halfZ: box.halfZ,
    rotationY: box.rotationY ?? 0,
    cornerRadius: box.cornerRadius ?? 0,
    bottomY: box.bottomY,
    topY: box.topY,
    active: box.active !== false,
    skipTarget: Boolean(box.targetMesh),
    kind: box.kind,
    containerPart: box.containerPart,
  };
}

/**
 * @param {object} surf
 * @returns {import("@/lib/game-core/types.ts").GroundSurfaceInput | null}
 */
export function groundSurfaceToInput(surf) {
  if (!Number.isFinite(surf.y)) return null;
  return {
    minX: surf.minX,
    maxX: surf.maxX,
    minZ: surf.minZ,
    maxZ: surf.maxZ,
    y: surf.y,
    stairRamp: Boolean(surf.stairRamp),
    stairFlight: Boolean(surf.stairFlight),
  };
}

/**
 * @param {object} box
 * @returns {import("@/lib/game-core/types.ts").PlayerColliderInput | null}
 */
export function playerColliderToInput(box) {
  if (
    !Number.isFinite(box.x) ||
    !Number.isFinite(box.z) ||
    !Number.isFinite(box.halfX) ||
    !Number.isFinite(box.halfZ)
  ) {
    return null;
  }
  const stairFlight = box.stairFlight
    ? {
        walkHalfWidth: box.stairFlight.walkHalfWidth ?? 1.75,
        ramp: box.stairFlight.ramp
          ? {
              zMin: box.stairFlight.ramp.zMin ?? -0.55,
              runEnd: box.stairFlight.ramp.runEnd ?? 5.4,
            }
          : undefined,
      }
    : undefined;
  return {
    x: box.x,
    z: box.z,
    halfX: box.halfX,
    halfZ: box.halfZ,
    rotationY: box.rotationY ?? 0,
    cornerRadius: box.cornerRadius ?? 0,
    bottomY: box.bottomY,
    topY: box.topY,
    active: box.active !== false,
    skipTarget: Boolean(box.targetMesh),
    kind: box.kind,
    blockForwardLocalZ: box.blockForwardLocalZ,
    stairFlight,
  };
}

function mapPlayerColliders(colliders) {
  const out = [];
  for (const box of colliders) {
    const mapped = playerColliderToInput(box);
    if (mapped) out.push(mapped);
  }
  return out;
}

function mapGroundSurfaces(surfaces) {
  const out = [];
  for (const surf of surfaces ?? []) {
    const mapped = groundSurfaceToInput(surf);
    if (mapped) out.push(mapped);
  }
  return out;
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {object} input
 */
export function spawnBlockedAtCore(gameCore, input) {
  return requireWasmMethod(gameCore, "spawnBlockedAt")({
    ...input,
    colliders: mapPlayerColliders(input.colliders),
  });
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {object} input
 */
export function pushCircleOutOfCollidersCore(gameCore, input) {
  return requireWasmMethod(gameCore, "pushCircleOutOfColliders")({
    ...input,
    colliders: mapPlayerColliders(input.colliders),
  });
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {number} x
 * @param {number} z
 * @param {Array<{ x: number, z: number, radius?: number }>} holes
 * @param {number} [inset=0]
 */
export function pointInFloorHoleCore(gameCore, x, z, holes, inset = 0) {
  const safeHoles = (holes ?? [])
    .filter((h) => Number.isFinite(h?.x) && Number.isFinite(h?.z))
    .map((h) => ({
      x: h.x,
      z: h.z,
      radius: Number.isFinite(h.radius) ? h.radius : 0,
    }));
  return requireWasmMethod(gameCore, "pointInFloorHole")(x, z, safeHoles, inset);
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {object} input
 */
export function resolveSpawnFootYCore(gameCore, input) {
  return requireWasmMethod(gameCore, "resolveSpawnFootY")({
    ...input,
    colliders: mapPlayerColliders(input.colliders),
    groundSurfaces: mapGroundSurfaces(input.groundSurfaces),
  });
}

/** @param {object | null | undefined} rect */
function rectBoundsToInput(rect) {
  if (!rect) return null;
  return {
    minX: rect.minX,
    maxX: rect.maxX,
    minZ: rect.minZ,
    maxZ: rect.maxZ,
  };
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {object} input
 */
export function resolvePlayerCollidersCore(gameCore, input) {
  const entries = [];
  for (const entry of input.entries ?? []) {
    const collider = playerColliderToInput(entry.collider);
    if (!collider) continue;
    entries.push({
      collider,
      stairLocal: entry.stairLocal ?? undefined,
      climbLocalMotion: entry.climbLocalMotion ?? 0,
    });
  }
  return requireWasmMethod(gameCore, "resolvePlayerColliders")({
    ...input,
    entries,
  });
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {object} input
 */
export function computeResolvedWalkBoundsCore(gameCore, input) {
  return requireWasmMethod(gameCore, "computeResolvedWalkBounds")({
    ...input,
    bounds: rectBoundsToInput(input.bounds),
    arenaBounds: rectBoundsToInput(input.arenaBounds),
    extensionFp: rectBoundsToInput(input.extensionFp),
    catwalkBounds: rectBoundsToInput(input.catwalkBounds),
  });
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {{ x: number, y: number, z: number }} position
 * @param {{ x: number, y: number, z: number }} vel
 * @param {number} radius
 * @param {object[]} colliders
 * @param {{ restitution?: number, friction?: number, passes?: number }} [opts]
 */
export function resolveProjectileAgainstCollidersCore(
  gameCore,
  position,
  vel,
  radius,
  colliders,
  opts = {},
) {
  const result = requireWasmMethod(gameCore, "resolveProjectileAgainstColliders")({
    pos: { x: position.x, y: position.y, z: position.z },
    vel: { x: vel.x, y: vel.y, z: vel.z },
    radius,
    colliders: colliders.map(projectileColliderToInput),
    restitution: opts.restitution ?? 0.69,
    friction: opts.friction ?? 0.74,
    passes: opts.passes ?? 1,
  });
  position.x = result.pos.x;
  position.y = result.pos.y;
  position.z = result.pos.z;
  vel.x = result.vel.x;
  vel.y = result.vel.y;
  vel.z = result.vel.z;
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {number} px
 * @param {number} py
 * @param {number} pz
 * @param {number} radius
 * @param {object[]} colliders
 * @param {number} [margin=0.35]
 * @returns {number[]}
 */
export function collectProjectileNearbyColliderIndicesCore(
  gameCore,
  px,
  py,
  pz,
  radius,
  colliders,
  margin = 0.35,
) {
  return requireWasmMethod(gameCore, "collectProjectileNearbyColliderIndices")({
    px,
    py,
    pz,
    radius,
    margin,
    colliders: colliders.map(projectileColliderToInput),
  });
}
