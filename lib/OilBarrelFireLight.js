import * as THREE from "three";
import {
  initCandleFlicker,
  resetCandleFlicker,
} from "./CandleFlicker.js";
import {
  pinLightToLayers,
  ROOM_INTERIOR_LAYER,
  WORLD_LAYER,
} from "./LightingLayers.js";
import { computeInteriorFlameLayout } from "./OilBarrelInteriorVideo.js";

/** Warm flame — lights interior wall + nearby room shell. */
const FIRE_LIGHT_COLOR = 0xff9922;
const FIRE_LIGHT_DISTANCE = 6;
const FIRE_LIGHT_DECAY = 2;
const FIRE_LIGHT_SHADOW_MAP = 512;
/** Feather shadow edges only — full strength, no lighter fill. */
const FIRE_LIGHT_SHADOW_RADIUS = 6;
const FIRE_LIGHT_SHADOW_BLUR_SAMPLES = 24;

export const OIL_BARREL_FIRE_LIGHT_RIG_NAME = "oil_barrel_fire_lights";
const FIRE_LIGHT_NAME_L = "oil_barrel_fire_light_l";
const FIRE_LIGHT_NAME_R = "oil_barrel_fire_light_r";
/** Per-light intensity so the pair reads as one flame, not 2× brightness. */
const FIRE_LIGHT_PAIR_INTENSITY_FACTOR = 0.54;

/** Faster shimmer + dips than room candles — used by `initCandleFlicker`. */
export const OIL_BARREL_FLICKER_OPTS = {
  baseFactor: 0.82,
  wobbleAmp: 0.2,
  wobbleSpeed: 2.6,
  dipMinGap: 0.22,
  dipMaxGap: 0.85,
  dipDuration: 0.065,
  dipMinStrength: 0.28,
  dipMaxStrength: 0.52,
  /** Each L/R light drifts vertically on its own phase. */
  positionDriftAmpY: 0.06,
  positionDriftSpeed: 1.35,
};

/** @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning */
export function getInteriorFireLightIntensity(tuning) {
  const n = tuning.interiorFireLightIntensity;
  return Number.isFinite(n) ? n : 14;
}

function perSideFireLightIntensity(tuning) {
  return getInteriorFireLightIntensity(tuning) * FIRE_LIGHT_PAIR_INTENSITY_FACTOR;
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

/** Blur shadow map edges (PCFSoftShadowMap); leaves shadow strength at default. */
export function configureOilBarrelFireLightShadow(light) {
  if (!light?.isPointLight || !light.shadow) return;
  light.shadow.mapSize.set(FIRE_LIGHT_SHADOW_MAP, FIRE_LIGHT_SHADOW_MAP);
  light.shadow.radius = FIRE_LIGHT_SHADOW_RADIUS;
  light.shadow.blurSamples = FIRE_LIGHT_SHADOW_BLUR_SAMPLES;
  light.shadow.bias = -0.0008;
  light.shadow.normalBias = 0.02;
  light.shadow.camera.near = 0.05;
  light.shadow.camera.far = 8;
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
function createFireLightSide(rig, side, intensity, roomId) {
  const light = new THREE.PointLight(
    FIRE_LIGHT_COLOR,
    intensity,
    FIRE_LIGHT_DISTANCE,
    FIRE_LIGHT_DECAY
  );
  light.name = side < 0 ? FIRE_LIGHT_NAME_L : FIRE_LIGHT_NAME_R;
  light.castShadow = true;
  configureOilBarrelFireLightShadow(light);
  pinLightToLayers(light, ROOM_INTERIOR_LAYER, WORLD_LAYER);
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
  const intensity = perSideFireLightIntensity(tuning);
  rig.traverse((child) => {
    if (!isOilBarrelFirePointLight(child)) return;
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

  const intensity = perSideFireLightIntensity(tuning);
  createFireLightSide(rig, -1, intensity, roomId);
  createFireLightSide(rig, 1, intensity, roomId);
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
      obj.traverse((child) => {
        if (isOilBarrelFirePointLight(child)) configureOilBarrelFireLightShadow(child);
      });
      return;
    }

    if (!isOilBarrelFirePointLight(obj) || obj.parent?.userData?.isOilBarrelFireLightRig) {
      return;
    }

    // Legacy single centre light (pre-pair barrels).
    configureOilBarrelFireLightShadow(obj);
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

/** One init pass per light so L/R never share phase, speed, or dip timing. */
export function initOilBarrelFireLightFlicker(lights) {
  resetCandleFlicker(lights);
  for (const light of lights) {
    initCandleFlicker([light], OIL_BARREL_FLICKER_OPTS);
  }
}
