import * as THREE from "three";
import {
  attachCandleFlickerLight,
  deriveBarrelFlickerSeeds,
  resetCandleFlicker,
} from "../lighting/CandleFlicker.js";
import {
  pinLightToLayers,
  ROOM_INTERIOR_LAYER,
  WORLD_LAYER,
} from "../lighting/LightingLayers.js";
import { computeInteriorFlameLayout } from "./OilBarrelInteriorVideo.js";

/** Warm flame — lights interior wall + nearby room shell. */
const FIRE_LIGHT_COLOR = 0xff9922;
const FIRE_LIGHT_DISTANCE = 6;
const FIRE_LIGHT_DECAY = 2;
const FIRE_LIGHT_SHADOW_MAP = 512;
/** Umbra stays fully dark — slider softens the penumbra instead. */
const FIRE_LIGHT_SHADOW_UMBRA_INTENSITY = 1;
const FIRE_LIGHT_SHADOW_RADIUS_SOFT = 7;
const FIRE_LIGHT_SHADOW_RADIUS_CRISP = 2;
const FIRE_LIGHT_SHADOW_BLUR_SOFT = 22;
const FIRE_LIGHT_SHADOW_BLUR_CRISP = 8;
/** Key vs fill — room fill is world-layer only so wall umbra stays black. */
const FIRE_LIGHT_SHADOW_SIDE_INTENSITY_FACTOR = 0.55;
const FIRE_LIGHT_FILL_SIDE_INTENSITY_FACTOR = 0.28;
const FIRE_LIGHT_OUTDOOR_FILL_SIDE_INTENSITY_FACTOR = 0.36;

export const OIL_BARREL_FIRE_LIGHT_RIG_NAME = "oil_barrel_fire_lights";
const FIRE_LIGHT_NAME_L = "oil_barrel_fire_light_l";
const FIRE_LIGHT_NAME_R = "oil_barrel_fire_light_r";

/** Stable unique seed from level prop id; random when no id. */
export function barrelFireFlickerSeedFromPropId(propId) {
  if (!propId) return Math.random() * 1e6;
  let h = 2166136261;
  for (let i = 0; i < propId.length; i += 1) {
    h ^= propId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967296) * 1e6;
}

export function ensureBarrelFireFlickerSeed(barrel) {
  if (!barrel?.userData) return Math.random() * 1e6;
  if (barrel.userData.fireFlickerSeed == null) {
    barrel.userData.fireFlickerSeed = Math.random() * 1e6;
  }
  return barrel.userData.fireFlickerSeed;
}

/** @param {THREE.PointLight} light */
function getOilBarrelFromFireLight(light) {
  let node = light?.parent;
  while (node) {
    if (node.name === "oil_barrel" || node.userData?.innerRadius != null) {
      return node;
    }
    node = node.parent;
  }
  return null;
}

/** Faster shimmer + dips than room candles — snappy so shadows track the flame. */
export const OIL_BARREL_FLICKER_OPTS = {
  baseFactor: 0.82,
  wobbleAmp: 0.24,
  wobbleSpeed: 4.2,
  dipMinGap: 0.1,
  dipMaxGap: 0.45,
  dipDuration: 0.04,
  dipMinStrength: 0.3,
  dipMaxStrength: 0.55,
  /** Each L/R light drifts vertically on its own phase. */
  positionDriftAmpY: 0.06,
  positionDriftSpeed: 2.1,
};

/** @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning */
export function getInteriorFireLightIntensity(tuning) {
  const n = tuning.interiorFireLightIntensity;
  return Number.isFinite(n) ? n : 3;
}

function perSideFireLightIntensity(tuning, side, roomId = null) {
  const total = getInteriorFireLightIntensity(tuning);
  if (side > 0) {
    const fillFactor = roomId
      ? FIRE_LIGHT_FILL_SIDE_INTENSITY_FACTOR
      : FIRE_LIGHT_OUTDOOR_FILL_SIDE_INTENSITY_FACTOR;
    return total * fillFactor;
  }
  return total * FIRE_LIGHT_SHADOW_SIDE_INTENSITY_FACTOR;
}

/**
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning
 * @param {-1 | 1} side
 */
export function getFireLightSideOffset(tuning, side) {
  const d = side < 0;
  return {
    x: d ? tuning.interiorFireLightLeftX : tuning.interiorFireLightRightX,
    y: d ? tuning.interiorFireLightLeftY : tuning.interiorFireLightRightY,
    z: 0,
  };
}

/** @param {import("./OilBarrelTuning.js").OilBarrelTuning} [tuning] */
export function getInteriorFireShadowStrength(tuning) {
  const n = tuning?.interiorFireShadowIntensity;
  return Number.isFinite(n) ? THREE.MathUtils.clamp(n, 0, 1) : 1;
}

/** @deprecated alias */
export function getInteriorFireShadowIntensity(tuning) {
  return getInteriorFireShadowStrength(tuning);
}

/**
 * Key light defines a fully dark umbra; fill only illuminates (no second shadow).
 * Strength slider softens the penumbra — it does not grey out the shadow core.
 * @param {THREE.PointLight} light
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning | null} tuning
 * @param {-1 | 1} [side]
 */
export function configureOilBarrelFireLightShadow(
  light,
  tuning = null,
  side = light?.userData?.fireLightSide ?? -1
) {
  if (!light?.isPointLight || !light.shadow) return;
  const strength = getInteriorFireShadowStrength(tuning);
  const isKey = side <= 0;

  light.shadow.mapSize.set(FIRE_LIGHT_SHADOW_MAP, FIRE_LIGHT_SHADOW_MAP);
  light.shadow.intensity = FIRE_LIGHT_SHADOW_UMBRA_INTENSITY;
  light.shadow.bias = -0.0008;
  light.shadow.normalBias = 0.02;
  light.shadow.camera.near = 0.05;
  light.shadow.camera.far = 8;

  if (!isKey || strength <= 0.001) {
    light.castShadow = false;
    return;
  }

  light.castShadow = true;
  // Lower strength = wider, softer falloff at the edges; umbra stays black.
  light.shadow.radius = THREE.MathUtils.lerp(
    FIRE_LIGHT_SHADOW_RADIUS_SOFT,
    FIRE_LIGHT_SHADOW_RADIUS_CRISP,
    strength
  );
  light.shadow.blurSamples = Math.round(
    THREE.MathUtils.lerp(
      FIRE_LIGHT_SHADOW_BLUR_SOFT,
      FIRE_LIGHT_SHADOW_BLUR_CRISP,
      strength
    )
  );
}

/** Room fill stays off the room pass so key-shadow umbra on walls stays black. */
function pinFireLightToLayers(light, roomId, side) {
  if (roomId && side > 0) {
    pinLightToLayers(light, WORLD_LAYER);
  } else {
    pinLightToLayers(light, ROOM_INTERIOR_LAYER, WORLD_LAYER);
  }
}

function isOilBarrelFirePointLight(obj) {
  return (
    obj?.isPointLight &&
    (obj.userData?.isOilBarrelFireLight ||
      obj.name === FIRE_LIGHT_NAME_L ||
      obj.name === FIRE_LIGHT_NAME_R ||
      obj.name === "oil_barrel_fire_light")
  );
}

/**
 * @param {THREE.Group} rig
 * @param {-1 | 1} side
 * @param {number} intensity
 * @param {string | null} roomId
 */
function createFireLightSide(rig, side, intensity, roomId, tuning) {
  const light = new THREE.PointLight(
    FIRE_LIGHT_COLOR,
    intensity,
    FIRE_LIGHT_DISTANCE,
    FIRE_LIGHT_DECAY
  );
  light.name = side < 0 ? FIRE_LIGHT_NAME_L : FIRE_LIGHT_NAME_R;
  configureOilBarrelFireLightShadow(light, tuning, side);
  pinFireLightToLayers(light, roomId, side);
  light.userData.isOilBarrelFireLight = true;
  light.userData.fireLightSide = side;
  light.userData.roomId = roomId;
  rig.add(light);
  return light;
}

function applyFireLightSidePositions(rig, tuning) {
  rig.traverse((child) => {
    if (!isOilBarrelFirePointLight(child)) return;
    const side =
      child.userData.fireLightSide ??
      (child.name === FIRE_LIGHT_NAME_L ? -1 : 1);
    const offset = getFireLightSideOffset(tuning, side);
    child.position.set(offset.x, offset.y, offset.z);
    if (child.userData.candleFlicker?.basePosition) {
      child.userData.candleFlicker.basePosition.copy(child.position);
    }
  });
}

function applyFireLightRigLayout(rig, layout, tuning) {
  rig.position.set(layout.x, layout.y, layout.z);
  rig.rotation.set(0, 0, 0);
  applyFireLightSidePositions(rig, tuning);
  const roomId = rig.userData.roomId ?? null;
  rig.traverse((child) => {
    if (!isOilBarrelFirePointLight(child)) return;
    const side =
      child.userData.fireLightSide ??
      (child.name === FIRE_LIGHT_NAME_L ? -1 : 1);
    pinFireLightToLayers(child, roomId, side);
    const intensity = perSideFireLightIntensity(tuning, side, roomId);
    if (child.userData.candleFlicker) {
      child.userData.candleFlicker.baseIntensity = intensity;
    } else {
      child.intensity = intensity;
    }
  });
}

/**
 * @param {THREE.Group} barrelGroup
 * @param {number} innerRadius
 * @param {number} innerWallHeight
 * @param {number} floorY
 * @param {number} rimY
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning
 * @param {string | null} [roomId]
 */
export function addOilBarrelFireLight(
  barrelGroup,
  innerRadius,
  innerWallHeight,
  floorY,
  rimY,
  tuning,
  roomId = null
) {
  if (tuning.interiorFire === false) return null;

  const layout = computeInteriorFlameLayout(
    innerRadius,
    floorY,
    rimY,
    tuning
  );

  const rig = new THREE.Group();
  rig.name = OIL_BARREL_FIRE_LIGHT_RIG_NAME;
  rig.userData.isOilBarrelFireLightRig = true;
  rig.userData.roomId = roomId;
  ensureBarrelFireFlickerSeed(barrelGroup);

  createFireLightSide(rig, -1, perSideFireLightIntensity(tuning, -1, roomId), roomId, tuning);
  createFireLightSide(rig, 1, perSideFireLightIntensity(tuning, 1, roomId), roomId, tuning);
  applyFireLightRigLayout(rig, layout, tuning);

  barrelGroup.add(rig);
  return rig;
}

/**
 * @param {THREE.Object3D} root
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning
 */
export function refreshOilBarrelFireLights(root, tuning) {
  if (!root) return;
  const firesOn = tuning.interiorFire !== false;

  root.traverse((obj) => {
    if (obj.userData?.isOilBarrelFireLightRig && obj.isGroup) {
      obj.visible = firesOn;
      const barrel = obj.parent;
      const ud = barrel?.userData;
      if (!firesOn || !ud || ud.innerRadius == null || ud.floorY == null) {
        return;
      }
      const layout = computeInteriorFlameLayout(
        ud.innerRadius,
        ud.floorY,
        ud.clipTopY ?? 0,
        tuning
      );
      applyFireLightRigLayout(obj, layout, tuning);
      // Drop legacy VSM shadow spots — point lights cast again.
      const legacySpots = [];
      obj.traverse((child) => {
        if (
          child?.isSpotLight &&
          (child.name === "oil_barrel_fire_shadow_spot" ||
            child.userData?.isOilBarrelFireShadowSpot)
        ) {
          legacySpots.push(child);
        }
      });
      for (const spot of legacySpots) {
        if (spot.target?.parent === obj) obj.remove(spot.target);
        obj.remove(spot);
      }
      obj.traverse((child) => {
        if (!isOilBarrelFirePointLight(child)) return;
        const side =
          child.userData.fireLightSide ??
          (child.name === FIRE_LIGHT_NAME_L ? -1 : 1);
        const roomId = obj.userData.roomId ?? null;
        pinFireLightToLayers(child, roomId, side);
        configureOilBarrelFireLightShadow(child, tuning, side);
      });
      return;
    }

    if (!isOilBarrelFirePointLight(obj) || obj.parent?.userData?.isOilBarrelFireLightRig) {
      return;
    }

    // Legacy single centre light (pre-pair barrels).
    configureOilBarrelFireLightShadow(obj, tuning, 0);
    const barrel = obj.parent;
    const ud = barrel?.userData;
    obj.visible = firesOn;
    if (!firesOn || !ud || ud.innerRadius == null || ud.floorY == null) return;
    const layout = computeInteriorFlameLayout(
      ud.innerRadius,
      ud.floorY,
      ud.clipTopY ?? 0,
      tuning
    );
    obj.position.set(layout.x, layout.y, layout.z);
    const intensity = getInteriorFireLightIntensity(tuning);
    if (obj.userData.candleFlicker) {
      obj.userData.candleFlicker.baseIntensity = intensity;
      if (obj.userData.candleFlicker.basePosition) {
        obj.userData.candleFlicker.basePosition.copy(obj.position);
      }
    } else {
      obj.intensity = intensity;
    }
  });
}

/**
 * Toggle fire-light shadow maps (warmup disables these — L+R per barrel exceeds
 * MAX_TEXTURE_IMAGE_UNITS when combined with sun/moon/material maps).
 * @param {THREE.Object3D} root
 * @param {boolean} enabled
 */
export function setBarrelFireLightShadowsEnabled(root, enabled) {
  if (!root) return;
  root.traverse((obj) => {
    if (!isOilBarrelFirePointLight(obj)) return;
    obj.castShadow = enabled;
  });
}

/** Only the nearest key fire light casts a shadow — point-light cubes are costly. */
const FIRE_SHADOW_MAX_CASTERS = 1;
const FIRE_SHADOW_MAX_DISTANCE = 14;

const _fireShadowWorldPos = new THREE.Vector3();
const _fireShadowCandidates = [];
const _lastBudgetPos = new THREE.Vector3();
let _budgetFrame = 0;
let _cachedCasting = 0;
const BUDGET_RECOMPUTE_INTERVAL = 6;
const BUDGET_MOVE_THRESH_SQ = 2 * 2;

/**
 * Cap burning-barrel fire shadows to the nearest key light(s).
 * @param {THREE.Object3D[]} fireLightRoots Rigs or legacy single lights from the runtime index.
 * @param {THREE.Vector3} cameraPos
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning
 * @returns {number} Key lights currently casting shadows.
 */
export function updateOilBarrelFireShadowBudget(fireLightRoots, cameraPos, tuning) {
  _budgetFrame += 1;
  const moved =
    cameraPos &&
    _lastBudgetPos.distanceToSquared(cameraPos) > BUDGET_MOVE_THRESH_SQ;
  if (
    _budgetFrame > 1 &&
    !moved &&
    _budgetFrame % BUDGET_RECOMPUTE_INTERVAL !== 0
  ) {
    return _cachedCasting;
  }
  if (cameraPos) _lastBudgetPos.copy(cameraPos);

  const roots = fireLightRoots ?? [];
  const strength = getInteriorFireShadowStrength(tuning);
  const firesOn = tuning?.interiorFire !== false;

  if (!firesOn || strength <= 0.001 || !cameraPos) {
    for (const root of roots) {
      root?.traverse?.((obj) => {
        if (!isOilBarrelFirePointLight(obj)) return;
        const side =
          obj.userData.fireLightSide ??
          (obj.name === FIRE_LIGHT_NAME_L ? -1 : 1);
        if (side <= 0 && obj.castShadow) obj.castShadow = false;
      });
    }
    _cachedCasting = 0;
    return 0;
  }

  _fireShadowCandidates.length = 0;
  for (const root of roots) {
    if (root.visible === false) continue;
    root.traverse((obj) => {
      if (!isOilBarrelFirePointLight(obj)) return;
      const side =
        obj.userData.fireLightSide ??
        (obj.name === FIRE_LIGHT_NAME_L ? -1 : 1);
      if (side > 0) return;
      obj.getWorldPosition(_fireShadowWorldPos);
      _fireShadowCandidates.push({
        light: obj,
        distSq: _fireShadowWorldPos.distanceToSquared(cameraPos),
      });
    });
  }

  _fireShadowCandidates.sort((a, b) => a.distSq - b.distSq);
  const maxDistSq = FIRE_SHADOW_MAX_DISTANCE * FIRE_SHADOW_MAX_DISTANCE;
  const allowed = new Set();
  for (
    let i = 0;
    i < _fireShadowCandidates.length && allowed.size < FIRE_SHADOW_MAX_CASTERS;
    i += 1
  ) {
    const entry = _fireShadowCandidates[i];
    if (entry.distSq > maxDistSq) break;
    allowed.add(entry.light);
  }

  let casting = 0;
  for (const root of roots) {
    root.traverse((obj) => {
      if (!isOilBarrelFirePointLight(obj)) return;
      const side =
        obj.userData.fireLightSide ??
        (obj.name === FIRE_LIGHT_NAME_L ? -1 : 1);
      if (side > 0) {
        if (obj.castShadow) obj.castShadow = false;
        return;
      }
      const shouldCast = allowed.has(obj);
      if (obj.castShadow !== shouldCast) obj.castShadow = shouldCast;
      if (shouldCast) casting += 1;
    });
  }
  _cachedCasting = casting;
  return casting;
}

/**
 * @param {THREE.Object3D} root
 * @returns {THREE.PointLight[]}
 */
export function collectOilBarrelFireLights(root) {
  /** @type {THREE.PointLight[]} */
  const lights = [];
  if (!root) return lights;
  root.traverse((obj) => {
    if (isOilBarrelFirePointLight(obj)) lights.push(obj);
  });
  return lights;
}

/** Each barrel gets its own flicker seed; L/R lights derive unique phases from it. */
export function initOilBarrelFireLightFlicker(lights) {
  resetCandleFlicker(lights);

  for (const light of lights) {
    if (!light) continue;
    delete light.userData.candleFlicker;
    const barrel = getOilBarrelFromFireLight(light);
    const barrelSeed = barrel?.userData?.fireFlickerSeed;
    if (barrelSeed == null) continue;
    const side = light.userData?.fireLightSide ?? 0;
    attachCandleFlickerLight(
      light,
      OIL_BARREL_FLICKER_OPTS,
      deriveBarrelFlickerSeeds(barrelSeed, side)
    );
  }
}
