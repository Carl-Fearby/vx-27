import * as THREE from "three";
import { setWeatherLayer, WEATHER_RENDER_ORDER } from "@/lib/lighting/LightingLayers.js";
import { getArenaDoorInnerZ } from "@/lib/rooms/RoomPlacement.js";
import { DEFAULT_RAIN_INTENSITY } from "@/lib/RainTuning.js";

/** Drops at 100% intensity — scales up to 500%. */
const PARTICLE_BASE = 6500;
const PARTICLE_COUNT = PARTICLE_BASE * 5;
const BOX_HALF_W = 22;
const BOX_HALF_H = 18;
const BOX_HALF_D = 22;
const STREAK_WIDTH = 0.016;
const STREAK_HEIGHT = 0.36;
const FALL_SPEED = 24;
const WIND_X = 2.1;
const WIND_Z = 0.7;
const WIND_TILT_Z = -0.14;
/** Meters into the arena past the door plane — vista volume sits here when indoors. */
const INDOOR_VISTA_ARENA_PUSH = 5.5;

/**
 * Horizontal rain blocker — axis-aligned rect (min/max) or oriented box (x,z,halfX,halfZ,rotationY).
 * @typedef {{ y: number, minX?: number, maxX?: number, minZ?: number, maxZ?: number, x?: number, z?: number, halfX?: number, halfZ?: number, rotationY?: number }} RainOccluder
 */

const STAIR_RAIN_OCCLUDER_KINDS = new Set([
  "stairBackSlice",
  "stairSideInner",
  "stairSideOuter",
  "stairSideTop",
  "stairBack",
  "stairRearCurtain",
]);

/** @type {THREE.BufferGeometry | null} */
let _streakGeo = null;
/** @type {THREE.MeshBasicMaterial | null} */
let _streakMat = null;
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _hideScale = new THREE.Vector3(0, 0, 0);
const _euler = new THREE.Euler(0, 0, WIND_TILT_Z);

/**
 * @param {number} wx
 * @param {number} wz
 * @param {RainOccluder} occ
 */
function inOccluderFootprint(wx, wz, occ) {
  if (occ.halfX != null && occ.x != null && occ.z != null) {
    const dx = wx - occ.x;
    const dz = wz - occ.z;
    if (occ.rotationY) {
      const c = Math.cos(-occ.rotationY);
      const s = Math.sin(-occ.rotationY);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      return Math.abs(lx) <= occ.halfX + 0.02 && Math.abs(lz) <= occ.halfZ + 0.02;
    }
    return Math.abs(dx) <= occ.halfX + 0.02 && Math.abs(dz) <= occ.halfZ + 0.02;
  }
  return (
    wx >= occ.minX &&
    wx <= occ.maxX &&
    wz >= occ.minZ &&
    wz <= occ.maxZ
  );
}

/**
 * @param {number} wx
 * @param {number} wz
 * @param {number} streakBottomY
 * @param {RainOccluder[]} occluders
 * @returns {number | null}
 */
/** @type {typeof blockingSurfaceTopY} */
export function sampleSurfaceTopY(wx, wz, sampleBottomY, occluders) {
  return blockingSurfaceTopY(wx, wz, sampleBottomY, occluders);
}

function blockingSurfaceTopY(wx, wz, streakBottomY, occluders) {
  let top = null;
  for (const occ of occluders) {
    if (!inOccluderFootprint(wx, wz, occ)) continue;
    if (streakBottomY < occ.y + 0.04) {
      if (top === null || occ.y > top) top = occ.y;
    }
  }
  return top;
}

/** @param {RainOccluder} occ */
function occluderKey(occ) {
  if (occ.halfX != null && occ.x != null && occ.z != null) {
    return [
      "obb",
      occ.x.toFixed(2),
      occ.z.toFixed(2),
      occ.halfX.toFixed(2),
      occ.halfZ.toFixed(2),
      (occ.rotationY ?? 0).toFixed(4),
      occ.y.toFixed(3),
    ].join("|");
  }
  return [
    "aabb",
    occ.minX.toFixed(2),
    occ.maxX.toFixed(2),
    occ.minZ.toFixed(2),
    occ.maxZ.toFixed(2),
    occ.y.toFixed(3),
  ].join("|");
}

/** @param {RainOccluder[]} occluders @param {RainOccluder} occ */
function pushOccluder(occluders, seen, occ) {
  const key = occluderKey(occ);
  if (seen.has(key)) return;
  seen.add(key);
  occluders.push(occ);
}

/**
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number, y: number, arenaCatwalkDeck?: boolean, roomCatwalkDeck?: boolean, stairSideWalk?: boolean }[]} groundSurfaces
 * @param {number | null | undefined} catwalkDeckY
 * @param {import("../physics/Collision.js").ColliderBox[]} [deckColliders]
 * @param {import("../physics/Collision.js").ColliderBox[]} [stairColliders]
 * @returns {RainOccluder[]}
 */
export function buildRainOccluderSlabs(
  groundSurfaces,
  catwalkDeckY,
  deckColliders = [],
  stairColliders = []
) {
  const minDeckY = catwalkDeckY != null ? catwalkDeckY - 0.25 : 3.5;
  /** @type {RainOccluder[]} */
  const occluders = [];
  const seen = new Set();
  for (const surf of groundSurfaces ?? []) {
    if (surf.stairSideWalk && surf.y != null && surf.minX != null) {
      pushOccluder(occluders, seen, {
        minX: surf.minX,
        maxX: surf.maxX,
        minZ: surf.minZ,
        maxZ: surf.maxZ,
        y: surf.y,
      });
      continue;
    }
    if (!surf.arenaCatwalkDeck && !surf.roomCatwalkDeck) continue;
    if (surf.y == null || surf.y < minDeckY) continue;
    if (surf.minX == null || surf.maxX == null) continue;
    pushOccluder(occluders, seen, {
      minX: surf.minX,
      maxX: surf.maxX,
      minZ: surf.minZ,
      maxZ: surf.maxZ,
      y: surf.y,
    });
  }
  for (const box of deckColliders) {
    if (box.kind !== "deck" || box.topY == null || box.topY < minDeckY) continue;
    pushOccluder(occluders, seen, {
      minX: box.x - box.halfX,
      maxX: box.x + box.halfX,
      minZ: box.z - box.halfZ,
      maxZ: box.z + box.halfZ,
      y: box.topY,
    });
  }
  for (const box of stairColliders) {
    if (!STAIR_RAIN_OCCLUDER_KINDS.has(box.kind ?? "") || box.topY == null) continue;
    pushOccluder(occluders, seen, {
      x: box.x,
      z: box.z,
      halfX: box.halfX,
      halfZ: box.halfZ,
      rotationY: box.rotationY ?? 0,
      y: box.topY,
    });
  }
  return occluders;
}

/**
 * Snow needs every walkable horizontal (arena floor, bridges, catwalks, stairs)
 * — not just elevated decks used to block rain through the L-catwalk.
 *
 * @param {Parameters<typeof buildRainOccluderSlabs>[0]} groundSurfaces
 * @param {Parameters<typeof buildRainOccluderSlabs>[1]} catwalkDeckY
 * @param {Parameters<typeof buildRainOccluderSlabs>[2]} [deckColliders]
 * @param {Parameters<typeof buildRainOccluderSlabs>[3]} [stairColliders]
 * @returns {RainOccluder[]}
 */
export function buildSnowOccluderSlabs(
  groundSurfaces,
  catwalkDeckY,
  deckColliders = [],
  stairColliders = []
) {
  const occluders = buildRainOccluderSlabs(
    groundSurfaces,
    catwalkDeckY,
    deckColliders,
    stairColliders
  );
  const seen = new Set(occluders.map((occ) => occluderKey(occ)));
  for (const surf of groundSurfaces ?? []) {
    if (surf.roomInteriorFloor || surf.y == null) continue;
    if (
      surf.minX == null ||
      surf.maxX == null ||
      surf.minZ == null ||
      surf.maxZ == null
    ) {
      continue;
    }
    if (surf.maxX - surf.minX < 0.05 || surf.maxZ - surf.minZ < 0.05) continue;
    pushOccluder(occluders, seen, {
      minX: surf.minX,
      maxX: surf.maxX,
      minZ: surf.minZ,
      maxZ: surf.maxZ,
      y: surf.y,
    });
  }
  return occluders;
}

/**
 * Highest walkable surface the flake has reached (world Y).
 *
 * @param {number} wx
 * @param {number} wz
 * @param {number} flakeBottom
 * @param {RainOccluder[]} occluders
 * @param {number} floorY
 * @param {number} [tolerance]
 * @returns {number | null}
 */
export function findLandingSurfaceY(
  wx,
  wz,
  flakeBottom,
  occluders,
  floorY,
  tolerance = 0.1
) {
  let landing = null;
  for (const occ of occluders) {
    if (!inOccluderFootprint(wx, wz, occ)) continue;
    if (flakeBottom <= occ.y + tolerance && (landing === null || occ.y > landing)) {
      landing = occ.y;
    }
  }
  if (landing !== null) return landing;
  if (flakeBottom <= floorY + tolerance) return floorY;
  return null;
}

/** @deprecated Use {@link buildRainOccluderSlabs} */
export function buildCatwalkRainSlabs(
  groundSurfaces,
  catwalkDeckY,
  deckColliders = [],
  stairColliders = []
) {
  return buildRainOccluderSlabs(
    groundSurfaces,
    catwalkDeckY,
    deckColliders,
    stairColliders
  );
}

/**
 * @param {THREE.Scene} scene
 */
export function createRainSystem(scene) {
  if (!_streakGeo) {
    _streakGeo = new THREE.PlaneGeometry(STREAK_WIDTH, STREAK_HEIGHT, 1, 1);
    _streakGeo.translate(0, -STREAK_HEIGHT * 0.5, 0);
  }
  if (!_streakMat) {
    _streakMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.72, 0.86, 1),
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      depthTest: false,
      fog: true,
      side: THREE.DoubleSide,
    });
  }
  const mesh = new THREE.InstancedMesh(_streakGeo, _streakMat, PARTICLE_COUNT);
  mesh.name = "rain_streaks";
  mesh.frustumCulled = false;
  mesh.renderOrder = WEATHER_RENDER_ORDER;
  setWeatherLayer(mesh);

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * BOX_HALF_W;
    positions[i * 3 + 1] = Math.random() * BOX_HALF_H * 2 - BOX_HALF_H;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * BOX_HALF_D;
  }

  const root = new THREE.Group();
  root.name = "rain_root";
  root.visible = false;
  root.add(mesh);
  scene.add(root);

  return {
    root,
    mesh,
    positions,
    halfW: BOX_HALF_W,
    halfH: BOX_HALF_H,
    halfD: BOX_HALF_D,
    vistaMode: false,
  };
}

/**
 * @param {ReturnType<typeof createRainSystem>} rain
 * @param {THREE.Camera} camera
 * @param {{
 *   playerX: number,
 *   attachWall: "north" | "south",
 *   arenaHalf: number,
 *   wallThickness?: number,
 * }} ctx
 */
function positionRainForIndoorVista(rain, camera, ctx) {
  const wallThickness = ctx.wallThickness ?? 0.5;
  const arenaInnerZ = getArenaDoorInnerZ(
    ctx.attachWall,
    ctx.arenaHalf,
    wallThickness
  );
  const push =
    ctx.attachWall === "north"
      ? INDOOR_VISTA_ARENA_PUSH
      : -INDOOR_VISTA_ARENA_PUSH;
  rain.root.position.set(
    ctx.playerX,
    camera.position.y,
    arenaInnerZ + push
  );
}

/**
 * @param {ReturnType<typeof createRainSystem>} rain
 * @param {number} rootY
 * @param {number} i
 * @param {RainOccluder[]} occluders
 * @param {number} floorYWorld
 */
function respawnParticle(rain, rootY, i, occluders, floorYWorld) {
  const { positions, halfW, halfH, halfD } = rain;
  const x = (Math.random() * 2 - 1) * halfW;
  const z = (Math.random() * 2 - 1) * halfD;
  const wx = rain.root.position.x + x;
  const wz = rain.root.position.z + z;
  let worldTopY = rootY + halfH - Math.random() * 4;
  const deckY = blockingSurfaceTopY(
    wx,
    wz,
    worldTopY - STREAK_HEIGHT,
    occluders
  );
  if (deckY !== null) {
    worldTopY = Math.max(
      rootY + halfH * 0.35,
      deckY + STREAK_HEIGHT + 1.5 + Math.random() * 8
    );
  } else if (worldTopY - STREAK_HEIGHT < floorYWorld + 0.05) {
    worldTopY = rootY + halfH - Math.random() * 4;
  }
  positions[i * 3] = x;
  positions[i * 3 + 1] = worldTopY - rootY;
  positions[i * 3 + 2] = z;
}

/**
 * @param {ReturnType<typeof createRainSystem> | null} rain
 * @param {THREE.Camera} camera
 * @param {number} dt
 * @param {{
 *   active?: boolean,
 *   enclosed?: boolean,
 *   playerX?: number,
 *   attachWall?: "north" | "south",
 *   arenaHalf?: number,
 *   wallThickness?: number,
 *   occluders?: RainOccluder[],
 *   catwalkSlabs?: RainOccluder[],
 *   intensity?: number,
 *   floorY?: number,
 *   fade?: number,
 * }} [opts]
 */
export function updateRain(rain, camera, dt, opts = {}) {
  if (!rain) return;
  const fade = Math.min(1, Math.max(0, opts.fade ?? 1));
  if (fade <= 0.008) {
    rain.root.visible = false;
    return;
  }
  const baseIntensity = opts.intensity ?? DEFAULT_RAIN_INTENSITY;
  const intensity = baseIntensity * fade;
  const visibleCount = Math.min(
    PARTICLE_COUNT,
    Math.max(1, Math.round(PARTICLE_BASE * intensity))
  );
  rain.root.visible = visibleCount > 0;
  if (visibleCount <= 0) return;

  const occluders = opts.occluders ?? opts.catwalkSlabs ?? [];
  const floorYWorld = opts.floorY ?? 0;
  const enclosed = opts.enclosed === true;
  const fallMul = (0.4 + baseIntensity * 0.52) * Math.max(0.12, fade);
  const outdoorOpacity =
    Math.min(0.92, 0.06 + baseIntensity * 0.17) * Math.max(0.08, fade);
  const vistaOpacity =
    Math.min(0.85, 0.05 + baseIntensity * 0.14) * Math.max(0.08, fade);

  if (enclosed) {
    positionRainForIndoorVista(rain, camera, {
      playerX: opts.playerX ?? camera.position.x,
      attachWall: opts.attachWall ?? "north",
      arenaHalf: opts.arenaHalf ?? 16,
      wallThickness: opts.wallThickness,
    });
    if (_streakMat) _streakMat.opacity = vistaOpacity;
    rain.vistaMode = true;
  } else {
    rain.root.position.copy(camera.position);
    if (_streakMat) _streakMat.opacity = outdoorOpacity;
    rain.vistaMode = false;
  }

  const rootY = rain.root.position.y;
  const { positions, halfH, halfW, halfD, mesh } = rain;
  const fall = FALL_SPEED * fallMul * dt;
  const windX = WIND_X * fallMul * dt;
  const windZ = WIND_Z * fallMul * dt;
  const localCeil = halfH;

  mesh.count = visibleCount;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (i >= visibleCount) {
      _matrix.compose(_position.set(0, -9999, 0), _quaternion, _hideScale);
      mesh.setMatrixAt(i, _matrix);
      continue;
    }

    let x = positions[i * 3] + windX;
    let y = positions[i * 3 + 1] - fall;
    let z = positions[i * 3 + 2] + windZ;

    if (x > halfW) x -= halfW * 2;
    else if (x < -halfW) x += halfW * 2;
    if (z > halfD) z -= halfD * 2;
    else if (z < -halfD) z += halfD * 2;

    const wx = rain.root.position.x + x;
    const wz = rain.root.position.z + z;
    let wy = rootY + y;
    let streakBottomY = wy - STREAK_HEIGHT;

    const deckY = blockingSurfaceTopY(wx, wz, streakBottomY, occluders);
    const hitFloor =
      deckY === null && streakBottomY <= floorYWorld + 0.02;

    if (deckY !== null) {
      respawnParticle(rain, rootY, i, occluders, floorYWorld);
      x = positions[i * 3];
      y = positions[i * 3 + 1];
      z = positions[i * 3 + 2];
      wy = rootY + y;
      streakBottomY = wy - STREAK_HEIGHT;
    } else if (hitFloor || y < -halfH - 2) {
      respawnParticle(rain, rootY, i, occluders, floorYWorld);
      x = positions[i * 3];
      y = positions[i * 3 + 1];
      z = positions[i * 3 + 2];
      wy = rootY + y;
      streakBottomY = wy - STREAK_HEIGHT;
    } else if (y < -halfH) {
      y = localCeil - Math.random() * 4;
      wy = rootY + y;
      streakBottomY = wy - STREAK_HEIGHT;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const hidden = blockingSurfaceTopY(wx, wz, streakBottomY, occluders) !== null;
    // Instance transforms are local to rain.root (which follows the camera).
    _position.set(x, hidden ? -9999 : y, z);
    _euler.set(
      0,
      Math.atan2(camera.position.x - wx, camera.position.z - wz),
      WIND_TILT_Z
    );
    _quaternion.setFromEuler(_euler);
    _matrix.compose(_position, _quaternion, _scale);
    mesh.setMatrixAt(i, _matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
}

/** @param {ReturnType<typeof createRainSystem> | null} rain */
export function disposeRain(rain) {
  if (!rain) return;
  rain.root.removeFromParent();
}
