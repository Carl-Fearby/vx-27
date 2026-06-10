import { formatBindingValue } from "../player/KeyBindings.js";
import { setVx27ContainerDoorOpenTargets } from "./Vx27ContainerDoorAnimation.js";
import { VX27_DOOR_MAX_OPEN_DEG } from "./Vx27ContainerDoorTuning.js";

/** Max distance from camera to door panel (m). */
export const VX27_DOOR_INTERACT_MAX_DIST = 2.8;

const DOOR_MESH_RE = /^vx27_container_door_(front|back)_(left|right)$/;

/** @param {THREE.Group} group */
export function invalidateVx27DoorInteractMeshes(group) {
  delete group.userData.vx27DoorInteractMeshes;
}

/** @param {THREE.Group} group @returns {THREE.Mesh[]} */
function getVx27DoorInteractMeshesForContainer(group) {
  if (group.userData.vx27DoorInteractMeshes) {
    return group.userData.vx27DoorInteractMeshes;
  }
  /** @type {THREE.Mesh[]} */
  const meshes = [];
  group.traverse((obj) => {
    if (obj.isMesh && DOOR_MESH_RE.test(obj.name)) meshes.push(obj);
  });
  group.userData.vx27DoorInteractMeshes = meshes;
  return meshes;
}

/** @param {THREE.Group[]} containers */
export function collectVx27DoorInteractMeshes(containers) {
  /** @type {THREE.Mesh[]} */
  const meshes = [];
  for (const group of containers) {
    meshes.push(...getVx27DoorInteractMeshesForContainer(group));
  }
  return meshes;
}

/** @param {THREE.Object3D | null | undefined} obj */
export function findVx27ContainerGroup(obj) {
  let p = obj;
  while (p) {
    if (p.name === "vx27_container" && p.userData?.vx27Container) return p;
    p = p.parent;
  }
  return null;
}

/** @param {string} meshName */
export function parseVx27DoorMeshName(meshName) {
  const m = meshName.match(DOOR_MESH_RE);
  if (!m) return null;
  return { end: /** @type {"front"|"back"} */ (m[1]), side: /** @type {"left"|"right"} */ (m[2]) };
}

/**
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Mesh[]} doorMeshes
 * @param {number} [maxDist]
 */
export function pickVx27DoorUnderCrosshair(
  raycaster,
  doorMeshes,
  maxDist = VX27_DOOR_INTERACT_MAX_DIST
) {
  if (!doorMeshes.length) return null;
  const hits = raycaster.intersectObjects(doorMeshes, false);
  for (const hit of hits) {
    if (!hit.object?.isMesh) continue;
    const parsed = parseVx27DoorMeshName(hit.object.name);
    if (!parsed) continue;
    const group = findVx27ContainerGroup(hit.object);
    if (!group || hit.distance > maxDist) continue;
    return {
      mesh: hit.object,
      group,
      end: parsed.end,
      side: parsed.side,
      distance: hit.distance,
    };
  }
  return null;
}

/** @param {THREE.Group} group @param {"front"|"back"} end @param {"left"|"right"} side */
function vx27DoorOpenKey(end, side) {
  return `${end}${side === "left" ? "Left" : "Right"}Open`;
}

/** @param {THREE.Group} group @param {"front"|"back"} end @param {"left"|"right"} side */
export function getVx27ContainerLeafOpenDeg(group, end, side) {
  const key = vx27DoorOpenKey(end, side);
  const anim = group.userData.vx27DoorAnim;
  const tuning = group.userData.vx27DoorTuning ?? {};
  return (
    anim?.current?.[key] ?? anim?.target?.[key] ?? tuning[key] ?? 0
  );
}

/** @param {THREE.Group} group @param {"front"|"back"} end @param {"left"|"right"} side */
export function isVx27ContainerLeafOpen(group, end, side) {
  return getVx27ContainerLeafOpenDeg(group, end, side) > VX27_DOOR_MAX_OPEN_DEG / 2;
}

/** @deprecated Use {@link isVx27ContainerLeafOpen} — true when either leaf on the end is open. */
export function isVx27ContainerEndOpen(group, end) {
  return (
    isVx27ContainerLeafOpen(group, end, "left") ||
    isVx27ContainerLeafOpen(group, end, "right")
  );
}

/** @param {THREE.Group} group @param {"front"|"back"} end @param {"left"|"right"} side */
export function toggleVx27ContainerDoorLeaf(group, end, side) {
  const key = vx27DoorOpenKey(end, side);
  const targetDeg = isVx27ContainerLeafOpen(group, end, side)
    ? 0
    : VX27_DOOR_MAX_OPEN_DEG;
  setVx27ContainerDoorOpenTargets(group, { [key]: targetDeg }, { animate: true });
}

/** @deprecated Use {@link toggleVx27ContainerDoorLeaf} */
export function toggleVx27ContainerDoorEnd(group, end) {
  toggleVx27ContainerDoorLeaf(group, end, "left");
  toggleVx27ContainerDoorLeaf(group, end, "right");
}

/** @param {THREE.Group} group @param {"front"|"back"} end @param {"left"|"right"} side */
export function getVx27DoorInteractLabel(group, end, side) {
  return isVx27ContainerLeafOpen(group, end, side)
    ? "Press E to close"
    : "Press E to open";
}

/**
 * @param {THREE.Group} group
 * @param {"front"|"back"} end
 * @param {"left"|"right"} side
 * @param {import("../player/KeyBindings.js").KeyBindingsMap} bindings
 */
export function getVx27DoorInteractPrompt(group, end, side, bindings) {
  const key = formatBindingValue(bindings.interact);
  const action = isVx27ContainerLeafOpen(group, end, side) ? "close" : "open";
  return `Press ${key} to ${action}`;
}
