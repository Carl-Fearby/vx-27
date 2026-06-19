import * as THREE from "three";
import {
  computeDayNightToneExposure,
  computeRainAtmosphereClearColor,
} from "@/lib/lighting/SceneEnvironment.js";

/** Seconds between lightning strikes while rain is active. */
const MIN_STRIKE_INTERVAL = 7;
const MAX_STRIKE_INTERVAL = 24;
/** Roughly half of storms are a quick double-flash. */
const DOUBLE_FLASH_CHANCE = 0.48;

const _flashTint = new THREE.Color(0xdce8ff);
const _baseClear = new THREE.Color();
const _flashClear = new THREE.Color();

/** @typedef {{ peak: number, decayRate: number, gapBefore: number }} LightningPulse */

function randomStrikeInterval() {
  return MIN_STRIKE_INTERVAL + Math.random() * (MAX_STRIKE_INTERVAL - MIN_STRIKE_INTERVAL);
}

function randomDecayForPeak(peak) {
  if (peak < 0.32) return 4 + Math.random() * 5;
  if (peak > 0.72) return 9 + Math.random() * 14;
  return 6 + Math.random() * 9;
}

/** Single-flash brightness — dim sheet, medium, or sharp bright strike. */
function singleFlashPeak(rainFade) {
  const roll = Math.random();
  if (roll < 0.22) return (0.1 + Math.random() * 0.22) * rainFade;
  if (roll < 0.68) return (0.36 + Math.random() * 0.34) * rainFade;
  return (0.72 + Math.random() * 0.28) * rainFade;
}

/**
 * @param {number} rainFade
 * @param {"primary" | "secondary"} role
 */
function doubleFlashPeak(rainFade, role) {
  const min = role === "secondary" ? 0.16 : 0.28;
  const max = role === "secondary" ? 0.88 : 1;
  return (min + Math.random() * (max - min)) * rainFade;
}

/**
 * @param {number} rainFade
 * @returns {LightningPulse[]}
 */
function buildStormPulses(rainFade) {
  if (Math.random() >= DOUBLE_FLASH_CHANCE) {
    const peak = singleFlashPeak(rainFade);
    return [{ peak, decayRate: randomDecayForPeak(peak), gapBefore: 0 }];
  }

  const strongFirst = Math.random() < 0.44;
  const peak1 = Math.min(
    1,
    doubleFlashPeak(rainFade, "primary") * (strongFirst ? 1.05 : 0.62)
  );
  const peak2 = Math.min(
    1,
    doubleFlashPeak(rainFade, "secondary") * (strongFirst ? 0.78 : 1.08)
  );
  const gap = 0.04 + Math.random() * 0.12;

  return [
    { peak: peak1, decayRate: randomDecayForPeak(peak1), gapBefore: 0 },
    { peak: peak2, decayRate: randomDecayForPeak(peak2), gapBefore: gap },
  ];
}

export function createLightningFlashState() {
  return {
    strength: 0,
    decayRate: 9,
    timeToNext: randomStrikeInterval(),
    /** @type {LightningPulse[]} */
    pulseQueue: [],
    inGap: false,
    gapCountdown: 0,
  };
}

/**
 * @param {ReturnType<typeof createLightningFlashState>} state
 * @param {LightningPulse} pulse
 */
function firePulse(state, pulse) {
  state.strength = pulse.peak;
  state.decayRate = pulse.decayRate;
}

/**
 * @param {ReturnType<typeof createLightningFlashState>} state
 * @param {number} rainFade
 */
function startStormBurst(state, rainFade) {
  const pulses = buildStormPulses(rainFade);
  const [first, ...rest] = pulses;
  firePulse(state, first);
  state.pulseQueue = rest;
  state.inGap = false;
  state.gapCountdown = 0;
}

/**
 * @param {ReturnType<typeof createLightningFlashState>} state
 */
function resetLightningFlash(state) {
  state.strength = 0;
  state.pulseQueue = [];
  state.inGap = false;
  state.gapCountdown = 0;
  state.timeToNext = randomStrikeInterval();
}

/**
 * @param {ReturnType<typeof createLightningFlashState>} state
 * @param {number} dt
 */
function tickActivePulse(state, dt) {
  if (state.inGap) {
    state.gapCountdown -= dt;
    if (state.gapCountdown <= 0 && state.pulseQueue.length > 0) {
      state.inGap = false;
      firePulse(state, state.pulseQueue.shift());
    }
    return;
  }

  if (state.strength <= 0) return;

  state.strength = Math.max(0, state.strength - state.decayRate * dt);
  if (state.strength <= 0 && state.pulseQueue.length > 0) {
    const next = state.pulseQueue[0];
    state.gapCountdown = next.gapBefore;
    state.inGap = true;
  }
}

/**
 * @param {ReturnType<typeof createLightningFlashState>} state
 * @param {number} dt
 * @param {{ rainFade?: number, active?: boolean }} [opts]
 */
export function tickLightningFlash(state, dt, opts = {}) {
  const rainFade = Math.min(1, Math.max(0, opts.rainFade ?? 0));
  const active = opts.active !== false;

  tickActivePulse(state, dt);

  if (!active || rainFade < 0.3) {
    resetLightningFlash(state);
    return;
  }

  const stormBusy =
    state.strength > 0 || state.inGap || state.pulseQueue.length > 0;
  if (stormBusy) return;

  state.timeToNext -= dt;
  if (state.timeToNext > 0) return;

  startStormBurst(state, rainFade);
  state.timeToNext = randomStrikeInterval();
}

/**
 * Strong sky-only flash — drives SkyDome uLightningFlash (can exceed level brightness).
 * @param {ReturnType<typeof createLightningFlashState>} state
 * @param {number} nightness
 */
export function getLightningSkyFlashStrength(state, nightness) {
  const s = state.strength;
  if (s <= 0.001) return 0;
  const nightMul = THREE.MathUtils.lerp(0.75, 1.35, nightness);
  return s * nightMul;
}

/**
 * Subtle level flash — fog tint + exposure only; kept well below the sky pulse.
 * @param {ReturnType<typeof createLightningFlashState>} state
 * @param {number} nightness
 */
export function getLightningLevelFlashStrength(state, nightness) {
  const s = state.strength;
  if (s <= 0.001) return 0;
  return s * THREE.MathUtils.lerp(0.18, 0.38, nightness);
}

/**
 * @deprecated Use {@link getLightningSkyFlashStrength} — kept for callers that only need sky boost.
 * @param {ReturnType<typeof createLightningFlashState>} state
 * @param {number} nightness
 */
export function getLightningSkyBrightnessBoost(state, nightness) {
  return getLightningSkyFlashStrength(state, nightness) * 0.35;
}

/**
 * Screen overlay opacity — stronger when sheltered so indoor rain still reads.
 * @param {ReturnType<typeof createLightningFlashState>} state
 * @param {{ sheltered?: boolean }} [opts]
 */
export function getLightningFlashOverlayOpacity(state, opts = {}) {
  const s = getLightningLevelFlashStrength(state, opts.nightness ?? 0.5);
  if (s <= 0.001) return 0;
  const peak = opts.sheltered ? 0.38 : 0.12;
  return s * peak;
}

/**
 * Brighten fog + clear color and bump exposure on top of the frame's base atmosphere.
 * Values are set absolutely each frame — never read-modify-write the renderer state.
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {ReturnType<typeof createLightningFlashState>} state
 * @param {number} nightness
 * @param {number} rainDay
 */
export function applyLightningFlashAtmosphere(scene, renderer, state, nightness, rainDay) {
  const s = getLightningLevelFlashStrength(state, nightness);
  const baseExposure = computeDayNightToneExposure(nightness);

  if (s <= 0.001) {
    if (scene.fog) {
      computeRainAtmosphereClearColor(nightness, rainDay, _baseClear);
      scene.fog.color.copy(_baseClear);
      renderer.setClearColor(_baseClear, 1);
    }
    renderer.toneMappingExposure = baseExposure;
    return;
  }

  if (!scene.fog) {
    renderer.toneMappingExposure = baseExposure * (1 + s * 0.85);
    return;
  }

  const t = s;
  computeRainAtmosphereClearColor(nightness, rainDay, _baseClear);
  _flashClear.copy(_baseClear).lerp(_flashTint, t * 0.55);
  renderer.setClearColor(_flashClear, 1);
  scene.fog.color.copy(_flashClear);
  renderer.toneMappingExposure = baseExposure * (1 + t * 0.95);
}

/**
 * @param {HTMLElement | null} el
 * @param {ReturnType<typeof createLightningFlashState>} state
 * @param {{ sheltered?: boolean }} [opts]
 */
export function updateLightningFlashOverlay(el, state, opts = {}) {
  if (!el) return;
  const opacity = getLightningFlashOverlayOpacity(state, opts);
  if (opacity <= 0.001) {
    el.style.opacity = "0";
    el.style.visibility = "hidden";
    return;
  }
  el.style.visibility = "visible";
  el.style.opacity = String(opacity);
}
