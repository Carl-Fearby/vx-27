/** @typedef {{
 *   barScale: number,
 *   valueFont: number,
 *   labelScale: number,
 *   cogSize: number,
 *   cogX: number,
 *   cogY: number,
 *   roundsX: number,
 *   roundsY: number,
 *   magX: number,
 *   magY: number,
 *   magsX: number,
 *   magsY: number,
 *   labelY: number,
 *   fireModeY: number,
 * }} HudBottomBarTuning */

/** @type {HudBottomBarTuning} */
export const DEFAULT_HUD_BOTTOM_BAR_TUNING = {
  barScale: 0.5,
  valueFont: 2.97,
  labelScale: 1,
  cogSize: 8,
  cogX: 4,
  cogY: 32,
  roundsX: 33,
  roundsY: 10,
  magX: 50,
  magY: 10,
  magsX: 67,
  magsY: 10,
  labelY: 8,
  fireModeY: 14.5,
};

/** @returns {HudBottomBarTuning} */
export function loadHudBottomBarTuning() {
  return { ...DEFAULT_HUD_BOTTOM_BAR_TUNING };
}
