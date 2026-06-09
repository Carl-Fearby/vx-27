export const HUD_BOTTOM_BAR_TUNING_KEY = "fps-hud-bottom-bar-tuning";
export const HUD_BOTTOM_BAR_TUNE_ENABLED_KEY = "fps-hud-bottom-bar-tune-enabled";

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
 *   fireCarouselX: number,
 *   fireCarouselY: number,
 *   fireCarouselScale: number,
 * }} HudBottomBarTuning */

/** @type {HudBottomBarTuning} */
export const DEFAULT_HUD_BOTTOM_BAR_TUNING = {
  barScale: 0.55,
  valueFont: 4.24,
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
  fireCarouselX: 92,
  fireCarouselY: 25,
  fireCarouselScale: 2.5,
};

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** @param {Partial<HudBottomBarTuning>} patch */
export function normalizeHudBottomBarTuning(patch) {
  const d = DEFAULT_HUD_BOTTOM_BAR_TUNING;
  return {
    barScale: clampNum(patch.barScale, 0.25, 1.5, d.barScale),
    valueFont: clampNum(patch.valueFont, 1, 6, d.valueFont),
    labelScale: clampNum(patch.labelScale, 0.5, 2, d.labelScale),
    cogSize: clampNum(patch.cogSize, 4, 16, d.cogSize),
    cogX: clampNum(patch.cogX, 0, 20, d.cogX),
    cogY: clampNum(patch.cogY, 0, 60, d.cogY),
    roundsX: clampNum(patch.roundsX, 10, 50, d.roundsX),
    roundsY: clampNum(patch.roundsY, 0, 40, d.roundsY),
    magX: clampNum(patch.magX, 20, 60, d.magX),
    magY: clampNum(patch.magY, 0, 40, d.magY),
    magsX: clampNum(patch.magsX, 30, 70, d.magsX),
    magsY: clampNum(patch.magsY, 0, 40, d.magsY),
    labelY: clampNum(patch.labelY, -20, 30, d.labelY),
    fireCarouselX: clampNum(patch.fireCarouselX, 55, 95, d.fireCarouselX),
    fireCarouselY: clampNum(patch.fireCarouselY, 0, 40, d.fireCarouselY),
    fireCarouselScale: clampNum(patch.fireCarouselScale, 0.6, 3.5, d.fireCarouselScale),
  };
}

/** @returns {HudBottomBarTuning} */
export function loadHudBottomBarTuning() {
  if (typeof window === "undefined") return { ...DEFAULT_HUD_BOTTOM_BAR_TUNING };
  try {
    const raw = window.localStorage.getItem(HUD_BOTTOM_BAR_TUNING_KEY);
    if (!raw) return { ...DEFAULT_HUD_BOTTOM_BAR_TUNING };
    return normalizeHudBottomBarTuning(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_HUD_BOTTOM_BAR_TUNING };
  }
}

/** @param {HudBottomBarTuning} tuning */
export function saveHudBottomBarTuning(tuning) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    HUD_BOTTOM_BAR_TUNING_KEY,
    JSON.stringify(normalizeHudBottomBarTuning(tuning)),
  );
}

export function loadHudBottomBarTuneEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(HUD_BOTTOM_BAR_TUNE_ENABLED_KEY) === "true";
}

export function saveHudBottomBarTuneEnabled(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HUD_BOTTOM_BAR_TUNE_ENABLED_KEY, String(enabled));
}

/** @param {HudBottomBarTuning} tuning */
export function formatHudBottomBarTuningForCopy(tuning) {
  return JSON.stringify(normalizeHudBottomBarTuning(tuning), null, 2);
}
