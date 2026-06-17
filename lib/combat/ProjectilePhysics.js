/**
 * Grenade/flashbang projectile physics — Rust via game_core; JS when gameCore is null (trajectory preview only).
 */

import * as THREE from "three";
import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";

/** @typedef {import("@/lib/game-core/types.ts").GameCoreEngine} GameCoreEngine */
/** @typedef {import("@/lib/game-core/types.ts").ProjectileBounds} ProjectileBounds */

export const PROJECTILE_MAX_MOVE = 0.018;
export const PROJECTILE_MAX_SUBSTEPS = 6;
export const GRENADE_RADIUS = 0.05;

const _worldUp = new THREE.Vector3(0, 1, 0);
const _scratchRight = new THREE.Vector3();
const _scratchUp = new THREE.Vector3();

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 * @param {import("three").Vector3} aimDir
 * @param {{ throwSpeed: number, loftAngle: number }} params
 * @param {import("three").Vector3} out
 */
export function computeThrowVelocity(gameCore, aimDir, params, out) {
  if (!gameCore) {
    const loftRad = (params.loftAngle * Math.PI) / 180;
    const right = _scratchRight.crossVectors(aimDir, _worldUp).normalize();
    const up = _scratchUp.crossVectors(right, aimDir).normalize();
    return out
      .copy(aimDir)
      .multiplyScalar(Math.cos(loftRad))
      .add(up.multiplyScalar(Math.sin(loftRad)))
      .normalize()
      .multiplyScalar(params.throwSpeed);
  }
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
  if (!gameCore) {
    return Math.min(
      PROJECTILE_MAX_SUBSTEPS,
      Math.max(1, Math.ceil((speed * dt) / PROJECTILE_MAX_MOVE)),
    );
  }
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
  if (!gameCore) {
    return {
      pos: {
        x: pos.x + vel.x * subDt,
        y: pos.y + vel.y * subDt,
        z: pos.z + vel.z * subDt,
      },
      vel: {
        x: vel.x,
        y: vel.y - gravity * subDt,
        z: vel.z,
      },
    };
  }
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
  if (!gameCore) {
    let nextAirborne = airborne;
    let bounced = false;
    let floorHit = false;
    let floorHitImpact = 0;
    const nextPos = { x: pos.x, y: pos.y, z: pos.z };
    const nextVel = { x: vel.x, y: vel.y, z: vel.z };

    if (nextPos.y <= floorTop) {
      const inboundY = nextVel.y;
      nextPos.y = floorTop;
      if (airborne && inboundY < -0.15) {
        floorHitImpact = Math.min(1, Math.abs(inboundY) / 8);
        floorHit = true;
        bounced = true;
        nextVel.y = -inboundY * params.bounceRestitution;
        const slideRetain = Math.max(0, 1 - params.bounceFriction);
        nextVel.x *= slideRetain;
        nextVel.z *= slideRetain;
        if (Math.abs(nextVel.y) < 0.45) {
          nextVel.y = 0;
          nextAirborne = false;
        }
      } else {
        nextVel.y = 0;
        nextAirborne = false;
      }
    } else {
      nextAirborne = true;
    }

    return {
      pos: nextPos,
      vel: nextVel,
      airborne: nextAirborne,
      bounced,
      floorHit,
      floorHitImpact,
    };
  }
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
  if (!gameCore) {
    const nextPos = { x: pos.x, y: pos.y, z: pos.z };
    const nextVel = { x: vel.x, y: vel.y, z: vel.z };
    const r = GRENADE_RADIUS;
    if (nextPos.x < bounds.minX + r) {
      nextPos.x = bounds.minX + r;
      nextVel.x = Math.abs(nextVel.x) * bounceRestitution;
    }
    if (nextPos.x > bounds.maxX - r) {
      nextPos.x = bounds.maxX - r;
      nextVel.x = -Math.abs(nextVel.x) * bounceRestitution;
    }
    if (nextPos.z < bounds.minZ + r) {
      nextPos.z = bounds.minZ + r;
      nextVel.z = Math.abs(nextVel.z) * bounceRestitution;
    }
    if (nextPos.z > bounds.maxZ - r) {
      nextPos.z = bounds.maxZ - r;
      nextVel.z = -Math.abs(nextVel.z) * bounceRestitution;
    }
    return { pos: nextPos, vel: nextVel };
  }
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
  if (!gameCore) {
    if (airborne || fallingThroughHole) {
      return { velX, velZ };
    }
    const rollDamp = Math.exp(-(params.groundRollFriction ?? 16) * dt);
    let nextX = velX * rollDamp;
    let nextZ = velZ * rollDamp;
    if (Math.hypot(nextX, nextZ) < 0.08) {
      nextX = 0;
      nextZ = 0;
    }
    return { velX: nextX, velZ: nextZ };
  }
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
  if (!gameCore) {
    const time = state.time + dt;
    let countdownPlayed = state.countdownPlayed;
    let shouldPlayCountdown = false;
    let countdownPlaybackRate = 1;
    if (!countdownPlayed && countdownDuration > 0 && fuseTime > 0.05) {
      const lead = Math.min(countdownDuration, Math.max(0.12, fuseTime - 0.05));
      const startAt = fuseTime - lead;
      if (time >= startAt) {
        countdownPlayed = true;
        shouldPlayCountdown = true;
        countdownPlaybackRate = Math.min(2.5, Math.max(0.85, countdownDuration / lead));
      }
    }
    return {
      time,
      shouldDetonate: time >= fuseTime,
      shouldPlayCountdown,
      countdownPlaybackRate,
      countdownPlayed,
    };
  }
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
  if (gameCore?.projectilePreviewFloorAndBounds) {
    const result = gameCore.projectilePreviewFloorAndBounds(input);
    state.pos.x = result.pos.x;
    state.pos.y = result.pos.y;
    state.pos.z = result.pos.z;
    state.vel.x = result.vel.x;
    state.vel.y = result.vel.y;
    state.vel.z = result.vel.z;
    state.bounceCount = result.bounceCount;
    return result;
  }

  let landed = false;
  let recordBounce = false;
  let stopSim = false;
  if (state.pos.y <= floorTop) {
    state.pos.y = floorTop;
    if (state.bounceCount === 0) landed = true;
    else if (state.bounceCount === 1) recordBounce = true;
    state.bounceCount += 1;
    state.vel.y = -state.vel.y * params.bounceRestitution;
    state.vel.x *= 1 - params.bounceFriction;
    state.vel.z *= 1 - params.bounceFriction;
    if (Math.abs(state.vel.y) < 0.1 && state.bounceCount > 1) stopSim = true;
  }
  if (bounds) {
    const resolved = projectileResolveBounds(
      null,
      state.pos,
      state.vel,
      bounds,
      params.bounceRestitution,
    );
    state.pos.x = resolved.pos.x;
    state.pos.y = resolved.pos.y;
    state.pos.z = resolved.pos.z;
    state.vel.x = resolved.vel.x;
    state.vel.y = resolved.vel.y;
    state.vel.z = resolved.vel.z;
  }
  return { landed, recordBounce, stopSim, bounceCount: state.bounceCount };
}

/**
 * @param {GameCoreEngine | null | undefined} gameCore
 */
export function projectilePreviewStep(gameCore, state, dt, params, floorTop, bounds) {
  if (gameCore?.projectilePreviewStep) {
    const result = gameCore.projectilePreviewStep({
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

  state.vel.y -= params.gravity * dt;
  state.pos.x += state.vel.x * dt;
  state.pos.y += state.vel.y * dt;
  state.pos.z += state.vel.z * dt;

  if (bounds) {
    const resolved = projectileResolveBounds(
      null,
      state.pos,
      state.vel,
      bounds,
      params.bounceRestitution,
    );
    state.pos.x = resolved.pos.x;
    state.pos.y = resolved.pos.y;
    state.pos.z = resolved.pos.z;
    state.vel.x = resolved.vel.x;
    state.vel.y = resolved.vel.y;
    state.vel.z = resolved.vel.z;
  }

  let landed = false;
  let recordBounce = false;
  let stopSim = false;
  if (state.pos.y <= floorTop) {
    state.pos.y = floorTop;
    if (state.bounceCount === 0) landed = true;
    else if (state.bounceCount === 1) recordBounce = true;
    state.bounceCount += 1;
    state.vel.y = -state.vel.y * params.bounceRestitution;
    state.vel.x *= 1 - params.bounceFriction;
    state.vel.z *= 1 - params.bounceFriction;
    if (Math.abs(state.vel.y) < 0.1 && state.bounceCount > 1) stopSim = true;
  }

  return { landed, recordBounce, stopSim };
}
