/**
 * Grenade/flashbang projectile physics — Rust via game_core (WASM required).
 */

import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";

/** @typedef {import("@/lib/game-core/types.ts").GameCoreEngine} GameCoreEngine */
/** @typedef {import("@/lib/game-core/types.ts").ProjectileBounds} ProjectileBounds */

export const PROJECTILE_MAX_MOVE = 0.018;
export const PROJECTILE_MAX_SUBSTEPS = 6;
export const GRENADE_RADIUS = 0.05;

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 * @param {import("three").Vector3} aimDir
 * @param {{ throwSpeed: number, loftAngle: number }} params
 * @param {import("three").Vector3} out
 */
export function computeThrowVelocity(gameCore, aimDir, params, out) {
  const vel = requireWasmMethod(gameCore, "computeThrowVelocity")(
    aimDir.x,
    aimDir.y,
    aimDir.z,
    params.throwSpeed,
    params.loftAngle,
  );
  return out.set(vel.x, vel.y, vel.z);
}

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 * @param {number} speed
 * @param {number} dt
 */
export function projectileSubstepCount(gameCore, speed, dt) {
  return requireWasmMethod(gameCore, "projectileSubstepCount")(
    speed,
    dt,
    PROJECTILE_MAX_MOVE,
    PROJECTILE_MAX_SUBSTEPS,
  );
}

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 * @param {{ x: number, y: number, z: number }} pos
 * @param {{ x: number, y: number, z: number }} vel
 * @param {number} subDt
 * @param {number} gravity
 */
export function projectileIntegrate(gameCore, pos, vel, subDt, gravity) {
  return requireWasmMethod(gameCore, "projectileIntegrate")({
    pos: { x: pos.x, y: pos.y, z: pos.z },
    vel: { x: vel.x, y: vel.y, z: vel.z },
    dt: subDt,
    gravity,
  });
}

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 * @param {{ x: number, y: number, z: number }} pos
 * @param {{ x: number, y: number, z: number }} vel
 * @param {number} floorTop
 * @param {boolean} airborne
 * @param {{ bounceRestitution: number, bounceFriction: number }} params
 */
export function projectileResolveFloorLive(
  gameCore,
  pos,
  vel,
  floorTop,
  airborne,
  params,
) {
  return requireWasmMethod(gameCore, "projectileResolveFloorLive")({
    pos: { x: pos.x, y: pos.y, z: pos.z },
    vel: { x: vel.x, y: vel.y, z: vel.z },
    floorTop,
    airborne: Boolean(airborne),
    bounceRestitution: params.bounceRestitution,
    bounceFriction: params.bounceFriction,
  });
}

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 * @param {{ x: number, y: number, z: number }} pos
 * @param {{ x: number, y: number, z: number }} vel
 * @param {ProjectileBounds} bounds
 * @param {number} bounceRestitution
 */
export function projectileResolveBounds(gameCore, pos, vel, bounds, bounceRestitution) {
  return requireWasmMethod(gameCore, "projectileResolveBounds")({
    pos: { x: pos.x, y: pos.y, z: pos.z },
    vel: { x: vel.x, y: vel.y, z: vel.z },
    bounds,
    radius: GRENADE_RADIUS,
    bounceRestitution,
  });
}

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 */
export function projectileApplyGroundRoll(gameCore, velX, velZ, dt, params, airborne, fallingThroughHole) {
  return requireWasmMethod(gameCore, "projectileApplyGroundRoll")({
    velX,
    velZ,
    dt,
    groundRollFriction: params.groundRollFriction,
    airborne: Boolean(airborne),
    fallingThroughHole: Boolean(fallingThroughHole),
  });
}

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 */
export function projectileFuseTick(gameCore, state, dt, fuseTime, countdownDuration) {
  return requireWasmMethod(gameCore, "projectileFuseTick")({
    time: state.time,
    dt,
    fuseTime,
    countdownDuration,
    countdownPlayed: Boolean(state.countdownPlayed),
  });
}

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 */
export function projectilePreviewFloorAndBounds(
  gameCore,
  state,
  floorTop,
  bounds,
  params,
) {
  const input = {
    pos: { x: state.pos.x, y: state.pos.y, z: state.pos.z },
    vel: { x: state.vel.x, y: state.vel.y, z: state.vel.z },
    dt: 0,
    gravity: params.gravity,
    floorTop,
    bounceRestitution: params.bounceRestitution,
    bounceFriction: params.bounceFriction,
    bounceCount: state.bounceCount,
    bounds: bounds ?? null,
    radius: GRENADE_RADIUS,
  };
  const result = requireWasmMethod(gameCore, "projectilePreviewFloorAndBounds")(input);
  state.pos.x = result.pos.x;
  state.pos.y = result.pos.y;
  state.pos.z = result.pos.z;
  state.vel.x = result.vel.x;
  state.vel.y = result.vel.y;
  state.vel.z = result.vel.z;
  state.bounceCount = result.bounceCount;
  return result;
}

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 */
export function projectilePreviewStep(gameCore, state, dt, params, floorTop, bounds) {
  const result = requireWasmMethod(gameCore, "projectilePreviewStep")({
    pos: { x: state.pos.x, y: state.pos.y, z: state.pos.z },
    vel: { x: state.vel.x, y: state.vel.y, z: state.vel.z },
    dt,
    gravity: params.gravity,
    floorTop,
    bounceRestitution: params.bounceRestitution,
    bounceFriction: params.bounceFriction,
    bounceCount: state.bounceCount,
    bounds: bounds ?? null,
    radius: GRENADE_RADIUS,
  });
  state.pos.x = result.pos.x;
  state.pos.y = result.pos.y;
  state.pos.z = result.pos.z;
  state.vel.x = result.vel.x;
  state.vel.y = result.vel.y;
  state.vel.z = result.vel.z;
  state.bounceCount = result.bounceCount;
  return result;
}
