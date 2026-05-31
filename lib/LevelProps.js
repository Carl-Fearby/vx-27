import { enableShadowsOn } from "./SceneEnvironment.js";
import {
  createOilBarrel,
  ensureOilBarrelFlameMeshes,
  oilBarrelCollider,
  refreshOilBarrelRenderLayers,
  resolveBarrelTopCap,
} from "./OilBarrel.js";
import {
  OIL_BARREL_PILE_ID,
  spawnArenaPileBarrelsFromDefs,
} from "./OilBarrelPileLayout.js";

/**
 * @param {THREE.Group} group
 * @param {import("./loadArena.js").ArenaConfig} arena
 * @param {import("./Collision.js").ColliderBox[]} colliders
 */
/**
 * @param {THREE.Object3D} root
 * @param {import("./loadArena.js").ArenaConfig} arena
 */
export function spawnAllLevelOilBarrels(root, arena) {
  const floorY = arena.floorY ?? 0;
  const pileDefs = [];
  const looseDefs = [];
  for (const def of arena.props ?? []) {
    if (def.type !== "oilBarrel") continue;
    if (OIL_BARREL_PILE_ID.test(def.id)) pileDefs.push(def);
    else looseDefs.push(def);
  }

  const barrels = [];
  if (pileDefs.length) {
    barrels.push(...spawnArenaPileBarrelsFromDefs(root, pileDefs, floorY));
  }
  for (const def of looseDefs) {
    const y = def.y ?? def.floorY ?? floorY;
    barrels.push(
      createOilBarrel(root, def.x, def.z, y, def.rotationY ?? 0, {
        topCap: resolveBarrelTopCap(def),
        roomId: def.roomId ?? null,
        interiorFire: def.interiorFire,
        layOnSide: def.layOnSide === true,
        rotationX: def.rotationX,
        rotationZ: def.rotationZ,
      })
    );
  }
  ensureOilBarrelFlameMeshes(root);
  refreshOilBarrelRenderLayers(root);
  return barrels;
}

/** @param {THREE.Object3D} root @param {import("./loadArena.js").ArenaConfig} arena */
export function rebuildLevelOilBarrels(root, arena) {
  const remove = [];
  root.traverse((obj) => {
    if (obj.name === "oil_barrel" && obj.isGroup) remove.push(obj);
  });
  for (const group of remove) {
    group.parent?.remove(group);
  }
  return spawnAllLevelOilBarrels(root, arena);
}

export function spawnLevelProps(group, arena, colliders) {
  const floorY = arena.floorY ?? 0;
  const barrels = spawnAllLevelOilBarrels(group, arena);
  for (const barrel of barrels) enableShadowsOn(barrel);

  for (const def of arena.props ?? []) {
    if (def.type === "oilBarrel") {
      colliders.push(oilBarrelCollider(def, floorY));
    }
  }

  return { barrels };
}

/**
 * Replace oil-barrel colliders after pile regen (props changed, meshes rebuilt separately).
 * @param {import("./Collision.js").ColliderBox[]} colliders
 * @param {import("./loadArena.js").ArenaConfig} arena
 */
export function resyncOilBarrelColliders(colliders, arena) {
  const floorY = arena.floorY ?? 0;
  for (let i = colliders.length - 1; i >= 0; i--) {
    if (colliders[i].kind === "oilBarrel") colliders.splice(i, 1);
  }
  for (const def of arena.props ?? []) {
    if (def.type === "oilBarrel") {
      colliders.push(oilBarrelCollider(def, floorY));
    }
  }
}
