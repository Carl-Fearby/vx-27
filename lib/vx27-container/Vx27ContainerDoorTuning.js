/** Outward swing limit — 135° keeps the leaf on the exterior side of the end cap. */
export const VX27_DOOR_MAX_OPEN_DEG = 135;

/** @typedef {{
 *   width: number,
 *   height: number,
 *   sideOffset: number,
 *   depthOffset: number,
 *   bottomOffset: number,
 *   thickness: number,
 *   openingEdgeRadius: number,
 *   frontLeftOpen: number,
 *   frontRightOpen: number,
 *   backLeftOpen: number,
 *   backRightOpen: number,
 * }} Vx27ContainerDoorTuning */

/** @type {Vx27ContainerDoorTuning} */
export const DEFAULT_VX27_CONTAINER_DOOR_TUNING = {
  width: 1.05,
  height: 2.05,
  sideOffset: 0,
  depthOffset: 0,
  bottomOffset: 0,
  thickness: 0.02,
  openingEdgeRadius: 0.035,
  frontLeftOpen: 0,
  frontRightOpen: 0,
  backLeftOpen: 0,
  backRightOpen: 0,
};

export const VX27_CONTAINER_DOOR_LIMITS = {
  width: { min: 0.4, max: 1.6, step: 0.005, nudge: 0.01 },
  height: { min: 0.4, max: 2.4, step: 0.005, nudge: 0.01 },
  sideOffset: { min: -1.0, max: 1.0, step: 0.002, nudge: 0.01 },
  depthOffset: { min: -0.12, max: 0.12, step: 0.001, nudge: 0.005 },
  bottomOffset: { min: -0.2, max: 0.5, step: 0.002, nudge: 0.01 },
  thickness: { min: 0.008, max: 0.06, step: 0.001, nudge: 0.002 },
  openingEdgeRadius: { min: 0, max: 0.12, step: 0.001, nudge: 0.005 },
  doorOpen: { min: 0, max: VX27_DOOR_MAX_OPEN_DEG, step: 1, nudge: 5 },
};

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** @param {Partial<Vx27ContainerDoorTuning>} [patch] @returns {Vx27ContainerDoorTuning} */
export function normalizeVx27ContainerDoorTuning(patch) {
  const d = DEFAULT_VX27_CONTAINER_DOOR_TUNING;
  const L = VX27_CONTAINER_DOOR_LIMITS;
  return {
    width: clampNum(patch?.width, L.width.min, L.width.max, d.width),
    height: clampNum(patch?.height, L.height.min, L.height.max, d.height),
    sideOffset: clampNum(
      patch?.sideOffset,
      L.sideOffset.min,
      L.sideOffset.max,
      d.sideOffset
    ),
    depthOffset: clampNum(
      patch?.depthOffset,
      L.depthOffset.min,
      L.depthOffset.max,
      d.depthOffset
    ),
    bottomOffset: clampNum(
      patch?.bottomOffset,
      L.bottomOffset.min,
      L.bottomOffset.max,
      d.bottomOffset
    ),
    thickness: clampNum(
      patch?.thickness,
      L.thickness.min,
      L.thickness.max,
      d.thickness
    ),
    openingEdgeRadius: clampNum(
      patch?.openingEdgeRadius,
      L.openingEdgeRadius.min,
      L.openingEdgeRadius.max,
      d.openingEdgeRadius
    ),
    frontLeftOpen: clampNum(
      patch?.frontLeftOpen,
      L.doorOpen.min,
      L.doorOpen.max,
      d.frontLeftOpen
    ),
    frontRightOpen: clampNum(
      patch?.frontRightOpen,
      L.doorOpen.min,
      L.doorOpen.max,
      d.frontRightOpen
    ),
    backLeftOpen: clampNum(
      patch?.backLeftOpen,
      L.doorOpen.min,
      L.doorOpen.max,
      d.backLeftOpen
    ),
    backRightOpen: clampNum(
      patch?.backRightOpen,
      L.doorOpen.min,
      L.doorOpen.max,
      d.backRightOpen
    ),
  };
}

/** @param {Vx27ContainerDoorTuning} tuning */
export function exportVx27ContainerDoorTuningJson(tuning) {
  const t = normalizeVx27ContainerDoorTuning(tuning);
  return {
    width: parseFloat(t.width.toFixed(4)),
    height: parseFloat(t.height.toFixed(4)),
    sideOffset: parseFloat(t.sideOffset.toFixed(4)),
    depthOffset: parseFloat(t.depthOffset.toFixed(4)),
    bottomOffset: parseFloat(t.bottomOffset.toFixed(4)),
    thickness: parseFloat(t.thickness.toFixed(4)),
    openingEdgeRadius: parseFloat(t.openingEdgeRadius.toFixed(4)),
    frontLeftOpen: parseFloat(t.frontLeftOpen.toFixed(2)),
    frontRightOpen: parseFloat(t.frontRightOpen.toFixed(2)),
    backLeftOpen: parseFloat(t.backLeftOpen.toFixed(2)),
    backRightOpen: parseFloat(t.backRightOpen.toFixed(2)),
  };
}
