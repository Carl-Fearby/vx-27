/** Baked placement for VX-27 cargo module interior props (level1). */
import { DEFAULT_VX27_CONTAINER_MATERIAL_TUNING } from "./Vx27ContainerMaterialTuning.js";
import { resolveCargoModuleDoorGeometryForProp } from "./CargoModuleDoorGeometryTuning.js";

export const CARGO_CONTAINER_PROP_ID = "vx27_cargo_module_qa";
export const CARGO_CONSOLE_PROP_ID = "control_panel_cargo_side";
export const CARGO_BARREL_PROP_ID = "oil_barrel_cargo_front_corner";

export { CARGO_DOORS_DEFAULT, loadCargoDoorOpens } from "./CargoModuleDoorGeometryTuning.js";

/** Shell geometry baked from level1 `vx27_cargo_module_qa` (excluding world placement). */
export const CARGO_MODULE_GEOMETRY_DEFAULT = {
  scale: 1.27,
  edgeRadius: 0.069,
  exteriorCornerRadius: 0,
  interiorInsets: {
    left: 0.226,
    right: 0.226,
    front: 0.031,
    back: 0.031,
    floorOffset: 0.05,
    ceilingOffset: 0.125,
  },
};

/**
 * Level1 cargo module as an arena prop — same door geometry, insets, scale, and
 * material tuning as the in-game `vx27_cargo_module_qa` spawn.
 * @returns {import("../level/loadArena.js").ArenaProp}
 */
export function getCargoModulePreviewPropDef() {
  return resolveCargoVx27ContainerPropDef({
    id: CARGO_CONTAINER_PROP_ID,
    type: "vx27Container",
    ...CARGO_MODULE_GEOMETRY_DEFAULT,
    materialTuning: { ...DEFAULT_VX27_CONTAINER_MATERIAL_TUNING },
  });
}

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
