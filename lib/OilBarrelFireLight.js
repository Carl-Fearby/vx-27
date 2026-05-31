import * as THREE from "three";
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
};

/** @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning */
export function getInteriorFireLightIntensity(tuning) {
  const n = tuning.interiorFireLightIntensity;
  return Number.isFinite(n) ? n : 14;
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

  const intensity = getInteriorFireLightIntensity(tuning);
  const light = new THREE.PointLight(
    FIRE_LIGHT_COLOR,
    intensity,
    FIRE_LIGHT_DISTANCE,
    FIRE_LIGHT_DECAY
  );
  light.name = "oil_barrel_fire_light";
  light.position.set(layout.x, layout.y, layout.z);
  light.castShadow = true;
  light.shadow.mapSize.set(FIRE_LIGHT_SHADOW_MAP, FIRE_LIGHT_SHADOW_MAP);
  light.shadow.bias = -0.0008;
  light.shadow.normalBias = 0.02;
  light.shadow.camera.near = 0.05;
  light.shadow.camera.far = 8;
  pinLightToLayers(light, ROOM_INTERIOR_LAYER, WORLD_LAYER);
  light.userData.isOilBarrelFireLight = true;
  light.userData.roomId = roomId;
  barrelGroup.add(light);
  return light;
}

/**
 * @param {THREE.Object3D} root
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning
 */
export function refreshOilBarrelFireLights(root, tuning) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.name !== "oil_barrel_fire_light" || !obj.isLight) return;
    const barrel = obj.parent;
    const ud = barrel?.userData;
    const firesOn = tuning.interiorFire !== false;
    obj.visible = firesOn;
    if (!firesOn || !ud || ud.innerRadius == null || ud.floorY == null) {
      return;
    }
    const rimY = ud.clipTopY ?? 0;
    const layout = computeInteriorFlameLayout(
      ud.innerRadius,
      ud.floorY,
      rimY,
      tuning
    );
    obj.position.set(layout.x, layout.y, layout.z);
    const intensity = getInteriorFireLightIntensity(tuning);
    if (obj.userData.candleFlicker) {
      obj.userData.candleFlicker.baseIntensity = intensity;
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
    if (obj.name === "oil_barrel_fire_light" && obj.isPointLight) {
      lights.push(obj);
    }
  });
  return lights;
}
