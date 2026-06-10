import * as THREE from "three";
import {
  getGroupMemberIds,
  isBarrelPlacementGroupTarget,
  resolveBarrelGroupForPropId,
} from "./OilBarrelPlacementTuning.js";

/** Max distance from camera to barrel pick (m). */
export const OIL_BARREL_PLACEMENT_PICK_MAX_DIST = 10;

/** @param {HTMLCanvasElement} canvas @param {number} clientX @param {number} clientY */
export function ndcFromCanvasPointer(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

/**
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Camera} camera
 * @param {{ x: number, y: number }} ndc
 * @param {THREE.Mesh[]} barrelMeshes
 * @param {number} [maxDist]
 * @returns {string | null}
 */
export function pickOilBarrelPropAtNdc(
  raycaster,
  camera,
  ndc,
  barrelMeshes,
  maxDist = OIL_BARREL_PLACEMENT_PICK_MAX_DIST,
) {
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  return pickOilBarrelPropUnderCrosshair(raycaster, barrelMeshes, maxDist);
}

/** @param {THREE.Object3D} root @returns {THREE.Mesh[]} */
export function collectOilBarrelPickMeshes(root) {
  /** @type {THREE.Mesh[]} */
  const meshes = [];
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    if (!obj.name.startsWith("oil_barrel")) return;
    meshes.push(obj);
  });
  return meshes;
}

/** @param {THREE.Object3D | null | undefined} obj @returns {string | null} */
export function findOilBarrelPropId(obj) {
  let p = obj;
  while (p) {
    if (p.name === "oil_barrel" && p.isGroup) {
      return p.userData.oilBarrelPropId ?? p.userData.pileId ?? null;
    }
    p = p.parent;
  }
  return null;
}

/**
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Mesh[]} barrelMeshes
 * @param {number} [maxDist]
 * @returns {string | null}
 */
export function pickOilBarrelPropUnderCrosshair(
  raycaster,
  barrelMeshes,
  maxDist = OIL_BARREL_PLACEMENT_PICK_MAX_DIST,
) {
  const hits = raycaster.intersectObjects(barrelMeshes, false);
  for (const hit of hits) {
    if (hit.distance > maxDist) continue;
    const propId = findOilBarrelPropId(hit.object);
    if (propId) return propId;
  }
  return null;
}

/**
 * First click selects the barrel; second click on the same barrel selects its pile group.
 * @param {import("./OilBarrelPlacementTuning.js").OilBarrelPlacementState} state
 * @param {string} propId
 * @param {string | null} lastPickedPropId
 */
export function applyBarrelPlacementPick(state, propId, lastPickedPropId) {
  const group = resolveBarrelGroupForPropId(propId, state);
  if (
    lastPickedPropId === propId &&
    state.target === propId &&
    group
  ) {
    return { ...state, target: group };
  }
  return { ...state, target: propId };
}

/** @param {import("./OilBarrelPlacementTuning.js").OilBarrelPlacementState} state @returns {string[]} */
export function getBarrelPlacementHighlightIds(state) {
  if (isBarrelPlacementGroupTarget(state.target)) {
    return getGroupMemberIds(state.target, state);
  }
  return [state.target];
}
