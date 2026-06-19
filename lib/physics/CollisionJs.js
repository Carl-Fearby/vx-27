/**
 * Pure JS collision geometry for preview arcs and node probe scripts only.
 * Live gameplay uses WASM via CollisionCore.js.
 */

/** @param {object} box @param {number} x @param {number} z */
export function worldToBoxLocalJs(box, x, z) {
  const dx = x - box.x;
  const dz = z - box.z;
  const ry = box.rotationY ?? 0;
  if (Math.abs(ry) < 1e-12) return { x: dx, z: dz };
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return { x: c * dx - s * dz, z: s * dx + c * dz };
}

/** @param {object} box @param {number} x @param {number} z @param {number} radius */
export function rotatedBoxOverlapsCircleJs(box, x, z, radius) {
  const local = worldToBoxLocalJs(box, x, z);
  if (Math.abs(local.x) < box.halfX && Math.abs(local.z) < box.halfZ) {
    return true;
  }
  const closestX = Math.max(-box.halfX, Math.min(box.halfX, local.x));
  const closestZ = Math.max(-box.halfZ, Math.min(box.halfZ, local.z));
  const diffX = local.x - closestX;
  const diffZ = local.z - closestZ;
  const rSq = radius * radius;
  return diffX * diffX + diffZ * diffZ < rSq;
}

/** @param {object} box @param {number} x @param {number} z @param {number} [radius=0] */
export function pointInRoundedBoxFootprintJs(box, x, z, radius = 0) {
  const cornerR = Math.max(0, box.cornerRadius ?? 0);
  const local = worldToBoxLocalJs(box, x, z);
  if (cornerR <= 0) {
    return (
      Math.abs(local.x) <= box.halfX + radius &&
      Math.abs(local.z) <= box.halfZ + radius
    );
  }
  const innerX = Math.max(0, box.halfX - cornerR);
  const innerZ = Math.max(0, box.halfZ - cornerR);
  const ax = Math.abs(local.x);
  const az = Math.abs(local.z);
  if (ax <= innerX + radius && az <= innerZ + radius) {
    if (ax <= innerX || az <= innerZ) return true;
  }
  const cdx = Math.max(0, ax - innerX);
  const cdz = Math.max(0, az - innerZ);
  const r = cornerR + radius;
  return cdx * cdx + cdz * cdz <= r * r;
}

/** @param {Array<{ x: number, z: number, radius?: number }>} holes @param {number} [inset=0] */
export function pointInFloorHoleJs(x, z, holes, inset = 0) {
  for (const hole of holes ?? []) {
    const dx = x - hole.x;
    const dz = z - hole.z;
    const r = Math.max(0, (hole.radius ?? 0) - inset);
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

/**
 * Pure-JS equivalent of Rust resolve_box_collider.
 * Pushes a circle at (posX, posZ) with the given radius out of a single OBB.
 * @param {number} posX
 * @param {number} posZ
 * @param {number} radius
 * @param {{ x: number, z: number, halfX: number, halfZ: number, rotationY?: number }} box
 * @returns {{ x: number, z: number }}
 */
export function resolveBoxColliderJs(posX, posZ, radius, box) {
  const dx = posX - box.x;
  const dz = posZ - box.z;
  const ry = box.rotationY ?? 0;
  let localX, localZ;
  if (Math.abs(ry) < 1e-12) {
    localX = dx;
    localZ = dz;
  } else {
    const c = Math.cos(ry), s = Math.sin(ry);
    localX = c * dx - s * dz;
    localZ = s * dx + c * dz;
  }

  const hx = box.halfX, hz = box.halfZ;
  let pushX = 0, pushZ = 0;

  if (Math.abs(localX) < hx && Math.abs(localZ) < hz) {
    const pushLeft  = localX + hx + radius;
    const pushRight = hx - localX + radius;
    const pushBack  = localZ + hz + radius;
    const pushFwd   = hz - localZ + radius;
    const min = Math.min(pushLeft, pushRight, pushBack, pushFwd);
    if      (Math.abs(min - pushLeft)  < 1e-12) pushX = -pushLeft;
    else if (Math.abs(min - pushRight) < 1e-12) pushX = pushRight;
    else if (Math.abs(min - pushBack)  < 1e-12) pushZ = -pushBack;
    else                                         pushZ = pushFwd;
  } else {
    const closestX = Math.max(-hx, Math.min(hx, localX));
    const closestZ = Math.max(-hz, Math.min(hz, localZ));
    const diffX = localX - closestX;
    const diffZ = localZ - closestZ;
    const distSq = diffX * diffX + diffZ * diffZ;
    const rSq = radius * radius;
    if (distSq >= rSq || distSq < 1e-10) return { x: posX, z: posZ };
    const dist = Math.sqrt(distSq);
    const push = (radius - dist) / dist;
    pushX = diffX * push;
    pushZ = diffZ * push;
  }

  if (Math.abs(ry) >= 1e-12) {
    const c = Math.cos(ry), s = Math.sin(ry);
    return { x: posX + c * pushX + s * pushZ, z: posZ + (-s * pushX + c * pushZ) };
  }
  return { x: posX + pushX, z: posZ + pushZ };
}

/**
 * Pure-JS equivalent of Rust push_circle_out_of_colliders.
 * Used as fallback when gameCore is null (ragdoll probes, severed limbs).
 * Matches the simplified skip logic used for ragdoll context (no stair traversal).
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @param {Array} colliders
 * @param {{ footY?: number, bodyTop?: number, skipTargetMeshes?: boolean }} [opts]
 * @returns {{ x: number, z: number }}
 */
export function pushCircleOutOfCollidersJs(x, z, radius, colliders, opts = {}) {
  if (!colliders?.length) return { x, z };
  const { footY, bodyTop, skipTargetMeshes = true } = opts;
  const hasY = footY != null && bodyTop != null;
  let posX = x, posZ = z;
  for (const box of colliders) {
    if (!box.active) continue;
    if (skipTargetMeshes && box.skipTarget) continue;
    if (hasY) {
      const bY = box.bottomY ?? -Infinity;
      const tY = box.topY ?? Infinity;
      if (footY >= tY || bodyTop <= bY || bodyTop <= bY + 0.01) continue;
      if (footY >= tY - 0.05 && box.kind !== "stairSideInner" && box.kind !== "stairSideOuter") continue;
      if (box.kind === "deck") continue;
    }
    const res = resolveBoxColliderJs(posX, posZ, radius, box);
    posX = res.x;
    posZ = res.z;
  }
  return { x: posX, z: posZ };
}

/**
 * Pure-JS equivalent of Rust clamp_to_bounds.
 * @param {number} px
 * @param {number} pz
 * @param {number} radius
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number } | null | undefined} bounds
 * @returns {{ x: number, z: number }}
 */
export function clampToBoundsJs(px, pz, radius, bounds) {
  if (!bounds) return { x: px, z: pz };
  return {
    x: Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, px)),
    z: Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, pz)),
  };
}
