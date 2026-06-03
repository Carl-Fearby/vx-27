import * as THREE from "three";
import { setWorldLayer } from "./LightingLayers.js";

let shadowOccluderMaterial = null;

/** Invisible in the color pass; still writes depth into the sun shadow map. */
export function getShadowOccluderMaterial() {
  if (!shadowOccluderMaterial) {
    shadowOccluderMaterial = new THREE.MeshBasicMaterial();
    shadowOccluderMaterial.colorWrite = false;
    // Must not write depth in the main pass — invisible occluders only affect the shadow map.
    shadowOccluderMaterial.depthWrite = false;
  }
  return shadowOccluderMaterial;
}

/** Per-mesh depth material — shared instances pick up alphaMap from unrelated casters. */
function createShadowDepthMaterial() {
  const depthMat = new THREE.MeshDepthMaterial();
  depthMat.depthTest = true;
  depthMat.depthWrite = true;
  return depthMat;
}

function attachShadowMapDepth(mesh) {
  const depthMat = createShadowDepthMaterial();
  mesh.customDepthMaterial = depthMat;
  mesh.userData.shadowDepthMaterial = depthMat;
  // Three.js copies alphaMap/map onto customDepthMaterial each shadow pass — scrub stale refs.
  mesh.onBeforeShadow = () => {
    const dm = mesh.customDepthMaterial;
    if (!dm) return;
    dm.alphaMap = null;
    dm.map = null;
    dm.alphaTest = 0;
    dm.displacementMap = null;
  };
}

/**
 * World-layer box that blocks directional sun shadows only (not lit in room pass).
 * @param {THREE.Group} group
 */
export function addShadowOccluderBox(group, width, height, depth, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    getShadowOccluderMaterial()
  );
  mesh.position.set(x, y, z);
  mesh.userData.isShadowOccluder = true;
  mesh.userData.skipBulletSurface = true;
  mesh.userData.shadowCast = true;
  mesh.userData.shadowReceive = false;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  attachShadowMapDepth(mesh);
  setWorldLayer(mesh);
  group.add(mesh);
  return mesh;
}

/** Thin horizontal slab — blocks sun shadows downward (room ceilings / deck undersides). */
export const HORIZONTAL_SHADOW_BLOCKER_HEIGHT = 0.06;

/** Gap below deck bottom for open-perimeter slabs — keeps their umbra off the walk surface. */
export const OPEN_DECK_UNDERSIDE_SHADOW_GAP = 0.05;

export function addShadowOccluderHorizontalSlab(group, width, depth, x, bottomY, z) {
  const h = HORIZONTAL_SHADOW_BLOCKER_HEIGHT;
  const mesh = addShadowOccluderBox(group, width, h, depth, x, bottomY + h / 2, z);
  mesh.userData.isHorizontalShadowBlocker = true;
  return mesh;
}

/** Open catwalk perimeter — casts deck footprint onto the arena floor below. */
export function addOpenDeckUndersideShadowSlab(
  group,
  width,
  depth,
  x,
  deckBottomY,
  z
) {
  const mesh = addShadowOccluderHorizontalSlab(
    group,
    width,
    depth,
    x,
    deckBottomY - OPEN_DECK_UNDERSIDE_SHADOW_GAP,
    z
  );
  mesh.userData.isOpenDeckUndersideShadow = true;
  return mesh;
}

export function disposeShadowOccluderMaterial() {
  shadowOccluderMaterial?.dispose();
  shadowOccluderMaterial = null;
}
