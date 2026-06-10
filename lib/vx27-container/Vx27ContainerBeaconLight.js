import * as THREE from "three";
import { pinLightToRoomInteriorLayer } from "../lighting/LightingLayers.js";

export const VX27_CEILING_LIGHT_COLOR = 0x5eaaff;
export const VX27_CEILING_LIGHT_INTENSITY = 22;
export const VX27_CEILING_LIGHT_DISTANCE = 20;
export const VX27_CEILING_LIGHT_DECAY = 1.2;

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

/** Static light — no per-frame animation. */
export function updateVx27ContainerBeaconLights() {}

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
  light.intensity = enabled ? base : 0;
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
