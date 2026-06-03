import { pointInDoorwayPassage } from "../physics/Collision.js";
import {
  getArenaDoorInnerZ,
  getArenaWallOuterZ,
  subtractXInterval,
} from "./RoomPlacement.js";

/** @typedef {import("../level/loadArena.js").ArenaDoorway} ArenaDoorway */
/** @typedef {import("../level/loadArena.js").ArenaConfig} ArenaConfig */

/**
 * @typedef {{
 *   centerX: number,
 *   width: number,
 *   height: number,
 *   left: number,
 *   right: number,
 *   arch: boolean,
 *   radius: number,
 *   rectTop: number,
 * }} DoorOpening
 */

/** @param {ArenaConfig} arena @returns {ArenaDoorway[]} */
export function getArenaDoorways(arena) {
  if (arena.doorways?.length) return arena.doorways;
  if (arena.doorway) return [arena.doorway];
  return [];
}

/** @param {ArenaConfig} arena @returns {"north" | "south"} */
export function getArenaAttachWall(arena) {
  const first = getArenaDoorways(arena)[0];
  return first?.wall === "south" ? "south" : "north";
}

/** @param {ArenaConfig} arena @returns {ArenaDoorway | null} */
export function getPrimaryDoorway(arena) {
  return getArenaDoorways(arena)[0] ?? null;
}

/** @param {ArenaConfig} arena @param {"north" | "south"} side @returns {ArenaDoorway[]} */
export function getDoorwaysOnWall(arena, side) {
  return getArenaDoorways(arena).filter(
    (doorway) => (doorway.wall ?? "north") === side
  );
}

/** @param {ArenaDoorway} doorway @returns {DoorOpening} */
export function resolveDoorOpening(doorway) {
  const width = doorway.width ?? 1.1;
  const height = doorway.height ?? 2.05;
  const centerX = doorway.centerX ?? 0;
  const arch = doorway.top === "arch";
  const radius = arch ? width / 2 : 0;
  const rectTop = arch ? height - radius : height;
  return {
    centerX,
    width,
    height,
    left: centerX - width / 2,
    right: centerX + width / 2,
    arch,
    radius,
    rectTop,
  };
}

/**
 * @param {number} x0
 * @param {number} x1
 * @param {{ minX: number, maxX: number }[]} exclusions
 * @returns {[number, number][]}
 */
export function subtractXIntervals(x0, x1, exclusions) {
  let spans = [[x0, x1]];
  for (const ex of exclusions) {
    const next = [];
    for (const [a, b] of spans) {
      next.push(...subtractXInterval(a, b, ex.minX, ex.maxX));
    }
    spans = next;
  }
  return spans.filter(([a, b]) => b - a > 0.01);
}

/** Semicircle arch height at x (opening is below this Y). */
export function archSillY(opening, x) {
  if (!opening.arch || opening.radius <= 0) return opening.rectTop;
  const dx = x - opening.centerX;
  if (Math.abs(dx) >= opening.radius) return opening.rectTop;
  return opening.rectTop + Math.sqrt(opening.radius * opening.radius - dx * dx);
}

/** Above this foot Y the ground-floor door arch no longer caps headroom (catwalk band). */
const DOORWAY_HEADROOM_FOOT_Y_SLACK = 2.5;

/** Default player radius — matches {@link buildDoorwayPassages}. */
export const DOORWAY_PASSAGE_PLAYER_RADIUS = 0.35;
const DOORWAY_PASSAGE_X_INSET = 0.04;

/** Horizontal shoulder pad each side of a door opening in passage / headroom checks. */
export function doorwayPassageXPad(
  playerRadius = DOORWAY_PASSAGE_PLAYER_RADIUS
) {
  return playerRadius + DOORWAY_PASSAGE_X_INSET;
}

const DOORWAY_MOUTH_X_PAD = 0.45;
/** How far into the arena from the inner wall face still counts as the door mouth. */
const DOORWAY_MOUTH_ARENA_DEPTH = 1.35;
/** Into the wall / room threshold from the inner wall face. */
const DOORWAY_MOUTH_ROOM_DEPTH = 0.65;

function isDoorwayMouthZ(z, attachWall, arenaInnerZ) {
  if (attachWall === "north") {
    return (
      (z > arenaInnerZ && z <= arenaInnerZ + DOORWAY_MOUTH_ARENA_DEPTH) ||
      (z <= arenaInnerZ && z >= arenaInnerZ - DOORWAY_MOUTH_ROOM_DEPTH)
    );
  }
  return (
    (z < arenaInnerZ && z >= arenaInnerZ - DOORWAY_MOUTH_ARENA_DEPTH) ||
    (z >= arenaInnerZ && z <= arenaInnerZ + DOORWAY_MOUTH_ROOM_DEPTH)
  );
}

/**
 * True when (x, z) is in the narrow volume at a door opening — arena floor or
 * catwalk approach, not the full arena span at door centerX.
 *
 * @param {number} x
 * @param {number} z
 * @param {DoorOpening[]} openings
 * @param {"north" | "south"} attachWall
 * @param {number} arenaHalf
 * @param {number} wallThickness
 */
export function isAtDoorwayMouth(
  x,
  z,
  openings,
  attachWall,
  arenaHalf,
  wallThickness
) {
  if (!openings?.length) return false;
  const arenaInnerZ = getArenaDoorInnerZ(attachWall, arenaHalf, wallThickness);
  if (!isDoorwayMouthZ(z, attachWall, arenaInnerZ)) return false;
  for (const op of openings) {
    if (x >= op.left - DOORWAY_MOUTH_X_PAD && x <= op.right + DOORWAY_MOUTH_X_PAD) {
      return true;
    }
  }
  return false;
}

/**
 * True when (x, z) is on the arena/catwalk approach side and aligned with a
 * door opening — not the full room width (that leaked interior onto solid wall).
 *
 * @param {number} x
 * @param {number} z
 * @param {DoorOpening[]} openings
 * @param {"north" | "south"} attachWall
 * @param {number} arenaHalf
 * @param {number} wallThickness
 */
export function canPeekIntoAttachedRoom(
  x,
  z,
  openings,
  attachWall,
  arenaHalf,
  wallThickness
) {
  return isAtDoorwayMouth(x, z, openings, attachWall, arenaHalf, wallThickness);
}

/**
 * Opening ceiling height at (x, z) when standing in a doorway passage — uses the
 * arch curve, not sliced lintel colliders (those sit lower and falsely force crouch).
 * Only applies at arena floor height; catwalk walkers use normal deck colliders.
 *
 * @param {number} x
 * @param {number} z
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }[]} passages
 * @param {DoorOpening[]} openings
 * @param {number} [footY=0]
 * @param {number} [floorY=0]
 * @param {number} [playerRadius=DOORWAY_PASSAGE_PLAYER_RADIUS]
 * @returns {number | null}
 */
export function getDoorwayHeadroomCeilingY(
  x,
  z,
  passages,
  openings,
  footY = 0,
  floorY = 0,
  playerRadius = DOORWAY_PASSAGE_PLAYER_RADIUS
) {
  if (!passages?.length || !openings?.length) return null;
  if (footY >= floorY + DOORWAY_HEADROOM_FOOT_Y_SLACK) return null;
  if (!pointInDoorwayPassage(x, z, passages)) return null;

  const xPad = doorwayPassageXPad(playerRadius);
  for (const op of openings) {
    if (x < op.left - xPad || x > op.right + xPad) continue;
    // Full opening height for the whole passage width — arch curve and lintel
    // slices sit lower at the jambs and falsely force crouch if we use archSillY.
    return op.height;
  }
  return null;
}

const ARCH_LINTEL_SLICES = 18;

/**
 * @param {(x0: number, x1: number, spanHeight: number, centerY: number) => void} pushSpan
 * @param {DoorOpening} opening
 * @param {number} wallHeight
 */
export function pushDoorLintelSpans(pushSpan, opening, wallHeight) {
  if (opening.arch) {
    const slices = ARCH_LINTEL_SLICES;
    const sliceW = opening.width / slices;
    for (let i = 0; i < slices; i++) {
      const x0 = opening.left + i * sliceW;
      const x1 = opening.left + (i + 1) * sliceW;
      const xMid = (x0 + x1) / 2;
      const sillY = archSillY(opening, xMid);
      const lintelH = wallHeight - sillY;
      if (lintelH > 0.05) {
        pushSpan(x0, x1, lintelH, sillY + lintelH / 2);
      }
    }
    return;
  }

  const lintelH = wallHeight - opening.height;
  if (lintelH > 0.1) {
    pushSpan(opening.left, opening.right, lintelH, opening.height + lintelH / 2);
  }
}

/**
 * @param {(x0: number, x1: number, bottomY: number, topY: number) => void} pushSpan
 * @param {DoorOpening} opening
 * @param {number} wallHeight
 */
export function pushDoorColliders(pushSpan, opening, wallHeight) {
  pushDoorLintelSpans(
    (x0, x1, spanHeight, centerY) =>
      pushSpan(x0, x1, centerY - spanHeight / 2, centerY + spanHeight / 2),
    opening,
    wallHeight
  );
}

/** @param {DoorOpening[]} openings @returns {{ minX: number, maxX: number }[]} */
export function openingsToExclusions(openings) {
  return openings.map((opening) => ({
    minX: opening.left,
    maxX: opening.right,
  }));
}

/** @param {DoorOpening[]} openings */
export function sortOpeningsByX(openings) {
  return [...openings].sort((a, b) => a.left - b.left);
}

/**
 * Doorway corridors on the attach wall — exempt from the arena `innerHalf`
 * clamp so the player can walk through the wall into attached rooms while
 * solid wall sections keep the same inset as east/west/south.
 *
 * @param {ArenaDoorway[]} doorways
 * @param {"north" | "south"} attachWall
 * @param {number} half
 * @param {number} wallThickness
 * @param {number} innerHalf
 * @param {number} roomAttachExtentZ `boundsMinZ` (north attach) or `boundsMaxZ` (south)
 * @param {number} [playerRadius=0.35]
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number }[]}
 */
export function buildDoorwayPassages(
  doorways,
  attachWall,
  half,
  wallThickness,
  innerHalf,
  roomAttachExtentZ,
  playerRadius = DOORWAY_PASSAGE_PLAYER_RADIUS
) {
  const pad = 0.04;
  const onWall = doorways.filter((d) => (d.wall ?? attachWall) === attachWall);
  if (!onWall.length) return [];

  const arenaInnerZ = getArenaDoorInnerZ(attachWall, half, wallThickness);
  const outerZ = getArenaWallOuterZ(attachWall, half, wallThickness);
  const xPad = doorwayPassageXPad(playerRadius);
  /** @type {{ minX: number, maxX: number, minZ: number, maxZ: number }[]} */
  const passages = [];

  for (const doorway of onWall) {
    const op = resolveDoorOpening(doorway);
    if (attachWall === "north") {
      passages.push({
        minX: op.left - xPad,
        maxX: op.right + xPad,
        minZ: Math.min(roomAttachExtentZ, outerZ, arenaInnerZ) - pad,
        // Span from the room through the wall into the arena so approach
        // from inside the arena counts as "in passage" (not just north of innerHalf).
        maxZ: innerHalf - pad,
      });
    } else {
      passages.push({
        minX: op.left - xPad,
        maxX: op.right + xPad,
        minZ: -innerHalf + pad,
        maxZ: Math.max(roomAttachExtentZ, outerZ, arenaInnerZ) + pad,
      });
    }
  }
  return passages;
}
