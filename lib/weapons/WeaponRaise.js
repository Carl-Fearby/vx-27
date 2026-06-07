import * as THREE from "three";

/** Spring settle into hip pose after spawn / respawn. */
const RAISE_SPRING_STIFFNESS = 28;
const RAISE_SPRING_DAMPING = 6.5;

/**
 * Camera-space pull from tuned hip pose at raise start (progress = 0).
 * Y: down · Z: toward chest · X: slight from the right.
 */
const RAISE_OFFSET_Y = -0.42;
const RAISE_OFFSET_Z = 0.26;
const RAISE_OFFSET_X = 0.04;

/** Pivot rotation added at raise start (radians, YXZ order). */
const RAISE_OFFSET_ROT_X = 0.58;
const RAISE_OFFSET_ROT_Y = -0.12;
const RAISE_OFFSET_ROT_Z = 0.14;

const _camUp = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();

function easeOutCubic(t) {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

function easeInCubic(t) {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped ** 3;
}

function springToward(current, velocity, target, stiffness, damping, dt) {
  velocity += ((target - current) * stiffness - velocity * damping) * dt;
  current += velocity * dt;
  return { current, velocity };
}

/** @returns {{ progress: number, velocity: number }} */
export function createWeaponRaiseState() {
  return { progress: 0, velocity: 0 };
}

/** @param {{ progress: number, velocity: number }} state */
export function resetWeaponRaiseState(state) {
  state.progress = 0;
  state.velocity = 0;
}

/**
 * @param {{ progress: number, velocity: number }} state
 * @param {number} dt
 * @returns {number} progress 0–1
 */
export function updateWeaponRaiseState(state, dt) {
  if (state.progress >= 1) return 1;
  const step = springToward(
    state.progress,
    state.velocity,
    1,
    RAISE_SPRING_STIFFNESS,
    RAISE_SPRING_DAMPING,
    dt,
  );
  state.progress = Math.min(1, step.current);
  state.velocity = step.velocity;
  return state.progress;
}

/**
 * Low-ready sweep into the tuned hip pose.
 * @param {THREE.Object3D} holder
 * @param {THREE.Object3D} pivot
 * @param {THREE.Camera} camera
 * @param {number} progress 0 = low ready, 1 = settled
 * @param {number} [aimBlend] fades raise while ADS
 */
export function applyWeaponRaise(holder, pivot, camera, progress, aimBlend = 0) {
  const inv = 1 - easeOutCubic(progress);
  const hipScale = 1 - aimBlend * 0.9;
  const k = inv * hipScale;
  if (k < 0.0005) return;

  _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  _camForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);

  holder.position.addScaledVector(_camUp, RAISE_OFFSET_Y * k);
  holder.position.addScaledVector(_camForward, RAISE_OFFSET_Z * k);
  holder.position.addScaledVector(_camRight, RAISE_OFFSET_X * k);

  pivot.rotation.x += RAISE_OFFSET_ROT_X * k;
  pivot.rotation.y += RAISE_OFFSET_ROT_Y * k;
  pivot.rotation.z += RAISE_OFFSET_ROT_Z * k;
}

/**
 * Holster sweep — weapon rotates down/out of view (swap out).
 * @param {number} amount 0 = hip pose · 1 = fully holstered
 */
export function applyWeaponHolster(holder, pivot, camera, amount, aimBlend = 0) {
  const hipScale = 1 - aimBlend * 0.9;
  const k = easeInCubic(amount) * hipScale;
  if (k < 0.0005) return;

  _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  _camForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);

  holder.position.addScaledVector(_camUp, RAISE_OFFSET_Y * k);
  holder.position.addScaledVector(_camForward, RAISE_OFFSET_Z * k);
  holder.position.addScaledVector(_camRight, RAISE_OFFSET_X * k);

  pivot.rotation.x += RAISE_OFFSET_ROT_X * k;
  pivot.rotation.y += RAISE_OFFSET_ROT_Y * k;
  pivot.rotation.z += RAISE_OFFSET_ROT_Z * k;
}
