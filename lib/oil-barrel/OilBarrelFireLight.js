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
/** Key sits high in the flame column so spill + floor shadow read outside the rim. */
const FIRE_LIGHT_KEY_RIM_LIFT = 0.42;
const FIRE_LIGHT_FILL_RIM_LIFT = 0.1;
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
  return Number.isFinite(n) ? THREE.MathUtils.clamp(n, 0, 1) : 0.32;
}

/** @deprecated alias */
export function getInteriorFireShadowIntensity(tuning) {
  return getInteriorFireShadowStrength(tuning);
}

/** Fire lights illuminate only; barrel geometry handles its own visual depth. */
export function configureOilBarrelFireLightShadow(
  light,
  _tuning = null,
  _side = light?.userData?.fireLightSide ?? -1
) {
  if (!light?.isPointLight) return;
  light.castShadow = false;
}

/** Fire lights illuminate only; they should never cast shadow maps. */
function pinFireLightToLayers(light, _roomId, side) {
  if (side > 0) {
    pinLightToLayers(light, WORLD_LAYER);
    return;
  }
  pinLightToLayers(light, ROOM_INTERIOR_LAYER, WORLD_LAYER);
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

function applyFireLightSidePositions(rig, tuning, layout) {
  const span = Math.max(0.05, layout.layoutTopY - layout.layoutBottomY);
  const keyLift = span * FIRE_LIGHT_KEY_RIM_LIFT;
  const fillLift = span * FIRE_LIGHT_FILL_RIM_LIFT;
  rig.traverse((child) => {
    if (!isOilBarrelFirePointLight(child)) return;
    const side =
      child.userData.fireLightSide ??
      (child.name === FIRE_LIGHT_NAME_L ? -1 : 1);
    const offset = getFireLightSideOffset(tuning, side);
    const lift = side <= 0 ? keyLift : fillLift;
    child.position.set(offset.x, offset.y + lift, offset.z);
    if (child.userData.candleFlicker?.basePosition) {
      child.userData.candleFlicker.basePosition.copy(child.position);
    }
  });
}

function applyFireLightRigLayout(rig, layout, tuning) {
  rig.position.set(layout.x, layout.y, layout.z);
  rig.rotation.set(0, 0, 0);
  applyFireLightSidePositions(rig, tuning, layout);
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
      // Drop legacy VSM shadow spots — fire lights illuminate only.
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
