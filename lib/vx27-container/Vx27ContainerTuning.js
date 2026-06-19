import {
  VX27_CONTAINER_HEIGHT,
  getDefaultVx27InteriorInsets,
  normalizeVx27ContainerScale,
  normalizeVx27EdgeRadius,
  normalizeVx27ExteriorCornerRadius,
  normalizeVx27InteriorInsets,
  syncVx27ContainerColliders,
  VX27_CONTAINER_SCALE_DEFAULT,
  VX27_CONTAINER_SCALE_MAX,
  VX27_CONTAINER_SCALE_MIN,
  VX27_EDGE_RADIUS_MAX,
  VX27_EDGE_RADIUS_MIN,
  VX27_EXTERIOR_CORNER_RADIUS_MAX,
  VX27_EXTERIOR_CORNER_RADIUS_MIN,
  VX27_INTERIOR_CEILING_OFFSET_MAX,
  VX27_INTERIOR_CEILING_OFFSET_MIN,
  VX27_INTERIOR_FLOOR_OFFSET_MAX,
  VX27_INTERIOR_FLOOR_OFFSET_MIN,
  VX27_INTERIOR_INSET_MAX,
  VX27_INTERIOR_INSET_MIN,
} from "./Vx27Container.js";
import {
  exportVx27ContainerMaterialTuningJson,
  normalizeVx27ContainerMaterialTuning,
} from "./Vx27ContainerMaterialTuning.js";
import {
  exportVx27ContainerDoorTuningJson,
  normalizeVx27ContainerDoorTuning,
} from "./Vx27ContainerDoorTuning.js";

export const VX27_CONTAINER_INSETS_KEY = "fps-vx27-container-interior-insets";
export const VX27_CONTAINER_EDGE_RADIUS_KEY = "fps-vx27-container-edge-radius";
export const VX27_CONTAINER_EXTERIOR_CORNER_RADIUS_KEY =
  "fps-vx27-container-exterior-corner-radius";

export const CONTAINER_INSET_SLIDER_STEP = 0.001;
export const CONTAINER_INSET_NUDGE_STEP = 0.01;
export const CONTAINER_VERTICAL_OFFSET_STEP = 0.005;
export const CONTAINER_VERTICAL_OFFSET_NUDGE = 0.02;
export const CONTAINER_EDGE_RADIUS_STEP = 0.001;
export const CONTAINER_EDGE_RADIUS_NUDGE = 0.005;
export const CONTAINER_EXTERIOR_CORNER_RADIUS_STEP = 0.001;
export const CONTAINER_EXTERIOR_CORNER_RADIUS_NUDGE = 0.01;

export const CONTAINER_POS_MIN = -25;
export const CONTAINER_POS_MAX = 25;
export const CONTAINER_Y_MIN = -1;
export const CONTAINER_Y_MAX = 6;
export const CONTAINER_ROTATION_MIN = -Math.PI;
export const CONTAINER_ROTATION_MAX = Math.PI;

export const CONTAINER_POS_SLIDER_STEP = 0.01;
export const CONTAINER_POS_NUDGE_STEP = 0.05;
export const CONTAINER_Y_SLIDER_STEP = 0.001;
export const CONTAINER_Y_NUDGE_STEP = 0.01;
export const CONTAINER_ROTATION_STEP = 0.01;
export const CONTAINER_ROTATION_NUDGE = 0.05;
export const CONTAINER_SCALE_STEP = 0.01;
export const CONTAINER_SCALE_NUDGE = 0.05;

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Wide placement bounds from level walkable extents (arena + attached rooms).
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} [bounds]
 * @param {number} [floorY]
 * @param {number} [catwalkDeckY]
 */
export function getVx27ContainerPlacementBounds(
  bounds,
  floorY = 0,
  catwalkDeckY = 4.35
) {
  const pad = 4;
  return {
    minX: (bounds?.minX ?? CONTAINER_POS_MIN) - pad,
    maxX: (bounds?.maxX ?? CONTAINER_POS_MAX) + pad,
    minZ: (bounds?.minZ ?? CONTAINER_POS_MIN) - pad,
    maxZ: (bounds?.maxZ ?? CONTAINER_POS_MAX) + pad,
    minY: floorY - 0.5,
    maxY: catwalkDeckY + 0.5,
  };
}

/** @param {THREE.Group} group */
export function readVx27ContainerPlacement(group) {
  const height = group.userData.vx27Height ?? VX27_CONTAINER_HEIGHT;
  return {
    x: group.position.x,
    z: group.position.z,
    floorY: group.position.y - height / 2,
    rotationY: group.rotation.y,
    height,
  };
}

/**
 * @param {THREE.Group} group
 * @param {{ x: number, z: number, floorY: number, rotationY?: number, height?: number }} placement
 */
export function applyVx27ContainerPlacement(group, placement) {
  const height = placement.height ?? group.userData.vx27Height ?? VX27_CONTAINER_HEIGHT;
  group.position.set(placement.x, placement.floorY + height / 2, placement.z);
  if (placement.rotationY != null) group.rotation.y = placement.rotationY;
}

/**
 * @param {import("../physics/Collision.js").ColliderBox[]} colliders
 * @param {string | null | undefined} propId
 * @param {{ x: number, z: number, floorY: number, rotationY: number }} placement
 * @param {import("../level/loadArena.js").ArenaProp} [propDef]
 */
export function syncVx27ContainerCollider(colliders, propId, placement, propDef = {}) {
  syncVx27ContainerColliders(colliders, propId, placement, propDef);
}

/** @param {import("./Vx27Container.js").Vx27InteriorInsets} insets */
export function exportVx27ContainerInteriorInsetsJson(insets) {
  const n = normalizeVx27InteriorInsets(insets);
  return {
    left: parseFloat(n.left.toFixed(4)),
    right: parseFloat(n.right.toFixed(4)),
    front: parseFloat(n.front.toFixed(4)),
    back: parseFloat(n.back.toFixed(4)),
    floorOffset: parseFloat(n.floorOffset.toFixed(4)),
    ceilingOffset: parseFloat(n.ceilingOffset.toFixed(4)),
  };
}

/**
 * Full prop block for level JSON — always includes placement, interior shell, and materials.
 * @param {import("../level/loadArena.js").ArenaProp} propDef
 * @param {{ x: number, z: number, floorY: number, rotationY: number }} placement
 * @param {import("./Vx27Container.js").Vx27InteriorInsets} [interiorInsets]
 * @param {import("./Vx27ContainerMaterialTuning.js").Vx27ContainerMaterialTuning} [materialTuning]
 * @param {number} [edgeRadius]
 * @param {number} [exteriorCornerRadius]
 * @param {number} [scale]
 * @param {import("./Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning} [doorTuning]
 */
export function buildVx27ContainerPropJson(
  propDef,
  placement,
  interiorInsets,
  materialTuning,
  edgeRadius,
  exteriorCornerRadius,
  scale,
  doorTuning
) {
  const def = { ...propDef };
  def.type = def.type ?? "vx27Container";
  if (def.id) def.id = def.id;
  def.x = parseFloat(placement.x.toFixed(3));
  def.z = parseFloat(placement.z.toFixed(3));
  def.y = parseFloat(placement.floorY.toFixed(3));
  delete def.floorY;
  def.rotationY = parseFloat(placement.rotationY.toFixed(4));
  def.interiorInsets = exportVx27ContainerInteriorInsetsJson(
    interiorInsets ?? getDefaultVx27InteriorInsets()
  );
  def.materialTuning = exportVx27ContainerMaterialTuningJson(
    normalizeVx27ContainerMaterialTuning(materialTuning)
  );
  const edge = normalizeVx27EdgeRadius(edgeRadius);
  def.edgeRadius = parseFloat(edge.toFixed(4));
  const corner = normalizeVx27ExteriorCornerRadius(exteriorCornerRadius);
  def.exteriorCornerRadius = parseFloat(corner.toFixed(4));
  const normalizedScale = normalizeVx27ContainerScale(
    scale ?? propDef.scale ?? VX27_CONTAINER_SCALE_DEFAULT
  );
  def.scale = parseFloat(normalizedScale.toFixed(4));
  def.doorTuning = exportVx27ContainerDoorTuningJson(
    normalizeVx27ContainerDoorTuning(doorTuning ?? propDef.doorTuning)
  );
  return def;
}

/** @returns {import("./Vx27Container.js").Vx27InteriorInsets} */
export function loadVx27ContainerInteriorInsets() {
  const defaults = getDefaultVx27InteriorInsets();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(VX27_CONTAINER_INSETS_KEY);
    if (!raw) return defaults;
    return normalizeVx27InteriorInsets(JSON.parse(raw));
  } catch {
    return defaults;
  }
}

/** @param {import("./Vx27Container.js").Vx27InteriorInsets} insets */
export function saveVx27ContainerInteriorInsets(insets) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    VX27_CONTAINER_INSETS_KEY,
    JSON.stringify(normalizeVx27InteriorInsets(insets))
  );
}

/** @returns {number} */
export function loadVx27ContainerEdgeRadius() {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(VX27_CONTAINER_EDGE_RADIUS_KEY);
    if (raw == null) return 0;
    return normalizeVx27EdgeRadius(parseFloat(raw));
  } catch {
    return 0;
  }
}

/** @param {number} edgeRadius */
export function saveVx27ContainerEdgeRadius(edgeRadius) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    VX27_CONTAINER_EDGE_RADIUS_KEY,
    String(normalizeVx27EdgeRadius(edgeRadius))
  );
}

/** @returns {number} */
export function loadVx27ContainerExteriorCornerRadius() {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(VX27_CONTAINER_EXTERIOR_CORNER_RADIUS_KEY);
    if (raw == null) return 0;
    return normalizeVx27ExteriorCornerRadius(parseFloat(raw));
  } catch {
    return 0;
  }
}

/** @param {number} exteriorCornerRadius */
export function saveVx27ContainerExteriorCornerRadius(exteriorCornerRadius) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    VX27_CONTAINER_EXTERIOR_CORNER_RADIUS_KEY,
    String(normalizeVx27ExteriorCornerRadius(exteriorCornerRadius))
  );
}

export {
  VX27_INTERIOR_INSET_MIN,
  VX27_INTERIOR_INSET_MAX,
  VX27_INTERIOR_FLOOR_OFFSET_MIN,
  VX27_INTERIOR_FLOOR_OFFSET_MAX,
  VX27_INTERIOR_CEILING_OFFSET_MIN,
  VX27_INTERIOR_CEILING_OFFSET_MAX,
  VX27_EDGE_RADIUS_MIN,
  VX27_EDGE_RADIUS_MAX,
  VX27_EXTERIOR_CORNER_RADIUS_MIN,
  VX27_EXTERIOR_CORNER_RADIUS_MAX,
  VX27_CONTAINER_SCALE_MIN,
  VX27_CONTAINER_SCALE_MAX,
  getDefaultVx27InteriorInsets,
  normalizeVx27InteriorInsets,
  normalizeVx27EdgeRadius,
  normalizeVx27ExteriorCornerRadius,
  normalizeVx27ContainerScale,
};

export function loadVx27ContainerTuneEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(VX27_CONTAINER_TUNE_ENABLED_KEY) === "true";
}

export function saveVx27ContainerTuneEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VX27_CONTAINER_TUNE_ENABLED_KEY, String(enabled));
}

export { RAD_TO_DEG };
