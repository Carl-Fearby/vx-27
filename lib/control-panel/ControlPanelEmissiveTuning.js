import * as THREE from "three";

/** Tunable emissive scale + blue bias for screen C and shelf D (panel). */

export const CONTROL_PANEL_SCREEN_EMISSIVE_KEY =
  "fps-control-panel-screen-emissive";
export const CONTROL_PANEL_PANEL_EMISSIVE_KEY =
  "fps-control-panel-panel-emissive";
export const CONTROL_PANEL_SCREEN_BLUE_BIAS_KEY =
  "fps-control-panel-screen-blue-bias";
export const CONTROL_PANEL_PANEL_BLUE_BIAS_KEY =
  "fps-control-panel-panel-blue-bias";

/** Locked console tuning — screen C emissive scale. */
export const CONTROL_PANEL_SCREEN_EMISSIVE = 3.55;

/** Locked console tuning — shelf D (panel) emissive scale. */
export const CONTROL_PANEL_PANEL_EMISSIVE = 200;

/** @deprecated Use CONTROL_PANEL_PANEL_EMISSIVE */
export const CONTROL_PANEL_PANEL_EMISSIVE_DEFAULT =
  CONTROL_PANEL_PANEL_EMISSIVE;
export const CONTROL_PANEL_PANEL_EMISSIVE_MIN = 0.25;
/** @deprecated Use CONTROL_PANEL_PANEL_EMISSIVE */
export const CONTROL_PANEL_PANEL_EMISSIVE_MAX = CONTROL_PANEL_PANEL_EMISSIVE;

/** @deprecated Use CONTROL_PANEL_SCREEN_EMISSIVE */
export const CONTROL_PANEL_SCREEN_EMISSIVE_DEFAULT =
  CONTROL_PANEL_SCREEN_EMISSIVE;
/** @deprecated */
export const CONTROL_PANEL_EMISSIVE_DEFAULT = CONTROL_PANEL_SCREEN_EMISSIVE;
export const CONTROL_PANEL_EMISSIVE_MIN = CONTROL_PANEL_PANEL_EMISSIVE_MIN;
/** @deprecated Use CONTROL_PANEL_PANEL_EMISSIVE_MAX */
export const CONTROL_PANEL_EMISSIVE_MAX = CONTROL_PANEL_PANEL_EMISSIVE_MAX;

export const CONTROL_PANEL_BLUE_BIAS_MIN = 0;
export const CONTROL_PANEL_BLUE_BIAS_MAX = 1;

/** Baked blue bias — suppresses green/cyan wash on screen C. */
export const CONTROL_PANEL_SCREEN_BLUE_BIAS = 1;
/** Baked blue bias — suppresses green/cyan wash on shelf D. */
export const CONTROL_PANEL_PANEL_BLUE_BIAS = 1;

/** @deprecated Use CONTROL_PANEL_SCREEN_BLUE_BIAS */
export const CONTROL_PANEL_SCREEN_BLUE_BIAS_DEFAULT =
  CONTROL_PANEL_SCREEN_BLUE_BIAS;
/** @deprecated Use CONTROL_PANEL_PANEL_BLUE_BIAS */
export const CONTROL_PANEL_PANEL_BLUE_BIAS_DEFAULT =
  CONTROL_PANEL_PANEL_BLUE_BIAS;

const BASE_AO_INTENSITY = 0.4;
const _emissiveTint = new THREE.Color();

function clamp(value, min, max, fallback) {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export function loadControlPanelScreenEmissiveIntensity() {
  return CONTROL_PANEL_SCREEN_EMISSIVE;
}

export function loadControlPanelPanelEmissiveIntensity() {
  return CONTROL_PANEL_PANEL_EMISSIVE;
}

export function loadControlPanelScreenBlueBias() {
  return CONTROL_PANEL_SCREEN_BLUE_BIAS;
}

export function loadControlPanelPanelBlueBias() {
  return CONTROL_PANEL_PANEL_BLUE_BIAS;
}

/** @deprecated Screen emissive is baked. */
export function saveControlPanelScreenEmissiveIntensity(_value) {}

/** @deprecated Panel emissive is baked at 200. */
export function saveControlPanelPanelEmissiveIntensity(_value) {}

/** @deprecated Blue bias is baked. */
export function saveControlPanelScreenBlueBias(_value) {}

/** @deprecated Blue bias is baked. */
export function saveControlPanelPanelBlueBias(_value) {}

/**
 * Diffuse brightness unchanged; emissive tint shifted blue (not green-cyan).
 * @param {THREE.MeshStandardMaterial | null | undefined} material
 * @param {{
 *   brightness: number,
 *   emissiveScale: number,
 *   blueBias: number,
 *   emissiveBrightness?: number,
 * }} params
 */
export function applyControlPanelSurfaceGlow(material, params) {
  if (!material) return;
  const brightness = params.brightness;
  const emissiveBrightness = params.emissiveBrightness ?? brightness;
  const emissiveScale = params.emissiveScale;
  const blueBias = clamp(
    params.blueBias,
    CONTROL_PANEL_BLUE_BIAS_MIN,
    CONTROL_PANEL_BLUE_BIAS_MAX,
    CONTROL_PANEL_SCREEN_BLUE_BIAS_DEFAULT,
  );

  material.color.setScalar(brightness);
  material.aoMapIntensity = Math.max(
    0,
    BASE_AO_INTENSITY / Math.max(0.35, brightness),
  );

  _emissiveTint.setRGB(0.06, 0.28, 1.0);
  _emissiveTint.lerp(new THREE.Color(0x042870), blueBias);
  material.emissive.copy(_emissiveTint);
  material.emissiveIntensity =
    emissiveScale * (0.45 + emissiveBrightness * 0.4);
  material.needsUpdate = true;
}
