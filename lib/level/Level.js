import * as THREE from "three";
import {
  buildAttachedRoom,
  addInteriorDoorwayWallOverlay,
  addRoomCornerSeals,
} from "../rooms/LevelRoom.js";
import {
  getPillarGeometry,
  resolvePillarShape,
  resolvePillarColliderHalf,
} from "./PillarGeometry.js";
import { addPillarPoster, addWallPoster } from "./PillarPoster.js";
import {
  rebuildLevelOilBarrels,
  resyncControlPanelColliders,
  resyncOilBarrelColliders,
  spawnLevelProps,
} from "./LevelProps.js";
import {
  ensureOilBarrelFlameMeshes,
  refreshOilBarrelRenderLayers,
} from "../oil-barrel/OilBarrel.js";
import { refreshControlPanelRenderLayers } from "../control-panel/ControlPanel.js";
import { refreshVx27ContainerRenderLayers } from "../vx27-container/Vx27Container.js";
import { resolveTargetConfig, spawnTargets } from "../combat/Targets.js";
import { assignWorldLayers, setRoomInteriorLayer } from "../lighting/LightingLayers.js";
import { enableShadowsOn } from "../lighting/SceneEnvironment.js";
import { addShadowOccluderBox, addShadowOccluderHorizontalSlab } from "../lighting/ShadowOccluders.js";
import {
  applyCentredBoxWorldUVs,
  applyContinuousBoxWorldUVs,
  applyDoorwayExtrudeUVs,
  createArenaWallBoxGeometry,
  applyDeckPieceWorldUVs,
} from "./WallBoxUV.js";
import {
  getArenaDoorInnerZ,
  getArenaPlaySideHalfWallSpan,
  getArenaWallCenterZ,
  getAttachedRoomCenterZ,
  getAttachedRoomFloorHole,
  getFloorExtensionFootprint,
  getRoomCatwalkDeckPiece,
  getRoomFloorSouthZ,
} from "../rooms/RoomPlacement.js";
import { ROOM_CATWALK_MOUTH_PAD_DEFAULT } from "../rooms/RoomCatwalkTuning.js";
import {
  buildStairFlight,
  clearStairGroup,
  getStairCeilingCutout,
  getStairTopDeckBridgeFootprint,
  STAIRS_TOTAL_RISE,
  STAIRS_TOTAL_RUN,
  STAIR_STRINGER_DEPTH_OVERHANG,
} from "../stairs/LevelStairs.js";
import { pushCollider } from "../physics/Collision.js";
import {
  appendDoorwayHoles,
  DOORWAY_JAMB_SOLID_OVERLAP,
  getArenaAttachWall,
  buildDoorwayPassages,
  getDoorwaysOnWall,
  openingsToExclusions,
  pushDoorColliders,
  resolveDoorOpening,
  subtractXIntervals,
} from "../rooms/DoorwayWall.js";

import {
  FLOOR_THICKNESS,
  FLOOR_WALL_OVERLAP,
  FLOOR_Y,
  ROOM_FLOOR_LIFT,
  WALL_FLOOR_EMBED,
  WALL_STANDOFF,
  wallCenterY,
  WALL_VISUAL_FLOOR_EMBED,
} from "./LevelConstants.js";

/** Walk support rectangles that match visible arena catwalk deck pieces (not one full slab). */
/** @param {{ minX: number, maxX: number, minZ: number, maxZ: number, y: number, edgeStandoff?: object, arenaCatwalkDeck?: boolean }[]} groundSurfaces */
function removeArenaCatwalkDeckSurfaces(groundSurfaces) {
  for (let i = groundSurfaces.length - 1; i >= 0; i--) {
    if (groundSurfaces[i].arenaCatwalkDeck) {
      groundSurfaces.splice(i, 1);
    }
  }
}

/** Remove outdoor catwalk slabs owned by attached rooms (rebuilt with arena deck). */
function removeRoomCatwalkDeckSurfaces(groundSurfaces) {
  for (let i = groundSurfaces.length - 1; i >= 0; i--) {
    if (groundSurfaces[i].roomCatwalkDeck) {
      groundSurfaces.splice(i, 1);
    }
  }
}

function clearRoomCatwalkDeckMeshes(ceilingGroup) {
  const toRemove = ceilingGroup.children.filter(
    (c) => c.userData?.roomCatwalkDeck
  );
  for (const mesh of toRemove) {
    ceilingGroup.remove(mesh);
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat?.userData?.deckPieceOwned) continue;
      for (const key of ["map", "normalMap", "roughnessMap"]) {
        mat[key]?.dispose();
      }
      mat.dispose();
    }
  }
}

/**
 * Bake outdoor catwalk slabs into the arena ceiling group — attached rooms and
 * floor extensions share the same north/south deck piece math.
 */
function syncRoomCatwalkDeck(
  ceilingGroup,
  colliders,
  groundSurfaces,
  rooms,
  attachWall,
  arenaHalf,
  arenaWallThickness,
  innerHalf,
  thickness,
  ceilingBottomY,
  ceilingMat,
  ceilingTile,
  deckPad,
  edgeStandoff,
  mouthPad = ROOM_CATWALK_MOUTH_PAD_DEFAULT
) {
  clearRoomCatwalkDeckMeshes(ceilingGroup);
  removeRoomCatwalkDeckSurfaces(groundSurfaces);

  const topY = ceilingBottomY + thickness;
  for (const room of rooms) {
    const piece = getRoomCatwalkDeckPiece(
      room,
      attachWall,
      arenaHalf,
      arenaWallThickness,
      innerHalf,
      deckPad,
      mouthPad
    );
    if (piece.maxX - piece.minX < 0.05 || piece.maxZ - piece.minZ < 0.05) {
      continue;
    }

    const pieceMat = makeDeckPieceMaterial(ceilingMat, ceilingTile);
    addArenaCeilingDeckPiece(
      ceilingGroup,
      piece.minX,
      piece.maxX,
      piece.minZ,
      piece.maxZ,
      thickness,
      ceilingBottomY,
      pieceMat,
      ceilingTile
    );
    const lastMesh = ceilingGroup.children[ceilingGroup.children.length - 1];
    if (lastMesh) {
      lastMesh.userData.roomCatwalkDeck = true;
      // Room zone is open sky — wall occluders below must not bake shadows here.
      lastMesh.userData.shadowReceive = false;
      lastMesh.receiveShadow = false;
    }

    // Block catwalk pickup sun shadows from bleeding into the room below this slab.
    addShadowOccluderHorizontalSlab(
      ceilingGroup,
      piece.maxX - piece.minX,
      piece.maxZ - piece.minZ,
      (piece.minX + piece.maxX) / 2,
      ceilingBottomY,
      (piece.minZ + piece.maxZ) / 2
    );

    const centerX = (piece.minX + piece.maxX) / 2;
    const centerZ = (piece.minZ + piece.maxZ) / 2;
    pushCollider(colliders, {
      x: centerX,
      z: centerZ,
      halfX: (piece.maxX - piece.minX) / 2,
      halfZ: (piece.maxZ - piece.minZ) / 2,
      bottomY: ceilingBottomY,
      topY,
      kind: "deck",
    });
    const roomCatwalkEdgeStandoff = {
      west: edgeStandoff.east,
      east: edgeStandoff.east,
      north: edgeStandoff.north,
      south: edgeStandoff.south,
    };

    groundSurfaces.push({
      minX: piece.minX,
      maxX: piece.maxX,
      minZ: piece.minZ,
      maxZ: piece.maxZ,
      y: topY,
      edgeStandoff: roomCatwalkEdgeStandoff,
      arenaCatwalkDeck: true,
      roomCatwalkDeck: true,
    });
  }
}

function arenaCatwalkEdgeStandoff(westOpenRatio, wallStandoff) {
  const open = THREE.MathUtils.clamp(westOpenRatio, 0, 0.95);
  return {
    west: open > 0 ? 0 : wallStandoff,
    east: wallStandoff,
    north: wallStandoff,
    south: wallStandoff,
  };
}

/** @param {{ minX: number, maxX: number, minZ: number, maxZ: number, y: number }[]} groundSurfaces */
function pushFlatGroundSurface(groundSurfaces, minX, maxX, minZ, maxZ, y = 0) {
  if (maxX - minX < 0.05 || maxZ - minZ < 0.05) return;
  groundSurfaces.push({ minX, maxX, minZ, maxZ, y });
}

/** Walk support for perimeter strips under arena walls (avoids edge gaps at wall bases). */
function registerArenaPerimeterFloorSupport(groundSurfaces, half, wallThickness) {
  const span = half + wallThickness;
  const y = 0;
  const pad = FLOOR_WALL_OVERLAP;
  const northZ = -half - wallThickness / 2;
  const southZ = half + wallThickness / 2;
  const eastX = half + wallThickness / 2;
  const westX = -half - wallThickness / 2;
  const halfT = wallThickness / 2;

  pushFlatGroundSurface(
    groundSurfaces,
    -span,
    span,
    northZ - halfT - pad,
    northZ + halfT,
    y
  );
  pushFlatGroundSurface(
    groundSurfaces,
    -span,
    span,
    southZ - halfT,
    southZ + halfT + pad,
    y
  );
  pushFlatGroundSurface(
    groundSurfaces,
    eastX - halfT,
    eastX + halfT + pad,
    -span,
    span,
    y
  );
  pushFlatGroundSurface(
    groundSurfaces,
    westX - halfT - pad,
    westX + halfT,
    -span,
    span,
    y
  );
}

/** Full arena deck at y=0 — one continuous walk surface (room interiors included). */
function registerFullArenaDeckSupport(groundSurfaces, half, wallThickness) {
  const span = half + wallThickness + FLOOR_WALL_OVERLAP;
  pushFlatGroundSurface(groundSurfaces, -span, span, -span, span, 0);
}

/** Threshold plate in each doorway — fills the wall-thickness band the deck can miss at openings. */
function addDoorwayFloorBridge(
  group,
  bridgeMat,
  doorway,
  arenaHalf,
  attachWall,
  arenaWallThickness,
  roomFloorSouthZ,
  groundSurfaces,
  floorTile
) {
  const doorW = doorway.width ?? 1.1;
  const doorX = doorway.centerX ?? 0;
  const arenaInnerZ = getArenaDoorInnerZ(attachWall, arenaHalf, arenaWallThickness);
  const bridgeDepth = Math.abs(roomFloorSouthZ - arenaInnerZ);
  if (bridgeDepth < 0.02) return;

  const mat = floorMaterial(bridgeMat, 2);
  const minX = doorX - doorW / 2;
  const maxX = doorX + doorW / 2;
  const minZ = Math.min(arenaInnerZ, roomFloorSouthZ);
  const maxZ = Math.max(arenaInnerZ, roomFloorSouthZ);
  const bridgeGeo = new THREE.BoxGeometry(doorW, FLOOR_THICKNESS, bridgeDepth);
  if (floorTile) {
    applyDeckPieceWorldUVs(
      bridgeGeo,
      minX,
      maxX,
      minZ,
      maxZ,
      FLOOR_THICKNESS,
      floorTile
    );
  }
  const bridge = new THREE.Mesh(bridgeGeo, mat);
  bridge.position.set(
    doorX,
    FLOOR_Y + ROOM_FLOOR_LIFT,
    (arenaInnerZ + roomFloorSouthZ) / 2
  );
  bridge.receiveShadow = true;
  bridge.renderOrder = 2;
  group.add(bridge);

  const pad = FLOOR_WALL_OVERLAP;
  pushFlatGroundSurface(
    groundSurfaces,
    minX - pad,
    maxX + pad,
    minZ - pad,
    maxZ + pad,
    0
  );
}

/** Continuation of the arena deck where an attached room interior used to sit. */
function addFloorExtensionSlab(
  group,
  slabMat,
  ext,
  attachWall,
  arenaHalf,
  arenaWallThickness,
  floorTile,
  groundSurfaces
) {
  const fp = getFloorExtensionFootprint(
    ext,
    attachWall,
    arenaHalf,
    arenaWallThickness
  );
  const width = fp.maxX - fp.minX;
  const depth = fp.maxZ - fp.minZ;
  if (width < 0.05 || depth < 0.05) return fp;

  const geo = new THREE.BoxGeometry(width, FLOOR_THICKNESS, depth);
  if (floorTile) {
    applyDeckPieceWorldUVs(
      geo,
      fp.minX,
      fp.maxX,
      fp.minZ,
      fp.maxZ,
      FLOOR_THICKNESS,
      floorTile
    );
  }
  const slab = new THREE.Mesh(geo, floorMaterial(slabMat, 2));
  slab.position.set(
    (fp.minX + fp.maxX) / 2,
    FLOOR_Y,
    (fp.minZ + fp.maxZ) / 2
  );
  slab.receiveShadow = true;
  slab.userData.arenaFloorExtension = true;
  group.add(slab);

  const pad = FLOOR_WALL_OVERLAP;
  pushFlatGroundSurface(
    groundSurfaces,
    fp.minX - pad,
    fp.maxX + pad,
    fp.minZ - pad,
    fp.maxZ + pad,
    0
  );
  return fp;
}

/** Back + side walls + ceiling + doorway paint for a floor extension interior shell. */
function buildFloorExtensionInterior(
  group,
  ext,
  slabMat,
  textureLibrary,
  arenaWallTexId,
  arenaCeilingTexId,
  attachWall,
  arenaHalf,
  arenaWallThickness,
  arenaWallHeight,
  arenaCeilingBottomY,
  ceilingThickness,
  doorways,
  floorTile,
  groundSurfaces,
  colliders
) {
  const shell = new THREE.Group();
  shell.name = ext.id ?? "floor_extension";
  shell.userData.roomInterior = true;
  shell.userData.roomId = ext.id ?? null;
  shell.userData.floorExtensionInterior = true;

  addFloorExtensionSlab(
    shell,
    slabMat,
    ext,
    attachWall,
    arenaHalf,
    arenaWallThickness,
    floorTile,
    groundSurfaces
  );

  addFloorExtensionWalls(
    shell,
    group,
    ext,
    textureLibrary,
    arenaWallTexId,
    arenaCeilingTexId,
    attachWall,
    arenaHalf,
    arenaWallThickness,
    arenaWallHeight,
    arenaCeilingBottomY,
    ceilingThickness,
    doorways,
    colliders
  );

  shell.traverse((obj) => {
    if (obj.isMesh) setRoomInteriorLayer(obj);
  });
  group.add(shell);
}

/** Walls inside {@link buildFloorExtensionInterior} shell; sun occluders on world group. */
function addFloorExtensionWalls(
  interiorShell,
  worldGroup,
  ext,
  textureLibrary,
  arenaWallTexId,
  arenaCeilingTexId,
  attachWall,
  arenaHalf,
  arenaWallThickness,
  arenaWallHeight,
  arenaCeilingBottomY,
  ceilingThickness,
  doorways,
  colliders
) {
  const { centerX, width, depth } = ext;
  const wallThickness = ext.wallThickness ?? 0.35;
  const height = ext.height ?? arenaWallHeight;
  const halfW = width / 2;
  const halfD = depth / 2;
  const wallY = wallCenterY(height);
  const wallId = ext.textures?.wall ?? arenaWallTexId;
  const ceilingId =
    ext.textures?.ceiling ?? ext.textures?.floor ?? arenaCeilingTexId;
  const wallTile = textureLibrary?.tileSize(wallId) ?? 3.2;
  const ceilingTile = textureLibrary?.tileSize(ceilingId) ?? wallTile;
  const wallMat = finalizeArenaSurfaceMaterial(
    textureLibrary?.createTiled(wallId, 1, 1) ??
      new THREE.MeshStandardMaterial({ color: 0x8a9ab0 })
  );
  const idPrefix = ext.id ? `${ext.id}_` : "";

  const roomCenterZ = getAttachedRoomCenterZ(
    ext,
    arenaHalf,
    attachWall,
    arenaWallThickness
  );
  const roomFloorSouthZ = getRoomFloorSouthZ(
    attachWall,
    arenaHalf,
    arenaWallThickness,
    wallThickness
  );
  const roomFloorNorthZ =
    attachWall === "north"
      ? roomCenterZ - halfD + wallThickness
      : roomCenterZ + halfD - wallThickness;
  const sideWallDepth = Math.abs(roomFloorNorthZ - roomFloorSouthZ);
  const sideWallCenterZ = (roomFloorNorthZ + roomFloorSouthZ) / 2;

  function addWallBox(boxW, boxH, boxD, x, y, z, name, halfX, halfZ) {
    const geo = new THREE.BoxGeometry(boxW, boxH, boxD);
    geo.translate(x, y, z);
    applyCentredBoxWorldUVs(geo, boxW, boxH, boxD, wallTile);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.userData.shadowCast = false;
    mesh.receiveShadow = true;
    mesh.userData.floorExtensionWall = true;
    mesh.userData.bulletSurfaceKind = "wall";
    mesh.name = name;
    interiorShell.add(mesh);
    colliders.push({
      x,
      z,
      halfX,
      halfZ,
      bottomY: -WALL_FLOOR_EMBED,
      topY: height,
      kind: "wall",
    });
  }

  const backZ =
    attachWall === "north"
      ? roomCenterZ - halfD + wallThickness / 2
      : roomCenterZ + halfD - wallThickness / 2;
  addWallBox(
    width,
    height,
    wallThickness,
    centerX,
    wallY,
    backZ,
    `${idPrefix}back_wall`,
    width / 2,
    wallThickness / 2
  );

  const leftX = centerX - halfW + wallThickness / 2;
  addWallBox(
    wallThickness,
    height,
    sideWallDepth,
    leftX,
    wallY,
    sideWallCenterZ,
    `${idPrefix}left_wall`,
    wallThickness / 2,
    sideWallDepth / 2
  );

  const rightX = centerX + halfW - wallThickness / 2;
  addWallBox(
    wallThickness,
    height,
    sideWallDepth,
    rightX,
    wallY,
    sideWallCenterZ,
    `${idPrefix}right_wall`,
    wallThickness / 2,
    sideWallDepth / 2
  );

  addInteriorDoorwayWallOverlay(
    interiorShell,
    wallMat,
    centerX,
    width,
    height,
    attachWall,
    arenaHalf,
    arenaWallThickness,
    doorways,
    wallY,
    wallTile,
    true
  );

  const CEILING_SIDE_PAD = 0.12;
  const CEILING_BACK_PAD = 0.12;
  const CEILING_DECK_GAP = 0.015;
  const CEILING_WALL_OVERLAP = 0.04;
  const wallTopY = height - WALL_VISUAL_FLOOR_EMBED;
  const interiorCeilingBottomY = wallTopY - CEILING_WALL_OVERLAP;
  const deckBottomY = arenaCeilingBottomY;
  const shellCeilingTopY = Math.max(
    interiorCeilingBottomY + ceilingThickness,
    deckBottomY - CEILING_DECK_GAP
  );
  const effectiveCeilingHeight = shellCeilingTopY - interiorCeilingBottomY;
  const ceilingDepth = sideWallDepth + CEILING_BACK_PAD;
  const ceilingWidth = width + 2 * CEILING_SIDE_PAD;
  const ceilingCenterZ =
    attachWall === "north"
      ? (roomFloorSouthZ + roomFloorNorthZ) / 2 - CEILING_BACK_PAD / 2
      : (roomFloorSouthZ + roomFloorNorthZ) / 2 + CEILING_BACK_PAD / 2;

  const ceilingMat = finalizeArenaSurfaceMaterial(
    textureLibrary?.createTiled(
      ceilingId,
      ceilingWidth / ceilingTile,
      ceilingDepth / ceilingTile
    ) ?? new THREE.MeshStandardMaterial({ color: 0x2a2a32 })
  );
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(ceilingWidth, effectiveCeilingHeight, ceilingDepth),
    ceilingMat
  );
  ceiling.position.set(
    centerX,
    interiorCeilingBottomY + effectiveCeilingHeight / 2,
    ceilingCenterZ
  );
  ceiling.userData.shadowCast = false;
  ceiling.receiveShadow = true;
  ceiling.name = `${idPrefix}ceiling`;
  interiorShell.add(ceiling);

  addRoomCornerSeals(
    interiorShell,
    wallMat,
    centerX,
    halfW,
    wallThickness,
    roomFloorNorthZ,
    roomFloorSouthZ,
    interiorCeilingBottomY,
    effectiveCeilingHeight
  );

  const occluders = new THREE.Group();
  occluders.name = `${idPrefix}sun_occluders`;
  occluders.userData.roomSunOccluders = true;
  occluders.userData.roomId = ext.id ?? null;
  addShadowOccluderBox(
    occluders,
    width,
    height,
    wallThickness,
    centerX,
    wallY,
    backZ
  );
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
  addShadowOccluderHorizontalSlab(
    occluders,
    ceilingWidth,
    ceilingDepth,
    centerX,
    shellCeilingTopY - 0.06,
    ceilingCenterZ
  );
  worldGroup.add(occluders);
}

/**
 * Custom UV generator for `ExtrudeGeometry` that emits world-coord UVs
 * directly. Paired with a material whose texture `repeat = 1/tileSize`,
 * this gives continuous tiling across the whole floor (including the
 * edges of any cut-out holes) instead of stretching one tile across the
 * extruded shape.
 *
 * Top face: each vertex's shape-space (x, y) is also its world-space
 * (x, z) — the geometry is rotated `Math.PI / 2` around X after construction
 * so shape +Y becomes world +Z.
 *
 * Side walls: the inner cylinder around each hole; we map U around the
 * arc and V along the extrude depth so the wall texture doesn't stretch.
 *
 * @type {import("three").UVGenerator}
 */
const FLOOR_WORLD_UV_GENERATOR = {
  generateTopUV(geometry, vertices, indexA, indexB, indexC) {
    return [
      new THREE.Vector2(vertices[indexA * 3], vertices[indexA * 3 + 1]),
      new THREE.Vector2(vertices[indexB * 3], vertices[indexB * 3 + 1]),
      new THREE.Vector2(vertices[indexC * 3], vertices[indexC * 3 + 1]),
    ];
  },
  generateSideWallUV(geometry, vertices, indexA, indexB, indexC, indexD) {
    // Side wall quad spans two shape vertices and two depth steps. Use the
    // dominant in-plane axis as U so the texture isn't squished, and the
    // raw Z (extrude depth) as V.
    const ax = vertices[indexA * 3];
    const ay = vertices[indexA * 3 + 1];
    const az = vertices[indexA * 3 + 2];
    const bx = vertices[indexB * 3];
    const by = vertices[indexB * 3 + 1];
    const bz = vertices[indexB * 3 + 2];
    const cx = vertices[indexC * 3];
    const cy = vertices[indexC * 3 + 1];
    const cz = vertices[indexC * 3 + 2];
    const dx = vertices[indexD * 3];
    const dy = vertices[indexD * 3 + 1];
    const dz = vertices[indexD * 3 + 2];
    if (Math.abs(ay - by) < Math.abs(ax - bx)) {
      return [
        new THREE.Vector2(ax, az),
        new THREE.Vector2(bx, bz),
        new THREE.Vector2(cx, cz),
        new THREE.Vector2(dx, dz),
      ];
    }
    return [
      new THREE.Vector2(ay, az),
      new THREE.Vector2(by, bz),
      new THREE.Vector2(cy, cz),
      new THREE.Vector2(dy, dz),
    ];
  },
};

/**
 * Build the arena floor geometry — a square slab of `arenaSize × arenaSize`
 * with the listed circular holes punched through. Returns a geometry whose
 * top face is at `y = 0` and bottom at `y = -thickness`.
 *
 * @param {number} arenaSize
 * @param {number} thickness
 * @param {{ x: number, z: number, radius: number }[]} holes
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }[]} [rectHoles]
 * @returns {THREE.BufferGeometry}
 */
function buildArenaFloorGeometry(arenaSize, thickness, holes, rectHoles = []) {
  const half = arenaSize / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half, -half);
  shape.lineTo(half, -half);
  shape.lineTo(half, half);
  shape.lineTo(-half, half);
  shape.closePath();

  for (const hole of holes) {
    if (!Number.isFinite(hole?.x) || !Number.isFinite(hole?.z)) continue;
    const r = Math.max(0.1, hole.radius ?? 1);
    const path = new THREE.Path();
    // Clockwise winding (last arg = true) opposite to the outer shape so
    // the triangulator carves out the disc instead of filling it.
    path.absarc(hole.x, hole.z, r, 0, Math.PI * 2, true);
    shape.holes.push(path);
  }

  for (const rect of rectHoles) {
    if (
      !Number.isFinite(rect?.minX) ||
      !Number.isFinite(rect?.maxX) ||
      !Number.isFinite(rect?.minZ) ||
      !Number.isFinite(rect?.maxZ)
    ) {
      continue;
    }
    if (rect.maxX - rect.minX < 0.05 || rect.maxZ - rect.minZ < 0.05) continue;
    const path = new THREE.Path();
    path.moveTo(rect.minX, rect.minZ);
    path.lineTo(rect.maxX, rect.minZ);
    path.lineTo(rect.maxX, rect.maxZ);
    path.lineTo(rect.minX, rect.maxZ);
    path.closePath();
    shape.holes.push(path);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 48,
    UVGenerator: FLOOR_WORLD_UV_GENERATOR,
  });
  // Lay the floor flat. After rotateX(+π/2): shape X → world X, shape Y →
  // world Z, extrude depth (+Z) → world -Y (slab thickness hangs below).
  geo.rotateX(Math.PI / 2);
  return geo;
}

function floorMaterial(mat, offsetFactor = -4) {
  if (!mat?.clone) return mat;
  const m = mat.clone();
  m.polygonOffset = true;
  m.polygonOffsetFactor = offsetFactor;
  m.polygonOffsetUnits = offsetFactor;
  return m;
}

/** Main arena deck — no polygon offset (offset breaks receiving baked shadows). */
function arenaDeckMaterial(mat) {
  return mat?.clone ? mat.clone() : mat;
}

/** Shared PBR setup — walls, ceiling, and pillars use identical surface response. */
function finalizeArenaSurfaceMaterial(mat) {
  if (!mat) return mat;
  mat.roughness = 1;
  mat.metalness = 0;
  mat.depthWrite = true;
  mat.depthTest = true;
  mat.polygonOffset = false;
  return mat;
}

/** @deprecated Ceilings no longer get special darkening — kept for export stability. */
export const ARENA_CEILING_DAY_EMISSIVE = 0;
export const ARENA_CEILING_NIGHT_EMISSIVE = 0;

/** West clerestory: share of deck width (negative X side) left open to the sky. */
const ARENA_CEILING_WEST_OPEN_RATIO = 0.5;

/**
 * @param {number} fullMinX
 * @param {number} fullMaxX
 * @param {number} fullMinZ
 * @param {number} fullMaxZ
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number } | null} hole
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number }[]}
 */
function deckRectPieces(fullMinX, fullMaxX, fullMinZ, fullMaxZ, hole) {
  if (!hole) {
    return [{ minX: fullMinX, maxX: fullMaxX, minZ: fullMinZ, maxZ: fullMaxZ }];
  }

  const { minX: hx0, maxX: hx1, minZ: hz0, maxZ: hz1 } = hole;
  if (hx1 <= fullMinX || hx0 >= fullMaxX || hz1 <= fullMinZ || hz0 >= fullMaxZ) {
    return [{ minX: fullMinX, maxX: fullMaxX, minZ: fullMinZ, maxZ: fullMaxZ }];
  }

  const pieces = [];
  const gap = 0.01;

  if (fullMinZ < hz0 - gap) {
    pieces.push({
      minX: fullMinX,
      maxX: fullMaxX,
      minZ: fullMinZ,
      maxZ: Math.min(fullMaxZ, hz0),
    });
  }
  const zMid0 = Math.max(fullMinZ, hz0);
  const zMid1 = Math.min(fullMaxZ, hz1);
  const eastMinX = Math.max(fullMinX, hx1);

  // East catwalk column — one continuous surface beside the stair cutout (no seam
  // between the east wing and south arm when the cutout moves with stair tuning).
  if (eastMinX + gap < fullMaxX && zMid0 < fullMaxZ - gap) {
    pieces.push({
      minX: eastMinX,
      maxX: fullMaxX,
      minZ: zMid0,
      maxZ: fullMaxZ,
    });
  }

  // South/west band — south of the cutout, west of the east column.
  if (hz1 + gap < fullMaxZ) {
    const southMaxX = eastMinX + gap < fullMaxX ? eastMinX : fullMaxX;
    if (southMaxX - fullMinX > gap) {
      pieces.push({
        minX: fullMinX,
        maxX: southMaxX,
        minZ: Math.max(fullMinZ, hz1),
        maxZ: fullMaxZ,
      });
    }
  }

  if (zMid1 > zMid0 + gap && fullMinX < hx0 - gap) {
    pieces.push({
      minX: fullMinX,
      maxX: Math.min(fullMaxX, hx0),
      minZ: zMid0,
      maxZ: zMid1,
    });
  }

  return pieces;
}

/** Split deck rectangles that overlap a room catwalk footprint (avoid stacked coplanar slabs). */
function subtractRectFromPieces(pieces, hole) {
  if (!hole) return pieces;
  const out = [];
  for (const piece of pieces) {
    if (
      piece.maxX <= hole.minX + 0.001 ||
      piece.minX >= hole.maxX - 0.001 ||
      piece.maxZ <= hole.minZ + 0.001 ||
      piece.minZ >= hole.maxZ - 0.001
    ) {
      out.push(piece);
      continue;
    }
    out.push(
      ...deckRectPieces(
        piece.minX,
        piece.maxX,
        piece.minZ,
        piece.maxZ,
        hole
      )
    );
  }
  return out;
}

function addArenaCeilingDeckPiece(
  group,
  minX,
  maxX,
  minZ,
  maxZ,
  thickness,
  ceilingBottomY,
  ceilingMat,
  tileSize,
  castShadow = false
) {
  const width = maxX - minX;
  const depth = maxZ - minZ;
  if (width < 0.05 || depth < 0.05) return;

  const geometry = new THREE.BoxGeometry(width, thickness, depth);
  if (tileSize) {
    applyDeckPieceWorldUVs(geometry, minX, maxX, minZ, maxZ, thickness, tileSize);
  }

  const ceiling = new THREE.Mesh(geometry, ceilingMat);
  ceiling.position.set(
    (minX + maxX) / 2,
    ceilingBottomY + thickness / 2,
    (minZ + maxZ) / 2
  );
  ceiling.userData.arenaCeiling = true;
  // Solid deck: cast the footprint straight down onto the arena floor. The
  // top face points at the sun so it never self-shadows; light cannot pass
  // through it. Room catwalk pieces leave this off (they cap a room below).
  ceiling.userData.shadowCast = castShadow;
  ceiling.castShadow = castShadow;
  ceiling.userData.shadowReceive = true;
  ceiling.receiveShadow = true;
  group.add(ceiling);
}

function clearArenaCeilingGroup(group) {
  const geometries = new Set();
  const meshes = group.children.filter((c) => c.isMesh);
  for (const mesh of meshes) {
    group.remove(mesh);
    if (mesh.geometry && !geometries.has(mesh.geometry)) {
      geometries.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    // Per-piece material clones own their texture clones — dispose both.
    // The shared base ceilingMat is untagged and stays alive.
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat?.userData?.deckPieceOwned) continue;
      for (const key of ["map", "normalMap", "roughnessMap"]) {
        mat[key]?.dispose();
      }
      mat.dispose();
    }
  }
}

/**
 * Clone deck material for a ceiling piece. UVs are baked in world space on
 * the geometry — texture repeat/offset stay at (1, 0) so cutout moves never
 * drag the pattern with them.
 */
function makeDeckPieceMaterial(baseMat, tileSize) {
  if (!baseMat?.map || !tileSize) return baseMat;
  const mat = baseMat.clone();
  for (const key of ["map", "normalMap", "roughnessMap"]) {
    const tex = mat[key];
    if (!tex) continue;
    const cloned = tex.clone();
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.repeat.set(1, 1);
    cloned.offset.set(0, 0);
    cloned.needsUpdate = true;
    mat[key] = cloned;
  }
  // Flag for clearArenaCeilingGroup: this clone owns its texture clones too
  // and must be disposed when the deck is rebuilt (stair re-tune, HMR).
  mat.userData = { ...(mat.userData ?? {}), deckPieceOwned: true };
  return mat;
}

function addArenaCeilingDeck(
  group,
  colliders,
  groundSurfaces,
  fullWidth,
  fullDepth,
  thickness,
  ceilingBottomY,
  ceilingMat,
  westOpenRatio,
  stairCutout = null,
  ceilingTile = null,
  edgeStandoff = null,
  stairTopBridge = null,
  roomCutouts = []
) {
  const topY = ceilingBottomY + thickness;
  const open = THREE.MathUtils.clamp(westOpenRatio, 0, 0.95);
  let fullMinX;
  let fullMaxX;

  if (open <= 0) {
    fullMinX = -fullWidth / 2;
    fullMaxX = fullWidth / 2;
  } else {
    const coveredWidth = fullWidth * (1 - open);
    const centerX = (open * fullWidth) / 2;
    fullMinX = centerX - coveredWidth / 2;
    fullMaxX = centerX + coveredWidth / 2;
  }

  const fullMinZ = -fullDepth / 2;
  const fullMaxZ = fullDepth / 2;
  let pieces = deckRectPieces(
    fullMinX,
    fullMaxX,
    fullMinZ,
    fullMaxZ,
    stairCutout
  );

  if (stairTopBridge) {
    pieces.push({
      minX: Math.max(fullMinX, stairTopBridge.minX),
      maxX: Math.min(fullMaxX, stairTopBridge.maxX),
      minZ: Math.max(fullMinZ, stairTopBridge.minZ),
      maxZ: Math.min(fullMaxZ, stairTopBridge.maxZ),
    });
  }

  for (const hole of roomCutouts) {
    pieces = subtractRectFromPieces(pieces, hole);
  }

  for (const piece of pieces) {
    const pieceMat = makeDeckPieceMaterial(ceilingMat, ceilingTile);
    // Arena perimeter catwalk casts its solid footprint down onto the floor.
    addArenaCeilingDeckPiece(
      group,
      piece.minX,
      piece.maxX,
      piece.minZ,
      piece.maxZ,
      thickness,
      ceilingBottomY,
      pieceMat,
      ceilingTile,
      true
    );
    const centerX = (piece.minX + piece.maxX) / 2;
    const centerZ = (piece.minZ + piece.maxZ) / 2;
    const halfX = (piece.maxX - piece.minX) / 2;
    const halfZ = (piece.maxZ - piece.minZ) / 2;
    if (colliders) {
      pushCollider(colliders, {
        x: centerX,
        z: centerZ,
        halfX,
        halfZ,
        bottomY: ceilingBottomY,
        topY,
        kind: "deck",
      });
    }
    if (groundSurfaces) {
      groundSurfaces.push({
        minX: piece.minX,
        maxX: piece.maxX,
        minZ: piece.minZ,
        maxZ: piece.maxZ,
        y: topY,
        edgeStandoff,
        arenaCatwalkDeck: true,
      });
    }
  }
}

/** Dim the arena deck underside emissive boost when the sun is off. */
export { applyArenaCeilingDayNight } from "../lighting/ArenaCeilingDayNight.js";

/** Doorway extrude UVs are in tile metres — clone textures so repeat stays 1×1. */
function wallMaterialDoorway(mat) {
  if (!mat?.clone) return finalizeArenaSurfaceMaterial(mat);
  const m = mat.clone();
  for (const key of ["map", "normalMap", "roughnessMap"]) {
    const tex = m[key];
    if (!tex) continue;
    const cloned = tex.clone();
    cloned.repeat.set(1, 1);
    cloned.offset.set(0, 0);
    cloned.needsUpdate = true;
    m[key] = cloned;
  }
  return finalizeArenaSurfaceMaterial(m);
}

function wallMaterialDoorwayJambPatch(mat) {
  const m = wallMaterialDoorway(mat);
  if (!m) return m;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -3;
  m.polygonOffsetUnits = -3;
  m.depthWrite = true;
  return m;
}

/**
 * Cover inner jamb faces on arched doorways only — leaves main wall UVs untouched.
 * @param {THREE.Group} group
 * @param {THREE.Material} wallMat
 * @param {import("../rooms/DoorwayWall.js").DoorOpening[]} openings
 * @param {"north" | "south"} side
 * @param {number} half
 * @param {number} wallThickness
 * @param {number} floorLine
 * @param {number} wallTile
 */
function addArchDoorwayJambPatches(
  group,
  wallMat,
  openings,
  side,
  half,
  wallThickness,
  floorLine,
  wallTile
) {
  const attachWall = side === "south" ? "south" : "north";
  const patchDepth = wallThickness / 2;
  const innerZ = getArenaDoorInnerZ(attachWall, half, wallThickness);
  const patchCenterZ =
    attachWall === "north" ? innerZ - patchDepth / 2 : innerZ + patchDepth / 2;
  const patchMat = wallMaterialDoorwayJambPatch(wallMat);

  for (const op of openings) {
    if (!op.arch || op.radius <= 0) continue;

    const patchH = op.rectTop - floorLine;
    if (patchH < 0.08) continue;
    const yMid = floorLine + patchH / 2;

    const lip = DOORWAY_JAMB_SOLID_OVERLAP;
    const leftX =
      op.left + lip + ARCH_JAMB_PATCH_THICKNESS / 2 + ARCH_JAMB_PATCH_INSET;
    const leftGeo = new THREE.BoxGeometry(
      ARCH_JAMB_PATCH_THICKNESS,
      patchH,
      patchDepth
    );
    leftGeo.translate(leftX, yMid, patchCenterZ);
    applyCentredBoxWorldUVs(
      leftGeo,
      ARCH_JAMB_PATCH_THICKNESS,
      patchH,
      patchDepth,
      wallTile
    );
    const leftPatch = new THREE.Mesh(leftGeo, patchMat);
    leftPatch.castShadow = false;
    leftPatch.receiveShadow = true;
    leftPatch.renderOrder = 4;
    leftPatch.userData.doorwayJambPatch = true;
    leftPatch.userData.arenaDoorwayWall = side;
    group.add(leftPatch);

    const rightX =
      op.right - lip - ARCH_JAMB_PATCH_THICKNESS / 2 - ARCH_JAMB_PATCH_INSET;
    const rightGeo = new THREE.BoxGeometry(
      ARCH_JAMB_PATCH_THICKNESS,
      patchH,
      patchDepth
    );
    rightGeo.translate(rightX, yMid, patchCenterZ);
    applyCentredBoxWorldUVs(
      rightGeo,
      ARCH_JAMB_PATCH_THICKNESS,
      patchH,
      patchDepth,
      wallTile
    );
    const rightPatch = new THREE.Mesh(rightGeo, patchMat);
    rightPatch.castShadow = false;
    rightPatch.receiveShadow = true;
    rightPatch.renderOrder = 4;
    rightPatch.userData.doorwayJambPatch = true;
    rightPatch.userData.arenaDoorwayWall = side;
    group.add(rightPatch);
  }
}

function addWallBox(group, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addSolidWallCollider(
  colliders,
  x,
  z,
  halfX,
  halfZ,
  bottomY,
  topY,
  kind = "wall",
  mouthPlane = false
) {
  pushCollider(colliders, {
    x,
    z,
    halfX,
    halfZ,
    bottomY,
    topY,
    kind,
    mouthPlane: mouthPlane || undefined,
  });
}

/**
 * Match doorway wall mesh spans with solid colliders (gaps left open for doors).
 */
function addDoorwayWallColliders(
  colliders,
  doorways,
  half,
  wallHeight,
  wallThickness,
  side
) {
  const openings = doorways.map(resolveDoorOpening);
  const exclusions = openingsToExclusions(openings);
  const z =
    side === "south"
      ? half + wallThickness / 2
      : -half - wallThickness / 2;

  const pushSpan = (x0, x1, bottomY, topY) => {
    const w = x1 - x0;
    if (w < 0.15) return;
    addSolidWallCollider(
      colliders,
      (x0 + x1) / 2,
      z,
      w / 2,
      wallThickness / 2,
      bottomY,
      topY,
      "wall",
      true
    );
  };

  for (const [x0, x1] of subtractXIntervals(-half, half, exclusions)) {
    pushSpan(x0, x1, -WALL_FLOOR_EMBED, wallHeight);
  }

  for (const opening of openings) {
    pushDoorColliders(pushSpan, opening, wallHeight);
  }
}

function addArenaPerimeterWallColliders(
  colliders,
  half,
  arenaSize,
  wallHeight,
  wallThickness,
  westWallHeight,
  arena
) {
  const northZ = -half - wallThickness / 2;
  const southZ = half + wallThickness / 2;
  const eastX = half + wallThickness / 2;
  const westX = -half - wallThickness / 2;
  const spanHalfX = (arenaSize + wallThickness) / 2;
  const spanHalfZ = (arenaSize + wallThickness) / 2;
  const northDoors = getDoorwaysOnWall(arena, "north");
  const southDoors = getDoorwaysOnWall(arena, "south");

  if (northDoors.length) {
    addDoorwayWallColliders(
      colliders,
      northDoors,
      half,
      wallHeight,
      wallThickness,
      "north"
    );
  } else {
    addSolidWallCollider(
      colliders,
      0,
      northZ,
      spanHalfX,
      wallThickness / 2,
      -WALL_FLOOR_EMBED,
      wallHeight
    );
  }

  if (southDoors.length) {
    addDoorwayWallColliders(
      colliders,
      southDoors,
      half,
      wallHeight,
      wallThickness,
      "south"
    );
  } else {
    addSolidWallCollider(
      colliders,
      0,
      southZ,
      spanHalfX,
      wallThickness / 2,
      -WALL_FLOOR_EMBED,
      wallHeight
    );
  }

  addSolidWallCollider(
    colliders,
    eastX,
    0,
    wallThickness / 2,
    spanHalfZ,
    -WALL_FLOOR_EMBED,
    wallHeight
  );
  addSolidWallCollider(
    colliders,
    westX,
    0,
    wallThickness / 2,
    spanHalfZ,
    -WALL_FLOOR_EMBED,
    westWallHeight
  );
}

/**
 * UV generator for doorway walls built via ExtrudeGeometry.
 * Shape lives in XY (X = horizontal, Y = up); extrude depth = wall thickness
 * along +Z.  After construction the geometry is translated so Z is centred on
 * the wall and the mesh is placed at the correct world Z.
 */
/**
 * World-metre UVs for doorway extrude geometry (tile metres + repeat 1×1).
 * Side walls unwrap each quad by edge length so thin jambs do not stretch.
 */
function makeDoorwayWallUVGenerator(
  arenaHalf,
  _arenaSize,
  _wallHeight,
  _wallThickness,
  wallTile
) {
  const tile = wallTile > 0 ? wallTile : 3;
  return {
    generateTopUV(_geo, verts, iA, iB, iC) {
      const uv = (i) =>
        new THREE.Vector2(
          (verts[i * 3] + arenaHalf) / tile,
          verts[i * 3 + 1] / tile
        );
      return [uv(iA), uv(iB), uv(iC)];
    },
    generateSideWallUV(_geo, verts, iA, iB, iC, iD) {
      const px = (i) => verts[i * 3];
      const py = (i) => verts[i * 3 + 1];
      const pz = (i) => verts[i * 3 + 2];
      const ax = px(iA);
      const ay = py(iA);
      const az = pz(iA);
      const bx = px(iB);
      const by = py(iB);
      const bz = pz(iB);
      const dx = px(iD);
      const dy = py(iD);
      const dz = pz(iD);
      const ab = Math.hypot(bx - ax, by - ay, bz - az);
      const ad = Math.hypot(dx - ax, dy - ay, dz - az);
      return [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(ab / tile, 0),
        new THREE.Vector2(ab / tile, ad / tile),
        new THREE.Vector2(0, ad / tile),
      ];
    },
  };
}

const ARCH_CURVE_SEGMENTS = 32;
/** Thin cosmetic slab in front of arched doorway jambs (bad extrude UV on inner face). */
const ARCH_JAMB_PATCH_THICKNESS = 0.003;
const ARCH_JAMB_PATCH_INSET = 0.0015;

function extrudeDoorwayWallSpan(
  group,
  wallMat,
  spanLeft,
  spanRight,
  openings,
  half,
  arenaSize,
  wallHeight,
  wallThickness,
  z,
  floorLine,
  wallTile,
  side
) {
  if (spanRight - spanLeft < 0.05) return;

  const shape = new THREE.Shape();
  shape.moveTo(spanLeft, floorLine);
  shape.lineTo(spanRight, floorLine);
  shape.lineTo(spanRight, wallHeight);
  shape.lineTo(spanLeft, wallHeight);
  shape.closePath();
  appendDoorwayHoles(shape, openings, spanLeft, spanRight, floorLine);

  const attachWall = side === "south" ? "south" : "north";
  const { extrudeBaseZ, extrudeDepth } = getArenaPlaySideHalfWallSpan(
    attachWall,
    half,
    wallThickness
  );

  const uvGen = makeDoorwayWallUVGenerator(
    half,
    arenaSize,
    wallHeight,
    extrudeDepth,
    wallTile
  );
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: ARCH_CURVE_SEGMENTS,
    UVGenerator: uvGen,
  });
  geo.translate(0, 0, extrudeBaseZ);
  applyDoorwayExtrudeUVs(
    geo,
    half,
    floorLine,
    wallTile,
    extrudeDepth,
    openings,
    0
  );

  const mesh = new THREE.Mesh(geo, wallMaterialDoorway(wallMat));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = 0;
  mesh.userData.arenaDoorwayWall = side;
  group.add(mesh);
}

/**
 * Door gaps on the north or south perimeter — outdoor (world) layer only.
 * Uses Shape + ExtrudeGeometry so arched tops are smooth curves (same
 * approach as the floor hole cutouts).
 */
function addDoorwayWall(
  group,
  wallMat,
  doorways,
  half,
  arenaSize,
  wallHeight,
  wallThickness,
  side,
  wallTile
) {
  const openings = doorways.map(resolveDoorOpening);
  const floorLine = -WALL_VISUAL_FLOOR_EMBED;
  const z =
    side === "south"
      ? half + wallThickness / 2
      : -half - wallThickness / 2;

  extrudeDoorwayWallSpan(
    group,
    wallMat,
    -half,
    half,
    openings,
    half,
    arenaSize,
    wallHeight,
    wallThickness,
    z,
    floorLine,
    wallTile,
    side
  );

  addArchDoorwayJambPatches(
    group,
    wallMat,
    openings,
    side,
    half,
    wallThickness,
    floorLine,
    wallTile
  );
}

/**
 * @param {THREE.Scene} scene
 * @param {import("./loadArena.js").ArenaConfig} arena
 * @param {Awaited<ReturnType<import("./LevelTextures.js").loadLevelTextureLibrary>>} [textureLibrary]
 */
export function createLevelFromArena(scene, arena, textureLibrary = null, gameCore = null) {
  const {
    size: ARENA_SIZE,
    wallHeight: WALL_HEIGHT,
    wallThickness: WALL_THICKNESS,
    ceilingThickness: CEILING_THICKNESS = 0.35,
    catwalkClearance: CATWALK_CLEARANCE = 2.2,
    westWallHeightRatio: WEST_WALL_HEIGHT_RATIO = 0.5,
    pillarSize: PILLAR_SIZE,
    playerBoundsInset,
    wallStandoff: wallStandoffConfig,
    textures,
    pillars,
    rooms = [],
    floorExtensions: floorExtensionsConfig = [],
    stairs: stairConfig = null,
  } = arena;

  const floorExtensions = Array.isArray(floorExtensionsConfig)
    ? floorExtensionsConfig
    : [];
  /** Rooms and floor extensions share north/south attach + catwalk deck math. */
  const catwalkDeckFootprints = [...rooms, ...floorExtensions];

  const half = ARENA_SIZE / 2;
  /** Distance from inner wall face (±half) to the player's body edge. */
  const wallStandoff =
    wallStandoffConfig ??
    (playerBoundsInset != null
      ? WALL_THICKNESS + playerBoundsInset
      : WALL_STANDOFF);
  const innerHalf = half - wallStandoff;
  const group = new THREE.Group();
  const pickupsGroup = new THREE.Group();
  pickupsGroup.name = "level_pickups";
  group.add(pickupsGroup);

  const floorTile = textureLibrary?.tileSize(textures.floor) ?? 4;
  const wallTile = textureLibrary?.tileSize(textures.wall) ?? 4;
  const defaultPillarTile = textureLibrary?.tileSize(textures.pillar) ?? 3;

  const floorDeckSpan = ARENA_SIZE + 2 * WALL_THICKNESS;

  let floorMat =
    textureLibrary?.createTiled(
      textures.floor,
      floorDeckSpan / floorTile,
      floorDeckSpan / floorTile
    ) ?? new THREE.MeshLambertMaterial({ color: 0xa39a8c });

  floorMat = arenaDeckMaterial(floorMat);

  /** World-metre UVs — pairs with repeat 1/tile on ExtrudeGeometry and box slabs. */
  const floorWorldMat = arenaDeckMaterial(
    textureLibrary?.createTiled(
      textures.floor,
      1 / floorTile,
      1 / floorTile
    ) ?? new THREE.MeshLambertMaterial({ color: 0xa39a8c })
  );

  const attachWall = getArenaAttachWall(arena);
  const attachWallDoorways = getDoorwaysOnWall(arena, attachWall);

  /** Floor with world-coord UVs — needed so the ExtrudeGeometry version of
   *  the arena floor tiles continuously instead of stretching one tile per
   *  shape. Only created when there are holes to cut. */
  const floorHoles = Array.isArray(arena.floorHoles) ? arena.floorHoles : [];
  const floorRoomHoles = rooms.map((room) =>
    getAttachedRoomFloorHole(room, attachWall, half, WALL_THICKNESS)
  );
  const floorHasCutouts = floorHoles.length > 0 || floorRoomHoles.length > 0;
  const worldUVFloorMat = floorHasCutouts ? floorWorldMat : null;

  const wallMatNorthSouth = finalizeArenaSurfaceMaterial(
    textureLibrary?.createTiled(
      textures.wall,
      ARENA_SIZE / wallTile,
      WALL_HEIGHT / wallTile
    ) ?? new THREE.MeshLambertMaterial({ color: 0xc4beb4 })
  );

  const wallMatEastWest = finalizeArenaSurfaceMaterial(
    textureLibrary?.createTiled(textures.wall, 1, 1) ?? wallMatNorthSouth
  );

  // Arena deck — cut config floorHoles and attached-room footprints so the
  // world pass does not write depth under room interior floors (z-fight).
  const floorGeometry = floorHasCutouts
    ? buildArenaFloorGeometry(
        floorDeckSpan,
        FLOOR_THICKNESS,
        floorHoles,
        floorRoomHoles
      )
    : new THREE.BoxGeometry(floorDeckSpan, FLOOR_THICKNESS, floorDeckSpan);
  if (!floorHasCutouts && floorTile) {
    const halfSpan = floorDeckSpan / 2;
    applyDeckPieceWorldUVs(
      floorGeometry,
      -halfSpan,
      halfSpan,
      -halfSpan,
      halfSpan,
      FLOOR_THICKNESS,
      floorTile
    );
  }
  const floor = new THREE.Mesh(
    floorGeometry,
    floorHasCutouts ? worldUVFloorMat : floorWorldMat
  );
  // BoxGeometry is centred on origin, ExtrudeGeometry top sits at y=0 with
  // thickness extending below. Match the top surface to the original floor
  // top either way (y = 0).
  floor.position.y = floorHasCutouts ? 0 : FLOOR_Y;
  floor.userData.shadowCast = false;
  floor.userData.shadowReceive = true;
  group.add(floor);

  const northZ = -half - WALL_THICKNESS / 2;
  const southZ = half + WALL_THICKNESS / 2;
  const northDoorways = getDoorwaysOnWall(arena, "north");
  const southDoorways = getDoorwaysOnWall(arena, "south");

  if (northDoorways.length) {
    addDoorwayWall(
      group,
      wallMatNorthSouth,
      northDoorways,
      half,
      ARENA_SIZE,
      WALL_HEIGHT,
      WALL_THICKNESS,
      "north",
      wallTile
    );
  } else {
    const northGeo = createArenaWallBoxGeometry(
      ARENA_SIZE + WALL_THICKNESS,
      WALL_HEIGHT,
      WALL_THICKNESS,
      0,
      wallCenterY(WALL_HEIGHT),
      northZ,
      half,
      ARENA_SIZE,
      WALL_HEIGHT
    );
    addWallBox(group, northGeo, wallMatNorthSouth, 0, 0, 0);
  }

  if (southDoorways.length) {
    addDoorwayWall(
      group,
      wallMatNorthSouth,
      southDoorways,
      half,
      ARENA_SIZE,
      WALL_HEIGHT,
      WALL_THICKNESS,
      "south",
      wallTile
    );
  } else {
    const southGeo = createArenaWallBoxGeometry(
      ARENA_SIZE + WALL_THICKNESS,
      WALL_HEIGHT,
      WALL_THICKNESS,
      0,
      wallCenterY(WALL_HEIGHT),
      southZ,
      half,
      ARENA_SIZE,
      WALL_HEIGHT
    );
    addWallBox(group, southGeo, wallMatNorthSouth.clone(), 0, 0, 0);
  }

  const eastGeo = new THREE.BoxGeometry(
    WALL_THICKNESS,
    WALL_HEIGHT,
    ARENA_SIZE + WALL_THICKNESS
  );
  applyCentredBoxWorldUVs(
    eastGeo,
    WALL_THICKNESS,
    WALL_HEIGHT,
    ARENA_SIZE + WALL_THICKNESS,
    wallTile
  );
  const east = new THREE.Mesh(eastGeo, wallMatEastWest);
  east.position.set(half + WALL_THICKNESS / 2, wallCenterY(WALL_HEIGHT), 0);
  east.castShadow = true;
  east.receiveShadow = true;
  group.add(east);

  const westWallHeight = WALL_HEIGHT * WEST_WALL_HEIGHT_RATIO;
  const wallMatWest =
    finalizeArenaSurfaceMaterial(
      textureLibrary?.createTiled(textures.wall, 1, 1) ?? wallMatEastWest
    );
  const westGeo = new THREE.BoxGeometry(
    WALL_THICKNESS,
    westWallHeight,
    ARENA_SIZE + WALL_THICKNESS
  );
  applyCentredBoxWorldUVs(
    westGeo,
    WALL_THICKNESS,
    westWallHeight,
    ARENA_SIZE + WALL_THICKNESS,
    wallTile
  );
  const west = new THREE.Mesh(westGeo, wallMatWest);
  west.position.set(-half - WALL_THICKNESS / 2, wallCenterY(westWallHeight), 0);
  west.castShadow = true;
  west.receiveShadow = true;
  group.add(west);

  const ceilingId = textures.ceiling ?? textures.floor;
  const ceilingTile = textureLibrary?.tileSize(ceilingId) ?? floorTile;
  const ceilingMat = finalizeArenaSurfaceMaterial(
    textureLibrary?.createTiled(
      ceilingId,
      ARENA_SIZE / ceilingTile,
      ARENA_SIZE / ceilingTile
    ) ?? new THREE.MeshStandardMaterial({ color: 0x3a3a40 })
  );

  /** Flush with wall tops — large overlap caused a bright seam where deck met walls. */
  const CEILING_OVERLAP = 0;
  const CEILING_PAD = 0.25;
  const ceilingBottomY = WALL_HEIGHT - CEILING_OVERLAP;
  const ceilingFullWidth = ARENA_SIZE + 2 * WALL_THICKNESS + 2 * CEILING_PAD;
  const ceilingFullDepth = ceilingFullWidth;
  const ceilingWestOpen =
    arena.ceilingWestOpenRatio ??
    (WEST_WALL_HEIGHT_RATIO < 1 ? ARENA_CEILING_WEST_OPEN_RATIO : 0);

  const ceilingGroup = new THREE.Group();
  ceilingGroup.name = "arena_ceiling";
  group.add(ceilingGroup);

  const catwalkEdgeStandoff = arenaCatwalkEdgeStandoff(ceilingWestOpen, wallStandoff);
  let roomCatwalkMouthPad = ROOM_CATWALK_MOUTH_PAD_DEFAULT;

  function rebuildArenaCeiling(stairPlacement) {
    clearArenaCeilingGroup(ceilingGroup);
    clearRoomCatwalkDeckMeshes(ceilingGroup);
    ceilingColliders.length = 0;
    removeArenaCatwalkDeckSurfaces(groundSurfaces);
    removeRoomCatwalkDeckSurfaces(groundSurfaces);
    const cutout = stairPlacement ? getStairCeilingCutout(stairPlacement) : null;
    const stairTopBridge = stairPlacement
      ? getStairTopDeckBridgeFootprint(stairPlacement)
      : null;
    const roomCutouts = catwalkDeckFootprints.map((footprint) =>
      getRoomCatwalkDeckPiece(
        footprint,
        attachWall,
        half,
        WALL_THICKNESS,
        innerHalf,
        CEILING_PAD,
        roomCatwalkMouthPad
      )
    );
    addArenaCeilingDeck(
      ceilingGroup,
      ceilingColliders,
      groundSurfaces,
      ceilingFullWidth,
      ceilingFullDepth,
      CEILING_THICKNESS,
      ceilingBottomY,
      ceilingMat,
      ceilingWestOpen,
      cutout,
      ceilingTile,
      catwalkEdgeStandoff,
      stairTopBridge,
      roomCutouts
    );
    if (catwalkDeckFootprints.length) {
      syncRoomCatwalkDeck(
        ceilingGroup,
        ceilingColliders,
        groundSurfaces,
        catwalkDeckFootprints,
        attachWall,
        half,
        WALL_THICKNESS,
        innerHalf,
        CEILING_THICKNESS,
        ceilingBottomY,
        ceilingMat,
        ceilingTile,
        CEILING_PAD,
        catwalkEdgeStandoff,
        roomCatwalkMouthPad
      );
    }
    assignWorldLayers(ceilingGroup);
    enableShadowsOn(ceilingGroup);
  }

  const ceilingTopY = ceilingBottomY + CEILING_THICKNESS;
  const catwalkDeckY = ceilingTopY;

  const groundSurfaces = [];
  registerArenaPerimeterFloorSupport(groundSurfaces, half, WALL_THICKNESS);
  registerFullArenaDeckSupport(groundSurfaces, half, WALL_THICKNESS);
  const baseGroundSurfaceCount = groundSurfaces.length;

  /** @type {import("../physics/Collision.js").ColliderBox[]} */
  const ceilingColliders = [];

  const colliders = pillars.map((pillarDef) => {
    const { halfX, halfZ } = resolvePillarColliderHalf(pillarDef, arena);
    const { shape, cornerRadius } = resolvePillarShape(pillarDef, arena);
    return {
      x: pillarDef.x,
      z: pillarDef.z,
      halfX,
      halfZ,
      rotationY: pillarDef.rotationY ?? 0,
      bottomY: 0,
      topY: WALL_HEIGHT,
      kind: "pillar",
      cornerRadius: shape === "rounded" ? cornerRadius : 0,
    };
  });

  addArenaPerimeterWallColliders(
    colliders,
    half,
    ARENA_SIZE,
    WALL_HEIGHT,
    WALL_THICKNESS,
    westWallHeight,
    arena
  );

  const stairsGroup = new THREE.Group();
  stairsGroup.name = "arena_stairs";
  group.add(stairsGroup);

  const stairTreadTile = textureLibrary?.tileSize("floor_metal_grate_rusty") ?? 2;
  const stairTreadMat = makeDeckPieceMaterial(
    finalizeArenaSurfaceMaterial(
      textureLibrary?.createTiled("floor_metal_grate_rusty", 1, 1) ??
        new THREE.MeshStandardMaterial({ color: 0x6a6460 })
    ),
    stairTreadTile
  );
  const stairStringerMat = finalizeArenaSurfaceMaterial(
    textureLibrary?.createTiled(
      "decal_hazard_stripes_worn",
      1,
      1
    ) ?? stairTreadMat
  );

  /** @type {{ x: number, z: number, halfX: number, halfZ: number }[]} */
  const stairColliders = [];

  function applyStairFlight(config) {
    clearStairGroup(stairsGroup);
    stairColliders.length = 0;
    while (groundSurfaces.length > baseGroundSurfaceCount) groundSurfaces.pop();

    if (!config) {
      rebuildArenaCeiling(null);
      return;
    }

    const stringerShape = resolvePillarShape({ shape: "rounded" }, arena);
    const built = buildStairFlight(
      stairsGroup,
      config,
      stairTreadMat,
      stairStringerMat,
      {
        ...stringerShape,
        catwalkDeckY,
        treadTileSize: stairTreadTile,
        catwalkEdgeStandoff,
      }
    );
    groundSurfaces.push(...built.groundSurfaces);
    stairColliders.push(...built.colliders);
    assignWorldLayers(stairsGroup);
    enableShadowsOn(stairsGroup);
    rebuildArenaCeiling(config);
  }

  applyStairFlight(stairConfig);

  const pillarMeshes = [];
  for (let pi = 0; pi < pillars.length; pi++) {
    const pillarDef = pillars[pi];
    const materialId = pillarDef.texture ?? textures.pillar;
    const pillarTile = textureLibrary?.tileSize(materialId) ?? defaultPillarTile;
    const pillarMat = finalizeArenaSurfaceMaterial(
      textureLibrary?.createTiled(materialId, 1, 1) ??
        new THREE.MeshLambertMaterial({ color: 0xb8956a })
    );

    const { shape, cornerRadius, cornerSegments } = resolvePillarShape(
      pillarDef,
      arena
    );
    const pillarGeo = getPillarGeometry(
      shape,
      PILLAR_SIZE,
      WALL_HEIGHT,
      PILLAR_SIZE,
      { cornerRadius, cornerSegments }
    );
    applyContinuousBoxWorldUVs(pillarGeo, WALL_HEIGHT, pillarTile);

    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(pillarDef.x, WALL_HEIGHT / 2, pillarDef.z);
    pillar.rotation.y = pillarDef.rotationY ?? 0;
    pillar.userData.shadowCast = true;
    pillar.userData.shadowReceive = true;
    pillar.userData.arenaPillarId = materialId;
    pillar.userData.levelObject = {
      type: "pillar",
      index: pi,
      def: { ...pillarDef },
    };
    group.add(pillar);
    pillarMeshes.push(pillar);
    addPillarPoster(pillar, pillarDef, {
      pillarSize: PILLAR_SIZE,
      wallHeight: WALL_HEIGHT,
    });
  }

  const { containers: vx27ContainerMeshes, controlPanels: controlPanelMeshes } =
    spawnLevelProps(group, arena, colliders);

  let boundsMinX = -innerHalf;
  let boundsMaxX = innerHalf;
  let boundsMinZ = -innerHalf;
  let boundsMaxZ = innerHalf;

  for (const ext of floorExtensions) {
    buildFloorExtensionInterior(
      group,
      ext,
      floorWorldMat,
      textureLibrary,
      textures.wall,
      textures.ceiling ?? textures.floor,
      attachWall,
      half,
      WALL_THICKNESS,
      WALL_HEIGHT,
      ceilingBottomY,
      CEILING_THICKNESS,
      attachWallDoorways,
      floorTile,
      groundSurfaces,
      colliders
    );
    const fp = getFloorExtensionFootprint(
      ext,
      attachWall,
      half,
      WALL_THICKNESS
    );
    boundsMinX = Math.min(boundsMinX, fp.minX);
    boundsMaxX = Math.max(boundsMaxX, fp.maxX);
    if (attachWall === "north") {
      boundsMinZ = Math.min(boundsMinZ, fp.minZ);
    } else {
      boundsMaxZ = Math.max(boundsMaxZ, fp.maxZ);
    }
    const deckPiece = getRoomCatwalkDeckPiece(
      ext,
      attachWall,
      half,
      WALL_THICKNESS,
      innerHalf,
      CEILING_PAD,
      roomCatwalkMouthPad
    );
    boundsMinX = Math.min(boundsMinX, deckPiece.minX);
    boundsMaxX = Math.max(boundsMaxX, deckPiece.maxX);
    boundsMinZ = Math.min(boundsMinZ, deckPiece.minZ);
    boundsMaxZ = Math.max(boundsMaxZ, deckPiece.maxZ);
  }

  for (const room of rooms) {
    const built = buildAttachedRoom(
      group,
      room,
      textureLibrary,
      half,
      WALL_HEIGHT,
      colliders,
      attachWall,
      WALL_THICKNESS,
      CEILING_THICKNESS,
      attachWallDoorways,
      groundSurfaces,
      {
        arenaCeilingBottomY: ceilingBottomY,
        catwalkDeckY,
      }
    );
    boundsMinX = Math.min(boundsMinX, built.centerX - built.halfW);
    boundsMaxX = Math.max(boundsMaxX, built.centerX + built.halfW);
    boundsMinZ = Math.min(boundsMinZ, built.centerZ - built.halfD);
    boundsMaxZ = Math.max(boundsMaxZ, built.centerZ + built.halfD);

    const deckPiece = getRoomCatwalkDeckPiece(
      room,
      attachWall,
      half,
      WALL_THICKNESS,
      innerHalf,
      CEILING_PAD,
      roomCatwalkMouthPad
    );
    boundsMinX = Math.min(boundsMinX, deckPiece.minX);
    boundsMaxX = Math.max(boundsMaxX, deckPiece.maxX);
    boundsMinZ = Math.min(boundsMinZ, deckPiece.minZ);
    boundsMaxZ = Math.max(boundsMaxZ, deckPiece.maxZ);

    if (attachWallDoorways.length && built.floorSouthZ != null) {
      for (const doorway of attachWallDoorways) {
        addDoorwayFloorBridge(
          group,
          floorWorldMat,
          doorway,
          half,
          attachWall,
          WALL_THICKNESS,
          built.floorSouthZ,
          groundSurfaces,
          floorTile
        );
      }
    }
  }

  syncRoomCatwalkDeck(
    ceilingGroup,
    ceilingColliders,
    groundSurfaces,
    catwalkDeckFootprints,
    attachWall,
    half,
    WALL_THICKNESS,
    innerHalf,
    CEILING_THICKNESS,
    ceilingBottomY,
    ceilingMat,
    ceilingTile,
    CEILING_PAD,
    catwalkEdgeStandoff,
    roomCatwalkMouthPad
  );

  // Make wall and pillar tops walkable — bounded to each collider footprint only.
  for (const c of colliders) {
    if (c.kind !== "wall" && c.kind !== "pillar") continue;
    if (!Number.isFinite(c.topY)) continue;
    groundSurfaces.push({
      minX: c.x - c.halfX,
      maxX: c.x + c.halfX,
      minZ: c.z - c.halfZ,
      maxZ: c.z + c.halfZ,
      y: c.topY,
    });
  }

  const bounds = {
    minX: boundsMinX,
    maxX: boundsMaxX,
    minZ: boundsMinZ,
    maxZ: boundsMaxZ,
  };
  const arenaBounds = {
    minX: -innerHalf,
    maxX: innerHalf,
    minZ: -innerHalf,
    maxZ: innerHalf,
  };
  const roomAttachExtentZ =
    attachWall === "north" ? boundsMinZ : boundsMaxZ;
  const doorwayPassages = buildDoorwayPassages(
    attachWallDoorways,
    attachWall,
    half,
    WALL_THICKNESS,
    innerHalf,
    roomAttachExtentZ
  );
  const doorwayOpenings = attachWallDoorways.map(resolveDoorOpening);
  const floorBounds = {
    minX: Math.min(boundsMinX, -half - WALL_THICKNESS),
    maxX: Math.max(boundsMaxX, half + WALL_THICKNESS),
    minZ: Math.min(boundsMinZ, -half - WALL_THICKNESS),
    maxZ: Math.max(boundsMaxZ, half + WALL_THICKNESS),
  };
  const targetConfig = resolveTargetConfig(arena);
  const { targets, sharedGeo: targetGeo } = spawnTargets({
    group,
    bounds: arenaBounds,
    colliders: [...colliders, ...stairColliders],
    targetColliderSink: colliders,
    config: targetConfig,
    floorHoles,
    spawnCtx: {
      groundSurfaces,
      floorY: 0,
      floorHoles,
      floorBounds,
    },
    gameCore,
  });

  for (const posterDef of arena.posters ?? []) {
    addWallPoster(group, posterDef, {
      half,
      wallHeight: WALL_HEIGHT,
      westWallHeight,
    });
  }

  scene.add(group);
  assignWorldLayers(group);
  ensureOilBarrelFlameMeshes(group);
  refreshOilBarrelRenderLayers(group);
  refreshVx27ContainerRenderLayers(group);
  refreshControlPanelRenderLayers(group);

  return {
    group,
    targets,
    targetConfig,
    targetGeo,
    colliders,
    bounds,
    arenaBounds,
    attachWall,
    doorwayPassages,
    doorwayOpenings,
    floorBounds,
    floorY: 0,
    floorHoles,
    wallHeight: WALL_HEIGHT,
    ceilingBottomY,
    ceilingTopY,
    catwalkDeckY,
    catwalkClearance: CATWALK_CLEARANCE,
    westWallHeight: WALL_HEIGHT * WEST_WALL_HEIGHT_RATIO,
    arenaId: arena.id,
    rooms,
    groundSurfaces,
    stairColliders,
    ceilingColliders,
    rebuildStairs: applyStairFlight,
    rebuildOilBarrels: () => rebuildLevelOilBarrels(group, arena),
    resyncOilBarrelColliders: () => resyncOilBarrelColliders(colliders, arena),
    resyncControlPanelColliders: () => resyncControlPanelColliders(colliders, arena),
    pillarMeshes,
    vx27ContainerMeshes,
    controlPanelMeshes,
    pickupsGroup,
  };
}

function disposeDoorwayWallSubtree(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((obj) => {
    if (obj.geometry && !geometries.has(obj.geometry)) {
      geometries.add(obj.geometry);
      obj.geometry.dispose();
    }
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat || materials.has(mat)) continue;
      materials.add(mat);
      for (const key of ["map", "normalMap", "roughnessMap"]) {
        mat[key]?.dispose?.();
      }
      mat.dispose();
    }
  });
}

function removeArenaDoorwayWallSide(group, side) {
  const remove = [];
  for (const child of group.children) {
    if (child.userData?.arenaDoorwayWall === side) remove.push(child);
  }
  for (const obj of remove) {
    disposeDoorwayWallSubtree(obj);
    group.remove(obj);
  }
}

/**
 * Rebuild north/south doorway extrude after arch-door sill tuning.
 *
 * @param {THREE.Group} group
 * @param {import("./loadArena.js").ArenaConfig} arena
 * @param {number} half
 * @param {number} arenaSize
 * @param {number} wallHeight
 * @param {number} wallThickness
 * @param {number} wallTile
 * @param {THREE.Material} wallMatNorthSouth
 * @param {"north" | "south"} side
 */
export function rebuildArenaDoorwayWall(
  group,
  arena,
  half,
  arenaSize,
  wallHeight,
  wallThickness,
  wallTile,
  wallMatNorthSouth,
  side
) {
  const doorways = getDoorwaysOnWall(arena, side);
  if (!doorways.length) return;
  removeArenaDoorwayWallSide(group, side);
  addDoorwayWall(
    group,
    wallMatNorthSouth,
    doorways,
    half,
    arenaSize,
    wallHeight,
    wallThickness,
    side,
    wallTile
  );
}

/** Remove level meshes from the scene and dispose GPU resources (HMR / unmount). */
export function disposeLevelGroup(group) {
  if (!group) return;
  const geometries = new Set();
  const materials = new Set();
  group.traverse((obj) => {
    if (obj.geometry && !geometries.has(obj.geometry)) {
      geometries.add(obj.geometry);
      obj.geometry.dispose();
    }
    const { material } = obj;
    if (!material) return;
    const mats = Array.isArray(material) ? material : [material];
    for (const mat of mats) {
      if (!materials.has(mat)) {
        materials.add(mat);
        if (mat.userData?.pillarPosterOwned) {
          mat.map?.dispose();
        }
        mat.dispose();
      }
    }
  });
  group.parent?.remove(group);
}

/** @deprecated Use createLevelFromArena with loadArenaConfig() */
export function createSquareLevel(scene, textureLibrary = null) {
  const arena = {
    id: "level1",
    name: "Level 1",
    size: 28,
    wallHeight: 4,
    wallThickness: 0.5,
    pillarSize: 1.2,
    playerBoundsInset: 0.35,
    wallStandoff: 0.5,
    textures: {
      floor: "ground_concrete_asphalt_dirty",
      wall: "wall_poured_concrete_industrial",
      pillar: "wall_corrugated_metal_weathered",
    },
    pillarDefaults: { shape: "box", cornerRadius: 0.12, cornerSegments: 4 },
    pillars: [
      { x: -8, z: -8, shape: "rounded" },
      { x: 8, z: -8, shape: "rounded" },
      { x: -8, z: 8, shape: "rounded" },
      { x: 8, z: 8, shape: "rounded" },
      { x: 0, z: 0, shape: "rounded", texture: "decal_hazard_stripes_worn" },
    ],
    target: { count: 5, radius: 0.45, height: 2.2, maxHealth: 30, respawnDelay: 2.5 },
  };
  return createLevelFromArena(scene, arena, textureLibrary);
}
