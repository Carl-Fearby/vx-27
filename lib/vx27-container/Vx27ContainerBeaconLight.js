import * as THREE from "three";
import {
  attachCandleFlickerLight,
  deriveBarrelFlickerSeeds,
} from "../lighting/CandleFlicker.js";
import { pinLightToRoomInteriorLayer } from "../lighting/LightingLayers.js";

export const VX27_CEILING_LIGHT_COLOR = 0x5eaaff;
export const VX27_CEILING_LIGHT_INTENSITY = 22;
export const VX27_CEILING_LIGHT_DISTANCE = 20;
export const VX27_CEILING_LIGHT_DECAY = 1.2;

/** Harsh failing ballast — fast buzz, heavy sags, frequent blackouts. Intensity only. */
export const VX27_CEILING_FLICKER_OPTS = {
  baseFactor: 0.78,
  wobbleAmp: 0.26,
  wobbleSpeed: 4.6,
  dipMinGap: 0.35,
  dipMaxGap: 1.4,
  dipDuration: 0.14,
  dipMinStrength: 0.55,
  dipMaxStrength: 0.92,
  minFactor: 0,
  blinkMinGap: 0.9,
  blinkMaxGap: 3.8,
  blinkDuration: 0.14,
  blinkFloor: 0,
};

/** Stable unique seed from level prop id; random when no id. */
export function vx27CeilingFlickerSeedFromPropId(propId) {
  if (!propId) return Math.random() * 1e6;
  let h = 2166136261;
  for (let i = 0; i < propId.length; i += 1) {
    h ^= propId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967296) * 1e6;
}

/**
 * One static blue ceiling light at the interior center.
 * @param {number} offsetX
 * @param {number} ceilY
 * @param {number} offsetZ
 */
export function createVx27ContainerCeilingLightRig(offsetX, ceilY, offsetZ) {
  const rig = new THREE.Group();
  rig.name = "vx27_container_ceiling_light";
  rig.position.set(offsetX, ceilY - 0.08, offsetZ);

  const light = new THREE.PointLight(
    VX27_CEILING_LIGHT_COLOR,
    VX27_CEILING_LIGHT_INTENSITY,
    VX27_CEILING_LIGHT_DISTANCE,
    VX27_CEILING_LIGHT_DECAY
  );
  light.name = "vx27_container_ceiling_light_point";
  light.castShadow = false;
  light.userData.vx27ContainerLight = true;
  light.userData.vx27CeilingLight = true;
  light.userData.vx27BaseIntensity = VX27_CEILING_LIGHT_INTENSITY;
  pinLightToRoomInteriorLayer(light);
  rig.add(light);

  rig.userData.vx27BeaconRig = true;
  rig.userData.vx27BeaconEnabled = true;
  rig.userData.ceilingLight = light;

  return rig;
}

/**
 * @param {number} offsetX
 * @param {number} ceilY
 * @param {number} offsetZ
 * @param {number} [_innerL]
 */
export function buildVx27ContainerBeaconRigs(offsetX, ceilY, offsetZ, _innerL) {
  return [createVx27ContainerCeilingLightRig(offsetX, ceilY, offsetZ)];
}

/** @param {THREE.Object3D} container @returns {THREE.Group[]} */
export function vx27ContainerBeaconRigsForContainer(container) {
  const rigs = container?.userData?.vx27BeaconRigs;
  if (Array.isArray(rigs) && rigs.length) return rigs;
  const single = container?.userData?.vx27BeaconRig;
  if (single) return [single];
  const interior = container?.getObjectByName?.("vx27_container_interior");
  /** @type {THREE.Group[]} */
  const found = [];
  interior?.traverse((obj) => {
    if (obj.userData?.vx27BeaconRig) found.push(obj);
  });
  return found;
}

/** Static light — flicker runs via shared updateCandleFlicker in FpsGame. */
export function updateVx27ContainerBeaconLights() {}

/** Attach candle-style flicker to ceiling lights (same path as oil-barrel fire). */
export function initVx27ContainerCeilingLightFlicker(containers) {
  for (const container of containers ?? []) {
    const seed = vx27CeilingFlickerSeedFromPropId(
      container.userData?.vx27PropId ?? null
    );
    for (const rig of vx27ContainerBeaconRigsForContainer(container)) {
      const light = rig.userData?.ceilingLight;
      if (!light?.isLight) continue;
      delete light.userData.candleFlicker;
      const base = light.userData.vx27BaseIntensity ?? VX27_CEILING_LIGHT_INTENSITY;
      attachCandleFlickerLight(
        light,
        VX27_CEILING_FLICKER_OPTS,
        deriveBarrelFlickerSeeds(seed, 0)
      );
      if (light.userData.candleFlicker) {
        light.userData.candleFlicker.baseIntensity = base;
      }
    }
  }
}

/** @param {THREE.Group} rig @returns {THREE.Light[]} */
export function vx27BeaconRigLights(rig) {
  const light = rig?.userData?.ceilingLight;
  return light?.isLight ? [light] : [];
}

/** @param {THREE.Group} rig @param {boolean} enabled */
export function applyVx27ContainerBeaconEnabled(rig, enabled) {
  if (!rig?.userData?.vx27BeaconRig) return;
  const light = rig.userData.ceilingLight;
  if (!light?.isLight) return;
  rig.userData.vx27BeaconEnabled = enabled;
  const base = light.userData.vx27BaseIntensity ?? VX27_CEILING_LIGHT_INTENSITY;
  light.visible = enabled;
  if (!enabled) {
    light.intensity = 0;
    return;
  }
  if (light.userData.candleFlicker) {
    light.userData.candleFlicker.baseIntensity = base;
    return;
  }
  light.intensity = base;
}

/** @param {THREE.Object3D} container @param {boolean} enabled */
export function applyVx27ContainerAllBeaconsEnabled(container, enabled) {
  for (const rig of vx27ContainerBeaconRigsForContainer(container)) {
    applyVx27ContainerBeaconEnabled(rig, enabled);
  }
}

/** Door egress removed — kept as no-ops for stable imports. */
export function buildVx27ContainerDoorEgressRigs() {
  return [];
}

export function wireVx27DoorEgressBeaconSources() {}

/** @param {THREE.Object3D} _container @returns {THREE.Group[]} */
export function vx27ContainerDoorEgressRigsForContainer(_container) {
  return [];
}

/** @param {THREE.Object3D[]} _containers @returns {THREE.Light[]} */
export function collectVx27ContainerDoorEgressLights(_containers) {
  return [];
}

export function updateVx27ContainerDoorEgressLights() {}
