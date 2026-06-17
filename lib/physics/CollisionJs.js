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
