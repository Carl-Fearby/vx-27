import * as THREE from "three";
import {
  applyVx27ContainerBeaconEnabled,
  vx27BeaconRigLights,
  vx27ContainerBeaconRigsForContainer,
  vx27ContainerDoorEgressRigsForContainer,
} from "./Vx27ContainerBeaconLight.js";
import {
  VX27_CONTAINER_HEIGHT,
  VX27_CONTAINER_LENGTH,
  VX27_CONTAINER_WIDTH,
} from "./Vx27Container.js";

/**
 * @typedef {{
 *   container: THREE.Group,
 *   interior: THREE.Object3D | null,
 *   localBBox: THREE.Box3,
 *   beaconLights: THREE.Light[],
 *   egressLights: THREE.Light[],
 *   visible: boolean,
 * }} Vx27ContainerCullable
 */

const _projScreenMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _worldBBox = new THREE.Box3();

/** @param {THREE.Group} container */
function vx27ContainerLocalBBox(container) {
  const width = container.userData.vx27Width ?? VX27_CONTAINER_WIDTH;
  const height = container.userData.vx27Height ?? VX27_CONTAINER_HEIGHT;
  const length = container.userData.vx27Length ?? VX27_CONTAINER_LENGTH;
  const halfW = width / 2;
  const halfH = height / 2;
  const halfL = length / 2;
  return new THREE.Box3(
    new THREE.Vector3(-halfW, -halfH, -halfL),
    new THREE.Vector3(halfW, halfH, halfL)
  );
}

/** @param {THREE.Object3D[]} containers @returns {Vx27ContainerCullable[]} */
export function buildVx27ContainerCullables(containers) {
  /** @type {Vx27ContainerCullable[]} */
  const cullables = [];
  for (const container of containers ?? []) {
    if (!container?.isObject3D) continue;
    const beaconLights = vx27ContainerBeaconRigsForContainer(container).flatMap(
      (rig) => vx27BeaconRigLights(rig)
    );
    const egressLights = [];
    for (const rig of vx27ContainerDoorEgressRigsForContainer(container)) {
      if (rig.userData.egressSpot?.isLight) {
        egressLights.push(rig.userData.egressSpot);
      }
    }
    cullables.push({
      container,
      interior: container.getObjectByName("vx27_container_interior"),
      localBBox: vx27ContainerLocalBBox(container),
      beaconLights,
      egressLights,
      visible: true,
    });
  }
  return cullables;
}

/** @param {Vx27ContainerCullable} cullable */
function snuffVx27ContainerCullableLights(cullable) {
  for (const light of cullable.beaconLights) {
    light.visible = false;
    light.intensity = 0;
  }
  for (const light of cullable.egressLights) {
    light.visible = false;
    light.intensity = 0;
  }
}

/** @param {Vx27ContainerCullable} cullable */
function restoreVx27ContainerCullableLights(cullable) {
  if (cullable.container.userData?.vx27LightsForceOff) {
    snuffVx27ContainerCullableLights(cullable);
    return;
  }
  for (const rig of vx27ContainerBeaconRigsForContainer(cullable.container)) {
    applyVx27ContainerBeaconEnabled(
      rig,
      rig.userData.vx27BeaconEnabled !== false
    );
  }
}

/**
 * @param {Vx27ContainerCullable[]} cullables
 * @param {THREE.Camera} camera
 * @param {THREE.Group | null} [playerContainer]
 */
export function updateVx27ContainerCulling(
  cullables,
  camera,
  playerContainer = null
) {
  _projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  _frustum.setFromProjectionMatrix(_projScreenMatrix);

  let visibleCount = 0;
  for (const cullable of cullables) {
    const playerInside = cullable.container === playerContainer;
    cullable.container.updateMatrixWorld();
    _worldBBox.copy(cullable.localBBox).applyMatrix4(cullable.container.matrixWorld);
    const visible = playerInside || _frustum.intersectsBox(_worldBBox);
    cullable.visible = visible;
    cullable.container.userData.vx27CullVisible = visible;

    if (cullable.interior) {
      cullable.interior.visible = visible;
    }

    if (!visible) {
      snuffVx27ContainerCullableLights(cullable);
      continue;
    }
    restoreVx27ContainerCullableLights(cullable);
    visibleCount += 1;
  }

  return {
    visibleCount,
    anyVisible: visibleCount > 0 || playerContainer != null,
    playerContainer,
  };
}
