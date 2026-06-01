import * as THREE from "three";

/**
 * Candle / torch flicker for point lights. Per light we capture the original
 * intensity and colour, then on each `update(time)` we drive a smooth wobble
 * (sum of sines at varied frequencies) plus rare quick dip events that
 * mimic a draft hitting the flame. Colour stays anchored on the base hue —
 * the eye reads the change mostly as brightness, and shifting hue can make
 * the wall textures look wrong.
 */

const TWO_PI = Math.PI * 2;

/**
 * Multi-octave sine "noise" — smooth, deterministic, and cheap. Output is
 * roughly in [-1, 1] but biased a little below zero on average (so a candle
 * is more often dim than full-bright, which feels right).
 */
function candleNoise(t, seed) {
  return (
    0.45 * Math.sin(t * 7.3 + seed) +
    0.3 * Math.sin(t * 13.1 + seed * 1.7) +
    0.18 * Math.sin(t * 23.7 + seed * 2.3) +
    0.1 * Math.sin(t * 41.2 + seed * 3.1)
  );
}

function buildFlickerCfg(opts) {
  return {
    baseFactor: opts.baseFactor ?? 0.88,
    wobbleAmp: opts.wobbleAmp ?? 0.12,
    dipMinGap: opts.dipMinGap ?? 1.4,
    dipMaxGap: opts.dipMaxGap ?? 4.8,
    dipMinStrength: opts.dipMinStrength ?? 0.35,
    dipMaxStrength: opts.dipMaxStrength ?? 0.6,
    dipDuration: opts.dipDuration ?? 0.14,
    positionDriftAmpY: opts.positionDriftAmpY ?? 0,
    positionDriftSpeed: opts.positionDriftSpeed ?? 1.2,
  };
}

function frac01(n) {
  return n - Math.floor(n);
}

/**
 * @param {THREE.Light} light
 * @param {ReturnType<typeof buildFlickerCfg>} cfg
 * @param {number} baseWobbleSpeed
 * @param {{
 *   flickerSeed?: number,
 *   positionSeed?: number,
 *   timeOffset?: number,
 *   wobbleSpeedScale?: number,
 *   positionDriftSpeedScale?: number,
 *   dipStartOffset?: number,
 * }} [overrides]
 */
function attachCandleFlicker(light, cfg, baseWobbleSpeed, overrides = {}) {
  const timeOffset = overrides.timeOffset ?? Math.random() * 24;
  const wobbleSpeed =
    baseWobbleSpeed *
    (overrides.wobbleSpeedScale ?? 0.65 + Math.random() * 0.7);
  const positionDriftSpeed =
    cfg.positionDriftSpeed *
    (overrides.positionDriftSpeedScale ?? 0.7 + Math.random() * 0.6);
  const dipSpan = cfg.dipMaxGap - cfg.dipMinGap;

  light.userData.candleFlicker = {
    cfg,
    wobbleSpeed,
    timeOffset,
    positionDriftSpeed,
    baseIntensity: light.intensity,
    baseColor: light.color.clone(),
    basePosition:
      cfg.positionDriftAmpY > 0 ? light.position.clone() : null,
    seed: overrides.flickerSeed ?? Math.random() * TWO_PI * 50,
    positionSeed: overrides.positionSeed ?? Math.random() * TWO_PI * 50,
    nextDipTime:
      timeOffset +
      cfg.dipMinGap +
      (overrides.dipStartOffset ?? Math.random() * dipSpan),
    dipEndTime: -1,
    dipStrength: 0,
  };
}

export function attachCandleFlickerLight(light, opts = {}, overrides = {}) {
  if (!light) return;
  const cfg = buildFlickerCfg(opts);
  attachCandleFlicker(light, cfg, opts.wobbleSpeed ?? 1, overrides);
}

/**
 * @param {THREE.Light[]} lights
 * @param {{ baseFactor?: number, wobbleAmp?: number, wobbleSpeed?: number, dipMinGap?: number, dipMaxGap?: number, dipMinStrength?: number, dipMaxStrength?: number, dipDuration?: number, positionDriftAmpY?: number, positionDriftSpeed?: number, flickerSeed?: number, positionSeed?: number, timeOffset?: number, wobbleSpeedScale?: number, positionDriftSpeedScale?: number, dipStartOffset?: number }} [opts]
 */
export function initCandleFlicker(lights, opts = {}) {
  const baseWobbleSpeed = opts.wobbleSpeed ?? 1;
  const cfg = buildFlickerCfg(opts);
  const overrides = {
    flickerSeed: opts.flickerSeed,
    positionSeed: opts.positionSeed,
    timeOffset: opts.timeOffset,
    wobbleSpeedScale: opts.wobbleSpeedScale,
    positionDriftSpeedScale: opts.positionDriftSpeedScale,
    dipStartOffset: opts.dipStartOffset,
  };

  for (const light of lights) {
    if (!light || light.userData?.candleFlicker) continue;
    attachCandleFlicker(light, cfg, baseWobbleSpeed, overrides);
  }
}

/**
 * Deterministic flicker personality from a barrel-level seed (L/R differ by side).
 * @param {number} barrelSeed
 * @param {-1 | 0 | 1} [side=0]
 */
export function deriveBarrelFlickerSeeds(barrelSeed, side = 0) {
  const sideSalt = side < 0 ? 0.127 : side > 0 ? 0.891 : 0.512;
  const s = barrelSeed;
  const dipSpan = 0.85 - 0.22;

  return {
    flickerSeed:
      frac01(Math.sin(s * 12.9898 + sideSalt) * 43758.5453) * TWO_PI * 50,
    positionSeed:
      frac01(Math.sin(s * 78.233 + sideSalt * 2.1) * 12345.6789) * TWO_PI * 50,
    timeOffset: frac01(Math.sin(s * 0.0173 + sideSalt) * 9999.13) * 24,
    wobbleSpeedScale:
      0.65 + frac01(Math.sin(s * 4.31 + sideSalt) * 2718.28) * 0.7,
    positionDriftSpeedScale:
      0.7 + frac01(Math.sin(s * 9.17 + sideSalt) * 31415.9) * 0.6,
    dipStartOffset:
      frac01(Math.sin(s * 2.71 + sideSalt) * 1618.03) * dipSpan,
  };
}

/** Slow + fast Y noise so flame height wanders independently of brightness. */
export function candlePositionDriftY(t, seed, amp, speed) {
  const slow = candleNoise(t * speed * 0.38, seed + 11.7);
  const fast = candleNoise(t * speed * 1.25, seed + 23.4) * 0.38;
  return (slow + fast) * amp;
}

/**
 * @param {THREE.Light[]} lights
 * @param {number} time
 */
export function updateCandleFlicker(lights, time) {
  for (const light of lights) {
    const data = light?.userData?.candleFlicker;
    if (!data) continue;
    const cfg = data.cfg;
    const t = time + data.timeOffset;

    const wobble = candleNoise(t * data.wobbleSpeed, data.seed);
    let factor = cfg.baseFactor + wobble * cfg.wobbleAmp;

    if (t > data.nextDipTime) {
      data.dipEndTime = t + cfg.dipDuration;
      data.nextDipTime =
        t +
        cfg.dipMinGap +
        Math.random() * (cfg.dipMaxGap - cfg.dipMinGap);
      data.dipStrength =
        cfg.dipMinStrength +
        Math.random() * (cfg.dipMaxStrength - cfg.dipMinStrength);
    }
    if (t < data.dipEndTime) {
      const phase = (data.dipEndTime - t) / cfg.dipDuration;
      const env = Math.sin(THREE.MathUtils.clamp(phase, 0, 1) * Math.PI);
      factor *= 1 - data.dipStrength * env;
    }

    factor = THREE.MathUtils.clamp(factor, 0.2, 1.05);
    light.intensity = data.baseIntensity * factor;

    if (data.basePosition && cfg.positionDriftAmpY > 0) {
      const yDrift = candlePositionDriftY(
        t,
        data.positionSeed,
        cfg.positionDriftAmpY,
        data.positionDriftSpeed
      );
      light.position.y = data.basePosition.y + yDrift;
    }
  }
}

/**
 * @param {THREE.Light[]} lights
 */
export function resetCandleFlicker(lights) {
  for (const light of lights) {
    const data = light?.userData?.candleFlicker;
    if (!data) continue;
    light.intensity = data.baseIntensity;
    light.color.copy(data.baseColor);
    if (data.basePosition) light.position.copy(data.basePosition);
    delete light.userData.candleFlicker;
  }
}
