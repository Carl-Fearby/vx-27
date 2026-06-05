import * as THREE from "three";
import { setWorldLayer } from "../lighting/LightingLayers.js";
import { resolveControlPanelProfile } from "./ControlPanel.js";
import {
  applyProfileEdgeMeshUV,
  applyProfileEdgePolygonOffset,
  buildControlPanelProfileEdgeQuad,
} from "./ControlPanelProfileEdgeQuad.js";
import { loadControlPanelPanelEmissiveIntensity } from "./ControlPanelEmissiveTuning.js";
import { applyControlPanelShelfDBrightness } from "./ControlPanelShelfDTuning.js";
import {
  loadControlPanelScreenRotU,
  loadControlPanelScreenRotV,
  CONTROL_PANEL_SCREEN_MIRROR_U,
} from "./ControlPanelScreenCTuning.js";

/** Profile edge D: corners 4 → 5 — shelf top (matches dev letter D). */
export const CONTROL_PANEL_SHELF_D_EDGE_INDEX = 3;

export const SHELF_D_TEXTURE_DIR = "/textures/control_panel/shelf_d/";

const SHELF_D_MESH_NAME = "control_panel_shelf_d";

const SHELF_EMISSIVE_COLOR = 0x1a58ff;
const SHELF_EMISSIVE_INTENSITY = 1.75;

const MAP_FILES = {
  albedo: "shelf_d_albedo.webp",
  normal: "shelf_d_normal.webp",
  roughness: "shelf_d_roughness.webp",
  emissive: "shelf_d_emissive.webp",
  ao: "shelf_d_ao.webp",
};

const _loader = new THREE.TextureLoader();
/** @type {Promise<boolean> | null} */
let _preloadPromise = null;
/** @type {THREE.MeshStandardMaterial | null} */
let _shelfMat = null;

function configureColorTex(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function configureDataTex(tex) {
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

async function loadTex(file) {
  return _loader.loadAsync(`${SHELF_D_TEXTURE_DIR}${file}`);
}

export function resetControlPanelShelfDTextureCache() {
  _shelfMat?.dispose();
  _shelfMat = null;
  _preloadPromise = null;
}

export function isControlPanelShelfDTexturesReady() {
  return _shelfMat != null;
}

/** @returns {THREE.MeshStandardMaterial | null} */
export function getControlPanelShelfDMaterial() {
  return _shelfMat;
}

/**
 * @param {number} brightness
 * @param {{ emissiveIntensity?: number, blueBias?: number }} [options]
 */
export function updateControlPanelShelfDBrightness(brightness, options = {}) {
  applyControlPanelShelfDBrightness(_shelfMat, {
    brightness,
    ...options,
  });
}

/**
 * @param {number} rotUDeg
 * @param {number} rotVDeg
 * @param {THREE.Group[]} [groups]
 */
export function updateControlPanelShelfDUVRotation(rotUDeg, rotVDeg, groups = []) {
  for (const group of groups) {
    const mesh = group.children.find((c) => c.name === SHELF_D_MESH_NAME);
    if (mesh?.isMesh) {
      applyProfileEdgeMeshUV(mesh, rotUDeg, rotVDeg, _shelfMat);
    }
  }
}

export function preloadControlPanelShelfDTextures() {
  if (_preloadPromise) return _preloadPromise;
  _preloadPromise = (async () => {
    try {
      const [albedo, normal, roughness, emissive, ao] = await Promise.all([
        loadTex(MAP_FILES.albedo),
        loadTex(MAP_FILES.normal),
        loadTex(MAP_FILES.roughness),
        loadTex(MAP_FILES.emissive),
        loadTex(MAP_FILES.ao),
      ]);
      configureColorTex(albedo);
      configureDataTex(normal);
      configureDataTex(roughness);
      configureColorTex(emissive);
      configureDataTex(ao);
      _shelfMat = new THREE.MeshStandardMaterial({
        map: albedo,
        color: new THREE.Color(1, 1, 1),
        normalMap: normal,
        roughnessMap: roughness,
        aoMap: ao,
        aoMapIntensity: 0.4,
        emissiveMap: emissive,
        emissive: new THREE.Color(SHELF_EMISSIVE_COLOR),
        emissiveIntensity: SHELF_EMISSIVE_INTENSITY,
        roughness: 0.82,
        metalness: 0,
        name: "control_panel_shelf_d",
      });
      _shelfMat.normalScale.set(
        CONTROL_PANEL_SCREEN_MIRROR_U ? -0.75 : 0.75,
        0.75,
      );
      _shelfMat.side = THREE.DoubleSide;
      applyProfileEdgePolygonOffset(_shelfMat);
      applyControlPanelShelfDBrightness(_shelfMat, {
        emissiveIntensity: loadControlPanelPanelEmissiveIntensity(),
      });
      return true;
    } catch (err) {
      console.warn("[control-panel] shelf D textures not loaded:", err);
      _preloadPromise = null;
      return false;
    }
  })();
  return _preloadPromise;
}

/** @param {THREE.Material | null | undefined} material */
export function isControlPanelShelfDSharedMaterial(material) {
  return material != null && material === _shelfMat;
}

/** @param {THREE.Group} group */
export function removeControlPanelShelfD(group) {
  const mesh = group.children.find((c) => c.name === SHELF_D_MESH_NAME);
  if (!mesh) return;
  group.remove(mesh);
  mesh.geometry?.dispose();
  if (!isControlPanelShelfDSharedMaterial(mesh.material)) {
    mesh.material?.dispose?.();
  }
}

/** @param {THREE.Group} group */
export function attachControlPanelShelfD(group) {
  removeControlPanelShelfD(group);
  if (!_shelfMat) return false;

  const height = group.userData.controlPanelHeight ?? 1.65;
  const depth = group.userData.controlPanelDepth ?? height * 0.62;
  const width = group.userData.controlPanelWidth ?? height * 0.46;
  const profile = resolveControlPanelProfile(group.userData.controlPanelProfile);

  const geo = buildControlPanelProfileEdgeQuad(
    profile,
    height,
    depth,
    width,
    CONTROL_PANEL_SHELF_D_EDGE_INDEX,
  );
  const mat = group.userData?.roomId ? _shelfMat.clone() : _shelfMat;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = SHELF_D_MESH_NAME;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.userData.controlPanelSurface = "D";
  setWorldLayer(mesh);
  group.add(mesh);
  applyProfileEdgeMeshUV(
    mesh,
    loadControlPanelScreenRotU(),
    loadControlPanelScreenRotV(),
    mat,
  );
  return true;
}
