import * as THREE from "three";
import {
  pinLightToLayers,
  ROOM_INTERIOR_LAYER,
  setWorldLayer,
  WORLD_LAYER,
} from "../lighting/LightingLayers.js";

/** Main beam — original weapon spotlight (22° cone). */
const HOTSPOT_COLOR = 0xfff2dc;
const SPILL_COLOR = 0xdce8f8;

const HOTSPOT_INTENSITY = 32;
const SPILL_INTENSITY = 13;

const HOTSPOT_DISTANCE = 22;
const HOTSPOT_ANGLE = THREE.MathUtils.degToRad(22);
const HOTSPOT_PENUMBRA = 0.38;
const HOTSPOT_DECAY = 1.8;

/** Wider outer spill layered on top of the main beam. */
const SPILL_DISTANCE = 28;
const SPILL_ANGLE = THREE.MathUtils.degToRad(40);
const SPILL_PENUMBRA = 0.82;
const SPILL_DECAY = 1.75;

/** Near-field bounce around the torch — walls/floor beside the cone. */
const FILL_COLOR = 0xfff0e0;
const FILL_INTENSITY = 5.5;
const FILL_DISTANCE = 6;
const FILL_DECAY = 1.9;

/** Nudge origin forward so the cone clears the viewmodel / shoulder. */
const BEAM_START_OFFSET = 0.18;
/** Torch shadow only after dusk — daylight spill does not need a shadow pass. */
export const FLASHLIGHT_SHADOW_NIGHT_SCALE = 0.55;
/** Torch casts dynamic shadows at night when true. */
export const TORCH_SHADOWS_IN_DARK_ENABLED = true;
/** Stand still this long to run the shadow arm pass (freeze lands while idle). */
export const TORCH_SHADOW_IDLE_SEC = 0.25;
/** Shadows stay off until the beam finishes raising (spreads GPU cost off F-key). */
export const FLASHLIGHT_SHADOW_RAISE_BLEND = 0.88;

/** Shoulder-mounted offset in camera space (right, down, slightly forward). */
const _cameraOffset = new THREE.Vector3(0.14, -0.1, -0.06);
const _beamEnd = new THREE.Vector3();

/**
 * Scale beam strength through the day/night cycle — full power after dark,
 * subdued outdoors in daylight so the cone still reads without blowing out.
 * @param {number} nightness 0 = day, 1 = night
 */
export function flashlightNightScale(nightness) {
  const t = THREE.MathUtils.clamp(nightness, 0, 1);
  return THREE.MathUtils.lerp(0.42, 1, t * t);
}

function configureSpotShadow(spot, distance) {
  spot.castShadow = false;
  spot.shadow.mapSize.set(512, 512);
  spot.shadow.camera.near = 0.08;
  spot.shadow.camera.far = distance;
  spot.shadow.bias = -0.0012;
  spot.shadow.normalBias = 0.028;
}

const _zAxis = new THREE.Vector3(0, 0, -1);
const _blendDir = new THREE.Vector3();

function createVolumetricBeam() {
  const length = HOTSPOT_DISTANCE * 0.72;
  const radius = Math.tan(HOTSPOT_ANGLE) * length * 1.02;
  const geo = new THREE.ConeGeometry(radius, length, 24, 1, true);
  geo.translate(0, -length / 2, 0);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshBasicMaterial({
    color: 0xb8d8f8,
    transparent: true,
    opacity: 0.018,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "weapon_flashlight_beam";
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  setWorldLayer(mesh);
  return mesh;
}

/**
 * Weapon-mounted flashlight: original 22° main beam + wider spill + fog cone.
 *
 * @param {THREE.Scene} scene
 */
export function createWeaponFlashlight(scene) {
  const hotspot = new THREE.SpotLight(
    HOTSPOT_COLOR,
    0,
    HOTSPOT_DISTANCE,
    HOTSPOT_ANGLE,
    HOTSPOT_PENUMBRA,
    HOTSPOT_DECAY
  );
  configureSpotShadow(hotspot, HOTSPOT_DISTANCE);

  const spill = new THREE.SpotLight(
    SPILL_COLOR,
    0,
    SPILL_DISTANCE,
    SPILL_ANGLE,
    SPILL_PENUMBRA,
    SPILL_DECAY
  );
  spill.castShadow = false;

  const fill = new THREE.PointLight(FILL_COLOR, 0, FILL_DISTANCE, FILL_DECAY);
  fill.castShadow = false;

  const target = new THREE.Object3D();
  target.name = "weapon_flashlight_target";

  const beam = createVolumetricBeam();

  scene.add(target);
  scene.add(hotspot);
  scene.add(spill);
  scene.add(fill);
  scene.add(beam);

  hotspot.target = target;
  spill.target = target;

  pinLightToLayers(hotspot, WORLD_LAYER, ROOM_INTERIOR_LAYER);
  pinLightToLayers(spill, WORLD_LAYER, ROOM_INTERIOR_LAYER);
  pinLightToLayers(fill, WORLD_LAYER, ROOM_INTERIOR_LAYER);

  let wasShadowCasting = false;
  let activeShadowCast = false;

  /**
   * @param {THREE.WebGLRenderer} [renderer]
   */
  function primeShadowMaps(renderer) {
    if (renderer?.shadowMap) {
      renderer.shadowMap.needsUpdate = true;
    }
  }

  /**
   * @param {THREE.WebGLRenderer} [renderer]
   */
  function markShadowMapsPrimed(renderer) {
    primeShadowMaps(renderer);
  }

  /**
   * @param {THREE.Vector3} origin
   * @param {THREE.Vector3} direction Unit view forward.
   * @param {boolean} active Torch requested on (includes ground idle + raise).
   * @param {{
   *   nightness?: number,
   *   raiseBlend?: number,
   *   groundDirection?: THREE.Vector3,
   *   hideVisuals?: boolean,
   *   shadowArmed?: boolean,
   * }} [opts]
   */
  function sync(origin, direction, active, opts = {}) {
    const raiseBlend = THREE.MathUtils.clamp(opts.raiseBlend ?? 1, 0, 1);
    const nightScale = active ? flashlightNightScale(opts.nightness ?? 1) : 0;
    const raiseScale = active
      ? THREE.MathUtils.lerp(0.55, 1, raiseBlend * raiseBlend)
      : 0;
    const scale = nightScale * raiseScale;
    hotspot.intensity = HOTSPOT_INTENSITY * scale;
    spill.intensity = SPILL_INTENSITY * scale;
    fill.intensity = FILL_INTENSITY * scale;

    const casting = active && scale > 0.05;
    const shadowCasting =
      TORCH_SHADOWS_IN_DARK_ENABLED &&
      opts.shadowArmed === true &&
      casting &&
      nightScale >= FLASHLIGHT_SHADOW_NIGHT_SCALE &&
      raiseBlend >= FLASHLIGHT_SHADOW_RAISE_BLEND;
    activeShadowCast = shadowCasting;

    hotspot.castShadow = shadowCasting;
    if (hotspot.shadow) {
      hotspot.shadow.autoUpdate = shadowCasting;
      if (shadowCasting && !wasShadowCasting) {
        hotspot.shadow.needsUpdate = true;
      } else if (!shadowCasting) {
        hotspot.shadow.needsUpdate = false;
      }
    }
    wasShadowCasting = shadowCasting;

    beam.visible = !opts.hideVisuals && casting;
    if (beam.material) {
      beam.material.opacity = 0.011 + 0.02 * scale;
    }
    if (!active || scale <= 0) return;

    const groundDirection = opts.groundDirection;
    const dir =
      groundDirection && raiseBlend < 0.999
        ? _blendDir.copy(groundDirection).lerp(direction, raiseBlend).normalize()
        : direction;
    _beamEnd.copy(origin).addScaledVector(dir, HOTSPOT_DISTANCE * 0.85);

    hotspot.position.copy(origin);
    spill.position.copy(origin);
    fill.position.copy(origin);
    target.position.copy(_beamEnd);
    target.updateMatrixWorld();

    beam.position.copy(origin);
    beam.quaternion.setFromUnitVectors(_zAxis, dir);

    hotspot.shadow.camera.updateProjectionMatrix();
  }

  /**
   * Blend a shoulder/camera origin with the muzzle for hip fire; beam always
   * follows view forward.
   *
   * @param {THREE.Camera} camera
   * @param {THREE.Vector3} muzzlePos
   * @param {number} aimBlend 0 hip → 1 ADS
   * @param {THREE.Vector3} outOrigin
   * @param {THREE.Vector3} outDirection
   */
  function sampleFromCamera(camera, muzzlePos, aimBlend, outOrigin, outDirection) {
    outDirection.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

    _cameraOffset.set(0.14, -0.1, -0.06);
    _cameraOffset.applyQuaternion(camera.quaternion);
    outOrigin.copy(camera.position).add(_cameraOffset);

    const muzzleWeight = (1 - aimBlend) * 0.55;
    if (muzzleWeight > 0.001) {
      outOrigin.lerp(muzzlePos, muzzleWeight);
    }

    outOrigin.addScaledVector(outDirection, BEAM_START_OFFSET);
  }

  function dispose() {
    scene.remove(hotspot);
    scene.remove(spill);
    scene.remove(fill);
    scene.remove(target);
    scene.remove(beam);
    beam.geometry.dispose();
    beam.material.dispose();
  }

  function isCastingShadow() {
    return activeShadowCast;
  }

  return {
    hotspot,
    spill,
    fill,
    target,
    beam,
    sync,
    sampleFromCamera,
    primeShadowMaps,
    markShadowMapsPrimed,
    isCastingShadow,
    dispose,
  };
}
