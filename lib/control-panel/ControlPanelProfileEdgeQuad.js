import * as THREE from "three";
import {
  CONTROL_PANEL_SCREEN_MIRROR_U,
  transformControlPanelScreenUV,
} from "./ControlPanelScreenCTuning.js";
import { getProfileEdgeTrimmedWorldPoints } from "./ControlPanel.js";

/** Pull hull/C/D quads past the extruded side (reduces z-fight; stay outside near clip). */
export const PROFILE_EDGE_FACE_OFFSET = 0.025;

/** Rear panel sits slightly past the extruded back strip. */
export const PROFILE_EDGE_BACK_FACE_OFFSET = 0.03;

/** Neutral quad UVs before mirror + centre rotation (shared by C, D, …). */
export const PROFILE_EDGE_BASE_UVS = new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]);

/**
 * @param {THREE.BufferAttribute} uvAttr
 * @param {number} rotUDeg
 * @param {number} rotVDeg
 * @param {Float32Array} [baseUvs]
 */
export function writeProfileEdgeUVs(
  uvAttr,
  rotUDeg,
  rotVDeg,
  baseUvs = PROFILE_EDGE_BASE_UVS,
) {
  for (let i = 0; i < 4; i += 1) {
    const bu = baseUvs[i * 2];
    const bv = baseUvs[i * 2 + 1];
    const [u, v] = transformControlPanelScreenUV(bu, bv, rotUDeg, rotVDeg);
    uvAttr.setXY(i, u, v);
  }
  uvAttr.needsUpdate = true;
}

/**
 * @param {THREE.Mesh} mesh
 * @param {number} rotUDeg
 * @param {number} rotVDeg
 * @param {THREE.MeshStandardMaterial | null} [material]
 */
export function applyProfileEdgeMeshUV(
  mesh,
  rotUDeg,
  rotVDeg,
  material = null,
  baseUvs = PROFILE_EDGE_BASE_UVS,
) {
  const uv = mesh.geometry?.attributes?.uv;
  if (!uv) return;
  writeProfileEdgeUVs(uv, rotUDeg, rotVDeg, baseUvs);
  const uv2 = mesh.geometry.attributes.uv2;
  if (uv2) writeProfileEdgeUVs(uv2, rotUDeg, rotVDeg, baseUvs);
  if (material) {
    const totalRad = (((rotUDeg + rotVDeg) % 360) * Math.PI) / 180;
    const bx = CONTROL_PANEL_SCREEN_MIRROR_U ? -0.75 : 0.75;
    const by = 0.75;
    const c = Math.cos(totalRad);
    const s = Math.sin(totalRad);
    material.normalScale.set(bx * c - by * s, bx * s + by * c);
    material.needsUpdate = true;
  }
}

/**
 * Hull A–J: linear 0–1 UVs (no screen rotation). v runs bottom → top along the edge.
 * @param {THREE.Mesh} mesh
 * @param {{ flipV?: boolean, mirrorU?: boolean }} [options]
 */
export function applyHullEdgeMeshUV(mesh, options = {}) {
  const { flipV = false, mirrorU = CONTROL_PANEL_SCREEN_MIRROR_U } = options;
  const uvCorners = [
    [0, flipV ? 1 : 0],
    [0, flipV ? 0 : 1],
    [1, flipV ? 0 : 1],
    [1, flipV ? 1 : 0],
  ];
  const apply = (uvAttr) => {
    if (!uvAttr) return;
    for (let i = 0; i < 4; i += 1) {
      let u = uvCorners[i][0];
      const v = uvCorners[i][1];
      if (mirrorU) u = 1 - u;
      uvAttr.setXY(i, u, v);
    }
    uvAttr.needsUpdate = true;
  };
  apply(mesh.geometry?.attributes?.uv);
  apply(mesh.geometry?.attributes?.uv2);
}

/**
 * Quad on one profile edge, extruded along console width (Z).
 * u = along width, v = along the edge in profile XY.
 *
 * @param {import("./ControlPanel.js").ControlPanelProfilePoint[]} profile
 * @param {number} height
 * @param {number} depth
 * @param {number} width
 * @param {number} edgeIndex
 * @param {{ faceOffset?: number }} [options]
 */
export function buildControlPanelProfileEdgeQuad(
  profile,
  height,
  depth,
  width,
  edgeIndex,
  options = {},
) {
  const n = profile.length;
  const i0 = edgeIndex % n;
  const i1 = (edgeIndex + 1) % n;
  const { x0, y0, x1, y1 } = getProfileEdgeTrimmedWorldPoints(
    profile,
    height,
    depth,
    edgeIndex,
  );
  const z0 = -width * 0.5;
  const z1 = width * 0.5;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const outX = dy;
  const outY = -dx;
  const olen = Math.hypot(outX, outY) || 1;
  const nx = outX / olen;
  const ny = outY / olen;
  const faceOffset = options.faceOffset ?? PROFILE_EDGE_FACE_OFFSET;

  const p0 = new THREE.Vector3(
    x0 + nx * faceOffset,
    y0 + ny * faceOffset,
    z0,
  );
  const p1 = new THREE.Vector3(
    x1 + nx * faceOffset,
    y1 + ny * faceOffset,
    z0,
  );
  const p2 = new THREE.Vector3(
    x1 + nx * faceOffset,
    y1 + ny * faceOffset,
    z1,
  );
  const p3 = new THREE.Vector3(
    x0 + nx * faceOffset,
    y0 + ny * faceOffset,
    z1,
  );

  const positions = new Float32Array([
    p0.x, p0.y, p0.z,
    p1.x, p1.y, p1.z,
    p2.x, p2.y, p2.z,
    p3.x, p3.y, p3.z,
  ]);

  const uvs = PROFILE_EDGE_BASE_UVS.slice();

  let indices = [0, 1, 2, 0, 2, 3];
  const e2z = z1 - z0;
  const faceNx = dy * e2z;
  const faceNy = -dx * e2z;
  const dot = faceNx * outX + faceNy * outY;
  if (dot < 0) {
    indices = [0, 2, 1, 0, 3, 2];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.setAttribute("uv2", geo.attributes.uv.clone());
  geo.computeVertexNormals();
  if (typeof geo.computeTangents === "function") {
    geo.computeTangents();
  }
  return geo;
}

/**
 * Surface A — full-height flat rear (profile x = 1).
 * @param {number} height
 * @param {number} depth
 * @param {number} width
 */
export function buildControlPanelBackPanelQuad(height, depth, width) {
  const x = depth * 0.5 + PROFILE_EDGE_BACK_FACE_OFFSET;
  const z0 = -width * 0.5;
  const z1 = width * 0.5;

  const positions = new Float32Array([
    x, 0, z0,
    x, height, z0,
    x, height, z1,
    x, 0, z1,
  ]);
  const uvs = new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]);
  const indices = [0, 1, 2, 0, 2, 3];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.setAttribute("uv2", geo.attributes.uv.clone());
  geo.computeVertexNormals();
  if (typeof geo.computeTangents === "function") {
    geo.computeTangents();
  }
  return geo;
}
