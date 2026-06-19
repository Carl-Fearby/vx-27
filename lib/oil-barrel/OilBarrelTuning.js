export const OIL_BARREL_TUNING_KEY = "fps-oil-barrel-tuning";

/** @typedef {{
 *   topCap: boolean,
 *   bodyBrightness: number,
 *   capBrightness: number,
 *   warmth: number,
 *   blueTint: number,
 *   roughness: number,
 *   emissiveIntensity: number,
 *   normalScale: number,
 *   capContrast: number,
 *   capNormalScale: number,
 *   interiorTextureRotation: number,
 *   rimTileU: number,
 *   rimTileV: number,
 *   interiorFire: boolean,
 *   interiorVideoWidthScale: number,
 *   interiorVideoHeightScale: number,
 *   interiorVideoCenterOffsetX: number,
 *   interiorVideoCenterOffsetY: number,
 *   interiorFireOffsetX: number,
 *   interiorFlameTexBottom: number,
 *   interiorFlameTexTop: number,
 *   interiorFireLightIntensity: number,
 *   interiorFireShadowIntensity: number,
 *   interiorFireLightLeftX: number,
 *   interiorFireLightRightX: number,
 *   interiorFireLightLeftY: number,
 *   interiorFireLightRightY: number,
 * }} OilBarrelTuning */

/** @type {OilBarrelTuning} */
export const DEFAULT_OIL_BARREL_TUNING = {
  topCap: false,
  bodyBrightness: 7.05,
  capBrightness: 2.85,
  warmth: 1.06,
  blueTint: 1.1,
  roughness: 0.47,
  emissiveIntensity: 24,
  normalScale: 5.2,
  capContrast: 2.4,
  capNormalScale: 4.3,
  interiorTextureRotation: 0,
  rimTileU: 2.8,
  rimTileV: 3.85,
  interiorFire: true,
  interiorVideoWidthScale: 1.9,
  interiorVideoHeightScale: 2,
  interiorVideoCenterOffsetX: -0.195,
  interiorVideoCenterOffsetY: 0.185,
  /** Extra X for flame video + flicker light (stacks with video centre offset). */
  interiorFireOffsetX: 0.185,
  interiorFlameTexBottom: 0.15,
  interiorFlameTexTop: 0.92,
  interiorFireLightIntensity: 7,
  /** Shadow edge softness — lower = wider penumbra; umbra stays fully dark. */
  interiorFireShadowIntensity: 0.15,
  /** Rig-local offsets for the L/R flicker lights (metres). */
  interiorFireLightLeftX: -0.042,
  interiorFireLightRightX: 0.042,
  interiorFireLightLeftY: 0,
  interiorFireLightRightY: 0,
};

/** Slider / clamp bounds — keep panel ranges in sync with normalize. */
export const OIL_BARREL_TUNING_LIMITS = {
  bodyBrightness: { min: 0.1, max: 12, step: 0.05, nudge: 0.05 },
  capBrightness: { min: 0.1, max: 12, step: 0.05, nudge: 0.05 },
  warmth: { min: 0.5, max: 2, step: 0.01, nudge: 0.01 },
  blueTint: { min: 0.2, max: 2, step: 0.01, nudge: 0.01 },
  roughness: { min: 0, max: 1, step: 0.01, nudge: 0.01 },
  emissiveIntensity: { min: 0, max: 24, step: 0.1, nudge: 0.5 },
  normalScale: { min: 0, max: 8, step: 0.05, nudge: 0.1 },
  capContrast: { min: 0.5, max: 3, step: 0.05, nudge: 0.05 },
  capNormalScale: { min: 0, max: 12, step: 0.05, nudge: 0.1 },
  interiorTextureRotation: { min: 0, max: 360, step: 1, nudge: 5 },
  rimTileU: { min: 0.25, max: 4, step: 0.05, nudge: 0.1 },
  rimTileV: { min: 0.25, max: 4, step: 0.05, nudge: 0.1 },
  interiorVideoWidthScale: { min: 0.5, max: 24, step: 0.1, nudge: 0.5 },
  interiorVideoHeightScale: { min: 0.5, max: 24, step: 0.1, nudge: 0.5 },
  interiorVideoCenterOffsetX: { min: -0.2, max: 0.2, step: 0.005, nudge: 0.01 },
  interiorVideoCenterOffsetY: { min: -0.2, max: 0.2, step: 0.005, nudge: 0.01 },
  interiorFireOffsetX: { min: -0.2, max: 0.2, step: 0.005, nudge: 0.01 },
  interiorFlameTexBottom: { min: 0, max: 0.98, step: 0.01, nudge: 0.02 },
  interiorFlameTexTop: { min: 0.02, max: 1, step: 0.01, nudge: 0.02 },
  interiorFireLightIntensity: { min: 0, max: 40, step: 0.5, nudge: 1 },
  interiorFireShadowIntensity: { min: 0, max: 1, step: 0.05, nudge: 0.05 },
  interiorFireLightLeftX: { min: -0.15, max: 0.15, step: 0.005, nudge: 0.01 },
  interiorFireLightRightX: { min: -0.15, max: 0.15, step: 0.005, nudge: 0.01 },
  interiorFireLightLeftY: { min: -0.15, max: 0.15, step: 0.005, nudge: 0.01 },
  interiorFireLightRightY: { min: -0.15, max: 0.15, step: 0.005, nudge: 0.01 },
};

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** @param {Partial<OilBarrelTuning>} patch */
export function normalizeOilBarrelTuning(patch) {
  const d = DEFAULT_OIL_BARREL_TUNING;
  const L = OIL_BARREL_TUNING_LIMITS;
  return {
    topCap:
      patch.topCap === false
        ? false
        : patch.topCap === true
          ? true
          : d.topCap !== false,
    bodyBrightness: clampNum(
      patch.bodyBrightness,
      L.bodyBrightness.min,
      L.bodyBrightness.max,
      d.bodyBrightness
    ),
    capBrightness: clampNum(
      patch.capBrightness,
      L.capBrightness.min,
      L.capBrightness.max,
      d.capBrightness
    ),
    warmth: clampNum(patch.warmth, L.warmth.min, L.warmth.max, d.warmth),
    blueTint: clampNum(patch.blueTint, L.blueTint.min, L.blueTint.max, d.blueTint),
    roughness: clampNum(
      patch.roughness,
      L.roughness.min,
      L.roughness.max,
      d.roughness
    ),
    emissiveIntensity: clampNum(
      patch.emissiveIntensity,
      L.emissiveIntensity.min,
      L.emissiveIntensity.max,
      d.emissiveIntensity
    ),
    normalScale: clampNum(
      patch.normalScale,
      L.normalScale.min,
      L.normalScale.max,
      d.normalScale
    ),
    capContrast: clampNum(
      patch.capContrast,
      L.capContrast.min,
      L.capContrast.max,
      d.capContrast
    ),
    capNormalScale: clampNum(
      patch.capNormalScale,
      L.capNormalScale.min,
      L.capNormalScale.max,
      d.capNormalScale
    ),
    interiorTextureRotation: clampNum(
      patch.interiorTextureRotation ?? patch.textureRotation,
      L.interiorTextureRotation.min,
      L.interiorTextureRotation.max,
      d.interiorTextureRotation
    ),
    rimTileU: clampNum(patch.rimTileU, L.rimTileU.min, L.rimTileU.max, d.rimTileU),
    rimTileV: clampNum(patch.rimTileV, L.rimTileV.min, L.rimTileV.max, d.rimTileV),
    interiorVideoWidthScale: clampNum(
      patch.interiorVideoWidthScale,
      L.interiorVideoWidthScale.min,
      L.interiorVideoWidthScale.max,
      d.interiorVideoWidthScale
    ),
    interiorVideoHeightScale: clampNum(
      patch.interiorVideoHeightScale,
      L.interiorVideoHeightScale.min,
      L.interiorVideoHeightScale.max,
      d.interiorVideoHeightScale
    ),
    interiorFire:
      patch.interiorFire === false
        ? false
        : patch.interiorFire === true
          ? true
          : d.interiorFire !== false,
    interiorVideoCenterOffsetX: clampNum(
      patch.interiorVideoCenterOffsetX,
      L.interiorVideoCenterOffsetX.min,
      L.interiorVideoCenterOffsetX.max,
      d.interiorVideoCenterOffsetX
    ),
    interiorVideoCenterOffsetY: clampNum(
      patch.interiorVideoCenterOffsetY,
      L.interiorVideoCenterOffsetY.min,
      L.interiorVideoCenterOffsetY.max,
      d.interiorVideoCenterOffsetY
    ),
    interiorFireOffsetX: clampNum(
      patch.interiorFireOffsetX,
      L.interiorFireOffsetX.min,
      L.interiorFireOffsetX.max,
      d.interiorFireOffsetX
    ),
    interiorFlameTexBottom: clampNum(
      patch.interiorFlameTexBottom,
      L.interiorFlameTexBottom.min,
      L.interiorFlameTexBottom.max,
      d.interiorFlameTexBottom
    ),
    interiorFlameTexTop: clampNum(
      patch.interiorFlameTexTop,
      L.interiorFlameTexTop.min,
      L.interiorFlameTexTop.max,
      d.interiorFlameTexTop
    ),
    interiorFireLightIntensity: clampNum(
      patch.interiorFireLightIntensity,
      L.interiorFireLightIntensity.min,
      L.interiorFireLightIntensity.max,
      d.interiorFireLightIntensity
    ),
    interiorFireShadowIntensity: clampNum(
      patch.interiorFireShadowIntensity,
      L.interiorFireShadowIntensity.min,
      L.interiorFireShadowIntensity.max,
      d.interiorFireShadowIntensity
    ),
    interiorFireLightLeftX: clampNum(
      patch.interiorFireLightLeftX,
      L.interiorFireLightLeftX.min,
      L.interiorFireLightLeftX.max,
      d.interiorFireLightLeftX
    ),
    interiorFireLightRightX: clampNum(
      patch.interiorFireLightRightX,
      L.interiorFireLightRightX.min,
      L.interiorFireLightRightX.max,
      d.interiorFireLightRightX
    ),
    interiorFireLightLeftY: clampNum(
      patch.interiorFireLightLeftY,
      L.interiorFireLightLeftY.min,
      L.interiorFireLightLeftY.max,
      d.interiorFireLightLeftY
    ),
    interiorFireLightRightY: clampNum(
      patch.interiorFireLightRightY,
      L.interiorFireLightRightY.min,
      L.interiorFireLightRightY.max,
      d.interiorFireLightRightY
    ),
  };
}

/** @param {OilBarrelTuning} tuning */
export function normalizeFlameTexVRange(tuning) {
  const L = OIL_BARREL_TUNING_LIMITS;
  const d = DEFAULT_OIL_BARREL_TUNING;
  let v0 = clampNum(
    tuning.interiorFlameTexBottom,
    L.interiorFlameTexBottom.min,
    L.interiorFlameTexBottom.max,
    d.interiorFlameTexBottom
  );
  let v1 = clampNum(
    tuning.interiorFlameTexTop,
    L.interiorFlameTexTop.min,
    L.interiorFlameTexTop.max,
    d.interiorFlameTexTop
  );
  v0 = Math.min(v0, 0.98);
  v1 = Math.min(v1, 1);
  if (v1 < v0 + 0.02) {
    v1 = Math.min(L.interiorFlameTexTop.max, v0 + 0.02);
  }
  return { sampleV0: v0, sampleV1: v1 };
}

/** @returns {OilBarrelTuning} */
export function loadOilBarrelTuning() {
  return { ...DEFAULT_OIL_BARREL_TUNING };
}

/** @param {OilBarrelTuning} tuning */
export function saveOilBarrelTuning(tuning) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    OIL_BARREL_TUNING_KEY,
    JSON.stringify(normalizeOilBarrelTuning(tuning))
  );
}

