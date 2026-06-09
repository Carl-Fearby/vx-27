import * as THREE from "three";
import {
  pinLightToRoomInteriorLayer,
  pinLightToWorldLayer,
  setRoomInteriorLayer,
} from "../lighting/LightingLayers.js";
import {
  computeVx27DoorLayout,
  VX27_DOOR_COLLIDER_OPEN_THRESHOLD,
} from "./Vx27ContainerDoors.js";

/** Blue front — one back-and-forth sweep (outside container). */
export const VX27_BEACON_ROTATION_PERIOD_SEC = 0.62;
/** Orange back — offset period so beacons stay disjointed. */
export const VX27_ORANGE_BEACON_ROTATION_PERIOD_SEC = 0.84;
/** Half arc each side — mirror-style police sweep, not full spin. */
export const VX27_BEACON_SWEEP_ARC = Math.PI * 0.4;
/** Blue front — strobe cycle when player is inside. */
export const VX27_BEACON_STROBE_CYCLE_SEC = 0.22;
/** Orange back — offset strobe rate. */
export const VX27_ORANGE_BEACON_STROBE_CYCLE_SEC = 0.36;
/** Short discharge per flash — not a sustained on phase. */
export const VX27_BEACON_STROBE_FLASH_SEC = 0.028;
/** Peak multiplier on the main beam during a flash. */
export const VX27_BEACON_STROBE_PEAK_BOOST = 1.85;
/** Outside sweep — visible narrow scan without white wash. */
export const VX27_BEACON_SWEEP_SPOT_FACTOR = 0.48;
export const VX27_BEACON_SWEEP_SPILL_FACTOR = 0.24;
export const VX27_BEACON_SWEEP_FILL_FACTOR = 0;
/** Inside strobe — wide flood to light the whole interior. */
export const VX27_BEACON_STROBE_SPOT_ANGLE = Math.PI / 2.05;
export const VX27_BEACON_STROBE_SPILL_ANGLE = Math.PI / 1.7;
export const VX27_BEACON_STROBE_SPOT_PENUMBRA = 0.88;
export const VX27_BEACON_STROBE_SPILL_PENUMBRA = 0.92;
export const VX27_BEACON_STROBE_SPILL_BOOST = 1.15;
export const VX27_BEACON_STROBE_FILL_BOOST = 1.2;
export const VX27_BEACON_STROBE_FILL_DISTANCE = 16;
/** Along interior length from center (±25%). */
export const VX27_BEACON_LENGTH_OFFSET_FRAC = 0.25;

export const VX27_BEACON_SPOT_COLOR = 0x5eaaff;
export const VX27_BEACON_LENS_COLOR = 0x9ed4ff;
export const VX27_BEACON_LENS_EMISSIVE = 0x3d8fff;
export const VX27_BEACON_FILL_COLOR = 0x1a3058;

export const VX27_ORANGE_BEACON_SPOT_COLOR = 0xff7700;
export const VX27_ORANGE_BEACON_LENS_COLOR = 0xffcc88;
export const VX27_ORANGE_BEACON_LENS_EMISSIVE = 0xff5500;
export const VX27_ORANGE_BEACON_FILL_COLOR = 0x2a1408;

export const VX27_BEACON_SPOT_INTENSITY = 18;
export const VX27_BEACON_SPILL_INTENSITY = 5;
export const VX27_BEACON_SPOT_DISTANCE = 13;
export const VX27_BEACON_SPOT_ANGLE = Math.PI / 5.4;
export const VX27_BEACON_SPILL_ANGLE = Math.PI / 5.8;
export const VX27_BEACON_SPOT_PENUMBRA = 0.22;
export const VX27_BEACON_SPOT_DECAY = 1.35;
export const VX27_BEACON_FILL_INTENSITY = 5.5;
export const VX27_BEACON_FILL_DISTANCE = 9;
export const VX27_BEACON_ORBIT_RADIUS = 1.35;
export const VX27_BEACON_TARGET_DROP = 1.75;

/** World-only spill through open end doors — not container sides. */
export const VX27_DOOR_EGRESS_SPOT_INTENSITY = 15;
export const VX27_DOOR_EGRESS_SPOT_DISTANCE = 12;
export const VX27_DOOR_EGRESS_SPOT_ANGLE = Math.PI / 3.4;
export const VX27_DOOR_EGRESS_SPOT_PENUMBRA = 0.55;
export const VX27_DOOR_EGRESS_ALIGN_POWER = 2.4;
export const VX27_DOOR_EGRESS_OPEN_FULL_DEG = 42;

/**
 * @typedef {{
 *   key: string,
 *   spotColor: number,
 *   lensColor: number,
 *   lensEmissive: number,
 *   fillColor: number,
 *   strobeCycleSec: number,
 *   rotationPeriodSec?: number,
 *   phaseOffset?: number,
 * }} Vx27BeaconRigConfig
 */

/** @param {Vx27BeaconRigConfig} config */
function vx27BeaconPalette(config) {
  return {
    spotColor: config.spotColor,
    lensColor: config.lensColor,
    lensEmissive: config.lensEmissive,
    fillColor: config.fillColor,
  };
}

/**
 * @param {number} offsetX
 * @param {number} ceilY
 * @param {number} offsetZ
 * @param {Vx27BeaconRigConfig} config
 */
export function createVx27ContainerBeaconRig(offsetX, ceilY, offsetZ, config) {
  const palette = vx27BeaconPalette(config);
  const rig = new THREE.Group();
  rig.name = `vx27_container_beacon_${config.key}`;

  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    emissive: palette.spotColor,
    emissiveIntensity: 0.65,
    metalness: 0.55,
    roughness: 0.4,
  });
  const housing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.07, 0.06, 10),
    housingMat
  );
  housing.name = `vx27_container_beacon_${config.key}_housing`;
  housing.castShadow = false;
  housing.receiveShadow = true;
  setRoomInteriorLayer(housing);
  rig.add(housing);

  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.042, 0.018, 10),
    new THREE.MeshStandardMaterial({
      color: palette.lensColor,
      emissive: palette.lensEmissive,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.92,
      metalness: 0.1,
      roughness: 0.2,
    })
  );
  lens.name = `vx27_container_beacon_${config.key}_lens`;
  lens.position.y = -0.028;
  setRoomInteriorLayer(lens);
  rig.add(lens);

  const target = new THREE.Object3D();
  target.name = `vx27_container_beacon_${config.key}_target`;
  rig.add(target);

  const spot = new THREE.SpotLight(
    palette.spotColor,
    VX27_BEACON_SPOT_INTENSITY,
    VX27_BEACON_SPOT_DISTANCE,
    VX27_BEACON_SPOT_ANGLE,
    VX27_BEACON_SPOT_PENUMBRA,
    VX27_BEACON_SPOT_DECAY
  );
  spot.name = `vx27_container_beacon_${config.key}_spot`;
  spot.castShadow = false;
  spot.target = target;
  spot.userData.vx27ContainerLight = true;
  spot.userData.vx27BeaconSpot = true;
  spot.userData.vx27BaseIntensity = VX27_BEACON_SPOT_INTENSITY;
  pinLightToRoomInteriorLayer(spot);
  rig.add(spot);

  const spill = new THREE.SpotLight(
    palette.spotColor,
    VX27_BEACON_SPILL_INTENSITY,
    VX27_BEACON_SPOT_DISTANCE,
    VX27_BEACON_SPILL_ANGLE,
    0.35,
    VX27_BEACON_SPOT_DECAY
  );
  spill.name = `vx27_container_beacon_${config.key}_spill`;
  spill.castShadow = false;
  spill.target = target;
  spill.userData.vx27ContainerLight = true;
  spill.userData.vx27BeaconSpill = true;
  spill.userData.vx27BaseIntensity = VX27_BEACON_SPILL_INTENSITY;
  pinLightToRoomInteriorLayer(spill);
  rig.add(spill);

  const fill = new THREE.PointLight(
    palette.fillColor,
    VX27_BEACON_FILL_INTENSITY,
    VX27_BEACON_FILL_DISTANCE,
    1.6
  );
  fill.name = `vx27_container_beacon_${config.key}_fill`;
  fill.castShadow = false;
  fill.userData.vx27ContainerLight = true;
  fill.userData.vx27BeaconFill = true;
  fill.userData.vx27BaseIntensity = VX27_BEACON_FILL_INTENSITY;
  pinLightToRoomInteriorLayer(fill);
  rig.add(fill);

  rig.position.set(offsetX, ceilY - 0.12, offsetZ);
  rig.userData.vx27BeaconRig = true;
  rig.userData.beaconKey = config.key;
  rig.userData.beaconTarget = target;
  rig.userData.beaconSpot = spot;
  rig.userData.beaconSpill = spill;
  rig.userData.beaconFill = fill;
  rig.userData.beaconHousing = housing;
  rig.userData.beaconLens = lens;
  rig.userData.vx27BeaconEnabled = true;
  rig.userData.strobeCycleSec = config.strobeCycleSec;
  rig.userData.rotationPeriodSec =
    config.rotationPeriodSec ?? VX27_BEACON_ROTATION_PERIOD_SEC;
  rig.userData.phaseOffset = config.phaseOffset ?? 0;

  return rig;
}

/**
 * Blue front and orange back (±25% along interior length), each with its own sweep and strobe rate.
 * @param {number} offsetX
 * @param {number} ceilY
 * @param {number} offsetZ
 * @param {number} innerL
 */
export function buildVx27ContainerBeaconRigs(offsetX, ceilY, offsetZ, innerL) {
  const lengthOffset = innerL * VX27_BEACON_LENGTH_OFFSET_FRAC;

  return [
    createVx27ContainerBeaconRig(offsetX, ceilY, offsetZ + lengthOffset, {
      key: "blue_front",
      spotColor: VX27_BEACON_SPOT_COLOR,
      lensColor: VX27_BEACON_LENS_COLOR,
      lensEmissive: VX27_BEACON_LENS_EMISSIVE,
      fillColor: VX27_BEACON_FILL_COLOR,
      strobeCycleSec: VX27_BEACON_STROBE_CYCLE_SEC,
      rotationPeriodSec: VX27_BEACON_ROTATION_PERIOD_SEC,
      phaseOffset: 0,
    }),
    createVx27ContainerBeaconRig(offsetX, ceilY, offsetZ - lengthOffset, {
      key: "orange_back",
      spotColor: VX27_ORANGE_BEACON_SPOT_COLOR,
      lensColor: VX27_ORANGE_BEACON_LENS_COLOR,
      lensEmissive: VX27_ORANGE_BEACON_LENS_EMISSIVE,
      fillColor: VX27_ORANGE_BEACON_FILL_COLOR,
      strobeCycleSec: VX27_ORANGE_BEACON_STROBE_CYCLE_SEC,
      rotationPeriodSec: VX27_ORANGE_BEACON_ROTATION_PERIOD_SEC,
      phaseOffset: Math.PI * 0.58,
    }),
  ];
}

/** @param {THREE.Object3D} container @returns {THREE.Group[]} */
export function vx27ContainerBeaconRigsForContainer(container) {
  const rigs = container?.userData?.vx27BeaconRigs;
  if (Array.isArray(rigs) && rigs.length) return rigs;
  const single = container?.userData?.vx27BeaconRig;
  return single ? [single] : [];
}

/** @param {number} timeSec @param {number} cycleSec @returns {number} */
function vx27BeaconStrobeFactor(timeSec, cycleSec) {
  const t = timeSec % cycleSec;
  return t < VX27_BEACON_STROBE_FLASH_SEC ? 1 : 0;
}

/** @param {THREE.Light} light @param {boolean} sweep */
function vx27BeaconLightSweepFactor(light, sweep) {
  if (!sweep) return 1;
  if (light.userData.vx27BeaconSpot) return VX27_BEACON_SWEEP_SPOT_FACTOR;
  if (light.userData.vx27BeaconSpill) return VX27_BEACON_SWEEP_SPILL_FACTOR;
  if (light.userData.vx27BeaconFill) return VX27_BEACON_SWEEP_FILL_FACTOR;
  return 1;
}

/** @param {THREE.Group} rig @param {"sweep" | "strobe"} mode */
function applyVx27BeaconRigBeamProfile(rig, mode) {
  if (rig.userData.lastBeamMode === mode) return;
  rig.userData.lastBeamMode = mode;
  const spot = rig.userData.beaconSpot;
  const spill = rig.userData.beaconSpill;
  const fill = rig.userData.beaconFill;
  const sweep = mode === "sweep";

  if (spot?.isSpotLight) {
    spot.angle = sweep ? VX27_BEACON_SPOT_ANGLE : VX27_BEACON_STROBE_SPOT_ANGLE;
    spot.penumbra = sweep ? VX27_BEACON_SPOT_PENUMBRA : VX27_BEACON_STROBE_SPOT_PENUMBRA;
  }
  if (spill?.isSpotLight) {
    spill.angle = sweep ? VX27_BEACON_SPILL_ANGLE : VX27_BEACON_STROBE_SPILL_ANGLE;
    spill.penumbra = sweep ? 0.35 : VX27_BEACON_STROBE_SPILL_PENUMBRA;
  }
  if (fill?.isPointLight) {
    fill.distance = sweep ? VX27_BEACON_FILL_DISTANCE : VX27_BEACON_STROBE_FILL_DISTANCE;
  }
}

/** @param {THREE.Light} light @param {boolean} strobe */
function vx27BeaconStrobeLightBoost(light, strobe) {
  if (!strobe) return 1;
  if (light.userData.vx27BeaconSpot) return VX27_BEACON_STROBE_PEAK_BOOST;
  if (light.userData.vx27BeaconSpill) return VX27_BEACON_STROBE_SPILL_BOOST;
  if (light.userData.vx27BeaconFill) return VX27_BEACON_STROBE_FILL_BOOST;
  return 1;
}

/**
 * @param {THREE.Group} rig
 * @param {number} intensityFactor 0–1 continuous scale; 1 = full base levels
 * @param {{ strobe?: boolean, sweep?: boolean, phase?: number }} [options]
 */
function applyVx27BeaconRigIntensity(rig, intensityFactor, options = {}) {
  const enabled = rig.userData.vx27BeaconEnabled !== false;
  const f = enabled ? Math.max(0, Math.min(1, intensityFactor)) : 0;
  const strobe = options.strobe === true;
  const sweep = options.sweep === true;
  const phase = options.phase ?? 0;

  for (const light of vx27BeaconRigLights(rig)) {
    const base = light.userData.vx27BaseIntensity ?? light.intensity;
    light.visible = enabled;
    if (!enabled || f <= 0) {
      light.intensity = 0;
      continue;
    }
    if (strobe) {
      light.intensity = base * f * vx27BeaconStrobeLightBoost(light, true);
      continue;
    }
    light.intensity = base * f * vx27BeaconLightSweepFactor(light, sweep);
  }

  if (rig.userData.beaconHousing) {
    rig.userData.beaconHousing.visible = enabled;
    if (rig.userData.beaconHousing.material) {
      if (strobe) {
        rig.userData.beaconHousing.material.emissiveIntensity = 0.04 + f * 1.1;
      } else if (sweep) {
        rig.userData.beaconHousing.material.emissiveIntensity =
          0.18 + Math.abs(Math.sin(phase)) * 0.28;
      } else {
        rig.userData.beaconHousing.material.emissiveIntensity = 0.65 * f;
      }
    }
  }
  if (rig.userData.beaconLens) {
    rig.userData.beaconLens.visible = enabled;
    if (rig.userData.beaconLens.material) {
      if (strobe) {
        rig.userData.beaconLens.material.emissiveIntensity = 0.08 + f * 2.8;
      } else if (sweep) {
        rig.userData.beaconLens.material.emissiveIntensity =
          0.38 + Math.abs(Math.sin(phase)) * 0.55;
      } else {
        rig.userData.beaconLens.material.emissiveIntensity = 1.1 * f;
      }
    }
  }
}

/** @param {THREE.Group} rig @param {number} timeSec @param {boolean} playerInside */
export function updateVx27ContainerBeaconRig(rig, timeSec, playerInside = false) {
  if (!rig?.userData?.vx27BeaconRig) return;
  const target = rig.userData.beaconTarget;
  if (!target) return;

  if (playerInside) {
    applyVx27BeaconRigBeamProfile(rig, "strobe");
    target.position.set(0, -VX27_BEACON_TARGET_DROP, 0);
    const cycleSec = rig.userData.strobeCycleSec ?? VX27_BEACON_STROBE_CYCLE_SEC;
    const strobeFactor = vx27BeaconStrobeFactor(timeSec, cycleSec);
    applyVx27BeaconRigIntensity(rig, strobeFactor, {
      strobe: true,
    });
    rig.userData.lastBeamIntensity = strobeFactor;
    rig.userData.lastPlayerInside = true;
    rig.userData.lastSweepAngle = 0;
    return;
  }

  applyVx27BeaconRigBeamProfile(rig, "sweep");
  const period = rig.userData.rotationPeriodSec ?? VX27_BEACON_ROTATION_PERIOD_SEC;
  const phaseOffset = rig.userData.phaseOffset ?? 0;
  const cyclePhase = ((timeSec % period) / period) * Math.PI * 2;
  const sweepAngle = phaseOffset + Math.sin(cyclePhase) * VX27_BEACON_SWEEP_ARC;
  target.position.set(
    Math.cos(sweepAngle) * VX27_BEACON_ORBIT_RADIUS,
    -VX27_BEACON_TARGET_DROP,
    Math.sin(sweepAngle) * VX27_BEACON_ORBIT_RADIUS
  );
  const sweepPulse = 0.58 + 0.42 * Math.abs(Math.sin(cyclePhase));
  applyVx27BeaconRigIntensity(rig, sweepPulse, { sweep: true, phase: cyclePhase });
  rig.userData.lastBeamIntensity = sweepPulse;
  rig.userData.lastPlayerInside = false;
  rig.userData.lastSweepAngle = sweepAngle;
}

/**
 * @param {THREE.Object3D[]} containers
 * @param {number} timeSec
 * @param {THREE.Group | null} [playerContainer] container the player is inside, if any
 */
export function updateVx27ContainerBeaconLights(
  containers,
  timeSec,
  playerContainer = null
) {
  for (const container of containers ?? []) {
    const playerInside = playerContainer === container;
    if (!playerInside && container.userData?.vx27CullVisible === false) {
      continue;
    }
    for (const rig of vx27ContainerBeaconRigsForContainer(container)) {
      updateVx27ContainerBeaconRig(rig, timeSec, playerInside);
    }
    updateVx27ContainerDoorEgressLights(container);
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
  rig.userData.vx27BeaconEnabled = enabled;
  applyVx27BeaconRigIntensity(rig, enabled ? 1 : 0);
}

/** @param {THREE.Object3D} container @param {boolean} enabled */
export function applyVx27ContainerAllBeaconsEnabled(container, enabled) {
  for (const rig of vx27ContainerBeaconRigsForContainer(container)) {
    applyVx27ContainerBeaconEnabled(rig, enabled);
  }
  for (const rig of vx27ContainerDoorEgressRigsForContainer(container)) {
    rig.userData.vx27DoorEgressEnabled = enabled;
    if (!enabled && rig.userData.egressSpot?.isLight) {
      rig.userData.egressSpot.intensity = 0;
      rig.userData.egressSpot.visible = false;
    }
  }
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
 * @param {number} spotColor
 * @param {string} sourceBeaconKey
 * @param {ReturnType<typeof computeVx27DoorLayout>} layout
 * @param {number} halfL
 * @param {number} shell
 */
function createVx27ContainerDoorEgressRig(
  endKey,
  spotColor,
  sourceBeaconKey,
  layout,
  halfL,
  shell
) {
  const rig = new THREE.Group();
  rig.name = `vx27_container_door_egress_${endKey}`;
  const outward = endKey === "front" ? 1 : -1;
  const doorPlaneZ =
    endKey === "front" ? halfL - shell * 0.55 : -halfL + shell * 0.55;

  const target = new THREE.Object3D();
  target.name = `vx27_container_door_egress_${endKey}_target`;
  rig.add(target);

  const spot = new THREE.SpotLight(
    spotColor,
    0,
    VX27_DOOR_EGRESS_SPOT_DISTANCE,
    VX27_DOOR_EGRESS_SPOT_ANGLE,
    VX27_DOOR_EGRESS_SPOT_PENUMBRA,
    1.25
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
  rig.userData.sourceBeaconKey = sourceBeaconKey;
  rig.userData.egressSpot = spot;
  rig.userData.egressTarget = target;
  rig.userData.vx27DoorEgressEnabled = true;

  return rig;
}

/**
 * World-only lights at end doors — spill outside only when doors are open.
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
  if (old) container.remove(old);

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
    createVx27ContainerDoorEgressRig(
      "front",
      VX27_BEACON_SPOT_COLOR,
      "blue_front",
      layout,
      halfL,
      shell
    ),
    createVx27ContainerDoorEgressRig(
      "back",
      VX27_ORANGE_BEACON_SPOT_COLOR,
      "orange_back",
      layout,
      halfL,
      shell
    ),
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
  const beaconRigs = vx27ContainerBeaconRigsForContainer(container);
  for (const egress of vx27ContainerDoorEgressRigsForContainer(container)) {
    egress.userData.sourceBeaconRig =
      beaconRigs.find(
        (rig) => rig.userData.beaconKey === egress.userData.sourceBeaconKey
      ) ?? null;
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

/** @param {"front" | "back"} end @param {number} sweepAngle */
function vx27DoorEgressBeamAlign(end, sweepAngle) {
  const outward = end === "front" ? Math.sin(sweepAngle) : -Math.sin(sweepAngle);
  return Math.pow(Math.max(0, outward), VX27_DOOR_EGRESS_ALIGN_POWER);
}

/** @param {THREE.Group} container */
export function updateVx27ContainerDoorEgressLights(container) {
  for (const egress of vx27ContainerDoorEgressRigsForContainer(container)) {
    const spot = egress.userData.egressSpot;
    if (!spot?.isLight) continue;

    const enabled = egress.userData.vx27DoorEgressEnabled !== false;
    const doorOpen = vx27DoorEndOpenFactor(container, egress.userData.egressEnd);
    const source = egress.userData.sourceBeaconRig;
    const sourceEnabled = source?.userData?.vx27BeaconEnabled !== false;
    const beamIntensity = source?.userData?.lastBeamIntensity ?? 0;

    if (!enabled || !sourceEnabled || doorOpen <= 0 || beamIntensity <= 0) {
      spot.visible = false;
      spot.intensity = 0;
      continue;
    }

    let align = 1;
    if (!source.userData.lastPlayerInside) {
      align = vx27DoorEgressBeamAlign(
        egress.userData.egressEnd,
        source.userData.lastSweepAngle ?? 0
      );
    }
    if (align <= 0) {
      spot.visible = false;
      spot.intensity = 0;
      continue;
    }

    const base = spot.userData.vx27BaseIntensity ?? VX27_DOOR_EGRESS_SPOT_INTENSITY;
    spot.visible = true;
    spot.intensity = base * beamIntensity * doorOpen * align;
    spot.color.setHex(
      source.userData.beaconSpot?.color?.getHex?.() ??
        (egress.userData.egressEnd === "front"
          ? VX27_BEACON_SPOT_COLOR
          : VX27_ORANGE_BEACON_SPOT_COLOR)
    );
  }
}
