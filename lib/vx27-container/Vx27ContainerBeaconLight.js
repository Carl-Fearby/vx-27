import * as THREE from "three";
import {
  pinLightToRoomInteriorLayer,
  setRoomInteriorLayer,
} from "../lighting/LightingLayers.js";

export const VX27_CEILING_LIGHT_COLOR = 0x5eaaff;
export const VX27_CEILING_LIGHT_INTENSITY = 8.378;
export const VX27_CEILING_LIGHT_DISTANCE = 20;
export const VX27_CEILING_LIGHT_DECAY = 1.2;

/** Round surface-mount fitting — 45 cm diameter (3× original), 5 cm depth. */
export const VX27_CEILING_FITTING_DIAMETER = 0.45;
export const VX27_CEILING_FITTING_DEPTH = 0.05;
const VX27_CEILING_FITTING_RADIUS = VX27_CEILING_FITTING_DIAMETER * 0.5;
/** Rig sits 8 cm below ceiling underside — top of fitting flush with ceiling. */
const VX27_CEILING_RIG_DROP = 0.08;
const VX27_CEILING_FITTING_EMISSIVE = 5.5;

/** @type {THREE.MeshStandardMaterial | null} */
let _fittingGlowMat = null;

function getFittingGlowMaterial() {
  if (!_fittingGlowMat) {
    _fittingGlowMat = new THREE.MeshStandardMaterial({
      color: VX27_CEILING_LIGHT_COLOR,
      emissive: VX27_CEILING_LIGHT_COLOR,
      emissiveIntensity: VX27_CEILING_FITTING_EMISSIVE,
      roughness: 0.12,
      metalness: 0,
      toneMapped: false,
    });
    _fittingGlowMat.name = "vx27_ceiling_fitting_glow_mat";
  }
  return _fittingGlowMat;
}

/**
 * Shallow round ceiling can — glowing blue housing + diffuser.
 * @param {number} fittingTopY Local Y where the housing top meets the ceiling plane.
 */
function createVx27CeilingFittingMesh(fittingTopY) {
  const fitting = new THREE.Group();
  fitting.name = "vx27_container_ceiling_fitting";
  const glowMat = getFittingGlowMaterial();

  const housingCenterY = fittingTopY - VX27_CEILING_FITTING_DEPTH * 0.5;
  const housing = new THREE.Mesh(
    new THREE.CylinderGeometry(
      VX27_CEILING_FITTING_RADIUS,
      VX27_CEILING_FITTING_RADIUS,
      VX27_CEILING_FITTING_DEPTH,
      40,
      1,
      false
    ),
    glowMat
  );
  housing.name = "vx27_container_ceiling_fitting_housing";
  housing.position.y = housingCenterY;
  housing.castShadow = false;
  housing.receiveShadow = false;
  setRoomInteriorLayer(housing);
  fitting.add(housing);

  const diffuser = new THREE.Mesh(
    new THREE.CircleGeometry(VX27_CEILING_FITTING_RADIUS, 40),
    glowMat
  );
  diffuser.name = "vx27_container_ceiling_fitting_diffuser";
  diffuser.rotation.x = -Math.PI / 2;
  diffuser.position.y = housingCenterY - VX27_CEILING_FITTING_DEPTH * 0.5 - 0.001;
  diffuser.renderOrder = 1;
  diffuser.castShadow = false;
  diffuser.receiveShadow = false;
  setRoomInteriorLayer(diffuser);
  fitting.add(diffuser);

  fitting.userData.ceilingFittingMeshes = [housing, diffuser];
  return fitting;
}

/** @param {THREE.Group} rig @param {boolean} enabled */
function applyVx27CeilingFittingEnabled(rig, enabled) {
  const meshes = rig.userData?.ceilingFittingMeshes;
  if (!Array.isArray(meshes)) return;
  for (const mesh of meshes) {
    if (!mesh?.isMesh) continue;
    mesh.visible = enabled;
    const mat = mesh.material;
    if (mat?.isMaterial && "emissiveIntensity" in mat) {
      mat.emissiveIntensity = enabled ? VX27_CEILING_FITTING_EMISSIVE : 0;
    }
  }
}

/**
 * Blue ceiling point light (room pass only) + emissive fitting.
 * @param {number} offsetX
 * @param {number} ceilY
 * @param {number} offsetZ
 */
export function createVx27ContainerCeilingLightRig(offsetX, ceilY, offsetZ) {
  const rig = new THREE.Group();
  rig.name = "vx27_container_ceiling_light";
  rig.position.set(offsetX, ceilY - VX27_CEILING_RIG_DROP, offsetZ);

  const fitting = createVx27CeilingFittingMesh(VX27_CEILING_RIG_DROP);
  rig.add(fitting);
  rig.userData.ceilingFittingMeshes = fitting.userData.ceilingFittingMeshes;

  const lightY = VX27_CEILING_RIG_DROP - VX27_CEILING_FITTING_DEPTH * 0.5;
  const light = new THREE.PointLight(
    VX27_CEILING_LIGHT_COLOR,
    VX27_CEILING_LIGHT_INTENSITY,
    VX27_CEILING_LIGHT_DISTANCE,
    VX27_CEILING_LIGHT_DECAY
  );
  light.name = "vx27_container_ceiling_light_point";
  light.position.y = lightY;
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
  applyVx27CeilingFittingEnabled(rig, enabled);
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

/** Door egress removed — kept as no-op for stable imports. */
export function pinVx27DoorEgressLightLayers() {}
