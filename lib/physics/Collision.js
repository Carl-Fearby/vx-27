import * as THREE from "three";
import {
  pointInRoundedBoxFootprint as pointInRoundedBoxFootprintCore,
  collectProjectileNearbyColliderIndicesCore,
  pushCircleOutOfCollidersCore,
  resolveBoxCollider as resolveBoxColliderCore,
  resolveProjectileAgainstCollidersCore,
  resolveSpawnFootYCore,
  resolvePlayerCollidersCore,
  computeResolvedWalkBoundsCore,
  rotatedBoxOverlapsCircle as rotatedBoxOverlapsCircleCore,
  spawnBlockedAtCore,
  pointInFloorHoleCore,
  worldToBoxLocal as worldToBoxLocalCore,
} from "./CollisionCore.js";
import {
  pointInFloorHoleJs,
  pointInRoundedBoxFootprintJs,
  rotatedBoxOverlapsCircleJs,
  worldToBoxLocalJs,
} from "./CollisionJs.js";
import { sampleStairRampFootYRaw } from "../stairs/StairRamp.js";

/** @typedef {{ x: number, z: number, halfX: number, halfZ: number, bottomY?: number, topY?: number, rotationY?: number, active?: boolean, kind?: string }} ColliderBox */

/**
 * @typedef {Object} SpawnFootYContext
 * @property {import("./GroundSupport.js").GroundSupportContext["groundSurfaces"]} [groundSurfaces]
 * @property {number} [floorY]
 * @property {Array<{ x: number, z: number, radius?: number }>} [floorHoles]
 * @property {{ minX: number, maxX: number, minZ: number, maxZ: number } | null} [floorBounds]
 */

/** Stair bulk volumes skipped on the catwalk — module constant (not per-call Set). */
const CATWALK_SKIP_STAIR_KINDS = {
  stairBack: 1,
  stairRearCurtain: 1,
  stairBackSlice: 1,
  stairUnderSoffit: 1,
  stairRearWall: 1,
};

/**
 * @param {ColliderBox[]} colliders
 * @param {Omit<ColliderBox, "active">} box
 */
export function pushCollider(colliders, box) {
  colliders.push({ ...box, active: true });
}

/**
 * @param {number} footY
 * @param {number} bodyTop
 * @param {ColliderBox} box
 */
export function verticalOverlap(footY, bodyTop, box) {
  const bottom = box.bottomY ?? -Infinity;
  const top = box.topY ?? Infinity;
  return footY < top && bodyTop > bottom;
}

/**
 * Generic skip rule used by every solid level box, including stair treads.
 * A box is treated as non-colliding only when:
 *   - the player is standing on top of it (foot at or above topY), or
 *   - the player's whole body is below it (bodyTop ≤ bottomY — hide under), or
 *   - the box is the current step-up target (supportY matches its top), or
 *   - the ledge top is within stepUpMax and the capsule clears it (curbs, rocks).
 *
 * Otherwise the box is solid and {@link resolveBoxCollider} pushes the player
 * back along the box's local axes.
 *
 * @param {ColliderBox} box
 * @param {number} footY
 * @param {number} bodyTop
 * @param {number} stepUpMax
 * @param {number} [supportY]
 * @param {{ localX: number, localZ: number } | null} [_stairLocal]
 * @param {number} [climbLocalMotion=0] +1 = moving up the flight (+localZ)
 * @param {number | null} [rampFootY=null] Continuous ramp height at the player
 * @param {boolean} [followingRamp=false] Player support is the stair ramp this frame
 */
export function shouldSkipCollider(
  box,
  footY,
  bodyTop,
  stepUpMax,
  supportY,
  stairLocal = null,
  climbLocalMotion = 0,
  rampFootY = null,
  followingRamp = false
) {
  if (box.bottomY == null && box.topY == null) return false;

  const bottomY = box.bottomY ?? -Infinity;
  const topY = box.topY ?? Infinity;

  if (!verticalOverlap(footY, bodyTop, box)) return true;
  if (bodyTop <= bottomY + 0.01) return true;
  if (
    footY >= topY - 0.05 &&
    box.kind !== "stairSideInner" &&
    box.kind !== "stairSideOuter"
  ) {
    return true;
  }

  // Ledge walk — feet on the stringer top cap, not inside the wall volume.
  if (box.kind === "stairSideTop" && footY >= bottomY - 0.08) {
    return true;
  }

  // On the catwalk deck, doorway lintels extend slightly above wall height and
  // would otherwise block walking along the north/south perimeter.
  if (
    box.kind === "wall" &&
    supportY != null &&
    supportY > 3.5 &&
    footY >= supportY - 0.2 &&
    isFinite(topY) &&
    footY >= topY - 0.8
  ) {
    return true;
  }

  // Ceiling / catwalk deck slabs are thin walk surfaces — support + headroom
  // only. Side push-out against them traps players when footY dips during a
  // fall or seam transition while the capsule is still over the deck footprint.
  if (box.kind === "deck" && isFinite(topY) && isFinite(bottomY)) {
    return true;
  }

  // Catwalk — skip under-tread / rear stair volumes, not side walls.
  if (
    footY >= 3.15 &&
    box.stairFlight &&
    box.kind != null &&
    CATWALK_SKIP_STAIR_KINDS[box.kind] &&
    isFinite(topY) &&
    topY > 2.5
  ) {
    return true;
  }

  if (stairLocal && box.stairFlight) {
    const halfW = box.stairFlight.walkHalfWidth ?? 1.75;
    const zMin = box.stairFlight.ramp?.zMin ?? -0.55;
    const runEnd = box.stairFlight.ramp?.runEnd ?? 5.4;
    const inWalkCorridor =
      Math.abs(stairLocal.localX) <= halfW + 0.06 &&
      stairLocal.localZ >= zMin - 0.06 &&
      stairLocal.localZ <= runEnd + 0.35;

    const onCenterPath = Math.abs(stairLocal.localX) <= halfW + 0.06;
    const onArenaFloor = footY <= 0.12;
    /** Descending off the flight, or stalled on arena floor at the front lip only. */
    const exitingBottom =
      onCenterPath &&
      footY <= 0.28 &&
      ((climbLocalMotion < -0.02 &&
        stairLocal.localZ <= 0.25 &&
        stairLocal.localZ >= -1.35) ||
        (climbLocalMotion <= 0.05 &&
          onArenaFloor &&
          stairLocal.localZ <= 0 &&
          stairLocal.localZ >= -0.25));

    const bulkheadApproachGap =
      climbLocalMotion > 0.25 &&
      stairLocal.localZ > -1.48 &&
      stairLocal.localZ < -1.28;
    const approachingLip =
      climbLocalMotion > 0.25 &&
      stairLocal.localZ > -0.65 &&
      stairLocal.localZ < 0.15;
    const leavingLip =
      exitingBottom ||
      (climbLocalMotion < -0.12 &&
        stairLocal.localZ <= 0.25 &&
        stairLocal.localZ >= -1.35);

    const onRampSurface =
      followingRamp ||
      (rampFootY != null && footY >= rampFootY - 0.22);
    const steppingOntoRamp =
      rampFootY != null &&
      footY >= rampFootY - 0.48 &&
      climbLocalMotion > 0.2;

    if (box.kind === "stairBack") {
      if (stairLocal.localZ >= -0.75) return true;
      if (exitingBottom) return true;
      if (bulkheadApproachGap) return true;
      if (climbLocalMotion > 0.25 && stairLocal.localZ < -0.5) return true;
      return false;
    }

    if (box.kind === "stairRearCurtain") {
      if (stairLocal.localZ >= -0.03) return true;
      if (approachingLip) return true;
      if (leavingLip) return true;
      if (onRampSurface) return true;
      if (exitingBottom) return true;
      return false;
    }

    if (box.kind === "stairBackSlice") {
      if (onRampSurface) return true;
      if (approachingLip) return true;
      if (leavingLip) return true;
      if (steppingOntoRamp) return true;
      if (exitingBottom) return true;
      return false;
    }

    if (box.kind === "stairUnderSoffit" || box.kind === "stairRearWall") {
      if (inWalkCorridor && onRampSurface) return true;
      const forwardZ = box.blockForwardLocalZ ?? -1.0;
      if (stairLocal.localZ >= forwardZ - 0.1) return true;
      return false;
    }
  }

  if (
    supportY != null &&
    isFinite(topY) &&
    Math.abs(supportY - topY) < 0.05 &&
    footY <= topY + 0.05 &&
    box.kind !== "stairSideInner" &&
    box.kind !== "stairSideOuter"
  ) {
    return true;
  }

  // Auto step-up — walk over curbs, rocks, stringer lips without jumping.
  if (
    isFinite(topY) &&
    footY < topY - 0.04 &&
    topY - footY <= stepUpMax + 0.06 &&
    bodyTop > topY + 0.02
  ) {
    return true;
  }

  return false;
}

/**
 * Project (x, z) into the box's local frame (taking rotationY into account).
 * Three.js Y-rotation: world = R(θ)·local where R(θ)·(x,z) = (c·x+s·z, −s·x+c·z).
 * To go world→local we apply the inverse R(−θ), i.e. (c·dx−s·dz, s·dx+c·dz).
 *
 * @param {ColliderBox} box
 * @param {number} x
 * @param {number} z
 * @returns {{ lx: number, lz: number }}
 */
export function worldToBoxLocal(box, x, z, gameCore = null) {
  const local = gameCore
    ? worldToBoxLocalCore(gameCore, box, x, z)
    : worldToBoxLocalJs(box, x, z);
  return { lx: local.x, lz: local.z };
}

/**
 * XZ footprint for a rounded box collider (flat faces inset by cornerRadius).
 * Use so square AABB corners do not block outside the visible mesh.
 *
 * @param {ColliderBox & { cornerRadius?: number }} box
 * @param {number} x
 * @param {number} z
 * @param {number} [radius=0] Expand footprint (player capsule radius).
 */
export function pointInRoundedBoxFootprint(box, x, z, radius = 0, gameCore = null) {
  if (!gameCore) return pointInRoundedBoxFootprintJs(box, x, z, radius);
  return pointInRoundedBoxFootprintCore(gameCore, box, x, z, radius);
}

/**
 * True if a circle of `radius` at world (x, z) overlaps the box's XZ footprint
 * (rotation-aware). Use when only intersection — not push-out — is needed.
 *
 * @param {ColliderBox} box
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 */
export function rotatedBoxOverlapsCircle(box, x, z, radius, gameCore = null) {
  if (!gameCore) return rotatedBoxOverlapsCircleJs(box, x, z, radius);
  return rotatedBoxOverlapsCircleCore(gameCore, box, x, z, radius);
}

/**
 * @param {{ x: number, z: number }} position
 * @param {number} radius
 * @param {ColliderBox} box
 */
export function resolveBoxCollider(position, radius, box, gameCore = null) {
  resolveBoxColliderCore(position, radius, box, gameCore);
}

/** @param {ColliderBox} box @returns {number | null} Walkable top surface for projectiles */
export function colliderProjectileFloorTop(box) {
  if (box.active === false) return null;
  if (box.containerPart === "floor") return box.topY ?? null;
  if (box.kind === "deck") return box.topY ?? null;
  return null;
}

/** @param {ColliderBox} box @returns {number | null} Underside for upward projectile hits */
export function colliderProjectileCeilBottom(box) {
  if (box.active === false) return null;
  if (box.containerPart === "roof") return box.bottomY ?? null;
  if (box.kind === "deck") return box.bottomY ?? null;
  return null;
}

/**
 * @param {ColliderBox} box
 * @param {number} lx
 * @param {number} lz
 * @returns {{ x: number, z: number }}
 */
function boxLocalOffsetToWorld(box, lx, lz) {
  if (!box.rotationY) return { x: lx, z: lz };
  const c = Math.cos(box.rotationY);
  const s = Math.sin(box.rotationY);
  return { x: c * lx + s * lz, z: -s * lx + c * lz };
}

/**
 * @param {ColliderBox} box
 * @param {number} lx
 * @param {number} lz
 * @returns {{ x: number, z: number }}
 */
function boxLocalPointToWorld(box, lx, lz) {
  const off = boxLocalOffsetToWorld(box, lx, lz);
  return { x: box.x + off.x, z: box.z + off.z };
}

/**
 * @param {{ x: number, y: number, z: number }} position
 * @param {number} radius
 * @param {{ x: number, y: number, z: number }} vel
 * @param {ColliderBox} box
 * @param {number} rest
 * @param {number} friction
 * @returns {boolean}
 */
function resolveSphereAgainstOneBox(position, radius, vel, box, rest, friction) {
  const bottom = box.bottomY ?? -Infinity;
  const top = box.topY ?? Infinity;
  const py = position.y;

  if (py + radius < bottom - 0.001 || py - radius > top + 0.001) return false;
  if (!rotatedBoxOverlapsCircle(box, position.x, position.z, radius)) return false;

  const { lx, lz } = worldToBoxLocal(box, position.x, position.z);
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let resolved = false;

  if (Math.abs(lx) <= box.halfX && Math.abs(lz) <= box.halfZ && py >= bottom && py <= top) {
    const pushNegX = lx + box.halfX + radius;
    const pushPosX = box.halfX - lx + radius;
    const pushNegZ = lz + box.halfZ + radius;
    const pushPosZ = box.halfZ - lz + radius;
    const pushDown = py - bottom + radius;
    const pushUp = top - py + radius;
    const min = Math.min(pushNegX, pushPosX, pushNegZ, pushPosZ, pushDown, pushUp);

    if (min === pushDown) {
      position.y -= pushDown;
      nx = 0;
      ny = -1;
      nz = 0;
      resolved = true;
    } else if (min === pushUp) {
      position.y += pushUp;
      nx = 0;
      ny = 1;
      nz = 0;
      resolved = true;
    } else if (min === pushNegX) {
      const w = boxLocalOffsetToWorld(box, -pushNegX, 0);
      position.x += w.x;
      position.z += w.z;
      const wn = boxLocalOffsetToWorld(box, -1, 0);
      const len = Math.hypot(wn.x, wn.z) || 1;
      nx = wn.x / len;
      nz = wn.z / len;
      resolved = true;
    } else if (min === pushPosX) {
      const w = boxLocalOffsetToWorld(box, pushPosX, 0);
      position.x += w.x;
      position.z += w.z;
      const wn = boxLocalOffsetToWorld(box, 1, 0);
      const len = Math.hypot(wn.x, wn.z) || 1;
      nx = wn.x / len;
      nz = wn.z / len;
      resolved = true;
    } else if (min === pushNegZ) {
      const w = boxLocalOffsetToWorld(box, 0, -pushNegZ);
      position.x += w.x;
      position.z += w.z;
      const wn = boxLocalOffsetToWorld(box, 0, -1);
      const len = Math.hypot(wn.x, wn.z) || 1;
      nx = wn.x / len;
      nz = wn.z / len;
      resolved = true;
    } else {
      const w = boxLocalOffsetToWorld(box, 0, pushPosZ);
      position.x += w.x;
      position.z += w.z;
      const wn = boxLocalOffsetToWorld(box, 0, 1);
      const len = Math.hypot(wn.x, wn.z) || 1;
      nx = wn.x / len;
      nz = wn.z / len;
      resolved = true;
    }
  } else {
    const clampLx = Math.max(-box.halfX, Math.min(box.halfX, lx));
    const clampLz = Math.max(-box.halfZ, Math.min(box.halfZ, lz));
    const clampY = Math.max(bottom, Math.min(top, py));
    const closest = boxLocalPointToWorld(box, clampLx, clampLz);
    const wx = position.x - closest.x;
    const wy = py - clampY;
    const wz = position.z - closest.z;
    const distSq = wx * wx + wy * wy + wz * wz;
    if (distSq >= radius * radius) return false;

    if (distSq < 1e-12) return false;

    const dist = Math.sqrt(distSq);
    const pen = radius - dist;
    nx = wx / dist;
    ny = wy / dist;
    nz = wz / dist;
    position.x += nx * pen;
    position.y += ny * pen;
    position.z += nz * pen;
    resolved = true;
  }

  if (!resolved) return false;

  const vDotN = vel.x * nx + vel.y * ny + vel.z * nz;
  if (vDotN < 0) {
    vel.x -= (1 + rest) * vDotN * nx;
    vel.y -= (1 + rest) * vDotN * ny;
    vel.z -= (1 + rest) * vDotN * nz;
    const damp = Math.max(0, 1 - friction * 0.45);
    vel.x *= damp;
    vel.y *= damp;
    vel.z *= damp;
  }
  return true;
}

/**
 * Highest walkable collider top at (x, z) that is at or below refY.
 * @param {number} x
 * @param {number} z
 * @param {number} refY
 * @param {ColliderBox[]} colliders
 * @param {number} [radius=0]
 */
export function sampleColliderFloorTopAt(x, z, refY, colliders, radius = 0) {
  let best = Number.NEGATIVE_INFINITY;
  for (const box of colliders ?? []) {
    const top = colliderProjectileFloorTop(box);
    if (top == null || top > refY + 0.12) continue;
    if (!pointInRoundedBoxFootprint(box, x, z, radius)) continue;
    best = Math.max(best, top);
  }
  return Number.isFinite(best) ? best : null;
}

/** Horizontal walk slabs (catwalk deck, container floor) — top/bottom only, no side trap. */
function isProjectileWalkSlab(box) {
  return box.kind === "deck" || box.containerPart === "floor";
}

/**
 * @param {{ x: number, y: number, z: number }} position
 * @param {number} radius
 * @param {{ x: number, y: number, z: number }} vel
 * @param {ColliderBox} box
 * @param {number} rest
 * @param {number} friction
 * @returns {boolean}
 */
function resolveSphereAgainstWalkSlab(position, radius, vel, box, rest, friction) {
  const bottom = box.bottomY;
  const top = box.topY;
  if (bottom == null || top == null || !isFinite(bottom) || !isFinite(top)) {
    return false;
  }
  if (!rotatedBoxOverlapsCircle(box, position.x, position.z, radius)) return false;

  const py = position.y;
  const damp = Math.max(0, 1 - friction * 0.45);

  // Top face — snap onto walk surface; bounce handled via sampleSupportY / floor snap.
  if (vel.y <= 0.08 && py + radius >= top - 0.02) {
    const pen = top + radius - py;
    if (pen > 0.001) {
      position.y = top + radius;
      return true;
    }
  }

  // Underside — rising hit from below.
  if (vel.y > 0 && py - radius <= bottom + 0.02) {
    const pen = py + radius - bottom;
    if (pen > 0.001) {
      position.y = bottom - radius;
      vel.y = -vel.y * rest;
      vel.x *= damp;
      vel.z *= damp;
      return true;
    }
  }

  return false;
}

/**
 * Cheap reject before full sphere-vs-box resolution.
 * @param {ColliderBox} box
 * @param {number} px
 * @param {number} py
 * @param {number} pz
 * @param {number} radius
 * @param {number} [margin=0.2]
 */
export function colliderOverlapsProjectileSphere(box, px, py, pz, radius, margin = 0.2) {
  if (box.active === false) return false;
  const reach = radius + margin;
  const bottom = box.bottomY ?? -Infinity;
  const top = box.topY ?? Infinity;
  if (py + reach < bottom || py - reach > top) return false;
  return rotatedBoxOverlapsCircle(box, px, pz, reach);
}

/**
 * Fill `out` with colliders that may touch a projectile this frame.
 * @param {number} px
 * @param {number} py
 * @param {number} pz
 * @param {number} radius
 * @param {ColliderBox[]} colliders
 * @param {ColliderBox[]} out
 * @param {number} [margin=0.35]
 * @param {import("@/lib/game-core/types.ts").GameCoreEngine | null} [gameCore=null]
 * @returns {ColliderBox[]}
 */
export function collectProjectileNearbyColliders(
  px,
  py,
  pz,
  radius,
  colliders,
  out,
  margin = 0.35,
  gameCore = null,
) {
  out.length = 0;
  if (!colliders?.length) return out;

  if (!gameCore) {
    for (const box of colliders) {
      if (colliderOverlapsProjectileSphere(box, px, py, pz, radius, margin)) {
        out.push(box);
      }
    }
    return out;
  }

  const indices = collectProjectileNearbyColliderIndicesCore(
    gameCore,
    px,
    py,
    pz,
    radius,
    colliders,
    margin,
  );
  for (const i of indices) out.push(colliders[i]);
  return out;
}

/**
 * Bounce a spherical projectile off solid box colliders (walls, roof, ceiling).
 * Resolves all faces (top/bottom/sides) so exterior shell hits work from outside.
 * Floor landings are handled separately via {@link sampleColliderFloorTopAt}.
 * @param {{ x: number, y: number, z: number }} position
 * @param {number} radius
 * @param {{ x: number, y: number, z: number }} vel
 * @param {ColliderBox[]} colliders
 * @param {{ restitution?: number, friction?: number, passes?: number, gameCore?: import("@/lib/game-core/types.ts").GameCoreEngine | null }} [opts]
 */
export function resolveProjectileAgainstColliders(position, radius, vel, colliders, opts = {}) {
  if (!colliders?.length) return;
  const rest = opts.restitution ?? 0.69;
  const friction = opts.friction ?? 0.74;
  const passes = opts.passes ?? 1;

  if (!opts.gameCore) {
    for (let pass = 0; pass < passes; pass += 1) {
      for (const box of colliders) {
        if (box.active === false || box.targetMesh) continue;
        if (isProjectileWalkSlab(box)) {
          resolveSphereAgainstWalkSlab(position, radius, vel, box, rest, friction);
        } else {
          resolveSphereAgainstOneBox(position, radius, vel, box, rest, friction);
        }
      }
    }
    return;
  }

  resolveProjectileAgainstCollidersCore(
    opts.gameCore,
    position,
    vel,
    radius,
    colliders,
    { restitution: rest, friction, passes },
  );
}

/**
 * Push a circle out of solid colliders (rotation-aware). Skips boxes the body
 * is standing on / above when footY and bodyTop are supplied.
 *
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @param {ColliderBox[]} colliders
 * @param {{ footY?: number, bodyTop?: number, skipTargetMeshes?: boolean }} [opts]
 * @returns {{ x: number, z: number }}
 */
export function pushCircleOutOfColliders(x, z, radius, colliders, opts = {}) {
  return pushCircleOutOfCollidersCore(opts.gameCore, {
    x,
    z,
    radius,
    colliders,
    footY: opts.footY,
    bodyTop: opts.bodyTop,
    skipTargetMeshes: opts.skipTargetMeshes !== false,
  });
}

/**
 * True when a body at (x, z) with the given vertical span intersects solid
 * collider volume (same rules as the player — stair tread faces block spawns).
 *
 * @param {number} x
 * @param {number} z
 * @param {number} footY
 * @param {number} bodyTop
 * @param {number} radius
 * @param {ColliderBox[]} colliders
 */
export function spawnBlockedAt(x, z, footY, bodyTop, radius, colliders, gameCore) {
  return spawnBlockedAtCore(gameCore, {
    x,
    z,
    footY,
    bodyTop,
    radius,
    colliders,
  });
}

const SPAWN_FOOTPRINT_INSET = 0.85;
const SPAWN_FOOTPRINT_MAX_DELTA = 0.06;
const _spawnScratch = new THREE.Vector3();

const STAIR_STEP_COLLIDER_KINDS = {
  stairBackSlice: 1,
  stairTread: 1,
};

/** @param {number} x @param {number} z @param {number} radius */
function spawnFootprintSamples(x, z, radius) {
  const r = radius * SPAWN_FOOTPRINT_INSET;
  return [
    [x, z],
    [x + r, z],
    [x - r, z],
    [x, z + r],
    [x, z - r],
  ];
}

/**
 * @param {number} sx
 * @param {number} sz
 * @param {SpawnFootYContext["groundSurfaces"]} groundSurfaces
 */
function pointInStairFootprint(sx, sz, groundSurfaces) {
  for (const surf of groundSurfaces) {
    if (!surf.stairRamp || !surf.stairFlight) continue;
    if (
      sampleStairRampFootYRaw(surf.stairFlight, sx, sz, _spawnScratch) != null
    ) {
      return true;
    }
  }
  return false;
}

/** @param {number} sx @param {number} sz @param {ColliderBox[]} colliders */
function stairStepTopAt(sx, sz, colliders) {
  let best = null;
  for (const box of colliders) {
    if (box.active === false || box.topY == null) continue;
    if (box.kind === "stairSideTop") {
      if (!rotatedBoxOverlapsCircle(box, sx, sz, 0.05)) continue;
      best = best == null ? box.topY : Math.max(best, box.topY);
      continue;
    }
    if (!STAIR_STEP_COLLIDER_KINDS[box.kind]) continue;
    if (!rotatedBoxOverlapsCircle(box, sx, sz, 0.05)) continue;
    best = best == null ? box.topY : Math.max(best, box.topY);
  }
  return best;
}

/**
 * @param {number} sx
 * @param {number} sz
 * @param {ColliderBox[]} colliders
 * @param {SpawnFootYContext} ctx
 * @returns {number | null}
 */
function sampleSpawnSupportYAt(sx, sz, colliders, ctx) {
  const groundSurfaces = ctx.groundSurfaces ?? [];
  if (pointInStairFootprint(sx, sz, groundSurfaces)) {
    return stairStepTopAt(sx, sz, colliders);
  }

  const floorY = ctx.floorY ?? 0;
  const floorBounds = ctx.floorBounds ?? null;
  const floorHoles = ctx.floorHoles ?? [];
  const inFloorBounds =
    !floorBounds ||
    (sx >= floorBounds.minX &&
      sx <= floorBounds.maxX &&
      sz >= floorBounds.minZ &&
      sz <= floorBounds.maxZ);
  const onImplicitFloor =
    inFloorBounds && !pointInFloorHole(sx, sz, floorHoles, 0);

  let best = Number.NEGATIVE_INFINITY;
  for (const surf of groundSurfaces) {
    if (surf.stairRamp || surf.stairFlight) continue;
    if (surf.minX == null || surf.maxX == null) continue;
    if (
      sx < surf.minX ||
      sx > surf.maxX ||
      sz < surf.minZ ||
      sz > surf.maxZ
    ) {
      continue;
    }
    if (
      surf.y <= floorY + 0.02 &&
      pointInFloorHole(sx, sz, floorHoles, 0)
    ) {
      continue;
    }
    best = Math.max(best, surf.y);
  }
  if (onImplicitFloor) {
    best = Math.max(best, floorY);
  }
  return Number.isFinite(best) ? best : null;
}

/**
 * @param {import("./GroundSupport.js").GroundSupportContext & {
 *   groundSurfaces?: SpawnFootYContext["groundSurfaces"],
 *   floorY?: number,
 *   floorHoles?: SpawnFootYContext["floorHoles"],
 *   floorBounds?: SpawnFootYContext["floorBounds"],
 * }} level
 * @returns {SpawnFootYContext}
 */
export function spawnFootYContextFromLevel(level) {
  return {
    groundSurfaces: level.groundSurfaces ?? [],
    floorY: level.floorY ?? 0,
    floorHoles: level.floorHoles ?? [],
    floorBounds: level.floorBounds ?? null,
  };
}

/**
 * Walkable foot Y for enemy spawns — matches player decks, floor, and stair steps.
 *
 * @param {number} x
 * @param {number} z
 * @param {number} height
 * @param {number} radius
 * @param {ColliderBox[]} colliders
 * @param {SpawnFootYContext} [spawnCtx]
 * @returns {number | null}
 */
export function resolveSpawnFootY(x, z, height, radius, colliders, spawnCtx = {}, gameCore) {
  const ctx = {
    groundSurfaces: spawnCtx.groundSurfaces ?? [],
    floorY: spawnCtx.floorY ?? 0,
    floorHoles: spawnCtx.floorHoles ?? [],
    floorBounds: spawnCtx.floorBounds ?? null,
  };

  const footprintSamples = spawnFootprintSamples(x, z, radius).map(([sx, sz]) => ({
    sx,
    sz,
    inStairFootprint: pointInStairFootprint(sx, sz, ctx.groundSurfaces),
  }));
  const rust = resolveSpawnFootYCore(gameCore, {
    x,
    z,
    height,
    radius,
    floorY: ctx.floorY,
    floorBounds: ctx.floorBounds,
    floorHoles: ctx.floorHoles,
    groundSurfaces: ctx.groundSurfaces,
    colliders,
    footprintSamples,
  });
  return rust.found ? rust.footY : null;
}

/** Gravity while an entity falls through a floor hole (matches player / ragdoll). */
export const HOLE_FALL_GRAVITY = 20;
/** World units below floorY before the entity is removed. */
export const HOLE_FALL_REMOVE_DEPTH = 12;

/**
 * @param {number} x
 * @param {number} z
 * @param {{ x: number, z: number, radius?: number }[]} [floorHoles]
 * @param {number} [inset=0] Shrink hole radius — use entity radius so the body must overlap the hole.
 */
export function pointInFloorHole(x, z, floorHoles, inset = 0, gameCore = null) {
  if (!gameCore) return pointInFloorHoleJs(x, z, floorHoles, inset);
  return pointInFloorHoleCore(gameCore, x, z, floorHoles, inset);
}

/** @param {object} input @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function resolvePlayerColliders(input, gameCore) {
  return resolvePlayerCollidersCore(gameCore, input);
}

/** @param {object} input @param {import("@/lib/game-core/types.ts").GameCoreEngine} gameCore */
export function computeResolvedWalkBounds(input, gameCore) {
  return computeResolvedWalkBoundsCore(gameCore, input);
}

/**
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }[]} cutouts
 * @param {number} [inset=0]
 */
/** @param {{ minX: number, maxX: number, minZ: number, maxZ: number }[]} passages */
export function pointInDoorwayPassage(x, z, passages) {
  if (!passages?.length) return false;
  for (const p of passages) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) return true;
  }
  return false;
}

export function pointInRectFloorCutout(x, z, cutouts, inset = 0) {
  if (!cutouts?.length) return false;
  for (const r of cutouts) {
    if (
      x >= r.minX + inset &&
      x <= r.maxX - inset &&
      z >= r.minZ + inset &&
      z <= r.maxZ - inset
    ) {
      return true;
    }
  }
  return false;
}

/** @param {{ fallingThroughHole?: boolean, holeFallVelY?: number, settled?: boolean }} entity */
export function beginHoleFall(entity, velY = -2) {
  entity.fallingThroughHole = true;
  entity.holeFallVelY = velY;
  if ("settled" in entity) entity.settled = false;
}

/**
 * @param {{ fallingThroughHole?: boolean, holeFallVelY?: number }} entity
 * @param {number} y
 * @param {number} floorY
 * @param {number} dt
 * @returns {{ nextY: number, remove: boolean }}
 */
export function tickHoleFallY(entity, y, floorY, dt) {
  if (!entity.fallingThroughHole) return { nextY: y, remove: false };
  entity.holeFallVelY = (entity.holeFallVelY ?? -2) - HOLE_FALL_GRAVITY * dt;
  const nextY = y + entity.holeFallVelY * dt;
  return { nextY, remove: nextY < floorY - HOLE_FALL_REMOVE_DEPTH };
}

/**
 * @param {{ fallingThroughHole?: boolean, holeFallVelY?: number, settled?: boolean }} entity
 * @returns {{ y: number, remove: boolean, falling: boolean }}
 */
export function updateEntityForFloorHole(
  entity,
  x,
  z,
  y,
  floorY,
  dt,
  floorHoles,
  inset = 0,
  gameCore,
) {
  if (!floorHoles?.length) {
    return { y, remove: false, falling: !!entity.fallingThroughHole };
  }
  if (!entity.fallingThroughHole && pointInFloorHole(x, z, floorHoles, inset, gameCore)) {
    beginHoleFall(entity);
  }
  if (!entity.fallingThroughHole) return { y, remove: false, falling: false };
  const result = tickHoleFallY(entity, y, floorY, dt);
  return { y: result.nextY, remove: result.remove, falling: true };
}
