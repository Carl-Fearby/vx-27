import { FLOOR_WALL_OVERLAP } from "../level/LevelConstants.js";
import { ROOM_CATWALK_MOUTH_PAD_DEFAULT } from "./RoomCatwalkTuning.js";

/** Coplanar join between arena L-deck and room catwalk mouth (metres). */
export const CATWALK_DECK_JOIN = 0.02;

/**
 * @param {"north" | "south"} attachWall
 * @param {number} arenaHalf
 * @param {number} arenaWallThickness
 */
export function getArenaWallCenterZ(attachWall, arenaHalf, arenaWallThickness) {
  return attachWall === "north"
    ? -arenaHalf - arenaWallThickness / 2
    : arenaHalf + arenaWallThickness / 2;
}

/**
 * X intervals in [x0, x1] that lie outside [excludeMin, excludeMax].
 * @returns {[number, number][]}
 */
export function subtractXInterval(x0, x1, excludeMin, excludeMax) {
  if (excludeMin == null || excludeMax == null || x1 <= excludeMin || x0 >= excludeMax) {
    return [[x0, x1]];
  }
  const spans = [];
  if (x0 < excludeMin) spans.push([x0, Math.min(x1, excludeMin)]);
  if (x1 > excludeMax) spans.push([Math.max(x0, excludeMax), x1]);
  return spans.filter(([a, b]) => b - a > 0.01);
}

/**
 * Arena wall / floor should not occupy attached room width on the doorway wall.
 * @param {import("../level/loadArena.js").ArenaRoom[]} rooms
 * @param {"north" | "south"} attachWall
 * @param {import("../level/loadArena.js").ArenaDoorway} [doorway]
 * @returns {{ minX: number, maxX: number } | null}
 */
export function getRoomFootprintCutout(rooms, attachWall, doorways = []) {
  const list = Array.isArray(doorways)
    ? doorways
    : doorways
      ? [doorways]
      : [];
  const onWall = list.filter((doorway) => (doorway.wall ?? "north") === attachWall);
  if (!onWall.length || !rooms?.length) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const room of rooms) {
    const halfW = room.width / 2;
    minX = Math.min(minX, room.centerX - halfW);
    maxX = Math.max(maxX, room.centerX + halfW);
  }
  return minX < maxX ? { minX, maxX } : null;
}

/** Arena-facing inner face of the perimeter wall (playable side of the doorway). */
export function getArenaDoorInnerZ(attachWall, arenaHalf, arenaWallThickness) {
  const wallZ = getArenaWallCenterZ(attachWall, arenaHalf, arenaWallThickness);
  return attachWall === "north"
    ? wallZ + arenaWallThickness / 2
    : wallZ - arenaWallThickness / 2;
}

/** Back face of the arena perimeter wall (room side of the slab). */
export function getArenaWallOuterZ(attachWall, arenaHalf, arenaWallThickness) {
  const wallZ = getArenaWallCenterZ(attachWall, arenaHalf, arenaWallThickness);
  return attachWall === "north"
    ? wallZ - arenaWallThickness / 2
    : wallZ + arenaWallThickness / 2;
}

/**
 * Z of the room floor edge that faces the arena — flush with the back of the
 * arena wall slab, never inside its thickness (which caused the interior floor
 * to bleed through the wall).
 */
export function getRoomFloorSouthZ(
  attachWall,
  arenaHalf,
  arenaWallThickness,
  _roomWallThickness
) {
  return getArenaWallOuterZ(attachWall, arenaHalf, arenaWallThickness);
}

/**
 * Axis-aligned hole to punch out of the arena deck under an attached room interior.
 * @param {import("../level/loadArena.js").ArenaRoom} room
 * @param {"north" | "south"} attachWall
 * @param {number} arenaHalf
 * @param {number} [arenaWallThickness]
 */
export function getAttachedRoomFloorHole(
  room,
  attachWall,
  arenaHalf,
  arenaWallThickness = 0.5
) {
  const wallThickness = room.wallThickness ?? 0.35;
  const halfW = room.width / 2;
  const halfD = room.depth / 2;
  const roomCenterZ = getAttachedRoomCenterZ(
    room,
    arenaHalf,
    attachWall,
    arenaWallThickness
  );
  const outerZ = getArenaWallOuterZ(attachWall, arenaHalf, arenaWallThickness);
  const roomFloorNorthZ =
    attachWall === "north"
      ? roomCenterZ - halfD + wallThickness
      : roomCenterZ + halfD - wallThickness;
  const minZ =
    attachWall === "north"
      ? Math.min(outerZ, roomFloorNorthZ) - FLOOR_WALL_OVERLAP
      : Math.min(outerZ, roomFloorNorthZ);
  // Align the deck hole with the wall back face — the old inset left a vertical
  // lip and a walk-support dead zone in the doorway / solid-wall band.
  const maxZ =
    attachWall === "north"
      ? Math.max(outerZ, roomFloorNorthZ)
      : Math.max(outerZ, roomFloorNorthZ) + FLOOR_WALL_OVERLAP;
  return {
    minX: room.centerX - halfW - FLOOR_WALL_OVERLAP,
    maxX: room.centerX + halfW + FLOOR_WALL_OVERLAP,
    minZ: Math.min(minZ, maxZ),
    maxZ: Math.max(minZ, maxZ),
  };
}

/**
 * Room interior floor mesh — flush with the arena wall back face.
 */
export function getAttachedRoomFloorMeshBounds(
  room,
  attachWall,
  arenaHalf,
  arenaWallThickness = 0.5
) {
  const hole = getAttachedRoomFloorHole(room, attachWall, arenaHalf, arenaWallThickness);
  const outerZ = getArenaWallOuterZ(attachWall, arenaHalf, arenaWallThickness);
  return {
    ...hole,
    maxZ: attachWall === "north" ? outerZ : hole.maxZ,
    minZ: attachWall === "south" ? outerZ : hole.minZ,
  };
}

/**
 * Shared placement math for rooms attached to the arena north/south wall.
 * @param {import("../level/loadArena.js").ArenaRoom} room
 * @param {number} arenaHalf
 * @param {"north" | "south"} attachWall
 * @param {number} [arenaWallThickness]
 */
export function getAttachedRoomCenterZ(
  room,
  arenaHalf,
  attachWall,
  arenaWallThickness = 0.5
) {
  const depth = room.depth;
  const roomWallThickness = room.wallThickness ?? 0.35;
  const floorSouthZ = getRoomFloorSouthZ(
    attachWall,
    arenaHalf,
    arenaWallThickness,
    roomWallThickness
  );
  return attachWall === "north"
    ? floorSouthZ - depth / 2 + roomWallThickness
    : floorSouthZ + depth / 2 - roomWallThickness;
}

/**
 * Interior shell of the room (inside wall faces; stops at doorway, not arena floor).
 * @param {import("../level/loadArena.js").ArenaRoom} room
 * @param {number} arenaHalf
 * @param {"north" | "south"} attachWall
 * @param {number} [arenaWallThickness]
 */
export function getAttachedRoomShellBounds(
  room,
  arenaHalf,
  attachWall,
  arenaWallThickness = 0.5
) {
  const { centerX, width, depth, wallThickness = 0.35 } = room;
  const halfW = width / 2;
  const halfD = depth / 2;
  const roomCenterZ = getAttachedRoomCenterZ(
    room,
    arenaHalf,
    attachWall,
    arenaWallThickness
  );
  const backZ =
    attachWall === "north"
      ? roomCenterZ - halfD + wallThickness / 2
      : roomCenterZ + halfD - wallThickness / 2;

  const minX = centerX - halfW;
  const maxX = centerX + halfW;
  const northZ = backZ - wallThickness / 2;
  const southZ = getRoomFloorSouthZ(
    attachWall,
    arenaHalf,
    arenaWallThickness,
    wallThickness
  );

  return {
    centerX,
    roomCenterZ,
    minX,
    maxX,
    northZ,
    southZ,
  };
}

/**
 * @param {number} x
 * @param {number} z
 * @param {import("../level/loadArena.js").ArenaRoom} room
 * @param {number} arenaHalf
 * @param {"north" | "south"} attachWall
 */
export function isPointInsideAttachedRoom(
  x,
  z,
  room,
  arenaHalf,
  attachWall,
  arenaWallThickness = 0.5
) {
  const halfW = room.width / 2;
  const halfD = room.depth / 2;
  const roomCenterZ = getAttachedRoomCenterZ(
    room,
    arenaHalf,
    attachWall,
    arenaWallThickness
  );
  return (
    x >= room.centerX - halfW &&
    x <= room.centerX + halfW &&
    z >= roomCenterZ - halfD &&
    z <= roomCenterZ + halfD
  );
}

/**
 * @param {number} x
 * @param {number} z
 * @param {import("../level/loadArena.js").ArenaRoom[]} rooms
 * @param {number} arenaHalf
 * @param {"north" | "south"} attachWall
 */
export function isPointInsideAnyRoom(x, z, rooms, arenaHalf, attachWall) {
  for (const room of rooms) {
    if (isPointInsideAttachedRoom(x, z, room, arenaHalf, attachWall)) {
      return true;
    }
  }
  return false;
}

/** Foot Y at or above this offset below the catwalk deck counts as on the catwalk. */
export const CATWALK_FOOT_SLACK = 1.5;

export function isOnCatwalkDeck(footY, catwalkDeckY) {
  return catwalkDeckY != null && footY >= catwalkDeckY - CATWALK_FOOT_SLACK;
}

/**
 * Room-interior lighting / viewmodel zone — requires floor-level feet inside the
 * room footprint, not standing on the catwalk deck above an attached room.
 */
export function isPlayerInsideRoomForLighting(
  x,
  z,
  footY,
  rooms,
  arenaHalf,
  attachWall,
  catwalkDeckY
) {
  if (!isPointInsideAnyRoom(x, z, rooms, arenaHalf, attachWall)) return false;
  if (isOnCatwalkDeck(footY, catwalkDeckY)) return false;
  return true;
}

/**
 * Outdoor catwalk slab footprint above an attached room — separate from the
 * interior shell. Always bridges to the arena inner edge so there is no gap
 * at the mouth; optional mouthPad adds extra overhang toward the arena.
 *
 * @param {import("../level/loadArena.js").ArenaRoom} room
 * @param {"north" | "south"} attachWall
 * @param {number} arenaHalf
 * @param {number} arenaWallThickness
 * @param {number} innerHalf Arena playable half (size/2 − wallStandoff)
 * @param {number} [deckPad=0.25]
 * @param {number} [mouthPad=ROOM_CATWALK_MOUTH_PAD_DEFAULT]
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number }}
 */
export function getRoomCatwalkDeckPiece(
  room,
  attachWall,
  arenaHalf,
  arenaWallThickness,
  innerHalf,
  deckPad = 0.25,
  mouthPad = ROOM_CATWALK_MOUTH_PAD_DEFAULT
) {
  const floorBounds = getAttachedRoomFloorMeshBounds(
    room,
    attachWall,
    arenaHalf,
    arenaWallThickness
  );
  const halfW = room.width / 2;
  const minX = room.centerX - halfW - deckPad;
  const maxX = room.centerX + halfW + deckPad;
  const arenaMouthZ =
    attachWall === "north" ? -innerHalf : innerHalf;

  if (attachWall === "north") {
    return {
      minX,
      maxX,
      minZ: floorBounds.minZ - deckPad,
      maxZ: Math.max(
        floorBounds.maxZ + mouthPad,
        arenaMouthZ + CATWALK_DECK_JOIN
      ),
    };
  }
  return {
    minX,
    maxX,
    minZ: Math.min(
      floorBounds.minZ - mouthPad,
      arenaMouthZ - CATWALK_DECK_JOIN
    ),
    maxZ: floorBounds.maxZ + deckPad,
  };
}

/**
 * True when the player stands on the outdoor catwalk deck above a room footprint.
 */
export function isCatwalkAboveAttachedRoom(
  x,
  z,
  footY,
  room,
  attachWall,
  arenaHalf,
  arenaWallThickness,
  innerHalf,
  catwalkDeckY,
  deckPad = 0.25,
  mouthPad = ROOM_CATWALK_MOUTH_PAD_DEFAULT
) {
  if (!isOnCatwalkDeck(footY, catwalkDeckY)) return false;
  const piece = getRoomCatwalkDeckPiece(
    room,
    attachWall,
    arenaHalf,
    arenaWallThickness,
    innerHalf,
    deckPad,
    mouthPad
  );
  return (
    x >= piece.minX &&
    x <= piece.maxX &&
    z >= piece.minZ &&
    z <= piece.maxZ
  );
}

/**
 * True when standing on any outdoor catwalk slab above an attached room interior.
 */
export function isCatwalkAboveAnyRoom(
  x,
  z,
  footY,
  rooms,
  attachWall,
  arenaHalf,
  arenaWallThickness,
  innerHalf,
  catwalkDeckY,
  deckPad = 0.25,
  mouthPad = ROOM_CATWALK_MOUTH_PAD_DEFAULT
) {
  if (!rooms?.length || !isOnCatwalkDeck(footY, catwalkDeckY)) return false;
  for (const room of rooms) {
    if (
      isCatwalkAboveAttachedRoom(
        x,
        z,
        footY,
        room,
        attachWall,
        arenaHalf,
        arenaWallThickness,
        innerHalf,
        catwalkDeckY,
        deckPad,
        mouthPad
      )
    ) {
      return true;
    }
  }
  return false;
}
