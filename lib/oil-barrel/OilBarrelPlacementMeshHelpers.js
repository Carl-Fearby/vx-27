import * as THREE from "three";
import {
  createOilBarrel,
  getOilBarrelTuning,
  refreshOilBarrelRenderLayers,
} from "./OilBarrel.js";

export const LAY_ON_SIDE_ROTATION_Z = Math.PI / 2;

const _barrelShellPartBox = new THREE.Box3();
const _barrelShellOutBox = new THREE.Box3();

const BARREL_SHELL_MESH_NAMES = new Set([
  "oil_barrel_exterior",
  "oil_barrel_cap_top",
  "oil_barrel_cap_bottom",
]);

/** @param {number | undefined} rotationZ */
export function resolveLayOnSideRotationZ(rotationZ) {
  if (rotationZ == null || Math.abs(rotationZ) < 0.15) return LAY_ON_SIDE_ROTATION_Z;
  return rotationZ;
}

/** @param {number | undefined} rotationZ */
export function resolveUprightRotationZ(rotationZ) {
  const z = rotationZ ?? 0;
  if (Math.abs(Math.abs(z) - LAY_ON_SIDE_ROTATION_Z) < 0.15) return 0;
  return z;
}

/**
 * Bounding box from metal shell only — flame video/lights are excluded so
 * stacking and foot height stay stable on open-fire barrels.
 * @param {THREE.Group} group
 * @param {THREE.Box3} [out]
 */
export function barrelShellBox3(group, out) {
  const target = out ?? _barrelShellOutBox;
  target.makeEmpty();
  group.updateMatrixWorld(true);
  group.traverse((obj) => {
    if (!obj.isMesh || !BARREL_SHELL_MESH_NAMES.has(obj.name)) return;
    _barrelShellPartBox.setFromObject(obj);
    target.union(_barrelShellPartBox);
  });
  if (target.isEmpty()) target.setFromObject(group);
  return target;
}

/** @param {THREE.Group} barrel */
export function readOilBarrelFireState(barrel) {
  const hasTopCap = Boolean(barrel.getObjectByName("oil_barrel_cap_top"));
  const explicit = barrel.userData.oilBarrelInteriorFire;
  const interiorFire =
    explicit === true ||
    (explicit !== false && !hasTopCap && barrel.userData.interiorFire !== false);
  return { interiorFire, topCap: hasTopCap };
}

/** @param {{ topCap?: boolean, interiorFire?: boolean }} [options] */
export function resolveBarrelMeshFireOptions(options = {}) {
  const tuning = getOilBarrelTuning();
  if (options.interiorFire === true) {
    return { interiorFire: true, topCap: false };
  }
  if (options.interiorFire === false) {
    const topCap =
      options.topCap === true || options.topCap === false
        ? options.topCap
        : tuning.topCap !== false;
    return { interiorFire: false, topCap };
  }
  if (options.topCap === true) {
    return { interiorFire: false, topCap: true };
  }
  if (options.topCap === false) {
    return {
      interiorFire: tuning.interiorFire !== false,
      topCap: false,
    };
  }
  const topCap = tuning.topCap !== false;
  if (topCap) {
    return { interiorFire: false, topCap: true };
  }
  return {
    interiorFire: tuning.interiorFire !== false,
    topCap: false,
  };
}

/** @param {THREE.Object3D} node */
function disposeObjectTree(node) {
  node.traverse?.((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      for (const m of child.material) m.dispose();
    } else {
      child.material?.dispose();
    }
  });
}

/**
 * Swap cap / interior / fire meshes without moving the barrel group.
 * Editor-only — uses createOilBarrel so gameplay OilBarrel.js stays unchanged.
 * @param {THREE.Group} barrel
 * @param {{ topCap?: boolean, interiorFire?: boolean }} meshOptions
 */
export function rebuildOilBarrelMesh(barrel, meshOptions = {}) {
  if (!barrel?.isGroup || barrel.name !== "oil_barrel") return barrel;
  const ud = barrel.userData;
  const roomId = ud.roomId ?? null;
  const propId = ud.oilBarrelPropId ?? ud.pileId;
  const fireSeed = ud.fireFlickerSeed;
  const { interiorFire, topCap } = resolveBarrelMeshFireOptions(meshOptions);
  const layOnSide = Math.abs(barrel.rotation.z) > 1.4;

  for (const child of [...barrel.children]) {
    barrel.remove(child);
    disposeObjectTree(child);
  }

  const tempParent = new THREE.Group();
  const fresh = createOilBarrel(tempParent, 0, 0, 0, barrel.rotation.y, {
    topCap,
    interiorFire: layOnSide ? false : interiorFire,
    roomId,
    propId,
    fireFlickerSeed: fireSeed,
    layOnSide,
    rotationX: barrel.rotation.x,
    rotationZ: barrel.rotation.z,
  });
  tempParent.remove(fresh);

  for (const child of [...fresh.children]) {
    fresh.remove(child);
    barrel.add(child);
  }
  disposeObjectTree(fresh);

  ud.oilBarrelInteriorFire = interiorFire;
  ud.oilBarrelTopCap = topCap;
  ud.roomId = roomId;
  if (propId) {
    ud.oilBarrelPropId = propId;
    ud.pileId = propId;
  }
  if (fireSeed != null) ud.fireFlickerSeed = fireSeed;

  refreshOilBarrelRenderLayers(barrel);
  return barrel;
}

/** Hub rotation used for rigid group orbit (radians). */
export function pileHubRotationRad(rotationY = 0) {
  return rotationY ?? 0;
}
