import * as THREE from "three";
import { pointInFloorHole } from "./Collision.js";
import { sampleStairRampFootYRaw } from "../stairs/StairRamp.js";

const _scratch = new THREE.Vector3();

/**
 * @typedef {{ minX: number, maxX: number, minZ: number, maxZ: number, y: number }} FlatGroundSurface
 * @typedef {import("../stairs/LevelStairs.js").StairFlightRuntime} StairFlightRuntime
 *
 * @typedef {Object} GroundSupportContext
 * @property {Array<FlatGroundSurface | { stairRamp?: boolean, stairFlight?: StairFlightRuntime }>} [groundSurfaces]
 * @property {number} [floorY]
 * @property {Array<{ x: number, z: number, radius: number }>} [floorHoles]
 * @property {{ minX: number, maxX: number, minZ: number, maxZ: number } | null} [floorBounds]
 * @property {number} [inset] Horizontal sample radius (e.g. grenade radius)
 * @property {import("@/lib/game-core/types.ts").GameCoreEngine | null} [gameCore]
 */

/**
 * Highest walkable Y at (x, z) that is at or below refY — matches arena floor, decks, stair ramp, landings.
 *
 * @param {number} x
 * @param {number} z
 * @param {number} refY Current projectile / foot height
 * @param {GroundSupportContext} ctx
 * @returns {number}
 */
export function sampleSupportYAt(x, z, refY, ctx) {
  const {
    groundSurfaces = [],
    floorY = 0,
    floorHoles = [],
    floorBounds = null,
    inset = 0,
    gameCore = null,
  } = ctx;

  let best = Number.NEGATIVE_INFINITY;
  const landSlack = 0.1;

  const consider = (y, sx, sz) => {
    if (!Number.isFinite(y)) return;
    if (y > refY + landSlack) return;
    if (y <= floorY + 0.02 && pointInFloorHole(sx, sz, floorHoles, inset, gameCore)) return;
    best = Math.max(best, y);
  };

  const inFloorBounds = (sx, sz) => {
    if (!floorBounds) return true;
    return (
      sx >= floorBounds.minX &&
      sx <= floorBounds.maxX &&
      sz >= floorBounds.minZ &&
      sz <= floorBounds.maxZ
    );
  };

  const samples = [[0, 0]];
  if (inset > 0) {
    const r = inset * 0.85;
    samples.push([r, 0], [-r, 0], [0, r], [0, -r]);
  }

  for (const [dx, dz] of samples) {
    const sx = x + dx;
    const sz = z + dz;
    if (inFloorBounds(sx, sz)) {
      consider(floorY, sx, sz);
    }
    for (const surf of groundSurfaces) {
      if (surf.stairRamp && surf.stairFlight) {
        consider(
          sampleStairRampFootYRaw(surf.stairFlight, sx, sz, _scratch),
          sx,
          sz
        );
        continue;
      }
      if (surf.minX == null || surf.maxX == null) continue;
      if (
        sx >= surf.minX &&
        sx <= surf.maxX &&
        sz >= surf.minZ &&
        sz <= surf.maxZ
      ) {
        consider(surf.y, sx, sz);
      }
    }
  }

  return Number.isFinite(best) ? best : floorY;
}

/**
 * @param {{
 *   groundSurfaces?: GroundSupportContext["groundSurfaces"],
 *   floorY?: number,
 *   floorHoles?: GroundSupportContext["floorHoles"],
 *   floorBounds?: GroundSupportContext["floorBounds"],
 *   inset?: number,
 * }} level
 * @returns {GroundSupportContext}
 */
export function groundSupportFromLevel(level, inset = 0, gameCore = null) {
  return {
    groundSurfaces: level.groundSurfaces ?? [],
    floorY: level.floorY ?? 0,
    floorHoles: level.floorHoles ?? [],
    floorBounds: level.floorBounds ?? null,
    inset,
    gameCore,
  };
}

/**
 * Walk surface for kill rewards at (x, z) — catwalk deck when over deck, else arena floor.
 * @param {number} x
 * @param {number} z
 * @param {number} refY Death height or spawn reference
 * @param {Parameters<typeof groundSupportFromLevel>[0]} level
 * @returns {{ floorY: number, surface: "floor" | "catwalk" }}
 */
export function resolveRewardDropFloorAt(x, z, refY, level) {
  const baseFloorY = level.floorY ?? 0;
  const catwalkDeckY = level.catwalkDeckY;
  const floorY = sampleSupportYAt(x, z, refY, groundSupportFromLevel(level, 0.08));
  const onCatwalk =
    catwalkDeckY != null &&
    floorY >= catwalkDeckY - 0.15 &&
    floorY > baseFloorY + 0.05;
  return {
    floorY,
    surface: onCatwalk ? "catwalk" : "floor",
  };
}
