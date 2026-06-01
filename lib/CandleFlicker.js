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

/**
 * @param {THREE.Light[]} lights
 * @param {{ baseFactor?: number, wobbleAmp?: number, wobbleSpeed?: number, dipMinGap?: number, dipMaxGap?: number, dipMinStrength?: number, dipMaxStrength?: number, dipDuration?: number, positionDriftAmpY?: number, positionDriftSpeed?: number }} [opts]
 */
export function initCandleFlicker(lights, opts = {}) {
  const baseWobbleSpeed = opts.wobbleSpeed ?? 1;

  for (const light of lights) {
    if (!light || light.userData?.candleFlicker) continue;

    const cfg = buildFlickerCfg(opts);
    const timeOffset = Math.random() * 24;
    const wobbleSpeed = baseWobbleSpeed * (0.65 + Math.random() * 0.7);
    const positionDriftSpeed =
      cfg.positionDriftSpeed * (0.7 + Math.random() * 0.6);

    light.userData.candleFlicker = {
      cfg,
      wobbleSpeed,
      timeOffset,
      positionDriftSpeed,
      baseIntensity: light.intensity,
      baseColor: light.color.clone(),
      basePosition:
        cfg.positionDriftAmpY > 0 ? light.position.clone() : null,
      seed: Math.random() * TWO_PI * 50,
      positionSeed: Math.random() * TWO_PI * 50,
      nextDipTime:
        timeOffset +
        cfg.dipMinGap +
        Math.random() * (cfg.dipMaxGap - cfg.dipMinGap),
      dipEndTime: -1,
      dipStrength: 0,
    };
  }
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
