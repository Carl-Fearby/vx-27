import * as THREE from "three";
import {
  setRoomInteriorLayer,
  setWorldLayer,
} from "../lighting/LightingLayers.js";
import { VX27_DOOR_COLLIDER_OPEN_THRESHOLD } from "./Vx27ContainerDoors.js";

/** Outer face only on the world pass; liner handles the container-facing side. */
const CLOSED_OUTER_ONLY_DEG = VX27_DOOR_COLLIDER_OPEN_THRESHOLD;
/** Liner opacity fades out while opening above this angle. */
const LINER_FADE_END_DEG = 68;

/** @param {number} edge0 @param {number} edge1 @param {number} x */
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** @param {string} name */
export function isVx27DoorInteriorLinerMesh(name) {
  return (
    name.startsWith("vx27_container_door_") && name.endsWith("_interior")
  );
}

/** Exterior door shell — not the room-pass interior liner. @param {string} name */
export function isVx27DoorPanelMesh(name) {
  return (
    name.startsWith("vx27_container_door_") &&
    !name.endsWith("_pivot") &&
    !name.endsWith("_interior") &&
    (name.endsWith("_left") || name.endsWith("_right"))
  );
}

/** @param {THREE.Mesh} panel */
function getDoorPanelFaceMaterials(panel) {
  const { material } = panel;
  if (!material) return [];
  if (!Array.isArray(material)) return [material];
  if (material.length === 2) return [material[0]];
  const faceA = material[4];
  const faceB = material[5];
  if (faceA === faceB) return faceA ? [faceA] : [];
  return [faceA, faceB].filter(Boolean);
}

/** Snapshot tuned emissive on the exterior shell. @param {THREE.Mesh} panel */
export function captureVx27DoorPanelEmissiveBase(panel) {
  for (const mat of getDoorPanelFaceMaterials(panel)) {
    if (!mat?.emissive) continue;
    mat.userData.vx27DoorEmissiveBaseColor = mat.emissive.getHex();
    mat.userData.vx27DoorEmissiveBaseIntensity = mat.emissiveIntensity;
  }
}

/** @param {"front" | "back"} end @param {"left" | "right"} side */
function vx27DoorOpenKey(end, side) {
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  return `${end}${cap(side)}Open`;
}

/**
 * @param {THREE.Group} container
 * @param {string} meshName
 */
function readVx27DoorOpenDegForMesh(container, meshName) {
  const match = meshName.match(
    /^vx27_container_door_(front|back)_(left|right)(?:_interior)?$/
  );
  if (!match) return 0;
  const openKey = vx27DoorOpenKey(match[1], match[2]);
  const anim = container.userData.vx27DoorAnim;
  const source = anim?.current ?? container.userData.vx27DoorTuning;
  return source?.[openKey] ?? 0;
}

/** 1 when shut, 0 when swung wide open. @param {number} openDeg */
function interiorLinerOpacity(openDeg) {
  if (openDeg >= LINER_FADE_END_DEG) return 0;
  return 1 - smoothstep(0, LINER_FADE_END_DEG, openDeg);
}

/** @param {THREE.MeshStandardMaterial} mat */
function restoreVx27DoorPanelEmissiveBase(mat) {
  if (mat.userData.vx27DoorEmissiveBaseColor !== undefined) {
    mat.emissive.setHex(mat.userData.vx27DoorEmissiveBaseColor);
  }
  if (mat.userData.vx27DoorEmissiveBaseIntensity !== undefined) {
    mat.emissiveIntensity = mat.userData.vx27DoorEmissiveBaseIntensity;
  }
}

/**
 * World pass always. When shut, single-sided so the inner face does not compete
 * with the room-pass liner (same texture, one stable look from inside).
 * @param {THREE.Mesh} panel
 * @param {number} openDeg
 */
function applyVx27DoorExteriorLighting(panel, openDeg) {
  setWorldLayer(panel);
  const outerOnly = openDeg <= CLOSED_OUTER_ONLY_DEG;

  for (const mat of getDoorPanelFaceMaterials(panel)) {
    if (!mat) continue;
    restoreVx27DoorPanelEmissiveBase(mat);
    mat.side = outerOnly ? THREE.FrontSide : THREE.DoubleSide;
  }
}

/**
 * Room-pass inner face — opaque when shut (matches door cutout), fades while opening.
 * @param {THREE.Mesh} liner
 * @param {number} openDeg
 */
function applyVx27DoorInteriorLinerLighting(liner, openDeg) {
  const opacity = interiorLinerOpacity(openDeg);

  liner.visible = opacity > 0.004;
  if (!liner.visible) return;

  setRoomInteriorLayer(liner);
  liner.renderOrder = 5;

  const mat = liner.material;
  if (!mat) return;

  const opaque = opacity >= 0.995;
  mat.transparent = !opaque;
  mat.opacity = 1;
  mat.alphaTest = opaque ? 0.5 : 0;
  mat.depthWrite = true;

  if (mat.emissive) {
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0;
  }

  if (!opaque) {
    mat.transparent = true;
    mat.opacity = opacity;
    mat.alphaTest = 0;
    mat.depthWrite = opacity > 0.9;
  }
}

/** @param {THREE.Mesh} mesh @param {THREE.Group} container */
function applyVx27DoorMeshLighting(mesh, container) {
  const openDeg = readVx27DoorOpenDegForMesh(container, mesh.name);
  if (isVx27DoorInteriorLinerMesh(mesh.name)) {
    applyVx27DoorInteriorLinerLighting(mesh, openDeg);
    return;
  }
  if (isVx27DoorPanelMesh(mesh.name)) {
    applyVx27DoorExteriorLighting(mesh, openDeg);
  }
}

/**
 * @param {THREE.Mesh} panel
 * @param {THREE.Group} container
 */
export function applyVx27ContainerDoorPanelLayers(panel, container) {
  applyVx27DoorMeshLighting(panel, container);
}

/** @param {THREE.Group} container */
export function updateVx27ContainerDoorLightingLayers(container) {
  const doors = container.getObjectByName("vx27_container_doors");
  if (!doors) return;
  doors.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.userData.isShadowOccluder) return;
    if (!isVx27DoorPanelMesh(obj.name) && !isVx27DoorInteriorLinerMesh(obj.name)) {
      return;
    }
    applyVx27DoorMeshLighting(obj, container);
  });
}

