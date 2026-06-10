import * as THREE from "three";
import {
  pinLightToRoomInteriorLayer,
  pinLightToWorldLayer,
} from "../lighting/LightingLayers.js";
import {
  initVx27IndustrialCeilingFlicker,
  updateVx27IndustrialCeilingFlicker,
  vx27CeilingFlickerSeedFromPropId,
} from "./Vx27ContainerCeilingFlicker.js";
import {
  computeVx27DoorLayout,
  VX27_DOOR_COLLIDER_OPEN_THRESHOLD,
} from "./Vx27ContainerDoors.js";

export const VX27_CEILING_LIGHT_COLOR = 0x5eaaff;
export const VX27_CEILING_LIGHT_INTENSITY = 22;
export const VX27_CEILING_LIGHT_DISTANCE = 20;
export const VX27_CEILING_LIGHT_DECAY = 1.2;

/** World spill through open end doors — synced to ceiling light, night-weighted. */
export const VX27_DOOR_EGRESS_SPOT_INTENSITY = 7.5;
export const VX27_DOOR_EGRESS_SPOT_DISTANCE = 12;
export const VX27_DOOR_EGRESS_SPOT_ANGLE = Math.PI / 3.4;
export const VX27_DOOR_EGRESS_SPOT_PENUMBRA = 0.88;
export const VX27_DOOR_EGRESS_OPEN_FULL_DEG = 42;
export const VX27_DOOR_EGRESS_CLOSED_LEAK = 0.09;

/**
 * One blue ceiling light at the interior center — unstable supply flicker only.
 * @param {number} offsetX
 * @param {number} ceilY
 * @param {number} offsetZ
 * @param {number} [flickerSeed]
 */
export function createVx27ContainerCeilingLightRig(
  offsetX,
  ceilY,
  offsetZ,
  flickerSeed = 0
) {
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
  initVx27IndustrialCeilingFlicker(light, { seed: flickerSeed });
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
 * @param {number} [_innerW]
 * @param {number} [_innerL]
 * @param {number | string | null} [flickerSeedSource]
 */
export function buildVx27ContainerBeaconRigs(
  offsetX,
  ceilY,
  offsetZ,
  _innerW,
  _innerL,
  flickerSeedSource = null
) {
  const flickerSeed =
    typeof flickerSeedSource === "number"
      ? flickerSeedSource
      : vx27CeilingFlickerSeedFromPropId(
          typeof flickerSeedSource === "string" ? flickerSeedSource : null
        );
  return [createVx27ContainerCeilingLightRig(offsetX, ceilY, offsetZ, flickerSeed)];
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

/** @param {number} nightness 0 = day, 1 = night */
export function vx27DoorEgressNightScale(nightness) {
  const n = THREE.MathUtils.clamp(nightness, 0, 1);
  if (n <= 0.22) return 0;
  const t = (n - 0.22) / 0.78;
  return t * t * (3 - 2 * t);
}

/**
 * @param {number} time
 * @param {THREE.Object3D[]} [containers]
 * @param {{ nightness?: number }} [options]
 */
export function updateVx27ContainerBeaconLights(time, containers, options = {}) {
  const nightness = options.nightness ?? 0;
  /** @type {THREE.Light[]} */
  const lights = [];
  for (const container of containers ?? []) {
    if (container.userData?.vx27LightsForceOff) {
      applyVx27ContainerAllBeaconsEnabled(container, false);
      continue;
    }
    for (const rig of vx27ContainerBeaconRigsForContainer(container)) {
      if (rig.userData.vx27BeaconEnabled === false) continue;
      lights.push(...vx27BeaconRigLights(rig));
    }
  }
  updateVx27IndustrialCeilingFlicker(lights, time);
  for (const container of containers ?? []) {
    if (container.userData?.vx27LightsForceOff) continue;
    updateVx27ContainerDoorEgressLights(container, { nightness });
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
  light.visible = enabled;
  if (!enabled) {
    light.intensity = 0;
    return;
  }
  const flicker = light.userData.vx27IndustrialFlicker;
  const base =
    light.userData.vx27BaseIntensity ??
    flicker?.baseIntensity ??
    VX27_CEILING_LIGHT_INTENSITY;
  light.intensity = base * 0.82;
}

/** @param {THREE.Object3D} container @param {boolean} enabled */
export function applyVx27ContainerAllBeaconsEnabled(container, enabled) {
  if (enabled && container.userData?.vx27LightsForceOff) return;
  for (const rig of vx27ContainerBeaconRigsForContainer(container)) {
    applyVx27ContainerBeaconEnabled(rig, enabled);
  }
  for (const rig of vx27ContainerDoorEgressRigsForContainer(container)) {
    rig.userData.vx27DoorEgressEnabled = enabled;
    const spot = rig.userData.egressSpot;
    if (!spot?.isLight) continue;
    if (!enabled) {
      spot.intensity = 0;
      spot.visible = false;
    }
  }
}

/** Hard off — survives alwaysOn, culling restore, and flicker. */
export function forceVx27ContainerLightsOff(container) {
  if (!container) return;
  container.userData.vx27LightsForceOff = true;
  applyVx27ContainerAllBeaconsEnabled(container, false);
}

/** @param {THREE.Object3D[]} containers */
export function forceVx27ContainerLightsOffAll(containers) {
  for (const container of containers ?? []) {
    forceVx27ContainerLightsOff(container);
  }
}

/** @param {THREE.Object3D} container */
export function clearVx27ContainerLightsForceOff(container) {
  if (!container) return;
  delete container.userData.vx27LightsForceOff;
}

/** @param {number} edge0 @param {number} edge1 @param {number} x */
function vx27DoorEgressSmoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** @param {THREE.Group} container @param {"front" | "back"} end */
function vx27DoorEndOpenFactor(container, end) {
  const anim = container.userData?.vx27DoorAnim;
  const source = anim?.current ?? container.userData?.vx27DoorTuning ?? {};
  const maxOpen = Math.max(
    source[`${end}LeftOpen`] ?? 0,
    source[`${end}RightOpen`] ?? 0
  );
  if (maxOpen <= VX27_DOOR_COLLIDER_OPEN_THRESHOLD) return 0;
  return vx27DoorEgressSmoothstep(
    VX27_DOOR_COLLIDER_OPEN_THRESHOLD,
    VX27_DOOR_EGRESS_OPEN_FULL_DEG,
    maxOpen
  );
}

/**
 * @param {"front" | "back"} endKey
 * @param {ReturnType<typeof computeVx27DoorLayout>} layout
 * @param {number} halfL
 * @param {number} shell
 */
function createVx27ContainerDoorEgressRig(endKey, layout, halfL, shell) {
  const rig = new THREE.Group();
  rig.name = `vx27_container_door_egress_${endKey}`;
  const outward = endKey === "front" ? 1 : -1;
  const doorPlaneZ =
    endKey === "front" ? halfL - shell * 0.55 : -halfL + shell * 0.55;

  const target = new THREE.Object3D();
  target.name = `vx27_container_door_egress_${endKey}_target`;
  rig.add(target);

  const spot = new THREE.SpotLight(
    VX27_CEILING_LIGHT_COLOR,
    0,
    VX27_DOOR_EGRESS_SPOT_DISTANCE,
    VX27_DOOR_EGRESS_SPOT_ANGLE,
    VX27_DOOR_EGRESS_SPOT_PENUMBRA,
    1.55
  );
  spot.name = `vx27_container_door_egress_${endKey}_spot`;
  spot.castShadow = false;
  spot.target = target;
  spot.visible = false;
  spot.userData.vx27DoorEgressLight = true;
  spot.userData.vx27BaseIntensity = VX27_DOOR_EGRESS_SPOT_INTENSITY;
  pinLightToWorldLayer(spot);
  rig.add(spot);

  rig.position.set(layout.openCenterX, layout.doorCenterY, doorPlaneZ);
  target.position.set(
    layout.openCenterX,
    layout.doorCenterY * 0.55,
    doorPlaneZ + outward * 5.5
  );

  rig.userData.vx27DoorEgressRig = true;
  rig.userData.egressEnd = endKey;
  rig.userData.egressSpot = spot;
  rig.userData.egressTarget = target;
  rig.userData.vx27DoorEgressEnabled = true;

  return rig;
}

/**
 * World-only lights at end doors — ceiling spill onto the level at night.
 * @param {THREE.Group} container
 * @param {number} width
 * @param {number} height
 * @param {number} length
 * @param {number} shell
 * @param {import("./Vx27Container.js").Vx27InteriorInsets} insets
 * @param {number} edgeRadius
 */
export function buildVx27ContainerDoorEgressRigs(
  container,
  width,
  height,
  length,
  shell,
  insets,
  edgeRadius = 0
) {
  const old = container.getObjectByName("vx27_container_door_egress");
  if (old) {
    container.remove(old);
  }

  const layout = computeVx27DoorLayout(
    width,
    height,
    length,
    shell,
    insets,
    edgeRadius,
    container.userData?.vx27DoorTuning
  );
  const halfL = length / 2;
  const group = new THREE.Group();
  group.name = "vx27_container_door_egress";

  const rigs = [
    createVx27ContainerDoorEgressRig("front", layout, halfL, shell),
    createVx27ContainerDoorEgressRig("back", layout, halfL, shell),
  ];
  for (const rig of rigs) {
    group.add(rig);
  }
  container.add(group);
  container.userData.vx27DoorEgressRigs = rigs;
  wireVx27DoorEgressBeaconSources(container);
  return rigs;
}

/** @param {THREE.Object3D} container */
export function wireVx27DoorEgressBeaconSources(container) {
  const rigs = vx27ContainerBeaconRigsForContainer(container);
  const ceilingLight =
    rigs[0]?.userData?.ceilingLight ?? container.userData?.vx27CeilingLight ?? null;
  for (const egress of vx27ContainerDoorEgressRigsForContainer(container)) {
    egress.userData.sourceCeilingLight = ceilingLight;
  }
}

/** @param {THREE.Object3D} container @returns {THREE.Group[]} */
export function vx27ContainerDoorEgressRigsForContainer(container) {
  const rigs = container?.userData?.vx27DoorEgressRigs;
  return Array.isArray(rigs) ? rigs : [];
}

/** @param {THREE.Object3D[]} containers @returns {THREE.Light[]} */
export function collectVx27ContainerDoorEgressLights(containers) {
  const lights = [];
  for (const container of containers ?? []) {
    for (const rig of vx27ContainerDoorEgressRigsForContainer(container)) {
      if (rig.userData.egressSpot?.isLight) lights.push(rig.userData.egressSpot);
    }
  }
  return lights;
}

/**
 * @param {THREE.Group} container
 * @param {{ nightness?: number }} [options]
 */
export function updateVx27ContainerDoorEgressLights(container, options = {}) {
  const nightScale = vx27DoorEgressNightScale(options.nightness ?? 0);
  const ceiling =
    vx27ContainerBeaconRigsForContainer(container)[0]?.userData?.ceilingLight ??
    container.userData?.vx27CeilingLight ??
    null;
  const ceilingEnabled =
    vx27ContainerBeaconRigsForContainer(container)[0]?.userData?.vx27BeaconEnabled !==
    false;
  const baseIntensity =
    ceiling?.userData?.vx27BaseIntensity ?? VX27_CEILING_LIGHT_INTENSITY;
  const ceilingFactor =
    ceilingEnabled && baseIntensity > 0
      ? (ceiling?.intensity ?? 0) / baseIntensity
      : 0;

  for (const egress of vx27ContainerDoorEgressRigsForContainer(container)) {
    const spot = egress.userData.egressSpot;
    if (!spot?.isLight) continue;

    const enabled = egress.userData.vx27DoorEgressEnabled !== false;
    const doorOpen = vx27DoorEndOpenFactor(container, egress.userData.egressEnd);
    const spill =
      doorOpen > 0
        ? doorOpen
        : nightScale > 0
          ? VX27_DOOR_EGRESS_CLOSED_LEAK
          : 0;

    if (!enabled || nightScale <= 0 || ceilingFactor <= 0.02 || spill <= 0) {
      spot.visible = false;
      spot.intensity = 0;
      continue;
    }

    spot.penumbra = VX27_DOOR_EGRESS_SPOT_PENUMBRA;
    spot.decay = 1.55;
    spot.visible = true;
    spot.intensity =
      VX27_DOOR_EGRESS_SPOT_INTENSITY * ceilingFactor * nightScale * spill;
    if (ceiling?.color) {
      spot.color.copy(ceiling.color);
    } else {
      spot.color.setHex(VX27_CEILING_LIGHT_COLOR);
    }
    egress.userData.egressTarget?.updateMatrixWorld?.();
  }
}
