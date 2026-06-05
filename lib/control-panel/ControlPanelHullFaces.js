import * as THREE from "three";
import { setWorldLayer } from "../lighting/LightingLayers.js";
import { resolveControlPanelProfile } from "./ControlPanel.js";
import { applyBackPanelCapUV } from "./ControlPanelHullUV.js";
import {
  applyHullEdgeMeshUV,
  buildControlPanelBackPanelQuad,
  buildControlPanelProfileEdgeQuad,
  cloneProfileEdgeOverlayMaterial,
} from "./ControlPanelProfileEdgeQuad.js";
import { getControlPanelHullBodyMaterial } from "./ControlPanelBody.js";

/**
 * Hull sides — not C/D. Not 0 (rear, separate quad) or 1 (top lip, on end-cap art).
 */
export const CONTROL_PANEL_HULL_EDGE_INDICES = [4, 5, 6, 7, 8, 9];

const MESH_PREFIX = "control_panel_hull_edge_";
const BACK_MESH_NAME = "control_panel_hull_back";

/** @param {THREE.Group} group */
export function removeControlPanelHullFaces(group) {
  const toRemove = group.children.filter(
    (c) =>
      c.name?.startsWith(MESH_PREFIX) || c.name === BACK_MESH_NAME,
  );
  for (const obj of toRemove) {
    group.remove(obj);
    if (obj.isMesh) {
      obj.geometry?.dispose();
      obj.material?.dispose();
    }
  }
}

/** @param {THREE.Group} group */
export function attachControlPanelHullFaces(group) {
  removeControlPanelHullFaces(group);
  const mat = getControlPanelHullBodyMaterial();
  if (!mat) return false;

  const height = group.userData.controlPanelHeight ?? 1.65;
  const depth = group.userData.controlPanelDepth ?? height * 0.62;
  const width = group.userData.controlPanelWidth ?? height * 0.46;
  const profile = resolveControlPanelProfile(group.userData.controlPanelProfile);

  const backGeo = buildControlPanelBackPanelQuad(height, depth, width);
  const backMesh = new THREE.Mesh(backGeo, cloneProfileEdgeOverlayMaterial(mat));
  backMesh.name = BACK_MESH_NAME;
  backMesh.castShadow = false;
  backMesh.receiveShadow = true;
  backMesh.renderOrder = 1;
  setWorldLayer(backMesh);
  group.add(backMesh);
  applyBackPanelCapUV(backMesh, width, height);

  for (const edgeIndex of CONTROL_PANEL_HULL_EDGE_INDICES) {
    const geo = buildControlPanelProfileEdgeQuad(
      profile,
      height,
      depth,
      width,
      edgeIndex,
    );
    const mesh = new THREE.Mesh(geo, cloneProfileEdgeOverlayMaterial(mat));
    mesh.name = `${MESH_PREFIX}${edgeIndex}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    setWorldLayer(mesh);
    group.add(mesh);
    applyHullEdgeMeshUV(mesh, { flipV: false, mirrorU: false });
  }
  return true;
}
