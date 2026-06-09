import * as THREE from "three";
import { getArenaAttachWall } from "../rooms/DoorwayWall.js";
import { isPointInsideAttachedRoom } from "../rooms/RoomPlacement.js";
import { ROOM_INTERIOR_LAYER, setWorldLayer } from "../lighting/LightingLayers.js";
import {
  attachControlPanelScreenC,
  isControlPanelScreenCTexturesReady,
  isControlPanelScreenCSharedMaterial,
  removeControlPanelScreenC,
  updateControlPanelScreenBrightness,
  updateControlPanelScreenUVRotation,
} from "./ControlPanelScreenC.js";
import { isControlPanelScreenCHackBlocked } from "./ControlPanelScreenCHackFlash.js";
import {
  attachControlPanelShelfD,
  isControlPanelShelfDTexturesReady,
  isControlPanelShelfDSharedMaterial,
  removeControlPanelShelfD,
  updateControlPanelShelfDBrightness,
  updateControlPanelShelfDUVRotation,
} from "./ControlPanelScreenD.js";
import {
  CONTROL_PANEL_ROOM_BRIGHTNESS_SCALE,
  CONTROL_PANEL_ROOM_HULL_COLOR_SCALE,
  CONTROL_PANEL_ROOM_HULL_EMISSIVE_SCALE,
  CONTROL_PANEL_SHELTERED_BRIGHTNESS_SCALE,
  CONTROL_PANEL_SHELTERED_HULL_COLOR_SCALE,
  CONTROL_PANEL_SHELTERED_HULL_EMISSIVE_SCALE,
} from "./ControlPanelRoomTuning.js";
import { applyControlPanelScreenBrightness } from "./ControlPanelScreenCTuning.js";
import { applyControlPanelShelfDBrightness } from "./ControlPanelShelfDTuning.js";
import { resolveControlPanelShelfDBrightness } from "./ControlPanelShelfDTuning.js";
import {
  loadControlPanelPanelBlueBias,
  loadControlPanelPanelEmissiveIntensity,
  loadControlPanelScreenBlueBias,
  loadControlPanelScreenEmissiveIntensity,
} from "./ControlPanelEmissiveTuning.js";
import { removeControlPanelSurfaceLabels } from "./ControlPanelSurfaceLabels.js";
import {
  resolveControlPanelScreenBrightness,
  loadControlPanelScreenRotU,
  loadControlPanelScreenRotV,
} from "./ControlPanelScreenCTuning.js";
import {
  CONTROL_PANEL_HULL_EMISSIVE_INTENSITY,
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

/** Lift off arena floor so the y=0 profile foot does not z-fight the ground. */
export const CONTROL_PANEL_FOOT_FLOOR_CLEARANCE = 0.004;

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
 * World-space endpoints for a profile edge (sharp corners).
 * @param {ControlPanelProfilePoint[]} profile
 * @param {number} height
 * @param {number} depth
 * @param {number} edgeIndex
 */
export function getProfileEdgeTrimmedWorldPoints(
  profile,
  height,
  depth,
  edgeIndex,
) {
  const n = profile.length;
  const i0 = edgeIndex % n;
  const i1 = (edgeIndex + 1) % n;
  const [x0, y0] = profile[i0];
  const [x1, y1] = profile[i1];
  return {
    x0: x0 * depth - depth * 0.5,
    y0: y0 * height,
    x1: x1 * depth - depth * 0.5,
    y1: y1 * height,
  };
}

/**
 * @param {number} height
 * @param {number} depth
 * @param {ControlPanelProfilePoint[]} profile
 */
export function buildControlPanelProfileShape(height, depth, profile) {
  const shape = new THREE.Shape();
  for (let i = 0; i < profile.length; i += 1) {
    const [x, y] = profile[i];
    const px = x * depth;
    const py = y * height;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
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
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
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
function removeControlPanelProfileCornerStrips(group) {
  for (let i = group.children.length - 1; i >= 0; i -= 1) {
    const child = group.children[i];
    if (!child.name?.startsWith("control_panel_corner_")) continue;
    child.geometry?.dispose();
    group.remove(child);
  }
}

/**
 * World pass always; room consoles and container interiors also join the interior
 * pass so outdoor sun, hemisphere, and barrel fire stay outside.
 * @param {THREE.Mesh} mesh
 * @param {string | null} roomId
 * @param {boolean} inVx27Container
 */
function applyControlPanelMeshLayers(mesh, roomId, inVx27Container = false) {
  setWorldLayer(mesh);
  if (roomId || inVx27Container) {
    mesh.layers.enable(ROOM_INTERIOR_LAYER);
  }
}

/**
 * @param {THREE.Group} group
 * @param {string | null} [roomId]
 */
export function applyControlPanelRenderLayers(group, roomId = null) {
  const id = roomId ?? group.userData?.roomId ?? null;
  const inVx27Container = !!group.userData?.inVx27Container;
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    applyControlPanelMeshLayers(obj, id, inVx27Container);
  });
}

/** @param {THREE.Object3D} root */
export function refreshControlPanelRenderLayers(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.name !== "control_panel" || !obj.isGroup) return;
    applyControlPanelRenderLayers(obj, obj.userData?.roomId ?? null);
  });
}

/**
 * @param {import("../level/loadArena.js").ArenaProp} def
 * @param {import("../level/loadArena.js").ArenaConfig} arena
 * @returns {string | null}
 */
export function resolveControlPanelRoomId(def, arena) {
  if (def.roomId) return def.roomId;
  const rooms = arena.rooms;
  if (!rooms?.length) return null;
  const half = (arena.size ?? 28) / 2;
  const attachWall = getArenaAttachWall(arena);
  const wallThickness = arena.wallThickness ?? 0.5;
  for (const room of rooms) {
    if (
      isPointInsideAttachedRoom(def.x, def.z, room, half, attachWall, wallThickness)
    ) {
      return room.id ?? null;
    }
  }
  return null;
}

const CONTROL_PANEL_SCREEN_C_MESH = "control_panel_screen_c";
const CONTROL_PANEL_SHELF_D_MESH = "control_panel_shelf_d";

/** @param {THREE.MeshStandardMaterial} material */
function applyControlPanelRoomHullMaterial(material) {
  material.color.setScalar(CONTROL_PANEL_ROOM_HULL_COLOR_SCALE);
  material.emissiveIntensity =
    CONTROL_PANEL_HULL_EMISSIVE_INTENSITY *
    CONTROL_PANEL_ROOM_HULL_EMISSIVE_SCALE;
  material.needsUpdate = true;
}

/** @param {THREE.MeshStandardMaterial} material */
function applyControlPanelShelteredHullMaterial(material) {
  material.color.setScalar(CONTROL_PANEL_SHELTERED_HULL_COLOR_SCALE);
  material.emissiveIntensity =
    CONTROL_PANEL_HULL_EMISSIVE_INTENSITY *
    CONTROL_PANEL_SHELTERED_HULL_EMISSIVE_SCALE;
  material.needsUpdate = true;
}

/**
 * Outdoor arena-floor consoles under the catwalk deck — not room-interior lit.
 * @param {import("../level/loadArena.js").ArenaProp} def
 * @param {import("../level/loadArena.js").ArenaConfig} arena
 * @param {string | null} [roomId]
 */
export function resolveControlPanelShelteredOutdoor(def, arena, roomId = null) {
  if (def.sunShaded === false) return false;
  if (def.sunShaded === true) return true;
  const resolvedRoom =
    roomId ?? (def.roomId ? def.roomId : resolveControlPanelRoomId(def, arena));
  if (resolvedRoom) return false;
  return (arena.ceilingThickness ?? 0) > 0;
}

/** @param {THREE.Group} group */
function assignControlPanelBodyMaterials(group) {
  const mesh = group.children.find((c) => c.name === "control_panel_mesh");
  if (!mesh?.isMesh) return;
  const inRoom = !!group.userData?.roomId;
  const shelteredOutdoor = !!group.userData?.controlPanelShelteredOutdoor;
  const privateHullMaterials = inRoom || shelteredOutdoor;
  if (isControlPanelBodyTexturesReady()) {
    const [cap, body] = getControlPanelHullMaterials();
    if (privateHullMaterials) {
      mesh.material = [cap.clone(), body.clone()];
    } else {
      mesh.material = [cap, body];
    }
    return;
  }
  const mats = getControlPanelMaterials();
  if (privateHullMaterials) {
    mesh.material = mats.map((mat) => mat.clone());
  } else {
    mesh.material = mats;
  }
}

/**
 * Per-console material brightness — outdoor panels keep baked sun tuning; room
 * panels trim diffuse only so point lights do not blow them out; screen/button
 * emissive keeps the outdoor bake.
 * @param {THREE.Group} group
 * @param {{
 *   nightness?: number,
 *   screenEmissiveIntensity?: number,
 *   panelEmissiveIntensity?: number,
 *   screenBlueBias?: number,
 *   panelBlueBias?: number,
 * }} [options]
 */
export function applyControlPanelGroupMaterials(group, options = {}) {
  const nightness = options.nightness ?? 0;
  const inRoom = !!group.userData?.roomId;
  const shelteredOutdoor = !!group.userData?.controlPanelShelteredOutdoor;
  const brightnessScale = inRoom
    ? CONTROL_PANEL_ROOM_BRIGHTNESS_SCALE
    : shelteredOutdoor
      ? CONTROL_PANEL_SHELTERED_BRIGHTNESS_SCALE
      : 1;

  const screenEmissiveBrightness =
    resolveControlPanelScreenBrightness(nightness);
  const shelfEmissiveBrightness = resolveControlPanelShelfDBrightness(nightness);
  const screenBrightness = screenEmissiveBrightness * brightnessScale;
  const shelfBrightness = shelfEmissiveBrightness * brightnessScale;
  const screenEmissive =
    options.screenEmissiveIntensity ??
    loadControlPanelScreenEmissiveIntensity();
  const panelEmissive =
    options.panelEmissiveIntensity ??
    loadControlPanelPanelEmissiveIntensity();
  const screenBlueBias =
    options.screenBlueBias ?? loadControlPanelScreenBlueBias();
  const panelBlueBias =
    options.panelBlueBias ?? loadControlPanelPanelBlueBias();

  const screenMesh = group.children.find(
    (c) => c.name === CONTROL_PANEL_SCREEN_C_MESH,
  );
  if (
    screenMesh?.isMesh &&
    screenMesh.material &&
    !isControlPanelScreenCHackBlocked(group)
  ) {
    applyControlPanelScreenBrightness(screenMesh.material, {
      brightness: screenBrightness,
      emissiveBrightness: screenEmissiveBrightness,
      emissiveIntensity: screenEmissive,
      blueBias: screenBlueBias,
    });
  }

  const shelfMesh = group.children.find(
    (c) => c.name === CONTROL_PANEL_SHELF_D_MESH,
  );
  if (shelfMesh?.isMesh && shelfMesh.material) {
    applyControlPanelShelfDBrightness(shelfMesh.material, {
      brightness: shelfBrightness,
      emissiveBrightness: shelfEmissiveBrightness,
      emissiveIntensity: panelEmissive,
      blueBias: panelBlueBias,
    });
  }

  if (!inRoom && !shelteredOutdoor) return;

  group.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    if (obj.name === CONTROL_PANEL_SCREEN_C_MESH) return;
    if (obj.name === CONTROL_PANEL_SHELF_D_MESH) return;

    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material?.isMeshStandardMaterial) continue;
      if (inRoom) applyControlPanelRoomHullMaterial(material);
      else applyControlPanelShelteredHullMaterial(material);
    }
  });
}

/** @param {THREE.Group} group */
function finishControlPanelGroup(group) {
  assignControlPanelBodyMaterials(group);
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
  removeControlPanelProfileCornerStrips(group);
  applyControlPanelRenderLayers(group);
  applyControlPanelGroupMaterials(group);
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
 *   shelteredOutdoor?: boolean,
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
  group.add(mesh);

  if (options.propDef) {
    group.userData.controlPanelPropDef = { ...options.propDef };
    group.userData.controlPanelPropId = options.propDef.id ?? null;
    group.userData.roomId = options.propDef.roomId ?? null;
  }
  if (options.shelteredOutdoor) {
    group.userData.controlPanelShelteredOutdoor = true;
  }
  if (options.inVx27Container) {
    group.userData.inVx27Container = true;
  }

  finishControlPanelGroup(group);

  group.position.set(x, floorY + CONTROL_PANEL_FOOT_FLOOR_CLEARANCE, z);
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
    bottomY: y + CONTROL_PANEL_FOOT_FLOOR_CLEARANCE,
    topY: y + CONTROL_PANEL_FOOT_FLOOR_CLEARANCE + height,
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

let controlPanelPreviewAssetsPromise = null;

/** Decode hull + screen C + shelf D maps for credits / marketing spin previews. */
export function preloadControlPanelPreviewAssets() {
  if (controlPanelPreviewAssetsPromise) return controlPanelPreviewAssetsPromise;
  controlPanelPreviewAssetsPromise = (async () => {
    const { preloadControlPanelBodyTextures } = await import("./ControlPanelBody.js");
    const { preloadControlPanelScreenCTextures } = await import("./ControlPanelScreenC.js");
    const { preloadControlPanelShelfDTextures } = await import("./ControlPanelScreenD.js");
    await Promise.all([
      preloadControlPanelBodyTextures(),
      preloadControlPanelScreenCTextures(),
      preloadControlPanelShelfDTextures(),
    ]);
  })().catch((err) => {
    controlPanelPreviewAssetsPromise = null;
    throw err;
  });
  return controlPanelPreviewAssetsPromise;
}

/** Full PBR console with screen C and shelf D — call after preload. */
export function buildControlPanelPreviewMesh(options = {}) {
  const group = createControlPanelPreviewMesh(options);
  finishControlPanelGroup(group);
  syncControlPanelScreenMaterials([group], { nightness: 0.28 });
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
/**
 * @param {THREE.Group[]} groups
 * @param {{ nightness?: number }} [options]
 */
export function syncControlPanelScreenMaterials(groups, options = {}) {
  const nightness = options.nightness ?? 0;
  for (const group of groups) {
    finishControlPanelGroup(group);
    applyControlPanelRenderLayers(group);
  }
  updateControlPanelMaterialsLive({ nightness, groups });
  const rotU = loadControlPanelScreenRotU();
  const rotV = loadControlPanelScreenRotV();
  updateControlPanelScreenUVRotation(rotU, rotV, groups);
  updateControlPanelShelfDUVRotation(rotU, rotV, groups);
}

/**
 * Brightness-only refresh (day/night or settings sliders) — no mesh rebuild.
 * @param {{ nightness?: number, groups?: THREE.Group[] }} [options]
 */
export function updateControlPanelMaterialsLive(options = {}) {
  const nightness = options.nightness ?? 0;
  const groups = options.groups ?? [];
  const materialOptions = {
    nightness,
    screenEmissiveIntensity: options.screenEmissiveIntensity,
    panelEmissiveIntensity: options.panelEmissiveIntensity,
    screenBlueBias: options.screenBlueBias,
    panelBlueBias: options.panelBlueBias,
  };

  if (groups.length) {
    let outdoorScreenSynced = false;
    let outdoorShelfSynced = false;
    for (const group of groups) {
      applyControlPanelGroupMaterials(group, materialOptions);
      if (!group.userData?.roomId) {
        const screenMesh = group.children.find(
          (c) => c.name === CONTROL_PANEL_SCREEN_C_MESH,
        );
        if (
          screenMesh?.isMesh &&
          isControlPanelScreenCSharedMaterial(screenMesh.material)
        ) {
          outdoorScreenSynced = true;
        }
        const shelfMesh = group.children.find(
          (c) => c.name === CONTROL_PANEL_SHELF_D_MESH,
        );
        if (
          shelfMesh?.isMesh &&
          isControlPanelShelfDSharedMaterial(shelfMesh.material)
        ) {
          outdoorShelfSynced = true;
        }
      }
    }
    if (!outdoorScreenSynced) {
      updateControlPanelScreenBrightness(
        resolveControlPanelScreenBrightness(nightness),
        {
          emissiveIntensity:
            materialOptions.screenEmissiveIntensity ??
            loadControlPanelScreenEmissiveIntensity(),
          blueBias:
            materialOptions.screenBlueBias ?? loadControlPanelScreenBlueBias(),
        },
      );
    }
    if (!outdoorShelfSynced) {
      updateControlPanelShelfDBrightness(
        resolveControlPanelShelfDBrightness(nightness),
        {
          emissiveIntensity:
            materialOptions.panelEmissiveIntensity ??
            loadControlPanelPanelEmissiveIntensity(),
          blueBias:
            materialOptions.panelBlueBias ?? loadControlPanelPanelBlueBias(),
        },
      );
    }
    return;
  }

  updateControlPanelScreenBrightness(
    resolveControlPanelScreenBrightness(nightness),
    {
      emissiveIntensity:
        materialOptions.screenEmissiveIntensity ??
        loadControlPanelScreenEmissiveIntensity(),
      blueBias:
        materialOptions.screenBlueBias ?? loadControlPanelScreenBlueBias(),
    },
  );
  updateControlPanelShelfDBrightness(
    resolveControlPanelShelfDBrightness(nightness),
    {
      emissiveIntensity:
        materialOptions.panelEmissiveIntensity ??
        loadControlPanelPanelEmissiveIntensity(),
      blueBias:
        materialOptions.panelBlueBias ?? loadControlPanelPanelBlueBias(),
    },
  );
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
