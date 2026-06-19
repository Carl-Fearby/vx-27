import { isDeckRainOccluder } from "@/lib/Rain.js";

/** Max horizontal rain-blocker slabs used for player under-canopy detection. */
export const MAX_RAIN_CANOPY_SLABS = 24;
/** Extra headroom for interior-floor dry zones in the wetness shader. */
export const MAX_RAIN_WET_BLOCKERS = MAX_RAIN_CANOPY_SLABS + 12;

/** @typedef {{ minX: number, maxX: number, minZ: number, maxZ: number, y: number, x?: number, z?: number, halfX?: number, halfZ?: number, rotationY?: number }} RainCanopySlab */

/**
 * @param {number} wx
 * @param {number} wz
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number, x?: number, z?: number, halfX?: number, halfZ?: number, rotationY?: number }} slab
 */
function inSlabFootprint(wx, wz, slab) {
  if (slab.halfX != null && slab.x != null && slab.z != null) {
    const dx = wx - slab.x;
    const dz = wz - slab.z;
    if (slab.rotationY) {
      const c = Math.cos(-slab.rotationY);
      const s = Math.sin(-slab.rotationY);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      return Math.abs(lx) <= slab.halfX + 0.02 && Math.abs(lz) <= slab.halfZ + 0.02;
    }
    return Math.abs(dx) <= slab.halfX + 0.02 && Math.abs(dz) <= slab.halfZ + 0.02;
  }
  return wx >= slab.minX && wx <= slab.maxX && wz >= slab.minZ && wz <= slab.maxZ;
}

/**
 * Oriented horizontal footprint for shader wetness masking.
 * @param {RainCanopySlab | { minX: number, maxX: number, minZ: number, maxZ: number, x?: number, z?: number, halfX?: number, halfZ?: number, rotationY?: number }} slab
 */
export function slabToRainWetObb(slab) {
  if (slab.halfX != null && slab.x != null && slab.z != null) {
    return {
      x: slab.x,
      z: slab.z,
      halfX: slab.halfX,
      halfZ: slab.halfZ,
      rotY: slab.rotationY ?? 0,
    };
  }
  return {
    x: (slab.minX + slab.maxX) * 0.5,
    z: (slab.minZ + slab.maxZ) * 0.5,
    halfX: (slab.maxX - slab.minX) * 0.5,
    halfZ: (slab.maxZ - slab.minZ) * 0.5,
    rotY: 0,
  };
}

/**
 * True when horizontal rain would not reach this world XZ (deck/roof overhead).
 * @param {number} wx
 * @param {number} wz
 * @param {RainCanopySlab[]} slabs
 */
export function isPointUnderRainCanopy(wx, wz, slabs) {
  for (const slab of slabs) {
    if (inSlabFootprint(wx, wz, slab)) return true;
  }
  return false;
}

/**
 * Elevated walk decks + container roofs that block rain onto the arena floor.
 * Used only for player under-canopy detection (ambient/wetness muffling).
 *
 * @param {Parameters<import("@/lib/Rain.js").buildRainOccluderSlabs>[0]} groundSurfaces
 * @param {Parameters<import("@/lib/Rain.js").buildRainOccluderSlabs>[1]} catwalkDeckY
 * @param {Parameters<import("@/lib/Rain.js").buildRainOccluderSlabs>[2]} [deckColliders]
 * @param {import("../physics/Collision.js").ColliderBox[]} [containerColliders]
 * @returns {RainCanopySlab[]}
 */
export function buildRainCanopyFootprints(
  groundSurfaces,
  catwalkDeckY,
  deckColliders = [],
  containerColliders = [],
  floorY = 0,
) {
  const minDeckY = catwalkDeckY != null ? catwalkDeckY - 0.25 : 3.5;
  /** @type {RainCanopySlab[]} */
  const slabs = [];
  const seen = new Set();

  const push = (/** @type {RainCanopySlab} */ slab) => {
    const key = [
      slab.minX.toFixed(2),
      slab.maxX.toFixed(2),
      slab.minZ.toFixed(2),
      slab.maxZ.toFixed(2),
      slab.y.toFixed(3),
    ].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    slabs.push(slab);
  };

  for (const surf of groundSurfaces ?? []) {
    if (!surf.arenaCatwalkDeck && !surf.roomCatwalkDeck) continue;
    if (surf.y == null || surf.y < minDeckY) continue;
    if (surf.minX == null || surf.maxX == null) continue;
    push({
      minX: surf.minX,
      maxX: surf.maxX,
      minZ: surf.minZ,
      maxZ: surf.maxZ,
      y: surf.y,
    });
  }

  for (const box of deckColliders) {
    if (!isDeckRainOccluder(box, minDeckY, floorY)) continue;
    push({
      minX: box.x - box.halfX,
      maxX: box.x + box.halfX,
      minZ: box.z - box.halfZ,
      maxZ: box.z + box.halfZ,
      y: box.topY,
    });
  }

  for (const box of containerColliders ?? []) {
    if (box.containerPart !== "roof") continue;
    const y = box.bottomY ?? box.topY;
    if (y == null || box.x == null || box.z == null) continue;
    if (box.halfX == null || box.halfZ == null) continue;
    push({
      minX: box.x - box.halfX,
      maxX: box.x + box.halfX,
      minZ: box.z - box.halfZ,
      maxZ: box.z + box.halfZ,
      y,
      x: box.x,
      z: box.z,
      halfX: box.halfX,
      halfZ: box.halfZ,
      rotationY: box.rotationY ?? 0,
    });
  }

  return slabs.slice(0, MAX_RAIN_CANOPY_SLABS);
}

/**
 * True when the player stands on the arena floor under an elevated deck/roof.
 *
 * @param {number} x
 * @param {number} z
 * @param {number} footY
 * @param {RainCanopySlab[]} slabs
 * @param {number | null | undefined} catwalkDeckY
 */
export function isUnderRainCanopy(x, z, footY, slabs, catwalkDeckY) {
  if (!slabs.length) return false;
  if (catwalkDeckY != null && footY >= catwalkDeckY - 0.45) return false;
  return isPointUnderRainCanopy(x, z, slabs);
}
