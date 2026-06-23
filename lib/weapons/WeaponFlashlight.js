import * as THREE from "three";
import {
  pinLightToLayers,
  ROOM_INTERIOR_LAYER,
  WORLD_LAYER,
} from "../lighting/LightingLayers.js";

/** Main beam — weapon spotlight (22° cone). */
const HOTSPOT_COLOR = 0xfff2dc;
const HOTSPOT_INTENSITY = 32;
const HOTSPOT_DISTANCE = 22;
const HOTSPOT_ANGLE = THREE.MathUtils.degToRad(22);
const HOTSPOT_PENUMBRA = 0.48;
const HOTSPOT_DECAY = 1.8;

/** Base forward pull from the muzzle along the barrel (metres). */
export const FLASHLIGHT_MUZZLE_FORWARD = 0.12;
/** Extra forward pull at full hip — keeps the spot off the viewmodel without camera-locked aim. */
export const FLASHLIGHT_HIP_FORWARD_EXTRA = 0.32;
/** Torch shadow only after dusk — daylight spill does not need a shadow pass. */
export const FLASHLIGHT_SHADOW_NIGHT_SCALE = 0.55;
/** Dynamic torch shadows are expensive at night — keep off until a cheaper path exists. */
export const TORCH_SHADOWS_IN_DARK_ENABLED = false;
/** Stand still this long to run the shadow arm pass (freeze lands while idle). */
export const TORCH_SHADOW_IDLE_SEC = 0.25;
/** Shadows stay off until the beam finishes raising (spreads GPU cost off F-key). */
export const FLASHLIGHT_SHADOW_RAISE_BLEND = 0.88;

const _beamEnd = new THREE.Vector3();

/** Drop stale beam/spill meshes if hot reload left them in the scene. */
function disposeOrphanFlashlightMeshes(scene) {
  const orphans = [];
  scene.traverse((obj) => {
    if (
      obj.name === "weapon_flashlight_beam" ||
      obj.name === "weapon_flashlight_spill" ||
      obj.name === "weapon_flashlight_fill"
    ) {
      orphans.push(obj);
    }
  });
  for (const obj of orphans) {
    obj.parent?.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) mat.dispose?.();
    }
  }
}

/**
 * Scale beam strength through the day/night cycle — full power after dark,
 * subdued outdoors in daylight so the cone still reads without blowing out.
 * @param {number} nightness 0 = day, 1 = night
 */
export function flashlightNightScale(nightness) {
  const t = THREE.MathUtils.clamp(nightness, 0, 1);
  return THREE.MathUtils.lerp(0.42, 1, t * t);
}

/**
 * Weapon-mounted flashlight: single 22° spotlight cone.
 *
 * @param {THREE.Scene} scene
 */
export function createWeaponFlashlight(scene) {
  disposeOrphanFlashlightMeshes(scene);

  const hotspot = new THREE.SpotLight(
    HOTSPOT_COLOR,
    0,
    HOTSPOT_DISTANCE,
    HOTSPOT_ANGLE,
    HOTSPOT_PENUMBRA,
    HOTSPOT_DECAY
  );
  hotspot.castShadow = false;

  const target = new THREE.Object3D();
  target.name = "weapon_flashlight_target";

  scene.add(target);
  scene.add(hotspot);
  hotspot.target = target;

  pinLightToLayers(hotspot, WORLD_LAYER, ROOM_INTERIOR_LAYER);

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

    const casting = active && scale > 0.05;
    const shadowCasting =
      TORCH_SHADOWS_IN_DARK_ENABLED &&
      opts.shadowArmed === true &&
      casting &&
      nightScale >= FLASHLIGHT_SHADOW_NIGHT_SCALE &&
      raiseBlend >= FLASHLIGHT_SHADOW_RAISE_BLEND;
    activeShadowCast = shadowCasting;
    hotspot.castShadow = shadowCasting;

    if (!active || scale <= 0) return;

    _beamEnd.copy(origin).addScaledVector(direction, HOTSPOT_DISTANCE * 0.85);

    hotspot.position.copy(origin);
    target.position.copy(_beamEnd);
    target.updateMatrixWorld();
  }

  function dispose() {
    scene.remove(hotspot);
    scene.remove(target);
  }

  function isCastingShadow() {
    return activeShadowCast;
  }

  return {
    hotspot,
    target,
    sync,
    primeShadowMaps,
    markShadowMapsPrimed,
    isCastingShadow,
    dispose,
  };
}
