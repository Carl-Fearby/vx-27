/**
 * Text/placement rects tuned to public/ui/hack-console.png (1024×576, alpha plate).
 * Values are fractions of frame width/height.
 */

/** @typedef {{ x: number, y: number, w: number, h: number }} HackRect */

/** @param {HackRect} r @returns {{ left: string, top: string, width: string, height: string }} */
export function hackRectStyle(r) {
  return {
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
  };
}

/** Left sidebar — five slots (x≈30–194px). */
export const HACK_LEFT_SLOTS = [
  { x: 0.0293, y: 0.142, w: 0.1602, h: 0.109 },
  { x: 0.0293, y: 0.269, w: 0.1602, h: 0.109 },
  { x: 0.0293, y: 0.396, w: 0.1602, h: 0.109 },
  { x: 0.0293, y: 0.523, w: 0.1602, h: 0.109 },
  { x: 0.0293, y: 0.65, w: 0.1602, h: 0.109 },
];

/** Right sidebar — two stacked panels (x≈830–994px). */
export const HACK_RIGHT_META = { x: 0.8105, y: 0.142, w: 0.1602, h: 0.233 };
export const HACK_RIGHT_REWARDS = { x: 0.8105, y: 0.396, w: 0.1602, h: 0.351 };

/** Center header trapezoid. */
export const HACK_HEADER = { x: 0.3, y: 0.042, w: 0.4, h: 0.08 };

/** Footer control legend bar (y≈483–528px). */
export const HACK_FOOTER = { x: 0.16, y: 0.838, w: 0.68, h: 0.078 };

/** Grid row labels — icons TBD. */
export const HACK_GRID_START = { x: 0.228, y: 0.375, w: 0.09, h: 0.034 };
export const HACK_GRID_REWARD = { x: 0.705, y: 0.344, w: 0.076, h: 0.09 };

/** Inset padding inside a slot (fraction of slot size). */
export const HACK_SLOT_PAD = {
  top: 0.14,
  right: 0.07,
  bottom: 0.1,
  left: 0.09,
};
