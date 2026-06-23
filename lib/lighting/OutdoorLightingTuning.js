import * as THREE from "three";
import {
  applyHemisphereSettings,
  DEFAULT_HEMI_DAY,
  loadHemiDay,
  loadHemiNight,
  saveHemiDay,
} from "./HemisphereTuning.js";
import {
  applySunLightSettings,
  loadShelteredHemiMul,
  loadSunIntensity,
  loadSunTemperature,
  saveShelteredHemiMul,
  saveSunIntensity,
  saveSunTemperature,
  SHELTERED_HEMI_MUL_DEFAULT,
  SUN_INTENSITY_SHELTERED_DEFAULT,
  SUN_TEMPERATURE_DEFAULT,
} from "./SunLightTuning.js";

/** @typedef {{
 *   sunIntensity: number,
 *   sunTemperature: number,
 *   shelteredHemiMul: number,
 *   hemiDay: { temperature: number, intensity: number },
 * }} OutdoorLightingTuning */

export const DEFAULT_OUTDOOR_LIGHTING = Object.freeze({
  sunIntensity: SUN_INTENSITY_SHELTERED_DEFAULT,
  sunTemperature: SUN_TEMPERATURE_DEFAULT,
  shelteredHemiMul: SHELTERED_HEMI_MUL_DEFAULT,
  hemiDay: { ...DEFAULT_HEMI_DAY },
});

/** Apply stored / baked day lighting to live sun + hemisphere refs. */
export function applyOutdoorLightingLive({
  sun,
  hemi,
  sheltered,
  hemiDay,
  hemiNight,
  shelteredHemiMul,
  nightness = 0,
}) {
  const tuning = loadOutdoorLightingTuning();
  if (sun) {
    applySunLightSettings(sun, {
      temperature: tuning.sunTemperature,
    });
  }
  if (hemi) {
    const dayHemi = hemiDay ?? tuning.hemiDay;
    const night = hemiNight ?? loadHemiNight();
    const hemiMul = sheltered ? (shelteredHemiMul ?? tuning.shelteredHemiMul) : 1;
    applyHemisphereSettings(
      hemi,
      {
        temperature: THREE.MathUtils.lerp(
          dayHemi.temperature,
          night.temperature,
          nightness,
        ),
        intensity: THREE.MathUtils.lerp(
          dayHemi.intensity,
          night.intensity,
          nightness,
        ) * hemiMul,
      },
      { sheltered },
    );
  }
  return tuning;
}

export function loadOutdoorLightingTuning() {
  return {
    sunIntensity: loadSunIntensity(true),
    sunTemperature: loadSunTemperature(),
    shelteredHemiMul: loadShelteredHemiMul(),
    hemiDay: loadHemiDay(),
  };
}

/** @param {Partial<OutdoorLightingTuning>} patch */
export function saveOutdoorLightingTuning(patch) {
  if (typeof patch.sunIntensity === "number") {
    saveSunIntensity(patch.sunIntensity);
  }
  if (typeof patch.sunTemperature === "number") {
    saveSunTemperature(patch.sunTemperature);
  }
  if (typeof patch.shelteredHemiMul === "number") {
    saveShelteredHemiMul(patch.shelteredHemiMul);
  }
  if (patch.hemiDay) {
    saveHemiDay(patch.hemiDay);
  }
  return loadOutdoorLightingTuning();
}

/** @param {OutdoorLightingTuning} tuning */
export function formatOutdoorLightingForCopy(tuning = loadOutdoorLightingTuning()) {
  return JSON.stringify(tuning, null, 2);
}
