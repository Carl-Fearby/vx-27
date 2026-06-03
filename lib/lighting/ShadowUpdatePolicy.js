/** Manual shadow-map updates — renderer.shadowMap.autoUpdate stays false. */

import { areShadowsDisabled } from "../dev/ShadowDebug.js";

let frameCounter = 0;
/** Always refresh shadow maps for the first frames after load/warmup. */
let startupShadowFrames = 0;
const STARTUP_SHADOW_FRAME_COUNT = 4;

export function configureRendererShadowPolicy(renderer) {
  if (!renderer?.shadowMap) return;
  renderer.shadowMap.autoUpdate = false;
}

export function resetShadowUpdatePolicy() {
  frameCounter = 0;
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

  const dynamicLocal = flashlightShadow || barrelFireShadowCount > 0;
  if (dynamicLocal || dayNightAnimating) {
    requestShadowMapUpdate(renderer);
    return true;
  }

  if (startupShadowFrames < STARTUP_SHADOW_FRAME_COUNT) {
    startupShadowFrames += 1;
    requestShadowMapUpdate(renderer);
    return true;
  }

  // Directional-only, stable sun/moon: half-rate shadow refresh.
  frameCounter += 1;
  if ((frameCounter & 1) === 0) {
    requestShadowMapUpdate(renderer);
    return true;
  }
  return false;
}
