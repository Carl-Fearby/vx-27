import * as THREE from "three";

export const ARENA_CEILING_NIGHT_EMISSIVE = 0;

/** @type {THREE.Mesh[]} */
let _ceilingMeshes = null;

function collectArenaCeilingMeshes(root) {
  if (_ceilingMeshes) return _ceilingMeshes;
  /** @type {THREE.Mesh[]} */
  const meshes = [];
  root.traverse((obj) => {
    if (obj.isMesh && obj.userData.arenaCeiling) meshes.push(obj);
  });
  _ceilingMeshes = meshes;
  return meshes;
}

/** Call when the level group is torn down so the next arena rebuilds the cache. */
export function resetArenaCeilingDayNightCache() {
  _ceilingMeshes = null;
}

/** Dim the arena deck underside emissive boost when the sun is off. */
export function applyArenaCeilingDayNight(root, isDay) {
  applyArenaCeilingNightness(root, isDay ? 0 : 1);
}

/**
 * Continuous version — lerps each affected material's emissive between its
 * captured day value and {@link ARENA_CEILING_NIGHT_EMISSIVE}.
 */
export function applyArenaCeilingNightness(root, nightness) {
  if (!root) return;
  const t = THREE.MathUtils.clamp(nightness, 0, 1);
  for (const obj of collectArenaCeilingMeshes(root)) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat || mat.emissiveIntensity == null) continue;
      if (mat.userData.dayEmissiveIntensity == null) {
        mat.userData.dayEmissiveIntensity = mat.emissiveIntensity;
      }
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.userData.dayEmissiveIntensity,
        ARENA_CEILING_NIGHT_EMISSIVE,
        t
      );
    }
  }
}
