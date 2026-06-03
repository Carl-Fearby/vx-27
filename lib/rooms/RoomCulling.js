import * as THREE from "three";
import { canPeekIntoAttachedRoom } from "./DoorwayWall.js";
import {
  getAttachedRoomShellBounds,
  isOnCatwalkDeck,
  isPointInsideAttachedRoom,
} from "./RoomPlacement.js";

/**
 * @typedef {{
 *   room: import("../level/loadArena.js").ArenaRoom,
 *   shell: THREE.Object3D,
 *   sunOccluders: THREE.Object3D | null,
 *   lights: THREE.Light[],
 *   bbox: THREE.Box3,
 * }} RoomCullable
 */

/**
 * Build a list of culling records — one per attached room. Each record knows
 * about the room's shell group (the parent of every interior mesh) plus all
 * point lights pinned inside it, and carries a precomputed bounding box used
 * for frustum tests.
 *
 * @param {THREE.Object3D} levelRoot The scene group returned by `createLevelFromArena`.
 * @param {import("../level/loadArena.js").ArenaRoom[]} rooms
 * @param {import("../level/loadArena.js").ArenaFloorExtension[]} [floorExtensions]
 * @param {THREE.Light[]} roomLights All point lights returned by `addRoomLights`.
 * @param {number} arenaHalf
 * @param {"north" | "south"} attachWall
 * @param {number} defaultWallHeight Fallback Y extent for rooms whose config omits `height`.
 * @returns {RoomCullable[]}
 */
export function buildRoomCullables(
  levelRoot,
  rooms,
  roomLights,
  arenaHalf,
  attachWall,
  defaultWallHeight,
  floorExtensions = []
) {
  /** @type {Map<string | null, THREE.Object3D>} */
  const shellsById = new Map();
  /** @type {Map<string | null, THREE.Object3D>} */
  const occludersById = new Map();
  levelRoot.traverse((obj) => {
    if (obj.userData?.roomInterior) {
      shellsById.set(obj.userData.roomId ?? null, obj);
    }
    if (obj.userData?.roomSunOccluders) {
      occludersById.set(obj.userData.roomId ?? null, obj);
    }
  });

  /** @type {RoomCullable[]} */
  const cullables = [];
  for (const room of rooms) {
    const shell = shellsById.get(room.id ?? null);
    if (!shell) continue;
    const bounds = getAttachedRoomShellBounds(room, arenaHalf, attachWall);
    const top = (room.height ?? defaultWallHeight) + 0.1;
    const bbox = new THREE.Box3(
      new THREE.Vector3(
        bounds.minX,
        0,
        Math.min(bounds.northZ, bounds.southZ)
      ),
      new THREE.Vector3(
        bounds.maxX,
        top,
        Math.max(bounds.northZ, bounds.southZ)
      )
    );
    const lights = roomLights.filter(
      (l) => (l.userData?.roomId ?? null) === (room.id ?? null)
    );
    cullables.push({
      room,
      shell,
      sunOccluders: occludersById.get(room.id ?? null) ?? null,
      lights,
      bbox,
    });
  }
  for (const ext of floorExtensions) {
    const shell = shellsById.get(ext.id ?? null);
    if (!shell) continue;
    const bounds = getAttachedRoomShellBounds(ext, arenaHalf, attachWall);
    const top = (ext.height ?? defaultWallHeight) + 0.1;
    const bbox = new THREE.Box3(
      new THREE.Vector3(
        bounds.minX,
        0,
        Math.min(bounds.northZ, bounds.southZ)
      ),
      new THREE.Vector3(
        bounds.maxX,
        top,
        Math.max(bounds.northZ, bounds.southZ)
      )
    );
    const lights = roomLights.filter(
      (l) => (l.userData?.roomId ?? null) === (ext.id ?? null)
    );
    cullables.push({
      room: ext,
      shell,
      sunOccluders: occludersById.get(ext.id ?? null) ?? null,
      lights,
      bbox,
    });
  }
  return cullables;
}

const _projScreenMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();

export function setSunOccludersCast(occluders, cast) {
  if (!occluders) return;
  occluders.traverse((obj) => {
    if (obj.isMesh && obj.userData?.isShadowOccluder) {
      obj.castShadow = cast;
    }
  });
}

/** Match in-room / left-room shadow occluder state during GPU warmup. */
export function setAllLevelRoomSunOccludersCast(levelRoot, cast) {
  if (!levelRoot) return;
  levelRoot.traverse((obj) => {
    if (obj.userData?.roomSunOccluders) setSunOccludersCast(obj, cast);
  });
}

/**
 * Update room visibility for the current frame.
 *
 * On the catwalk above an attached room, the interior pass runs when the camera
 * frustum sees the shell. Over the room footprint (not at the arena mouth),
 * require door alignment so the east deck edge does not pick up room-pass dark
 * geometry (x ≈ 4.8, z ≈ −12). At the deck hole / door mouth the player stands
 * outside the room footprint (arena side of the wall) — frustum-only, same as
 * the arena floor rule below.
 *
 * Room sun occluders (invisible world-layer depth boxes) only cast when the
 * player is inside at floor level — on the outdoor catwalk they project a
 * phantom rectangular shadow onto the deck.
 *
 * @param {RoomCullable[]} cullables
 * @param {THREE.Camera} camera
 * @param {{ x: number, z: number, footY?: number }} playerPos Player feet (not camera).
 * @param {number} arenaHalf
 * @param {"north" | "south"} attachWall
 * @param {number | null} [catwalkDeckY]
 * @param {import("./DoorwayWall.js").DoorOpening[]} [doorOpenings]
 * @param {number} [wallThickness=0.5]
 * @returns {{ visibleCount: number, insideRoomIds: string[] }} Visible room count + rooms player stands in.
 */
export function updateRoomCulling(
  cullables,
  camera,
  playerPos,
  arenaHalf,
  attachWall,
  catwalkDeckY = null,
  doorOpenings = [],
  wallThickness = 0.5
) {
  _projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  _frustum.setFromProjectionMatrix(_projScreenMatrix);

  const footY = playerPos.footY ?? 0;
  const onCatwalk = isOnCatwalkDeck(footY, catwalkDeckY);
  const peek = canPeekIntoAttachedRoom(
    playerPos.x,
    playerPos.z,
    doorOpenings,
    attachWall,
    arenaHalf,
    wallThickness
  );

  let visibleCount = 0;
  /** @type {string[]} */
  const insideRoomIds = [];
  for (const cullable of cullables) {
    const inFootprint = isPointInsideAttachedRoom(
      playerPos.x,
      playerPos.z,
      cullable.room,
      arenaHalf,
      attachWall,
      wallThickness
    );
    const insideAtFloor = inFootprint && !onCatwalk;
    const inFrustum = _frustum.intersectsBox(cullable.bbox);
    let visible = false;
    if (insideAtFloor) {
      visible = true;
      if (cullable.room.id) insideRoomIds.push(cullable.room.id);
    } else if (onCatwalk) {
      visible = inFrustum && (!inFootprint || peek);
    } else {
      visible = inFrustum;
    }
    cullable.shell.visible = visible;
    for (const light of cullable.lights) {
      light.visible = visible;
    }
    setSunOccludersCast(cullable.sunOccluders, insideAtFloor);
    if (visible) visibleCount += 1;
  }
  return { visibleCount, insideRoomIds };
}
