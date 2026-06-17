/**
 * Recoil spring integrators — Rust via game_core (WASM required).
 */

import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";

/** @typedef {import("@/lib/game-core/types.ts").GameCoreEngine} GameCoreEngine */
/** @typedef {{ value: number, velocity: number }} SpringStepOutput */
/** @typedef {{ backVelDelta: number, pitchVelDelta: number }} FireRecoilKickOutput */
/** @typedef {{
 *   pitchValue: number,
 *   pitchVelocity: number,
 *   yawValue: number,
 *   yawVelocity: number,
 * }} AimRecoilStepOutput */

/**
 * @param {GameCoreEngine} gameCore
 * @param {number} value
 * @param {number} velocity
 * @param {number} target
 * @param {number} stiffness
 * @param {number} damping
 * @param {number} dt
 * @returns {SpringStepOutput}
 */
export function springRecoilToward(
  gameCore,
  value,
  velocity,
  target,
  stiffness,
  damping,
  dt,
) {
  return requireWasmMethod(gameCore, "recoilSpringStepToward")(
    value,
    velocity,
    target,
    stiffness,
    damping,
    dt,
  );
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {number} value
 * @param {number} velocity
 * @param {number} stiffness
 * @param {number} damping
 * @param {number} dt
 * @returns {SpringStepOutput}
 */
export function springRecoil(gameCore, value, velocity, stiffness, damping, dt) {
  return requireWasmMethod(gameCore, "recoilSpringStep")(
    value,
    velocity,
    stiffness,
    damping,
    dt,
  );
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {number} pitch
 * @param {number} recoilPitchAnim
 * @param {number} pitchLimit
 */
export function clampRecoilPitchAnim(gameCore, pitch, recoilPitchAnim, pitchLimit) {
  return requireWasmMethod(gameCore, "clampRecoilPitchAnim")(
    pitch,
    recoilPitchAnim,
    pitchLimit,
  );
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {number} fireRecoilBack
 * @param {number} aimRecoilScale
 * @param {number} kickVelScale
 * @param {number} fireRecoilPitch
 * @param {number} pitchVelScale
 * @returns {FireRecoilKickOutput}
 */
export function applyFireRecoilKick(
  gameCore,
  fireRecoilBack,
  aimRecoilScale,
  kickVelScale,
  fireRecoilPitch,
  pitchVelScale,
) {
  return requireWasmMethod(gameCore, "applyFireRecoilKick")(
    fireRecoilBack,
    aimRecoilScale,
    kickVelScale,
    fireRecoilPitch,
    pitchVelScale,
  );
}

/**
 * @param {GameCoreEngine} gameCore
 * @param {{
 *   pitchValue: number,
 *   pitchVelocity: number,
 *   pitchTarget: number,
 *   yawValue: number,
 *   yawVelocity: number,
 *   yawTarget: number,
 *   stiffness: number,
 *   damping: number,
 *   dt: number,
 * }} input
 * @returns {AimRecoilStepOutput}
 */
export function stepAimRecoilPair(gameCore, input) {
  return requireWasmMethod(gameCore, "stepAimRecoilPair")(input);
}
