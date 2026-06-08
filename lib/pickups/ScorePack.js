import * as THREE from "three";
import { setWorldLayer } from "../lighting/LightingLayers.js";
import {
  computePickupBobY,
  PICKUP_SETTLE_BLEND_SPEED,
} from "./PickupCollectibleMotion.js";

/** Baked edge-unwrap UV for the score token rim. */
const SCORE_TOKEN_EDGE_UV = {
  repeatU: 4,
  repeatV: 1.59,
  offsetU: -1,
  offsetV: -0.3,
};

/** Cylinder on edge — same pose as the HP power core (rotation.z = π/2). */
export const SCORE_DISK_EDGE_ROT_Z = Math.PI / 2;

/** Matches HP_ORB_SPIN_SPEED in Targets.js */
const SCORE_SPIN_SPEED = 2.5;

export const SCORE_TOKEN_BASE_ROTATION = {
  x: 0,
  y: 0,
  z: SCORE_DISK_EDGE_ROT_Z,
};

export function getScoreTokenBaseRotation() {
  return SCORE_TOKEN_BASE_ROTATION;
}

/** VX-27 score bonus token — world pickup + pickup flash preview. */
export const SCORE_PACK_PICKUP_SRC =
  "/textures/score_token/front_face_albedo.png";
export const SCORE_PACK_DEFAULT_VALUE = 100;

const TEX_ROOT = "/textures/score_token/";

const DISK_RADIUS = 0.15;
const DISK_HEIGHT = 0.06;
const DISK_SCALE = 1;
const FLOOR_CLEARANCE = 0.02;
/** Center pivot on edge — radius above floor, same pattern as HP_ORB_SETTLE_Y. */
export const SCORE_PACK_SETTLE_Y = DISK_RADIUS + FLOOR_CLEARANCE;
const SETTLE_Y = SCORE_PACK_SETTLE_Y;
const SOFT_DROP_VY = -1.2;
const SOFT_GRAVITY = 12;
const SOFT_BOUNCE = 0.55;

const MAT_SIDE = 0;
const MAT_TOP = 1;
const MAT_BOTTOM = 2;

const EDGE_TEX = {
  albedo: `${TEX_ROOT}edge_unwrap_albedo.png`,
  normal: `${TEX_ROOT}edge_unwrap_normal.png`,
  roughness: `${TEX_ROOT}edge_unwrap_roughness.png`,
  metallic: `${TEX_ROOT}edge_unwrap_metallic.png`,
  ao: `${TEX_ROOT}edge_unwrap_ao.png`,
  emissive: `${TEX_ROOT}edge_unwrap_emissive.png`,
  height: `${TEX_ROOT}edge_unwrap_height.png`,
};

const SCORE_TOKEN_TEX_PATHS = [
  `${TEX_ROOT}front_face_albedo.png`,
  `${TEX_ROOT}front_face_normal.png`,
  `${TEX_ROOT}front_face_roughness.png`,
  `${TEX_ROOT}front_face_metallic.png`,
  `${TEX_ROOT}front_face_ao.png`,
  `${TEX_ROOT}front_face_emissive.png`,
  ...Object.values(EDGE_TEX),
];

let _geo = null;
let _mats = null;
let _preloadPromise = null;

const _loader = new THREE.TextureLoader();
const _texCache = new Map();

function loadTex(path, srgb = false) {
  let tex = _texCache.get(path);
  if (!tex) {
    tex = _loader.load(path);
    _texCache.set(path, tex);
  }
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
}

function buildScoreTokenGeometry() {
  const geo = new THREE.CylinderGeometry(
    DISK_RADIUS,
    DISK_RADIUS * 0.97,
    DISK_HEIGHT,
    48,
    1,
    false
  );
  geo.userData.shared = true;
  return geo;
}

function createFaceMaterial() {
  return new THREE.MeshStandardMaterial({
    map: loadTex(`${TEX_ROOT}front_face_albedo.png`, true),
    normalMap: loadTex(`${TEX_ROOT}front_face_normal.png`),
    roughnessMap: loadTex(`${TEX_ROOT}front_face_roughness.png`),
    metalnessMap: loadTex(`${TEX_ROOT}front_face_metallic.png`),
    aoMap: loadTex(`${TEX_ROOT}front_face_ao.png`),
    emissiveMap: loadTex(`${TEX_ROOT}front_face_emissive.png`, true),
    emissive: 0x66ccff,
    emissiveIntensity: 1.35,
    metalness: 1,
    roughness: 1,
  });
}

function createEdgeMaterial() {
  return new THREE.MeshStandardMaterial({
    map: loadTex(EDGE_TEX.albedo, true),
    normalMap: loadTex(EDGE_TEX.normal),
    roughnessMap: loadTex(EDGE_TEX.roughness),
    metalnessMap: loadTex(EDGE_TEX.metallic),
    aoMap: loadTex(EDGE_TEX.ao),
    emissiveMap: loadTex(EDGE_TEX.emissive, true),
    bumpMap: loadTex(EDGE_TEX.height),
    bumpScale: 0.04,
    emissive: 0x66ccff,
    emissiveIntensity: 1.35,
    metalness: 1,
    roughness: 1,
  });
}

function applyEdgeTextureUv(repeatU, repeatV, offsetU, offsetV) {
  for (const path of Object.values(EDGE_TEX)) {
    const tex = _texCache.get(path);
    if (!tex) continue;
    tex.repeat.set(repeatU, repeatV);
    tex.offset.set(offsetU, offsetV);
    tex.needsUpdate = true;
  }
}

function ensureAssets() {
  if (!_geo) {
    _geo = buildScoreTokenGeometry();
  }
  if (!_mats) {
    const sideMat = createEdgeMaterial();
    const faceMat = createFaceMaterial();
    sideMat.userData.shared = true;
    faceMat.userData.shared = true;
    _mats = [sideMat, faceMat, faceMat];
    const { repeatU, repeatV, offsetU, offsetV } = SCORE_TOKEN_EDGE_UV;
    applyEdgeTextureUv(repeatU, repeatV, offsetU, offsetV);
  }
}

function cloneScorePackMaterials() {
  ensureAssets();
  return _mats.map((mat) => mat.clone());
}

function isSharedMaterial(mat) {
  return Boolean(mat?.userData?.shared);
}

/** Decode score-token PBR maps before first spawn. */
export function preloadScorePackAssets() {
  if (_mats) return Promise.resolve();
  if (_preloadPromise) return _preloadPromise;
  _preloadPromise = Promise.all(
    SCORE_TOKEN_TEX_PATHS.map((path) =>
      _loader.loadAsync(path).then((tex) => {
        _texCache.set(path, tex);
      })
    )
  )
    .then(() => {
      ensureAssets();
    })
    .catch((err) => {
      _preloadPromise = null;
      throw err;
    });
  return _preloadPromise;
}

export function getScorePackGeometry() {
  ensureAssets();
  return _geo;
}

export function getScorePackMaterials() {
  ensureAssets();
  return _mats;
}

/** @deprecated Use getScorePackMaterials() */
export function getScorePackMaterial() {
  return getScorePackMaterials();
}

function createScorePackMesh({ forPreview = false } = {}) {
  ensureAssets();
  const mesh = new THREE.Mesh(getScorePackGeometry(), cloneScorePackMaterials());
  mesh.scale.setScalar(DISK_SCALE);
  mesh.castShadow = !forPreview;
  mesh.receiveShadow = !forPreview;
  if (!forPreview) setWorldLayer(mesh);
  return mesh;
}

/** Preview-only mesh with cloned materials (safe to dispose in pickup flash UI). */
export function createScorePackPreviewMesh() {
  return createScorePackMesh({ forPreview: true });
}

function forEachScorePackMaterial(root, fn) {
  root?.traverse?.((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) fn(mat, obj);
  });
}

export function disposeScorePackPreviewMesh(mesh) {
  if (!mesh) return;
  forEachScorePackMaterial(mesh, (mat) => {
    if (mat && !isSharedMaterial(mat)) mat.dispose?.();
  });
}

/**
 * Level-placed score disk — soft drop, bob, and spin like other collectibles.
 * @param {THREE.Object3D} scene
 */
export function spawnLevelScorePackPickup(scene, x, z, floorY, value = SCORE_PACK_DEFAULT_VALUE) {
  const mesh = createScorePackMesh();
  const baseRot = getScoreTokenBaseRotation();
  mesh.position.set(x, floorY + 0.45, z);
  mesh.rotation.set(baseRot.x, baseRot.y, baseRot.z);
  scene.add(mesh);

  return {
    mesh,
    worldX: x,
    worldZ: z,
    velX: 0,
    velY: SOFT_DROP_VY,
    velZ: 0,
    floorY,
    time: 0,
    settled: false,
    settledTime: 0,
    settleBlend: 0,
    collected: false,
    value,
    type: "score",
    levelCollectible: true,
    ownMats: true,
    baseScale: DISK_SCALE,
    spinY: 0,
  };
}

function applyScorePackRotation(d) {
  if (!d?.mesh) return;
  d.mesh.rotation.set(0, d.spinY ?? 0, SCORE_DISK_EDGE_ROT_Z);
}

/** Fall → settle → bob + spin on Y (cylinder on edge, like HP power core). */
export function tickScorePackDrop(d, dt) {
  if (!d?.mesh) return;
  d.time += dt;

  if (!d.settled) {
    d.velY -= SOFT_GRAVITY * dt;
    d.mesh.position.y += d.velY * dt;
    if (d.mesh.position.y <= d.floorY + SETTLE_Y) {
      d.mesh.position.y = d.floorY + SETTLE_Y;
      if (Math.abs(d.velY) < 0.35) {
        d.velY = 0;
        d.settled = true;
        d.settledTime = d.time;
        d.settleBlend = 0;
      } else {
        d.velY *= -SOFT_BOUNCE;
      }
    }
  } else {
    d.settleBlend = Math.min(
      1,
      (d.settleBlend ?? 0) + dt * PICKUP_SETTLE_BLEND_SPEED
    );
    d.mesh.position.y = computePickupBobY(
      d.floorY,
      SETTLE_Y,
      d.time,
      d.settledTime,
      d.settleBlend
    );
  }

  d.spinY = (d.spinY ?? 0) - SCORE_SPIN_SPEED * dt;
  applyScorePackRotation(d);
  d.worldX = d.mesh.position.x;
  d.worldZ = d.mesh.position.z;
}

/** @returns {boolean} true when the mesh should be removed */
export function tickScorePackCollectFade(d, dt) {
  if (!d?.mesh || !d.collected) return false;

  const since = d.time - (d.collectTime ?? d.time);
  const fade = Math.max(0, 1 - since / 0.25);
  const base = d.baseScale ?? DISK_SCALE;
  d.mesh.scale.setScalar(base * fade);
  d.mesh.position.y += dt * 3;

  forEachScorePackMaterial(d.mesh, (mat) => {
    if (!mat) return;
    mat.transparent = true;
    mat.opacity = fade;
  });

  return fade <= 0;
}

export function disposeScorePackMesh(mesh) {
  if (!mesh) return;
  mesh.parent?.remove(mesh);
  forEachScorePackMaterial(mesh, (mat) => {
    if (mat && !isSharedMaterial(mat)) mat.dispose?.();
  });
}
