import * as THREE from "three";
import { WORLD_LAYER } from "../lighting/LightingLayers.js";
import { normalizeToxicOilSpillTuning } from "./ToxicOilSpillTuning.js";

export const TOXIC_OIL_SPILL_GROUP_NAME = "toxic_oil_spill";

const TEX_ROOT = "/textures/toxic_oil_spill";
const TEX_FILES = {
  basecolor: "basecolor.png",
  normal: "normal.png",
  roughness: "roughness.png",
  metallic: "metallic.png",
  opacity: "opacity.png",
  emissive: "emissive.png",
  ao: "ao.png",
};

const _loader = new THREE.TextureLoader();
/** @type {Promise<Record<string, THREE.Texture>> | null} */
let _preloadPromise = null;

/**
 * @typedef {{
 *   group: THREE.Group,
 *   mesh: THREE.Mesh,
 * }} ToxicOilSpillState
 */

function configureColorTex(tex, maxAnisotropy = 8) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function configureDataTex(tex, maxAnisotropy = 8) {
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** @param {number} [maxAnisotropy] */
export function preloadToxicOilSpillTextures(maxAnisotropy = 8) {
  if (_preloadPromise) return _preloadPromise;
  _preloadPromise = Promise.all(
    Object.entries(TEX_FILES).map(async ([key, file]) => {
      const url = `${TEX_ROOT}/${file}`;
      const tex = await _loader.loadAsync(url);
      if (key === "basecolor" || key === "emissive") {
        configureColorTex(tex, maxAnisotropy);
      } else {
        configureDataTex(tex, maxAnisotropy);
      }
      return [key, tex];
    }),
  ).then((entries) => Object.fromEntries(entries));
  return _preloadPromise;
}

/** @returns {THREE.MeshStandardMaterial} */
function createPlaceholderMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x1a2418,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
}

/**
 * @param {THREE.MeshStandardMaterial} material
 * @param {Record<string, THREE.Texture>} maps
 * @param {ToxicOilSpillTuning} tuning
 */
function applyMapsToMaterial(material, maps, tuning) {
  const n = normalizeToxicOilSpillTuning(tuning);
  material.map = maps.basecolor ?? null;
  material.normalMap = maps.normal ?? null;
  material.roughnessMap = maps.roughness ?? null;
  material.metalnessMap = maps.metallic ?? null;
  material.aoMap = maps.ao ?? null;
  material.emissiveMap = maps.emissive ?? null;
  material.alphaMap = maps.opacity ?? null;
  material.emissive = new THREE.Color(0xffffff);
  material.emissiveIntensity = n.emissiveIntensity;
  material.opacity = n.opacity;
  material.transparent = true;
  material.depthWrite = false;
  material.roughness = 1;
  material.metalness = 1;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -4;
  material.polygonOffsetUnits = -4;
  material.needsUpdate = true;
}

/**
 * @param {ToxicOilSpillState} state
 * @param {number} floorY
 * @param {ToxicOilSpillTuning} tuning
 */
export function applyToxicOilSpillTuning(state, floorY, tuning) {
  if (!state?.group || !state.mesh) return;
  const n = normalizeToxicOilSpillTuning(tuning);
  state.group.position.set(n.x, floorY + n.yOffset, n.z);
  state.group.rotation.y = n.rotationY;
  state.mesh.scale.set(n.scaleX, n.scaleZ, 1);
  const mat = state.mesh.material;
  if (mat?.isMeshStandardMaterial) {
    mat.emissiveIntensity = n.emissiveIntensity;
    mat.opacity = n.opacity;
    mat.needsUpdate = true;
  }
}

/**
 * @param {THREE.Object3D} parent
 * @param {number} floorY
 * @param {ToxicOilSpillTuning} tuning
 * @param {{ maxAnisotropy?: number }} [opts]
 * @returns {ToxicOilSpillState}
 */
export function createToxicOilSpill(parent, floorY, tuning, opts = {}) {
  const maxAnisotropy = opts.maxAnisotropy ?? 8;
  const group = new THREE.Group();
  group.name = TOXIC_OIL_SPILL_GROUP_NAME;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    createPlaceholderMaterial(),
  );
  mesh.name = "toxic_oil_spill_mesh";
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  mesh.layers.disableAll();
  mesh.layers.enable(WORLD_LAYER);

  group.add(mesh);
  parent.add(group);

  const state = { group, mesh };
  applyToxicOilSpillTuning(state, floorY, tuning);

  void preloadToxicOilSpillTextures(maxAnisotropy).then((maps) => {
    if (!mesh.parent) return;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
    });
    applyMapsToMaterial(mat, maps, tuning);
    const oldMat = mesh.material;
    mesh.material = mat;
    oldMat?.dispose?.();
  });

  return state;
}

/** @param {ToxicOilSpillState | null | undefined} state */
export function disposeToxicOilSpill(state) {
  if (!state?.group) return;
  state.group.parent?.remove(state.group);
  state.mesh?.geometry?.dispose?.();
  state.mesh?.material?.dispose?.();
}
