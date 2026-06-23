/** Settings → Development. Skips GLB load and uses procedural rifle dummies. */
export const SIMPLE_ENEMY_MESH_KEY = "fps-simple-enemy-mesh";

let _simpleEnemyMeshes = false;
let _simpleLoaded = false;

function readSimpleFromStorage() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIMPLE_ENEMY_MESH_KEY) === "true";
}

export function loadSimpleEnemyMeshes() {
  _simpleEnemyMeshes = readSimpleFromStorage();
  _simpleLoaded = true;
  return _simpleEnemyMeshes;
}

export function useSimpleEnemyMeshes() {
  if (!_simpleLoaded) loadSimpleEnemyMeshes();
  return _simpleEnemyMeshes;
}

export function setSimpleEnemyMeshesRuntime(enabled) {
  _simpleEnemyMeshes = enabled === true;
  _simpleLoaded = true;
  if (typeof window !== "undefined") {
    localStorage.setItem(SIMPLE_ENEMY_MESH_KEY, String(_simpleEnemyMeshes));
  }
}

/**
 * @param {number} distanceSq
 * @param {"glb" | "procedural" | undefined} current
 * @returns {"glb" | "procedural"}
 */
export function resolveEnemyRigLodMode(_distanceSq, current = "glb") {
  if (useSimpleEnemyMeshes()) return "procedural";
  return "glb";
}
