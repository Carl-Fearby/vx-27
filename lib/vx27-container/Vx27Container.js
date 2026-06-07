import * as THREE from "three";
import {
  ROOM_INTERIOR_LAYER,
  setRoomInteriorLayer,
  setWorldLayer,
} from "../lighting/LightingLayers.js";
import {
  DEFAULT_VX27_CONTAINER_MATERIAL_TUNING,
  normalizeVx27ContainerMaterialTuning,
} from "./Vx27ContainerMaterialTuning.js";
import {
  DEFAULT_VX27_CONTAINER_DOOR_TUNING,
  normalizeVx27ContainerDoorTuning,
} from "./Vx27ContainerDoorTuning.js";
import {
  computeVx27DoorLayout,
  VX27_DOOR_COLLIDER_OPEN_THRESHOLD,
  vx27DoorLeafCenterOffset,
} from "./Vx27ContainerDoors.js";
import {
  initVx27ContainerDoorAnim,
  setVx27ContainerDoorOpenTargets,
  updateVx27ContainerDoorAnimations,
  consumeVx27DoorColliderDirty,
  vx27DoorPatchChangesGeometry,
} from "./Vx27ContainerDoorAnimation.js";
import { invalidateVx27DoorInteractMeshes } from "./Vx27ContainerDoorInteract.js";
import { pointInRoundedBoxFootprint } from "../physics/Collision.js";
import { WALL_STANDOFF, WALL_VISUAL_FLOOR_EMBED } from "../level/LevelConstants.js";

/** Square ISO-style end profile (m). */
export const VX27_CONTAINER_WIDTH = 2.44;
export const VX27_CONTAINER_HEIGHT = 2.44;
/** Side texture is 2:1 — length matches height × 2. */
export const VX27_CONTAINER_LENGTH = VX27_CONTAINER_HEIGHT * 2;
/** Thin painted steel shell — not a thick vault frame. */
export const VX27_SHELL_THICKNESS = 0.028;
/** Extra collision on the exterior side of shell faces — shell mesh is ~28 mm; player radius ~0.35 m. */
const VX27_WALL_COLLIDER_OUTWARD_PAD = 0.14;

/** @param {number} shell @param {number} [pad=VX27_WALL_COLLIDER_OUTWARD_PAD] */
function vx27ShellColliderHalfThickness(shell, pad = VX27_WALL_COLLIDER_OUTWARD_PAD) {
  return shell / 2 + pad / 2;
}
/** Extra inset for the interior shell (matches oil barrel). */
const INTERIOR_INSET = 0.003;
/** Solid interior lining thickness — avoids see-through at grazing angles. */
const INTERIOR_WALL_THICKNESS = 0.012;
/** Interior ceiling extends into exterior roof shell (matches room ceiling overlap). */
const CEILING_SHELL_OVERLAP = 0.04;
/** Matches PlayerController capsule radius. */
const PLAYER_RADIUS = 0.35;

/** Shell collision phased rollout — roof only for now. */
export const VX27_CONTAINER_COLLISION_ENABLED = true;
export const VX27_CONTAINER_ROOF_COLLISION = true;
export const VX27_CONTAINER_LEFT_WALL_COLLISION = true;
export const VX27_CONTAINER_RIGHT_WALL_COLLISION = true;
export const VX27_CONTAINER_FLOOR_COLLISION = true;
/** Extra space below roof underside — stops jump / stand-up clipping through. */
export const VX27_ROOF_HEADROOM_MARGIN = 0.22;

/** @param {import("../physics/Collision.js").ColliderBox} box */
export function getVx27RoofHeadroomMargin(box) {
  return box.kind === "vx27ContainerWall" && box.containerPart === "roof"
    ? VX27_ROOF_HEADROOM_MARGIN
    : 0;
}

/** Default distance from each exterior face to the interior shell (m). */
export function getDefaultVx27InteriorInsets() {
  const d = VX27_SHELL_THICKNESS + INTERIOR_INSET;
  return {
    left: d,
    right: d,
    front: d,
    back: d,
    floorOffset: 0,
    ceilingOffset: 0,
  };
}

/** @typedef {{ left: number, right: number, front: number, back: number, floorOffset: number, ceilingOffset: number }} Vx27InteriorInsets */

export const VX27_INTERIOR_INSET_MIN = 0.001;
export const VX27_INTERIOR_INSET_MAX = 1.2;
export const VX27_INTERIOR_FLOOR_OFFSET_MIN = -2;
export const VX27_INTERIOR_FLOOR_OFFSET_MAX = 4;
export const VX27_INTERIOR_CEILING_OFFSET_MIN = -2;
export const VX27_INTERIOR_CEILING_OFFSET_MAX = 4;

export const VX27_EDGE_RADIUS_MIN = 0;
export const VX27_EDGE_RADIUS_MAX = 0.35;
/** Visual trim — shortens side walls and end-cap planes (flat UVs). Not curved geo. */
export const VX27_EDGE_RADIUS_DEFAULT = 0;
/** Exterior collider corner fillet (hazard-pillar style) — collision only. */
export const VX27_EXTERIOR_CORNER_RADIUS_MIN = 0;
export const VX27_EXTERIOR_CORNER_RADIUS_MAX = 1.2;
export const VX27_EXTERIOR_CORNER_RADIUS_DEFAULT = 0;
export const VX27_CONTAINER_SCALE_MIN = 0.25;
export const VX27_CONTAINER_SCALE_MAX = 3;
export const VX27_CONTAINER_SCALE_DEFAULT = 1;

/**
 * @param {number | null | undefined} scale
 * @returns {number}
 */
export function normalizeVx27ContainerScale(scale) {
  const n =
    typeof scale === "number" && !Number.isNaN(scale)
      ? scale
      : VX27_CONTAINER_SCALE_DEFAULT;
  return THREE.MathUtils.clamp(
    n,
    VX27_CONTAINER_SCALE_MIN,
    VX27_CONTAINER_SCALE_MAX
  );
}

/**
 * @param {number} [scale=1]
 * @returns {{ scale: number, width: number, height: number, length: number, shell: number }}
 */
export function resolveVx27ContainerDimensions(scale = VX27_CONTAINER_SCALE_DEFAULT) {
  const s = normalizeVx27ContainerScale(scale);
  return {
    scale: s,
    width: VX27_CONTAINER_WIDTH * s,
    height: VX27_CONTAINER_HEIGHT * s,
    length: VX27_CONTAINER_LENGTH * s,
    shell: VX27_SHELL_THICKNESS * s,
  };
}

/** @param {number} width @param {number} height @param {number} length */
export function getMaxVx27EdgeRadius(width, height, length) {
  return Math.min(width, height, length) * 0.2;
}

/**
 * @param {number | null | undefined} radius
 * @param {number} [width]
 * @param {number} [height]
 * @param {number} [length]
 */
export function normalizeVx27EdgeRadius(
  radius,
  width = VX27_CONTAINER_WIDTH,
  height = VX27_CONTAINER_HEIGHT,
  length = VX27_CONTAINER_LENGTH
) {
  const max = Math.min(
    VX27_EDGE_RADIUS_MAX,
    getMaxVx27EdgeRadius(width, height, length)
  );
  const n =
    typeof radius === "number" && !Number.isNaN(radius)
      ? radius
      : VX27_EDGE_RADIUS_DEFAULT;
  return THREE.MathUtils.clamp(n, VX27_EDGE_RADIUS_MIN, max);
}

/** @param {number} width @param {number} length */
export function getMaxVx27ExteriorCornerRadius(width, length) {
  return Math.max(0, Math.min(width, length) / 2 - 0.05);
}

/**
 * @param {number | null | undefined} radius
 * @param {number} [width]
 * @param {number} [length]
 */
export function normalizeVx27ExteriorCornerRadius(
  radius,
  width = VX27_CONTAINER_WIDTH,
  length = VX27_CONTAINER_LENGTH
) {
  const max = Math.min(
    VX27_EXTERIOR_CORNER_RADIUS_MAX,
    getMaxVx27ExteriorCornerRadius(width, length)
  );
  const n =
    typeof radius === "number" && !Number.isNaN(radius)
      ? radius
      : VX27_EXTERIOR_CORNER_RADIUS_DEFAULT;
  return THREE.MathUtils.clamp(n, VX27_EXTERIOR_CORNER_RADIUS_MIN, max);
}

/**
 * Collision corner radius — explicit `exteriorCornerRadius` wins; otherwise match edge fillet.
 * @param {{ edgeRadius?: number, exteriorCornerRadius?: number | null }} spec
 * @param {number} width
 * @param {number} height
 * @param {number} length
 */
function resolveVx27ExteriorCornerRadius(spec, width, height, length) {
  const edgeR = normalizeVx27EdgeRadius(spec.edgeRadius, width, height, length);
  if (
    typeof spec.exteriorCornerRadius === "number" &&
    spec.exteriorCornerRadius > 0
  ) {
    return normalizeVx27ExteriorCornerRadius(
      spec.exteriorCornerRadius,
      width,
      length
    );
  }
  if (edgeR > 0) {
    return normalizeVx27ExteriorCornerRadius(edgeR, width, length);
  }
  if (typeof spec.exteriorCornerRadius === "number") {
    return normalizeVx27ExteriorCornerRadius(
      spec.exteriorCornerRadius,
      width,
      length
    );
  }
  return 0;
}

/**
 * Pillar-style rounded XZ footprint: inset flat faces, expose cornerRadius.
 * Thin colliders (side walls) round only on the long axis.
 * @param {number} halfX
 * @param {number} halfZ
 * @param {number} cornerR
 */
function applyExteriorColliderCornerRounding(halfX, halfZ, cornerR) {
  const r = Math.max(0, cornerR ?? 0);
  if (r <= 0) {
    return { halfX, halfZ, cornerRadius: 0 };
  }

  const thinX = halfX < halfZ * 0.25;
  const thinZ = halfZ < halfX * 0.25;

  if (thinX) {
    const clamped = Math.min(r, Math.max(0, halfZ - 0.05));
    if (clamped <= 0) return { halfX, halfZ, cornerRadius: 0 };
    return {
      halfX,
      halfZ: Math.max(0.001, halfZ - clamped),
      cornerRadius: clamped,
    };
  }

  if (thinZ) {
    const clamped = Math.min(r, Math.max(0, halfX - 0.05));
    if (clamped <= 0) return { halfX, halfZ, cornerRadius: 0 };
    return {
      halfX: Math.max(0.001, halfX - clamped),
      halfZ,
      cornerRadius: clamped,
    };
  }

  const maxR = Math.min(halfX, halfZ) - 0.05;
  const clamped = Math.min(r, Math.max(0, maxR));
  if (clamped <= 0) {
    return { halfX, halfZ, cornerRadius: 0 };
  }
  return {
    halfX: Math.max(0.001, halfX - clamped),
    halfZ: Math.max(0.001, halfZ - clamped),
    cornerRadius: clamped,
  };
}

/**
 * Shared exterior XZ footprint (edge inset + corner fillet) in container space.
 * @param {number} halfW
 * @param {number} halfL
 * @param {number} edgeR
 * @param {number} cornerR
 */
function vx27ExteriorFootprintHalfExtents(halfW, halfL, edgeR, cornerR) {
  const shellHalfW = Math.max(0.05, halfW - edgeR);
  const shellHalfL = Math.max(0.05, halfL - edgeR);
  return applyExteriorColliderCornerRounding(shellHalfW, shellHalfL, cornerR);
}

/** @param {import("../physics/Collision.js").ColliderBox} box @param {number} edgeR @param {number} cornerR */
function vx27ColliderFootprintMeta(box, edgeR, cornerR) {
  box.containerEdgeRadius = edgeR;
  box.exteriorCornerRadius = cornerR;
}

/**
 * True when a circle at (x, z) overlaps the container's exterior collision footprint.
 * @param {import("../physics/Collision.js").ColliderBox} box
 * @param {number} x
 * @param {number} z
 * @param {number} [radius=0]
 */
export function pointInVx27ExteriorColliderFootprint(box, x, z, radius = 0) {
  const cornerR = box.exteriorCornerRadius ?? 0;
  if (cornerR <= 0) return true;

  const cx = box.containerCx;
  const cz = box.containerCz;
  const halfW = box.containerHalfW;
  const halfL = box.containerHalfL;
  if (cx == null || cz == null || halfW == null || halfL == null) return true;

  const edgeR = box.containerEdgeRadius ?? 0;
  const rounded = vx27ExteriorFootprintHalfExtents(halfW, halfL, edgeR, cornerR);
  return pointInRoundedBoxFootprint(
    {
      x: cx,
      z: cz,
      rotationY: box.rotationY ?? 0,
      halfX: rounded.halfX,
      halfZ: rounded.halfZ,
      cornerRadius: rounded.cornerRadius,
    },
    x,
    z,
    radius
  );
}

/** @param {Partial<Vx27InteriorInsets> | null | undefined} [insets] @returns {Vx27InteriorInsets} */
export function normalizeVx27InteriorInsets(insets) {
  const d = getDefaultVx27InteriorInsets();
  const clampWall = (v, fallback) =>
    THREE.MathUtils.clamp(
      typeof v === "number" && !Number.isNaN(v) ? v : fallback,
      VX27_INTERIOR_INSET_MIN,
      VX27_INTERIOR_INSET_MAX
    );
  const clampFloor = (v, fallback) =>
    THREE.MathUtils.clamp(
      typeof v === "number" && !Number.isNaN(v) ? v : fallback,
      VX27_INTERIOR_FLOOR_OFFSET_MIN,
      VX27_INTERIOR_FLOOR_OFFSET_MAX
    );
  const clampCeil = (v, fallback) =>
    THREE.MathUtils.clamp(
      typeof v === "number" && !Number.isNaN(v) ? v : fallback,
      VX27_INTERIOR_CEILING_OFFSET_MIN,
      VX27_INTERIOR_CEILING_OFFSET_MAX
    );
  return {
    left: clampWall(insets?.left, d.left),
    right: clampWall(insets?.right, d.right),
    front: clampWall(insets?.front, d.front),
    back: clampWall(insets?.back, d.back),
    floorOffset: clampFloor(insets?.floorOffset, d.floorOffset),
    ceilingOffset: clampCeil(insets?.ceilingOffset, d.ceilingOffset),
  };
}

/** @param {THREE.Object3D} obj */
function disposeContainerSubtree(obj) {
  obj.traverse((child) => {
    if (child.geometry && !child.geometry.userData?.vx27SharedGeometry) {
      child.geometry.dispose();
    }
    const mat = child.material;
    if (mat?.userData?.vx27ContainerFloorClone) mat.dispose();
  });
}

const TEX_ROOT = "/textures/vx27_container";
const EMISSIVE_COLOR = 0x28c8ff;
const EMISSIVE_INTENSITY = 2.4;
const INTERIOR_FLOOR_DARKEN = 0.62;
/** Sink exterior floor slightly below the container base so it wins depth over the arena slab. */
const EXTERIOR_FLOOR_GROUND_BIAS = 0.004;

const MAP_CHANNELS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "alphaMap",
];

const SET_FILES = {
  side: {
    albedo: "vx27_container_side_albedo.webp",
    normal: "vx27_container_side_normal.webp",
    roughness: "vx27_container_side_roughness.webp",
    metallic: "vx27_container_side_metallic.webp",
    ao: "vx27_container_side_ao.webp",
    emissive: "vx27_container_side_emissive_mask.webp",
  },
  inside_wall: {
    albedo: "vx27_container_inside_wall_albedo.webp",
    normal: "vx27_container_inside_wall_normal.webp",
    roughness: "vx27_container_inside_wall_roughness.webp",
    metallic: "vx27_container_inside_wall_metallic.webp",
    ao: "vx27_container_inside_wall_ao.webp",
    emissive: "vx27_container_inside_wall_emissive_mask.webp",
  },
  top_bottom: {
    albedo: "vx27_container_top_bottom_albedo.webp",
    normal: "vx27_container_top_bottom_normal.webp",
    roughness: "vx27_container_top_bottom_roughness.webp",
    metallic: "vx27_container_top_bottom_metallic.webp",
    ao: "vx27_container_top_bottom_ao.webp",
    emissive: "vx27_container_top_bottom_emissive_mask.webp",
  },
  corner_arc: {
    albedo: "vx27_container_corner_arc_albedo.webp",
    normal: "vx27_container_corner_arc_normal.webp",
    roughness: "vx27_container_corner_arc_roughness.webp",
    metallic: "vx27_container_corner_arc_metallic.webp",
    ao: "vx27_container_corner_arc_ao.webp",
  },
  endcap_square: {
    albedo: "vx27_container_endcap_square_albedo.webp",
    normal: "vx27_container_endcap_square_normal.webp",
    roughness: "vx27_container_endcap_square_roughness.webp",
    metallic: "vx27_container_endcap_square_metallic.webp",
    ao: "vx27_container_endcap_square_ao.webp",
    alpha: "vx27_container_endcap_square_alpha.webp",
    emissive: "vx27_container_endcap_square_emissive_mask.webp",
  },
  door: {
    albedo: "vx27_container_door_albedo.webp",
    normal: "vx27_container_door_normal.webp",
    roughness: "vx27_container_door_roughness.webp",
    metallic: "vx27_container_door_metallic.webp",
    ao: "vx27_container_door_ao.webp",
    alpha: "vx27_container_door_alpha.webp",
    emissive: "vx27_container_door_emissive_mask.webp",
  },
};

const _loader = new THREE.TextureLoader();
/** @type {Map<string, THREE.Texture>} */
const _textures = new Map();
/** @type {Map<string, THREE.MeshStandardMaterial>} */
const _materials = new Map();
let _preloadPromise = null;

function configureColorTex(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function configureDataTex(tex) {
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

async function loadSetTextures(setKey) {
  const files = SET_FILES[setKey];
  const entries = Object.entries(files);
  await Promise.all(
    entries.map(async ([channel, file]) => {
      const key = `${setKey}/${channel}`;
      if (_textures.has(key)) return;
      const tex = await _loader.loadAsync(`${TEX_ROOT}/${file}`);
      if (channel === "albedo") {
        configureColorTex(tex);
      } else {
        configureDataTex(tex);
      }
      _textures.set(key, tex);
    })
  );
}

function tex(setKey, channel) {
  return _textures.get(`${setKey}/${channel}`) ?? null;
}

/** @type {import("./Vx27ContainerMaterialTuning.js").Vx27ContainerMaterialTuning} */
let _materialTuning = { ...DEFAULT_VX27_CONTAINER_MATERIAL_TUNING };

/** @param {THREE.MeshStandardMaterial} mat @param {import("./Vx27ContainerMaterialTuning.js").Vx27ContainerMaterialTuning} tuning */
function applyVx27MaterialSurface(mat, tuning) {
  if (!mat?.userData?.vx27ContainerOwned && !mat?.userData?.vx27ContainerFloorClone) {
    return;
  }
  const isInterior = mat.userData.vx27Surface === "interior";
  const isCornerBevel = mat.userData.vx27SetKey === "corner_arc";
  const hasEmissiveMap = Boolean(mat.emissiveMap);
  const base = mat.userData.vx27BaseColor?.isColor
    ? mat.userData.vx27BaseColor
    : (mat.userData.vx27BaseColor = new THREE.Color(0xffffff));

  mat.color.copy(base);
  mat.color.multiplyScalar(
    isInterior
      ? tuning.interiorBrightness
      : isCornerBevel
        ? tuning.cornerBevelBrightness
        : tuning.exteriorBrightness
  );
  mat.roughness = isInterior
    ? tuning.interiorRoughness
    : isCornerBevel
      ? tuning.cornerBevelRoughness
      : tuning.exteriorRoughness;
  mat.metalness = isInterior
    ? tuning.interiorMetalness
    : isCornerBevel
      ? tuning.cornerBevelMetalness
      : tuning.exteriorMetalness;
  mat.emissive.setHex(hasEmissiveMap ? EMISSIVE_COLOR : 0x000000);
  mat.emissiveIntensity = hasEmissiveMap
    ? isInterior
      ? tuning.interiorEmissiveIntensity
      : tuning.exteriorEmissiveIntensity
    : 0;
  if (mat.normalMap) {
    if (!mat.normalScale) mat.normalScale = new THREE.Vector2(1, 1);
    mat.normalScale.set(tuning.normalScale, tuning.normalScale);
  }
  applyMapTransform(mat, {
    rotateUV90: mat.userData.vx27RotateUV90,
    mirrorU: mat.userData.vx27MirrorU,
    flipV: mat.userData.vx27FlipV,
    scaleU:
      mat.userData.vx27SetKey === "endcap_square"
        ? tuning.endcapTextureScale
        : mat.userData.vx27SetKey === "corner_arc"
          ? mat.userData.vx27SlabEdge
            ? tuning.roofFloorUvRepeatU
            : tuning.cornerBevelUvRepeatU
          : mat.userData.vx27SetKey === "door"
            ? tuning.doorTextureScale
          : 1,
    scaleV:
      mat.userData.vx27SetKey === "endcap_square"
        ? tuning.endcapTextureScale
        : mat.userData.vx27SetKey === "corner_arc"
          ? mat.userData.vx27SlabEdge
            ? tuning.roofFloorUvRepeatV
            : tuning.cornerBevelUvRepeatV
          : mat.userData.vx27SetKey === "door"
            ? tuning.doorTextureScale
          : 1,
  });
}

/**
 * @param {import("./Vx27ContainerMaterialTuning.js").Vx27ContainerMaterialTuning} tuning
 * @param {THREE.Object3D} [root]
 */
export function setVx27ContainerMaterialTuning(tuning, root) {
  _materialTuning = normalizeVx27ContainerMaterialTuning(tuning);
  for (const mat of _materials.values()) {
    applyVx27MaterialSurface(mat, _materialTuning);
  }
  if (!root) return;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    let parent = obj.parent;
    let inContainer = obj.name === "vx27_container";
    while (parent && !inContainer) {
      if (parent.name === "vx27_container") inContainer = true;
      parent = parent.parent;
    }
    if (!inContainer) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      applyVx27MaterialSurface(mat, _materialTuning);
    }
  });
}

/** @returns {import("./Vx27ContainerMaterialTuning.js").Vx27ContainerMaterialTuning} */
export function getVx27ContainerMaterialTuning() {
  return { ..._materialTuning };
}

function applyMapTransform(material, options = {}) {
  const {
    rotate90 = false,
    rotateUV90 = rotate90,
    mirrorU = false,
    flipV = false,
    scaleU = 1,
    scaleV = 1,
  } = options;
  const signedScale = (value, fallback = 1) => {
    const n = Number.isFinite(value) ? value : fallback;
    if (Math.abs(n) >= 0.001) return n;
    return n < 0 ? -0.001 : 0.001;
  };
  const uScale = signedScale(scaleU, 1);
  const vScale = signedScale(scaleV, 1);
  for (const key of MAP_CHANNELS) {
    const map = material[key];
    if (!map) continue;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.center.set(0.5, 0.5);
    map.rotation = rotateUV90 ? Math.PI / 2 : 0;
    map.repeat.set(uScale, vScale);
    map.offset.set(0, 0);
    if (mirrorU) {
      map.repeat.x *= -1;
    }
    if (flipV) {
      map.repeat.y *= -1;
    }
    if (map.repeat.x < 0) map.offset.x = 1;
    if (map.repeat.y < 0) map.offset.y = 1;
    map.needsUpdate = true;
  }
}

function buildMaterial(setKey, options = {}) {
  const cacheKey = `${setKey}:${JSON.stringify(options)}`;
  if (_materials.has(cacheKey)) {
    const cached = _materials.get(cacheKey);
    applyVx27MaterialSurface(cached, _materialTuning);
    return cached;
  }

  const {
    transparent = false,
    alphaTest = 0,
    side = THREE.FrontSide,
    floorDarken = false,
    mirrorU = false,
    rotateUV90 = false,
    flipV = false,
    surface = "exterior",
    slabEdge = false,
    doubleSided = false,
    shellFloor = false,
  } = options;

  const maps = SET_FILES[setKey];
  const mat = new THREE.MeshStandardMaterial({
    map: tex(setKey, "albedo")?.clone() ?? null,
    normalMap: tex(setKey, "normal")?.clone() ?? null,
    roughnessMap: tex(setKey, "roughness")?.clone() ?? null,
    metalnessMap: tex(setKey, "metallic")?.clone() ?? null,
    aoMap: tex(setKey, "ao")?.clone() ?? null,
    emissiveMap: tex(setKey, "emissive")?.clone() ?? null,
    alphaMap: maps.alpha ? tex(setKey, "alpha")?.clone() ?? null : null,
    emissive: new THREE.Color(EMISSIVE_COLOR),
    emissiveIntensity: EMISSIVE_INTENSITY,
    metalness: 1,
    roughness: 1,
    transparent,
    alphaTest,
    depthWrite: !transparent,
    side: doubleSided ? THREE.DoubleSide : side,
  });

  mat.userData.vx27ContainerOwned = true;
  mat.userData.vx27SetKey = setKey;
  mat.userData.vx27Surface = surface;
  mat.userData.vx27FloorDarken = floorDarken;
  mat.userData.vx27BaseColor = new THREE.Color(0xffffff);
  mat.userData.vx27RotateUV90 = rotateUV90;
  mat.userData.vx27MirrorU = mirrorU;
  mat.userData.vx27FlipV = flipV;
  mat.userData.vx27SlabEdge = slabEdge;
  mat.userData.vx27ShellFloor = shellFloor;

  if (floorDarken) {
    mat.userData.vx27BaseColor.multiplyScalar(INTERIOR_FLOOR_DARKEN);
  }

  // Level wall surface rules — applied here instead of Material.clone() (clone JSON-strips Color userData).
  const isInterior = surface === "interior";
  mat.depthWrite = true;
  mat.depthTest = true;
  mat.side = doubleSided ? THREE.DoubleSide : side;
  mat.polygonOffset = isInterior || shellFloor;
  mat.polygonOffsetFactor = isInterior ? 3 : shellFloor ? 2 : 0;
  mat.polygonOffsetUnits = isInterior ? 3 : shellFloor ? 2 : 0;

  applyMapTransform(mat, { rotateUV90, mirrorU, flipV });

  mat.color.copy(mat.userData.vx27BaseColor);
  applyVx27MaterialSurface(mat, _materialTuning);
  _materials.set(cacheKey, mat);
  return mat;
}

/** Material.clone() JSON-serializes userData — restore vx27 fields that break (e.g. THREE.Color). */
function cloneVx27ContainerMaterial(source, { floorInstance = false } = {}) {
  const mat = source.clone();
  mat.userData.vx27ContainerOwned = source.userData.vx27ContainerOwned;
  mat.userData.vx27SetKey = source.userData.vx27SetKey;
  mat.userData.vx27Surface = source.userData.vx27Surface;
  mat.userData.vx27FloorDarken = source.userData.vx27FloorDarken;
  mat.userData.vx27RotateUV90 = source.userData.vx27RotateUV90;
  mat.userData.vx27MirrorU = source.userData.vx27MirrorU;
  mat.userData.vx27FlipV = source.userData.vx27FlipV;
  mat.userData.vx27SlabEdge = source.userData.vx27SlabEdge;
  if (source.userData.vx27BaseColor?.isColor) {
    mat.userData.vx27BaseColor = source.userData.vx27BaseColor.clone();
  } else {
    mat.userData.vx27BaseColor = new THREE.Color(0xffffff);
  }
  if (floorInstance) {
    mat.userData.vx27ContainerFloorClone = true;
  }
  applyVx27MaterialSurface(mat, _materialTuning);
  return mat;
}

const CONTAINER_INTERIOR_MESH_NAMES = new Set([
  "vx27_container_interior_wall_left",
  "vx27_container_interior_wall_right",
  "vx27_container_interior_ceiling",
]);

/** @param {string} name */
function isVx27InteriorShellMesh(name) {
  return (
    CONTAINER_INTERIOR_MESH_NAMES.has(name) ||
    name.startsWith("vx27_container_interior_corner_")
  );
}

const CONTAINER_EXTERIOR_MESH_NAMES = new Set([
  "vx27_container_wall_left",
  "vx27_container_wall_right",
  "vx27_container_corner_arc",
  "vx27_container_roof",
  "vx27_container_floor",
  "vx27_container_endcap_front",
  "vx27_container_endcap_back",
  "vx27_container_interior_floor",
  "vx27_container_door_front_left",
  "vx27_container_door_front_right",
  "vx27_container_door_back_left",
  "vx27_container_door_back_right",
]);

/** @param {string} name */
function isVx27ExteriorShellMesh(name) {
  return (
    CONTAINER_EXTERIOR_MESH_NAMES.has(name) ||
    name.startsWith("vx27_container_endcap_") ||
    name.startsWith("vx27_container_corner_plug_")
  );
}

function faceMesh(width, height, material, name, options = {}) {
  const { castShadow = true, receiveShadow = true } = options;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/**
 * End-cap frame around the door opening — matches collider end slices so bolts can
 * pass through the opening instead of hitting a solid end-cap plane.
 * @param {THREE.Group} exterior
 * @param {"front" | "back"} endKey
 * @param {number} endcapHalfW
 * @param {number} endcapCenterY
 * @param {number} endcapH
 * @param {number} z
 * @param {number} rotationY
 * @param {ReturnType<typeof getVx27EndcapOpeningLocal>} opening
 * @param {THREE.Material} material
 */
function addVx27EndcapFrameMeshes(
  exterior,
  endKey,
  endcapHalfW,
  endcapCenterY,
  endcapH,
  z,
  rotationY,
  opening,
  material
) {
  const namePrefix = `vx27_container_endcap_${endKey}`;
  const frameShadow = { castShadow: false, receiveShadow: true };
  const faceHalfW = endcapHalfW;
  const endcapBottomY = endcapCenterY - endcapH / 2;
  const endcapTopY = endcapCenterY + endcapH / 2;

  if (opening.openLeft + faceHalfW > 0.004) {
    const panelW = opening.openLeft + faceHalfW;
    const panelCenterX = (-faceHalfW + opening.openLeft) / 2;
    const mesh = faceMesh(panelW, endcapH, material, `${namePrefix}_left`, frameShadow);
    mesh.position.set(panelCenterX, endcapCenterY, z);
    mesh.rotation.y = rotationY;
    mesh.renderOrder = 3;
    exterior.add(mesh);
  }

  if (faceHalfW - opening.openRight > 0.004) {
    const panelW = faceHalfW - opening.openRight;
    const panelCenterX = (opening.openRight + faceHalfW) / 2;
    const mesh = faceMesh(panelW, endcapH, material, `${namePrefix}_right`, frameShadow);
    mesh.position.set(panelCenterX, endcapCenterY, z);
    mesh.rotation.y = rotationY;
    mesh.renderOrder = 3;
    exterior.add(mesh);
  }

  if (opening.openBottomY - endcapBottomY > 0.004) {
    const panelH = opening.openBottomY - endcapBottomY;
    const mesh = faceMesh(
      opening.openHalfW * 2,
      panelH,
      material,
      `${namePrefix}_bottom`,
      frameShadow
    );
    mesh.position.set(opening.openCenterX, endcapBottomY + panelH / 2, z);
    mesh.rotation.y = rotationY;
    mesh.renderOrder = 3;
    exterior.add(mesh);
  }

  if (endcapTopY - opening.openTopY > 0.004) {
    const panelH = endcapTopY - opening.openTopY;
    const mesh = faceMesh(
      opening.openHalfW * 2,
      panelH,
      material,
      `${namePrefix}_top`,
      frameShadow
    );
    mesh.position.set(opening.openCenterX, opening.openTopY + panelH / 2, z);
    mesh.rotation.y = rotationY;
    mesh.renderOrder = 3;
    exterior.add(mesh);
  }
}

/**
 * Full end-cap quad — visual only; bullets use the separate frame slices.
 * @param {THREE.Group} exterior
 * @param {"front" | "back"} endKey
 * @param {"visual" | "interior"} layer
 * @param {number} endcapW
 * @param {number} endcapCenterY
 * @param {number} endcapH
 * @param {number} z
 * @param {number} rotationY
 * @param {THREE.Material} material
 */
function addVx27EndcapSolidShell(
  exterior,
  endKey,
  layer,
  endcapW,
  endcapCenterY,
  endcapH,
  z,
  rotationY,
  material
) {
  const mesh = faceMesh(
    endcapW,
    endcapH,
    material,
    `vx27_container_endcap_${endKey}_${layer}`,
    { castShadow: layer !== "visual", receiveShadow: true }
  );
  mesh.userData.skipBulletSurface = true;
  mesh.position.set(0, endcapCenterY, z);
  mesh.rotation.y = rotationY;
  mesh.renderOrder = 2;
  exterior.add(mesh);
}

/**
 * Door panel UVs — door texture on both faces, metre UVs on perimeter edges (corner_arc).
 * @param {THREE.BufferGeometry} geo
 * @param {number} width
 * @param {number} height
 * @param {number} thickness
 */
function applyDoorPanelUVs(geo, width, height, thickness) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const norm = geo.attributes.normal;
  const halfW = width / 2;
  const halfH = height / 2;
  const halfT = thickness / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);

    if (az >= ax && az >= ay) {
      uv.setXY(i, (x + halfW) / width, (y + halfH) / height);
      continue;
    }

    let uMeters;
    let vMeters;
    if (ay >= ax) {
      uMeters = x + halfW;
      vMeters = z + halfT;
    } else {
      uMeters = z + halfT;
      vMeters = y + halfH;
    }
    uv.setXY(i, uMeters, vMeters);
  }
  uv.needsUpdate = true;
}

/**
 * Door leaf profile — sharp hinge edge, rounded top/bottom corners on the opening edge only.
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @param {"left" | "right"} side
 */
function makeDoorLeafProfileShape(width, height, radius, side) {
  const halfW = width / 2;
  const halfH = height / 2;
  const r = Math.min(Math.max(0, radius), halfW * 0.48, halfH * 0.35);
  const shape = new THREE.Shape();

  if (side === "left") {
    shape.moveTo(-halfW, -halfH);
    shape.lineTo(-halfW, halfH);
    shape.lineTo(halfW - r, halfH);
    if (r > 1e-6) {
      shape.absarc(halfW - r, halfH - r, r, Math.PI / 2, 0, true);
    }
    shape.lineTo(halfW, -halfH + r);
    if (r > 1e-6) {
      shape.absarc(halfW - r, -halfH + r, r, 0, -Math.PI / 2, true);
    }
    shape.lineTo(-halfW, -halfH);
  } else {
    shape.moveTo(halfW, -halfH);
    shape.lineTo(halfW, halfH);
    shape.lineTo(-halfW + r, halfH);
    if (r > 1e-6) {
      shape.absarc(-halfW + r, halfH - r, r, Math.PI / 2, Math.PI, true);
    }
    shape.lineTo(-halfW, -halfH + r);
    if (r > 1e-6) {
      shape.absarc(-halfW + r, -halfH + r, r, -Math.PI / 2, -Math.PI, true);
    }
    shape.lineTo(halfW, -halfH);
  }
  shape.closePath();
  return shape;
}

/**
 * @param {THREE.BufferGeometry} geo
 * @param {number} width
 * @param {number} height
 */
function applyDoorExtrudedPanelUVs(geo, width, height) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const norm = geo.attributes.normal;
  const halfW = width / 2;
  const halfH = height / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);

    if (az >= ax && az >= ay && az > 0.5) {
      uv.setXY(i, (x + halfW) / width, (y + halfH) / height);
    } else {
      uv.setXY(i, x + halfW, y + halfH);
    }
  }
  uv.needsUpdate = true;
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} thickness
 * @param {number} openingEdgeRadius
 * @param {"left" | "right"} side
 */
function buildDoorExtrudedPanelGeometry(
  width,
  height,
  thickness,
  openingEdgeRadius,
  side
) {
  const shape = makeDoorLeafProfileShape(width, height, openingEdgeRadius, side);
  const curveSegments =
    openingEdgeRadius > 1e-6
      ? Math.min(8, Math.max(4, Math.ceil(openingEdgeRadius * 40)))
      : 1;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    steps: 1,
    curveSegments,
  });
  geo.translate(0, 0, -thickness / 2);
  applyDoorExtrudedPanelUVs(geo, width, height);
  // ExtrudeGeometry is non-indexed and already groups caps (0) vs side walls (1).
  return geo;
}

/**
 * Thin door leaf — door texture on both faces, corner_arc on the thin edge rim only.
 * Opening edge (away from hinge) gets rounded top/bottom corners when openingEdgeRadius > 0.
 * @param {number} width
 * @param {number} height
 * @param {number} thickness
 * @param {THREE.Material} faceMat
 * @param {THREE.Material} edgeMat
 * @param {"left" | "right"} side
 * @param {number} [openingEdgeRadius=0]
 */
function makeDoorPanelMesh(
  width,
  height,
  thickness,
  faceMat,
  edgeMat,
  side,
  openingEdgeRadius = 0
) {
  if (openingEdgeRadius > 1e-6) {
    const geo = buildDoorExtrudedPanelGeometry(
      width,
      height,
      thickness,
      openingEdgeRadius,
      side
    );
    const mesh = new THREE.Mesh(geo, [faceMat, edgeMat]);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return mesh;
  }

  const geo = new THREE.BoxGeometry(width, height, thickness);
  applyDoorPanelUVs(geo, width, height, thickness);
  const mesh = new THREE.Mesh(geo, [
    edgeMat,
    edgeMat,
    edgeMat,
    edgeMat,
    faceMat,
    faceMat,
  ]);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Solid shell panel (BoxGeometry) — same idea as arena / room wall slabs.
 * @param {number} sizeX
 * @param {number} sizeY
 * @param {number} sizeZ
 * @param {THREE.Material} material
 * @param {string} name
 * @param {{ castShadow?: boolean, receiveShadow?: boolean }} [options]
 */
function shellBoxMesh(sizeX, sizeY, sizeZ, material, name, options = {}) {
  const { castShadow = true, receiveShadow = true } = options;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sizeX, sizeY, sizeZ),
    material
  );
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

function applyContainerWorldAndRoomLayers(mesh, roomId) {
  setWorldLayer(mesh);
  if (roomId) {
    mesh.layers.enable(ROOM_INTERIOR_LAYER);
  }
}

/**
 * Exterior on WORLD (+ ROOM when in attached room). Interior shell on ROOM layer in
 * rooms, WORLD outdoors — same split as open oil barrels.
 * @param {THREE.Group} container
 * @param {string | null} [roomId]
 */
export function applyVx27ContainerRenderLayers(container, roomId = null) {
  container.traverse((obj) => {
    if (!obj.isMesh) return;

    if (isVx27ExteriorShellMesh(obj.name)) {
      applyContainerWorldAndRoomLayers(obj, roomId);
      if (obj.name === "vx27_container_interior_floor") {
        obj.renderOrder = 5;
      } else if (obj.name.startsWith("vx27_container_door_")) {
        obj.renderOrder = 4;
      } else {
        obj.renderOrder = 3;
      }
      return;
    }

    if (isVx27InteriorShellMesh(obj.name)) {
      if (roomId) setRoomInteriorLayer(obj);
      else setWorldLayer(obj);
      obj.castShadow = false;
      obj.receiveShadow = true;
      obj.renderOrder = 2;
    }
  });
}

/** @param {THREE.Object3D} root */
export function refreshVx27ContainerRenderLayers(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.name !== "vx27_container" || !obj.isGroup) return;
    applyVx27ContainerRenderLayers(obj, obj.userData.roomId ?? null);
  });
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} length
 * @param {number} shell
 * @param {Vx27InteriorInsets} insets
 * @param {number} [edgeRadius]
 */
function buildInteriorShell(width, height, length, shell, insets, edgeRadius = 0) {
  const r = normalizeVx27EdgeRadius(edgeRadius, width, height, length);
  const halfW = width / 2;
  const halfH = height / 2;
  const halfL = length / 2;
  const innerW = Math.max(0.05, width - insets.left - insets.right);
  const innerL = Math.max(0.05, length - insets.front - insets.back);
  const offsetX = (insets.right - insets.left) / 2;
  const offsetZ = (insets.back - insets.front) / 2;
  const baseFloorY = -halfH + shell + INTERIOR_INSET;
  const baseCeilY = halfH - shell - INTERIOR_INSET;
  const floorY = baseFloorY + insets.floorOffset;
  const ceilY = baseCeilY - insets.ceilingOffset;
  const innerH = Math.max(0.05, ceilY - floorY);
  const wallCenterY = (floorY + ceilY) * 0.5;

  const sideIntMat = buildMaterial("inside_wall", { surface: "interior" });
  const interiorFloorMat = buildMaterial("top_bottom", {
    floorDarken: true,
    rotateUV90: true,
    surface: "exterior",
  });

  const interior = new THREE.Group();
  interior.name = "vx27_container_interior";
  interior.userData.containerInterior = true;

  const wallThick = INTERIOR_WALL_THICKNESS;
  const floorThick = wallThick;
  const roofUndersideY = halfH - shell;
  const ceilThick = Math.max(
    wallThick,
    roofUndersideY - ceilY + CEILING_SHELL_OVERLAP
  );
  const sideWallL =
    r > 0.001 ? Math.max(0.05, innerL - 2 * r) : innerL;
  const sealOut = shell * 1.25 + (r > 0 ? r * 0.12 : 0);
  const ceilW = Math.min(innerW + 2 * sealOut, width - 2 * shell);
  const ceilL = Math.min(innerL + 2 * sealOut, length - 2 * shell);

  const inLeft = shellBoxMesh(
    wallThick,
    innerH,
    sideWallL,
    sideIntMat,
    "vx27_container_interior_wall_left",
    { castShadow: false, receiveShadow: true }
  );
  inLeft.position.set(-halfW + insets.left - wallThick / 2, wallCenterY, offsetZ);
  interior.add(inLeft);

  const inRight = shellBoxMesh(
    wallThick,
    innerH,
    sideWallL,
    sideIntMat,
    "vx27_container_interior_wall_right",
    { castShadow: false, receiveShadow: true }
  );
  inRight.position.set(halfW - insets.right + wallThick / 2, wallCenterY, offsetZ);
  interior.add(inRight);

  const inFloor = shellBoxMesh(
    innerW,
    floorThick,
    sideWallL,
    interiorFloorMat,
    "vx27_container_interior_floor",
    { castShadow: false, receiveShadow: true }
  );
  inFloor.position.set(
    offsetX,
    floorY - floorThick / 2,
    offsetZ
  );
  inFloor.material = cloneVx27ContainerMaterial(interiorFloorMat, {
    floorInstance: true,
  });
  inFloor.material.polygonOffset = true;
  inFloor.material.polygonOffsetFactor = 1;
  inFloor.material.polygonOffsetUnits = 1;
  interior.add(inFloor);

  const inCeiling = shellBoxMesh(
    ceilW,
    ceilThick,
    ceilL,
    sideIntMat,
    "vx27_container_interior_ceiling",
    { castShadow: false, receiveShadow: true }
  );
  inCeiling.position.set(
    offsetX,
    ceilY + ceilThick / 2,
    offsetZ
  );
  interior.add(inCeiling);

  if (r > 0.001) {
    const wing = Math.max(wallThick * 2.5, r * 0.9);
    const wingH = Math.max(wallThick, floorThick * 0.65);
    const wingY = floorY - wingH / 2;
    const innerFrontZ = offsetZ + sideWallL / 2;
    const innerBackZ = offsetZ - sideWallL / 2;
    const innerLeftX = offsetX - innerW / 2;
    const innerRightX = offsetX + innerW / 2;
    for (const { key, x, z } of [
      { key: "fl", x: innerLeftX + wing / 2, z: innerFrontZ - wing / 2 },
      { key: "fr", x: innerRightX - wing / 2, z: innerFrontZ - wing / 2 },
      { key: "br", x: innerRightX - wing / 2, z: innerBackZ + wing / 2 },
      { key: "bl", x: innerLeftX + wing / 2, z: innerBackZ + wing / 2 },
    ]) {
      const wingSeal = shellBoxMesh(
        wing,
        wingH,
        wing,
        sideIntMat,
        `vx27_container_interior_corner_${key}_floor`,
        { castShadow: false, receiveShadow: true }
      );
      wingSeal.position.set(x, wingY, z);
      interior.add(wingSeal);
    }
  }

  return interior;
}

/**
 * Arc-length + height UVs in world metres so corner-bevel repeat sliders tile
 * consistently on vertical strips and horizontal slab bevels.
 * @param {THREE.BufferGeometry} geo
 * @param {number} r
 * @param {number} height
 * @param {number} thetaStart
 * @param {number} thetaLength
 */
function applyVerticalCornerArcUVs(geo, r, height, thetaStart, thetaLength) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const halfH = height / 2;
  const twoPi = Math.PI * 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let theta = Math.atan2(x, z);
    let rel = theta - thetaStart;
    while (rel < 0) rel += twoPi;
    while (rel > twoPi) rel -= twoPi;
    if (rel > thetaLength) rel = thetaLength;
    const arcMeters = rel * r;
    const heightMeters = y + halfH;
    uv.setXY(i, arcMeters, heightMeters);
  }
  uv.needsUpdate = true;
}

/**
 * Open-ended quarter-cylinder for a visually rounded vertical edge.
 * No top/bottom caps — can never be coplanar with roof, floor, or wall faces.
 * @param {number} r  Corner radius (m)
 * @param {number} height  Cylinder height (m)
 * @param {number} thetaStart  Start angle — see (sin θ, cos θ) convention: 0 = +Z
 * @param {THREE.Material} mat
 * @param {string} name
 */
function makeVerticalCornerArc(r, height, thetaStart, mat, name) {
  const thetaLength = Math.PI / 2;
  const geo = new THREE.CylinderGeometry(r, r, height, 8, 1, true, thetaStart, thetaLength);
  applyVerticalCornerArcUVs(geo, r, height, thetaStart, thetaLength);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Solid quarter-cylinder — caps the open ends of {@link makeVerticalCornerArc} and
 * fills interior corner wedges so edge-radius shell gaps do not leak light.
 * @param {number} r
 * @param {number} height
 * @param {number} thetaStart
 * @param {THREE.Material} mat
 * @param {string} name
 * @param {{ castShadow?: boolean, receiveShadow?: boolean }} [options]
 */
function makeSolidCornerArcQuarter(r, height, thetaStart, mat, name, options = {}) {
  const { castShadow = false, receiveShadow = true } = options;
  const thetaLength = Math.PI / 2;
  const geo = new THREE.CylinderGeometry(
    r,
    r,
    height,
    10,
    1,
    false,
    thetaStart,
    thetaLength
  );
  applyVerticalCornerArcUVs(geo, r, height, thetaStart, thetaLength);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/** Corner arc sweep definitions — shared by exterior arcs and light-seal plugs. */
function vx27VerticalCornerDefs() {
  return [
    { key: "fl", thetaStart: (3 * Math.PI) / 2 },
    { key: "fr", thetaStart: 0 },
    { key: "br", thetaStart: Math.PI / 2 },
    { key: "bl", thetaStart: Math.PI },
  ];
}

/**
 * Rounded rectangle in local XZ footprint space, authored in XY for ExtrudeGeometry.
 * @param {number} width
 * @param {number} length
 * @param {number} radius
 */
function makeRoundedRectShape(width, length, radius) {
  const halfW = width / 2;
  const halfL = length / 2;
  const r = Math.min(Math.max(0, radius ?? 0), halfW, halfL);
  const shape = new THREE.Shape();

  if (r <= 1e-6) {
    shape.moveTo(-halfW, halfL);
    shape.lineTo(halfW, halfL);
    shape.lineTo(halfW, -halfL);
    shape.lineTo(-halfW, -halfL);
    shape.closePath();
    return shape;
  }

  shape.moveTo(-halfW + r, halfL);
  shape.lineTo(halfW - r, halfL);
  shape.absarc(halfW - r, halfL - r, r, Math.PI / 2, 0, true);
  shape.lineTo(halfW, -halfL + r);
  shape.absarc(halfW - r, -halfL + r, r, 0, -Math.PI / 2, true);
  shape.lineTo(-halfW + r, -halfL);
  shape.absarc(-halfW + r, -halfL + r, r, -Math.PI / 2, -Math.PI, true);
  shape.lineTo(-halfW, halfL - r);
  shape.absarc(-halfW + r, halfL - r, r, Math.PI, Math.PI / 2, true);
  shape.closePath();
  return shape;
}

/**
 * ExtrudeGeometry never assigns material groups — reorder indices so caps use
 * material 0 (top_bottom) and bevel/sides use material 1 (corner_arc).
 * @param {THREE.BufferGeometry} geo
 */
function splitSlabCapAndEdgeGroups(geo) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  if (!pos || !norm) return;

  const isCapVertex = (i) => {
    const ax = Math.abs(norm.getX(i));
    const ay = Math.abs(norm.getY(i));
    const az = Math.abs(norm.getZ(i));
    return ay >= ax && ay >= az;
  };

  /** @type {number[]} */
  const capIndices = [];
  /** @type {number[]} */
  const edgeIndices = [];

  for (let tri = 0; tri < pos.count; tri += 3) {
    const isCap =
      isCapVertex(tri) && isCapVertex(tri + 1) && isCapVertex(tri + 2);
    const target = isCap ? capIndices : edgeIndices;
    target.push(tri, tri + 1, tri + 2);
  }

  const totalIndexCount = capIndices.length + edgeIndices.length;
  if (totalIndexCount === 0) return;

  const IndexArray = totalIndexCount > 65535 ? Uint32Array : Uint16Array;
  const indices = new IndexArray(totalIndexCount);
  let offset = 0;
  for (const list of [capIndices, edgeIndices]) {
    for (let i = 0; i < list.length; i++) {
      indices[offset++] = list[i];
    }
  }

  geo.setIndex(
    capIndices.length + edgeIndices.length > 65535
      ? new THREE.Uint32BufferAttribute(indices, 1)
      : new THREE.Uint16BufferAttribute(indices, 1)
  );
  geo.clearGroups();
  if (capIndices.length > 0) geo.addGroup(0, capIndices.length, 0);
  if (edgeIndices.length > 0) {
    geo.addGroup(capIndices.length, edgeIndices.length, 1);
  }
}

/**
 * Rounded shell slab with planar top/bottom UVs and a beveled outer edge so the roof/floor
 * rolls down into the wall shell instead of reading as a flat overhanging plate.
 * @param {number} width
 * @param {number} length
 * @param {number} thickness
 * @param {number} radius
 * @param {THREE.Material | THREE.Material[]} material
 * @param {string} name
 * @param {{ capUvScale?: number, shell?: number }} [options]
 */
function makeRoundedFootprintSlab(width, length, thickness, radius, material, name, options = {}) {
  const capUvScale = Math.max(0.05, options.capUvScale ?? 1);
  const shell = options.shell ?? null;
  const shape = makeRoundedRectShape(width, length, radius);
  const curveSegments =
    radius > 0 ? Math.min(12, Math.max(6, Math.ceil(radius * 32))) : 1;
  const bevelCap = shell != null ? Math.max(0.001, shell * 0.38) : Infinity;
  const bevel = Math.min(
    Math.max(0.001, thickness * 0.45),
    radius > 0 ? radius : thickness * 0.45,
    bevelCap
  );
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: bevel > 0.0015,
    bevelSegments: 3,
    steps: 1,
    curveSegments,
    bevelThickness: bevel,
    bevelSize: bevel,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -thickness / 2, 0);
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const halfW = width / 2;
  const halfL = length / 2;
  const straightW = halfW - radius;
  const straightL = halfL - radius;
  const halfT = thickness / 2;

  const capUv = (x, z, bottomCap) => {
    const u = ((x + halfW) / width - 0.5) / capUvScale + 0.5;
    let v = ((z + halfL) / length - 0.5) / capUvScale + 0.5;
    if (bottomCap) v = 1 - v;
    return [u, v];
  };

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);
    const absX = Math.abs(x);
    const absZ = Math.abs(z);

    // Cap faces — top_bottom, one texture across the footprint.
    if (ay >= ax && ay >= az) {
      const [u, v] = capUv(x, z, ny < 0);
      uv.setXY(i, u, v);
      continue;
    }

    // Bevel faces — corner_arc edge texture, metre UVs for corner-bevel repeat sliders.
    let uMeters;
    const vMeters = halfT - y;
    if (radius > 1e-6 && absX >= straightW - 1e-4 && absZ >= straightL - 1e-4) {
      const cx = Math.sign(x || 1) * straightW;
      const cz = Math.sign(z || 1) * straightL;
      const relTheta = Math.atan2(x - cx, cz - z);
      uMeters = Math.max(0, relTheta) * radius;
    } else if (az >= ax) {
      uMeters = x + halfW;
    } else {
      uMeters = z + halfL;
    }
    uv.setXY(i, uMeters, vMeters);
  }
  uv.needsUpdate = true;
  if (Array.isArray(material) && material.length > 1) {
    splitSlabCapAndEdgeGroups(geo);
  }
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} length
 * @param {number} shell
 * @param {number} edgeRadius
 */
function buildExteriorShell(width, height, length, shell, edgeRadius, insets) {
  const r = normalizeVx27EdgeRadius(edgeRadius, width, height, length);
  const capUvScale = Math.max(
    0.05,
    _materialTuning.roofFloorFootprintScale ?? 1
  );
  // Full shell footprint for geometry — roofFloorFootprintScale adjusts cap UV only.
  const slabW = width;
  const slabL = length;
  const slabR = r;
  const halfW = width / 2;
  const halfH = height / 2;
  const halfL = length / 2;
  const roofVisualThickness =
    r > 0 ? Math.max(shell, Math.min(shell * 3, shell + r * 0.35)) : shell;

  const wallL = r > 0 ? length - 2 * r : length;
  const endcapW = Math.max(0.05, r > 0 ? width - 2 * r : width);

  const sideExtMat = buildMaterial("side", { surface: "exterior" });
  const cornerArcMat = buildMaterial("corner_arc", { surface: "exterior" });
  const slabEdgeMat = buildMaterial("corner_arc", { surface: "exterior", slabEdge: true });
  const capExtMat = buildMaterial("top_bottom", {
    rotateUV90: true,
    surface: "exterior",
    shellFloor: true,
  });
  const endcapMat = buildMaterial("endcap_square", {
    transparent: false,
    alphaTest: 0.5,
    surface: "exterior",
    doubleSided: true,
  });

  const exterior = new THREE.Group();
  exterior.name = "vx27_container_exterior";

  const floorBottomY = -halfH - EXTERIOR_FLOOR_GROUND_BIAS;
  const wallBottomY = floorBottomY;
  const wallTopY = halfH - roofVisualThickness;
  const wallBodyH = Math.max(0.05, wallTopY - wallBottomY);
  const wallBodyY = (wallTopY + wallBottomY) / 2;
  const endcapH = Math.max(0.05, roofVisualThickness > 0 ? height - roofVisualThickness - shell : height);
  const endcapY = (-halfH + shell + (halfH - roofVisualThickness)) / 2;

  // Side walls own the mid-height span; roof/floor slabs own the top/bottom shell band so the
  // rounded footprint can extend across the visible roof/floor exterior without fighting.
  const leftExt = shellBoxMesh(shell, wallBodyH, wallL, sideExtMat, "vx27_container_wall_left");
  leftExt.position.set(-halfW + shell / 2, wallBodyY, 0);
  exterior.add(leftExt);

  const rightExt = shellBoxMesh(shell, wallBodyH, wallL, sideExtMat, "vx27_container_wall_right");
  rightExt.position.set(halfW - shell / 2, wallBodyY, 0);
  exterior.add(rightExt);

  const roofExt = makeRoundedFootprintSlab(
    slabW,
    slabL,
    roofVisualThickness,
    slabR,
    [capExtMat, slabEdgeMat],
    "vx27_container_roof",
    { capUvScale, shell }
  );
  roofExt.position.set(0, halfH - roofVisualThickness / 2, 0);
  exterior.add(roofExt);

  const floorExt = makeRoundedFootprintSlab(
    slabW,
    slabL,
    shell,
    slabR,
    [capExtMat, slabEdgeMat],
    "vx27_container_floor",
    { capUvScale, shell }
  );
  floorExt.position.set(0, floorBottomY + shell / 2, 0);
  exterior.add(floorExt);

  // End caps: full visual shell + bullet frame + inner liner (front and back identical layout).
  const opening = getVx27EndcapOpeningLocal(width, height, length, shell, insets);
  const endInset = shell * 0.02;
  /** @type {const} */
  const endCapDefs = [
    {
      key: "front",
      outerZ: halfL + shell / 2,
      innerZ: halfL - shell / 2,
      outerRot: 0,
      innerRot: Math.PI,
      visualZ: halfL + shell / 2 - endInset,
    },
    {
      key: "back",
      outerZ: -halfL - shell / 2,
      innerZ: -halfL + shell / 2,
      outerRot: Math.PI,
      innerRot: 0,
      visualZ: -halfL - shell / 2 + endInset,
    },
  ];

  for (const end of endCapDefs) {
    addVx27EndcapSolidShell(
      exterior,
      end.key,
      "visual",
      endcapW,
      endcapY,
      endcapH,
      end.visualZ,
      end.outerRot,
      endcapMat
    );
    addVx27EndcapFrameMeshes(
      exterior,
      end.key,
      endcapW / 2,
      endcapY,
      endcapH,
      end.outerZ,
      end.outerRot,
      opening,
      endcapMat
    );
    addVx27EndcapSolidShell(
      exterior,
      end.key,
      "interior",
      endcapW,
      endcapY,
      endcapH,
      end.innerZ,
      end.innerRot,
      endcapMat
    );
  }

  // Vertical corner arcs bridge side walls to the trimmed end-cap span.
  if (r > 0) {
    const cornerCenters = [
      { key: "fl", x: -halfW + r, z: halfL - r },
      { key: "fr", x: halfW - r, z: halfL - r },
      { key: "br", x: halfW - r, z: -halfL + r },
      { key: "bl", x: -halfW + r, z: -halfL + r },
    ];
    for (const corner of cornerCenters) {
      const def = vx27VerticalCornerDefs().find((d) => d.key === corner.key);
      if (!def) continue;
      const arc = makeVerticalCornerArc(
        r,
        wallBodyH,
        def.thetaStart,
        cornerArcMat,
        "vx27_container_corner_arc"
      );
      arc.position.set(corner.x, wallBodyY, corner.z);
      exterior.add(arc);
    }
  }

  return exterior;
}

/**
 * @param {THREE.Group} group
 * @param {number} width
 * @param {number} height
 * @param {number} length
 * @param {number} shell
 * @param {Vx27InteriorInsets} insets
 * @param {number} edgeRadius
 * @param {import("./Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning} [doorTuning]
 */
function buildDoors(group, width, height, length, shell, insets, edgeRadius, doorTuning) {
  const layout = computeVx27DoorLayout(
    width,
    height,
    length,
    shell,
    insets,
    edgeRadius,
    doorTuning
  );

  const doorMat = buildMaterial("door", {
    transparent: true,
    alphaTest: 0.5,
    surface: "exterior",
    doubleSided: true,
  });
  const doorMirrorMat = buildMaterial("door", {
    transparent: true,
    alphaTest: 0.5,
    mirrorU: true,
    surface: "exterior",
    doubleSided: true,
  });
  const doorEdgeMat = buildMaterial("corner_arc", {
    surface: "exterior",
    doubleSided: true,
  });

  const doors = new THREE.Group();
  doors.name = "vx27_container_doors";

  for (const end of layout.ends) {
    for (const leaf of end.leaves) {
      const pivot = new THREE.Group();
      pivot.name = `vx27_container_door_${end.key}_${leaf.side}_pivot`;
      pivot.position.set(leaf.hingeX, layout.doorCenterY, end.pivotZ);
      pivot.rotation.y = leaf.pivotRotY;

      const faceMat = leaf.side === "left" ? doorMat : doorMirrorMat;
      const panel = makeDoorPanelMesh(
        layout.leafW,
        layout.leafH,
        layout.thickness,
        faceMat,
        doorEdgeMat,
        leaf.side,
        layout.openingEdgeRadius
      );
      panel.name = `vx27_container_door_${end.key}_${leaf.side}`;
      panel.position.set(leaf.panelOffsetX, 0, leaf.panelOffsetZ);
      pivot.add(panel);
      doors.add(pivot);
    }
  }

  group.add(doors);
  invalidateVx27DoorInteractMeshes(group);
  return layout;
}

/** @param {THREE.Group} group @param {{ preferTarget?: boolean }} [options] @returns {import("./Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning} */
export function readVx27ContainerDoorTuning(group, options = {}) {
  const anim = group.userData.vx27DoorAnim;
  const base = group.userData.vx27DoorTuning ?? DEFAULT_VX27_CONTAINER_DOOR_TUNING;
  if (!anim) {
    return normalizeVx27ContainerDoorTuning(base);
  }
  const openSource =
    options.preferTarget && anim.active ? anim.target : anim.current;
  return normalizeVx27ContainerDoorTuning({
    ...base,
    frontLeftOpen: openSource.frontLeftOpen,
    frontRightOpen: openSource.frontRightOpen,
    backLeftOpen: openSource.backLeftOpen,
    backRightOpen: openSource.backRightOpen,
  });
}

/**
 * @param {THREE.Group} group
 * @param {Partial<import("./Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning>} doorTuning
 * @returns {import("./Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning}
 */
export function rebuildVx27ContainerDoors(group, doorTuning) {
  const width = group.userData.vx27Width ?? VX27_CONTAINER_WIDTH;
  const height = group.userData.vx27Height ?? VX27_CONTAINER_HEIGHT;
  const length = group.userData.vx27Length ?? VX27_CONTAINER_LENGTH;
  const insets = normalizeVx27InteriorInsets(group.userData.vx27InteriorInsets);
  const edgeRadius = readVx27ContainerEdgeRadius(group);
  const shell = vx27ShellThicknessForGroup(group);
  const normalized = normalizeVx27ContainerDoorTuning({
    ...readVx27ContainerDoorTuning(group),
    ...doorTuning,
  });

  const oldDoors = group.getObjectByName("vx27_container_doors");
  if (oldDoors) {
    disposeContainerSubtree(oldDoors);
    group.remove(oldDoors);
  }

  buildDoors(group, width, height, length, shell, insets, edgeRadius, normalized);
  group.userData.vx27DoorTuning = normalized;
  initVx27ContainerDoorAnim(group, normalized);
  applyVx27ContainerRenderLayers(group, group.userData.roomId ?? null);
  setVx27ContainerMaterialTuning(_materialTuning, group);
  return normalized;
}

/**
 * Update door fit or open angles. Geometry changes rebuild meshes; open angles animate.
 * @param {THREE.Group} group
 * @param {Partial<import("./Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning>} doorPatch
 * @param {{ animate?: boolean }} [options]
 * @returns {import("./Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning}
 */
export function applyVx27ContainerDoorTuning(group, doorPatch, options = {}) {
  if (vx27DoorPatchChangesGeometry(doorPatch)) {
    return rebuildVx27ContainerDoors(group, doorPatch);
  }
  if (Object.keys(doorPatch).length > 0) {
    setVx27ContainerDoorOpenTargets(group, doorPatch, {
      animate: options.animate ?? true,
    });
  }
  return readVx27ContainerDoorTuning(group);
}

export {
  updateVx27ContainerDoorAnimations,
  consumeVx27DoorColliderDirty,
  initVx27ContainerDoorAnim,
  VX27_DOOR_OPEN_SMOOTH,
  VX27_DOOR_OPEN_SPEED_DEG,
} from "./Vx27ContainerDoorAnimation.js";

export { computeVx27DoorLayout } from "./Vx27ContainerDoors.js";

/**
 * @param {THREE.Group} group
 * @param {number} width
 * @param {number} height
 * @param {number} length
 * @param {number} shell
 * @param {Vx27InteriorInsets} insets
 * @param {number} edgeRadius
 */
function buildShell(group, width, height, length, shell, insets, edgeRadius = 0, doorTuning) {
  group.add(buildExteriorShell(width, height, length, shell, edgeRadius, insets));
  group.add(buildInteriorShell(width, height, length, shell, insets, edgeRadius));
  buildDoors(group, width, height, length, shell, insets, edgeRadius, doorTuning);
}

/** @param {THREE.Group} group */
function removeVx27ContainerShell(group) {
  for (const name of [
    "vx27_container_exterior",
    "vx27_container_interior",
    "vx27_container_doors",
  ]) {
    const old = group.getObjectByName(name);
    if (!old) continue;
    disposeContainerSubtree(old);
    group.remove(old);
  }
}

/** @param {THREE.Group} group @returns {number} */
function vx27ShellThicknessForGroup(group) {
  const scale = group.userData.vx27Scale ?? VX27_CONTAINER_SCALE_DEFAULT;
  return VX27_SHELL_THICKNESS * normalizeVx27ContainerScale(scale);
}

/**
 * Rebuild exterior shell and doors after edge-radius tuning.
 * @param {THREE.Group} group
 * @param {number} [edgeRadius]
 * @returns {number}
 */
export function rebuildVx27ContainerExterior(group, edgeRadius) {
  const width = group.userData.vx27Width ?? VX27_CONTAINER_WIDTH;
  const height = group.userData.vx27Height ?? VX27_CONTAINER_HEIGHT;
  const length = group.userData.vx27Length ?? VX27_CONTAINER_LENGTH;
  const normalized = normalizeVx27EdgeRadius(
    edgeRadius ?? group.userData.vx27EdgeRadius,
    width,
    height,
    length
  );

  const oldExterior = group.getObjectByName("vx27_container_exterior");
  if (oldExterior) {
    disposeContainerSubtree(oldExterior);
    group.remove(oldExterior);
  }
  const oldDoors = group.getObjectByName("vx27_container_doors");
  if (oldDoors) {
    disposeContainerSubtree(oldDoors);
    group.remove(oldDoors);
  }

  const shell = vx27ShellThicknessForGroup(group);
  group.add(
    buildExteriorShell(
      width,
      height,
      length,
      shell,
      normalized,
      normalizeVx27InteriorInsets(group.userData.vx27InteriorInsets)
    )
  );
  buildDoors(
    group,
    width,
    height,
    length,
    shell,
    normalizeVx27InteriorInsets(group.userData.vx27InteriorInsets),
    normalized,
    readVx27ContainerDoorTuning(group)
  );

  group.userData.vx27EdgeRadius = normalized;

  const oldInterior = group.getObjectByName("vx27_container_interior");
  if (oldInterior) {
    disposeContainerSubtree(oldInterior);
    group.remove(oldInterior);
  }
  group.add(
    buildInteriorShell(
      width,
      height,
      length,
      shell,
      normalizeVx27InteriorInsets(group.userData.vx27InteriorInsets),
      normalized
    )
  );

  applyVx27ContainerRenderLayers(group, group.userData.roomId ?? null);
  setVx27ContainerMaterialTuning(_materialTuning, group);
  return normalized;
}

/** @param {THREE.Group} group @returns {number} */
export function readVx27ContainerEdgeRadius(group) {
  const width = group.userData.vx27Width ?? VX27_CONTAINER_WIDTH;
  const height = group.userData.vx27Height ?? VX27_CONTAINER_HEIGHT;
  const length = group.userData.vx27Length ?? VX27_CONTAINER_LENGTH;
  return normalizeVx27EdgeRadius(group.userData.vx27EdgeRadius, width, height, length);
}

/** @param {THREE.Group} group @returns {number} */
export function readVx27ContainerExteriorCornerRadius(group) {
  const width = group.userData.vx27Width ?? VX27_CONTAINER_WIDTH;
  const length = group.userData.vx27Length ?? VX27_CONTAINER_LENGTH;
  return normalizeVx27ExteriorCornerRadius(
    group.userData.vx27ExteriorCornerRadius,
    width,
    length
  );
}

/**
 * Collision-only exterior corner radius (no mesh rebuild).
 * @param {THREE.Group} group
 * @param {number} radius
 * @returns {number}
 */
export function setVx27ContainerExteriorCornerRadius(group, radius) {
  const width = group.userData.vx27Width ?? VX27_CONTAINER_WIDTH;
  const length = group.userData.vx27Length ?? VX27_CONTAINER_LENGTH;
  const normalized = normalizeVx27ExteriorCornerRadius(radius, width, length);
  group.userData.vx27ExteriorCornerRadius = normalized;
  return normalized;
}

/**
 * Rebuild the interior shell after inset tuning.
 * @param {THREE.Group} group
 * @param {Partial<Vx27InteriorInsets>} insets
 * @returns {Vx27InteriorInsets}
 */
export function rebuildVx27ContainerInterior(group, insets) {
  const normalized = normalizeVx27InteriorInsets(
    insets ?? group.userData.vx27InteriorInsets
  );
  const old = group.getObjectByName("vx27_container_interior");
  if (old) {
    disposeContainerSubtree(old);
    group.remove(old);
  }
  const width = group.userData.vx27Width ?? VX27_CONTAINER_WIDTH;
  const height = group.userData.vx27Height ?? VX27_CONTAINER_HEIGHT;
  const length = group.userData.vx27Length ?? VX27_CONTAINER_LENGTH;
  const shell = vx27ShellThicknessForGroup(group);
  const edgeRadius = readVx27ContainerEdgeRadius(group);
  group.add(
    buildInteriorShell(width, height, length, shell, normalized, edgeRadius)
  );
  group.userData.vx27InteriorInsets = normalized;
  rebuildVx27ContainerDoors(group);
  applyVx27ContainerRenderLayers(group, group.userData.roomId ?? null);
  setVx27ContainerMaterialTuning(_materialTuning, group);
  return normalized;
}

/** @param {THREE.Group} group @returns {Vx27InteriorInsets} */
export function readVx27ContainerInteriorInsets(group) {
  return normalizeVx27InteriorInsets(group.userData.vx27InteriorInsets);
}

/**
 * Rebuild all shell geometry after uniform scale change (floor Y stays fixed).
 * @param {THREE.Group} group
 * @param {number} [scale]
 * @returns {number}
 */
export function rebuildVx27ContainerScale(group, scale) {
  const normalized = normalizeVx27ContainerScale(
    scale ?? group.userData.vx27Scale
  );
  const dims = resolveVx27ContainerDimensions(normalized);
  const floorY =
    group.position.y - (group.userData.vx27Height ?? VX27_CONTAINER_HEIGHT) / 2;
  const insets = normalizeVx27InteriorInsets(group.userData.vx27InteriorInsets);
  const edgeRadius = normalizeVx27EdgeRadius(
    group.userData.vx27EdgeRadius,
    dims.width,
    dims.height,
    dims.length
  );

  removeVx27ContainerShell(group);
  buildShell(
    group,
    dims.width,
    dims.height,
    dims.length,
    dims.shell,
    insets,
    edgeRadius,
    readVx27ContainerDoorTuning(group)
  );

  group.userData.vx27Scale = normalized;
  group.userData.vx27Width = dims.width;
  group.userData.vx27Height = dims.height;
  group.userData.vx27Length = dims.length;
  group.userData.vx27EdgeRadius = edgeRadius;
  group.position.y = floorY + dims.height / 2;

  applyVx27ContainerRenderLayers(group, group.userData.roomId ?? null);
  setVx27ContainerMaterialTuning(_materialTuning, group);
  return normalized;
}

/** @param {THREE.Group} group @returns {number} */
export function readVx27ContainerScale(group) {
  return normalizeVx27ContainerScale(group.userData.vx27Scale);
}

/**
 * @typedef {{
 *   cx: number,
 *   cz: number,
 *   rotY: number,
 *   halfW: number,
 *   halfL: number,
 *   playHalfW: number,
 *   playHalfL: number,
 *   innerHalfW: number,
 *   innerHalfL: number,
 *   openHalfW: number,
 *   openCenterX: number,
 * }} Vx27ContainerStandoffSpec
 */

/** @param {import("../physics/Collision.js").ColliderBox[]} colliders @returns {Vx27ContainerStandoffSpec[]} */
export function extractVx27ContainerStandoffSpecs(colliders) {
  /** @type {Map<string, Vx27ContainerStandoffSpec>} */
  const map = new Map();
  for (const box of colliders) {
    if (box.kind !== "vx27ContainerWall" || box.active === false) continue;
    if (box.containerCx == null || box.containerHalfW == null) continue;
    const key =
      box.propId ??
      `${box.containerCx}|${box.containerCz}|${box.rotationY ?? 0}`;
    const next = {
      cx: box.containerCx,
      cz: box.containerCz,
      rotY: box.rotationY ?? 0,
      halfW: box.containerHalfW,
      halfL: box.containerHalfL,
      playHalfW: box.containerPlayHalfW,
      playHalfL:
        box.containerPlayHalfL ??
        (box.containerInnerHalfL ?? box.containerHalfL) - WALL_STANDOFF,
      innerHalfW:
        box.containerInnerHalfW ?? box.containerHalfW - VX27_SHELL_THICKNESS,
      innerHalfL: box.containerInnerHalfL ?? box.containerHalfL,
      openHalfW: box.containerOpenHalfW ?? 0,
      openCenterX: box.containerOpenCenterX ?? 0,
      offsetZ: box.containerOffsetZ ?? 0,
    };
    const existing = map.get(key);
    if (!existing) {
      map.set(key, next);
      continue;
    }
    for (const field of Object.keys(next)) {
      if (next[field] != null) existing[field] = next[field];
    }
  }
  return [...map.values()];
}

/** @param {Vx27ContainerStandoffSpec} spec @param {number} localX @param {number} localZ */
function vx27InEndDoorOpening(spec, localX, localZ) {
  const { halfL, openHalfW, openCenterX } = spec;
  if (!openHalfW) return false;
  const margin = 0.08;
  if (Math.abs(localX - openCenterX) > openHalfW + margin) return false;
  return localZ > halfL - 0.25 || localZ < -halfL + 0.25;
}

/**
 * Arena-style standoff in container-local axes — same clearance at any yaw.
 * @param {{ x: number, z: number }} position
 * @param {number} radius
 * @param {Vx27ContainerStandoffSpec} spec
 */
function clampVx27ContainerStandoff(position, radius, spec) {
  const { cx, cz, rotY, halfW, halfL, playHalfW, playHalfL, openHalfW, openCenterX } =
    spec;
  const r = radius;
  const standoff = WALL_STANDOFF;

  const { lx: origLx, lz: origLz } = worldToContainerLocal(
    cx,
    cz,
    rotY,
    position.x,
    position.z
  );

  const reachX = halfW + standoff + r;
  const reachZ = halfL + standoff + r;
  const nearLx = THREE.MathUtils.clamp(origLx, -reachX, reachX);
  const nearLz = THREE.MathUtils.clamp(origLz, -reachZ, reachZ);
  const outsideDistSq =
    (origLx - nearLx) * (origLx - nearLx) +
    (origLz - nearLz) * (origLz - nearLz);
  if (outsideDistSq > 1.0) return;

  let lx = origLx;
  let lz = origLz;
  const door = vx27InEndDoorOpening(spec, lx, lz);

  const inPlayX = Math.max(0.05, playHalfW - r);
  const inPlayZ = Math.max(0.05, playHalfL - r);
  const insidePlay =
    Math.abs(lx) <= inPlayX + 0.01 && Math.abs(lz) <= inPlayZ + 0.01;

  if (insidePlay) {
    lx = THREE.MathUtils.clamp(lx, -inPlayX, inPlayX);
    if (!door) {
      lz = THREE.MathUtils.clamp(lz, -inPlayZ, inPlayZ);
    }
  } else {
    // Exterior standoff — per axis only when outside the outer shell on that axis.
    // Shell-band blocking is left to the oriented box colliders.
    if (lx > halfW) lx = Math.max(lx, halfW + standoff + r);
    else if (lx < -halfW) lx = Math.min(lx, -halfW - standoff - r);

    if (!door) {
      if (lz > halfL) lz = Math.max(lz, halfL + standoff + r);
      else if (lz < -halfL) lz = Math.min(lz, -halfL - standoff - r);
    } else if (lz > halfL) {
      if (Math.abs(lx - openCenterX) > openHalfW + r) {
        lz = Math.max(lz, halfL + standoff + r);
      } else if (Math.abs(lx - openCenterX) > openHalfW - 0.05) {
        lx = THREE.MathUtils.clamp(
          lx,
          openCenterX - openHalfW + r,
          openCenterX + openHalfW - r
        );
      }
    } else if (lz < -halfL) {
      if (Math.abs(lx - openCenterX) > openHalfW + r) {
        lz = Math.min(lz, -halfL - standoff - r);
      } else if (Math.abs(lx - openCenterX) > openHalfW - 0.05) {
        lx = THREE.MathUtils.clamp(
          lx,
          openCenterX - openHalfW + r,
          openCenterX + openHalfW - r
        );
      }
    }
  }

  if (Math.abs(lx - origLx) < 1e-6 && Math.abs(lz - origLz) < 1e-6) return;

  const world = localToWorldXZ(cx, cz, rotY, lx, lz);
  position.x = world.x;
  position.z = world.z;
}

/**
 * @param {{ x: number, z: number }} position
 * @param {number} radius
 * @param {import("../physics/Collision.js").ColliderBox[]} colliders
 */
export function resolveVx27ContainerStandoffs(position, radius, colliders) {
  for (const spec of extractVx27ContainerStandoffSpecs(colliders)) {
    clampVx27ContainerStandoff(position, radius, spec);
  }
}

/**
 * @param {import("../physics/Collision.js").ColliderBox} box
 * @param {number} worldX
 * @param {number} worldZ
 * @param {number | null} [footY]
 */
export function shouldSkipVx27ContainerCollider(box, worldX, worldZ, footY = null) {
  if (box.kind !== "vx27ContainerWall" || !box.containerPart) return false;
  const part = box.containerPart;

  if (part !== "floor" && part !== "roof" && part !== "interiorCeiling") {
    return false;
  }

  const cx = box.containerCx;
  const cz = box.containerCz;
  const halfW = box.containerHalfW;
  const halfL = box.containerHalfL;

  if (cx == null || cz == null || halfW == null || halfL == null) {
    return false;
  }

  const rotY = box.rotationY ?? 0;
  const { lx: localX, lz: localZ } = worldToContainerLocal(
    cx,
    cz,
    rotY,
    worldX,
    worldZ
  );

  const m = 0.05;
  const openHalfW = box.containerOpenHalfW ?? halfW * 0.98;
  const innerHalfL = box.containerInnerHalfL ?? halfL;

  if (part === "floor") {
    if (
      footY != null &&
      box.topY != null &&
      footY < box.topY - 0.12
    ) {
      return true;
    }
    return Math.abs(localX) > openHalfW + m || Math.abs(localZ) > innerHalfL + m;
  }

  if (part === "roof") {
    if (
      footY != null &&
      box.bottomY != null &&
      footY + 2.2 < box.bottomY
    ) {
      return true;
    }
    if ((box.exteriorCornerRadius ?? 0) > 0) {
      return !pointInVx27ExteriorColliderFootprint(box, worldX, worldZ, m);
    }
    const edgeR = box.containerEdgeRadius ?? 0;
    const reachW = halfW - edgeR + m;
    const reachL = halfL - edgeR + m;
    return Math.abs(localX) > reachW || Math.abs(localZ) > reachL;
  }

  return Math.abs(localX) > openHalfW + m || Math.abs(localZ) > innerHalfL + m;
}

/** Only the exterior roof blocks headroom for now. */
export function shouldSkipVx27ContainerHeadroom(box, worldX, worldZ, footY = null) {
  if (box.kind !== "vx27ContainerWall" || !box.containerPart) return false;
  if (box.containerPart === "roof") {
    return shouldSkipVx27ContainerCollider(box, worldX, worldZ, footY);
  }
  return true;
}

/**
 * @param {number} cx
 * @param {number} cz
 * @param {number} rotY
 * @param {number} lx
 * @param {number} lz
 */
/** Container-local XZ → world; matches Three.js Y-rotation and {@link worldToBoxLocal}. */
function localToWorldXZ(cx, cz, rotY, lx, lz) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return {
    x: cx + c * lx + s * lz,
    z: cz + -s * lx + c * lz,
  };
}

/** World XZ → container-local; inverse of {@link localToWorldXZ}. */
function worldToContainerLocal(cx, cz, rotY, worldX, worldZ) {
  const dx = worldX - cx;
  const dz = worldZ - cz;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return {
    lx: c * dx - s * dz,
    lz: s * dx + c * dz,
  };
}

/**
 * Interior walk volume — matches floor collider footprint and play bounds.
 * Used for viewmodel lighting (dim enclosed fill, no outdoor sun on the gun).
 *
 * @param {number} worldX
 * @param {number} worldZ
 * @param {import("../physics/Collision.js").ColliderBox[]} colliders
 */
export function isPointInsideVx27ContainerPlayVolume(worldX, worldZ, colliders) {
  for (const box of colliders) {
    if (box.kind !== "vx27ContainerWall" || box.active === false) continue;
    if (box.containerPart !== "floor") continue;
    if (box.x == null || box.z == null || box.halfX == null || box.halfZ == null) {
      continue;
    }
    const pad = 0.08;
    if (
      worldX >= box.x - box.halfX - pad &&
      worldX <= box.x + box.halfX + pad &&
      worldZ >= box.z - box.halfZ - pad &&
      worldZ <= box.z + box.halfZ + pad
    ) {
      return true;
    }
  }

  for (const spec of extractVx27ContainerStandoffSpecs(colliders)) {
    const { lx, lz } = worldToContainerLocal(
      spec.cx,
      spec.cz,
      spec.rotY,
      worldX,
      worldZ
    );
    const relX = lx - (spec.openCenterX ?? 0);
    const relZ = lz - (spec.offsetZ ?? 0);
    const inPlayX = Math.max(0.05, spec.playHalfW ?? 0.05);
    const inPlayZ = Math.max(0.05, spec.playHalfL ?? 0.05);
    if (Math.abs(relX) <= inPlayX + 0.01 && Math.abs(relZ) <= inPlayZ + 0.01) {
      return true;
    }
  }
  return false;
}

/**
 * Door opening in container-local space (origin = container center).
 * @param {number} width
 * @param {number} height
 * @param {number} length
 * @param {number} shell
 * @param {Partial<Vx27InteriorInsets>} [insets]
 */
function getVx27EndcapOpeningLocal(width, height, length, shell, insets) {
  const n = normalizeVx27InteriorInsets(insets);
  const halfH = height / 2;
  const openHalfW = Math.max(0.025, (width - n.left - n.right) / 2);
  const openCenterX = (n.right - n.left) / 2;
  const openBottomY = -halfH + shell + INTERIOR_INSET + n.floorOffset;
  const openTopY = halfH - shell - INTERIOR_INSET - n.ceilingOffset;
  const innerHalfL = Math.max(0.025, (length - n.front - n.back) / 2);
  const offsetZ = (n.back - n.front) / 2;
  return {
    openHalfW,
    openCenterX,
    openLeft: openCenterX - openHalfW,
    openRight: openCenterX + openHalfW,
    openBottomY,
    openTopY,
    innerHalfL,
    offsetZ,
  };
}

/**
 * Walk-through opening on front/back end caps — matches interior shell clearance.
 * @param {number} width
 * @param {number} height
 * @param {number} shell
 * @param {number} baseY Container floor (world).
 * @param {Partial<Vx27InteriorInsets>} [insets]
 */
function getVx27EndcapOpening(width, height, length, shell, baseY, insets) {
  const local = getVx27EndcapOpeningLocal(width, height, length, shell, insets);
  const centerY = baseY + height / 2;
  return {
    ...local,
    openBottomY: centerY + local.openBottomY,
    openTopY: centerY + local.openTopY,
  };
}

/**
 * Exterior roof slab — matches `vx27_container_roof` shell mesh.
 * @param {{
 *   x: number,
 *   z: number,
 *   floorY: number,
 *   rotationY?: number,
 *   width?: number,
 *   height?: number,
 *   length?: number,
 *   scale?: number,
 *   propId?: string | null,
 *   edgeRadius?: number,
 *   exteriorCornerRadius?: number,
 * }} spec
 * @returns {import("../physics/Collision.js").ColliderBox}
 */
function buildVx27ContainerRoofCollider(spec) {
  const scale = normalizeVx27ContainerScale(spec.scale ?? VX27_CONTAINER_SCALE_DEFAULT);
  const width = spec.width ?? VX27_CONTAINER_WIDTH * scale;
  const height = spec.height ?? VX27_CONTAINER_HEIGHT * scale;
  const length = spec.length ?? VX27_CONTAINER_LENGTH * scale;
  const shell = VX27_SHELL_THICKNESS * scale;
  const baseY = spec.floorY;
  const rotY = spec.rotationY ?? 0;
  const edgeR = normalizeVx27EdgeRadius(spec.edgeRadius, width, height, length);
  const cornerR = resolveVx27ExteriorCornerRadius(spec, width, height, length);
  const halfW = width / 2;
  const halfL = length / 2;
  const cx = spec.x;
  const cz = spec.z;
  const roofCenter = localToWorldXZ(cx, cz, rotY, 0, 0);
  const rounded = vx27ExteriorFootprintHalfExtents(halfW, halfL, edgeR, cornerR);

  /** @type {import("../physics/Collision.js").ColliderBox} */
  const collider = {
    propId: spec.propId ?? null,
    rotationY: rotY,
    active: true,
    kind: "vx27ContainerWall",
    containerPart: "roof",
    containerCx: cx,
    containerCz: cz,
    containerHalfW: halfW,
    containerHalfL: halfL,
    x: roofCenter.x,
    z: roofCenter.z,
    halfX: rounded.halfX,
    halfZ: rounded.halfZ,
    cornerRadius: rounded.cornerRadius,
    bottomY: baseY + height - shell - VX27_ROOF_HEADROOM_MARGIN,
    topY: baseY + height,
  };
  vx27ColliderFootprintMeta(collider, edgeR, cornerR);
  return collider;
}

/**
 * Exterior left side wall — matches `vx27_container_wall_left` shell mesh.
 * @param {{
 *   x: number,
 *   z: number,
 *   floorY: number,
 *   rotationY?: number,
 *   width?: number,
 *   height?: number,
 *   length?: number,
 *   scale?: number,
 *   propId?: string | null,
 *   edgeRadius?: number,
 *   exteriorCornerRadius?: number,
 * }} spec
 * @returns {import("../physics/Collision.js").ColliderBox}
 */
function buildVx27ContainerLeftWallCollider(spec) {
  const scale = normalizeVx27ContainerScale(spec.scale ?? VX27_CONTAINER_SCALE_DEFAULT);
  const width = spec.width ?? VX27_CONTAINER_WIDTH * scale;
  const height = spec.height ?? VX27_CONTAINER_HEIGHT * scale;
  const length = spec.length ?? VX27_CONTAINER_LENGTH * scale;
  const shell = VX27_SHELL_THICKNESS * scale;
  const baseY = spec.floorY;
  const rotY = spec.rotationY ?? 0;
  const edgeR = normalizeVx27EdgeRadius(spec.edgeRadius, width, height, length);
  const cornerR = resolveVx27ExteriorCornerRadius(spec, width, height, length);
  const halfW = width / 2;
  const halfL = length / 2;
  const wallL = edgeR > 0 ? length - 2 * edgeR : length;
  const cx = spec.x;
  const cz = spec.z;
  const wallCenter = localToWorldXZ(cx, cz, rotY, -halfW + shell / 2, 0);
  const rounded = applyExteriorColliderCornerRounding(shell / 2, wallL / 2, cornerR);

  /** @type {import("../physics/Collision.js").ColliderBox} */
  const collider = {
    propId: spec.propId ?? null,
    rotationY: rotY,
    active: true,
    kind: "vx27ContainerWall",
    containerPart: "wallLeft",
    containerCx: cx,
    containerCz: cz,
    containerHalfW: halfW,
    containerHalfL: halfL,
    x: wallCenter.x,
    z: wallCenter.z,
    halfX: rounded.halfX,
    halfZ: rounded.halfZ,
    cornerRadius: rounded.cornerRadius,
    bottomY: baseY - WALL_VISUAL_FLOOR_EMBED,
    topY: baseY + height,
  };
  vx27ColliderFootprintMeta(collider, edgeR, cornerR);
  return collider;
}

/**
 * Exterior right side wall — matches `vx27_container_wall_right` shell mesh.
 * @param {{
 *   x: number,
 *   z: number,
 *   floorY: number,
 *   rotationY?: number,
 *   width?: number,
 *   height?: number,
 *   length?: number,
 *   scale?: number,
 *   propId?: string | null,
 *   edgeRadius?: number,
 *   exteriorCornerRadius?: number,
 * }} spec
 * @returns {import("../physics/Collision.js").ColliderBox}
 */
function buildVx27ContainerRightWallCollider(spec) {
  const scale = normalizeVx27ContainerScale(spec.scale ?? VX27_CONTAINER_SCALE_DEFAULT);
  const width = spec.width ?? VX27_CONTAINER_WIDTH * scale;
  const height = spec.height ?? VX27_CONTAINER_HEIGHT * scale;
  const length = spec.length ?? VX27_CONTAINER_LENGTH * scale;
  const shell = VX27_SHELL_THICKNESS * scale;
  const baseY = spec.floorY;
  const rotY = spec.rotationY ?? 0;
  const edgeR = normalizeVx27EdgeRadius(spec.edgeRadius, width, height, length);
  const cornerR = resolveVx27ExteriorCornerRadius(spec, width, height, length);
  const halfW = width / 2;
  const halfL = length / 2;
  const wallL = edgeR > 0 ? length - 2 * edgeR : length;
  const cx = spec.x;
  const cz = spec.z;
  const wallCenter = localToWorldXZ(cx, cz, rotY, halfW - shell / 2, 0);
  const rounded = applyExteriorColliderCornerRounding(shell / 2, wallL / 2, cornerR);

  /** @type {import("../physics/Collision.js").ColliderBox} */
  const collider = {
    propId: spec.propId ?? null,
    rotationY: rotY,
    active: true,
    kind: "vx27ContainerWall",
    containerPart: "wallRight",
    containerCx: cx,
    containerCz: cz,
    containerHalfW: halfW,
    containerHalfL: halfL,
    x: wallCenter.x,
    z: wallCenter.z,
    halfX: rounded.halfX,
    halfZ: rounded.halfZ,
    cornerRadius: rounded.cornerRadius,
    bottomY: baseY - WALL_VISUAL_FLOOR_EMBED,
    topY: baseY + height,
  };
  vx27ColliderFootprintMeta(collider, edgeR, cornerR);
  return collider;
}

/**
 * Interior walk deck — top matches `vx27_container_interior_floor` surface.
 * Provides step-up / landing via collider {@link ColliderBox.topY} only (no side push).
 * @param {{
 *   x: number,
 *   z: number,
 *   floorY: number,
 *   rotationY?: number,
 *   width?: number,
 *   height?: number,
 *   length?: number,
 *   scale?: number,
 *   propId?: string | null,
 *   edgeRadius?: number,
 *   interiorInsets?: Partial<Vx27InteriorInsets>,
 * }} spec
 * @returns {import("../physics/Collision.js").ColliderBox}
 */
function buildVx27ContainerFloorCollider(spec) {
  const scale = normalizeVx27ContainerScale(spec.scale ?? VX27_CONTAINER_SCALE_DEFAULT);
  const width = spec.width ?? VX27_CONTAINER_WIDTH * scale;
  const height = spec.height ?? VX27_CONTAINER_HEIGHT * scale;
  const length = spec.length ?? VX27_CONTAINER_LENGTH * scale;
  const shell = VX27_SHELL_THICKNESS * scale;
  const baseY = spec.floorY;
  const rotY = spec.rotationY ?? 0;
  const halfW = width / 2;
  const halfL = length / 2;
  const cx = spec.x;
  const cz = spec.z;

  const opening = getVx27EndcapOpening(
    width,
    height,
    length,
    shell,
    baseY,
    spec.interiorInsets
  );
  const floorTopY = opening.openBottomY;
  const floorCenter = localToWorldXZ(
    cx,
    cz,
    rotY,
    opening.openCenterX,
    opening.offsetZ
  );
  const floorThick = Math.max(INTERIOR_WALL_THICKNESS, shell);

  return {
    propId: spec.propId ?? null,
    rotationY: rotY,
    active: true,
    kind: "vx27ContainerWall",
    containerPart: "floor",
    containerCx: cx,
    containerCz: cz,
    containerHalfW: halfW,
    containerHalfL: halfL,
    containerOpenHalfW: opening.openHalfW,
    containerInnerHalfL: opening.innerHalfL,
    x: floorCenter.x,
    z: floorCenter.z,
    halfX: opening.openHalfW,
    halfZ: opening.innerHalfL,
    bottomY: floorTopY - floorThick,
    topY: floorTopY,
  };
}

/** @param {ReturnType<typeof colliderSpecFromProp>} spec */
function buildVx27ContainerActiveColliderParts(spec) {
  /** @type {import("../physics/Collision.js").ColliderBox[]} */
  const parts = [];
  if (VX27_CONTAINER_ROOF_COLLISION) {
    parts.push(buildVx27ContainerRoofCollider(spec));
  }
  if (VX27_CONTAINER_LEFT_WALL_COLLISION) {
    parts.push(buildVx27ContainerLeftWallCollider(spec));
  }
  if (VX27_CONTAINER_RIGHT_WALL_COLLISION) {
    parts.push(buildVx27ContainerRightWallCollider(spec));
  }
  if (VX27_CONTAINER_FLOOR_COLLISION) {
    parts.push(buildVx27ContainerFloorCollider(spec));
  }

  // End-cap frame, corners, and door leaves — from full shell list (not the legacy singles above).
  for (const part of buildVx27ContainerColliderList(spec)) {
    const p = part.containerPart ?? "";
    if (
      p.startsWith("end") ||
      p.startsWith("door") ||
      p.startsWith("corner")
    ) {
      parts.push(part);
    }
  }

  return parts;
}

/**
 * @param {import("../level/loadArena.js").ArenaProp} def
 * @param {number} floorY
 */
function colliderSpecFromProp(def, floorY) {
  const scale = normalizeVx27ContainerScale(def.scale ?? VX27_CONTAINER_SCALE_DEFAULT);
  return {
    x: def.x,
    z: def.z,
    floorY: def.y ?? def.floorY ?? floorY,
    rotationY: def.rotationY ?? 0,
    width: def.width,
    height: def.height,
    length: def.length,
    scale,
    propId: def.id ?? null,
    edgeRadius: def.edgeRadius,
    exteriorCornerRadius: def.exteriorCornerRadius,
    interiorInsets: def.interiorInsets,
    doorTuning: def.doorTuning,
  };
}

/** End-cap frame + door leaves always resolve collision (including from outside the shell footprint). */
export function isVx27ContainerEndOrDoorCollider(box) {
  if (box.kind !== "vx27ContainerWall" || !box.containerPart) return false;
  const part = box.containerPart;
  return part.startsWith("door") || part.startsWith("end") || part.startsWith("corner");
}

/**
 * Cheap reject for end/door/corner colliders when the player is nowhere near the container.
 * Uses a conservative circle around container center (ignores yaw).
 * @param {import("../physics/Collision.js").ColliderBox} box
 * @param {number} worldX
 * @param {number} worldZ
 * @param {number} [margin]
 */
export function isVx27ContainerColliderNearPlayer(box, worldX, worldZ, margin = 1.25) {
  if (box.kind !== "vx27ContainerWall") return true;
  const cx = box.containerCx;
  const cz = box.containerCz;
  const halfW = box.containerHalfW;
  const halfL = box.containerHalfL;
  if (cx == null || cz == null || halfW == null || halfL == null) return true;
  const reach = Math.hypot(halfW, halfL) + margin;
  const dx = worldX - cx;
  const dz = worldZ - cz;
  return dx * dx + dz * dz <= reach * reach;
}

/** Horizontal shell parts that block walking (not roof/ceiling slabs). */
export function isVx27ContainerHorizontalCollider(box) {
  return (
    box.kind === "vx27ContainerWall" &&
    (box.containerPart === "wallLeft" ||
      box.containerPart === "wallRight" ||
      box.containerPart?.startsWith("end") ||
      box.containerPart?.startsWith("door"))
  );
}

/**
 * @param {{
 *   x: number,
 *   z: number,
 *   floorY: number,
 *   rotationY?: number,
 *   width?: number,
 *   height?: number,
 *   length?: number,
 *   propId?: string | null,
 *   interiorInsets?: Partial<Vx27InteriorInsets>,
 *   edgeRadius?: number,
 * }} spec
 * @returns {import("../physics/Collision.js").ColliderBox[]}
 */
function buildVx27ContainerColliderList(spec) {
  const scale = normalizeVx27ContainerScale(spec.scale ?? VX27_CONTAINER_SCALE_DEFAULT);
  const width = spec.width ?? VX27_CONTAINER_WIDTH * scale;
  const height = spec.height ?? VX27_CONTAINER_HEIGHT * scale;
  const length = spec.length ?? VX27_CONTAINER_LENGTH * scale;
  const shell = VX27_SHELL_THICKNESS * scale;
  const baseY = spec.floorY;
  const rotY = spec.rotationY ?? 0;
  const propId = spec.propId ?? null;
  const floorTop = baseY + shell + INTERIOR_INSET;
  const edgeR = normalizeVx27EdgeRadius(spec.edgeRadius, width, height, length);

  const halfW = width / 2;
  const halfH = height / 2;
  const halfL = length / 2;
  const faceHalfW = halfW - edgeR;
  const innerHalfW = halfW - shell;
  const cx = spec.x;
  const cz = spec.z;
  const endHalfZ = vx27ShellColliderHalfThickness(shell);

  const opening = getVx27EndcapOpening(
    width,
    height,
    length,
    shell,
    baseY,
    spec.interiorInsets
  );
  const ceilBottomY = opening.openTopY;
  const roofUndersideY = baseY + height - shell;
  const playHalfW = Math.max(0.05, opening.openHalfW - WALL_STANDOFF);
  const playHalfL = Math.max(0.05, opening.innerHalfL - WALL_STANDOFF);
  const wallL = edgeR > 0 ? length - 2 * edgeR : length;
  const sideHalfZ = wallL / 2;
  const shellHalfDepth = vx27ShellColliderHalfThickness(shell);
  const wallBottomY = baseY - WALL_VISUAL_FLOOR_EMBED;
  const wallTopY = baseY + height;

  const common = {
    propId,
    rotationY: rotY,
    active: true,
    kind: "vx27ContainerWall",
    containerCx: cx,
    containerCz: cz,
    containerHalfW: halfW,
    containerHalfL: halfL,
    containerPlayHalfW: playHalfW,
    containerInnerHalfW: innerHalfW,
    containerInnerHalfL: opening.innerHalfL,
    containerPlayHalfL: playHalfL,
    containerOpenHalfW: opening.openHalfW,
    containerOpenCenterX: opening.openCenterX,
    containerOffsetZ: opening.offsetZ,
  };

  const wallLeftLx = -halfW + shell / 2;
  const wallRightLx = halfW - shell / 2;
  const floorCenter = localToWorldXZ(cx, cz, rotY, 0, opening.offsetZ);
  const ceilingCenter = localToWorldXZ(cx, cz, rotY, 0, opening.offsetZ);

  const wallLeftPos = localToWorldXZ(cx, cz, rotY, wallLeftLx, 0);
  const wallRightPos = localToWorldXZ(cx, cz, rotY, wallRightLx, 0);

  /** @type {import("../physics/Collision.js").ColliderBox[]} */
  const colliders = [
    {
      ...common,
      containerPart: "wallLeft",
      x: wallLeftPos.x,
      z: wallLeftPos.z,
      halfX: shellHalfDepth,
      halfZ: sideHalfZ,
      bottomY: wallBottomY,
      topY: wallTopY,
    },
    {
      ...common,
      containerPart: "wallRight",
      x: wallRightPos.x,
      z: wallRightPos.z,
      halfX: shellHalfDepth,
      halfZ: sideHalfZ,
      bottomY: wallBottomY,
      topY: wallTopY,
    },
    {
      ...common,
      containerPart: "floor",
      x: floorCenter.x,
      z: floorCenter.z,
      halfX: opening.openHalfW,
      halfZ: opening.innerHalfL,
      bottomY: baseY,
      topY: floorTop,
    },
    {
      ...common,
      containerPart: "roof",
      x: floorCenter.x,
      z: floorCenter.z,
      halfX: opening.openHalfW,
      halfZ: opening.innerHalfL,
      bottomY: roofUndersideY,
      topY: baseY + height,
    },
    {
      ...common,
      containerPart: "interiorCeiling",
      x: ceilingCenter.x,
      z: ceilingCenter.z,
      halfX: innerHalfW,
      halfZ: opening.innerHalfL,
      bottomY: ceilBottomY,
      topY: roofUndersideY,
    },
  ];

  const endPad = VX27_WALL_COLLIDER_OUTWARD_PAD / 2;
  const endDefs = [
    { suffix: "Front", localZ: halfL - shell / 2 + endPad },
    { suffix: "Back", localZ: -halfL + shell / 2 - endPad },
  ];

  for (const { suffix, localZ } of endDefs) {
    const endCommon = { ...common, containerPart: `end${suffix}` };

    if (opening.openLeft + faceHalfW > 0.004) {
      const lx = (-faceHalfW + opening.openLeft) / 2;
      const pos = localToWorldXZ(cx, cz, rotY, lx, localZ);
      colliders.push({
        ...endCommon,
        containerPart: `end${suffix}Left`,
        x: pos.x,
        z: pos.z,
        halfX: (opening.openLeft + faceHalfW) / 2,
        halfZ: endHalfZ,
        bottomY: wallBottomY,
        topY: wallTopY,
      });
    }

    if (faceHalfW - opening.openRight > 0.004) {
      const lx = (opening.openRight + faceHalfW) / 2;
      const pos = localToWorldXZ(cx, cz, rotY, lx, localZ);
      colliders.push({
        ...endCommon,
        containerPart: `end${suffix}Right`,
        x: pos.x,
        z: pos.z,
        halfX: (faceHalfW - opening.openRight) / 2,
        halfZ: endHalfZ,
        bottomY: wallBottomY,
        topY: wallTopY,
      });
    }

    if (opening.openBottomY - baseY > 0.004) {
      const pos = localToWorldXZ(cx, cz, rotY, opening.openCenterX, localZ);
      colliders.push({
        ...endCommon,
        containerPart: `end${suffix}Bottom`,
        x: pos.x,
        z: pos.z,
        halfX: opening.openHalfW,
        halfZ: endHalfZ,
        bottomY: wallBottomY,
        topY: opening.openBottomY,
      });
    }

    if (baseY + height - opening.openTopY > 0.004) {
      const pos = localToWorldXZ(cx, cz, rotY, opening.openCenterX, localZ);
      colliders.push({
        ...endCommon,
        containerPart: `end${suffix}Top`,
        x: pos.x,
        z: pos.z,
        halfX: opening.openHalfW,
        halfZ: endHalfZ,
        bottomY: opening.openTopY,
        topY: wallTopY,
      });
    }
  }

  const cornerHalfX = shellHalfDepth;
  const cornerHalfZ = endHalfZ + shell * 0.5;
  for (const { part, lx, lz } of [
    { part: "cornerFrontLeft", lx: -halfW + cornerHalfX, lz: halfL - cornerHalfZ },
    { part: "cornerFrontRight", lx: halfW - cornerHalfX, lz: halfL - cornerHalfZ },
    { part: "cornerBackLeft", lx: -halfW + cornerHalfX, lz: -halfL + cornerHalfZ },
    { part: "cornerBackRight", lx: halfW - cornerHalfX, lz: -halfL + cornerHalfZ },
  ]) {
    const pos = localToWorldXZ(cx, cz, rotY, lx, lz);
    colliders.push({
      ...common,
      containerPart: part,
      x: pos.x,
      z: pos.z,
      halfX: cornerHalfX,
      halfZ: cornerHalfZ,
      bottomY: wallBottomY,
      topY: wallTopY,
    });
  }

  const centerY = baseY + height / 2;
  const doorLayout = computeVx27DoorLayout(
    width,
    height,
    length,
    shell,
    normalizeVx27InteriorInsets(spec.interiorInsets),
    edgeR,
    spec.doorTuning
  );
  for (const end of doorLayout.ends) {
    for (const leaf of end.leaves) {
      if (leaf.openDeg > VX27_DOOR_COLLIDER_OPEN_THRESHOLD) continue;
      const offset = vx27DoorLeafCenterOffset(
        leaf.pivotRotY,
        leaf.panelOffsetX,
        leaf.panelOffsetZ
      );
      const centerLx = leaf.hingeX + offset.x;
      const centerLz = end.pivotZ + offset.z;
      const pos = localToWorldXZ(cx, cz, rotY, centerLx, centerLz);
      const suffix = end.key === "front" ? "Front" : "Back";
      const sideSuffix = leaf.side === "left" ? "Left" : "Right";
      const halfWLeaf = doorLayout.leafW / 2;
      const halfDepth = doorLayout.thickness / 2 + 0.02;
      const doorRot = rotY + leaf.pivotRotY;
      const absCos = Math.abs(Math.cos(doorRot));
      const absSin = Math.abs(Math.sin(doorRot));
      colliders.push({
        ...common,
        containerPart: `door${suffix}${sideSuffix}`,
        x: pos.x,
        z: pos.z,
        halfX: Math.max(halfWLeaf * absCos + halfDepth * absSin, 0.06),
        halfZ: Math.max(halfWLeaf * absSin + halfDepth * absCos, 0.06),
        rotationY: rotY + leaf.pivotRotY,
        bottomY: centerY + doorLayout.doorCenterY - doorLayout.leafH / 2,
        topY: centerY + doorLayout.doorCenterY + doorLayout.leafH / 2,
      });
    }
  }

  /** Shell / frame before floor so thin walls resolve before walk surfaces. */
  const partPriority = (p) => {
    if (p.startsWith("wall")) return 0;
    if (p.startsWith("corner")) return 1;
    if (p.startsWith("end")) return 2;
    if (p.startsWith("door")) return 2;
    if (p === "floor") return 3;
    if (p === "interiorCeiling") return 4;
    if (p === "roof") return 5;
    return 6;
  };
  colliders.sort(
    (a, b) =>
      partPriority(a.containerPart ?? "") - partPriority(b.containerPart ?? "")
  );

  return colliders;
}

/**
 * Hollow shell colliders — side walls, floor, roof, plus end-cap frame (opening only).
 * @param {import("../level/loadArena.js").ArenaProp} def
 * @param {number} floorY
 * @returns {import("../physics/Collision.js").ColliderBox[]}
 */
/** Disable every stored vx27 shell collider (level reload / tune without collision). */
export function deactivateAllVx27ContainerColliders(colliders) {
  for (const collider of colliders) {
    if (collider.kind === "vx27ContainerWall") collider.active = false;
  }
}

export function vx27ContainerColliders(def, floorY = 0) {
  return buildVx27ContainerActiveColliderParts(colliderSpecFromProp(def, floorY));
}

/** @deprecated Use {@link vx27ContainerColliders} — kept for single-box callers. */
export function vx27ContainerCollider(def, floorY = 0) {
  return vx27ContainerColliders(def, floorY)[0];
}

/**
 * @param {import("../level/loadArena.js").ArenaConfig} [arena]
 */
export function arenaHasVx27Containers(arena) {
  return (arena?.props ?? []).some((p) => p.type === "vx27Container");
}

function ensureVx27ContainerTexturesLoaded() {
  if (_textures.size > 0) return Promise.resolve();
  if (_preloadPromise) return _preloadPromise;

  _preloadPromise = Promise.all(
    Object.keys(SET_FILES).map((setKey) => loadSetTextures(setKey))
  )
    .then(() => {
      buildMaterial("side", { surface: "exterior" });
      buildMaterial("corner_arc", { surface: "exterior" });
      buildMaterial("inside_wall", { surface: "interior" });
      buildMaterial("top_bottom", { surface: "exterior" });
      buildMaterial("top_bottom", {
        floorDarken: true,
        rotateUV90: true,
        surface: "exterior",
      });
      buildMaterial("top_bottom", { rotateUV90: true, surface: "exterior" });
      buildMaterial("top_bottom", {
        rotateUV90: true,
        surface: "exterior",
        shellFloor: true,
      });
      buildMaterial("top_bottom", {
        floorDarken: true,
        rotateUV90: true,
        surface: "exterior",
        doubleSided: true,
      });
      buildMaterial("endcap_square", {
        transparent: false,
        alphaTest: 0.5,
        surface: "exterior",
        doubleSided: true,
      });
      buildMaterial("door", {
        transparent: true,
        alphaTest: 0.5,
        surface: "exterior",
        doubleSided: true,
      });
      buildMaterial("door", {
        transparent: true,
        alphaTest: 0.5,
        mirrorU: true,
        surface: "exterior",
        doubleSided: true,
      });
    })
    .catch((err) => {
      _preloadPromise = null;
      console.warn("VX-27 container textures failed to load:", err);
    });

  return _preloadPromise;
}

/** Preload container PBR maps before first spawn. */
export function preloadVx27ContainerAssets(arena) {
  if (!arenaHasVx27Containers(arena)) return Promise.resolve();
  return ensureVx27ContainerTexturesLoaded();
}

/** Credits roll — load container PBR without level props. */
export function preloadVx27ContainerCreditsAssets() {
  return ensureVx27ContainerTexturesLoaded();
}

/** @param {THREE.Object3D} root */
function cloneVx27PreviewMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((mat) =>
        cloneVx27ContainerMaterial(mat, { floorInstance: true })
      );
      return;
    }
    child.material = cloneVx27ContainerMaterial(child.material, {
      floorInstance: true,
    });
  });
}

/** Preview-only container with doors ajar — safe to dispose in credits UI. */
export function createVx27ContainerPreviewMesh() {
  const root = new THREE.Group();
  createVx27Container(root, 0, 0, 0, 0.42, {
    doorTuning: {
      frontLeftOpen: 88,
      frontRightOpen: 52,
      backLeftOpen: 18,
    },
  });
  cloneVx27PreviewMaterials(root);
  return root;
}

/** @param {THREE.Object3D | null | undefined} group */
export function disposeVx27ContainerPreviewMesh(group) {
  if (!group) return;
  group.parent?.remove(group);
  disposeContainerSubtree(group);
}

/**
 * @param {THREE.Object3D} parent
 * @param {number} x
 * @param {number} z
 * @param {number} [floorY=0]
 * @param {number} [rotationY=0]
 * @param {{
 *   length?: number,
 *   width?: number,
 *   height?: number,
 *   doorsOpen?: boolean,
 *   propDef?: import("../level/loadArena.js").ArenaProp,
 * }} [options]
 */
export function createVx27Container(
  parent,
  x,
  z,
  floorY = 0,
  rotationY = 0,
  options = {}
) {
  const scale = normalizeVx27ContainerScale(
    options.scale ?? options.propDef?.scale ?? VX27_CONTAINER_SCALE_DEFAULT
  );
  const dims = resolveVx27ContainerDimensions(scale);
  const width = options.width ?? dims.width;
  const height = options.height ?? dims.height;
  const length = options.length ?? dims.length;
  const shell = dims.shell;
  const insets = normalizeVx27InteriorInsets(
    options.interiorInsets ?? options.propDef?.interiorInsets
  );
  const edgeRadius = normalizeVx27EdgeRadius(
    options.edgeRadius ?? options.propDef?.edgeRadius,
    width,
    height,
    length
  );
  const exteriorCornerRadius = normalizeVx27ExteriorCornerRadius(
    options.exteriorCornerRadius ?? options.propDef?.exteriorCornerRadius,
    width,
    length
  );

  const group = new THREE.Group();
  group.name = "vx27_container";
  group.userData.vx27Container = true;
  group.userData.bulletSurfaceKind = "metal";
  group.userData.vx27Scale = scale;
  group.userData.vx27Height = height;
  group.userData.vx27Width = width;
  group.userData.vx27Length = length;
  group.userData.vx27InteriorInsets = insets;
  group.userData.vx27EdgeRadius = edgeRadius;
  group.userData.vx27ExteriorCornerRadius = exteriorCornerRadius;
  const doorTuning = normalizeVx27ContainerDoorTuning(
    options.doorTuning ?? options.propDef?.doorTuning
  );
  group.userData.vx27DoorTuning = doorTuning;
  group.userData.vx27Shell = shell;
  if (options.propDef) {
    group.userData.vx27PropDef = { ...options.propDef };
    group.userData.vx27PropId = options.propDef.id ?? null;
    group.userData.roomId = options.propDef.roomId ?? null;
  }

  if (options.propDef?.materialTuning) {
    setVx27ContainerMaterialTuning(
      normalizeVx27ContainerMaterialTuning(options.propDef.materialTuning)
    );
  }

  buildShell(group, width, height, length, shell, insets, edgeRadius, doorTuning);
  initVx27ContainerDoorAnim(group, doorTuning);

  group.position.set(x, floorY + height / 2, z);
  group.rotation.y = rotationY;

  applyVx27ContainerRenderLayers(group, group.userData.roomId ?? null);

  if (options.propDef?.materialTuning) {
    setVx27ContainerMaterialTuning(
      normalizeVx27ContainerMaterialTuning(options.propDef.materialTuning),
      group
    );
  }

  parent.add(group);
  return group;
}

/**
 * Move every shell collider for one container prop.
 * @param {import("../physics/Collision.js").ColliderBox[]} colliders
 * @param {string | null | undefined} propId
 * @param {{ x: number, z: number, floorY: number, rotationY: number }} placement
 * @param {import("../level/loadArena.js").ArenaProp} [propDef]
 */
export function syncVx27ContainerColliders(
  colliders,
  propId,
  placement,
  propDef = {}
) {
  for (const collider of colliders) {
    if (collider.kind !== "vx27ContainerWall") continue;
    if (propId != null && collider.propId !== propId) continue;
    collider.active = false;
  }

  const scale = normalizeVx27ContainerScale(propDef.scale);
  const nextParts = buildVx27ContainerActiveColliderParts({
    x: placement.x,
    z: placement.z,
    floorY: placement.floorY,
    rotationY: placement.rotationY,
    width: propDef.width,
    height: propDef.height,
    length: propDef.length,
    scale,
    propId,
    edgeRadius: propDef.edgeRadius,
    exteriorCornerRadius: propDef.exteriorCornerRadius,
    interiorInsets: propDef.interiorInsets,
    doorTuning: propDef.doorTuning,
  });
  if (nextParts.length === 0) return;

  const partMap = Object.fromEntries(
    nextParts.map((part) => [part.containerPart, part])
  );
  const seen = new Set();
  for (const collider of colliders) {
    if (collider.kind !== "vx27ContainerWall") continue;
    if (propId != null && collider.propId !== propId) continue;
    const patch = partMap[collider.containerPart];
    if (!patch) continue;
    Object.assign(collider, patch, { active: true });
    seen.add(collider.containerPart);
  }
  for (const part of nextParts) {
    if (seen.has(part.containerPart)) continue;
    colliders.push({ ...part, active: true });
  }
}
