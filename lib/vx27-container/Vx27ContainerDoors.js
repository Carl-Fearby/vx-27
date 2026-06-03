import * as THREE from "three";
import {
  normalizeVx27ContainerDoorTuning,
  VX27_DOOR_MAX_OPEN_DEG,
} from "./Vx27ContainerDoorTuning.js";

/** @typedef {"front" | "back"} Vx27DoorEndKey */
/** @typedef {"left" | "right"} Vx27DoorSide */

export { VX27_DOOR_MAX_OPEN_DEG };

/**
 * Outward-only swing on the exterior face of each end cap.
 * Front (+Z): leaves rotate toward +Z. Back (−Z): leaves rotate toward −Z.
 * @param {Vx27DoorEndKey} endKey
 * @param {Vx27DoorSide} side
 * @param {number} openDeg
 */
export function vx27DoorPivotRotationY(endKey, side, openDeg) {
  const clamped = Math.max(0, Math.min(VX27_DOOR_MAX_OPEN_DEG, openDeg));
  if (clamped <= 0) return 0;
  const rad = THREE.MathUtils.degToRad(clamped);
  const outwardSign = endKey === "front" ? 1 : -1;
  const sideSign = side === "left" ? 1 : -1;
  return outwardSign * sideSign * -rad;
}

/**
 * Door layout in container-local space (origin = container center).
 * @param {number} width
 * @param {number} height
 * @param {number} length
 * @param {number} shell
 * @param {import("./Vx27Container.js").Vx27InteriorInsets} insets
 * @param {number} edgeRadius
 * @param {import("./Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning} [doorTuning]
 */
export function computeVx27DoorLayout(
  width,
  height,
  length,
  shell,
  insets,
  edgeRadius,
  doorTuning
) {
  void edgeRadius;
  const n = insets;
  const halfH = height / 2;
  const halfL = length / 2;
  const openHalfW = Math.max(0.025, (width - n.left - n.right) / 2);
  const openCenterX = (n.right - n.left) / 2;
  const floorYLocal = -halfH + shell + 0.003 + n.floorOffset;
  const ceilYLocal = halfH - shell - 0.003 - n.ceilingOffset;
  const t = normalizeVx27ContainerDoorTuning(doorTuning);
  const leafW = t.width;
  const doorBottomY = floorYLocal + t.bottomOffset;
  const maxLeafH = Math.max(0.05, ceilYLocal - doorBottomY);
  const leafH = t.height > 0 ? Math.min(t.height, maxLeafH) : maxLeafH;
  const doorCenterY = doorBottomY + leafH / 2;
  // Pivot on the outer end-cap plane; panel center sits outside (on top of the cap).
  const frontEndOuterZ = halfL + shell / 2;
  const backEndOuterZ = -halfL - shell / 2;
  const frontPivotZ = frontEndOuterZ;
  const backPivotZ = backEndOuterZ;
  const frontPanelOffsetZ = t.thickness / 2 + t.depthOffset;
  const backPanelOffsetZ = -t.thickness / 2 - t.depthOffset;
  const leftHingeX = openCenterX - openHalfW + t.sideOffset;
  const rightHingeX = openCenterX + openHalfW - t.sideOffset;

  const ends = [
    {
      key: "front",
      pivotZ: frontPivotZ,
      /** Closed leaf center — wizard / debug frame. */
      doorCenterZ: frontPivotZ + frontPanelOffsetZ,
      leftOpenDeg: t.frontLeftOpen,
      rightOpenDeg: t.frontRightOpen,
      leaves: [
        {
          side: "left",
          hingeX: leftHingeX,
          panelOffsetX: leafW / 2,
          panelOffsetZ: frontPanelOffsetZ,
          pivotRotY: vx27DoorPivotRotationY("front", "left", t.frontLeftOpen),
          openDeg: t.frontLeftOpen,
        },
        {
          side: "right",
          hingeX: rightHingeX,
          panelOffsetX: -leafW / 2,
          panelOffsetZ: frontPanelOffsetZ,
          pivotRotY: vx27DoorPivotRotationY("front", "right", t.frontRightOpen),
          openDeg: t.frontRightOpen,
        },
      ],
    },
    {
      key: "back",
      pivotZ: backPivotZ,
      doorCenterZ: backPivotZ + backPanelOffsetZ,
      leftOpenDeg: t.backLeftOpen,
      rightOpenDeg: t.backRightOpen,
      leaves: [
        {
          side: "left",
          hingeX: leftHingeX,
          panelOffsetX: leafW / 2,
          panelOffsetZ: backPanelOffsetZ,
          pivotRotY: vx27DoorPivotRotationY("back", "left", t.backLeftOpen),
          openDeg: t.backLeftOpen,
        },
        {
          side: "right",
          hingeX: rightHingeX,
          panelOffsetX: -leafW / 2,
          panelOffsetZ: backPanelOffsetZ,
          pivotRotY: vx27DoorPivotRotationY("back", "right", t.backRightOpen),
          openDeg: t.backRightOpen,
        },
      ],
    },
  ];

  return {
    openHalfW,
    openCenterX,
    floorYLocal,
    ceilYLocal,
    doorCenterY,
    leafW,
    leafH,
    thickness: t.thickness,
    sideOffset: t.sideOffset,
    depthOffset: t.depthOffset,
    bottomOffset: t.bottomOffset,
    openingEdgeRadius: t.openingEdgeRadius,
    doorBottomY,
    ends,
  };
}

/** Degrees above which a leaf no longer blocks movement. */
export const VX27_DOOR_COLLIDER_OPEN_THRESHOLD = 4;

/**
 * Leaf mesh center offset from hinge after Y rotation (Three.js local → parent space).
 * @param {number} pivotRotY
 * @param {number} panelOffsetX
 * @param {number} panelOffsetZ
 */
export function vx27DoorLeafCenterOffset(pivotRotY, panelOffsetX, panelOffsetZ) {
  const cos = Math.cos(pivotRotY);
  const sin = Math.sin(pivotRotY);
  return {
    x: panelOffsetX * cos + panelOffsetZ * sin,
    z: panelOffsetZ * cos - panelOffsetX * sin,
  };
}
