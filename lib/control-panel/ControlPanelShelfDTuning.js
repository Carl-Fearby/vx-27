import {
  applyControlPanelSurfaceGlow,
  loadControlPanelPanelBlueBias,
  loadControlPanelPanelEmissiveIntensity,
} from "./ControlPanelEmissiveTuning.js";

/** Surface D shelf (shelf_d mesh) — baked day/night brightness. */

export const CONTROL_PANEL_SHELF_D_DAY_BRIGHTNESS_KEY =
  "fps-control-panel-shelf-day-brightness";
export const CONTROL_PANEL_SHELF_D_NIGHT_BRIGHTNESS_KEY =
  "fps-control-panel-shelf-night-brightness";

/** Locked console tuning. */
export const CONTROL_PANEL_SHELF_D_DAY_BRIGHTNESS = 7.5;
export const CONTROL_PANEL_SHELF_D_NIGHT_BRIGHTNESS = 2;

export const CONTROL_PANEL_SHELF_D_DAY_BRIGHTNESS_DEFAULT =
  CONTROL_PANEL_SHELF_D_DAY_BRIGHTNESS;
export const CONTROL_PANEL_SHELF_D_NIGHT_BRIGHTNESS_DEFAULT =
  CONTROL_PANEL_SHELF_D_NIGHT_BRIGHTNESS;
export const CONTROL_PANEL_SHELF_D_DAY_BRIGHTNESS_MIN = 0;
export const CONTROL_PANEL_SHELF_D_DAY_BRIGHTNESS_MAX = 25;
export const CONTROL_PANEL_SHELF_D_NIGHT_BRIGHTNESS_MIN = 0;
export const CONTROL_PANEL_SHELF_D_NIGHT_BRIGHTNESS_MAX = 18;

/** @deprecated */
export const CONTROL_PANEL_SHELF_D_BRIGHTNESS_DEFAULT =
  CONTROL_PANEL_SHELF_D_DAY_BRIGHTNESS;
/** @deprecated */
export const CONTROL_PANEL_SHELF_D_BRIGHTNESS =
  CONTROL_PANEL_SHELF_D_DAY_BRIGHTNESS;

function clampNightness(nightness) {
  return Math.min(1, Math.max(0, nightness ?? 0));
}

export function loadControlPanelShelfDDayBrightness() {
  return CONTROL_PANEL_SHELF_D_DAY_BRIGHTNESS;
}

export function loadControlPanelShelfDNightBrightness() {
  return CONTROL_PANEL_SHELF_D_NIGHT_BRIGHTNESS;
}

/** @deprecated */
export function loadControlPanelShelfDBrightness() {
  return CONTROL_PANEL_SHELF_D_DAY_BRIGHTNESS;
}

/** @deprecated Shelf brightness is baked. */
export function saveControlPanelShelfDDayBrightness(_value) {}

/** @deprecated Shelf brightness is baked. */
export function saveControlPanelShelfDNightBrightness(_value) {}

/** @deprecated */
export function saveControlPanelShelfDBrightness(_value) {}

/** @deprecated */
export function saveControlPanelShelfDNightDim(_value) {}

/** @deprecated */
export function loadControlPanelShelfDNightDim() {
  return CONTROL_PANEL_SHELF_D_NIGHT_BRIGHTNESS / CONTROL_PANEL_SHELF_D_DAY_BRIGHTNESS;
}

/**
 * @param {number} [nightness] 0 = day, 1 = full night
 */
export function resolveControlPanelShelfDBrightness(nightness = 0) {
  const n = clampNightness(nightness);
  const day = loadControlPanelShelfDDayBrightness();
  const night = loadControlPanelShelfDNightBrightness();
  return day + (night - day) * n;
}

/**
 * @param {THREE.MeshStandardMaterial | null | undefined} material
 * @param {{
 *   brightness?: number,
 *   emissiveBrightness?: number,
 *   nightness?: number,
 *   emissiveIntensity?: number,
 *   blueBias?: number,
 * }} [options]
 */
export function applyControlPanelShelfDBrightness(material, options = {}) {
  if (!material) return;
  const brightness =
    options.brightness ??
    resolveControlPanelShelfDBrightness(options.nightness ?? 0);
  const emissiveBrightness =
    options.emissiveBrightness ??
    resolveControlPanelShelfDBrightness(options.nightness ?? 0);
  applyControlPanelSurfaceGlow(material, {
    brightness,
    emissiveBrightness,
    emissiveScale:
      options.emissiveIntensity ?? loadControlPanelPanelEmissiveIntensity(),
    blueBias: options.blueBias ?? loadControlPanelPanelBlueBias(),
  });
}
