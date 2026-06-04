import * as THREE from "three";
import { setWorldLayer } from "../lighting/LightingLayers.js";
import {
  attachControlPanelScreenC,
  isControlPanelScreenCTexturesReady,
  removeControlPanelScreenC,
  updateControlPanelScreenBrightness,
  updateControlPanelScreenUVRotation,
} from "./ControlPanelScreenC.js";
import {
  attachControlPanelShelfD,
  isControlPanelShelfDTexturesReady,
  removeControlPanelShelfD,
  updateControlPanelShelfDBrightness,
  updateControlPanelShelfDUVRotation,
} from "./ControlPanelScreenD.js";
import { loadControlPanelShelfDBrightness } from "./ControlPanelShelfDTuning.js";
import { removeControlPanelSurfaceLabels } from "./ControlPanelSurfaceLabels.js";
import {
  loadControlPanelScreenBrightness,
  loadControlPanelScreenRotU,
  loadControlPanelScreenRotV,
} from "./ControlPanelScreenCTuning.js";
import {
  getControlPanelHullMaterials,
  isControlPanelBodyTexturesReady,
} from "./ControlPanelBody.js";
import {
  attachControlPanelHullFaces,
  removeControlPanelHullFaces,
} from "./ControlPanelHullFaces.js";
import { applyControlPanelCapUVs } from "./ControlPanelHullUV.js";
/** Standing player eye height — default console height matches this. */
export const CONTROL_PANEL_HEIGHT_DEFAULT = 1.65;

/** Profile depth (front–back) as a fraction of height. */
export const CONTROL_PANEL_DEPTH_RATIO = 0.62;

/** Extrusion width (left–right) as a fraction of height. */
export const CONTROL_PANEL_WIDTH_RATIO = 0.46;

/** Default world-metre tile size for UV layout (textures can override repeat). */
export const CONTROL_PANEL_UV_TILE = 0.5;

/** Side-profile corner fillet (metres). */
export const CONTROL_PANEL_PROFILE_CORNER_RADIUS_M = 0.04;

/**
 * Side-profile silhouette in normalised coordinates.
 * x: 0 = front (shelf nose), 1 = flat back.
 * y: 0 = floor, 1 = top.
 * Clockwise from bottom-back — traced from reference side silhouette.
 * @typedef {[number, number]} ControlPanelProfilePoint
 */

/** @type {readonly ControlPanelProfilePoint[]} — baked profile (+ front step between 8→9). */
export const CONTROL_PANEL_PROFILE = Object.freeze([
  [1.0, 0.0],
  [1.0, 1.0],
  [0.73, 1.0],
  [0.43, 0.68],
  [0.0, 0.65],
  [0.06, 0.56],
  [0.385, 0.49],
  [0.77, 0.12],
  [0.03, 0.04],
  [0.0, 0.0],
]);

/** @param {ControlPanelProfilePoint[]} profile */
export function cloneControlPanelProfile(profile) {
  return profile.map(([x, y]) => [x, y]);
}

/** @param {unknown} raw @returns {ControlPanelProfilePoint[] | null} */
export function parseControlPanelProfile(raw) {
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const out = [];
  for (const pt of raw) {
    if (!Array.isArray(pt) || pt.length < 2) return null;
    const x = Number(pt[0]);
    const y = Number(pt[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    out.push([
      Math.min(1, Math.max(0, x)),
      Math.min(1, Math.max(0, y)),
    ]);
  }
  return out;
}

/** @param {ControlPanelProfilePoint[] | null | undefined} profile */
export function resolveControlPanelProfile(profile) {
  const parsed = parseControlPanelProfile(profile);
  return parsed ?? cloneControlPanelProfile(CONTROL_PANEL_PROFILE);
}

/**
 * @param {[number, number]} pPrev
 * @param {[number, number]} pCurr
 * @param {[number, number]} pNext
 * @param {number} maxR
 */
export function profileCornerFilletRadius(pPrev, pCurr, pNext, maxR) {
  const ax = pCurr[0] - pPrev[0];
  const ay = pCurr[1] - pPrev[1];
  const bx = pNext[0] - pCurr[0];
  const by = pNext[1] - pCurr[1];
  const lenA = Math.hypot(ax, ay);
  const lenB = Math.hypot(bx, by);
  if (lenA < 1e-6 || lenB < 1e-6) return 0;
  return Math.min(maxR, lenA * 0.48, lenB * 0.48);
}

/**
 * World-space endpoints for a profile edge, inset by corner fillets (matches extrude path).
 * @param {ControlPanelProfilePoint[]} profile
 * @param {number} height
 * @param {number} depth
 * @param {number} edgeIndex
 * @param {number} [cornerRadiusM]
 */
export function getProfileEdgeTrimmedWorldPoints(
  profile,
  height,
  depth,
  edgeIndex,
  cornerRadiusM = CONTROL_PANEL_PROFILE_CORNER_RADIUS_M,
) {
  const n = profile.length;
  const i0 = edgeIndex % n;
  const i1 = (edgeIndex + 1) % n;
  const pts = profile.map(([x, y]) => [x * depth - depth * 0.5, y * height]);
  const p0 = pts[i0];
  const p1 = pts[i1];
  const pPrev = pts[(i0 - 1 + n) % n];
  const pNext = pts[(i1 + 1) % n];
  const r0 = profileCornerFilletRadius(pPrev, p0, p1, cornerRadiusM);
  const r1 = profileCornerFilletRadius(p0, p1, pNext, cornerRadiusM);
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x0: p0[0] + ux * r0,
    y0: p0[1] + uy * r0,
    x1: p1[0] - ux * r1,
    y1: p1[1] - uy * r1,
  };
}

/**
 * @param {number} height
 * @param {number} depth
 * @param {ControlPanelProfilePoint[]} profile
 * @param {number} [cornerRadiusM]
 */
export function buildControlPanelProfileShape(
  height,
  depth,
  profile,
  cornerRadiusM = CONTROL_PANEL_PROFILE_CORNER_RADIUS_M,
) {
  const shape = new THREE.Shape();
  const n = profile.length;
  const pts = profile.map(([x, y]) => [x * depth, y * height]);

  for (let i = 0; i < n; i += 1) {
    const pPrev = pts[(i - 1 + n) % n];
    const pCurr = pts[i];
    const pNext = pts[(i + 1) % n];
    const r = profileCornerFilletRadius(
      pPrev,
      pCurr,
      pNext,
      cornerRadiusM,
    );
    let start = pCurr;
    let end = pCurr;
    if (r > 1e-5) {
      const lenA = Math.hypot(pCurr[0] - pPrev[0], pCurr[1] - pPrev[1]);
      const lenB = Math.hypot(pNext[0] - pCurr[0], pNext[1] - pCurr[1]);
      start = [
        pCurr[0] - ((pCurr[0] - pPrev[0]) / lenA) * r,
        pCurr[1] - ((pCurr[1] - pPrev[1]) / lenA) * r,
      ];
      end = [
        pCurr[0] + ((pNext[0] - pCurr[0]) / lenB) * r,
        pCurr[1] + ((pNext[1] - pCurr[1]) / lenB) * r,
      ];
    }
    if (i === 0) shape.moveTo(start[0], start[1]);
    else shape.lineTo(start[0], start[1]);
    if (r > 1e-5) {
      shape.quadraticCurveTo(pCurr[0], pCurr[1], end[0], end[1]);
    } else {
      shape.lineTo(end[0], end[1]);
    }
  }
  shape.closePath();
  return shape;
}

/**
 * World-metre UVs on extruded mesh — u/v from local position for later tiling.
 * @param {THREE.BufferGeometry} geometry
 * @param {number} height
 * @param {number} width
 * @param {number} depth
 * @param {number} [tileSize]
 */
export function applyControlPanelWorldUVs(
  geometry,
  height,
  width,
  depth,
  tileSize = CONTROL_PANEL_UV_TILE,
) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!pos || !uv) return;

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    uv.setXY(i, (x + z) / tileSize, y / tileSize);
  }
  uv.needsUpdate = true;
}

/**
 * @param {number} [height]
 * @param {number} [depth]
 * @param {number} [width]
 * @param {ControlPanelProfilePoint[] | null} [profile]
 */
export function buildControlPanelGeometry(
  height = CONTROL_PANEL_HEIGHT_DEFAULT,
  depth = height * CONTROL_PANEL_DEPTH_RATIO,
  width = height * CONTROL_PANEL_WIDTH_RATIO,
  profile = null,
) {
  const pts = resolveControlPanelProfile(profile);
  const shape = buildControlPanelProfileShape(height, depth, pts);
  const bevel = Math.min(width, height, depth) * 0.015;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: bevel > 0.002,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 6,
  });
  // Centre width on Z; shift depth so the group origin sits on the footprint centre.
  geo.translate(-depth * 0.5, 0, -width * 0.5);
  applyControlPanelCapUVs(geo, height, depth, width);
  geo.computeVertexNormals();
  return geo;
}

/** @returns {{ height: number, depth: number, width: number }} */
export function resolveControlPanelDimensions(options = {}) {
  const height = options.height ?? CONTROL_PANEL_HEIGHT_DEFAULT;
  const depth = options.depth ?? height * CONTROL_PANEL_DEPTH_RATIO;
  const width =
    options.width ??
    options.panelWidth ??
    height * CONTROL_PANEL_WIDTH_RATIO;
  return { height, depth, width };
}

let _bodyMaterial = null;
let _capMaterial = null;

function getControlPanelMaterials() {
  if (isControlPanelBodyTexturesReady()) {
    return getControlPanelHullMaterials();
  }
  if (!_bodyMaterial) {
    _bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x5c6470,
      roughness: 0.58,
      metalness: 0.42,
    });
    _bodyMaterial.name = "control_panel_body";
  }
  if (!_capMaterial) {
    _capMaterial = _bodyMaterial.clone();
    _capMaterial.name = "control_panel_endcap";
  }
  return [_capMaterial, _bodyMaterial];
}

/** @param {THREE.Group} group */
function finishControlPanelGroup(group) {
  const mesh = group.children.find((c) => c.name === "control_panel_mesh");
  if (mesh?.isMesh) {
    mesh.material = getControlPanelMaterials();
  }
  if (isControlPanelScreenCTexturesReady()) {
    attachControlPanelScreenC(group);
  } else {
    removeControlPanelScreenC(group);
  }
  if (isControlPanelShelfDTexturesReady()) {
    attachControlPanelShelfD(group);
  } else {
    removeControlPanelShelfD(group);
  }
  if (isControlPanelBodyTexturesReady()) {
    attachControlPanelHullFaces(group);
  } else {
    removeControlPanelHullFaces(group);
  }
  removeControlPanelSurfaceLabels(group);
}

/**
 * @param {THREE.Object3D} parent
 * @param {number} x
 * @param {number} z
 * @param {number} [floorY=0]
 * @param {number} [rotationY=0]
 * @param {{
 *   height?: number,
 *   depth?: number,
 *   width?: number,
 *   propDef?: import("../level/loadArena.js").ArenaProp,
 * }} [options]
 */
export function createControlPanel(
  parent,
  x,
  z,
  floorY = 0,
  rotationY = 0,
  options = {},
) {
  const { height, depth, width } = resolveControlPanelDimensions(options);
  const profile = resolveControlPanelProfile(
    options.profile ?? options.propDef?.sideProfile,
  );
  const group = new THREE.Group();
  group.name = "control_panel";
  group.userData.controlPanel = true;
  group.userData.bulletSurfaceKind = "metal";
  group.userData.controlPanelHeight = height;
  group.userData.controlPanelDepth = depth;
  group.userData.controlPanelWidth = width;
  group.userData.controlPanelProfile = profile;

  const geo = buildControlPanelGeometry(height, depth, width, profile);
  const mesh = new THREE.Mesh(geo, getControlPanelMaterials());
  mesh.name = "control_panel_mesh";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  setWorldLayer(mesh);
  group.add(mesh);
  finishControlPanelGroup(group);

  if (options.propDef) {
    group.userData.controlPanelPropDef = { ...options.propDef };
    group.userData.controlPanelPropId = options.propDef.id ?? null;
    group.userData.roomId = options.propDef.roomId ?? null;
  }

  group.position.set(x, floorY, z);
  group.rotation.y = rotationY;
  parent.add(group);
  return group;
}

/** @param {import("../level/loadArena.js").ArenaProp} propDef @param {number} floorY */
export function controlPanelCollider(propDef, floorY = 0) {
  const y = propDef.y ?? propDef.floorY ?? floorY;
  const { height, depth, width } = resolveControlPanelDimensions(propDef);
  return {
    x: propDef.x,
    z: propDef.z,
    // Mesh local X = profile depth (front–back), local Z = extrusion width (left–right).
    halfX: depth * 0.5,
    halfZ: width * 0.5,
    rotationY: propDef.rotationY ?? 0,
    bottomY: y,
    topY: y + height,
    kind: "controlPanel",
    cornerRadius: 0,
  };
}

/** Credits / preview — safe to dispose. */
export function createControlPanelPreviewMesh(options = {}) {
  const { height, depth, width } = resolveControlPanelDimensions(options);
  const group = new THREE.Group();
  const geo = buildControlPanelGeometry(height, depth, width);
  const mesh = new THREE.Mesh(geo, getControlPanelMaterials());
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

/**
 * Replace mesh geometry after profile edits (placement wizard / profile tune).
 * @param {THREE.Group} group
 * @param {ControlPanelProfilePoint[]} [profile]
 */
export function rebuildControlPanelMesh(group, profile) {
  const mesh = group.children.find((c) => c.name === "control_panel_mesh");
  if (!mesh?.isMesh) return;
  const height = group.userData.controlPanelHeight ?? CONTROL_PANEL_HEIGHT_DEFAULT;
  const depth =
    group.userData.controlPanelDepth ?? height * CONTROL_PANEL_DEPTH_RATIO;
  const width =
    group.userData.controlPanelWidth ?? height * CONTROL_PANEL_WIDTH_RATIO;
  const pts = resolveControlPanelProfile(profile ?? group.userData.controlPanelProfile);
  group.userData.controlPanelProfile = pts;
  mesh.geometry?.dispose();
  mesh.geometry = buildControlPanelGeometry(height, depth, width, pts);
  finishControlPanelGroup(group);
}

/**
 * After async texture preload — patch hull face C and refresh material array.
 * @param {THREE.Group[]} groups
 */
export function syncControlPanelScreenMaterials(groups) {
  for (const group of groups) {
    finishControlPanelGroup(group);
  }
  updateControlPanelScreenBrightness(loadControlPanelScreenBrightness());
  updateControlPanelShelfDBrightness(loadControlPanelShelfDBrightness());
  const rotU = loadControlPanelScreenRotU();
  const rotV = loadControlPanelScreenRotV();
  updateControlPanelScreenUVRotation(rotU, rotV, groups);
  updateControlPanelShelfDUVRotation(rotU, rotV, groups);
}

/** @param {THREE.Object3D | null | undefined} group */
export function disposeControlPanelPreviewMesh(group) {
  if (!group) return;
  group.parent?.remove(group);
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry?.dispose();
  });
}
