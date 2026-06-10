import {
  createVx27Container,
  isPointInsideVx27ContainerGroup,
  refreshVx27ContainerRenderLayers,
  vx27ContainerColliders,
} from "../vx27-container/Vx27Container.js";
import { enableShadowsOn } from "../lighting/SceneEnvironment.js";
import {
  createOilBarrel,
  ensureOilBarrelFlameMeshes,
  oilBarrelCollider,
  refreshOilBarrelRenderLayers,
  resolveBarrelTopCap,
} from "../oil-barrel/OilBarrel.js";
import {
  OIL_BARREL_PILE_ID,
  spawnArenaPileBarrelsFromDefs,
} from "../oil-barrel/OilBarrelPileLayout.js";
import {
  controlPanelCollider,
  createControlPanel,
  refreshControlPanelRenderLayers,
  resolveControlPanelRoomId,
  resolveControlPanelShelteredOutdoor,
} from "../control-panel/ControlPanel.js";
import {
  CARGO_BARREL_PROP_ID,
  CARGO_CONSOLE_PROP_ID,
  loadCargoBarrelPlacement,
  loadCargoConsolePlacement,
  resolveCargoVx27ContainerPropDef,
} from "../vx27-container/CargoModulePropsTuning.js";

/** @param {import("./loadArena.js").ArenaProp} def */
function resolveControlPanelPropDef(def) {
  if (def.id !== CARGO_CONSOLE_PROP_ID) return def;
  const placement = loadCargoConsolePlacement();
  return {
    ...def,
    x: placement.x,
    z: placement.z,
    rotationY: placement.rotationY,
  };
}

/** @param {import("./loadArena.js").ArenaProp} def */
function resolveCargoBarrelPropDef(def) {
  if (def.id !== CARGO_BARREL_PROP_ID) return def;
  const placement = loadCargoBarrelPlacement();
  return { ...def, x: placement.x, z: placement.z };
}

/**
 * @param {THREE.Group} group
 * @param {import("./loadArena.js").ArenaConfig} arena
 * @param {import("../physics/Collision.js").ColliderBox[]} colliders
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
    const propDef = resolveCargoBarrelPropDef(def);
    const y = propDef.y ?? propDef.floorY ?? floorY;
    barrels.push(
      createOilBarrel(root, propDef.x, propDef.z, y, propDef.rotationY ?? 0, {
        topCap: resolveBarrelTopCap(propDef),
        roomId: propDef.roomId ?? null,
        interiorFire: propDef.interiorFire,
        layOnSide: propDef.layOnSide === true,
        rotationX: propDef.rotationX,
        rotationZ: propDef.rotationZ,
      })
    );
  }
  ensureOilBarrelFlameMeshes(root);
  refreshOilBarrelRenderLayers(root);
  return barrels;
}

function spawnControlPanels(root, arena, containerMeshes = []) {
  const floorY = arena.floorY ?? 0;
  const panels = [];
  for (const def of arena.props ?? []) {
    if (def.type !== "controlPanel") continue;
    const propDef = resolveControlPanelPropDef(def);
    const y = propDef.y ?? propDef.floorY ?? floorY;
    const roomId = resolveControlPanelRoomId(propDef, arena);
    const shelteredOutdoor = resolveControlPanelShelteredOutdoor(
      propDef,
      arena,
      roomId,
    );
    const inVx27Container = containerMeshes.some((container) =>
      isPointInsideVx27ContainerGroup(propDef.x, propDef.z, container)
    );
    panels.push(
      createControlPanel(root, propDef.x, propDef.z, y, propDef.rotationY ?? 0, {
        height: propDef.height,
        depth: propDef.depth,
        width: propDef.panelWidth,
        shelteredOutdoor,
        inVx27Container,
        propDef: roomId ? { ...propDef, roomId } : propDef,
      }),
    );
  }
  refreshControlPanelRenderLayers(root);
  return panels;
}

function spawnVx27Containers(root, arena) {
  const floorY = arena.floorY ?? 0;
  const containers = [];
  for (const def of arena.props ?? []) {
    if (def.type !== "vx27Container") continue;
    const y = def.y ?? def.floorY ?? floorY;
    containers.push(
      createVx27Container(root, def.x, def.z, y, def.rotationY ?? 0, {
        length: def.length,
        width: def.width,
        height: def.height,
        scale: def.scale,
        propDef: resolveCargoVx27ContainerPropDef(def),
      })
    );
  }
  return containers;
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

  const containers = spawnVx27Containers(group, arena);
  for (const container of containers) enableShadowsOn(container);

  const controlPanels = spawnControlPanels(group, arena, containers);
  for (const panel of controlPanels) enableShadowsOn(panel);

  refreshVx27ContainerRenderLayers(group);
  refreshControlPanelRenderLayers(group);

  for (const def of arena.props ?? []) {
    if (def.type === "oilBarrel") {
      colliders.push(oilBarrelCollider(def, floorY));
    }
    if (def.type === "vx27Container") {
      colliders.push(...vx27ContainerColliders(def, floorY));
    }
    if (def.type === "controlPanel") {
      colliders.push(controlPanelCollider(def, floorY));
    }
  }

  return { barrels, containers, controlPanels };
}

/**
 * Replace oil-barrel colliders after pile regen (props changed, meshes rebuilt separately).
 * @param {import("../physics/Collision.js").ColliderBox[]} colliders
 * @param {import("./loadArena.js").ArenaConfig} arena
 */
export function resyncControlPanelColliders(colliders, arena) {
  const floorY = arena.floorY ?? 0;
  for (let i = colliders.length - 1; i >= 0; i--) {
    if (colliders[i].kind === "controlPanel") colliders.splice(i, 1);
  }
  for (const def of arena.props ?? []) {
    if (def.type === "controlPanel") {
      colliders.push(controlPanelCollider(def, floorY));
    }
  }
}

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
