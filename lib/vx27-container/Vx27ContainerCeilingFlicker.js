import * as THREE from "three";

const TWO_PI = Math.PI * 2;

function frac01(n) {
  return n - Math.floor(n);
}

/** Deterministic 0..1 from seed + phase — stable but irregular across events. */
function pseudoRand(seed, phase) {
  return frac01(Math.sin(phase * 12.9898 + seed * 78.233) * 43758.5453);
}

function irregularGap(seed, eventIndex, minSec, maxSec) {
  const span = maxSec - minSec;
  const a = pseudoRand(seed, eventIndex * 1.31 + 0.17);
  const b = pseudoRand(seed, eventIndex * 2.73 + 4.9);
  return minSec + (a * 0.62 + b * 0.38) * span;
}

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function faultEnvelope(elapsed, left, fadeInSec, fadeOutSec) {
  const fadeIn = smoothstep(0, fadeInSec, elapsed);
  const fadeOut = smoothstep(0, fadeOutSec, left);
  return Math.min(fadeIn, fadeOut);
}

/** Stepped random voltage — wanders between levels instead of smooth sine waves. */
function steppedNoise(seed, t, rate) {
  const phase = t * rate;
  const i0 = Math.floor(phase);
  const i1 = i0 + 1;
  const f = phase - i0;
  const a = pseudoRand(seed, i0);
  const b = pseudoRand(seed, i1);
  return THREE.MathUtils.lerp(a, b, smoothstep(0, 1, f));
}

/**
 * @param {string | null | undefined} propId
 * @returns {number}
 */
export function vx27CeilingFlickerSeedFromPropId(propId) {
  if (!propId) return Math.random() * TWO_PI * 40;
  let h = 2166136261;
  for (let i = 0; i < propId.length; i += 1) {
    h ^= propId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967296) * TWO_PI * 40;
}

/**
 * @param {THREE.PointLight} light
 * @param {{
 *   seed?: number,
 *   timeOffset?: number,
 * }} [opts]
 */
export function initVx27IndustrialCeilingFlicker(light, opts = {}) {
  const seed = opts.seed ?? 0;
  const timeOffset = opts.timeOffset ?? pseudoRand(seed, 11) * 48;

  light.userData.vx27IndustrialFlicker = {
    seed,
    timeOffset,
    baseIntensity: light.intensity,
    baseColor: light.color.clone(),
    flareColor: new THREE.Color(0xb8e8ff),
    dimColor: new THREE.Color(0x3a5a88),
    voltagePhase: pseudoRand(seed, 23) * TWO_PI,
    brownoutUntil: -1,
    brownoutStart: -1,
    brownoutDepth: 0,
    blinkUntil: -1,
    blinkStart: -1,
    blinkFloor: 1,
    sagUntil: -1,
    sagStart: -1,
    sagFloor: 1,
    microDimUntil: -1,
    microDimStart: -1,
    microDimFloor: 1,
    flareUntil: -1,
    brownoutCount: 0,
    blinkCount: 0,
    sagCount: 0,
    microDimCount: 0,
    flareCount: 0,
    nextBrownoutAt: irregularGap(seed, 0, 1.8, 6),
    nextBlinkAt: irregularGap(seed, 1, 4, 12),
    nextSagAt: irregularGap(seed, 2, 0.8, 3.5),
    nextMicroDimAt: irregularGap(seed, 3, 0.5, 2.8),
    nextFlareAt: irregularGap(seed, 4, 3.5, 12),
  };
}

/**
 * @param {THREE.Light[]} lights
 * @param {number} time
 */
export function updateVx27IndustrialCeilingFlicker(lights, time) {
  for (const light of lights) {
    const d = light?.userData?.vx27IndustrialFlicker;
    if (!d || !light.visible) continue;

    const t = time + d.timeOffset;

    // Unstable supply — random voltage steps, never settles on one level.
    const coarse = steppedNoise(d.seed, t, 0.38);
    const mid = steppedNoise(d.seed + 17.3, t, 0.95);
    const fine = steppedNoise(d.seed + 41.9, t, 2.1);
    let factor =
      0.66 +
      coarse * 0.18 +
      mid * 0.1 +
      fine * 0.05 +
      0.04 * Math.sin(t * 0.17 + d.voltagePhase);

    // Random sag — medium dips that drift in and out unpredictably.
    if (t >= d.nextSagAt && d.sagUntil < 0) {
      const roll = pseudoRand(d.seed, d.sagCount * 2.47);
      if (roll > 0.12) {
        d.sagStart = t;
        d.sagUntil =
          t + 0.22 + pseudoRand(d.seed, d.sagCount + 0.2) * 0.85;
        d.sagFloor = 0.48 + pseudoRand(d.seed, d.sagCount + 0.7) * 0.3;
        d.sagCount += 1;
        d.nextSagAt =
          t + irregularGap(d.seed, d.sagCount + 21, 0.7, 4.2);
      } else {
        d.sagCount += 1;
        d.nextSagAt = t + irregularGap(d.seed, d.sagCount + 25, 0.4, 2);
      }
    }
    if (t < d.sagUntil) {
      const left = d.sagUntil - t;
      const elapsed = t - d.sagStart;
      const env = faultEnvelope(elapsed, left, 0.16, 0.24);
      factor *= THREE.MathUtils.lerp(1, d.sagFloor, env);
    } else if (d.sagUntil > 0 && t >= d.sagUntil) {
      d.sagUntil = -1;
      d.sagStart = -1;
    }

    // Micro dim — short unplanned dips on top of everything else.
    if (t >= d.nextMicroDimAt && d.microDimUntil < 0) {
      const roll = pseudoRand(d.seed, d.microDimCount * 4.63);
      if (roll > 0.1) {
        d.microDimStart = t;
        d.microDimUntil =
          t + 0.12 + pseudoRand(d.seed, d.microDimCount + 0.5) * 0.38;
        d.microDimFloor = 0.55 + pseudoRand(d.seed, d.microDimCount + 1.1) * 0.28;
        d.microDimCount += 1;
        d.nextMicroDimAt =
          t + irregularGap(d.seed, d.microDimCount + 33, 0.45, 3);
      } else {
        d.microDimCount += 1;
        d.nextMicroDimAt =
          t + irregularGap(d.seed, d.microDimCount + 37, 0.3, 1.6);
      }
    }
    if (t < d.microDimUntil) {
      const left = d.microDimUntil - t;
      const elapsed = t - d.microDimStart;
      const env = faultEnvelope(elapsed, left, 0.08, 0.1);
      factor *= THREE.MathUtils.lerp(1, d.microDimFloor, env);
    } else if (d.microDimUntil > 0 && t >= d.microDimUntil) {
      d.microDimUntil = -1;
      d.microDimStart = -1;
    }

    // Hard off/on flash — loose connection, spaced out and eased at the edges.
    if (t >= d.nextBlinkAt && d.blinkUntil < 0) {
      const roll = pseudoRand(d.seed, d.blinkCount * 3.11);
      if (roll > 0.28) {
        const dur = 0.08 + pseudoRand(d.seed, d.blinkCount + 0.4) * 0.16;
        d.blinkStart = t;
        d.blinkUntil = t + dur;
        d.blinkFloor = 0.02 + pseudoRand(d.seed, d.blinkCount + 0.9) * 0.06;
        d.blinkCount += 1;
        d.nextBlinkAt =
          t + irregularGap(d.seed, d.blinkCount + 7, 4.5, 14);
        if (pseudoRand(d.seed, d.blinkCount + 1.6) > 0.78) {
          d.nextBlinkAt =
            t + 0.14 + pseudoRand(d.seed, d.blinkCount + 2.1) * 0.22;
        }
      } else {
        d.blinkCount += 1;
        d.nextBlinkAt = t + irregularGap(d.seed, d.blinkCount + 9, 3, 9);
      }
    }
    if (t < d.blinkUntil) {
      const left = d.blinkUntil - t;
      const elapsed = t - d.blinkStart;
      const duration = d.blinkUntil - d.blinkStart;
      const edge = faultEnvelope(elapsed, left, 0.045, 0.055);
      const mid =
        duration > 0
          ? Math.sin(THREE.MathUtils.clamp(elapsed / duration, 0, 1) * Math.PI)
          : 1;
      const env = Math.max(edge, mid * 0.92);
      factor *= THREE.MathUtils.lerp(1, d.blinkFloor, env);
    } else if (d.blinkUntil > 0 && t >= d.blinkUntil) {
      d.blinkUntil = -1;
      d.blinkStart = -1;
    }

    // Brownout — deeper, more varied sags at uneven intervals.
    if (t >= d.nextBrownoutAt && d.brownoutUntil < 0) {
      const roll = pseudoRand(d.seed, d.brownoutCount * 5.07);
      if (roll > 0.04) {
        d.brownoutStart = t;
        d.brownoutUntil =
          t + 0.32 + pseudoRand(d.seed, d.brownoutCount + 0.3) * 0.95;
        d.brownoutDepth = 0.22 + pseudoRand(d.seed, d.brownoutCount + 1.2) * 0.38;
        d.brownoutCount += 1;
        d.nextBrownoutAt =
          t + irregularGap(d.seed, d.brownoutCount + 3, 1.8, 9);
      } else {
        d.brownoutCount += 1;
        d.nextBrownoutAt =
          t + irregularGap(d.seed, d.brownoutCount + 11, 1, 4.5);
      }
    }
    if (t < d.brownoutUntil) {
      const left = d.brownoutUntil - t;
      const elapsed = t - d.brownoutStart;
      const env = faultEnvelope(elapsed, left, 0.22, 0.38);
      factor *= 1 - d.brownoutDepth * env;
    } else if (d.brownoutUntil > 0 && t >= d.brownoutUntil) {
      d.brownoutUntil = -1;
      d.brownoutStart = -1;
    }

    // Voltage flare — brief spike when supply overcorrects.
    if (t >= d.nextFlareAt && d.flareUntil < 0) {
      const roll = pseudoRand(d.seed, d.flareCount * 7.19);
      if (roll > 0.28) {
        d.flareUntil =
          t + 0.06 + pseudoRand(d.seed, d.flareCount + 0.6) * 0.14;
        d.flareCount += 1;
        d.nextFlareAt =
          t + irregularGap(d.seed, d.flareCount + 13, 4, 16);
      } else {
        d.flareCount += 1;
        d.nextFlareAt =
          t + irregularGap(d.seed, d.flareCount + 17, 2.5, 8);
      }
    }

    let colorMix = 0;
    let dimMix = 0;
    if (t < d.flareUntil) {
      const left = d.flareUntil - t;
      const env = Math.sin(THREE.MathUtils.clamp(left / 0.18, 0, 1) * Math.PI);
      factor *= 1 + env * 0.55;
      colorMix = env * 0.4;
    } else if (d.flareUntil > 0 && t >= d.flareUntil) {
      d.flareUntil = -1;
    }

    if (factor < 0.72) {
      dimMix = (0.72 - factor) / 0.72;
    }

    factor = THREE.MathUtils.clamp(factor, 0.02, 1.65);
    light.intensity = d.baseIntensity * factor;

    light.color.copy(d.baseColor);
    if (colorMix > 0) {
      light.color.lerp(d.flareColor, colorMix);
    } else if (dimMix > 0) {
      light.color.lerp(d.dimColor, dimMix * 0.24);
    }
  }
}
