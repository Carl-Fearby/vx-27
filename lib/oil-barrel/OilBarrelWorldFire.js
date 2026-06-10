export const OIL_BARREL_WORLD_FIRE_RIG_NAME = "oil_barrel_world_fire";

/** Counter-rotate fire content so flames stay world-up when the barrel is tilted. */
export function syncOilBarrelWorldFireOrientation(barrel) {
  if (!barrel?.isGroup || barrel.name !== "oil_barrel") return;
  const rig = barrel.getObjectByName(OIL_BARREL_WORLD_FIRE_RIG_NAME);
  if (!rig) return;
  rig.quaternion.copy(barrel.quaternion).invert();
}
