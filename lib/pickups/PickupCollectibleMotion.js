/** Shared settle bob for floor collectibles (ammo, score, HP, grenade). */

export const PICKUP_HOVER_LIFT = 0.12;
export const PICKUP_BOB_SPEED = 2.0;
export const PICKUP_BOB_HEIGHT = 0.06;
export const PICKUP_BOB_AMP = 1.65;
export const PICKUP_SETTLE_BLEND_SPEED = 1.8;

export function easePickupSettle(settleBlend) {
  const t = Math.min(1, Math.max(0, settleBlend ?? 0));
  return t * t * (3 - 2 * t);
}

/**
 * Settled pickup Y — same hover lift and bob amplitude for every reward type.
 * @param {number} floorY
 * @param {number} groundOffset anchor Y above floor at rest (per mesh pivot)
 * @param {number} time
 * @param {number} settledTime
 * @param {number} settleBlend
 */
export function computePickupBobY(
  floorY,
  groundOffset,
  time,
  settledTime,
  settleBlend
) {
  const ease = easePickupSettle(settleBlend);
  const groundY = floorY + groundOffset;
  const hoverY = groundY + PICKUP_HOVER_LIFT;
  const baseY = groundY + (hoverY - groundY) * ease;
  const bob =
    Math.sin((time - settledTime) * PICKUP_BOB_SPEED) *
    PICKUP_BOB_HEIGHT *
    PICKUP_BOB_AMP *
    ease;
  return baseY + bob;
}
