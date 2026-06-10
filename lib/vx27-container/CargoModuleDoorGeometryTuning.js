import {
  exportVx27ContainerDoorTuningJson,
  normalizeVx27ContainerDoorTuning,
  VX27_CONTAINER_DOOR_LIMITS,
} from "./Vx27ContainerDoorTuning.js";

const CARGO_CONTAINER_PROP_ID = "vx27_cargo_module_qa";

export const CARGO_MODULE_DOOR_TUNE_ENABLED_KEY =
  "fps-cargo-module-door-tune-enabled";
export const CARGO_DOOR_WIDTH_KEY = "fps-cargo-door-width";
export const CARGO_DOOR_HEIGHT_KEY = "fps-cargo-door-height";
export const CARGO_DOOR_SIDE_OFFSET_KEY = "fps-cargo-door-side-offset";
export const CARGO_DOOR_BOTTOM_OFFSET_KEY = "fps-cargo-door-bottom-offset";
export const CARGO_DOOR_INFRAME_EDGE_KEY = "fps-cargo-door-inframe-edge";
export const CARGO_DOOR_FRONT_LEFT_KEY = "fps-cargo-door-front-left";
export const CARGO_DOOR_FRONT_RIGHT_KEY = "fps-cargo-door-front-right";
export const CARGO_DOOR_BACK_LEFT_KEY = "fps-cargo-door-back-left";
export const CARGO_DOOR_BACK_RIGHT_KEY = "fps-cargo-door-back-right";

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

function readStoredFloat(key, fallback) {
  if (typeof localStorage === "undefined") return fallback;
  const value = parseFloat(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

/** @typedef {typeof CARGO_MODULE_DOOR_GEOMETRY_DEFAULT} CargoModuleDoorGeometry */
/** @typedef {typeof CARGO_DOORS_DEFAULT} CargoDoorOpens */
/** @typedef {CargoModuleDoorGeometry & CargoDoorOpens} CargoModuleDoorTuning */

/** @returns {CargoModuleDoorGeometry} */
export function loadCargoModuleDoorGeometry() {
  const d = CARGO_MODULE_DOOR_GEOMETRY_DEFAULT;
  const patch = {
    width: readStoredFloat(CARGO_DOOR_WIDTH_KEY, d.width),
    height: readStoredFloat(CARGO_DOOR_HEIGHT_KEY, d.height),
    sideOffset: readStoredFloat(CARGO_DOOR_SIDE_OFFSET_KEY, d.sideOffset),
    bottomOffset: readStoredFloat(CARGO_DOOR_BOTTOM_OFFSET_KEY, d.bottomOffset),
    inframeFromEdge: readStoredFloat(
      CARGO_DOOR_INFRAME_EDGE_KEY,
      d.inframeFromEdge,
    ),
  };
  const normalized = normalizeVx27ContainerDoorTuning(patch);
  return {
    width: normalized.width,
    height: normalized.height,
    sideOffset: normalized.sideOffset,
    bottomOffset: normalized.bottomOffset,
    inframeFromEdge: normalized.inframeFromEdge,
  };
}

/** @returns {CargoDoorOpens} */
export function loadCargoDoorOpens() {
  const d = CARGO_DOORS_DEFAULT;
  return {
    frontLeftOpen: readStoredFloat(CARGO_DOOR_FRONT_LEFT_KEY, d.frontLeftOpen),
    frontRightOpen: readStoredFloat(
      CARGO_DOOR_FRONT_RIGHT_KEY,
      d.frontRightOpen,
    ),
    backLeftOpen: readStoredFloat(CARGO_DOOR_BACK_LEFT_KEY, d.backLeftOpen),
    backRightOpen: readStoredFloat(CARGO_DOOR_BACK_RIGHT_KEY, d.backRightOpen),
  };
}

/** @returns {CargoModuleDoorTuning} */
export function loadCargoModuleDoorTuning() {
  return {
    ...loadCargoModuleDoorGeometry(),
    ...loadCargoDoorOpens(),
  };
}

/** @param {CargoModuleDoorGeometry} geometry */
export function saveCargoModuleDoorGeometry(geometry) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CARGO_DOOR_WIDTH_KEY, String(geometry.width));
  localStorage.setItem(CARGO_DOOR_HEIGHT_KEY, String(geometry.height));
  localStorage.setItem(CARGO_DOOR_SIDE_OFFSET_KEY, String(geometry.sideOffset));
  localStorage.setItem(
    CARGO_DOOR_BOTTOM_OFFSET_KEY,
    String(geometry.bottomOffset),
  );
  localStorage.setItem(
    CARGO_DOOR_INFRAME_EDGE_KEY,
    String(geometry.inframeFromEdge),
  );
}

/** @param {CargoDoorOpens} doors */
export function saveCargoDoorOpens(doors) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CARGO_DOOR_FRONT_LEFT_KEY, String(doors.frontLeftOpen));
  localStorage.setItem(
    CARGO_DOOR_FRONT_RIGHT_KEY,
    String(doors.frontRightOpen),
  );
  localStorage.setItem(CARGO_DOOR_BACK_LEFT_KEY, String(doors.backLeftOpen));
  localStorage.setItem(CARGO_DOOR_BACK_RIGHT_KEY, String(doors.backRightOpen));
}

/** @param {CargoModuleDoorTuning} tuning */
export function saveCargoModuleDoorTuning(tuning) {
  saveCargoModuleDoorGeometry(tuning);
  saveCargoDoorOpens(tuning);
}

/** @returns {boolean} */
export function loadCargoModuleDoorTuneEnabled() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(CARGO_MODULE_DOOR_TUNE_ENABLED_KEY) === "true";
}

/** @param {boolean} enabled */
export function saveCargoModuleDoorTuneEnabled(enabled) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CARGO_MODULE_DOOR_TUNE_ENABLED_KEY, String(enabled));
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

export function resolveCargoModuleDoorGeometryForProp(def) {
  if (def.id !== CARGO_CONTAINER_PROP_ID) return def.doorTuning ?? {};
  return {
    ...def.doorTuning,
    ...loadCargoModuleDoorGeometry(),
    ...loadCargoDoorOpens(),
  };
}
