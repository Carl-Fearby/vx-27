import * as THREE from "three";
import {
  normalizeVx27ContainerDoorTuning,
  VX27_DOOR_MAX_OPEN_DEG,
} from "./Vx27ContainerDoorTuning.js";

/** @typedef {"front" | "back"} Vx27DoorEndKey */
/** @typedef {"left" | "right"} Vx27DoorSide */

export { VX27_DOOR_MAX_OPEN_DEG };

/** Each leaf extends past the opening jamb/sill so tuned offsets cannot leave a slit. */
const DOOR_JAMB_OVERLAP = 0.01;
const DOOR_SILL_OVERLAP = 0.01;

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
  const frameBottomY = floorYLocal + t.bottomOffset;
  const frameTopY = ceilYLocal;
  const openBottomY = frameBottomY;
  const openTopY = frameTopY;
  const leafW = Math.max(0.05, t.width);
  const doorBottomY = frameBottomY - DOOR_SILL_OVERLAP;
  const leafH = Math.max(
    0.05,
    Math.min(t.height, frameTopY + DOOR_SILL_OVERLAP - doorBottomY)
  );
  const doorCenterY = doorBottomY + leafH / 2;
  // Frame hinge lines — inset from opening jamb edges and sill (not on the door leaf).
  const leftJambX = openCenterX - openHalfW + t.inframeFromEdge;
  const rightJambX = openCenterX + openHalfW - t.inframeFromEdge;
  // Door swing axis — inset along leaf width from the leaf hinge edge at the frame jamb.
  const leftHingeX = leftJambX + t.sideOffset;
  const rightHingeX = rightJambX - t.sideOffset;
  const leftPanelOffsetX = leafW / 2 - t.sideOffset - DOOR_JAMB_OVERLAP;
  const rightPanelOffsetX = -leafW / 2 + t.sideOffset + DOOR_JAMB_OVERLAP;
  // Pivot on the outer end-cap plane; panel center sits outside (on top of the cap).
  const frontEndOuterZ = halfL + shell / 2;
  const backEndOuterZ = -halfL - shell / 2;
  const frontPivotZ = frontEndOuterZ;
  const backPivotZ = backEndOuterZ;
  const frontPanelOffsetZ = t.thickness / 2 + t.depthOffset;
  const backPanelOffsetZ = -t.thickness / 2 - t.depthOffset;

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
          panelOffsetX: leftPanelOffsetX,
          panelOffsetZ: frontPanelOffsetZ,
          pivotRotY: vx27DoorPivotRotationY("front", "left", t.frontLeftOpen),
          openDeg: t.frontLeftOpen,
        },
        {
          side: "right",
          hingeX: rightHingeX,
          panelOffsetX: rightPanelOffsetX,
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
          panelOffsetX: leftPanelOffsetX,
          panelOffsetZ: backPanelOffsetZ,
          pivotRotY: vx27DoorPivotRotationY("back", "left", t.backLeftOpen),
          openDeg: t.backLeftOpen,
        },
        {
          side: "right",
          hingeX: rightHingeX,
          panelOffsetX: rightPanelOffsetX,
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
    openBottomY,
    openTopY,
    floorYLocal,
    ceilYLocal,
    doorCenterY,
    leafW,
    leafH,
    thickness: t.thickness,
    sideOffset: t.sideOffset,
    depthOffset: t.depthOffset,
    bottomOffset: t.bottomOffset,
    inframeFromEdge: t.inframeFromEdge,
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
