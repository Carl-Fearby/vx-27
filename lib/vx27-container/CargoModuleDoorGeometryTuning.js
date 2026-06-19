import {
  exportVx27ContainerDoorTuningJson,
  normalizeVx27ContainerDoorTuning,
} from "./Vx27ContainerDoorTuning.js";

const CARGO_CONTAINER_PROP_ID = "vx27_cargo_module_qa";

/** Cargo module door geometry defaults (level1 `vx27_cargo_module_qa.doorTuning`). */
export const CARGO_MODULE_DOOR_GEOMETRY_DEFAULT = {
  width: 1.08,
  height: 2.26,
  sideOffset: 0,
  bottomOffset: 0.326,
  inframeFromEdge: 0.236,
};

/** Door open angles (deg) — 0 closed, 135 fully open. */
export const CARGO_DOORS_DEFAULT = {
  frontLeftOpen: 0,
  frontRightOpen: 135,
  backLeftOpen: 0,
  backRightOpen: 135,
};

/** @typedef {typeof CARGO_MODULE_DOOR_GEOMETRY_DEFAULT} CargoModuleDoorGeometry */
/** @typedef {typeof CARGO_DOORS_DEFAULT} CargoDoorOpens */
/** @typedef {CargoModuleDoorGeometry & CargoDoorOpens} CargoModuleDoorTuning */

/** @returns {CargoModuleDoorTuning} */
export function loadCargoModuleDoorTuning() {
  return {
    ...CARGO_MODULE_DOOR_GEOMETRY_DEFAULT,
    ...CARGO_DOORS_DEFAULT,
  };
}

/** @returns {CargoDoorOpens} */
export function loadCargoDoorOpens() {
  return { ...CARGO_DOORS_DEFAULT };
}

export function resolveCargoModuleDoorGeometryForProp(def) {
  if (def.id !== CARGO_CONTAINER_PROP_ID) return def.doorTuning ?? {};
  return {
    ...def.doorTuning,
    ...loadCargoModuleDoorTuning(),
  };
}

/** @param {CargoModuleDoorTuning} tuning */
export function formatCargoModuleDoorTuningJson(tuning) {
  const exported = exportVx27ContainerDoorTuningJson(
    normalizeVx27ContainerDoorTuning(tuning),
  );
  return JSON.stringify(
    {
      [CARGO_CONTAINER_PROP_ID]: {
        doorTuning: {
          width: exported.width,
          height: exported.height,
          sideOffset: exported.sideOffset,
          bottomOffset: exported.bottomOffset,
          inframeFromEdge: exported.inframeFromEdge,
          frontLeftOpen: +tuning.frontLeftOpen.toFixed(0),
          frontRightOpen: +tuning.frontRightOpen.toFixed(0),
          backLeftOpen: +tuning.backLeftOpen.toFixed(0),
          backRightOpen: +tuning.backRightOpen.toFixed(0),
        },
      },
    },
    null,
    2,
  );
}
