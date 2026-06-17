import * as THREE from "three";
import {
  pinLightToRoomInteriorLayer,
  setHealthBarLayer,
  setRoomInteriorLayer,
} from "../lighting/LightingLayers.js";
import { resolveTargetConfig, spawnTargets } from "../combat/Targets.js";
import { rebuildLevelOilBarrels, spawnLevelProps } from "./LevelProps.js";
import { FLOOR_THICKNESS } from "./LevelConstants.js";
import { applyDeckPieceWorldUVs } from "./WallBoxUV.js";

const ACCENT_BLUE = 0x3a8cff;
const LIGHT_PANEL_COLOR = 0xe8f4ff;
const RIB_COLOR = 0xb8c4d4;

/**
 * @param {import("./LevelTextures.js").TextureLibrary | null} textureLibrary
 * @param {string} texId
 * @param {number} [mul=1.35]
 */
function corridorSurfaceMat(textureLibrary, texId, mul = 1.35) {
  const tile = textureLibrary?.tileSize(texId) ?? 3;
  const mat =
    textureLibrary?.createTiled(texId, 1 / tile, 1 / tile) ??
    new THREE.MeshStandardMaterial({ color: 0xd0dae8 });
  if (mat.color) mat.color.multiplyScalar(mul);
  mat.roughness = 0.48;
  mat.metalness = 0.12;
  return mat;
}

/** @param {number} color @param {number} [intensity] */
function emissiveMat(color, intensity = 2.2) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.05,
  });
}

/**
 * @param {THREE.Group} shell
 * @param {THREE.Material} mat
 * @param {"left" | "right"} side
 * @param {number} centerZ
 * @param {number} length
 * @param {number} innerHalfW
 * @param {number} wallHeight
 * @param {number} chamfer
 */
function addCornerChamfer(shell, mat, side, centerZ, length, innerHalfW, wallHeight, chamfer) {
  const diag = chamfer * Math.SQRT2;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(diag, wallHeight, length), mat);
  const xSign = side === "left" ? -1 : 1;
  mesh.position.set(
    xSign * (innerHalfW + chamfer * 0.32),
    wallHeight / 2,
    centerZ
  );
  mesh.rotation.z = xSign * (Math.PI / 4);
  shell.add(mesh);
}

/**
 * @param {THREE.Group} shell
 * @param {number} centerZ
 * @param {number} innerWidth
 * @param {number} wallHeight
 * @param {number} wallThickness
 */
function addSegmentRib(shell, centerZ, innerWidth, wallHeight, wallThickness) {
  const ribMat = new THREE.MeshStandardMaterial({
    color: RIB_COLOR,
    roughness: 0.42,
    metalness: 0.28,
  });
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(innerWidth + wallThickness * 2, 0.14, 0.22),
    ribMat
  );
  beam.position.set(0, wallHeight - 0.08, centerZ);
  shell.add(beam);

  for (const xSign of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, wallHeight * 0.92, 0.18),
      ribMat
    );
    post.position.set(xSign * (innerWidth / 2 + wallThickness * 0.35), wallHeight * 0.46, centerZ);
    shell.add(post);
  }
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.Group} shell
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {import("./loadArena.js").ArenaConfig} arena
 * @param {NonNullable<import("./loadArena.js").ArenaConfig["corridor"]>["lights"]} lightCfg
 */
function addCeilingLight(scene, shell, x, y, z, lightCfg) {
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.06, 1.35),
    emissiveMat(LIGHT_PANEL_COLOR, 3.5)
  );
  panel.position.set(x, y, z);
  shell.add(panel);

  const ring = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.03, 1.55),
    new THREE.MeshStandardMaterial({ color: 0x9aa8b8, roughness: 0.35, metalness: 0.4 })
  );
  ring.position.set(x, y + 0.04, z);
  shell.add(ring);

  const light = new THREE.PointLight(
    lightCfg?.color ?? "#e8f4ff",
    lightCfg?.intensity ?? 14,
    lightCfg?.distance ?? 11,
    lightCfg?.decay ?? 2
  );
  light.position.set(x, y - 0.15, z);
  pinLightToRoomInteriorLayer(light);
  scene.add(light);
  return light;
}

/**
 * @param {THREE.Group} shell
 * @param {number} centerZ
 * @param {number} length
 * @param {number} innerHalfW
 * @param {number} wallHeight
 */
function addWallAccentStrips(shell, centerZ, length, innerHalfW, wallHeight) {
  for (const xSign of [-1, 1]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, wallHeight * 0.55, length * 0.88),
      emissiveMat(ACCENT_BLUE, 1.8)
    );
    strip.position.set(xSign * (innerHalfW - 0.12), wallHeight * 0.52, centerZ);
    shell.add(strip);
  }

  for (const zOff of [-length * 0.38, length * 0.38]) {
    for (const xSign of [-1, 1]) {
      const corner = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, length * 0.42),
        emissiveMat(ACCENT_BLUE, 2.4)
      );
      corner.position.set(
        xSign * (innerHalfW + 0.08),
        wallHeight - 0.22,
        centerZ + zOff
      );
      shell.add(corner);
    }
  }
}

/**
 * @param {THREE.Scene} scene
 * @param {import("./loadArena.js").ArenaConfig} arena
 * @param {Awaited<ReturnType<import("./LevelTextures.js").loadLevelTextureLibrary>>} [textureLibrary]
 */
export function createCorridorLevel(scene, arena, textureLibrary = null, gameCore = null) {
  const cfg = arena.corridor ?? {};
  const innerWidth = cfg.width ?? 4;
  const wallHeight = cfg.height ?? 3.6;
  const wallThickness = cfg.wallThickness ?? 0.14;
  const chamfer = cfg.chamfer ?? 0.38;
  const segmentLength = cfg.segmentLength ?? 8;
  const segmentCount = cfg.segmentCount ?? 10;
  const tex = cfg.textures ?? arena.textures ?? {};
  const lightCfg = cfg.lights ?? {};
  const wallStandoff = arena.wallStandoff ?? 0.45;

  const innerHalfW = innerWidth / 2;
  const totalLength = segmentCount * segmentLength;
  const zStart = totalLength / 2;
  const zEnd = -totalLength / 2;

  const floorMat = corridorSurfaceMat(textureLibrary, tex.floor ?? "floor_metal_grate_rusty", 1.2);
  const wallMat = corridorSurfaceMat(textureLibrary, tex.wall ?? "ground_smooth_concrete_worn", 1.45);
  const ceilingMat = corridorSurfaceMat(textureLibrary, tex.ceiling ?? "ground_smooth_concrete_worn", 1.5);

  const group = new THREE.Group();
  group.name = "corridor_level";
  group.userData.roomInterior = true;

  const shell = new THREE.Group();
  shell.name = "corridor_shell";
  shell.userData.roomInterior = true;
  group.add(shell);

  const pickupsGroup = new THREE.Group();
  pickupsGroup.name = "level_pickups";
  group.add(pickupsGroup);

  const colliders = [];
  const groundSurfaces = [];
  const interiorLights = [];
  const floorTile = textureLibrary?.tileSize(tex.floor ?? "floor_metal_grate_rusty") ?? 2;

  for (let i = 0; i < segmentCount; i++) {
    const centerZ = zStart - (i + 0.5) * segmentLength;

    const floorGeo = new THREE.BoxGeometry(innerWidth, FLOOR_THICKNESS, segmentLength);
    applyDeckPieceWorldUVs(
      floorGeo,
      -innerHalfW,
      innerHalfW,
      centerZ - segmentLength / 2,
      centerZ + segmentLength / 2,
      FLOOR_THICKNESS,
      floorTile
    );
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -FLOOR_THICKNESS / 2;
    floor.receiveShadow = true;
    shell.add(floor);

    groundSurfaces.push({
      minX: -innerHalfW + 0.08,
      maxX: innerHalfW - 0.08,
      minZ: centerZ - segmentLength / 2 + 0.08,
      maxZ: centerZ + segmentLength / 2 - 0.08,
      y: 0,
    });

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(innerWidth, 0.12, segmentLength),
      ceilingMat
    );
    ceiling.position.set(0, wallHeight - 0.06, centerZ);
    ceiling.userData.shadowCast = false;
    shell.add(ceiling);

    for (const xSign of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, wallHeight * 0.88, segmentLength),
        wallMat
      );
      wall.position.set(
        xSign * (innerHalfW + wallThickness / 2),
        wallHeight * 0.44,
        centerZ
      );
      wall.castShadow = true;
      wall.receiveShadow = true;
      shell.add(wall);

      colliders.push({
        kind: "wall",
        x: xSign * (innerHalfW + wallThickness / 2),
        z: centerZ,
        halfX: wallThickness / 2,
        halfZ: segmentLength / 2,
        topY: wallHeight,
        bottomY: 0,
      });
    }

    addCornerChamfer(shell, wallMat, "left", centerZ, segmentLength, innerHalfW, wallHeight, chamfer);
    addCornerChamfer(shell, wallMat, "right", centerZ, segmentLength, innerHalfW, wallHeight, chamfer);
    addWallAccentStrips(shell, centerZ, segmentLength, innerHalfW, wallHeight);
    addSegmentRib(shell, centerZ + segmentLength / 2, innerWidth, wallHeight, wallThickness);

    interiorLights.push(
      addCeilingLight(scene, shell, 0, wallHeight - 0.18, centerZ, lightCfg)
    );
  }

  // Far end — sealed bulkhead with door frame
  const bulkheadZ = zEnd - 0.35;
  const bulkhead = new THREE.Mesh(
    new THREE.BoxGeometry(innerWidth + wallThickness * 2, wallHeight, 0.35),
    wallMat
  );
  bulkhead.position.set(0, wallHeight / 2, bulkheadZ);
  shell.add(bulkhead);
  colliders.push({
    kind: "wall",
    x: 0,
    z: bulkheadZ,
    halfX: innerHalfW + wallThickness,
    halfZ: 0.2,
    topY: wallHeight,
    bottomY: 0,
  });

  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 2.35, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x8898a8, roughness: 0.3, metalness: 0.55 })
  );
  doorFrame.position.set(0, 1.18, bulkheadZ + 0.12);
  shell.add(doorFrame);

  const doorSlab = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 2.05, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.65, metalness: 0.2 })
  );
  doorSlab.position.set(0, 1.05, bulkheadZ + 0.16);
  shell.add(doorSlab);

  // Entry airlock frame at south end
  const entryZ = zStart + 0.2;
  addSegmentRib(shell, entryZ, innerWidth, wallHeight, wallThickness);

  const walkHalfX = innerHalfW - wallStandoff;
  const walkHalfZ = totalLength / 2 - wallStandoff - 0.5;
  const bounds = {
    minX: -walkHalfX,
    maxX: walkHalfX,
    minZ: zEnd + wallStandoff,
    maxZ: zStart - wallStandoff,
  };
  const arenaBounds = { ...bounds };
  const floorBounds = { ...bounds };

  const targetConfig = resolveTargetConfig(arena);
  const { targets, sharedGeo: targetGeo } = spawnTargets({
    group,
    bounds: arenaBounds,
    colliders,
    config: targetConfig,
    floorHoles: [],
    spawnCtx: {
      groundSurfaces,
      floorY: 0,
      floorHoles: [],
      floorBounds,
    },
    gameCore,
  });

  const { containers, controlPanels } = spawnLevelProps(group, arena, colliders);

  shell.traverse((obj) => {
    if (obj.isMesh) setRoomInteriorLayer(obj);
  });
  for (const target of targets) {
    target.traverse((obj) => {
      if (obj.isMesh) setRoomInteriorLayer(obj);
    });
    if (target.userData.healthBar) {
      setHealthBarLayer(target.userData.healthBar);
    }
  }
  group.traverse((obj) => {
    if (!obj.isMesh || obj.userData.isTarget) return;
    let parent = obj.parent;
    while (parent && parent !== group) {
      if (parent.userData?.roomInterior) return;
      parent = parent.parent;
    }
    setRoomInteriorLayer(obj);
  });

  scene.add(group);

  return {
    group,
    targets,
    targetConfig,
    targetGeo,
    colliders,
    bounds,
    arenaBounds,
    attachWall: "north",
    doorwayPassages: [],
    doorwayOpenings: [],
    floorBounds,
    floorY: 0,
    floorHoles: [],
    wallHeight,
    ceilingBottomY: wallHeight - 0.12,
    ceilingTopY: wallHeight,
    catwalkDeckY: null,
    catwalkClearance: 0,
    westWallHeight: wallHeight,
    arenaId: arena.id,
    rooms: [],
    groundSurfaces,
    stairColliders: [],
    ceilingColliders: [],
    interiorLights,
    rebuildStairs: () => {},
    rebuildOilBarrels: () => rebuildLevelOilBarrels(group, arena),
    resyncOilBarrelColliders: () => {},
    resyncControlPanelColliders: () => {},
    pillarMeshes: [],
    vx27ContainerMeshes: containers,
    controlPanelMeshes: controlPanels,
    pickupsGroup,
    isCorridor: true,
  };
}
