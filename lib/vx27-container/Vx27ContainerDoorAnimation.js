import {
  normalizeVx27ContainerDoorTuning,
} from "./Vx27ContainerDoorTuning.js";
import {
  vx27DoorPivotRotationY,
  VX27_DOOR_COLLIDER_OPEN_THRESHOLD,
} from "./Vx27ContainerDoors.js";
import { updateVx27ContainerDoorLightingLayers } from "./Vx27ContainerDoorLighting.js";

/**
 * Exponential ease toward target (1/s). ~3.2 → full 135° open in ~1.4 s, slowing at the end.
 */
export const VX27_DOOR_OPEN_SMOOTH = 3.2;

/** @deprecated Use {@link VX27_DOOR_OPEN_SMOOTH}. Linear deg/s equivalent at mid-swing. */
export const VX27_DOOR_OPEN_SPEED_DEG = 360;

const GEOMETRY_KEYS = [
  "width",
  "height",
  "sideOffset",
  "depthOffset",
  "bottomOffset",
  "inframeFromEdge",
  "thickness",
  "openingEdgeRadius",
];

/** @type {const} */
const LEAF_DEFS = [
  { openKey: "frontLeftOpen", end: "front", side: "left" },
  { openKey: "frontRightOpen", end: "front", side: "right" },
  { openKey: "backLeftOpen", end: "back", side: "left" },
  { openKey: "backRightOpen", end: "back", side: "right" },
];

/** @param {Record<string, unknown>} patch */
export function vx27DoorPatchChangesGeometry(patch) {
  return GEOMETRY_KEYS.some((key) => patch[key] !== undefined);
}

/** @param {THREE.Group} group */
function cacheVx27DoorPivots(group) {
  /** @type {Record<string, THREE.Object3D | null>} */
  const pivots = {};
  for (const { end, side } of LEAF_DEFS) {
    pivots[`${end}_${side}`] =
      group
        .getObjectByName("vx27_container_doors")
        ?.getObjectByName(`vx27_container_door_${end}_${side}_pivot`) ?? null;
  }
  group.userData.vx27DoorPivots = pivots;
}

/** @param {THREE.Group} group @param {string} end @param {string} side */
function doorPivot(group, end, side) {
  return group.userData.vx27DoorPivots?.[`${end}_${side}`] ?? null;
}

/**
 * @param {THREE.Group} group
 * @param {import("./Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning} tuning
 */
export function applyVx27DoorPivotRotations(group, tuning) {
  for (const { openKey, end, side } of LEAF_DEFS) {
    const pivot = doorPivot(group, end, side);
    if (!pivot) continue;
    pivot.rotation.y = vx27DoorPivotRotationY(end, side, tuning[openKey]);
  }
}

/**
 * @param {THREE.Group} group
 * @param {import("./Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning} tuning
 */
export function initVx27ContainerDoorAnim(group, tuning) {
  const t = normalizeVx27ContainerDoorTuning(tuning);
  const current = {
    frontLeftOpen: t.frontLeftOpen,
    frontRightOpen: t.frontRightOpen,
    backLeftOpen: t.backLeftOpen,
    backRightOpen: t.backRightOpen,
  };
  group.userData.vx27DoorAnim = {
    current: { ...current },
    target: { ...current },
    active: false,
    colliderDirty: false,
    lightingDirty: false,
  };
  cacheVx27DoorPivots(group);
  applyVx27DoorPivotRotations(group, t);
}

/** @param {THREE.Group} group */
function syncDoorTuningOpenAngles(group) {
  const anim = group.userData.vx27DoorAnim;
  if (!anim) return;
  const tuning = normalizeVx27ContainerDoorTuning({
    ...group.userData.vx27DoorTuning,
    ...anim.current,
  });
  group.userData.vx27DoorTuning = tuning;
}

/**
 * @param {THREE.Group} group
 * @param {Partial<import("./Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning>} patch
 * @param {{ animate?: boolean }} [options]
 * @returns {boolean} true if open angles are still animating
 */
export function setVx27ContainerDoorOpenTargets(group, patch, options = {}) {
  const animate = options.animate !== false;
  initVx27ContainerDoorAnim(
    group,
    group.userData.vx27DoorTuning ?? patch
  );
  const anim = group.userData.vx27DoorAnim;
  let anyChange = false;

  for (const { openKey } of LEAF_DEFS) {
    if (patch[openKey] === undefined) continue;
    const next = normalizeVx27ContainerDoorTuning({ [openKey]: patch[openKey] })[
      openKey
    ];
    if (Math.abs(next - anim.target[openKey]) < 1e-4) continue;
    anim.target[openKey] = next;
    anyChange = true;
  }

  if (!anyChange) return false;

  if (!animate) {
    for (const { openKey } of LEAF_DEFS) {
      if (patch[openKey] !== undefined) {
        anim.current[openKey] = anim.target[openKey];
      }
    }
    syncDoorTuningOpenAngles(group);
    applyVx27DoorPivotRotations(group, group.userData.vx27DoorTuning);
    anim.lightingDirty = true;
    anim.active = false;
    anim.colliderDirty = true;
    return false;
  }

  anim.active = true;
  return true;
}

/**
 * @param {THREE.Group[]} groups
 * @param {number} dt seconds
 * @returns {boolean} any container still animating
 */
export function updateVx27ContainerDoorAnimations(groups, dt) {
  const blend = 1 - Math.exp(-VX27_DOOR_OPEN_SMOOTH * Math.max(0, dt));
  let anyActive = false;

  for (const group of groups) {
    const anim = group.userData.vx27DoorAnim;
    const visible = group.userData.vx27CullVisible !== false;
    if (!anim?.active && !visible && !anim?.lightingDirty) continue;

    if (anim?.active) {
      let leafMoving = false;
      for (const { openKey, end, side } of LEAF_DEFS) {
        const from = anim.current[openKey];
        const to = anim.target[openKey];
        const delta = to - from;
        if (Math.abs(delta) < 0.15) {
          if (from !== to) {
            anim.current[openKey] = to;
          }
          continue;
        }
        const next = from + delta * blend;
        anim.current[openKey] = next;
        leafMoving = true;
        anim.lightingDirty = true;

        const pivot = doorPivot(group, end, side);
        if (pivot) pivot.rotation.y = vx27DoorPivotRotationY(end, side, next);
      }

      syncDoorTuningOpenAngles(group);

      if (leafMoving) {
        anyActive = true;
      } else {
        anim.active = false;
        anim.colliderDirty = true;
        anim.lightingDirty = true;
      }
    }

    if (anim?.lightingDirty) {
      updateVx27ContainerDoorLightingLayers(group);
      anim.lightingDirty = false;
    }
  }

  return anyActive;
}

/**
 * True when any end door is open enough for interior visibility / egress.
 * @param {THREE.Group} group
 * @param {number} [thresholdDeg=VX27_DOOR_COLLIDER_OPEN_THRESHOLD]
 */
export function vx27ContainerHasOpenDoor(
  group,
  thresholdDeg = VX27_DOOR_COLLIDER_OPEN_THRESHOLD,
) {
  return (
    vx27ContainerEndDoorsOpen(group, "front", thresholdDeg) ||
    vx27ContainerEndDoorsOpen(group, "back", thresholdDeg)
  );
}

/**
 * True when either leaf on one container end exceeds threshold.
 * @param {THREE.Group} group
 * @param {"front"|"back"} end
 * @param {number} [thresholdDeg=VX27_DOOR_COLLIDER_OPEN_THRESHOLD]
 */
export function vx27ContainerEndDoorsOpen(
  group,
  end,
  thresholdDeg = VX27_DOOR_COLLIDER_OPEN_THRESHOLD,
) {
  const thresholdRad = (Math.max(0, thresholdDeg) * Math.PI) / 180;
  const doors = group.getObjectByName("vx27_container_doors");
  if (doors) {
    for (const side of ["left", "right"]) {
      const pivot =
        doors.getObjectByName(`vx27_container_door_${end}_${side}_pivot`) ??
        group.userData.vx27DoorPivots?.[`${end}_${side}`];
      if (pivot && Math.abs(pivot.rotation.y) > thresholdRad) return true;
    }
    return false;
  }

  const anim = group.userData.vx27DoorAnim;
  const src = anim?.current ?? group.userData.vx27DoorTuning ?? {};
  const leftKey = `${end}LeftOpen`;
  const rightKey = `${end}RightOpen`;
  return (
    (src[leftKey] ?? 0) > thresholdDeg || (src[rightKey] ?? 0) > thresholdDeg
  );
}

/**
 * Door leaf most swung open on one end — used to place a world-pass spill light in the gap.
 * @param {THREE.Group} group
 * @param {"front" | "back"} end
 * @param {number} [minOpenDeg=VX27_DOOR_COLLIDER_OPEN_THRESHOLD]
 * @returns {{ pivot: THREE.Object3D, openRad: number, end: "front" | "back", side: "left" | "right" } | null}
 */
export function pickVx27DoorSpillPivot(
  group,
  end,
  minOpenDeg = VX27_DOOR_COLLIDER_OPEN_THRESHOLD,
) {
  const minRad = (Math.max(0, minOpenDeg) * Math.PI) / 180;
  const doors = group.getObjectByName("vx27_container_doors");
  if (!doors) return null;

  let bestPivot = null;
  let bestSide = "left";
  let bestOpen = 0;
  for (const side of ["left", "right"]) {
    const pivot =
      doors.getObjectByName(`vx27_container_door_${end}_${side}_pivot`) ??
      group.userData.vx27DoorPivots?.[`${end}_${side}`];
    if (!pivot) continue;
    const open = Math.abs(pivot.rotation.y);
    if (open > bestOpen) {
      bestOpen = open;
      bestPivot = pivot;
      bestSide = side;
    }
  }
  if (!bestPivot || bestOpen <= minRad) return null;
  return { pivot: bestPivot, openRad: bestOpen, end, side: bestSide };
}

/** @deprecated Use {@link pickVx27DoorSpillPivot} with `"front"`. */
export function pickVx27FrontDoorSpillPivot(
  group,
  minOpenDeg = VX27_DOOR_COLLIDER_OPEN_THRESHOLD,
) {
  return pickVx27DoorSpillPivot(group, "front", minOpenDeg);
}

/** @param {THREE.Group} group @returns {boolean} */
export function consumeVx27DoorColliderDirty(group) {
  const anim = group.userData.vx27DoorAnim;
  if (!anim?.colliderDirty) return false;
  anim.colliderDirty = false;
  return true;
}
