/** Baked brightness for surface D shelf (shelf_d mesh). */

export const CONTROL_PANEL_SHELF_D_BRIGHTNESS = 14;

const BASE_EMISSIVE_INTENSITY = 1.75;
const BASE_AO_INTENSITY = 0.4;

/**
 * @param {THREE.MeshStandardMaterial | null | undefined} material
 * @param {{ brightness?: number }} [options]
 */
export function applyControlPanelShelfDBrightness(material, options = {}) {
  if (!material) return;
  const brightness =
    options.brightness ?? CONTROL_PANEL_SHELF_D_BRIGHTNESS;
  material.color.setScalar(brightness);
  material.aoMapIntensity = Math.max(
    0,
    BASE_AO_INTENSITY / Math.max(0.35, brightness),
  );
  material.emissiveIntensity =
    BASE_EMISSIVE_INTENSITY * (0.45 + brightness * 0.4);
  material.needsUpdate = true;
}
