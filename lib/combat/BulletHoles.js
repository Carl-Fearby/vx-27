import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { getLaserPalette } from "../weapons/ViewWeapon.js";
import {
  OIL_BARREL_FLAME_MESH_NAMES,
  pinLightToRoomInteriorLayer,
  pinLightToWorldLayer,
  ROOM_INTERIOR_LAYER,
} from "../lighting/LightingLayers.js";

/**
 * Fire / VFX meshes are visible but should not stop bolts or take decals.
 * @param {THREE.Object3D | null | undefined} obj
 */
export function isBulletPassthroughMesh(obj) {
  let node = obj;
  while (node) {
    if (node.userData?.skipBulletSurface) return true;
    if (node.userData?.isShadowOccluder) return true;
    if (node.userData?.roomArenaWallOverlay) return true;
    if (node.userData?.roomCornerSeal) return true;
    if (OIL_BARREL_FLAME_MESH_NAMES.has(node.name)) return true;
    node = node.parent;
  }
  return false;
}

/** @param {THREE.Intersection[]} intersections Sorted by distance (Three.js default). */
export function pickFirstBulletHit(intersections) {
  for (const hit of intersections) {
    if (!isBulletPassthroughMesh(hit.object)) return hit;
  }
  return null;
}

/**
 * Closest non-passthrough hit from two raycast result lists (no merge/sort alloc).
 * @param {THREE.Intersection[]} targetHits
 * @param {THREE.Intersection[]} surfaceHits
 */
export function pickClosestBulletHit(targetHits, surfaceHits) {
  let best = null;
  for (let i = 0; i < targetHits.length; i += 1) {
    const hit = targetHits[i];
    if (isBulletPassthroughMesh(hit.object)) continue;
    if (!best || hit.distance < best.distance) best = hit;
  }
  for (let i = 0; i < surfaceHits.length; i += 1) {
    const hit = surfaceHits[i];
    if (isBulletPassthroughMesh(hit.object)) continue;
    if (!best || hit.distance < best.distance) best = hit;
  }
  return best;
}

const BULLET_HOLE_PATHS = [
  "/textures/bullet_holes/01_concrete_bullet_hole_alpha.webp",
  "/textures/bullet_holes/02_concrete_bullet_hole_alpha.webp",
  "/textures/bullet_holes/03_concrete_bullet_hole_alpha.webp",
  "/textures/bullet_holes/04_concrete_bullet_hole_alpha.webp",
  "/textures/bullet_holes/05_concrete_bullet_hole_alpha.webp",
];

const HOLE_LIFETIME = 60;
const HOLE_FADE_DURATION = 2;
const HOLE_BASE_SIZE = 0.24;
const MAX_HOLES = 140;
const HOLE_RENDER_ORDER_BASE = 4;
/** Stay below oil-barrel flame meshes (10+) and laser bolts (100). */
const HOLE_RENDER_ORDER_SPAN = 5;
/** Tiny inset along inward normal — avoids z-fight without floating in front of impact VFX. */
const HOLE_SURFACE_INSET = 0.0002;
const HOLE_SURFACE_INSET_STEP = 0.000015;
const FLASH_DURATION = 0.12;
const FLASH_PEAK_INTENSITY = 3.5;
const FLASH_DISTANCE = 0.85;

/** @type {THREE.Texture[]} */
let _holeTextures = [];
let _texturesReady = false;
/** @type {Promise<void> | null} */
let _loadPromise = null;

// Toggleable dev flag: allow the runtime to disable spawning/keeping bullet hole
// decals to aid perf investigation. When disabled we immediately dispose any
// existing holes so the scene is clean.
let BULLET_HOLES_ENABLED = true;
export function setBulletHolesEnabled(enabled) {
  BULLET_HOLES_ENABLED = !!enabled;
  if (!BULLET_HOLES_ENABLED) {
    disposeAllBulletHoles();
  }
}
export function getBulletHolesEnabled() {
  return BULLET_HOLES_ENABLED;
}

/** @type {{ mesh: THREE.Mesh, age: number }[]} */
const _holes = [];
/** @type {{ light: THREE.PointLight, age: number, duration: number, peakIntensity: number }[]} */
const _flashes = [];
let _holeSpawnSeq = 0;

const _worldNormal = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _localPoint = new THREE.Vector3();
const _localNormal = new THREE.Vector3();
const _invMatrix = new THREE.Matrix4();
const _lookAtTarget = new THREE.Vector3();
const _up = new THREE.Vector3();
const _orientMatrix = new THREE.Matrix4();
const _decalEuler = new THREE.Euler();
const _decalSize = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _quat = new THREE.Quaternion();
const _planeGeo = new THREE.PlaneGeometry(1, 1);
const _localBulletDir = new THREE.Vector3();

/**
 * @param {THREE.Object3D} levelGroup
 * @param {THREE.Object3D[]} targets
 * @returns {THREE.Mesh[]}
 */
export function collectLevelHitMeshes(levelGroup, targets = []) {
  const targetSet = new Set(targets);
  /** @type {THREE.Mesh[]} */
  const meshes = [];

  levelGroup.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.userData?.bulletHole || obj.userData?.bulletImpactFlash) return;
    if (obj.userData?.isShadowOccluder || obj.userData?.skipBulletSurface) return;
    if (obj.userData?.roomArenaWallOverlay || obj.userData?.roomCornerSeal) return;
    if (obj.userData?.healthBar) return;

    let node = obj;
    while (node) {
      if (targetSet.has(node)) return;
      node = node.parent;
    }

    meshes.push(obj);
  });

  return meshes;
}

/** @returns {Promise<void>} */
export function preloadBulletHoleTextures() {
  if (_texturesReady) return Promise.resolve();
  if (_loadPromise) return _loadPromise;

  const loader = new THREE.TextureLoader();
  _loadPromise = Promise.all(
    BULLET_HOLE_PATHS.map(
      (path) =>
        new Promise((resolve, reject) => {
          loader.load(
            path,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.premultiplyAlpha = false;
              resolve(tex);
            },
            undefined,
            reject
          );
        })
    )
  ).then((textures) => {
    _holeTextures = textures;
    _texturesReady = true;
  });

  return _loadPromise;
}

function pickHoleTexture() {
  if (!_holeTextures.length) return null;
  return _holeTextures[(Math.random() * _holeTextures.length) | 0];
}

function resolveWorldNormal(surfaceMesh, hitPoint, hitFace, bulletDir) {
  if (hitFace?.normal) {
    _worldNormal.copy(hitFace.normal).transformDirection(surfaceMesh.matrixWorld).normalize();
  } else if (bulletDir?.lengthSq() > 1e-6) {
    _worldNormal.copy(bulletDir).normalize().negate();
  } else {
    _worldNormal.set(0, 0, 1).applyQuaternion(surfaceMesh.quaternion);
  }

  if (bulletDir?.lengthSq() > 1e-6 && _worldNormal.dot(bulletDir) > 0) {
    _worldNormal.negate();
  }
  return _worldNormal;
}

function surfaceRefMaterial(surfaceMesh, materialIndex) {
  const mats = surfaceMesh.material;
  if (!Array.isArray(mats)) return surfaceMesh.material;
  if (materialIndex != null && mats[materialIndex]) return mats[materialIndex];
  for (const mat of mats) {
    if (mat?.userData?.vx27SetKey === "door") return mat;
  }
  return mats[0];
}

/** Sit slightly in front of the parent surface in the depth buffer (lower offset = closer). */
function applyHolePolygonOffset(mat, refMat) {
  mat.polygonOffset = true;
  const po = refMat?.polygonOffsetFactor ?? 0;
  const units = refMat?.polygonOffsetUnits ?? po;
  if (refMat?.polygonOffset && po > 0) {
    mat.polygonOffsetFactor = Math.max(0, po - 2);
    mat.polygonOffsetUnits = Math.max(0, units - 2);
    return;
  }
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -2;
}

function planeHoleInset(seq) {
  return HOLE_SURFACE_INSET + (seq % 16) * HOLE_SURFACE_INSET_STEP;
}

/** Match the hit surface so decals shade with sun/room lights and shadows. */
function createHoleMaterial(tex, refMat) {
  if (refMat?.isMeshStandardMaterial) {
    const mat = refMat.clone();
    mat.map = tex;
    mat.transparent = true;
    mat.opacity = 1;
    mat.alphaTest = 0;
    mat.depthWrite = false;
    mat.depthTest = true;
    applyHolePolygonOffset(mat, refMat);
    if (refMat.transparent) {
      mat.polygonOffsetFactor = -4;
      mat.polygonOffsetUnits = -4;
    }
    mat.side = THREE.DoubleSide;
    // Decal UVs do not match tiled wall maps — flat albedo + scene lighting only.
    mat.normalMap = null;
    mat.roughnessMap = null;
    mat.metalnessMap = null;
    mat.aoMap = null;
    mat.emissiveMap = null;
    mat.alphaMap = null;
    mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0;
    mat.metalness = 0;
    mat.roughness = 1;
    mat.color.set(0xffffff);
    return mat;
  }

  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    opacity: 1,
    alphaTest: 0,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  applyHolePolygonOffset(mat, refMat);
  if (refMat?.color) mat.color.copy(refMat.color);
  return mat;
}

/** Curved surfaces use projected decals; flat box walls use a tangent plane. */
function shouldUseDecalGeometry(surfaceMesh) {
  const geo = surfaceMesh.geometry;
  if (!geo) return false;
  const type = geo.type;
  if (type === "CircleGeometry" || type === "PlaneGeometry") return false;
  if (type === "BoxGeometry" || type === "ExtrudeGeometry") return false;
  if (type === "CylinderGeometry" && geo.parameters?.openEnded) return true;
  if (type === "LatheGeometry") return true;
  return false;
}

function copySurfaceLayers(decal, surfaceMesh) {
  decal.layers.mask = surfaceMesh.layers.mask;
}

function configureHoleMesh(hole, surfaceMesh) {
  hole.receiveShadow = true;
  hole.castShadow = false;
  copySurfaceLayers(hole, surfaceMesh);
}

/** @param {THREE.Euler} orientation */
function buildDecalOrientation(hitPoint, worldNormal, orientation) {
  _up.set(0, 1, 0);
  if (Math.abs(worldNormal.y) > 0.999) _up.set(1, 0, 0);
  _lookAtTarget.copy(hitPoint).add(worldNormal);
  _orientMatrix.lookAt(hitPoint, _lookAtTarget, _up);
  orientation.setFromRotationMatrix(_orientMatrix);
}

/**
 * Project decal geometry onto the hit mesh so curved surfaces (barrel rims, etc.)
 * do not show a floating camera-facing plane.
 * @param {THREE.Mesh} surfaceMesh
 * @param {THREE.Vector3} hitPoint
 * @param {THREE.Vector3} worldNormal
 * @param {number} size
 */
function tryBuildDecalGeometry(surfaceMesh, hitPoint, worldNormal, size) {
  surfaceMesh.updateWorldMatrix(true, false);

  const half = size * 0.5;
  _decalSize.set(half, half, half * 0.55);
  buildDecalOrientation(hitPoint, worldNormal, _decalEuler);

  const decalGeo = new DecalGeometry(
    surfaceMesh,
    hitPoint,
    _decalEuler,
    _decalSize
  );

  if (!decalGeo.attributes.position || decalGeo.attributes.position.count < 3) {
    decalGeo.dispose();
    return null;
  }

  _invMatrix.copy(surfaceMesh.matrixWorld).invert();
  decalGeo.applyMatrix4(_invMatrix);
  return decalGeo;
}

/** Place a fallback plane in the surface's local tangent frame. */
function placePlaneHoleLocal(hole, surfaceMesh, hitPoint, hitFace, bulletDir, offset) {
  resolveWorldNormal(surfaceMesh, hitPoint, hitFace, bulletDir);
  _invMatrix.copy(surfaceMesh.matrixWorld).invert();
  _localPoint.copy(hitPoint).applyMatrix4(_invMatrix);
  _localNormal.copy(_worldNormal).transformDirection(_invMatrix).normalize();

  surfaceMesh.add(hole);
  // Place on the struck face — thin panels (doors) need a proud offset toward the shooter.
  let insetSign = -1;
  if (bulletDir?.lengthSq() > 1e-6) {
    _localBulletDir.copy(bulletDir).transformDirection(_invMatrix).normalize();
    if (_localNormal.dot(_localBulletDir) < 0) insetSign = 1;
  }
  hole.position.copy(_localPoint).addScaledVector(_localNormal, insetSign * offset);
  _quat.setFromUnitVectors(_zAxis, _localNormal);
  hole.quaternion.copy(_quat);
  hole.rotateZ(Math.random() * Math.PI * 2);
}

function disposeHoleMesh(mesh) {
  mesh.parent?.remove(mesh);
  if (mesh.geometry && mesh.geometry !== _planeGeo) mesh.geometry.dispose();
  mesh.material.dispose();
}

function applyHoleScale(hole, tex) {
  const aspect =
    tex.image?.height > 0 ? tex.image.width / tex.image.height : 1;
  const size = HOLE_BASE_SIZE * (0.88 + Math.random() * 0.28);
  if (aspect >= 1) {
    hole.scale.set(size * aspect, size, 1);
  } else {
    hole.scale.set(size, size / aspect, 1);
  }
}

/**
 * @param {THREE.Mesh} surfaceMesh
 * @param {THREE.Vector3} hitPoint
 * @param {THREE.Face | null | undefined} hitFace
 * @param {THREE.Vector3 | null | undefined} bulletDir
 */
export function spawnBulletHole(surfaceMesh, hitPoint, hitFace, bulletDir) {
  if (!surfaceMesh || !hitPoint) return;
  if (isBulletPassthroughMesh(surfaceMesh)) return;
  // Respect dev toggle: if hole decals are disabled don't create any geometry.
  if (!BULLET_HOLES_ENABLED) return;
  if (!_texturesReady) {
    preloadBulletHoleTextures().then(() =>
      spawnBulletHole(surfaceMesh, hitPoint, hitFace, bulletDir)
    );
    return;
  }

  while (_holes.length >= MAX_HOLES) {
    disposeHoleMesh(_holes.shift().mesh);
  }

  resolveWorldNormal(surfaceMesh, hitPoint, hitFace, bulletDir);

  const tex = pickHoleTexture();
  if (!tex) return;

  const seq = ++_holeSpawnSeq;
  const refMat = surfaceRefMaterial(surfaceMesh, hitFace?.materialIndex);
  const surfaceInset = planeHoleInset(seq);

  const mat = createHoleMaterial(tex, refMat);
  const size = HOLE_BASE_SIZE * (0.88 + Math.random() * 0.28);
  const wantsDecal = shouldUseDecalGeometry(surfaceMesh);

  let hole;

  // If the surface prefers decals (curved), avoid the expensive synchronous
  // DecalGeometry build on the main firing path. Create a cheap plane decal
  // immediately so there's no visual gap, then build the proper decal on
  // idle and replace the plane. This prevents large synchronous CPU work
  // during shooting which can cause frame hitches.
  if (wantsDecal) {
    // Fast fallback plane for the immediate frame
    hole = new THREE.Mesh(_planeGeo, mat);
    placePlaneHoleLocal(hole, surfaceMesh, hitPoint, hitFace, bulletDir, surfaceInset);
    applyHoleScale(hole, tex);

    // Schedule async decal generation on idle / next tick
    const buildDecalAsync = () => {
      try {
        const decalGeo = tryBuildDecalGeometry(surfaceMesh, hitPoint, _worldNormal, size);
        if (!decalGeo) return;

        const decal = new THREE.Mesh(decalGeo, mat);
        // add decal to the same parent surface
        surfaceMesh.add(decal);
        configureHoleMesh(decal, surfaceMesh);

        // Replace the placeholder in the runtime hole list so fading/disposal
        // still operate on the correct mesh instance.
        for (let i = 0; i < _holes.length; i += 1) {
          if (_holes[i].mesh === hole) {
            _holes[i].mesh = decal;
            break;
          }
        }

        // Remove the placeholder plane
        hole.parent?.remove(hole);
      } catch (err) {
        // Non-fatal: leave the plane in place if decal build fails
        console.warn("Decal build failed:", err);
      }
    };

    // Run async decal generation on the next tick. We intentionally avoid
    // requestIdleCallback here since it can be inconsistently scheduled on
    // some platforms and we've seen it contribute to frame stalls; a plain
    // timeout yields more predictable behavior during heavy warmup.
    setTimeout(buildDecalAsync, 0);
  } else {
    const decalGeo = null;
    hole = new THREE.Mesh(_planeGeo, mat);
    placePlaneHoleLocal(hole, surfaceMesh, hitPoint, hitFace, bulletDir, surfaceInset);
    applyHoleScale(hole, tex);
  }

  hole.userData.bulletHole = true;
  hole.renderOrder =
    HOLE_RENDER_ORDER_BASE +
    (seq % HOLE_RENDER_ORDER_SPAN) +
    (surfaceMesh.renderOrder ?? 0);
  configureHoleMesh(hole, surfaceMesh);
  _holes.push({ mesh: hole, age: 0 });
}

/**
 * Brief coloured point-light flash at impact — same hue as the laser bolt.
 * @param {THREE.Mesh} surfaceMesh
 * @param {THREE.Vector3} hitPoint
 * @param {THREE.Vector3} worldNormal
 * @param {boolean} [radioactive=false]
 */
export function spawnBulletImpactFlash(
  surfaceMesh,
  hitPoint,
  worldNormal,
  radioactive = false
) {
  const palette = getLaserPalette(radioactive);
  const light = new THREE.PointLight(
    palette.muzzle,
    FLASH_PEAK_INTENSITY,
    FLASH_DISTANCE,
    2
  );
  light.userData.bulletImpactFlash = true;

  const onRoomInterior =
    (surfaceMesh.layers.mask & (1 << ROOM_INTERIOR_LAYER)) !== 0;
  if (onRoomInterior) pinLightToRoomInteriorLayer(light);
  else pinLightToWorldLayer(light);

  light.position.copy(hitPoint);
  surfaceMesh.attach(light);

  _flashes.push({
    light,
    age: 0,
    duration: FLASH_DURATION,
    peakIntensity: FLASH_PEAK_INTENSITY,
  });
}

/**
 * @param {THREE.Intersection} hit
 * @param {THREE.Vector3} bulletDir
 * @param {boolean} [radioactive=false]
 */
export function applyBulletSurfaceHit(hit, bulletDir, radioactive = false) {
  if (!hit?.object?.isMesh || !hit.point) return;
  if (isBulletPassthroughMesh(hit.object)) return;

  const worldNormal = resolveWorldNormal(
    hit.object,
    hit.point,
    hit.face,
    bulletDir
  ).clone();

  spawnBulletImpactFlash(hit.object, hit.point, worldNormal, radioactive);
  spawnBulletHole(hit.object, hit.point, hit.face, bulletDir);
}

/** @param {number} dt */
export function updateBulletHoles(dt) {
  for (let i = _holes.length - 1; i >= 0; i--) {
    const entry = _holes[i];
    entry.age += dt;
    const fadeStart = HOLE_LIFETIME;
    if (entry.age < fadeStart) continue;

    const fadeT = (entry.age - fadeStart) / HOLE_FADE_DURATION;
    if (fadeT >= 1) {
      disposeHoleMesh(entry.mesh);
      _holes.splice(i, 1);
      continue;
    }

    const mat = entry.mesh.material;
    if (!mat.userData.bulletHoleFading) {
      mat.userData.bulletHoleFading = true;
    }
    mat.opacity = 1 - fadeT;
  }

  for (let i = _flashes.length - 1; i >= 0; i--) {
    const entry = _flashes[i];
    entry.age += dt;
    const t = entry.age / entry.duration;
    if (t >= 1) {
      entry.light.parent?.remove(entry.light);
      entry.light.dispose();
      _flashes.splice(i, 1);
      continue;
    }
    const falloff = (1 - t) * (1 - t);
    entry.light.intensity = entry.peakIntensity * falloff;
  }
}

export function disposeAllBulletHoles() {
  for (const entry of _holes) {
    disposeHoleMesh(entry.mesh);
  }
  _holes.length = 0;
  _holeSpawnSeq = 0;

  for (const entry of _flashes) {
    entry.light.parent?.remove(entry.light);
    entry.light.dispose();
  }
  _flashes.length = 0;
}

const _warmupHitPoint = new THREE.Vector3();
const _warmupHitNormal = new THREE.Vector3();
const _warmupBulletDir = new THREE.Vector3(0, 0, -1);

function meshUsesMaterial(mesh, predicate) {
  if (!mesh?.material) return false;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats.some(predicate);
}

/** One mesh per hole material path (standard, lambert, vx27 door, plane, curved decal).
 *  Accept an optional maxSurfaces to allow warmer prebuilds when desired. */
function pickWarmupBulletSurfaces(meshes, maxSurfaces = 5) {
  const picked = [];
  const seen = new Set();
  const add = (mesh) => {
    if (!mesh || seen.has(mesh)) return;
    seen.add(mesh);
    picked.push(mesh);
  };

  // Prefer representative material/geometry types first
  add(meshes.find((m) => m.material?.isMeshStandardMaterial));
  add(
    meshes.find((m) => meshUsesMaterial(m, (mat) => mat?.userData?.vx27SetKey === "door")),
  );
  add(meshes.find((m) => meshUsesMaterial(m, (mat) => mat?.isMeshLambertMaterial)));
  add(
    meshes.find(
      (m) =>
        !shouldUseDecalGeometry(m) &&
        (m.geometry?.type === "BoxGeometry" || m.geometry?.type === "PlaneGeometry"),
    ),
  );
  add(meshes.find((m) => shouldUseDecalGeometry(m)));

  // Fill out with other meshes until we reach maxSurfaces so more surfaces are
  // covered by the warmup pass (option C: prebuild for more surfaces).
  for (let i = 0; i < meshes.length && picked.length < maxSurfaces; i += 1) {
    add(meshes[i]);
  }

  if (!picked.length && meshes[0]) add(meshes[0]);
  return picked.slice(0, maxSurfaces);
}

function warmupHitOnMesh(mesh, camera) {
  mesh.updateWorldMatrix(true, false);
  mesh.getWorldPosition(_warmupHitPoint);
  _warmupHitPoint.y += 0.35;
  if (camera) {
    camera.getWorldDirection(_warmupBulletDir);
    _warmupHitNormal.copy(_warmupBulletDir).negate();
  } else {
    _warmupHitNormal.set(0, 0, 1).applyQuaternion(mesh.quaternion);
  }
  return { point: _warmupHitPoint.clone(), normal: _warmupHitNormal.clone() };
}

/**
 * Spawn decal/plane bullet holes + blue/green impact flashes, render, then dispose.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {THREE.Object3D} levelGroup
 * @param {THREE.Mesh[]} targets
 * @param {{ renderFrame?: (r: THREE.WebGLRenderer, s: THREE.Scene, c: THREE.Camera) => void, frames?: number }} [opts]
 */
export async function warmupBulletHolesGpu(
  renderer,
  scene,
  camera,
  levelGroup,
  targets,
  opts = {},
) {
  if (!renderer || !scene || !camera) return;
  if (!levelGroup && !targets?.length) return;

  await preloadBulletHoleTextures();

  // C: try to prebuild decals for a larger set of surfaces (cap to avoid
  // explosive work). We pick representative meshes then fill up to the cap.
  const allSurfaces = [
    ...collectLevelHitMeshes(levelGroup, targets ?? []),
    ...(targets ?? []),
  ];
  // Prebuild decals for all hit meshes (may be heavy on very large levels,
  // but avoids first-shot stalls). We keep the array as-is rather than
  // selecting a representative subset.
  const surfaces = allSurfaces;
  if (!surfaces.length) return;

  const dir = new THREE.Vector3(0, 0, -1);
  camera.getWorldDirection(dir);
  // Stronger warmup: for each representative surface, create a plane decal for
  // every bullet-hole texture, attempt to synchronously build DecalGeometry
  // (when applicable), attach those meshes to the surface, render a few
  // frames to force GPU uploads for textures/vertex buffers/shaders, then
  // clean everything up. This avoids leaving the first real shot to trigger
  // expensive geometry/tensor uploads on the main path.
  const tempMeshes = [];
  const renderFrame = opts.renderFrame;
  // B: stronger warmup — increase default frames to ensure GPU uploads settle.
  const frames = opts.frames ?? 32;
  // How many temporary meshes to create before yielding a frame so work is
  // time-sliced across several frames. This prevents a long synchronous
  // startup stall while still covering many surfaces.
  const chunkSize = opts.chunkSize ?? 6;
  let workSinceYield = 0;

  for (let i = 0; i < surfaces.length; i += 1) {
    const mesh = surfaces[i];
    const { point, normal } = warmupHitOnMesh(mesh, camera);

    // Create impact flashes for the first surface so shaders/lights are used.
    if (i === 0) {
      spawnBulletImpactFlash(mesh, point, normal, false);
      spawnBulletImpactFlash(mesh, point, normal, true);
    }

    // For each hole texture, create a plane and attempt a proper decal so that
    // both texture sampling and decal vertex buffers are uploaded.
    for (let ti = 0; ti < _holeTextures.length; ti += 1) {
      const tex = _holeTextures[ti];
      if (!tex) continue;
      try {
        const refMat = surfaceRefMaterial(mesh, null);
        const mat = createHoleMaterial(tex, refMat);

        // Plane placeholder
        const plane = new THREE.Mesh(_planeGeo, mat);
        placePlaneHoleLocal(plane, mesh, point, null, dir, planeHoleInset(ti));
        applyHoleScale(plane, tex);
        plane.userData.bulletHole = true;
        configureHoleMesh(plane, mesh);
        mesh.add(plane);
        tempMeshes.push(plane);
        workSinceYield += 1;

        // Try to synchronously build a decal geometry and add it if valid.
        if (shouldUseDecalGeometry(mesh)) {
          try {
            const decalGeo = tryBuildDecalGeometry(mesh, point, normal, HOLE_BASE_SIZE);
            if (decalGeo) {
              const decal = new THREE.Mesh(decalGeo, mat);
              mesh.add(decal);
              configureHoleMesh(decal, mesh);
              tempMeshes.push(decal);
              workSinceYield += 1;
            }
          } catch (err) {
            // Non-fatal: skip decal build if it errors here.
            console.warn("warmup decal build failed:", err);
          }
        }
      } catch (err) {
        // Protect warmup from any unexpected runtime errors.
        console.warn("warmup create hole failed:", err);
      }
      // If we've done enough sync work, yield to the renderer for one frame
      // to let GL uploads and shader compiles progress without causing a long
      // blocking startup hitch.
      if (workSinceYield >= chunkSize) {
        if (renderFrame) renderFrame(renderer, scene, camera);
        else renderer.render(scene, camera);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => requestAnimationFrame(resolve));
        workSinceYield = 0;
      }
    }
  }

  // Render a few frames (using provided renderFrame hook if present) to force
  // GPU upload of geometry and textures. Use requestAnimationFrame ticks so
  // async GL uploads complete.
  for (let f = 0; f < frames; f += 1) {
    if (renderFrame) {
      renderFrame(renderer, scene, camera);
    } else {
      renderer.render(scene, camera);
    }
    // allow one rAF to progress
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  // Cleanup temporary meshes we added directly (do not rely on _holes list).
  for (const m of tempMeshes) {
    m.parent?.remove(m);
    if (m.geometry && m.geometry !== _planeGeo) m.geometry.dispose();
    if (m.material) m.material.dispose();
  }

  // Also dispose any flashes/holes spawned via spawnBulletImpactFlash/spawnBulletHole.
  disposeAllBulletHoles();
}
