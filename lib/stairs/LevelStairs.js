import * as THREE from "three";
import { WALL_STANDOFF } from "../level/LevelConstants.js";
import { pushCollider } from "../physics/Collision.js";
import { getPillarGeometry } from "../level/PillarGeometry.js";
import { applyContinuousBoxWorldUVs, applyMeshTopWorldUVs } from "../level/WallBoxUV.js";
import { TEXTURE_TILE_SIZES } from "../level/LevelTextures.js";
import { addShadowOccluderSlopedRamp } from "../lighting/ShadowOccluders.js";
import { createStairRampConfig } from "./StairRamp.js";

const TREAD_THICKNESS = 0.16;
/** Exported for collision — tread underside in world space. */
export const STAIR_TREAD_THICKNESS = TREAD_THICKNESS;
/** Solid backing ramp — hides tread riser gaps; not the walk surface. */
const STAIR_RAMP_SOLID_THICKNESS = 0.28;
/** Shadow-only slope behind the tread line (plain depth in the sun shadow pass). */
const STAIR_SHADOW_RAMP_THICKNESS = 0.12;

/** Fixed flight dimensions (not tunable in UI). */
export const STAIRS_WIDTH = 3.5;
export const STAIRS_STEP_COUNT = 18;
/** ~+0.2 m total flight vs 0.23 — reads ~20px taller at gameplay distance. */
export const STAIRS_STEP_RISE = 0.241;
export const STAIRS_STEP_RUN = 0.3;
/** Backing ramp sits behind tread nosings (+Z toward catwalk). */
const STAIR_BACK_RAMP_Z_SHIFT = STAIRS_STEP_RUN * 0.48;
/** Drop backing below tread tops so steps remain the visible walk surface. */
const STAIR_BACK_RAMP_Y_DROP = TREAD_THICKNESS * 0.85;
export const STAIRS_TOTAL_RISE = STAIRS_STEP_COUNT * STAIRS_STEP_RISE;
export const STAIRS_TOTAL_RUN = STAIRS_STEP_COUNT * STAIRS_STEP_RUN;
/** Extra rise above the last tread so the flight meets the catwalk deck. */
export const STAIR_EXTRA_RISE = 0.012;
export const STAIRS_EFFECTIVE_TOTAL_RISE = STAIRS_TOTAL_RISE + STAIR_EXTRA_RISE;

const _corner = new THREE.Vector3();

/** Cross-section width (X) — half of arena pillarSize. */
export const STAIR_STRINGER_WIDTH = 0.6;
/** Half-thickness of side-wall face colliders (inner / outer panels). */
export const STAIR_SIDE_PANEL_HALF_THICK = 0.05;
/** @deprecated Use {@link STAIR_STRINGER_WIDTH}. */
export const STAIR_STRINGER_THICKNESS = STAIR_STRINGER_WIDTH;
/** Extra run beyond first/last tread so stringers read as one long beam. */
export const STAIR_STRINGER_DEPTH_OVERHANG = STAIRS_STEP_RUN * 0.75;
/** Deck lip past the ramp flat landing so the catwalk mesh meets the stair top. */
export const STAIR_TOP_DECK_BRIDGE = 0.6;

/**
 * @typedef {Object} StairFlightRuntime
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} rotationY
 * @property {number} walkHalfWidth
 * @property {THREE.Matrix4} inverseMatrix
 * @property {THREE.Matrix4} matrixWorld
 * @property {ReturnType<typeof createStairRampConfig>} ramp
 */

/**
 * @typedef {Object} StairPlacement
 * @property {{ x: number, y: number, z: number }} position Bottom-center of lowest tread (world)
 * @property {number} rotationY Facing in degrees (0° = flight climbs toward +Z)
 */

/**
 * Walkable footprint of the arena ceiling deck (east side when clerestory is open).
 * @param {import("../level/loadArena.js").ArenaConfig} arena
 * @param {number} ceilingTopY
 * @param {number} westOpenRatio
 */
export function getArenaDeckWalkSurface(arena, ceilingTopY, westOpenRatio) {
  const wallThickness = arena.wallThickness ?? 0.5;
  const wallStandoff = arena.wallStandoff ?? WALL_STANDOFF;
  const CEILING_PAD = 0.25;
  const fullWidth = arena.size + 2 * wallThickness + 2 * CEILING_PAD;
  const fullDepth = fullWidth;
  const open = THREE.MathUtils.clamp(westOpenRatio, 0, 0.95);
  const edgeStandoff = {
    west: open > 0 ? 0 : wallStandoff,
    east: wallStandoff,
    north: wallStandoff,
    south: wallStandoff,
  };

  if (open <= 0) {
    const halfW = fullWidth / 2;
    const halfD = fullDepth / 2;
    return {
      minX: -halfW,
      maxX: halfW,
      minZ: -halfD,
      maxZ: halfD,
      y: ceilingTopY,
      edgeStandoff,
    };
  }

  const coveredWidth = fullWidth * (1 - open);
  const centerX = (open * fullWidth) / 2;
  const halfW = coveredWidth / 2;
  const halfD = fullDepth / 2;
  return {
    minX: centerX - halfW,
    maxX: centerX + halfW,
    minZ: -halfD,
    maxZ: halfD,
    y: ceilingTopY,
    edgeStandoff,
  };
}

function localCenterToWorldXZ(flight, localX, localZ) {
  _corner.set(localX, 0, localZ);
  _corner.applyMatrix4(flight.matrixWorld);
  return { x: _corner.x, z: _corner.z };
}

/**
 * @param {THREE.Group} flight
 * @param {number} localX
 * @param {number} localZ
 * @param {number} halfW
 * @param {number} halfRun
 */
function localFootprintWorldBounds(flight, localX, localZ, halfW, halfRun) {
  const offsets = [
    [-halfW, -halfRun],
    [halfW, -halfRun],
    [-halfW, halfRun],
    [halfW, halfRun],
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const [dx, dz] of offsets) {
    _corner.set(localX + dx, 0, localZ + dz);
    _corner.applyMatrix4(flight.matrixWorld);
    minX = Math.min(minX, _corner.x);
    maxX = Math.max(maxX, _corner.x);
    minZ = Math.min(minZ, _corner.z);
    maxZ = Math.max(maxZ, _corner.z);
  }

  return { minX, maxX, minZ, maxZ };
}

/**
 * @param {THREE.Group} flight
 * @param {number} localX
 * @param {number} localY
 * @param {number} localZ
 */
function localToWorldY(flight, localX, localY, localZ) {
  _corner.set(localX, localY, localZ);
  _corner.applyMatrix4(flight.matrixWorld);
  return _corner.y;
}

/**
 * @param {{ shape?: "box" | "rounded", cornerRadius?: number, cornerSegments?: number }} [options]
 */
function createStairStringerGeometry(options = {}) {
  const stringerHeight = STAIRS_EFFECTIVE_TOTAL_RISE + 0.05;
  const stringerDepth = STAIRS_TOTAL_RUN + STAIR_STRINGER_DEPTH_OVERHANG * 2;
  const shape = options.shape === "box" ? "box" : "rounded";
  const cornerRadius =
    options.cornerRadius ?? STAIR_STRINGER_WIDTH * 0.1;
  const cornerSegments = options.cornerSegments ?? 4;
  const tileSize =
    TEXTURE_TILE_SIZES.decal_hazard_stripes_worn ?? 2;

  const geo = getPillarGeometry(
    shape,
    STAIR_STRINGER_WIDTH,
    stringerHeight,
    stringerDepth,
    { cornerRadius, cornerSegments }
  );
  applyContinuousBoxWorldUVs(geo, stringerHeight, tileSize);
  return geo;
}

/**
 * Axis-aligned hole for the arena catwalk / ceiling deck above this flight.
 * @param {StairPlacement | null | undefined} placement
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number } | null}
 */
export function getStairCeilingCutout(placement) {
  if (!placement?.position) return null;

  const flight = new THREE.Group();
  flight.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  flight.rotation.y = THREE.MathUtils.degToRad(placement.rotationY);
  flight.updateMatrixWorld(true);

  // Match the flight's physical top-down footprint — treads span STAIRS_WIDTH
  // and stringers add STAIR_STRINGER_WIDTH to each side, with front/back
  // overhang at the stringer ends. Collider walk-through at the lip is handled
  // in Collision.js (deck skip near catwalk height); do not enlarge this hole
  // or the deck mesh pulls back and exposes the landing/stringers.
  const halfW = STAIRS_WIDTH / 2 + STAIR_STRINGER_WIDTH;
  const rearZ = -STAIR_STRINGER_DEPTH_OVERHANG;
  const frontZ = STAIRS_TOTAL_RUN + STAIR_STRINGER_DEPTH_OVERHANG;

  return localFootprintWorldBounds(flight, 0, (rearZ + frontZ) / 2, halfW, (frontZ - rearZ) / 2);
}

/**
 * Small deck pad at the stair top — fills the gap between the ramp landing
 * and the east catwalk column where the ceiling cutout removes the mesh.
 * @param {StairPlacement | null | undefined} placement
 * @param {number} [bridgeDepth=STAIR_TOP_DECK_BRIDGE]
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number } | null}
 */
export function getStairTopDeckBridgeFootprint(
  placement,
  bridgeDepth = STAIR_TOP_DECK_BRIDGE
) {
  if (!placement?.position || bridgeDepth <= 0) return null;

  const flight = new THREE.Group();
  flight.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  flight.rotation.y = THREE.MathUtils.degToRad(placement.rotationY);
  flight.updateMatrixWorld(true);

  const halfW = STAIRS_WIDTH / 2 + STAIR_STRINGER_WIDTH;
  const landingPad = 0.45;
  const topLocalZ = STAIRS_TOTAL_RUN;
  const landingFrontLocalZ = topLocalZ + landingPad * 1.5;
  const bridgeRearZ = topLocalZ - 0.12;
  const bridgeFrontZ = landingFrontLocalZ + bridgeDepth;

  return localFootprintWorldBounds(
    flight,
    0,
    (bridgeRearZ + bridgeFrontZ) / 2,
    halfW,
    (bridgeFrontZ - bridgeRearZ) / 2
  );
}

/**
 * Camera poses inside the stair ceiling cutout (hole in the catwalk deck). The
 * first-visit hitch under/near the hole tracks stair placement — not the ramp.
 *
 * @param {StairPlacement} placement
 * @param {number} catwalkDeckY
 * @param {number} [standEyeHeight=1.62]
 * @returns {{ x: number, z: number, eyeY: number, lookX: number, lookY: number, lookZ: number, frames: number }[]}
 */
export function getStairCeilingCutoutWarmupSamples(
  placement,
  catwalkDeckY,
  standEyeHeight = 1.62
) {
  const cutout = getStairCeilingCutout(placement);
  if (!cutout || catwalkDeckY == null) return [];

  const flight = new THREE.Group();
  flight.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  flight.rotation.y = THREE.MathUtils.degToRad(placement.rotationY);
  flight.updateMatrixWorld(true);

  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(flight.quaternion);
  forward.y = 0;
  if (forward.lengthSq() > 1e-8) forward.normalize();

  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(flight.quaternion);
  right.y = 0;
  if (right.lengthSq() > 1e-8) right.normalize();

  const cx = (cutout.minX + cutout.maxX) * 0.5;
  const cz = (cutout.minZ + cutout.maxZ) * 0.5;
  const spanX = cutout.maxX - cutout.minX;
  const spanZ = cutout.maxZ - cutout.minZ;
  const cutoutX = (frac) => cutout.minX + spanX * frac;
  const cutoutZ = (frac) => cutout.minZ + spanZ * frac;

  /** @type {{ x: number, z: number, eyeY: number, lookX: number, lookY: number, lookZ: number, frames: number }[]} */
  const samples = [];

  const push = (x, z, footY, lookX, lookY, lookZ, frames) => {
    samples.push({
      x,
      z,
      eyeY: footY + standEyeHeight,
      lookX,
      lookY,
      lookZ,
      frames,
    });
  };

  /** Cutout-relative XZ — moves with stair tuning. */
  const footprint = [
    [0.5, 0.52],
    [0.54, 0.48],
    [0.72, 0.42],
    [0.38, 0.68],
    [0.5, 0.12],
    [0.5, 0.88],
  ];

  for (const [xf, zf] of footprint) {
    const x = cutoutX(xf);
    const z = cutoutZ(zf);

    // Arena floor under the hole — deck underside + stringers enter view.
    push(x, z, 0, x, catwalkDeckY + 0.35, z, 4);
    push(
      x,
      z,
      1.2,
      x + forward.x * 2,
      catwalkDeckY + 0.25,
      z + forward.z * 2,
      6
    );
    push(
      x,
      z,
      1.2,
      x - right.x * 2.5,
      1.2 + standEyeHeight,
      z - right.z * 2.5,
      5
    );

    const catFoot = catwalkDeckY;
    push(
      x,
      z,
      catFoot,
      x - right.x * 2.5,
      catFoot + standEyeHeight,
      z - right.z * 2.5,
      8
    );
    push(
      x,
      z,
      catFoot,
      x + right.x * 2.5,
      catFoot + standEyeHeight,
      z + right.z * 2.5,
      6
    );
    push(
      x,
      z,
      catFoot,
      x + forward.x * 2.5,
      catFoot + standEyeHeight,
      z + forward.z * 2.5,
      5
    );
  }

  push(
    cx,
    cz,
    catwalkDeckY,
    cx - right.x * 2.5,
    catwalkDeckY + standEyeHeight,
    cz - right.z * 2.5,
    10
  );
  push(cx, cz, 1.2, cx, catwalkDeckY + 0.3, cz, 8);

  return samples;
}

/**
 * Camera poses along the stair ramp and inside the ceiling cutout. Primes
 * shaders/shadows for the first visit to the hole under the catwalk deck.
 *
 * @param {StairPlacement} placement
 * @param {number} catwalkDeckY
 * @param {number} [standEyeHeight=1.62]
 * @returns {{ x: number, z: number, eyeY: number, lookX: number, lookY?: number, lookZ: number, frames: number }[]}
 */
export function getStairCatwalkExitWarmupSamples(
  placement,
  catwalkDeckY,
  standEyeHeight = 1.62
) {
  if (!placement?.position || catwalkDeckY == null) return [];

  const flight = new THREE.Group();
  flight.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  flight.rotation.y = THREE.MathUtils.degToRad(placement.rotationY);
  flight.updateMatrixWorld(true);

  const landingPad = 0.45;
  const topLocalZ = STAIRS_TOTAL_RUN;
  const landingFrontLocalZ = topLocalZ + landingPad * 1.5;
  const bridge = getStairTopDeckBridgeFootprint(placement);

  const toWorldXZ = (localX, localZ) =>
    localCenterToWorldXZ(flight, localX, localZ);

  const exitForward = new THREE.Vector3(0, 0, 1);
  exitForward.applyQuaternion(flight.quaternion);
  exitForward.y = 0;
  if (exitForward.lengthSq() > 1e-8) exitForward.normalize();

  /** @type {{ x: number, z: number, eyeY: number, lookX: number, lookZ: number, frames: number }[]} */
  const samples = [];

  const pushRampSample = (localX, localZ, frames) => {
    const t = THREE.MathUtils.clamp(localZ / STAIRS_TOTAL_RUN, 0, 1);
    const localY = t * STAIRS_EFFECTIVE_TOTAL_RISE;
    const footY = localToWorldY(flight, localX, localY, localZ);
    const xz = toWorldXZ(localX, localZ);
    samples.push({
      x: xz.x,
      z: xz.z,
      eyeY: footY + standEyeHeight,
      lookX: xz.x + exitForward.x * 2.5,
      lookZ: xz.z + exitForward.z * 2.5,
      frames,
    });
  };

  const pushDeckSample = (x, z, frames) => {
    samples.push({
      x,
      z,
      eyeY: catwalkDeckY + standEyeHeight,
      lookX: x + exitForward.x * 2.5,
      lookZ: z + exitForward.z * 2.5,
      frames,
    });
  };

  // Mid-ramp — first time the east catwalk underside / ceiling enters view (~footY 2.2).
  const midRampLocalZ =
    (2.21 / STAIRS_EFFECTIVE_TOTAL_RISE) * STAIRS_TOTAL_RUN;
  const rampSamples = [
    { localX: 0, localZ: STAIRS_TOTAL_RUN * 0.18, frames: 3 },
    { localX: 0, localZ: STAIRS_TOTAL_RUN * 0.35, frames: 4 },
    { localX: 0.466, localZ: midRampLocalZ, frames: 8 },
    { localX: 0, localZ: STAIRS_TOTAL_RUN * 0.58, frames: 4 },
    { localX: 0, localZ: STAIRS_TOTAL_RUN * 0.78, frames: 4 },
    { localX: 0, localZ: topLocalZ - 1.05, frames: 3 },
    { localX: 0, localZ: topLocalZ - 0.35, frames: 4 },
    { localX: 0, localZ: topLocalZ + 0.2, frames: 5 },
    { localX: 0, localZ: landingFrontLocalZ + 0.15, frames: 5 },
    { localX: 0, localZ: landingFrontLocalZ + STAIR_TOP_DECK_BRIDGE * 0.55, frames: 3 },
  ];
  for (const pt of rampSamples) {
    pushRampSample(pt.localX, pt.localZ, pt.frames);
  }

  const lookBack = exitForward.clone().negate();

  const pushDeckLookSample = (x, z, lookDir, frames) => {
    samples.push({
      x,
      z,
      eyeY: catwalkDeckY + standEyeHeight,
      lookX: x + lookDir.x * 2.5,
      lookY: catwalkDeckY + standEyeHeight,
      lookZ: z + lookDir.z * 2.5,
      frames,
    });
  };

  if (bridge) {
    pushDeckSample(
      (bridge.minX + bridge.maxX) / 2,
      (bridge.minZ + bridge.maxZ) / 2,
      3
    );
    pushDeckSample(bridge.maxX - 0.35, (bridge.minZ + bridge.maxZ) / 2, 3);

    // Bridge lip → east arm: climb-exit hitch (yaw ~270°, only when ascending).
    const spanZ = bridge.maxZ - bridge.minZ;
    const exitStep = Math.max(Math.abs(exitForward.x), Math.abs(exitForward.z), 0.001);
    for (const zFrac of [0.42, 0.48, 0.55, 0.62]) {
      const z = bridge.minZ + spanZ * zFrac;
      for (const past of [0.12, 0.35, 0.55, 0.85]) {
        const x = bridge.maxX + past * exitStep * Math.sign(exitForward.x || 1);
        const wz = z + past * exitForward.z;
        pushDeckLookSample(x, wz, lookBack, past >= 0.35 ? 8 : 4);
      }
    }
  }

  return [
    ...samples,
    ...getStairCeilingCutoutWarmupSamples(placement, catwalkDeckY, standEyeHeight),
  ];
}

/**
 * Interpolated camera path from ramp landing across the bridge lip onto the east
 * catwalk arm — matches the post-descent stair climb that hitches in gameplay.
 *
 * @param {StairPlacement} placement
 * @param {number} catwalkDeckY
 * @param {number} [standEyeHeight=1.62]
 * @returns {{ from: { x: number, z: number, eyeY: number, lookX: number, lookY: number, lookZ: number }, to: { x: number, z: number, eyeY: number, lookX: number, lookY: number, lookZ: number }, frames: number }[]}
 */
export function getStairClimbExitPathSegments(
  placement,
  catwalkDeckY,
  standEyeHeight = 1.62
) {
  if (!placement?.position || catwalkDeckY == null) return [];

  const bridge = getStairTopDeckBridgeFootprint(placement);
  if (!bridge) return [];

  const flight = new THREE.Group();
  flight.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  flight.rotation.y = THREE.MathUtils.degToRad(placement.rotationY);
  flight.updateMatrixWorld(true);

  const exitForward = new THREE.Vector3(0, 0, 1).applyQuaternion(flight.quaternion);
  exitForward.y = 0;
  if (exitForward.lengthSq() > 1e-8) exitForward.normalize();
  const lookBack = exitForward.clone().negate();

  const landingPad = 0.45;
  const topLocalZ = STAIRS_TOTAL_RUN;
  const landingFrontLocalZ = topLocalZ + landingPad * 1.5;
  const rampEndLocalZ = landingFrontLocalZ + STAIR_TOP_DECK_BRIDGE * 0.35;
  const rampT = THREE.MathUtils.clamp(rampEndLocalZ / STAIRS_TOTAL_RUN, 0, 1);
  const rampFootY = rampT * STAIRS_EFFECTIVE_TOTAL_RISE;
  const rampWorldY = localToWorldY(flight, 0, rampFootY, rampEndLocalZ);
  const rampXz = localCenterToWorldXZ(flight, 0, rampEndLocalZ);

  const exitPast = 0.42;
  const exitStep = Math.max(Math.abs(exitForward.x), Math.abs(exitForward.z), 0.001);
  const zGlitch = bridge.minZ + (bridge.maxZ - bridge.minZ) * 0.48;
  const exitX = bridge.maxX + exitPast * exitStep * Math.sign(exitForward.x || 1);
  const exitZ = zGlitch + exitPast * exitForward.z;
  const catEye = catwalkDeckY + standEyeHeight;

  const pose = (x, z, eyeY) => ({
    x,
    z,
    eyeY,
    lookX: x + lookBack.x * 2.5,
    lookY: eyeY,
    lookZ: z + lookBack.z * 2.5,
  });

  return [
    {
      from: pose(rampXz.x, rampXz.z, rampWorldY + standEyeHeight),
      to: pose(exitX, exitZ, catEye),
      frames: 16,
    },
    {
      from: pose(exitX, exitZ, catEye),
      to: pose(
        exitX + exitForward.x * 1.2,
        exitZ + exitForward.z * 1.2,
        catEye
      ),
      frames: 10,
    },
  ];
}

/**
 * Full floor → ramp → bridge-lip path for one-time GPU prepay (matches climb repro).
 *
 * @param {StairPlacement} placement
 * @param {number} catwalkDeckY
 * @param {number} [standEyeHeight=1.62]
 * @returns {{ from: { x: number, z: number, eyeY: number, lookX: number, lookY: number, lookZ: number }, to: { x: number, z: number, eyeY: number, lookX: number, lookY: number, lookZ: number }, frames: number }[]}
 */
export function getStairFullClimbPathSegments(
  placement,
  catwalkDeckY,
  standEyeHeight = 1.62
) {
  if (!placement?.position || catwalkDeckY == null) return [];

  const flight = new THREE.Group();
  flight.position.set(
    placement.position.x,
    placement.position.y,
    placement.position.z
  );
  flight.rotation.y = THREE.MathUtils.degToRad(placement.rotationY);
  flight.updateMatrixWorld(true);

  const exitForward = new THREE.Vector3(0, 0, 1).applyQuaternion(flight.quaternion);
  exitForward.y = 0;
  if (exitForward.lengthSq() > 1e-8) exitForward.normalize();
  const lookBack = exitForward.clone().negate();

  const pose = (x, z, eyeY) => ({
    x,
    z,
    eyeY,
    lookX: x + lookBack.x * 2.5,
    lookY: eyeY,
    lookZ: z + lookBack.z * 2.5,
  });

  /** @type {ReturnType<typeof getStairClimbExitPathSegments>} */
  const segments = [];

  const rampFractions = [0.08, 0.18, 0.28, 0.38, 0.48, 0.58, 0.68, 0.78, 0.88, 0.96];
  let prev = null;
  for (const frac of rampFractions) {
    const localZ = frac * STAIRS_TOTAL_RUN;
    const localY = frac * STAIRS_EFFECTIVE_TOTAL_RISE;
    const footY = localToWorldY(flight, 0, localY, localZ);
    const xz = localCenterToWorldXZ(flight, 0, localZ);
    const next = pose(xz.x, xz.z, footY + standEyeHeight);
    if (prev) {
      segments.push({ from: prev, to: next, frames: 3 });
    }
    prev = next;
  }

  const exitSegments = getStairClimbExitPathSegments(
    placement,
    catwalkDeckY,
    standEyeHeight
  );
  if (prev && exitSegments[0]) {
    segments.push({ from: prev, to: exitSegments[0].from, frames: 4 });
  }
  for (const seg of exitSegments) {
    segments.push({ ...seg, frames: Math.max(seg.frames, 24) });
  }

  const hitchPose = exitSegments[0]?.to ?? exitSegments[exitSegments.length - 1]?.to;
  if (hitchPose) {
    segments.push({ from: hitchPose, to: hitchPose, frames: 36 });
  }

  return segments;
}

/**
 * @param {THREE.Group} group
 * @param {StairPlacement} placement
 * @param {THREE.Material} treadMat
 * @param {THREE.Material} [stringerMat]
 * @param {{ shape?: "box" | "rounded", cornerRadius?: number, cornerSegments?: number }} [stringerOptions]
 */
export function buildStairFlight(
  group,
  placement,
  treadMat,
  stringerMat = treadMat,
  stringerOptions = {}
) {
  const { catwalkDeckY = null, treadTileSize = null, catwalkEdgeStandoff = null, ...pureStringerOptions } =
    stringerOptions;
  const { position, rotationY } = placement;
  const yawRad = THREE.MathUtils.degToRad(rotationY);

  const flight = new THREE.Group();
  flight.name = "stair_flight";
  flight.position.set(position.x, position.y, position.z);
  flight.rotation.y = yawRad;
  group.add(flight);

  const groundSurfaces = [];
  const colliders = [];
  const stringerThick = STAIR_STRINGER_WIDTH;
  const stringerHeight = STAIRS_EFFECTIVE_TOTAL_RISE + 0.05;
  const stringerDepth = STAIRS_TOTAL_RUN + STAIR_STRINGER_DEPTH_OVERHANG * 2;
  const stringerLocalZ = STAIRS_TOTAL_RUN / 2;
  const stringerGeo = createStairStringerGeometry(pureStringerOptions);

  for (const side of [-1, 1]) {
    const localX = (STAIRS_WIDTH / 2 + stringerThick / 2) * side;
    const stringer = new THREE.Mesh(stringerGeo, stringerMat);
    stringer.position.set(localX, stringerHeight / 2, stringerLocalZ);
    stringer.castShadow = true;
    stringer.receiveShadow = true;
    flight.add(stringer);
  }

  const rampRun = STAIRS_TOTAL_RUN;
  const rampRise = STAIRS_EFFECTIVE_TOTAL_RISE;
  const rampSlopeLen = Math.hypot(rampRun, rampRise);
  const rampAngle = Math.atan2(rampRise, rampRun);

  /** @type {THREE.Mesh[]} */
  const treadMeshes = [];
  for (let i = 0; i < STAIRS_STEP_COUNT; i++) {
    const localZ = STAIRS_STEP_RUN * (i + 0.5);
    const stepTopY = STAIRS_STEP_RISE * (i + 1);

    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(
        STAIRS_WIDTH,
        TREAD_THICKNESS,
        STAIRS_STEP_RUN + 0.06
      ),
      treadMat
    );
    tread.position.set(0, stepTopY - TREAD_THICKNESS / 2, localZ);
    tread.userData.shadowCast = false;
    tread.userData.stairWalkTread = true;
    tread.receiveShadow = true;
    tread.renderOrder = 1;
    treadMeshes.push(tread);
    flight.add(tread);
  }

  const backFill = new THREE.Group();
  backFill.name = "stair_back_fill";
  backFill.position.set(0, -STAIR_BACK_RAMP_Y_DROP, STAIR_BACK_RAMP_Z_SHIFT);
  flight.add(backFill);

  const rampGeo = new THREE.BoxGeometry(
    STAIRS_WIDTH,
    STAIR_RAMP_SOLID_THICKNESS,
    rampSlopeLen
  );
  const ramp = new THREE.Mesh(rampGeo, treadMat);
  ramp.position.set(0, rampRise / 2, rampRun / 2);
  ramp.rotation.x = -rampAngle;
  ramp.userData.shadowCast = false;
  ramp.userData.stairBackFill = true;
  ramp.userData.skipBulletSurface = true;
  ramp.receiveShadow = true;
  ramp.renderOrder = 0;
  ramp.name = "stair_ramp_back";
  backFill.add(ramp);

  addShadowOccluderSlopedRamp(
    backFill,
    STAIRS_WIDTH,
    rampRun,
    rampRise,
    STAIR_SHADOW_RAMP_THICKNESS
  );

  flight.updateMatrixWorld(true);

  if (treadTileSize) {
    for (const tread of treadMeshes) {
      applyMeshTopWorldUVs(tread.geometry, tread.matrixWorld, treadTileSize);
    }
    ramp.updateMatrixWorld(true);
    applyMeshTopWorldUVs(ramp.geometry, ramp.matrixWorld, treadTileSize);
  }

  const landingPad = 0.45;
  const topLocalZ = STAIRS_TOTAL_RUN;
  const landingFrontLocalZ = topLocalZ + landingPad * 1.5;
  const defaultTopWalkY = localToWorldY(
    flight,
    0,
    STAIRS_EFFECTIVE_TOTAL_RISE,
    topLocalZ
  );
  const topWalkWorldY =
    catwalkDeckY == null ? defaultTopWalkY : Math.max(defaultTopWalkY, catwalkDeckY);
  const topWalkLocalY = topWalkWorldY - position.y;

  /** @type {StairFlightRuntime} */
  const stairFlight = {
    x: position.x,
    y: position.y,
    z: position.z,
    rotationY: yawRad,
    walkHalfWidth: STAIRS_WIDTH / 2,
    inverseMatrix: new THREE.Matrix4().copy(flight.matrixWorld).invert(),
    matrixWorld: new THREE.Matrix4().copy(flight.matrixWorld),
    ramp: createStairRampConfig(
      STAIRS_WIDTH / 2,
      topWalkLocalY,
      landingFrontLocalZ - topLocalZ
    ),
  };

  // Movement uses the logical ramp — treads are walk visuals, back fill hides riser gaps.
  groundSurfaces.push({
    stairFlight,
    stairRamp: true,
  });

  // Stair top support comes from the ramp surface above — do not add a flat
  // catwalkWalk rectangle matching the ceiling cutout. That hole has no deck
  // mesh; invisible support there traps the player (e.g. east catwalk x≈10).
  const stringerHalfDepth = stringerDepth / 2;
  const stringerBottomY = localToWorldY(flight, 0, 0, stringerLocalZ);
  const defaultStringerTopY = localToWorldY(
    flight,
    0,
    STAIRS_EFFECTIVE_TOTAL_RISE + 0.05,
    stringerLocalZ
  );
  const stringerTopY =
    catwalkDeckY == null
      ? defaultStringerTopY
      : Math.max(defaultStringerTopY, catwalkDeckY);
  const innerFaceLocalX = STAIRS_WIDTH / 2;
  const outerFaceLocalX = STAIRS_WIDTH / 2 + STAIR_STRINGER_WIDTH;
  const panelHalfThick = STAIR_SIDE_PANEL_HALF_THICK;
  const stringerHalfWidth = STAIR_STRINGER_WIDTH / 2;
  const capHalfThick = panelHalfThick;

  for (const side of [-1, 1]) {
    const innerLocalX =
      innerFaceLocalX * side + panelHalfThick * side;
    const outerLocalX =
      outerFaceLocalX * side - panelHalfThick * side;
    const innerCenter = localCenterToWorldXZ(flight, innerLocalX, stringerLocalZ);
    const outerCenter = localCenterToWorldXZ(flight, outerLocalX, stringerLocalZ);

    pushCollider(colliders, {
      x: innerCenter.x,
      z: innerCenter.z,
      halfX: panelHalfThick,
      halfZ: stringerHalfDepth,
      rotationY: yawRad,
      bottomY: stringerBottomY,
      topY: stringerTopY,
      kind: "stairSideInner",
      stringerSide: side,
      stairFlight,
    });
    pushCollider(colliders, {
      x: outerCenter.x,
      z: outerCenter.z,
      halfX: panelHalfThick,
      halfZ: stringerHalfDepth,
      rotationY: yawRad,
      bottomY: stringerBottomY,
      topY: stringerTopY,
      kind: "stairSideOuter",
      stringerSide: side,
      stairFlight,
    });

    const topCenterLocalX = (innerFaceLocalX + outerFaceLocalX) / 2 * side;
    const topCenter = localCenterToWorldXZ(flight, topCenterLocalX, stringerLocalZ);
    pushCollider(colliders, {
      x: topCenter.x,
      z: topCenter.z,
      halfX: stringerHalfWidth,
      halfZ: stringerHalfDepth,
      rotationY: yawRad,
      bottomY: stringerTopY - capHalfThick,
      topY: stringerTopY + capHalfThick,
      kind: "stairSideTop",
      stringerSide: side,
      stairFlight,
    });

    const sideWalkTopY = defaultStringerTopY;
    const topBounds = localFootprintWorldBounds(
      flight,
      topCenterLocalX,
      stringerLocalZ,
      STAIR_STRINGER_WIDTH / 2,
      stringerHalfDepth
    );
    groundSurfaces.push({
      minX: topBounds.minX,
      maxX: topBounds.maxX,
      minZ: topBounds.minZ,
      maxZ: topBounds.maxZ,
      y: sideWalkTopY,
      stairSideWalk: true,
      stringerSide: side,
    });
  }

  const treadHalfWidth = STAIRS_WIDTH / 2 + STAIR_STRINGER_WIDTH;
  const rearCurtainForwardZ = -0.02;
  const rearCurtainBackZ = -STAIR_STRINGER_DEPTH_OVERHANG * 0.95;
  const rearBarrierBackZ = -STAIR_STRINGER_DEPTH_OVERHANG - 1.15;
  const rearBarrierForwardZ = rearCurtainBackZ;
  const rearBarrierCenterZ = (rearBarrierBackZ + rearBarrierForwardZ) / 2;
  const rearBarrierHalfZ = (rearBarrierForwardZ - rearBarrierBackZ) / 2;
  const rearBarrierCenter = localCenterToWorldXZ(flight, 0, rearBarrierCenterZ);
  pushCollider(colliders, {
    x: rearBarrierCenter.x,
    z: rearBarrierCenter.z,
    halfX: treadHalfWidth,
    halfZ: rearBarrierHalfZ,
    rotationY: yawRad,
    bottomY: stringerBottomY,
    topY: stringerTopY,
    kind: "stairBack",
    sliceBackLocalZ: rearBarrierBackZ,
    sliceForwardLocalZ: rearBarrierForwardZ,
    stairFlight,
  });

  const rearCurtainCenterZ = (rearCurtainForwardZ + rearCurtainBackZ) / 2;
  const rearCurtainHalfZ = (rearCurtainForwardZ - rearCurtainBackZ) / 2;
  const rearCurtainCenter = localCenterToWorldXZ(flight, 0, rearCurtainCenterZ);
  pushCollider(colliders, {
    x: rearCurtainCenter.x,
    z: rearCurtainCenter.z,
    halfX: STAIRS_WIDTH / 2,
    halfZ: rearCurtainHalfZ,
    rotationY: yawRad,
    bottomY: stringerBottomY,
    topY: localToWorldY(flight, 0, STAIRS_STEP_RISE, rearCurtainCenterZ),
    kind: "stairRearCurtain",
    sliceBackLocalZ: rearCurtainBackZ,
    sliceForwardLocalZ: rearCurtainForwardZ,
    stairFlight,
  });

  for (let i = 0; i < STAIRS_STEP_COUNT; i++) {
    let sliceBackLocalZ = i * STAIRS_STEP_RUN;
    if (i === 0) sliceBackLocalZ = rearCurtainBackZ;
    const sliceForwardLocalZ = (i + 1) * STAIRS_STEP_RUN;
    const sliceCenterZ = (sliceBackLocalZ + sliceForwardLocalZ) / 2;
    const sliceCenter = localCenterToWorldXZ(flight, 0, sliceCenterZ);
    const sliceTopY = localToWorldY(
      flight,
      0,
      STAIRS_STEP_RISE * (i + 1),
      sliceCenterZ
    );
    pushCollider(colliders, {
      x: sliceCenter.x,
      z: sliceCenter.z,
      halfX: STAIRS_WIDTH / 2,
      halfZ: (sliceForwardLocalZ - sliceBackLocalZ) / 2,
      rotationY: yawRad,
      bottomY: stringerBottomY,
      topY: sliceTopY,
      kind: "stairBackSlice",
      sliceForwardLocalZ,
      sliceBackLocalZ,
      stairFlight,
    });
  }

  return { groundSurfaces, colliders };
}

/** Remove stair meshes from a group without disposing shared materials. */
export function clearStairGroup(group) {
  const geometries = new Set();
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.traverse((obj) => {
      if (obj.geometry && !geometries.has(obj.geometry)) {
        geometries.add(obj.geometry);
        obj.geometry.dispose();
      }
    });
  }
}
