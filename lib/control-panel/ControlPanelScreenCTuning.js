/** Baked brightness for surface C screen (see ControlPanelShelfDTuning for D). */

export const CONTROL_PANEL_SCREEN_BRIGHTNESS_KEY =
  "fps-control-panel-screen-brightness";

export const CONTROL_PANEL_SCREEN_BRIGHTNESS_DEFAULT = 20;
export const CONTROL_PANEL_SCREEN_BRIGHTNESS_MIN = 10;
export const CONTROL_PANEL_SCREEN_BRIGHTNESS_MAX = 25;

export const CONTROL_PANEL_SCREEN_ROT_U_KEY = "fps-control-panel-screen-rot-u";
export const CONTROL_PANEL_SCREEN_ROT_V_KEY = "fps-control-panel-screen-rot-v";
export const CONTROL_PANEL_SCREEN_ROT_MIN = 0;
export const CONTROL_PANEL_SCREEN_ROT_MAX = 360;
export const CONTROL_PANEL_SCREEN_ROT_U_DEFAULT = 0;
export const CONTROL_PANEL_SCREEN_ROT_V_DEFAULT = 0;

const BASE_EMISSIVE_INTENSITY = 1.75;
const BASE_AO_INTENSITY = 0.4;

export function loadControlPanelScreenBrightness() {
  if (typeof localStorage === "undefined") {
    return CONTROL_PANEL_SCREEN_BRIGHTNESS_DEFAULT;
  }
  const raw = localStorage.getItem(CONTROL_PANEL_SCREEN_BRIGHTNESS_KEY);
  const v = Number(raw);
  if (!Number.isFinite(v)) return CONTROL_PANEL_SCREEN_BRIGHTNESS_DEFAULT;
  return Math.min(
    CONTROL_PANEL_SCREEN_BRIGHTNESS_MAX,
    Math.max(CONTROL_PANEL_SCREEN_BRIGHTNESS_MIN, v),
  );
}

export function saveControlPanelScreenBrightness(value) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CONTROL_PANEL_SCREEN_BRIGHTNESS_KEY, String(value));
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
 * @param {{ brightness?: number }} [options]
 */
export function applyControlPanelScreenBrightness(material, options = {}) {
  if (!material) return;
  const brightness =
    options.brightness ?? loadControlPanelScreenBrightness();
  material.color.setScalar(brightness);
  material.aoMapIntensity = Math.max(
    0,
    BASE_AO_INTENSITY / Math.max(0.35, brightness),
  );
  material.emissiveIntensity =
    BASE_EMISSIVE_INTENSITY * (0.45 + brightness * 0.4);
  material.needsUpdate = true;
}

