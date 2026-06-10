import * as THREE from "three";

const HIGHLIGHT_NAME = "oil_barrel_tune_highlight";
const HIGHLIGHT_COLOR = 0xffffff;
const HIGHLIGHT_OPACITY_SINGLE = 0.4;
const HIGHLIGHT_OPACITY_GROUP = 0.2;

/** Barrel shell meshes only — skip fire/video helpers. */
const OUTLINE_MESH = /^oil_barrel_(exterior|cap_top|cap_bottom|shadow_shell)$/;

/** @param {THREE.Object3D} root */
export function disposeBarrelPlacementHighlights(root) {
  root.traverse((obj) => {
    if (obj.name !== HIGHLIGHT_NAME) return;
    obj.parent?.remove(obj);
    obj.traverse((child) => {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        for (const m of child.material) m.dispose();
      } else {
        child.material?.dispose();
      }
    });
  });
}

/** @param {THREE.Group} barrelGroup @param {number} opacity */
function ensureBarrelHighlight(barrelGroup, opacity) {
  if (barrelGroup.getObjectByName(HIGHLIGHT_NAME)) return;

  const highlight = new THREE.Group();
  highlight.name = HIGHLIGHT_NAME;
  highlight.renderOrder = 1200;
  barrelGroup.updateMatrixWorld(true);
  const barrelInv = barrelGroup.matrixWorld.clone().invert();
  const rel = new THREE.Matrix4();

  barrelGroup.traverse((obj) => {
    if (!obj.isMesh || !OUTLINE_MESH.test(obj.name) || !obj.geometry) return;
    obj.updateMatrixWorld(true);
    rel.copy(obj.matrixWorld).premultiply(barrelInv);
    const edges = new THREE.EdgesGeometry(obj.geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: HIGHLIGHT_COLOR,
        transparent: true,
        opacity,
        depthTest: false,
      }),
    );
    line.matrix.copy(rel);
    line.matrixAutoUpdate = false;
    line.renderOrder = 1200;
    highlight.add(line);
  });

  if (highlight.children.length === 0) return;
  barrelGroup.add(highlight);
}

/**
 * @param {THREE.Object3D} root
 * @param {string[]} propIds
 */
export function updateBarrelPlacementHighlights(root, propIds) {
  disposeBarrelPlacementHighlights(root);
  if (!propIds.length) return;
  const opacity =
    propIds.length > 1 ? HIGHLIGHT_OPACITY_GROUP : HIGHLIGHT_OPACITY_SINGLE;
  const wanted = new Set(propIds);
  root.traverse((obj) => {
    if (obj.name !== "oil_barrel" || !obj.isGroup) return;
    const id = obj.userData.oilBarrelPropId ?? obj.userData.pileId;
    if (!id || !wanted.has(id)) return;
    ensureBarrelHighlight(obj, opacity);
  });
}
