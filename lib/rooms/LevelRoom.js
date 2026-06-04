import * as THREE from "three";
import { setRoomInteriorLayer, setWorldLayer } from "../lighting/LightingLayers.js";
import { addShadowOccluderBox, addShadowOccluderHorizontalSlab } from "../lighting/ShadowOccluders.js";
import {
  getArenaDoorInnerZ,
  getRoomSideHalfWallSpan,
  getAttachedRoomCenterZ,
  getAttachedRoomFloorMeshBounds,
  getRoomFloorSouthZ,
} from "./RoomPlacement.js";
import { buildRoomPillarShell } from "./RoomPillarShell.js";
import {
  applyContinuousBoxWorldUVs,
  applyDeckPieceWorldUVs,
  applyDoorwayExtrudeUVs,
} from "../level/WallBoxUV.js";
import {
  DOORWAY_JAMB_SOLID_OVERLAP,
  openingsToExclusions,
  resolveDoorOpening,
  subtractXIntervals,
} from "./DoorwayWall.js";
import {
  FLOOR_THICKNESS,
  FLOOR_WALL_OVERLAP,
  FLOOR_Y,
  WALL_FLOOR_EMBED,
  WALL_STANDOFF,
  WALL_VISUAL_FLOOR_EMBED,
  ROOM_FLOOR_LIFT,
  wallCenterY,
} from "../level/LevelConstants.js";

/** Ceiling drops slightly into wall tops so corners do not leak the outdoor pass. */
const CEILING_WALL_OVERLAP = 0.04;
const CORNER_SEAL_SIZE = 0.14;

/** Z extent for side walls along the doorway (through the room-side half wall). */
function getDoorwaySideWallMeetZ(attachWall, arenaHalf, arenaWallThickness) {
  return getRoomSideHalfWallSpan(attachWall, arenaHalf, arenaWallThickness).meetZ;
}

/** Room floor is a visual overlay — arena deck is cut out underneath (Level.js). */
function floorMaterial(mat) {
  if (!mat?.clone) return mat;
  const m = mat.clone();
  m.depthWrite = true;
  m.depthTest = true;
  m.polygonOffset = true;
  m.polygonOffsetFactor = 4;
  m.polygonOffsetUnits = 4;
  return m;
}

function wallMaterial(mat) {
  if (!mat?.clone) return mat;
  const m = mat.clone();
  m.polygonOffset = true;
  m.polygonOffsetFactor = 3;
  m.polygonOffsetUnits = 3;
  return m;
}

const EXTERIOR_WALL_SHELL = 0.04;

/** Sunlit outdoor faces — world pass, visible from the catwalk above. */
function exteriorWallMaterial(mat) {
  if (!mat?.clone) return mat;
  const m = mat.clone();
  m.roughness = 1;
  m.metalness = 0;
  m.polygonOffset = true;
  m.polygonOffsetFactor = 1;
  m.polygonOffsetUnits = 1;
  if (m.color) m.color.multiplyScalar(0.82);
  return m;
}

/**
 * Textured cladding on the room's outer shell (world layer). Interior walls stay
 * on the room pass; these faces read from the catwalk and perimeter deck.
 */
function addRoomExteriorWalls(
  group,
  wallMatBase,
  centerX,
  width,
  height,
  wallThickness,
  halfW,
  wallY,
  backZ,
  sideWallDepth,
  sideWallCenterZ,
  attachWall,
  wallTile
) {
  const extMat = exteriorWallMaterial(wallMatBase);
  const extGroup = new THREE.Group();
  extGroup.name = "room_exterior_walls";
  extGroup.userData.roomExteriorShell = true;
  extGroup.userData.bulletSurfaceKind = "room_exterior";

  const backOuterZ =
    attachWall === "north"
      ? backZ - wallThickness / 2 - EXTERIOR_WALL_SHELL / 2
      : backZ + wallThickness / 2 + EXTERIOR_WALL_SHELL / 2;
  const backGeo = new THREE.BoxGeometry(width, height, EXTERIOR_WALL_SHELL);
  applyContinuousBoxWorldUVs(backGeo, height, wallTile);
  const back = new THREE.Mesh(backGeo, extMat);
  back.position.set(centerX, wallY, backOuterZ);
  back.castShadow = true;
  back.receiveShadow = true;
  extGroup.add(back);

  const leftOuterX = centerX - halfW - EXTERIOR_WALL_SHELL / 2;
  const sideGeo = new THREE.BoxGeometry(EXTERIOR_WALL_SHELL, height, sideWallDepth);
  applyContinuousBoxWorldUVs(sideGeo, height, wallTile);

  const left = new THREE.Mesh(sideGeo, extMat);
  left.position.set(leftOuterX, wallY, sideWallCenterZ);
  left.castShadow = true;
  left.receiveShadow = true;
  extGroup.add(left);

  const rightOuterX = centerX + halfW + EXTERIOR_WALL_SHELL / 2;
  const right = new THREE.Mesh(sideGeo, extMat);
  right.position.set(rightOuterX, wallY, sideWallCenterZ);
  right.castShadow = true;
  right.receiveShadow = true;
  extGroup.add(right);

  extGroup.traverse((obj) => {
    if (obj.isMesh) setWorldLayer(obj);
  });
  group.add(extGroup);
}

function overlayWallMaterial(baseMat, darken = false) {
  if (!baseMat?.clone) return baseMat;
  const m = baseMat.clone();
  m.polygonOffset = true;
  m.polygonOffsetFactor = -4;
  m.polygonOffsetUnits = -4;
  m.depthWrite = true;
  if (darken && m.color) m.color.multiplyScalar(0.92);
  return m;
}

const OVERLAY_ARCH_SEGMENTS = 32;

/**
 * Room-pass cladding on the arena doorway wall inside an attached footprint.
 * @param {THREE.Object3D} roomShell
 * @param {THREE.Material} wallMatBase
 * @param {boolean} [matchWallTexture=true] When false, uses slightly darkened room-wall clone.
 */
export function addInteriorDoorwayWallOverlay(
  roomShell,
  wallMatBase,
  centerX,
  width,
  height,
  attachWall,
  arenaHalf,
  arenaWallThickness,
  doorways,
  wallY,
  wallTile,
  matchWallTexture = true
) {
  const onWall = doorways.filter(
    (doorway) => (doorway.wall ?? "north") === attachWall
  );
  if (!onWall.length) return;

  const openings = onWall.map(resolveDoorOpening);
  const halfW = width / 2;
  const roomLeft = centerX - halfW;
  const roomRight = centerX + halfW;
  const { extrudeBaseZ, extrudeDepth } = getRoomSideHalfWallSpan(
    attachWall,
    arenaHalf,
    arenaWallThickness
  );

  const floorLine = wallY - height / 2;
  const topY = wallY + height / 2;

  const shape = new THREE.Shape();
  shape.moveTo(roomLeft, floorLine);
  shape.lineTo(roomRight, floorLine);
  shape.lineTo(roomRight, topY);
  shape.lineTo(roomLeft, topY);
  shape.closePath();

  for (const op of openings) {
    const doorH = Math.min(op.height, height);
    const arch = op.arch && op.radius > 0;
    const rectTop = arch ? doorH - op.radius : doorH;
    const lip = DOORWAY_JAMB_SOLID_OVERLAP;
    const cutLeft = op.left + lip;
    const cutRight = op.right - lip;

    const hole = new THREE.Path();
    if (arch) {
      hole.moveTo(cutLeft, floorLine);
      hole.lineTo(cutLeft, floorLine + rectTop);
      hole.absarc(
        op.centerX,
        floorLine + rectTop,
        Math.max(op.radius - lip, op.radius * 0.92),
        Math.PI,
        0,
        true
      );
      hole.lineTo(cutRight, floorLine);
      hole.closePath();
    } else {
      hole.moveTo(cutLeft, floorLine);
      hole.lineTo(cutLeft, floorLine + doorH);
      hole.lineTo(cutRight, floorLine + doorH);
      hole.lineTo(cutRight, floorLine);
      hole.closePath();
    }
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: OVERLAY_ARCH_SEGMENTS,
  });
  geo.translate(0, 0, extrudeBaseZ);
  applyDoorwayExtrudeUVs(
    geo,
    arenaHalf,
    floorLine,
    wallTile,
    extrudeDepth,
    openings,
    floorLine
  );

  const mat = overlayWallMaterial(wallMatBase, !matchWallTexture);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.roomArenaWallOverlay = true;
  mesh.userData.skipBulletSurface = true;
  roomShell.add(mesh);
}

/**
 * Visual-only "paint" on the arena doorway wall (room interior pass). Covers jambs/lintel
 * inside the room width so outdoor sun does not read through; no colliders.
 * Uses ExtrudeGeometry with smooth arch curves to match the outer wall.
 */
function addRoomArenaWallDarkOverlays(
  roomShell,
  wallMatBase,
  centerX,
  width,
  height,
  attachWall,
  arenaHalf,
  arenaWallThickness,
  doorways,
  wallY,
  wallTile
) {
  addInteriorDoorwayWallOverlay(
    roomShell,
    wallMatBase,
    centerX,
    width,
    height,
    attachWall,
    arenaHalf,
    arenaWallThickness,
    doorways,
    wallY,
    wallTile,
    false
  );
  addInteriorDoorwayJambEdgeSeals(
    roomShell,
    wallMaterial(wallMatBase),
    doorways,
    attachWall,
    arenaHalf,
    arenaWallThickness,
    height,
    wallY
  );
}

/** Thin vertical strips on doorway cut edges (room pass) — backs up solid lip overlap. */
function addInteriorDoorwayJambEdgeSeals(
  roomShell,
  wallMat,
  doorways,
  attachWall,
  arenaHalf,
  arenaWallThickness,
  height,
  wallY
) {
  const onWall = doorways.filter(
    (doorway) => (doorway.wall ?? "north") === attachWall
  );
  if (!onWall.length) return;

  const openings = onWall.map(resolveDoorOpening);
  const { extrudeBaseZ, extrudeDepth } = getRoomSideHalfWallSpan(
    attachWall,
    arenaHalf,
    arenaWallThickness
  );
  const sealDepth = extrudeDepth + 0.02;
  const sealCenterZ = extrudeBaseZ + extrudeDepth / 2;
  const lip = DOORWAY_JAMB_SOLID_OVERLAP;
  const sealW = lip * 1.15;
  const geo = new THREE.BoxGeometry(sealW, height, sealDepth);

  for (const op of openings) {
    for (const x of [op.left + lip + sealW / 2, op.right - lip - sealW / 2]) {
      const seal = new THREE.Mesh(geo, wallMat);
      seal.position.set(x, wallY, sealCenterZ);
      seal.castShadow = false;
      seal.receiveShadow = true;
      seal.userData.roomDoorwayJambSeal = true;
      seal.userData.skipBulletSurface = true;
      roomShell.add(seal);
    }
  }
}

/** Fill wall–wall–ceiling triple junctions (side walls used to stop short of the back wall). */
export function addRoomCornerSeals(
  roomShell,
  wallMat,
  centerX,
  halfW,
  wallThickness,
  roomFloorNorthZ,
  roomFloorSouthZ,
  ceilingBottomY,
  ceilingThickness
) {
  const innerLeftX = centerX - halfW + wallThickness;
  const innerRightX = centerX + halfW - wallThickness;
  const sealHeight = ceilingThickness + CEILING_WALL_OVERLAP + 0.05;
  const sealY = ceilingBottomY + sealHeight / 2;
  const geo = new THREE.BoxGeometry(CORNER_SEAL_SIZE, sealHeight, CORNER_SEAL_SIZE);

  for (const [x, z] of [
    [innerLeftX, roomFloorNorthZ],
    [innerRightX, roomFloorNorthZ],
    [innerLeftX, roomFloorSouthZ],
    [innerRightX, roomFloorSouthZ],
  ]) {
    const seal = new THREE.Mesh(geo, wallMat);
    seal.position.set(x, sealY, z);
    seal.castShadow = false;
    seal.receiveShadow = true;
    seal.userData.roomCornerSeal = true;
    roomShell.add(seal);
  }
}

/**
 * @param {THREE.Group} group
 * @param {import("../level/loadArena.js").ArenaRoom} room
 * @param {Awaited<ReturnType<import("../level/LevelTextures.js").loadLevelTextureLibrary>>} textureLibrary
 * @param {number} arenaHalf Half-size of the arena (size / 2)
 * @param {number} wallHeight
 * @param {{ x: number, z: number, halfX: number, halfZ: number }[]} colliders
 * @param {"north" | "south"} attachWall Which perimeter the doorway is on
 * @param {number} [arenaWallThickness] Arena perimeter wall thickness (floor bridge)
 * @param {number} [arenaCeilingThickness] Default deck thickness for attached rooms
 * @param {import("../level/loadArena.js").ArenaDoorway[]} [doorways]
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number, y: number }[]} [groundSurfaces]
 * @param {{
 *   arenaCeilingBottomY?: number,
 *   catwalkDeckY?: number,
 *   exteriorDeckMat?: THREE.Material,
 *   exteriorDeckTileSize?: number,
 *   deckPad?: number,
 * } | null} [exteriorDeck]
 */
export function buildAttachedRoom(
  group,
  room,
  textureLibrary,
  arenaHalf,
  wallHeight,
  colliders,
  attachWall = "south",
  arenaWallThickness = 0.5,
  arenaCeilingThickness = 0.35,
  doorways = [],
  groundSurfaces = [],
  exteriorDeck = null
) {
  const {
    centerX,
    width,
    depth,
    height = wallHeight,
    wallThickness = 0.35,
    ceilingThickness = arenaCeilingThickness,
    textures,
  } = room;

  const floorId = textures.floor;
  const wallId = textures.wall;
  const ceilingId = textures.ceiling ?? textures.floor;
  const floorTile = textureLibrary?.tileSize(floorId) ?? 3;
  const wallTile = textureLibrary?.tileSize(wallId) ?? 3.2;
  const ceilingTile = textureLibrary?.tileSize(ceilingId) ?? floorTile;

  const halfW = width / 2;
  const halfD = depth / 2;
  const roomCenterZ = getAttachedRoomCenterZ(
    room,
    arenaHalf,
    attachWall,
    arenaWallThickness
  );
  const roomShell = new THREE.Group();
  roomShell.name = room.id ?? "attached_room";
  roomShell.userData.roomInterior = true;
  roomShell.userData.roomId = room.id ?? null;
  roomShell.userData.bulletSurfaceKind = "room_interior";

  const floorMat =
    textureLibrary?.createTiled(floorId, 1 / floorTile, 1 / floorTile) ??
    new THREE.MeshStandardMaterial({ color: 0x9a9a9a });
  if (floorMat.color) floorMat.color.multiplyScalar(0.55);

  const wallMatBase =
    textureLibrary?.createTiled(wallId, width / wallTile, height / wallTile) ??
    new THREE.MeshStandardMaterial({ color: 0x8a9ab0 });
  if (wallMatBase.color) wallMatBase.color.multiplyScalar(0.5);
  const wallMat = wallMaterial(wallMatBase);

  const roomFloorSouthZ = getRoomFloorSouthZ(
    attachWall,
    arenaHalf,
    arenaWallThickness,
    wallThickness
  );
  const floorBounds = getAttachedRoomFloorMeshBounds(
    room,
    attachWall,
    arenaHalf,
    arenaWallThickness
  );
  const floorMinZ = floorBounds.minZ;
  const floorMaxZ = floorBounds.maxZ;
  const floorDepth = floorMaxZ - floorMinZ;
  const floorCenterZ = (floorMinZ + floorMaxZ) / 2;
  const roomFloorNorthZ =
    attachWall === "north"
      ? roomCenterZ - halfD + wallThickness
      : roomCenterZ + halfD - wallThickness;

  const floorWidth = width + 2 * FLOOR_WALL_OVERLAP;
  const floorGeo = new THREE.BoxGeometry(floorWidth, FLOOR_THICKNESS, floorDepth);
  applyDeckPieceWorldUVs(
    floorGeo,
    centerX - floorWidth / 2,
    centerX + floorWidth / 2,
    floorMinZ,
    floorMaxZ,
    FLOOR_THICKNESS,
    floorTile
  );
  const floor = new THREE.Mesh(floorGeo, floorMaterial(floorMat));
  floor.position.set(centerX, FLOOR_Y + ROOM_FLOOR_LIFT, floorCenterZ);
  floor.renderOrder = 2;
  floor.receiveShadow = true;
  roomShell.add(floor);

  const wallY = wallCenterY(height);

  if (room.pillarShell) {
    const sunOccluders = new THREE.Group();
    sunOccluders.name = `${roomShell.name}_sun_occluders`;
    sunOccluders.userData.roomSunOccluders = true;
    sunOccluders.userData.roomId = room.id ?? null;

    buildRoomPillarShell(
      roomShell,
      room,
      textureLibrary,
      arenaHalf,
      arenaHalf * 2,
      arenaWallThickness,
      attachWall,
      doorways,
      colliders,
      sunOccluders
    );

    const CEILING_SIDE_PAD = 0.12;
    const CEILING_BACK_PAD = 0.12;
    const CEILING_DECK_GAP = 0.015;
    const wallTopY = height - WALL_VISUAL_FLOOR_EMBED;
    const interiorCeilingBottomY = wallTopY - CEILING_WALL_OVERLAP;
    const deckBottomY =
      exteriorDeck?.arenaCeilingBottomY ?? interiorCeilingBottomY + ceilingThickness;
    const ceilingTopY = Math.max(
      interiorCeilingBottomY + ceilingThickness,
      deckBottomY - CEILING_DECK_GAP
    );
    const effectiveCeilingHeight = ceilingTopY - interiorCeilingBottomY;
    const ceilingBottomY = interiorCeilingBottomY;
    const ceilingSpanZ = Math.abs(roomFloorNorthZ - roomFloorSouthZ);
    const ceilingDepth = ceilingSpanZ + CEILING_BACK_PAD;
    const ceilingWidth = width + 2 * CEILING_SIDE_PAD;
    const ceilingCenterZ =
      attachWall === "north"
        ? (roomFloorSouthZ + roomFloorNorthZ) / 2 - CEILING_BACK_PAD / 2
        : (roomFloorSouthZ + roomFloorNorthZ) / 2 + CEILING_BACK_PAD / 2;

    const ceilingMat =
      textureLibrary?.createTiled(
        ceilingId,
        ceilingWidth / ceilingTile,
        ceilingDepth / ceilingTile
      ) ?? new THREE.MeshStandardMaterial({ color: 0x2a2a32 });

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(ceilingWidth, effectiveCeilingHeight, ceilingDepth),
      ceilingMat
    );
    ceiling.position.set(
      centerX,
      ceilingBottomY + effectiveCeilingHeight / 2,
      ceilingCenterZ
    );
    ceiling.castShadow = false;
    ceiling.receiveShadow = true;
    roomShell.add(ceiling);

    colliders.push({
      x: centerX,
      z: ceilingCenterZ,
      halfX: ceilingWidth / 2,
      halfZ: ceilingDepth / 2,
      bottomY: ceilingBottomY,
      topY: ceilingTopY,
      kind: "deck",
    });

    addShadowOccluderHorizontalSlab(
      sunOccluders,
      ceilingWidth,
      ceilingDepth,
      centerX,
      ceilingTopY - 0.06,
      ceilingCenterZ
    );
    group.add(sunOccluders);

    const arenaInnerZ = getArenaDoorInnerZ(
      attachWall,
      arenaHalf,
      arenaWallThickness
    );
    const supportMaxZ =
      attachWall === "north"
        ? arenaInnerZ + FLOOR_WALL_OVERLAP
        : floorMaxZ + FLOOR_WALL_OVERLAP;
    const supportMinZ =
      attachWall === "south"
        ? arenaInnerZ - FLOOR_WALL_OVERLAP
        : floorMinZ - FLOOR_WALL_OVERLAP;
    groundSurfaces.push({
      minX: centerX - halfW - FLOOR_WALL_OVERLAP,
      maxX: centerX + halfW + FLOOR_WALL_OVERLAP,
      minZ: supportMinZ,
      maxZ: supportMaxZ,
      y: 0,
      roomInteriorFloor: true,
    });

    roomShell.traverse((obj) => {
      if (obj.isMesh) setRoomInteriorLayer(obj);
    });
    group.add(roomShell);

    return {
      centerX,
      centerZ: roomCenterZ,
      halfW,
      halfD,
      floorSouthZ: roomFloorSouthZ,
    };
  }

  const backZ =
    attachWall === "north"
      ? roomCenterZ - halfD + wallThickness / 2
      : roomCenterZ + halfD - wallThickness / 2;
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, wallThickness),
    wallMat
  );
  back.position.set(centerX, wallY, backZ);
  back.castShadow = true;
  back.receiveShadow = true;
  roomShell.add(back);
  colliders.push({
    x: centerX,
    z: backZ,
    halfX: halfW,
    halfZ: wallThickness / 2,
    bottomY: -WALL_FLOOR_EMBED,
    topY: height,
    kind: "wall",
  });

  /** Side walls span interior depth and meet the room-side half wall at the midplane. */
  const doorwayMeetZ = getDoorwaySideWallMeetZ(
    attachWall,
    arenaHalf,
    arenaWallThickness
  );
  const sideWallZMin = Math.min(roomFloorNorthZ, roomFloorSouthZ, doorwayMeetZ);
  const sideWallZMax = Math.max(roomFloorNorthZ, roomFloorSouthZ, doorwayMeetZ);
  const sideWallDepth = sideWallZMax - sideWallZMin;
  const sideWallCenterZ = (sideWallZMin + sideWallZMax) / 2;
  const sideGeo = new THREE.BoxGeometry(wallThickness, height, sideWallDepth);
  const leftX = centerX - halfW + wallThickness / 2;
  const left = new THREE.Mesh(sideGeo, wallMaterial(wallMatBase));
  left.position.set(leftX, wallY, sideWallCenterZ);
  left.castShadow = true;
  left.receiveShadow = true;
  roomShell.add(left);
  colliders.push({
    x: leftX,
    z: sideWallCenterZ,
    halfX: wallThickness / 2,
    halfZ: sideWallDepth / 2,
    bottomY: -WALL_FLOOR_EMBED,
    topY: height,
    kind: "wall",
  });

  const rightX = centerX + halfW - wallThickness / 2;
  const right = new THREE.Mesh(sideGeo, wallMaterial(wallMatBase));
  right.position.set(rightX, wallY, sideWallCenterZ);
  right.castShadow = true;
  right.receiveShadow = true;
  roomShell.add(right);
  colliders.push({
    x: rightX,
    z: sideWallCenterZ,
    halfX: wallThickness / 2,
    halfZ: sideWallDepth / 2,
    bottomY: -WALL_FLOOR_EMBED,
    topY: height,
    kind: "wall",
  });

  const CEILING_SIDE_PAD = 0.12;
  const CEILING_BACK_PAD = 0.12;
  const CEILING_DECK_GAP = 0.015;
  const wallTopY = height - WALL_VISUAL_FLOOR_EMBED;
  const interiorCeilingBottomY = wallTopY - CEILING_WALL_OVERLAP;
  const deckBottomY =
    exteriorDeck?.arenaCeilingBottomY ?? interiorCeilingBottomY + ceilingThickness;
  const ceilingTopY = Math.max(
    interiorCeilingBottomY + ceilingThickness,
    deckBottomY - CEILING_DECK_GAP
  );
  const effectiveCeilingHeight = ceilingTopY - interiorCeilingBottomY;
  const ceilingBottomY = interiorCeilingBottomY;
  const ceilingSpanZ = Math.abs(roomFloorNorthZ - roomFloorSouthZ);
  const ceilingDepth = ceilingSpanZ + CEILING_BACK_PAD;
  const ceilingWidth = width + 2 * CEILING_SIDE_PAD;
  const ceilingCenterZ =
    attachWall === "north"
      ? (roomFloorSouthZ + roomFloorNorthZ) / 2 - CEILING_BACK_PAD / 2
      : (roomFloorSouthZ + roomFloorNorthZ) / 2 + CEILING_BACK_PAD / 2;

  const ceilingMat =
    textureLibrary?.createTiled(
      ceilingId,
      ceilingWidth / ceilingTile,
      ceilingDepth / ceilingTile
    ) ?? new THREE.MeshStandardMaterial({ color: 0x2a2a32 });

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(ceilingWidth, effectiveCeilingHeight, ceilingDepth),
    ceilingMat
  );
  ceiling.position.set(
    centerX,
    ceilingBottomY + effectiveCeilingHeight / 2,
    ceilingCenterZ
  );
  ceiling.castShadow = false;
  ceiling.receiveShadow = true;
  roomShell.add(ceiling);

  addRoomCornerSeals(
    roomShell,
    wallMat,
    centerX,
    halfW,
    wallThickness,
    roomFloorNorthZ,
    roomFloorSouthZ,
    ceilingBottomY,
    effectiveCeilingHeight
  );

  colliders.push({
    x: centerX,
    z: ceilingCenterZ,
    halfX: ceilingWidth / 2,
    halfZ: ceilingDepth / 2,
    bottomY: ceilingBottomY,
    topY: ceilingTopY,
    kind: "deck",
  });

  /** World-layer occluders — sun shadow map uses WORLD layer; room shells do not. */
  const occluders = new THREE.Group();
  occluders.name = `${roomShell.name}_sun_occluders`;
  occluders.userData.roomSunOccluders = true;
  occluders.userData.roomId = room.id ?? null;
  addShadowOccluderBox(occluders, width, height, wallThickness, centerX, wallY, backZ);
  addShadowOccluderBox(
    occluders,
    wallThickness,
    height,
    sideWallDepth,
    leftX,
    wallY,
    sideWallCenterZ
  );
  addShadowOccluderBox(
    occluders,
    wallThickness,
    height,
    sideWallDepth,
    rightX,
    wallY,
    sideWallCenterZ
  );
  // Sun shadow blocker at the top of the room shell — stops catwalk pickup shadows
  // from projecting through the deck cutout into the interior below.
  addShadowOccluderHorizontalSlab(
    occluders,
    ceilingWidth,
    ceilingDepth,
    centerX,
    ceilingTopY - 0.06,
    ceilingCenterZ
  );

  addRoomArenaWallDarkOverlays(
    roomShell,
    wallMatBase,
    centerX,
    width,
    height,
    attachWall,
    arenaHalf,
    arenaWallThickness,
    doorways,
    wallY,
    wallTile
  );

  addRoomExteriorWalls(
    group,
    wallMatBase,
    centerX,
    width,
    height,
    wallThickness,
    halfW,
    wallY,
    backZ,
    sideWallDepth,
    sideWallCenterZ,
    attachWall,
    wallTile
  );

  group.add(occluders);

  const arenaInnerZ = getArenaDoorInnerZ(
    attachWall,
    arenaHalf,
    arenaWallThickness
  );
  const supportMaxZ =
    attachWall === "north"
      ? arenaInnerZ + FLOOR_WALL_OVERLAP
      : floorMaxZ + FLOOR_WALL_OVERLAP;
  const supportMinZ =
    attachWall === "south"
      ? arenaInnerZ - FLOOR_WALL_OVERLAP
      : floorMinZ - FLOOR_WALL_OVERLAP;
  groundSurfaces.push({
    minX: centerX - halfW - FLOOR_WALL_OVERLAP,
    maxX: centerX + halfW + FLOOR_WALL_OVERLAP,
    minZ: supportMinZ,
    maxZ: supportMaxZ,
    y: 0,
    roomInteriorFloor: true,
  });

  roomShell.traverse((obj) => {
    if (obj.isMesh) setRoomInteriorLayer(obj);
  });
  group.add(roomShell);

  return {
    centerX,
    centerZ: roomCenterZ,
    halfW,
    halfD,
    floorSouthZ: roomFloorSouthZ,
  };
}
