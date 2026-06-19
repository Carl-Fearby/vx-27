import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";
import { clampToBoundsJs } from "@/lib/physics/CollisionJs.js";

// Physics constants — kept in sync with Rust ragdoll.rs
const HALF_PI = Math.PI / 2;
const DEATH_GRAVITY = 12.0;
const DEATH_BOUNCE_RESTITUTION = 0.3;
const DEATH_BOUNCE_FRICTION = 0.6;
const DEATH_REST_THRESHOLD = 0.05;
const HOLE_FALL_GRAVITY = 22.0;
const LAUNCH_GRAVITY_RS = 22.0;

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine | null} gameCore */
export function clampToBoundsCore(gameCore, px, pz, radius, bounds) {
  if (!gameCore) return clampToBoundsJs(px, pz, radius, bounds);
  return requireWasmMethod(gameCore, "clampToBounds")(px, pz, radius, bounds ?? null);
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine | null} gameCore */
export function tickRagdollHoleFallCore(gameCore, input) {
  if (!gameCore) {
    const holeFallVelY = input.holeFallVelY - HOLE_FALL_GRAVITY * input.dt;
    const holeFallOffset = input.holeFallOffset + holeFallVelY * input.dt;
    const rootY = input.floorY + holeFallOffset;
    const fallDepth = input.floorY - rootY;
    let opacity = 1, finished = false;
    if (fallDepth > 1) {
      const fadeT = Math.min(1, (fallDepth - 1) / 4);
      opacity = Math.max(0, 1 - fadeT);
      if (fadeT >= 1) finished = true;
    }
    return { holeFallVelY, holeFallOffset, rootY, opacity, finished };
  }
  return requireWasmMethod(gameCore, "tickRagdollHoleFall")(input);
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine | null} gameCore */
export function tickRagdollCoreToppleCore(gameCore, input) {
  if (!gameCore) {
    if (input.settled) {
      return { tipAngle: input.tipAngle, angularVel: input.angularVel, settled: true, bounced: input.bounced };
    }
    const dt = input.dt;
    let tipAngle = input.tipAngle, angularVel = input.angularVel;
    let settled = false, bounced = input.bounced;
    angularVel += DEATH_GRAVITY * Math.sin(tipAngle + 0.15) * dt;
    tipAngle += angularVel * dt;
    if (tipAngle >= HALF_PI) {
      tipAngle = HALF_PI;
      if (Math.abs(angularVel) > DEATH_REST_THRESHOLD) {
        angularVel *= -DEATH_BOUNCE_RESTITUTION;
        bounced = true;
      } else {
        angularVel = 0;
        settled = true;
      }
    }
    if (bounced && tipAngle >= HALF_PI - 0.01 && Math.abs(angularVel) < DEATH_REST_THRESHOLD) {
      angularVel = 0;
      tipAngle = HALF_PI;
      settled = true;
    }
    angularVel *= 1 - DEATH_BOUNCE_FRICTION * dt;
    return { tipAngle, angularVel, settled, bounced };
  }
  return requireWasmMethod(gameCore, "tickRagdollCoreTopple")(input);
}

/** @param {import("@/lib/game-core/types.ts").GameCoreEngine | null} gameCore */
export function tickRagdollLaunchCore(gameCore, input) {
  if (!gameCore) {
    if (!input.airborne) {
      return { launchY: input.launchY, launchVelY: input.launchVelY, launchVelX: input.launchVelX, launchVelZ: input.launchVelZ, originX: input.originX, originZ: input.originZ, airborne: false, floorImpact: 0 };
    }
    const launchVelY = input.launchVelY - LAUNCH_GRAVITY_RS * input.dt;
    const launchY = input.launchY + launchVelY * input.dt;
    const originX = input.originX + input.launchVelX * input.dt;
    const originZ = input.originZ + input.launchVelZ * input.dt;
    if (launchY <= 0) {
      return { launchY: 0, launchVelY: 0, launchVelX: input.launchVelX, launchVelZ: input.launchVelZ, originX, originZ, airborne: false, floorImpact: Math.min(1, Math.abs(launchVelY) / 7) };
    }
    return { launchY, launchVelY, launchVelX: input.launchVelX, launchVelZ: input.launchVelZ, originX, originZ, airborne: true, floorImpact: 0 };
  }
  return requireWasmMethod(gameCore, "tickRagdollLaunch")(input);
}
