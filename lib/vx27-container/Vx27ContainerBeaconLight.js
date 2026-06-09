import * as THREE from "three";
import {
  pinLightToRoomInteriorLayer,
  setRoomInteriorLayer,
} from "../lighting/LightingLayers.js";

/** One full sweep — slow emergency scan. */
export const VX27_BEACON_ROTATION_PERIOD_SEC = 3;
export const VX27_BEACON_SPOT_COLOR = 0x5eaaff;
export const VX27_BEACON_LENS_COLOR = 0x9ed4ff;
export const VX27_BEACON_LENS_EMISSIVE = 0x3d8fff;
export const VX27_BEACON_SPOT_INTENSITY = 16;
export const VX27_BEACON_SPILL_INTENSITY = 9;
export const VX27_BEACON_SPOT_DISTANCE = 13;
export const VX27_BEACON_SPOT_ANGLE = Math.PI / 3.1;
export const VX27_BEACON_SPILL_ANGLE = Math.PI / 2.15;
export const VX27_BEACON_SPOT_PENUMBRA = 0.95;
export const VX27_BEACON_SPOT_DECAY = 1;
export const VX27_BEACON_FILL_COLOR = 0x1a3058;
export const VX27_BEACON_FILL_INTENSITY = 4.5;
export const VX27_BEACON_FILL_DISTANCE = 11;
export const VX27_BEACON_ORBIT_RADIUS = 2.1;
export const VX27_BEACON_TARGET_DROP = 1.75;

/**
 * @param {number} offsetX
 * @param {number} ceilY
 * @param {number} offsetZ
 */
export function createVx27ContainerBeaconRig(offsetX, ceilY, offsetZ) {
  const rig = new THREE.Group();
  rig.name = "vx27_container_beacon_rig";
  rig.position.set(offsetX, ceilY - 0.12, offsetZ);

  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    emissive: VX27_BEACON_SPOT_COLOR,
    emissiveIntensity: 0.65,
    metalness: 0.55,
    roughness: 0.4,
  });
  const housing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.07, 0.06, 10),
    housingMat
  );
  housing.name = "vx27_container_beacon_housing";
  housing.castShadow = false;
  housing.receiveShadow = true;
  setRoomInteriorLayer(housing);
  rig.add(housing);

  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.042, 0.018, 10),
    new THREE.MeshStandardMaterial({
      color: VX27_BEACON_LENS_COLOR,
      emissive: VX27_BEACON_LENS_EMISSIVE,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.92,
      metalness: 0.1,
      roughness: 0.2,
    })
  );
  lens.name = "vx27_container_beacon_lens";
  lens.position.y = -0.028;
  setRoomInteriorLayer(lens);
  rig.add(lens);

  const target = new THREE.Object3D();
  target.name = "vx27_container_beacon_target";
  rig.add(target);

  const spot = new THREE.SpotLight(
    VX27_BEACON_SPOT_COLOR,
    VX27_BEACON_SPOT_INTENSITY,
    VX27_BEACON_SPOT_DISTANCE,
    VX27_BEACON_SPOT_ANGLE,
    VX27_BEACON_SPOT_PENUMBRA,
    VX27_BEACON_SPOT_DECAY
  );
  spot.name = "vx27_container_beacon_spot";
  spot.castShadow = false;
  spot.target = target;
  spot.userData.vx27ContainerLight = true;
  spot.userData.vx27BeaconSpot = true;
  spot.userData.vx27BaseIntensity = VX27_BEACON_SPOT_INTENSITY;
  pinLightToRoomInteriorLayer(spot);
  rig.add(spot);

  const spill = new THREE.SpotLight(
    VX27_BEACON_SPOT_COLOR,
    VX27_BEACON_SPILL_INTENSITY,
    VX27_BEACON_SPOT_DISTANCE,
    VX27_BEACON_SPILL_ANGLE,
    1,
    VX27_BEACON_SPOT_DECAY
  );
  spill.name = "vx27_container_beacon_spill";
  spill.castShadow = false;
  spill.target = target;
  spill.userData.vx27ContainerLight = true;
  spill.userData.vx27BeaconSpill = true;
  spill.userData.vx27BaseIntensity = VX27_BEACON_SPILL_INTENSITY;
  pinLightToRoomInteriorLayer(spill);
  rig.add(spill);

  const fill = new THREE.PointLight(
    VX27_BEACON_FILL_COLOR,
    VX27_BEACON_FILL_INTENSITY,
    VX27_BEACON_FILL_DISTANCE,
    1.6
  );
  fill.name = "vx27_container_beacon_fill";
  fill.castShadow = false;
  fill.userData.vx27ContainerLight = true;
  fill.userData.vx27BeaconFill = true;
  fill.userData.vx27BaseIntensity = VX27_BEACON_FILL_INTENSITY;
  pinLightToRoomInteriorLayer(fill);
  rig.add(fill);

  rig.userData.vx27BeaconRig = true;
  rig.userData.beaconTarget = target;
  rig.userData.beaconSpot = spot;
  rig.userData.beaconSpill = spill;
  rig.userData.beaconFill = fill;
  rig.userData.beaconHousing = housing;
  rig.userData.beaconLens = lens;

  return rig;
}

/** @param {THREE.Group} rig @param {number} timeSec */
export function updateVx27ContainerBeaconRig(rig, timeSec) {
  if (!rig?.userData?.vx27BeaconRig) return;
  const target = rig.userData.beaconTarget;
  if (!target) return;

  const phase =
    ((timeSec % VX27_BEACON_ROTATION_PERIOD_SEC) /
      VX27_BEACON_ROTATION_PERIOD_SEC) *
    Math.PI *
    2;
  target.position.set(
    Math.cos(phase) * VX27_BEACON_ORBIT_RADIUS,
    -VX27_BEACON_TARGET_DROP,
    Math.sin(phase) * VX27_BEACON_ORBIT_RADIUS
  );

  const lens = rig.userData.beaconLens;
  if (lens?.material?.emissiveIntensity !== undefined) {
    lens.material.emissiveIntensity = 0.9 + Math.sin(phase * 2) * 0.2;
  }
  const housing = rig.userData.beaconHousing;
  if (housing?.material?.emissiveIntensity !== undefined) {
    housing.material.emissiveIntensity = 0.55 + Math.sin(phase * 2) * 0.12;
  }
}

/** @param {THREE.Object3D[]} containers @param {number} timeSec */
export function updateVx27ContainerBeaconLights(containers, timeSec) {
  for (const container of containers ?? []) {
    const rig = container.userData?.vx27BeaconRig;
    if (rig) updateVx27ContainerBeaconRig(rig, timeSec);
  }
}

/** @param {THREE.Group} rig @returns {THREE.Light[]} */
export function vx27BeaconRigLights(rig) {
  if (!rig?.userData?.vx27BeaconRig) return [];
  const lights = [];
  if (rig.userData.beaconSpot?.isLight) lights.push(rig.userData.beaconSpot);
  if (rig.userData.beaconSpill?.isLight) lights.push(rig.userData.beaconSpill);
  if (rig.userData.beaconFill?.isLight) lights.push(rig.userData.beaconFill);
  return lights;
}

/** @param {THREE.Group} rig @param {boolean} enabled */
export function applyVx27ContainerBeaconEnabled(rig, enabled) {
  if (!rig?.userData?.vx27BeaconRig) return;
  for (const light of vx27BeaconRigLights(rig)) {
    const base = light.userData.vx27BaseIntensity ?? light.intensity;
    light.visible = enabled;
    light.intensity = enabled ? base : 0;
  }
  if (rig.userData.beaconHousing) {
    rig.userData.beaconHousing.visible = enabled;
  }
  if (rig.userData.beaconLens) {
    rig.userData.beaconLens.visible = enabled;
  }
}
