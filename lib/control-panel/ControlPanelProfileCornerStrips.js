import * as THREE from "three";
import { setWorldLayer } from "../lighting/LightingLayers.js";
import {
  getProfileCornerFilletArcWorld,
  getProfileEdgeTrimmedWorldPoints,
  resolveControlPanelProfile,
} from "./ControlPanel.js";
import { getControlPanelHullBodyMaterial } from "./ControlPanelBody.js";
import { CONTROL_PANEL_SCREEN_C_EDGE_INDEX } from "./ControlPanelScreenC.js";
import { CONTROL_PANEL_SHELF_D_EDGE_INDEX } from "./ControlPanelScreenD.js";
import {
  CONTROL_PANEL_SCREEN_MIRROR_U,
  transformControlPanelScreenUV,
} from "./ControlPanelScreenCTuning.js";
import { getControlPanelScreenCMaterial } from "./ControlPanelScreenC.js";
import { getControlPanelShelfDMaterial } from "./ControlPanelScreenD.js";
import {
  loadControlPanelScreenRotU,
  loadControlPanelScreenRotV,
} from "./ControlPanelScreenCTuning.js";
import { PROFILE_EDGE_FACE_OFFSET } from "./ControlPanelProfileEdgeQuad.js";

export const MESH_PREFIX = "control_panel_corner_";
const CORNER_ARC_SEGMENTS = 8;

/** @param {{ x: number, y: number }} pPrev @param {{ x: number, y: number }} pCurr @param {{ x: number, y: number }} pNext @param {number} mag */
function cornerOutwardOffset(pPrev, pCurr, pNext, mag) {
  const ax = pCurr.x - pPrev.x;
  const ay = pCurr.y - pPrev.y;
  const bx = pNext.x - pCurr.x;
  const by = pNext.y - pCurr.y;
  const ox = ay + by;
  const oy = -ax - bx;
  const len = Math.hypot(ox, oy) || 1;
  return { ox: (ox / len) * mag, oy: (oy / len) * mag };
}

/**
 * @param {{ x: number, y: number }[]} arc
 * @param {{ x: number, y: number }} pPrev
 * @param {{ x: number, y: number }} pCurr
 * @param {{ x: number, y: number }} pNext
 * @param {number} z0
 * @param {number} z1
 * @param {number} faceOffset
 */
function buildCornerFilletStripGeometry(
  arc,
  pPrev,
  pCurr,
  pNext,
  z0,
  z1,
  faceOffset,
) {
  const { ox, oy } = cornerOutwardOffset(pPrev, pCurr, pNext, faceOffset);
  const n = arc.length;
  const positions = [];
  const uvs = [];

  for (let i = 0; i < n; i += 1) {
    const p = arc[i];
    const x = p.x + ox;
    const y = p.y + oy;
    positions.push(x, y, z0, x, y, z1);
    uvs.push(0, 0, 0, 0);
  }

  const indices = [];
  for (let i = 0; i < n - 1; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.setAttribute("uv2", geo.attributes.uv.clone());
  geo.computeVertexNormals();
  if (typeof geo.computeTangents === "function") {
    geo.computeTangents();
  }
  return geo;
}

/** @param {THREE.BufferGeometry} geo @param {number} depth @param {number} height */
function applyCapCornerUVs(geo, depth, height) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  if (!pos || !uv) return;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = (x + depth * 0.5) / depth;
    const v = y / height;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  const uv2 = geo.attributes.uv2;
  if (uv2) {
    for (let i = 0; i < pos.count; i += 1) {
      uv2.setXY(i, uv.getX(i), uv.getY(i));
    }
    uv2.needsUpdate = true;
  }
}

/**
 * @param {THREE.BufferGeometry} geo
 * @param {import("./ControlPanel.js").ControlPanelProfilePoint[]} profile
 * @param {number} height
 * @param {number} depth
 * @param {number} width
 * @param {number} edgeIndex
 * @param {number} rotUDeg
 * @param {number} rotVDeg
 * @param {boolean} mirrorU
 */
function applyEdgeCornerUVs(
  geo,
  profile,
  height,
  depth,
  width,
  edgeIndex,
  rotUDeg,
  rotVDeg,
  mirrorU = CONTROL_PANEL_SCREEN_MIRROR_U,
) {
  const { x0, y0, x1, y1 } = getProfileEdgeTrimmedWorldPoints(
    profile,
    height,
    depth,
    edgeIndex,
  );
  const edgeLen = Math.hypot(x1 - x0, y1 - y0) || 1;
  const z0 = -width * 0.5;
  const zSpan = width;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  if (!pos || !uv) return;

  for (let i = 0; i < pos.count; i += 2) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const zLo = pos.getZ(i);
    const zHi = pos.getZ(i + 1);
    let along = Math.hypot(x - x0, y - y0) / edgeLen;
    along = Math.min(1, Math.max(0, along));
    let uLo = (zLo - z0) / zSpan;
    let uHi = (zHi - z0) / zSpan;
    if (mirrorU) {
      uLo = 1 - uLo;
      uHi = 1 - uHi;
    }
    const [u0, v0] = transformControlPanelScreenUV(
      uLo,
      along,
      rotUDeg,
      rotVDeg,
    );
    const [u1, v1] = transformControlPanelScreenUV(
      uHi,
      along,
      rotUDeg,
      rotVDeg,
    );
    uv.setXY(i, u0, v0);
    uv.setXY(i + 1, u1, v1);
  }
  uv.needsUpdate = true;
  const uv2 = geo.attributes.uv2;
  if (uv2) {
    for (let i = 0; i < uv.count; i += 1) {
      uv2.setXY(i, uv.getX(i), uv.getY(i));
    }
    uv2.needsUpdate = true;
  }
}

/**
 * @param {number} vertexIndex
 * @param {number} screenEdge
 * @param {number} shelfEdge
 * @param {number} profileLen
 */
function cornerStripSurface(vertexIndex, screenEdge, shelfEdge, profileLen) {
  const onScreen =
    vertexIndex === screenEdge ||
    vertexIndex === (screenEdge + 1) % profileLen;
  const onShelf =
    vertexIndex === shelfEdge ||
    vertexIndex === (shelfEdge + 1) % profileLen;
  if (onScreen && getControlPanelScreenCMaterial()) return "screen";
  if (onShelf && getControlPanelShelfDMaterial()) return "shelf";
  if (getControlPanelHullBodyMaterial()) return "hull";
  return null;
}

/** @param {THREE.Group} group */
export function removeControlPanelProfileCornerStrips(group) {
  const toRemove = group.children.filter((c) =>
    c.name?.startsWith(MESH_PREFIX),
  );
  for (const obj of toRemove) {
    group.remove(obj);
    obj.geometry?.dispose();
  }
}

/** @param {THREE.Group} group */
export function attachControlPanelProfileCornerStrips(group) {
  removeControlPanelProfileCornerStrips(group);

  const height = group.userData.controlPanelHeight ?? 1.65;
  const depth = group.userData.controlPanelDepth ?? height * 0.62;
  const width = group.userData.controlPanelWidth ?? height * 0.46;
  const profile = resolveControlPanelProfile(group.userData.controlPanelProfile);
  const z0 = -width * 0.5;
  const z1 = width * 0.5;
  const rotU = loadControlPanelScreenRotU();
  const rotV = loadControlPanelScreenRotV();
  const n = profile.length;

  for (let vi = 0; vi < n; vi += 1) {
    const surface = cornerStripSurface(
      vi,
      CONTROL_PANEL_SCREEN_C_EDGE_INDEX,
      CONTROL_PANEL_SHELF_D_EDGE_INDEX,
      n,
    );
    if (!surface) continue;

    const fillet = getProfileCornerFilletArcWorld(
      profile,
      height,
      depth,
      vi,
      undefined,
      CORNER_ARC_SEGMENTS,
    );
    if (!fillet) continue;

    const pts = profile.map(([x, y]) => ({
      x: x * depth - depth * 0.5,
      y: y * height,
    }));
    const pPrev = pts[(vi - 1 + n) % n];
    const pCurr = pts[vi];
    const pNext = pts[(vi + 1) % n];

    const geo = buildCornerFilletStripGeometry(
      fillet.arc,
      pPrev,
      pCurr,
      pNext,
      z0,
      z1,
      PROFILE_EDGE_FACE_OFFSET,
    );

    let mat;
    let renderOrder = 2;
    if (surface === "screen") {
      mat = getControlPanelScreenCMaterial();
      applyEdgeCornerUVs(
        geo,
        profile,
        height,
        depth,
        width,
        CONTROL_PANEL_SCREEN_C_EDGE_INDEX,
        rotU,
        rotV,
      );
      renderOrder = 3;
    } else if (surface === "shelf") {
      mat = getControlPanelShelfDMaterial();
      applyEdgeCornerUVs(
        geo,
        profile,
        height,
        depth,
        width,
        CONTROL_PANEL_SHELF_D_EDGE_INDEX,
        rotU,
        rotV,
      );
      renderOrder = 3;
    } else {
      mat = getControlPanelHullBodyMaterial();
      applyCapCornerUVs(geo, depth, height);
    }

    if (!mat) continue;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${MESH_PREFIX}${vi}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = renderOrder;
    mesh.userData.controlPanelCorner = vi;
    mesh.userData.controlPanelCornerSurface = surface;
    setWorldLayer(mesh);
    group.add(mesh);
  }
}

/** @param {THREE.Group} group */
export function syncControlPanelProfileCornerStrips(group) {
  attachControlPanelProfileCornerStrips(group);
}
