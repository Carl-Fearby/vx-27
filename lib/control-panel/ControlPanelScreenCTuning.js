import {
  applyControlPanelSurfaceGlow,
  CONTROL_PANEL_EMISSIVE_DEFAULT,
  loadControlPanelScreenBlueBias,
} from "./ControlPanelEmissiveTuning.js";

/** Surface C screen — baked day/night brightness + UV rotation. */

/** Locked from console tuning (screen day / night). */
export const CONTROL_PANEL_SCREEN_DAY_BRIGHTNESS = 27.5;
export const CONTROL_PANEL_SCREEN_NIGHT_BRIGHTNESS = 21;

/** @deprecated */
export const CONTROL_PANEL_SCREEN_DAY_BRIGHTNESS_DEFAULT =
  CONTROL_PANEL_SCREEN_DAY_BRIGHTNESS;
/** @deprecated */
export const CONTROL_PANEL_SCREEN_NIGHT_BRIGHTNESS_DEFAULT =
  CONTROL_PANEL_SCREEN_NIGHT_BRIGHTNESS;
/** @deprecated */
export const CONTROL_PANEL_SCREEN_BRIGHTNESS_DEFAULT =
  CONTROL_PANEL_SCREEN_DAY_BRIGHTNESS;

export const CONTROL_PANEL_SCREEN_ROT_U_KEY = "fps-control-panel-screen-rot-u";
export const CONTROL_PANEL_SCREEN_ROT_V_KEY = "fps-control-panel-screen-rot-v";
export const CONTROL_PANEL_SCREEN_ROT_MIN = 0;
export const CONTROL_PANEL_SCREEN_ROT_MAX = 360;
export const CONTROL_PANEL_SCREEN_ROT_U_DEFAULT = 0;
export const CONTROL_PANEL_SCREEN_ROT_V_DEFAULT = 0;

function clampNightness(nightness) {
  return Math.min(1, Math.max(0, nightness ?? 0));
}

export function loadControlPanelScreenDayBrightness() {
  return CONTROL_PANEL_SCREEN_DAY_BRIGHTNESS;
}

export function loadControlPanelScreenNightBrightness() {
  return CONTROL_PANEL_SCREEN_NIGHT_BRIGHTNESS;
}

/** @deprecated */
export function loadControlPanelScreenBrightness() {
  return CONTROL_PANEL_SCREEN_DAY_BRIGHTNESS;
}

/** @deprecated Brightness is baked. */
export function saveControlPanelScreenDayBrightness(_value) {}

/** @deprecated Brightness is baked. */
export function saveControlPanelScreenNightBrightness(_value) {}

/** @deprecated */
export function saveControlPanelScreenBrightness(_value) {}

/**
 * @param {number} [nightness] 0 = day, 1 = full night
 */
export function resolveControlPanelScreenBrightness(nightness = 0) {
  const n = clampNightness(nightness);
  const day = CONTROL_PANEL_SCREEN_DAY_BRIGHTNESS;
  const night = CONTROL_PANEL_SCREEN_NIGHT_BRIGHTNESS;
  return day + (night - day) * n;
}

function clampRotationDeg(value, fallback) {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(
    CONTROL_PANEL_SCREEN_ROT_MAX,
    Math.max(CONTROL_PANEL_SCREEN_ROT_MIN, v),
  );
}

export function loadControlPanelScreenRotU() {
  if (typeof localStorage === "undefined") {
    return CONTROL_PANEL_SCREEN_ROT_U_DEFAULT;
  }
  return clampRotationDeg(
    localStorage.getItem(CONTROL_PANEL_SCREEN_ROT_U_KEY),
    CONTROL_PANEL_SCREEN_ROT_U_DEFAULT,
  );
}

export function loadControlPanelScreenRotV() {
  if (typeof localStorage === "undefined") {
    return CONTROL_PANEL_SCREEN_ROT_V_DEFAULT;
  }
  return clampRotationDeg(
    localStorage.getItem(CONTROL_PANEL_SCREEN_ROT_V_KEY),
    CONTROL_PANEL_SCREEN_ROT_V_DEFAULT,
  );
}

export function saveControlPanelScreenRotU(value) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CONTROL_PANEL_SCREEN_ROT_U_KEY, String(value));
}

export function saveControlPanelScreenRotV(value) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CONTROL_PANEL_SCREEN_ROT_V_KEY, String(value));
}

const SCREEN_UV_CENTER = 0.5;

/** Default: mesh UV U is mirrored (1−u) so authored maps read correctly on the slope. */
export const CONTROL_PANEL_SCREEN_MIRROR_U = true;

/** @param {number} u */
export function mirrorControlPanelScreenU(u) {
  return 1 - u;
}

/** Rotate UV around texture centre (0.5, 0.5). */
export function rotateScreenUVAroundCenter(u, v, deg) {
  const r = (deg * Math.PI) / 180;
  const cu = Math.cos(r);
  const su = Math.sin(r);
  const ux = u - SCREEN_UV_CENTER;
  const vy = v - SCREEN_UV_CENTER;
  return [
    SCREEN_UV_CENTER + ux * cu - vy * su,
    SCREEN_UV_CENTER + ux * su + vy * cu,
  ];
}

/**
 * @param {number} u
 * @param {number} v
 * @param {number} rotUDeg
 * @param {number} rotVDeg
 */
export function transformControlPanelScreenUV(u, v, rotUDeg, rotVDeg) {
  let uu = CONTROL_PANEL_SCREEN_MIRROR_U ? mirrorControlPanelScreenU(u) : u;
  let vv = v;
  [uu, vv] = rotateScreenUVAroundCenter(uu, vv, rotUDeg);
  [uu, vv] = rotateScreenUVAroundCenter(uu, vv, rotVDeg);
  return [uu, vv];
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
export function applyControlPanelScreenBrightness(material, options = {}) {
  if (!material) return;
  const brightness =
    options.brightness ??
    resolveControlPanelScreenBrightness(options.nightness ?? 0);
  const emissiveBrightness =
    options.emissiveBrightness ??
    resolveControlPanelScreenBrightness(options.nightness ?? 0);
  applyControlPanelSurfaceGlow(material, {
    brightness,
    emissiveBrightness,
    emissiveScale:
      options.emissiveIntensity ?? CONTROL_PANEL_EMISSIVE_DEFAULT,
    blueBias: options.blueBias ?? loadControlPanelScreenBlueBias(),
  });
}
