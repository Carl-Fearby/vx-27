/** @typedef {{ x: number, y: number, active: boolean }} JoystickState */

/**
 * Normalized stick vector from pointer offset (Y = forward).
 * @param {number} dx
 * @param {number} dy
 * @param {number} maxRadius
 * @param {number} [deadZone=0.18]
 * @returns {{ x: number, y: number }}
 */
export function joystickVectorFromDelta(dx, dy, maxRadius, deadZone = 0.18) {
  const len = Math.hypot(dx, dy);
  if (len < 1) return { x: 0, y: 0 };
  const clamped = Math.min(len, maxRadius);
  let x = dx / maxRadius;
  let y = -dy / maxRadius;
  const mag = Math.hypot(x, y);
  if (mag > 1) {
    x /= mag;
    y /= mag;
  }
  if (mag < deadZone) return { x: 0, y: 0 };
  const scaled = (mag - deadZone) / (1 - deadZone);
  return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}

/**
 * Map stick vector to virtual move actions (forward/back/strafe).
 * @param {{ x: number, y: number }} vec
 * @param {number} [threshold=0.22]
 */
export function joystickToMoveActions(vec, threshold = 0.22) {
  return {
    forward: vec.y > threshold,
    backward: vec.y < -threshold,
    strafeLeft: vec.x < -threshold,
    strafeRight: vec.x > threshold,
  };
}
