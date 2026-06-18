import * as THREE from "three";
import { setWeatherLayer, setWorldLayer, WEATHER_RENDER_ORDER } from "@/lib/lighting/LightingLayers.js";
import { getArenaDoorInnerZ } from "@/lib/rooms/RoomPlacement.js";
import {
  buildSnowOccluderSlabs,
  findLandingSurfaceY,
  sampleSurfaceTopY,
} from "@/lib/Rain.js";
import {
  DEFAULT_SNOW_INTENSITY,
  DEFAULT_SNOW_STICK_RATE,
} from "@/lib/SnowTuning.js";

export { buildSnowOccluderSlabs };

/** Flake count at 100% intensity — scales up to 500%. */
const FALLING_BASE = 3200;
const FALLING_COUNT = FALLING_BASE * 5;
const SETTLED_MAX = 120000;
const SETTLE_CELL_SIZE = 0.055;
const SETTLE_LAYER_STEP = 0.0038;
const SETTLE_LAYER_CAP = 64;
const SETTLE_CULL_RADIUS = 46;
const BOX_HALF_W = 22;
const BOX_HALF_H = 18;
const BOX_HALF_D = 22;
const FLAKE_SIZE = 0.052;
const FALL_SPEED = 1.35;
const DRIFT_X = 0.45;
const DRIFT_Z = 0.28;
const INDOOR_VISTA_ARENA_PUSH = 5.5;

/** @type {THREE.PlaneGeometry | null} */
let _flakeGeo = null;
/** @type {THREE.Texture | null} */
let _flakeTex = null;
/** @type {THREE.MeshBasicMaterial | null} */
let _fallMat = null;
/** @type {THREE.MeshBasicMaterial | null} */
let _settledMat = null;

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _euler = new THREE.Euler();
const _hideScale = new THREE.Vector3(0, 0, 0);

function getSnowFlakeTexture() {
  if (_flakeTex) return _flakeTex;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.46);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.35, "rgba(248, 252, 255, 0.92)");
  grad.addColorStop(0.72, "rgba(230, 240, 255, 0.35)");
  grad.addColorStop(1, "rgba(220, 235, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _flakeTex = new THREE.CanvasTexture(canvas);
  _flakeTex.colorSpace = THREE.SRGBColorSpace;
  return _flakeTex;
}

function makeFallingFlakeMaterial(opacity) {
  const tex = getSnowFlakeTexture();
  return new THREE.MeshBasicMaterial({
    map: tex,
    alphaMap: tex,
    alphaTest: 0.12,
    color: new THREE.Color(0.96, 0.98, 1),
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    fog: true,
    side: THREE.DoubleSide,
  });
}

function makeSettledFlakeMaterial() {
  const tex = getSnowFlakeTexture();
  return new THREE.MeshBasicMaterial({
    map: tex,
    alphaMap: tex,
    alphaTest: 0.12,
    color: new THREE.Color(1, 1, 1),
    transparent: true,
    opacity: 0.96,
    depthWrite: true,
    depthTest: true,
    fog: false,
    side: THREE.DoubleSide,
  });
}

/**
 * @param {THREE.Scene} scene
 */
export function createSnowSystem(scene) {
  if (!_flakeGeo) {
    _flakeGeo = new THREE.PlaneGeometry(FLAKE_SIZE, FLAKE_SIZE, 1, 1);
  }
  if (!_fallMat) {
    _fallMat = makeFallingFlakeMaterial(0.88);
  }
  if (!_settledMat) {
    _settledMat = makeSettledFlakeMaterial();
  }

  const fallingMesh = new THREE.InstancedMesh(
    _flakeGeo,
    _fallMat,
    FALLING_COUNT
  );
  fallingMesh.name = "snow_falling";
  fallingMesh.frustumCulled = false;
  fallingMesh.renderOrder = WEATHER_RENDER_ORDER;
  setWeatherLayer(fallingMesh);

  const settledMesh = new THREE.InstancedMesh(
    _flakeGeo,
    _settledMat,
    SETTLED_MAX
  );
  settledMesh.name = "snow_settled";
  settledMesh.frustumCulled = false;
  settledMesh.renderOrder = 2;
  settledMesh.castShadow = false;
  settledMesh.receiveShadow = false;
  settledMesh.count = 0;
  setWorldLayer(settledMesh);

  const positions = new Float32Array(FALLING_COUNT * 3);
  const phases = new Float32Array(FALLING_COUNT);
  for (let i = 0; i < FALLING_COUNT; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * BOX_HALF_W;
    positions[i * 3 + 1] = Math.random() * BOX_HALF_H * 2 - BOX_HALF_H;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * BOX_HALF_D;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const fallingRoot = new THREE.Group();
  fallingRoot.name = "snow_falling_root";
  fallingRoot.visible = false;
  fallingRoot.add(fallingMesh);

  const settledRoot = new THREE.Group();
  settledRoot.name = "snow_settled_root";
  settledRoot.visible = false;
  settledRoot.add(settledMesh);

  scene.add(fallingRoot);
  scene.add(settledRoot);

  return {
    fallingRoot,
    settledRoot,
    fallingMesh,
    settledMesh,
    positions,
    phases,
    halfW: BOX_HALF_W,
    halfH: BOX_HALF_H,
    halfD: BOX_HALF_D,
    settled: [],
    settledWrite: 0,
    /** @type {Map<string, number>} */
    cellStacks: new Map(),
    vistaMode: false,
  };
}

/** @param {number} wx @param {number} wz */
function settleCellKey(wx, wz) {
  return `${Math.floor(wx / SETTLE_CELL_SIZE)},${Math.floor(wz / SETTLE_CELL_SIZE)}`;
}

/**
 * @param {ReturnType<typeof createSnowSystem>} snow
 * @param {number} camX
 * @param {number} camZ
 */
function pickSettledIndex(snow, camX, camZ) {
  if (snow.settled.length < SETTLED_MAX) return snow.settled.length;

  const cullR2 = SETTLE_CULL_RADIUS * SETTLE_CULL_RADIUS;
  for (let attempt = 0; attempt < 96; attempt++) {
    const idx = (snow.settledWrite + attempt) % SETTLED_MAX;
    const e = snow.settled[idx];
    if (!e) return idx;
    const dx = e.x - camX;
    const dz = e.z - camZ;
    if (dx * dx + dz * dz > cullR2) return idx;
  }
  return snow.settledWrite % SETTLED_MAX;
}

/**
 * @param {ReturnType<typeof createSnowSystem>} snow
 */
function clearSettled(snow) {
  snow.settled.length = 0;
  snow.settledWrite = 0;
  snow.cellStacks.clear();
  snow.settledMesh.count = 0;
  snow.settledMesh.instanceMatrix.needsUpdate = true;
}

/**
 * @param {ReturnType<typeof createSnowSystem>} snow
 * @param {{
 *   x: number,
 *   y: number,
 *   z: number,
 *   scale: number,
 *   rotY: number,
 * }} entry
 */
function writeSettledEntry(snow, entry, camX, camZ) {
  const idx = pickSettledIndex(snow, camX, camZ);
  if (snow.settled.length < SETTLED_MAX) {
    snow.settled.push(entry);
  } else {
    snow.settled[idx] = entry;
  }
  snow.settledWrite += 1;

  _euler.set(-Math.PI / 2, entry.rotY, 0);
  _quaternion.setFromEuler(_euler);
  _scale.set(entry.scale, entry.scale, entry.scale);
  _position.set(entry.x, entry.y, entry.z);
  _matrix.compose(_position, _quaternion, _scale);
  snow.settledMesh.setMatrixAt(idx, _matrix);
  snow.settledMesh.count = Math.min(snow.settled.length, SETTLED_MAX);
  snow.settledMesh.instanceMatrix.needsUpdate = true;
}

/**
 * @param {ReturnType<typeof createSnowSystem>} snow
 * @param {number} wx
 * @param {number} wz
 * @param {number} surfaceY
 * @param {number} stickRate 0.05–5 (5%–500%)
 * @param {number} intensity 0.05–5 (5%–500%)
 */
function settleFlake(snow, wx, wz, surfaceY, stickRate, intensity, camX, camZ) {
  const depositTarget = Math.max(
    1,
    Math.round(stickRate * stickRate * (0.35 + intensity * 0.08))
  );
  const chance = Math.min(1, 0.12 + stickRate * 0.176);
  const spread = 0.028 + stickRate * 0.038;
  const scaleBase = 0.5 + stickRate * 0.11;
  for (let p = 0; p < depositTarget; p++) {
    if (Math.random() > chance) continue;
    const sx = wx + (Math.random() - 0.5) * spread;
    const sz = wz + (Math.random() - 0.5) * spread;
    const cellKey = settleCellKey(sx, sz);
    const layer = Math.min(SETTLE_LAYER_CAP, (snow.cellStacks.get(cellKey) ?? 0) + 1);
    snow.cellStacks.set(cellKey, layer);
    writeSettledEntry(
      snow,
      {
        x: sx,
        y: surfaceY + 0.006 + layer * SETTLE_LAYER_STEP + Math.random() * 0.002,
        z: sz,
        scale: scaleBase + Math.random() * (0.38 + stickRate * 0.08),
        rotY: Math.random() * Math.PI * 2,
      },
      camX,
      camZ
    );
  }
}

/**
 * @param {ReturnType<typeof createSnowSystem>} snow
 * @param {number} rootY
 * @param {number} i
 */
function respawnFallingFlake(snow, rootY, i) {
  const { positions, halfW, halfH, halfD } = snow;
  positions[i * 3] = (Math.random() * 2 - 1) * halfW;
  positions[i * 3 + 1] = halfH - Math.random() * 4;
  positions[i * 3 + 2] = (Math.random() * 2 - 1) * halfD;
}

/**
 * @param {ReturnType<typeof createSnowSystem>} snow
 * @param {THREE.Camera} camera
 * @param {{
 *   playerX: number,
 *   attachWall: "north" | "south",
 *   arenaHalf: number,
 *   wallThickness?: number,
 * }} ctx
 */
function positionSnowForIndoorVista(snow, camera, ctx) {
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
  snow.fallingRoot.position.set(
    ctx.playerX,
    camera.position.y,
    arenaInnerZ + push
  );
}

/**
 * @param {ReturnType<typeof createSnowSystem> | null} snow
 * @param {THREE.Camera} camera
 * @param {number} dt
 * @param {number} time
 * @param {{
 *   active?: boolean,
 *   enclosed?: boolean,
 *   allowSettle?: boolean,
 *   intensity?: number,
 *   stickRate?: number,
 *   playerX?: number,
 *   attachWall?: "north" | "south",
 *   arenaHalf?: number,
 *   wallThickness?: number,
 *   occluders?: import("@/lib/Rain.js").RainOccluder[],
 *   floorY?: number,
 *   fade?: number,
 * }} [opts]
 */
export function updateSnow(snow, camera, dt, time, opts = {}) {
  if (!snow) return;
  const fade = Math.min(1, Math.max(0, opts.fade ?? 1));
  const baseIntensity = opts.intensity ?? DEFAULT_SNOW_INTENSITY;
  const stickRate = opts.stickRate ?? DEFAULT_SNOW_STICK_RATE;
  const visibleCount =
    fade <= 0.008
      ? 0
      : Math.min(
          FALLING_COUNT,
          Math.max(1, Math.round(FALLING_BASE * baseIntensity * fade))
        );
  snow.fallingRoot.visible = visibleCount > 0;
  snow.settledRoot.visible = snow.settledMesh.count > 0;
  if (visibleCount <= 0) return;

  const occluders = opts.occluders ?? [];
  const floorYWorld = opts.floorY ?? 0;
  const allowSettle = opts.allowSettle === true && fade > 0.82;
  const enclosed = opts.enclosed === true;
  const fallMul = (0.35 + baseIntensity * 0.42) * Math.max(0.12, fade);
  const fallOpacity =
    Math.min(0.98, 0.18 + baseIntensity * 0.16) * Math.max(0.08, fade);
  const vistaOpacity =
    Math.min(0.9, 0.14 + baseIntensity * 0.14) * Math.max(0.08, fade);

  if (enclosed) {
    positionSnowForIndoorVista(snow, camera, {
      playerX: opts.playerX ?? camera.position.x,
      attachWall: opts.attachWall ?? "north",
      arenaHalf: opts.arenaHalf ?? 16,
      wallThickness: opts.wallThickness,
    });
    if (_fallMat) _fallMat.opacity = vistaOpacity;
    snow.vistaMode = true;
  } else {
    snow.fallingRoot.position.copy(camera.position);
    if (_fallMat) _fallMat.opacity = fallOpacity;
    snow.vistaMode = false;
  }
  const rootY = snow.fallingRoot.position.y;
  const camX = camera.position.x;
  const camZ = camera.position.z;
  const { positions, phases, halfH, halfW, halfD, fallingMesh } = snow;
  const fall = FALL_SPEED * fallMul * dt;
  const localCeil = halfH;

  fallingMesh.count = visibleCount;

  for (let i = 0; i < FALLING_COUNT; i++) {
    if (i >= visibleCount) {
      _matrix.compose(_position.set(0, -9999, 0), _quaternion, _hideScale);
      fallingMesh.setMatrixAt(i, _matrix);
      continue;
    }

    const phase = phases[i];
    let x =
      positions[i * 3] +
      Math.sin(time * 0.7 + phase) * DRIFT_X * fallMul * dt;
    let y = positions[i * 3 + 1] - fall;
    let z =
      positions[i * 3 + 2] +
      Math.cos(time * 0.55 + phase * 1.3) * DRIFT_Z * fallMul * dt;

    if (x > halfW) x -= halfW * 2;
    else if (x < -halfW) x += halfW * 2;
    if (z > halfD) z -= halfD * 2;
    else if (z < -halfD) z += halfD * 2;

    const wx = snow.fallingRoot.position.x + x;
    const wz = snow.fallingRoot.position.z + z;
    const wy = rootY + y;
    const flakeBottom = wy - FLAKE_SIZE * 0.5;

    const landingY = findLandingSurfaceY(
      wx,
      wz,
      flakeBottom,
      occluders,
      floorYWorld
    );

    if (landingY !== null) {
      if (allowSettle) {
        settleFlake(snow, wx, wz, landingY, stickRate, baseIntensity, camX, camZ);
      }
      respawnFallingFlake(snow, rootY, i);
      x = positions[i * 3];
      y = positions[i * 3 + 1];
      z = positions[i * 3 + 2];
    } else if (y < -halfH) {
      y = localCeil - Math.random() * 4;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const hidden =
      sampleSurfaceTopY(wx, wz, wy - FLAKE_SIZE * 0.5, occluders) !== null;
    _position.set(x, hidden ? -9999 : y, z);
    _euler.set(0, Math.atan2(camera.position.x - wx, camera.position.z - wz), 0);
    _quaternion.setFromEuler(_euler);
    _matrix.compose(_position, _quaternion, _scale);
    fallingMesh.setMatrixAt(i, _matrix);
  }

  fallingMesh.instanceMatrix.needsUpdate = true;
}

/**
 * Fade and thin settled snow while melting. Keeps coverage visible until fully gone.
 *
 * @param {ReturnType<typeof createSnowSystem> | null} snow
 * @param {number} dt
 * @param {number} meltFade 0–1
 */
export function updateSettledSnowMelt(snow, dt, meltFade) {
  if (!snow) return;
  const fade = Math.min(1, Math.max(0, meltFade));
  const count = snow.settled.length;
  if (count === 0) {
    if (_settledMat) _settledMat.opacity = 0.96;
    snow.settledRoot.visible = false;
    return;
  }

  snow.settledRoot.visible = fade > 0.008;
  if (_settledMat) _settledMat.opacity = 0.96 * fade;

  if (fade <= 0.008) {
    clearSettled(snow);
    if (_settledMat) _settledMat.opacity = 0.96;
    return;
  }

  if (fade >= 0.98) return;

  const thinRate = (1 - fade) * dt * 1.6;
  let removed = 0;
  for (let i = snow.settled.length - 1; i >= 0; i -= 1) {
    if (Math.random() < thinRate) {
      snow.settled.splice(i, 1);
      removed += 1;
    }
  }

  if (removed > 0) {
    snow.settledMesh.count = snow.settled.length;
    for (let i = 0; i < snow.settled.length; i += 1) {
      const entry = snow.settled[i];
      _euler.set(-Math.PI / 2, entry.rotY, 0);
      _quaternion.setFromEuler(_euler);
      _scale.set(entry.scale, entry.scale, entry.scale);
      _position.set(entry.x, entry.y, entry.z);
      _matrix.compose(_position, _quaternion, _scale);
      snow.settledMesh.setMatrixAt(i, _matrix);
    }
    snow.settledMesh.instanceMatrix.needsUpdate = true;
  }
}

/** @param {ReturnType<typeof createSnowSystem> | null} snow */
export function disposeSnow(snow) {
  if (!snow) return;
  snow.fallingRoot.removeFromParent();
  snow.settledRoot.removeFromParent();
}

/** @param {ReturnType<typeof createSnowSystem> | null} snow */
export function resetSnowSettled(snow) {
  if (!snow) return;
  clearSettled(snow);
}
