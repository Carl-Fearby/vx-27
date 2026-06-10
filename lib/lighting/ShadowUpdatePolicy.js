/** Manual shadow-map updates — renderer.shadowMap.autoUpdate stays false. */

import { areShadowsDisabled } from "../dev/ShadowDebug.js";

let frameCounter = 0;
let barrelShadowFrameCounter = 0;
/** Always refresh shadow maps for the first frames after load / GPU preload. */
let startupShadowFrames = 0;
const STARTUP_SHADOW_FRAME_COUNT = 4;
const BARREL_FIRE_SHADOW_INTERVAL = 2;

export function configureRendererShadowPolicy(renderer) {
  if (!renderer?.shadowMap) return;
  renderer.shadowMap.autoUpdate = false;
}

export function resetShadowUpdatePolicy() {
  frameCounter = 0;
  barrelShadowFrameCounter = 0;
  startupShadowFrames = 0;
}

export function beginShadowStartupWindow() {
  startupShadowFrames = 0;
}

export function requestShadowMapUpdate(renderer) {
  if (areShadowsDisabled()) return;
  if (renderer?.shadowMap) renderer.shadowMap.needsUpdate = true;
}

/**
 * Decide whether to refresh shadow maps this frame.
 * @param {THREE.WebGLRenderer} renderer
 * @param {{
 *   sunCastsShadow?: boolean,
 *   moonCastsShadow?: boolean,
 *   dayNightAnimating?: boolean,
 *   flashlightShadow?: boolean,
 *   barrelFireShadowCount?: number,
 * }} opts
 * @returns {boolean}
 */
export function applyFrameShadowUpdates(renderer, opts = {}) {
  if (areShadowsDisabled()) return false;

  const sunCastsShadow = opts.sunCastsShadow === true;
  const moonCastsShadow = opts.moonCastsShadow === true;
  const dayNightAnimating = opts.dayNightAnimating === true;
  const flashlightShadow = opts.flashlightShadow === true;
  const barrelFireShadowCount = opts.barrelFireShadowCount ?? 0;

  const anyShadow =
    sunCastsShadow ||
    moonCastsShadow ||
    flashlightShadow ||
    barrelFireShadowCount > 0;
  if (!anyShadow) return false;

  // Day/night transitions move directional lights, so keep those full-rate.
  if (dayNightAnimating) {
    requestShadowMapUpdate(renderer);
    return true;
  }

  if (startupShadowFrames < STARTUP_SHADOW_FRAME_COUNT) {
    startupShadowFrames += 1;
    requestShadowMapUpdate(renderer);
    return true;
  }

  // Barrel-fire point lights use cube shadows; updating every frame is costly.
  // The light flicker still updates at rAF rate, while the shadow map follows
  // at half-rate to smooth frame time near burning barrels.
  if (barrelFireShadowCount > 0) {
    barrelShadowFrameCounter += 1;
    if (barrelShadowFrameCounter % BARREL_FIRE_SHADOW_INTERVAL === 0) {
      requestShadowMapUpdate(renderer);
      return true;
    }
    return false;
  }

  // Sun/moon and torch share half-rate refresh — torch shadow.autoUpdate
  // still repaints when the pass runs (avoids move hitch when torch is on).
  frameCounter += 1;
  if ((frameCounter & 1) === 0) {
    requestShadowMapUpdate(renderer);
    return true;
  }
  return false;
}
