/**
 * Surface D (shelf_d mesh) — not the grey hull body.
 * Gameplay HUD brightness scales diffuse + emissive on the shelf texture maps.
 */

export const CONTROL_PANEL_SHELF_D_BRIGHTNESS_KEY =
  "fps-control-panel-shelf-d-brightness";

export const CONTROL_PANEL_SHELF_D_BRIGHTNESS_DEFAULT = 14;
export const CONTROL_PANEL_SHELF_D_BRIGHTNESS_MIN = 0;
export const CONTROL_PANEL_SHELF_D_BRIGHTNESS_MAX = 25;

const BASE_EMISSIVE_INTENSITY = 1.75;
const BASE_AO_INTENSITY = 0.4;

export function loadControlPanelShelfDBrightness() {
  if (typeof localStorage === "undefined") {
    return CONTROL_PANEL_SHELF_D_BRIGHTNESS_DEFAULT;
  }
  const raw = localStorage.getItem(CONTROL_PANEL_SHELF_D_BRIGHTNESS_KEY);
  const v = Number(raw);
  if (!Number.isFinite(v)) return CONTROL_PANEL_SHELF_D_BRIGHTNESS_DEFAULT;
  return Math.min(
    CONTROL_PANEL_SHELF_D_BRIGHTNESS_MAX,
    Math.max(CONTROL_PANEL_SHELF_D_BRIGHTNESS_MIN, v),
  );
}

export function saveControlPanelShelfDBrightness(value) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CONTROL_PANEL_SHELF_D_BRIGHTNESS_KEY, String(value));
}

/**
 * @param {THREE.MeshStandardMaterial | null | undefined} material
 * @param {{ brightness?: number }} [options]
 */
export function applyControlPanelShelfDBrightness(material, options = {}) {
  if (!material) return;
  const brightness =
    options.brightness ?? loadControlPanelShelfDBrightness();
  material.color.setScalar(brightness);
  material.aoMapIntensity = Math.max(
    0,
    BASE_AO_INTENSITY / Math.max(0.35, brightness),
  );
  material.emissiveIntensity =
    BASE_EMISSIVE_INTENSITY * (0.45 + brightness * 0.4);
  material.needsUpdate = true;
}
