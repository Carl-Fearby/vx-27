import * as THREE from "three";
import { kelvinToRgb } from "./HemisphereTuning.js";

/** Shared with sky dome placement in SceneEnvironment.js */
export const SKY_MESH_RADIUS = 180;

/** Light sits on the inner surface of the sky bowl, like a sun on the dome. */
export const SUN_BOWL_INSET = 20;
export const SUN_BOWL_RADIUS = SKY_MESH_RADIUS - SUN_BOWL_INSET;

// Baked-in defaults (used when no localStorage values exist).
export const SUN_AZIMUTH_DEFAULT = 284;
export const SUN_ELEVATION_DEFAULT = 34;
export const SUN_AZIMUTH_MIN = 0;
export const SUN_AZIMUTH_MAX = 360;
export const SUN_ELEVATION_MIN = 0;
export const SUN_ELEVATION_MAX = 89;

export const SUN_AZIMUTH_STORAGE_KEY = "fps-sun-azimuth";
export const SUN_ELEVATION_STORAGE_KEY = "fps-sun-elevation";
export const SUN_DAY_MODE_STORAGE_KEY = "fps-sun-day";
export const SUN_INTENSITY_STORAGE_KEY = "fps-sun-intensity";
export const SUN_TEMPERATURE_STORAGE_KEY = "fps-sun-temperature";
export const SHELTERED_HEMI_MUL_STORAGE_KEY = "fps-sheltered-hemi-mul";
export const SUN_DAY_DEFAULT = true;

/** Sheltered arena key light — slightly softer than the old 2.85 baked value. */
export const SUN_INTENSITY_SHELTERED_DEFAULT = 2.55;
export const SUN_INTENSITY_OPEN_DEFAULT = 2.35;
export const SUN_INTENSITY_MIN = 1.2;
export const SUN_INTENSITY_MAX = 4;
export const SUN_INTENSITY_STEP = 0.05;

export const SUN_TEMPERATURE_DEFAULT = 5600;
export const SUN_TEMPERATURE_MIN = 3500;
export const SUN_TEMPERATURE_MAX = 9000;
export const SUN_TEMPERATURE_STEP = 100;

/** Extra hemi scale under a roof so shadowed corners stay readable. */
export const SHELTERED_HEMI_MUL_DEFAULT = 0.96;
export const SHELTERED_HEMI_MUL_MIN = 0.4;
export const SHELTERED_HEMI_MUL_MAX = 1.2;
export const SHELTERED_HEMI_MUL_STEP = 0.02;

function readStoredAngle(key, fallback, min, max) {
  if (typeof window === "undefined") return fallback;
  const v = parseFloat(localStorage.getItem(key));
  if (Number.isNaN(v)) return fallback;
  return THREE.MathUtils.clamp(v, min, max);
}

/** @returns {{ azimuth: number, elevation: number }} */
export function loadSunAngles() {
  return {
    azimuth: readStoredAngle(
      SUN_AZIMUTH_STORAGE_KEY,
      SUN_AZIMUTH_DEFAULT,
      SUN_AZIMUTH_MIN,
      SUN_AZIMUTH_MAX
    ),
    elevation: readStoredAngle(
      SUN_ELEVATION_STORAGE_KEY,
      SUN_ELEVATION_DEFAULT,
      SUN_ELEVATION_MIN,
      SUN_ELEVATION_MAX
    ),
  };
}

/** @param {number} azimuth @param {number} elevation */
export function saveSunAngles(azimuth, elevation) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUN_AZIMUTH_STORAGE_KEY, String(azimuth));
  localStorage.setItem(SUN_ELEVATION_STORAGE_KEY, String(elevation));
}

export function loadSunDayMode() {
  if (typeof window === "undefined") return SUN_DAY_DEFAULT;
  const v = localStorage.getItem(SUN_DAY_MODE_STORAGE_KEY);
  if (v === null) return SUN_DAY_DEFAULT;
  return v !== "0" && v !== "false";
}

/** @param {boolean} isDay */
export function saveSunDayMode(isDay) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUN_DAY_MODE_STORAGE_KEY, isDay ? "1" : "0");
}

function readStoredNumber(key, fallback, min, max) {
  if (typeof window === "undefined") return fallback;
  const v = parseFloat(localStorage.getItem(key));
  if (Number.isNaN(v)) return fallback;
  return THREE.MathUtils.clamp(v, min, max);
}

/** @param {boolean} [sheltered] */
export function loadSunIntensity(sheltered = true) {
  const fallback = sheltered
    ? SUN_INTENSITY_SHELTERED_DEFAULT
    : SUN_INTENSITY_OPEN_DEFAULT;
  return readStoredNumber(
    SUN_INTENSITY_STORAGE_KEY,
    fallback,
    SUN_INTENSITY_MIN,
    SUN_INTENSITY_MAX,
  );
}

/** @param {number} intensity */
export function saveSunIntensity(intensity) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    SUN_INTENSITY_STORAGE_KEY,
    String(
      THREE.MathUtils.clamp(intensity, SUN_INTENSITY_MIN, SUN_INTENSITY_MAX),
    ),
  );
}

export function loadSunTemperature() {
  return readStoredNumber(
    SUN_TEMPERATURE_STORAGE_KEY,
    SUN_TEMPERATURE_DEFAULT,
    SUN_TEMPERATURE_MIN,
    SUN_TEMPERATURE_MAX,
  );
}

/** @param {number} temperature */
export function saveSunTemperature(temperature) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    SUN_TEMPERATURE_STORAGE_KEY,
    String(
      THREE.MathUtils.clamp(
        temperature,
        SUN_TEMPERATURE_MIN,
        SUN_TEMPERATURE_MAX,
      ),
    ),
  );
}

export function loadShelteredHemiMul() {
  const value = readStoredNumber(
    SHELTERED_HEMI_MUL_STORAGE_KEY,
    SHELTERED_HEMI_MUL_DEFAULT,
    SHELTERED_HEMI_MUL_MIN,
    SHELTERED_HEMI_MUL_MAX,
  );
  if (value === 0.86 || value === 0.78) {
    const migrated = SHELTERED_HEMI_MUL_DEFAULT;
    saveShelteredHemiMul(migrated);
    return migrated;
  }
  return value;
}

/** @param {number} multiplier */
export function saveShelteredHemiMul(multiplier) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    SHELTERED_HEMI_MUL_STORAGE_KEY,
    String(
      THREE.MathUtils.clamp(
        multiplier,
        SHELTERED_HEMI_MUL_MIN,
        SHELTERED_HEMI_MUL_MAX,
      ),
    ),
  );
}

/** @param {THREE.DirectionalLight} light @param {number} temperatureKelvin */
export function applySunLightColor(light, temperatureKelvin) {
  if (!light?.isDirectionalLight) return;
  const rgb = kelvinToRgb(temperatureKelvin);
  light.color.setRGB(rgb.r, rgb.g, rgb.b);
}

/**
 * @param {THREE.DirectionalLight} light
 * @param {{ intensity?: number, temperature?: number }} [settings]
 */
export function applySunLightSettings(light, settings = {}) {
  if (!light?.isDirectionalLight) return;
  if (typeof settings.temperature === "number") {
    applySunLightColor(light, settings.temperature);
  }
  if (typeof settings.intensity === "number") {
    light.intensity = settings.intensity;
  }
}

/**
 * Spherical coords on the sky bowl: azimuth 0–360° around Y, elevation 0° = horizon ring.
 * @param {number} azimuthDeg
 * @param {number} elevationDeg
 * @returns {{ x: number, y: number, z: number }}
 */
export function sunPositionFromAngles(azimuthDeg, elevationDeg) {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(elevationDeg, SUN_ELEVATION_MIN, SUN_ELEVATION_MAX)
  );
  const r = SUN_BOWL_RADIUS;
  return {
    x: r * Math.cos(el) * Math.sin(az),
    y: r * Math.sin(el),
    z: r * Math.cos(el) * Math.cos(az),
  };
}

/** @returns {{ azimuth: number, elevation: number }} */
export function createDefaultSunAngles() {
  return {
    azimuth: SUN_AZIMUTH_DEFAULT,
    elevation: SUN_ELEVATION_DEFAULT,
  };
}

/** @returns {{ x: number, y: number, z: number }} */
export function createDefaultSunPosition() {
  return sunPositionFromAngles(SUN_AZIMUTH_DEFAULT, SUN_ELEVATION_DEFAULT);
}

/** Elevation driven by day/night fade (same curve as FpsGame applyDayNight). */
export function sunElevationForNightness(elevationDeg, nightness) {
  return THREE.MathUtils.lerp(
    elevationDeg,
    -elevationDeg,
    THREE.MathUtils.clamp(nightness, 0, 1)
  );
}

/** @param {{ azimuth: number, elevation: number }} angles @param {number} nightness */
export function sunPositionForNightness(angles, nightness) {
  return sunPositionFromAngles(
    angles.azimuth,
    sunElevationForNightness(angles.elevation, nightness)
  );
}

/** @param {THREE.DirectionalLight} light @param {{ x: number, y: number, z: number }} pos */
export function applySunLightPosition(light, pos) {
  light.position.set(pos.x, pos.y, pos.z);
  light.updateMatrixWorld(true);
}

/** @param {THREE.DirectionalLight} light @param {number} azimuthDeg @param {number} elevationDeg */
export function applySunLightAngles(light, azimuthDeg, elevationDeg) {
  applySunLightPosition(light, sunPositionFromAngles(azimuthDeg, elevationDeg));
}
