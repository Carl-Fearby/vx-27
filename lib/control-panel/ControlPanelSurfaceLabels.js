import * as THREE from "three";
import { resolveControlPanelProfile } from "./ControlPanel.js";
import { isControlPanelBodyTexturesReady } from "./ControlPanelBody.js";

export const CONTROL_PANEL_SURFACE_LABELS_KEY =
  "fps-control-panel-surface-labels-enabled";

const LABEL_PREFIX = "control_panel_surface_label_";
const OFFSET = 0.04;
const SIDE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const HULL_EDGE_MESH_PREFIX = "control_panel_hull_edge_";

/** Side letter → textured overlay child mesh name (add entries as surfaces ship). */
const TEXTURED_SURFACE_MESH = {
  C: "control_panel_screen_c",
  D: "control_panel_shelf_d",
};

/** Edge index on profile → dev letter (corners i → i+1). */
const HULL_EDGE_INDEX_TO_LETTER = {
  0: "A",
  1: "B",
  4: "E",
  5: "F",
  6: "G",
  7: "H",
  8: "I",
  9: "J",
};

/** Dev letters suppressed on these hull sides (E–I = shelf/base band). */
const HULL_LABELS_SUPPRESSED = new Set(["E", "F", "G", "H", "I"]);

/** A,B,E–J + end caps K,L — not C/D hero overlays. */
const HULL_TEXTURED_LETTERS = new Set([
  "A",
  "B",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
]);

/** @param {THREE.Group} group @param {string} letter */
function shouldSkipControlPanelSurfaceLabel(group, letter) {
  if (HULL_LABELS_SUPPRESSED.has(letter)) return true;
  if (isControlPanelBodyTexturesReady() && HULL_TEXTURED_LETTERS.has(letter)) {
    return true;
  }
  const meshName = TEXTURED_SURFACE_MESH[letter];
  if (meshName && group.children.some((c) => c.name === meshName)) return true;
  if (!isControlPanelBodyTexturesReady()) return false;
  return group.children.some((c) => {
    if (!c.name?.startsWith(HULL_EDGE_MESH_PREFIX)) return false;
    const edgeIndex = Number(c.name.slice(HULL_EDGE_MESH_PREFIX.length));
    return HULL_EDGE_INDEX_TO_LETTER[edgeIndex] === letter;
  });
}

/** @param {string} letter */
function createLetterTexture(letter) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "rgba(12, 14, 20, 0.92)";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#ffee55";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 236, 236);
  ctx.fillStyle = "#ffee55";
  ctx.font = "bold 180px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 128, 132);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** @param {string} letter @param {number} widthM @param {number} heightM */
function createLetterPlane(letter, widthM, heightM) {
  const tex = createLetterTexture(letter);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, heightM), mat);
  mesh.renderOrder = 20;
  return mesh;
}

/**
 * @param {THREE.Group} group
 * @param {string} id
 * @param {string} letter
 * @param {THREE.Vector3} position
 * @param {THREE.Vector3} normal
 * @param {number} planeW
 * @param {number} planeH
 */
function addLabel(group, id, letter, position, normal, planeW, planeH) {
  const mesh = createLetterPlane(letter, planeW, planeH);
  mesh.name = `${LABEL_PREFIX}${id}`;
  mesh.position.copy(position);
  const n = normal.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    n,
  );
  mesh.quaternion.copy(q);
  group.add(mesh);
}

export function loadControlPanelSurfaceLabelsEnabled() {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(CONTROL_PANEL_SURFACE_LABELS_KEY) !== "false";
}

export function saveControlPanelSurfaceLabelsEnabled(enabled) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CONTROL_PANEL_SURFACE_LABELS_KEY, String(enabled));
}

/** @param {THREE.Group} group */
export function removeControlPanelSurfaceLabels(group) {
  const remove = [];
  for (const child of group.children) {
    if (child.name?.startsWith(LABEL_PREFIX)) remove.push(child);
  }
  for (const obj of remove) {
    group.remove(obj);
    if (obj.isMesh) {
      obj.geometry?.dispose();
      obj.material?.map?.dispose();
      obj.material?.dispose();
    }
  }
}

/**
 * Place a letter on each swept side (one per profile edge) plus left/right end caps.
 * @param {THREE.Group} group
 */
export function attachControlPanelSurfaceLabels(group) {
  removeControlPanelSurfaceLabels(group);

  const height = group.userData.controlPanelHeight ?? 1.65;
  const depth = group.userData.controlPanelDepth ?? height * 0.62;
  const width = group.userData.controlPanelWidth ?? height * 0.46;
  const profile = resolveControlPanelProfile(
    group.userData.controlPanelProfile,
  );
  const n = profile.length;
  const labelH = Math.min(0.35, height * 0.18);
  const labelW = labelH * 0.85;

  for (let i = 0; i < n; i += 1) {
    const [x0n, y0n] = profile[i];
    const [x1n, y1n] = profile[(i + 1) % n];
    const x0 = x0n * depth - depth * 0.5;
    const y0 = y0n * height;
    const x1 = x1n * depth - depth * 0.5;
    const y1 = y1n * height;
    const mx = (x0 + x1) * 0.5;
    const my = (y0 + y1) * 0.5;
    const dx = x1 - x0;
    const dy = y1 - y0;
    let nx = dy;
    let ny = -dx;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const edgeLen = Math.hypot(dx, dy);
    const planeW = Math.max(labelW, Math.min(edgeLen * 0.55, labelW * 2.2));
    const letter = SIDE_LETTERS[i] ?? String(i + 1);
    if (shouldSkipControlPanelSurfaceLabel(group, letter)) continue;
    addLabel(
      group,
      `side_${letter}`,
      letter,
      new THREE.Vector3(mx + nx * OFFSET, my + ny * OFFSET, 0),
      new THREE.Vector3(nx, ny, 0),
      planeW,
      labelH,
    );
  }

  let cx = 0;
  let cy = 0;
  for (const [px, py] of profile) {
    cx += px * depth - depth * 0.5;
    cy += py * height;
  }
  cx /= n;
  cy /= n;

  const capSize = Math.min(0.55, Math.max(depth, height) * 0.38);
  addLabel(
    group,
    "cap_left",
    "K",
    new THREE.Vector3(cx, cy, -width * 0.5 - OFFSET),
    new THREE.Vector3(0, 0, -1),
    capSize,
    capSize,
  );
  addLabel(
    group,
    "cap_right",
    "L",
    new THREE.Vector3(cx, cy, width * 0.5 + OFFSET),
    new THREE.Vector3(0, 0, 1),
    capSize,
    capSize,
  );
}

/** @param {THREE.Group[]} groups @param {boolean} enabled */
export function syncControlPanelSurfaceLabels(groups, enabled) {
  for (const group of groups) {
    if (enabled) attachControlPanelSurfaceLabels(group);
    else removeControlPanelSurfaceLabels(group);
  }
}
