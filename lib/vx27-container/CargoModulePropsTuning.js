/** Baked placement for VX-27 cargo module interior props (level1). */
import { resolveCargoModuleDoorGeometryForProp } from "./CargoModuleDoorGeometryTuning.js";

export const CARGO_CONTAINER_PROP_ID = "vx27_cargo_module_qa";
export const CARGO_CONSOLE_PROP_ID = "control_panel_cargo_side";
export const CARGO_BARREL_PROP_ID = "oil_barrel_cargo_front_corner";

export { CARGO_DOORS_DEFAULT, loadCargoDoorOpens } from "./CargoModuleDoorGeometryTuning.js";

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

/** @typedef {{ x: number, z: number, rotationY: number }} CargoConsolePlacement */
/** @typedef {{ x: number, z: number }} CargoBarrelPlacement */
/**
 * @typedef {{
 *   console: CargoConsolePlacement,
 *   barrel: CargoBarrelPlacement,
 * }} CargoModulePropsPlacement
 */

/** @returns {{ x: number, z: number, rotationY: number }} */
export function loadCargoConsolePlacement() {
  return { ...CARGO_CONSOLE_DEFAULT };
}

/** @returns {{ x: number, z: number }} */
export function loadCargoBarrelPlacement() {
  return { ...CARGO_BARREL_DEFAULT };
}

/** @returns {CargoModulePropsPlacement} */
export function loadCargoModulePropsPlacement() {
  return {
    console: loadCargoConsolePlacement(),
    barrel: loadCargoBarrelPlacement(),
  };
}

/** @param {import("./loadArena.js").ArenaProp} def */
export function resolveCargoVx27ContainerPropDef(def) {
  if (def.id !== CARGO_CONTAINER_PROP_ID) return def;
  return {
    ...def,
    doorTuning: resolveCargoModuleDoorGeometryForProp(def),
  };
}
