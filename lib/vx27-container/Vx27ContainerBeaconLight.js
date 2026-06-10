import * as THREE from "three";
import {
  attachCandleFlickerLight,
  deriveBarrelFlickerSeeds,
} from "../lighting/CandleFlicker.js";
import {
  pinLightToRoomInteriorLayer,
  setRoomInteriorLayer,
  setWorldLayer,
} from "../lighting/LightingLayers.js";

export const VX27_CEILING_LIGHT_COLOR = 0x5eaaff;
export const VX27_CEILING_LIGHT_INTENSITY = 22;
export const VX27_CEILING_LIGHT_DISTANCE = 20;
export const VX27_CEILING_LIGHT_DECAY = 1.2;
/** Spread along the troffer — each pin is this fraction of VX27_CEILING_LIGHT_INTENSITY. */
const VX27_CEILING_STRIP_POINT_COUNT = 10;
const VX27_CEILING_STRIP_POINT_BRIGHTNESS = 0.1;

export const VX27_CEILING_TUBE_EMISSIVE_BASE = 6.2;
const VX27_CEILING_STRIP_THICK = 0.022;
const VX27_CEILING_STRIP_LENGTH_FRAC = 0.62;
const VX27_CEILING_STRIP_MIN_LENGTH = 1;
const VX27_CEILING_STRIP_MAX_LENGTH = 2.45;

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
 * Troffer trim + one glowing tube along **+Z** (container length). Flush at ceiling.
 * @param {number} innerL
 */
function createVx27CeilingStripFixture(innerL) {
  const stripLen = THREE.MathUtils.clamp(
    innerL * VX27_CEILING_STRIP_LENGTH_FRAC,
    VX27_CEILING_STRIP_MIN_LENGTH,
    VX27_CEILING_STRIP_MAX_LENGTH
  );
  const fixture = new THREE.Group();
  fixture.name = "vx27_container_ceiling_fixture";

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x2a2e34,
    metalness: 0.5,
    roughness: 0.5,
  });
  /** @type {THREE.Mesh[]} */
  const fixtureMeshes = [];

  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.012, stripLen + 0.036),
      trimMat
    );
    rail.name = `vx27_container_ceiling_fixture_rail_${side < 0 ? "l" : "r"}`;
    rail.position.set(side * 0.038, -0.02, 0);
    rail.castShadow = false;
    rail.receiveShadow = true;
    setRoomInteriorLayer(rail);
    fixture.add(rail);
    fixtureMeshes.push(rail);
  }

  for (const side of [-1, 1]) {
    const endCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.064, 0.026, 0.022),
      trimMat
    );
    endCap.name = `vx27_container_ceiling_fixture_end_${side < 0 ? "l" : "r"}`;
    endCap.position.set(0, -0.02, side * (stripLen * 0.5 + 0.009));
    endCap.castShadow = false;
    endCap.receiveShadow = true;
    setRoomInteriorLayer(endCap);
    fixture.add(endCap);
    fixtureMeshes.push(endCap);
  }

  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0x6eb8ff,
    emissive: new THREE.Color(VX27_CEILING_LIGHT_COLOR),
    emissiveIntensity: VX27_CEILING_TUBE_EMISSIVE_BASE,
    metalness: 0,
    roughness: 0.18,
  });
  const tube = new THREE.Mesh(
    new THREE.BoxGeometry(0.078, VX27_CEILING_STRIP_THICK, stripLen),
    tubeMat
  );
  tube.name = "vx27_container_ceiling_fixture_tube";
  tube.position.y = -0.022;
  tube.castShadow = false;
  tube.receiveShadow = false;
  setRoomInteriorLayer(tube);
  fixture.add(tube);
  fixtureMeshes.push(tube);

  fixture.userData.vx27CeilingFixture = true;
  fixture.userData.ceilingTubeMat = tubeMat;
  fixture.userData.ceilingFixtureMeshes = fixtureMeshes;
  fixture.userData.stripLength = stripLen;

  return fixture;
}

/**
 * Ten point lights along the strip length — even spread, 10% brightness each.
 * @param {THREE.Group} rig
 * @param {number} stripLen
 */
function createVx27CeilingStripPointLights(rig, stripLen) {
  const perLightBase =
    VX27_CEILING_LIGHT_INTENSITY * VX27_CEILING_STRIP_POINT_BRIGHTNESS;
  /** @type {THREE.PointLight[]} */
  const lights = [];

  for (let i = 0; i < VX27_CEILING_STRIP_POINT_COUNT; i += 1) {
    const t =
      VX27_CEILING_STRIP_POINT_COUNT === 1
        ? 0.5
        : i / (VX27_CEILING_STRIP_POINT_COUNT - 1);
    const z = -stripLen * 0.5 + t * stripLen;

    const light = new THREE.PointLight(
      VX27_CEILING_LIGHT_COLOR,
      perLightBase,
      VX27_CEILING_LIGHT_DISTANCE,
      VX27_CEILING_LIGHT_DECAY
    );
    light.name = `vx27_container_ceiling_light_point_${i}`;
    light.position.set(0, -0.08, z);
    light.castShadow = false;
    light.userData.vx27ContainerLight = true;
    light.userData.vx27CeilingLight = true;
    light.userData.vx27CeilingStripPoint = true;
    light.userData.vx27BaseIntensity = perLightBase;
    pinLightToRoomInteriorLayer(light);
    rig.add(light);
    lights.push(light);
  }

  return lights;
}

/** Sync strip point lights + tube emissive to primary flicker ratio. */
export function syncVx27CeilingStripLighting(rig) {
  const primary = rig?.userData?.ceilingLight;
  if (!primary?.isLight) return;

  const perLightBase =
    primary.userData.vx27BaseIntensity ??
    VX27_CEILING_LIGHT_INTENSITY * VX27_CEILING_STRIP_POINT_BRIGHTNESS;
  const rigEnabled = rig.userData.vx27BeaconEnabled !== false;
  const ratio =
    rigEnabled && perLightBase > 0 ? primary.intensity / perLightBase : 0;

  for (const light of rig.userData?.ceilingLights ?? []) {
    if (!light?.isLight) continue;
    const lightBase = light.userData.vx27BaseIntensity ?? perLightBase;
    light.visible = rigEnabled;
    light.intensity = rigEnabled ? lightBase * ratio : 0;
  }

  const tubeMat = rig.userData?.ceilingTubeMat;
  if (tubeMat) {
    tubeMat.emissiveIntensity = rigEnabled
      ? VX27_CEILING_TUBE_EMISSIVE_BASE * ratio
      : 0;
  }
}

/**
 * One strip troffer at the ceiling + ten spread point lights (10% each).
 * @param {number} offsetX
 * @param {number} ceilY
 * @param {number} offsetZ
 * @param {number} [innerL]
 */
export function createVx27ContainerCeilingLightRig(
  offsetX,
  ceilY,
  offsetZ,
  innerL = 2.2
) {
  const rig = new THREE.Group();
  rig.name = "vx27_container_ceiling_light";
  rig.position.set(offsetX, ceilY, offsetZ);

  const fixture = createVx27CeilingStripFixture(innerL);
  const stripLen = fixture.userData.stripLength ?? VX27_CEILING_STRIP_MIN_LENGTH;
  rig.add(fixture);
  rig.userData.ceilingTubeMat = fixture.userData.ceilingTubeMat;
  rig.userData.ceilingFixtureMeshes = fixture.userData.ceilingFixtureMeshes;

  const lights = createVx27CeilingStripPointLights(rig, stripLen);
  rig.userData.ceilingLights = lights;
  rig.userData.ceilingLight = lights[0] ?? null;
  rig.userData.vx27BeaconRig = true;
  rig.userData.vx27BeaconEnabled = true;

  return rig;
}

/**
 * @param {number} offsetX
 * @param {number} ceilY
 * @param {number} offsetZ
 * @param {number} [_innerL]
 */
export function buildVx27ContainerBeaconRigs(offsetX, ceilY, offsetZ, _innerL) {
  return [createVx27ContainerCeilingLightRig(offsetX, ceilY, offsetZ, _innerL)];
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

/** Sync troffer glow after CandleFlicker updates the point light. */
export function updateVx27ContainerBeaconLights(containers) {
  for (const container of containers ?? []) {
    for (const rig of vx27ContainerBeaconRigsForContainer(container)) {
      syncVx27CeilingStripLighting(rig);
    }
  }
}

/** Attach candle-style flicker to ceiling light (same path as oil-barrel fire). */
export function initVx27ContainerCeilingLightFlicker(containers) {
  for (const container of containers ?? []) {
    const seed = vx27CeilingFlickerSeedFromPropId(
      container.userData?.vx27PropId ?? null
    );
    for (const rig of vx27ContainerBeaconRigsForContainer(container)) {
      const light = rig.userData?.ceilingLight;
      if (!light?.isLight) continue;
      delete light.userData.candleFlicker;
      const perLightBase =
        light.userData.vx27BaseIntensity ??
        VX27_CEILING_LIGHT_INTENSITY * VX27_CEILING_STRIP_POINT_BRIGHTNESS;
      attachCandleFlickerLight(
        light,
        VX27_CEILING_FLICKER_OPTS,
        deriveBarrelFlickerSeeds(seed, 0)
      );
      if (light.userData.candleFlicker) {
        light.userData.candleFlicker.baseIntensity = perLightBase;
      }
    }
  }
}

/** @param {THREE.Group} rig @returns {THREE.Light[]} */
export function vx27BeaconRigLights(rig) {
  const lights = rig?.userData?.ceilingLights;
  if (Array.isArray(lights) && lights.length) return lights.filter((l) => l?.isLight);
  const light = rig?.userData?.ceilingLight;
  return light?.isLight ? [light] : [];
}

/** @param {THREE.Group} rig @param {boolean} enabled */
export function applyVx27ContainerBeaconEnabled(rig, enabled) {
  if (!rig?.userData?.vx27BeaconRig) return;
  const primary = rig.userData.ceilingLight;
  if (!primary?.isLight) return;
  rig.userData.vx27BeaconEnabled = enabled;
  const perLightBase =
    primary.userData.vx27BaseIntensity ??
    VX27_CEILING_LIGHT_INTENSITY * VX27_CEILING_STRIP_POINT_BRIGHTNESS;
  for (const mesh of rig.userData.ceilingFixtureMeshes ?? []) {
    if (mesh?.isMesh) mesh.visible = enabled;
  }
  if (!enabled) {
    for (const light of rig.userData?.ceilingLights ?? []) {
      if (!light?.isLight) continue;
      light.visible = false;
      light.intensity = 0;
    }
    syncVx27CeilingStripLighting(rig);
    return;
  }

  for (const light of rig.userData?.ceilingLights ?? []) {
    if (light?.isLight) light.visible = true;
  }

  if (primary.userData.candleFlicker) {
    primary.userData.candleFlicker.baseIntensity = perLightBase;
    if (primary.intensity <= 0) {
      primary.intensity = perLightBase * VX27_CEILING_FLICKER_OPTS.baseFactor;
    }
    syncVx27CeilingStripLighting(rig);
    return;
  }

  for (const light of rig.userData?.ceilingLights ?? []) {
    if (!light?.isLight) continue;
    light.intensity = perLightBase;
  }
  syncVx27CeilingStripLighting(rig);
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

/** Pin egress spots to the world pass when rigs exist. */
export function pinVx27DoorEgressLightLayers(containers) {
  for (const container of containers ?? []) {
    for (const rig of vx27ContainerDoorEgressRigsForContainer(container)) {
      const spot = rig.userData?.egressSpot;
      if (spot?.isLight) setWorldLayer(spot);
    }
  }
}

/** @param {THREE.Object3D} _container @returns {THREE.Group[]} */
export function vx27ContainerDoorEgressRigsForContainer(_container) {
  return [];
}

/** @param {THREE.Object3D[]} _containers @returns {THREE.Light[]} */
export function collectVx27ContainerDoorEgressLights(_containers) {
  return [];
}

export function updateVx27ContainerDoorEgressLights() {}
