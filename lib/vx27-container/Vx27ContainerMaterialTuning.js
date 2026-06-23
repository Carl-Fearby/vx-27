export const VX27_CONTAINER_MATERIAL_TUNING_KEY = "fps-vx27-container-material-tuning";
export const VX27_CONTAINER_MATERIAL_TUNING_VERSION = 2;

/** @typedef {{
 *   exteriorBrightness: number,
 *   exteriorRoughness: number,
 *   exteriorMetalness: number,
 *   interiorBrightness: number,
 *   interiorRoughness: number,
 *   interiorMetalness: number,
 *   exteriorEmissiveIntensity: number,
 *   interiorEmissiveIntensity: number,
 *   normalScale: number,
 *   endcapTextureScale: number,
 *   cornerBevelUvRepeatU: number,
 *   cornerBevelUvRepeatV: number,
 *   cornerBevelBrightness: number,
 *   cornerBevelRoughness: number,
 *   cornerBevelMetalness: number,
 *   doorTextureScale: number,
 *   roofFloorFootprintScale: number,
 *   roofFloorUvRepeatU: number,
 *   roofFloorUvRepeatV: number,
 * }} Vx27ContainerMaterialTuning */

/** @type {Vx27ContainerMaterialTuning} */
export const DEFAULT_VX27_CONTAINER_MATERIAL_TUNING = {
  exteriorBrightness: 2.78,
  exteriorRoughness: 0.72,
  exteriorMetalness: 0,
  exteriorEmissiveIntensity: 22,
  interiorBrightness: 2.14,
  interiorRoughness: 1.81,
  interiorMetalness: 0.83,
  interiorEmissiveIntensity: 25,
  normalScale: 1,
  endcapTextureScale: 1,
  cornerBevelUvRepeatU: -21.07,
  cornerBevelUvRepeatV: 1,
  cornerBevelBrightness: 0.05,
  cornerBevelRoughness: 0,
  cornerBevelMetalness: 0.32,
  doorTextureScale: 1,
  roofFloorFootprintScale: 1,
  roofFloorUvRepeatU: 1,
  roofFloorUvRepeatV: 1,
};

export const VX27_CONTAINER_MATERIAL_LIMITS = {
  exteriorBrightness: { min: 0.05, max: 12, step: 0.01, nudge: 0.05 },
  exteriorRoughness: { min: 0, max: 3, step: 0.01, nudge: 0.05 },
  exteriorMetalness: { min: 0, max: 3, step: 0.01, nudge: 0.05 },
  exteriorEmissiveIntensity: { min: 0, max: 48, step: 0.1, nudge: 0.5 },
  interiorBrightness: { min: 0.05, max: 12, step: 0.01, nudge: 0.05 },
  interiorRoughness: { min: 0, max: 3, step: 0.01, nudge: 0.05 },
  interiorMetalness: { min: 0, max: 3, step: 0.01, nudge: 0.05 },
  interiorEmissiveIntensity: { min: 0, max: 48, step: 0.1, nudge: 0.5 },
  normalScale: { min: 0, max: 8, step: 0.05, nudge: 0.1 },
  endcapTextureScale: { min: 0.25, max: 4, step: 0.01, nudge: 0.02 },
  cornerBevelUvRepeatU: { min: -64, max: 64, step: 0.01, nudge: 0.1 },
  cornerBevelUvRepeatV: { min: -64, max: 64, step: 0.01, nudge: 0.1 },
  cornerBevelBrightness: { min: 0.05, max: 12, step: 0.01, nudge: 0.05 },
  cornerBevelRoughness: { min: 0, max: 3, step: 0.01, nudge: 0.05 },
  cornerBevelMetalness: { min: 0, max: 3, step: 0.01, nudge: 0.05 },
  doorTextureScale: { min: 0.25, max: 8, step: 0.01, nudge: 0.02 },
  roofFloorFootprintScale: { min: 0.5, max: 1.05, step: 0.005, nudge: 0.01 },
  roofFloorUvRepeatU: { min: -64, max: 64, step: 0.01, nudge: 0.1 },
  roofFloorUvRepeatV: { min: -64, max: 64, step: 0.01, nudge: 0.1 },
};

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** @param {Partial<Vx27ContainerMaterialTuning>} [patch] @returns {Vx27ContainerMaterialTuning} */
export function normalizeVx27ContainerMaterialTuning(patch) {
  const d = DEFAULT_VX27_CONTAINER_MATERIAL_TUNING;
  const L = VX27_CONTAINER_MATERIAL_LIMITS;
  const legacyEmissive = patch?.emissiveIntensity;
  const legacyCornerRepeat = patch?.cornerBevelUvRepeat;
  return {
    exteriorBrightness: clampNum(
      patch?.exteriorBrightness,
      L.exteriorBrightness.min,
      L.exteriorBrightness.max,
      d.exteriorBrightness
    ),
    exteriorRoughness: clampNum(
      patch?.exteriorRoughness,
      L.exteriorRoughness.min,
      L.exteriorRoughness.max,
      d.exteriorRoughness
    ),
    exteriorMetalness: clampNum(
      patch?.exteriorMetalness,
      L.exteriorMetalness.min,
      L.exteriorMetalness.max,
      d.exteriorMetalness
    ),
    exteriorEmissiveIntensity: clampNum(
      patch?.exteriorEmissiveIntensity ?? legacyEmissive,
      L.exteriorEmissiveIntensity.min,
      L.exteriorEmissiveIntensity.max,
      d.exteriorEmissiveIntensity
    ),
    interiorBrightness: clampNum(
      patch?.interiorBrightness,
      L.interiorBrightness.min,
      L.interiorBrightness.max,
      d.interiorBrightness
    ),
    interiorRoughness: clampNum(
      patch?.interiorRoughness,
      L.interiorRoughness.min,
      L.interiorRoughness.max,
      d.interiorRoughness
    ),
    interiorMetalness: clampNum(
      patch?.interiorMetalness,
      L.interiorMetalness.min,
      L.interiorMetalness.max,
      d.interiorMetalness
    ),
    interiorEmissiveIntensity: clampNum(
      patch?.interiorEmissiveIntensity ?? legacyEmissive,
      L.interiorEmissiveIntensity.min,
      L.interiorEmissiveIntensity.max,
      d.interiorEmissiveIntensity
    ),
    normalScale: clampNum(
      patch?.normalScale,
      L.normalScale.min,
      L.normalScale.max,
      d.normalScale
    ),
    endcapTextureScale: clampNum(
      patch?.endcapTextureScale,
      L.endcapTextureScale.min,
      L.endcapTextureScale.max,
      d.endcapTextureScale
    ),
    cornerBevelUvRepeatU: clampNum(
      patch?.cornerBevelUvRepeatU ?? legacyCornerRepeat,
      L.cornerBevelUvRepeatU.min,
      L.cornerBevelUvRepeatU.max,
      d.cornerBevelUvRepeatU
    ),
    cornerBevelUvRepeatV: clampNum(
      patch?.cornerBevelUvRepeatV ?? legacyCornerRepeat,
      L.cornerBevelUvRepeatV.min,
      L.cornerBevelUvRepeatV.max,
      d.cornerBevelUvRepeatV
    ),
    cornerBevelBrightness: clampNum(
      patch?.cornerBevelBrightness,
      L.cornerBevelBrightness.min,
      L.cornerBevelBrightness.max,
      d.cornerBevelBrightness
    ),
    cornerBevelRoughness: clampNum(
      patch?.cornerBevelRoughness,
      L.cornerBevelRoughness.min,
      L.cornerBevelRoughness.max,
      d.cornerBevelRoughness
    ),
    cornerBevelMetalness: clampNum(
      patch?.cornerBevelMetalness,
      L.cornerBevelMetalness.min,
      L.cornerBevelMetalness.max,
      d.cornerBevelMetalness
    ),
    doorTextureScale: clampNum(
      patch?.doorTextureScale,
      L.doorTextureScale.min,
      L.doorTextureScale.max,
      d.doorTextureScale
    ),
    roofFloorFootprintScale: clampNum(
      patch?.roofFloorFootprintScale,
      L.roofFloorFootprintScale.min,
      L.roofFloorFootprintScale.max,
      d.roofFloorFootprintScale
    ),
    roofFloorUvRepeatU: clampNum(
      patch?.roofFloorUvRepeatU,
      L.roofFloorUvRepeatU.min,
      L.roofFloorUvRepeatU.max,
      d.roofFloorUvRepeatU
    ),
    roofFloorUvRepeatV: clampNum(
      patch?.roofFloorUvRepeatV,
      L.roofFloorUvRepeatV.min,
      L.roofFloorUvRepeatV.max,
      d.roofFloorUvRepeatV
    ),
  };
}

/** @returns {Vx27ContainerMaterialTuning} */
export function loadVx27ContainerMaterialTuning() {
  if (typeof window === "undefined") {
    return { ...DEFAULT_VX27_CONTAINER_MATERIAL_TUNING };
  }
  try {
    const raw = localStorage.getItem(VX27_CONTAINER_MATERIAL_TUNING_KEY);
    if (!raw) return { ...DEFAULT_VX27_CONTAINER_MATERIAL_TUNING };
    const parsed = JSON.parse(raw);
    const storedVersion =
      typeof parsed.version === "number" ? parsed.version : 0;
    if (storedVersion < VX27_CONTAINER_MATERIAL_TUNING_VERSION) {
      saveVx27ContainerMaterialTuning(DEFAULT_VX27_CONTAINER_MATERIAL_TUNING);
      return { ...DEFAULT_VX27_CONTAINER_MATERIAL_TUNING };
    }
    return normalizeVx27ContainerMaterialTuning(parsed);
  } catch {
    return { ...DEFAULT_VX27_CONTAINER_MATERIAL_TUNING };
  }
}

/** @param {Vx27ContainerMaterialTuning} tuning */
export function saveVx27ContainerMaterialTuning(tuning) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    VX27_CONTAINER_MATERIAL_TUNING_KEY,
    JSON.stringify({
      ...normalizeVx27ContainerMaterialTuning(tuning),
      version: VX27_CONTAINER_MATERIAL_TUNING_VERSION,
    }),
  );
}

/** @param {Vx27ContainerMaterialTuning} tuning */
export function materialTuningDiffersFromDefault(tuning) {
  const d = DEFAULT_VX27_CONTAINER_MATERIAL_TUNING;
  const n = normalizeVx27ContainerMaterialTuning(tuning);
  return (
    Math.abs(n.exteriorBrightness - d.exteriorBrightness) > 1e-4 ||
    Math.abs(n.exteriorRoughness - d.exteriorRoughness) > 1e-4 ||
    Math.abs(n.exteriorMetalness - d.exteriorMetalness) > 1e-4 ||
    Math.abs(n.interiorBrightness - d.interiorBrightness) > 1e-4 ||
    Math.abs(n.interiorRoughness - d.interiorRoughness) > 1e-4 ||
    Math.abs(n.interiorMetalness - d.interiorMetalness) > 1e-4 ||
    Math.abs(n.exteriorEmissiveIntensity - d.exteriorEmissiveIntensity) > 1e-4 ||
    Math.abs(n.interiorEmissiveIntensity - d.interiorEmissiveIntensity) > 1e-4 ||
    Math.abs(n.normalScale - d.normalScale) > 1e-4 ||
    Math.abs(n.endcapTextureScale - d.endcapTextureScale) > 1e-4 ||
    Math.abs(n.cornerBevelUvRepeatU - d.cornerBevelUvRepeatU) > 1e-4 ||
    Math.abs(n.cornerBevelUvRepeatV - d.cornerBevelUvRepeatV) > 1e-4 ||
    Math.abs(n.cornerBevelBrightness - d.cornerBevelBrightness) > 1e-4 ||
    Math.abs(n.cornerBevelRoughness - d.cornerBevelRoughness) > 1e-4 ||
    Math.abs(n.cornerBevelMetalness - d.cornerBevelMetalness) > 1e-4 ||
    Math.abs(n.doorTextureScale - d.doorTextureScale) > 1e-4 ||
    Math.abs(n.roofFloorFootprintScale - d.roofFloorFootprintScale) > 1e-4 ||
    Math.abs(n.roofFloorUvRepeatU - d.roofFloorUvRepeatU) > 1e-4 ||
    Math.abs(n.roofFloorUvRepeatV - d.roofFloorUvRepeatV) > 1e-4
  );
}

/** @param {Vx27ContainerMaterialTuning} tuning */
export function exportVx27ContainerMaterialTuningJson(tuning) {
  const m = normalizeVx27ContainerMaterialTuning(tuning);
  return {
    exteriorBrightness: parseFloat(m.exteriorBrightness.toFixed(3)),
    exteriorRoughness: parseFloat(m.exteriorRoughness.toFixed(3)),
    exteriorMetalness: parseFloat(m.exteriorMetalness.toFixed(3)),
    exteriorEmissiveIntensity: parseFloat(m.exteriorEmissiveIntensity.toFixed(2)),
    interiorBrightness: parseFloat(m.interiorBrightness.toFixed(3)),
    interiorRoughness: parseFloat(m.interiorRoughness.toFixed(3)),
    interiorMetalness: parseFloat(m.interiorMetalness.toFixed(3)),
    interiorEmissiveIntensity: parseFloat(m.interiorEmissiveIntensity.toFixed(2)),
    normalScale: parseFloat(m.normalScale.toFixed(3)),
    endcapTextureScale: parseFloat(m.endcapTextureScale.toFixed(3)),
    cornerBevelUvRepeatU: parseFloat(m.cornerBevelUvRepeatU.toFixed(3)),
    cornerBevelUvRepeatV: parseFloat(m.cornerBevelUvRepeatV.toFixed(3)),
    cornerBevelBrightness: parseFloat(m.cornerBevelBrightness.toFixed(3)),
    cornerBevelRoughness: parseFloat(m.cornerBevelRoughness.toFixed(3)),
    cornerBevelMetalness: parseFloat(m.cornerBevelMetalness.toFixed(3)),
    doorTextureScale: parseFloat(m.doorTextureScale.toFixed(3)),
    roofFloorFootprintScale: parseFloat(m.roofFloorFootprintScale.toFixed(3)),
    roofFloorUvRepeatU: parseFloat(m.roofFloorUvRepeatU.toFixed(3)),
    roofFloorUvRepeatV: parseFloat(m.roofFloorUvRepeatV.toFixed(3)),
  };
}

/** @param {Vx27ContainerMaterialTuning} tuning */
export function formatVx27ContainerMaterialTuningForCopy(tuning) {
  return JSON.stringify(exportVx27ContainerMaterialTuningJson(tuning), null, 2);
}
