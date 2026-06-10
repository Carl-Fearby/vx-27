/** Dev placement for VX-27 cargo module interior props (level1). */
import { resolveCargoModuleDoorGeometryForProp } from "./CargoModuleDoorGeometryTuning.js";

export const CARGO_CONTAINER_PROP_ID = "vx27_cargo_module_qa";
export const CARGO_CONSOLE_PROP_ID = "control_panel_cargo_side";
export const CARGO_BARREL_PROP_ID = "oil_barrel_cargo_front_corner";

export const CARGO_CONSOLE_X_KEY = "fps-cargo-console-x";
export const CARGO_CONSOLE_Z_KEY = "fps-cargo-console-z";
export const CARGO_CONSOLE_ROT_KEY = "fps-cargo-console-rot";
export const CARGO_BARREL_X_KEY = "fps-cargo-barrel-x";
export const CARGO_BARREL_Z_KEY = "fps-cargo-barrel-z";
export const CARGO_MODULE_PROPS_TUNE_ENABLED_KEY =
  "fps-cargo-module-props-tune-enabled";

export {
  CARGO_DOORS_DEFAULT,
  loadCargoDoorOpens,
  saveCargoDoorOpens,
} from "./CargoModuleDoorGeometryTuning.js";

/** Front-left by doors — inset for panel depth (~1.02 m). */
export const CARGO_CONSOLE_DEFAULT = {
  x: -4.8,
  z: 10.509,
  rotationY: 2.79,
};

/** Back-right — diagonally opposite console. */
export const CARGO_BARREL_DEFAULT = {
  x: -3.27,
  z: 6.01,
};

function readStoredFloat(key, fallback) {
  if (typeof localStorage === "undefined") return fallback;
  const value = parseFloat(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

/** @returns {{ x: number, z: number, rotationY: number }} */
export function loadCargoConsolePlacement() {
  return {
    x: readStoredFloat(CARGO_CONSOLE_X_KEY, CARGO_CONSOLE_DEFAULT.x),
    z: readStoredFloat(CARGO_CONSOLE_Z_KEY, CARGO_CONSOLE_DEFAULT.z),
    rotationY: readStoredFloat(
      CARGO_CONSOLE_ROT_KEY,
      CARGO_CONSOLE_DEFAULT.rotationY,
    ),
  };
}

/** @returns {{ x: number, z: number }} */
export function loadCargoBarrelPlacement() {
  return {
    x: readStoredFloat(CARGO_BARREL_X_KEY, CARGO_BARREL_DEFAULT.x),
    z: readStoredFloat(CARGO_BARREL_Z_KEY, CARGO_BARREL_DEFAULT.z),
  };
}

/** @param {number} x @param {number} z @param {number} rotationY */
export function saveCargoConsolePlacement(x, z, rotationY) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CARGO_CONSOLE_X_KEY, String(x));
  localStorage.setItem(CARGO_CONSOLE_Z_KEY, String(z));
  localStorage.setItem(CARGO_CONSOLE_ROT_KEY, String(rotationY));
}

/** @param {number} x @param {number} z */
export function saveCargoBarrelPlacement(x, z) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CARGO_BARREL_X_KEY, String(x));
  localStorage.setItem(CARGO_BARREL_Z_KEY, String(z));
}

/** @returns {boolean} */
export function loadCargoModulePropsTuneEnabled() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(CARGO_MODULE_PROPS_TUNE_ENABLED_KEY) === "true";
}

/** @param {boolean} enabled */
export function saveCargoModulePropsTuneEnabled(enabled) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CARGO_MODULE_PROPS_TUNE_ENABLED_KEY, String(enabled));
}

/** @typedef {{ x: number, z: number, rotationY: number }} CargoConsolePlacement */
/** @typedef {{ x: number, z: number }} CargoBarrelPlacement */
/**
 * @typedef {{
 *   console: CargoConsolePlacement,
 *   barrel: CargoBarrelPlacement,
 * }} CargoModulePropsPlacement
 */

/** @returns {CargoModulePropsPlacement} */
export function loadCargoModulePropsPlacement() {
  return {
    console: loadCargoConsolePlacement(),
    barrel: loadCargoBarrelPlacement(),
  };
}

/** @param {CargoModulePropsPlacement} placement */
export function saveCargoModulePropsPlacement(placement) {
  saveCargoConsolePlacement(
    placement.console.x,
    placement.console.z,
    placement.console.rotationY,
  );
  saveCargoBarrelPlacement(placement.barrel.x, placement.barrel.z);
}

/** @param {import("./loadArena.js").ArenaProp} def */
export function resolveCargoVx27ContainerPropDef(def) {
  if (def.id !== CARGO_CONTAINER_PROP_ID) return def;
  return {
    ...def,
    doorTuning: resolveCargoModuleDoorGeometryForProp(def),
  };
}

/** @param {CargoModulePropsPlacement} placement */
export function formatCargoModulePropsJson(placement) {
  return JSON.stringify(
    {
      control_panel_cargo_side: {
        x: +placement.console.x.toFixed(3),
        z: +placement.console.z.toFixed(3),
        rotationY: +placement.console.rotationY.toFixed(4),
      },
      oil_barrel_cargo_front_corner: {
        x: +placement.barrel.x.toFixed(3),
        z: +placement.barrel.z.toFixed(3),
      },
    },
    null,
    2,
  );
}
