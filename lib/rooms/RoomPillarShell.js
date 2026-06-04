import * as THREE from "three";
import {
  addShadowOccluderBox,
  addShadowOccluderHorizontalSlab,
} from "../lighting/ShadowOccluders.js";
import {
  applyCentredBoxWorldUVs,
  applyDoorwayExtrudeUVs,
} from "../level/WallBoxUV.js";
import {
  appendDoorwayHoles,
  resolveDoorOpening,
  pushDoorColliders,
  subtractXIntervals,
  openingsToExclusions,
} from "./DoorwayWall.js";
import {
  getAttachedRoomCenterZ,
  getRoomFloorSouthZ,
  getRoomSideHalfWallSpan,
} from "./RoomPlacement.js";
import {
  WALL_FLOOR_EMBED,
  WALL_VISUAL_FLOOR_EMBED,
  wallVisualCenterY,
} from "../level/LevelConstants.js";
import { getArenaAttachWall, getDoorwaysOnWall } from "./DoorwayWall.js";

const ARCH_CURVE_SEGMENTS = 32;
/** Stop side shells a hair before the mouth midplane — avoids coplanar z-fight with the extruded mouth. */
const MOUTH_MEET_INSET = 0.008;

function finalizeShellMaterial(mat) {
  if (!mat) return mat;
  mat.roughness = 1;
  mat.metalness = 0;
  mat.depthWrite = true;
  mat.depthTest = true;
  return mat;
}

function shellWallMaterial(textureLibrary, wallId) {
  const mat =
    textureLibrary?.createTiled(wallId, 1, 1) ??
    new THREE.MeshStandardMaterial({ color: 0x8a9ab0 });
  if (mat.color) mat.color.multiplyScalar(0.38);
  const m = finalizeShellMaterial(mat);
  m.polygonOffset = true;
  m.polygonOffsetFactor = 1;
  m.polygonOffsetUnits = 1;
  return m;
}

function doorwayShellMaterial(baseMat) {
  if (!baseMat?.clone) return baseMat;
  const m = baseMat.clone();
  for (const key of ["map", "normalMap", "roughnessMap"]) {
    const tex = m[key];
    if (!tex) continue;
    const cloned = tex.clone();
    cloned.repeat.set(1, 1);
    cloned.offset.set(0, 0);
    cloned.needsUpdate = true;
    m[key] = cloned;
  }
  const out = finalizeShellMaterial(m);
  out.polygonOffset = true;
  out.polygonOffsetFactor = 2;
  out.polygonOffsetUnits = 2;
  return out;
}

/**
 * Mouth wall with doorway cutouts (room-interior pass; same extrude path as arena doorways).
 */
function addMouthWallWithDoorways(
  shellGroup,
  wallMat,
  spanLeft,
  spanRight,
  openings,
  arenaHalf,
  arenaSize,
  wallHeight,
  extrudeBaseZ,
  extrudeDepth,
  wallTile
) {
  if (spanRight - spanLeft < 0.05) return;

  const wallBottom = -WALL_VISUAL_FLOOR_EMBED;
  const wallTop = wallHeight - WALL_VISUAL_FLOOR_EMBED;
  const shape = new THREE.Shape();
  shape.moveTo(spanLeft, wallBottom);
  shape.lineTo(spanRight, wallBottom);
  shape.lineTo(spanRight, wallTop);
  shape.lineTo(spanLeft, wallTop);
  shape.closePath();
  appendDoorwayHoles(shape, openings, spanLeft, spanRight, wallBottom);

  const tile = wallTile > 0 ? wallTile : 3;
  const uvGen = {
    generateTopUV(_geo, verts, iA, iB, iC) {
      const uv = (i) =>
        new THREE.Vector2(
          (verts[i * 3] + arenaHalf) / tile,
          verts[i * 3 + 1] / tile
        );
      return [uv(iA), uv(iB), uv(iC)];
    },
    generateSideWallUV() {
      return [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(1, 0),
        new THREE.Vector2(1, 1),
        new THREE.Vector2(0, 1),
      ];
    },
  };

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
    arenaHalf,
    wallBottom,
    wallTile,
    extrudeDepth,
    openings,
    0
  );

  const mesh = new THREE.Mesh(geo, doorwayShellMaterial(wallMat));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.roomPillarShell = true;
  mesh.userData.bulletSurfaceKind = "wall";
  shellGroup.add(mesh);
}

function addShellWallBox(
  shellGroup,
  wallMat,
  boxW,
  boxH,
  boxD,
  centerX,
  centerY,
  centerZ,
  wallTile,
  name
) {
  const geo = new THREE.BoxGeometry(boxW, boxH, boxD);
  applyCentredBoxWorldUVs(geo, boxW, boxH, boxD, wallTile);
  const mesh = new THREE.Mesh(geo, wallMat);
  mesh.position.set(centerX, centerY, centerZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  mesh.userData.roomPillarShell = true;
  mesh.userData.bulletSurfaceKind = "wall";
  shellGroup.add(mesh);
  return mesh;
}

/**
 * Pillar-style room shell: visuals on ROOM_INTERIOR_LAYER; sun occluders on world layer.
 * Back + sides are solid boxes; the arena-facing mouth uses extruded doorway cutouts.
 *
 * @param {THREE.Object3D} interiorShell Room-interior pass — walls + mouth (no sun).
 * @param {import("../level/loadArena.js").ArenaRoom} room
 * @param {Awaited<ReturnType<import("../level/LevelTextures.js").loadLevelTextureLibrary>>} textureLibrary
 * @param {number} arenaHalf
 * @param {number} arenaSize
 * @param {number} arenaWallThickness
 * @param {"north" | "south"} attachWall
 * @param {import("../level/loadArena.js").ArenaDoorway[]} doorways
 * @param {{ x: number, z: number, halfX: number, halfZ: number }[]} colliders
 * @param {THREE.Group} sunOccluders World-layer shadow boxes (merged with ceiling slab in LevelRoom).
 */
export function buildRoomPillarShell(
  interiorShell,
  room,
  textureLibrary,
  arenaHalf,
  arenaSize,
  arenaWallThickness,
  attachWall,
  doorways,
  colliders,
  sunOccluders
) {
  const {
    centerX,
    width,
    depth,
    height,
    wallThickness = 0.35,
    textures,
  } = room;
  const wallHeight = height ?? 4;
  const wallId = textures.wall;
  const wallTile = textureLibrary?.tileSize(wallId) ?? 3.2;
  const wallMat = shellWallMaterial(textureLibrary, wallId);
  const halfW = width / 2;
  const halfD = depth / 2;
  const wallY = wallVisualCenterY(wallHeight);
  const idPrefix = room.id ? `${room.id}_` : "";
  const shellRoomId = room.id ?? "pillar_room";
  const pushShellCollider = (entry) => {
    colliders.push({ ...entry, pillarShellRoomId: shellRoomId });
  };

  const roomCenterZ = getAttachedRoomCenterZ(
    room,
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

  /** Room-side half only — arena play-side half already owns innerZ→midZ. */
  const { extrudeBaseZ: mouthBaseZ, extrudeDepth: mouthDepth, meetZ } =
    getRoomSideHalfWallSpan(attachWall, arenaHalf, arenaWallThickness);

  const visualGroup = new THREE.Group();
  visualGroup.name = `${idPrefix}pillar_shell_visual`;
  visualGroup.userData.roomPillarShellVisual = true;
  interiorShell.add(visualGroup);

  const backZ =
    attachWall === "north"
      ? roomCenterZ - halfD + wallThickness / 2
      : roomCenterZ + halfD - wallThickness / 2;
  addShellWallBox(
    visualGroup,
    wallMat,
    width,
    wallHeight,
    wallThickness,
    centerX,
    wallY,
    backZ,
    wallTile,
    `${idPrefix}shell_back`
  );
  pushShellCollider({
    x: centerX,
    z: backZ,
    halfX: halfW,
    halfZ: wallThickness / 2,
    bottomY: -WALL_FLOOR_EMBED,
    topY: wallHeight,
    kind: "wall",
  });

  const meetEdgeZ =
    attachWall === "north" ? meetZ - MOUTH_MEET_INSET : meetZ + MOUTH_MEET_INSET;
  const sideZMin = Math.min(roomFloorNorthZ, meetEdgeZ);
  const sideZMax = Math.max(roomFloorNorthZ, meetEdgeZ);
  const sideDepth = sideZMax - sideZMin;
  const sideCenterZ = (sideZMin + sideZMax) / 2;
  const leftX = centerX - halfW + wallThickness / 2;
  const rightX = centerX + halfW - wallThickness / 2;

  addShellWallBox(
    visualGroup,
    wallMat,
    wallThickness,
    wallHeight,
    sideDepth,
    leftX,
    wallY,
    sideCenterZ,
    wallTile,
    `${idPrefix}shell_left`
  );
  addShellWallBox(
    visualGroup,
    wallMat,
    wallThickness,
    wallHeight,
    sideDepth,
    rightX,
    wallY,
    sideCenterZ,
    wallTile,
    `${idPrefix}shell_right`
  );
  pushShellCollider({
    x: leftX,
    z: sideCenterZ,
    halfX: wallThickness / 2,
    halfZ: sideDepth / 2,
    bottomY: -WALL_FLOOR_EMBED,
    topY: wallHeight,
    kind: "wall",
  });
  pushShellCollider({
    x: rightX,
    z: sideCenterZ,
    halfX: wallThickness / 2,
    halfZ: sideDepth / 2,
    bottomY: -WALL_FLOOR_EMBED,
    topY: wallHeight,
    kind: "wall",
  });

  const spanLeft = centerX - halfW;
  const spanRight = centerX + halfW;
  const onAttach = doorways.filter(
    (d) => (d.wall ?? attachWall) === attachWall
  );
  const inRoom = onAttach.filter((d) => {
    const cx = d.centerX ?? 0;
    return cx >= spanLeft && cx <= spanRight;
  });
  const openings = inRoom.map(resolveDoorOpening);

  addMouthWallWithDoorways(
    visualGroup,
    wallMat,
    spanLeft,
    spanRight,
    openings,
    arenaHalf,
    arenaSize,
    wallHeight,
    mouthBaseZ,
    mouthDepth,
    wallTile
  );

  const mouthSolidSpans = subtractXIntervals(
    spanLeft,
    spanRight,
    openingsToExclusions(openings)
  );
  const mouthCenterZ = mouthBaseZ + mouthDepth / 2;
  for (const [x0, x1] of mouthSolidSpans) {
    if (x1 - x0 < 0.08) continue;
    pushShellCollider({
      x: (x0 + x1) / 2,
      z: mouthCenterZ,
      halfX: (x1 - x0) / 2,
      halfZ: mouthDepth / 2,
      bottomY: -WALL_FLOOR_EMBED,
      topY: wallHeight,
      kind: "wall",
    });
  }
  for (const op of openings) {
    pushDoorColliders(
      (lx, rx, bottomY, topY) => {
        pushShellCollider({
          x: (lx + rx) / 2,
          z: mouthCenterZ,
          halfX: (rx - lx) / 2,
          halfZ: mouthDepth / 2,
          bottomY,
          topY,
          kind: "wall",
        });
      },
      op,
      wallHeight
    );
  }

  addShadowOccluderBox(
    sunOccluders,
    width,
    wallHeight,
    wallThickness,
    centerX,
    wallY,
    backZ
  );
  addShadowOccluderBox(
    sunOccluders,
    wallThickness,
    wallHeight,
    sideDepth,
    leftX,
    wallY,
    sideCenterZ
  );
  addShadowOccluderBox(
    sunOccluders,
    wallThickness,
    wallHeight,
    sideDepth,
    rightX,
    wallY,
    sideCenterZ
  );
  for (const [x0, x1] of mouthSolidSpans) {
    if (x1 - x0 < 0.08) continue;
    addShadowOccluderBox(
      sunOccluders,
      x1 - x0,
      wallHeight,
      mouthDepth,
      (x0 + x1) / 2,
      wallY,
      mouthCenterZ
    );
  }
  return { visualGroup, roomFloorSouthZ, roomFloorNorthZ, halfW, halfD };
}
