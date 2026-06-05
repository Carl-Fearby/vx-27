import * as THREE from "three";
import { setWorldLayer } from "../lighting/LightingLayers.js";
import { resolveControlPanelProfile } from "./ControlPanel.js";
import {
  applyProfileEdgeMeshUV,
  applyProfileEdgePolygonOffset,
  buildControlPanelProfileEdgeQuad,
} from "./ControlPanelProfileEdgeQuad.js";
import { loadControlPanelScreenEmissiveIntensity } from "./ControlPanelEmissiveTuning.js";
import {
  applyControlPanelScreenBrightness,
  CONTROL_PANEL_SCREEN_MIRROR_U,
  loadControlPanelScreenRotU,
  loadControlPanelScreenRotV,
} from "./ControlPanelScreenCTuning.js";

/** Profile edge C: corners 3 → 4 — monitor slope (matches dev letter C). */
export const CONTROL_PANEL_SCREEN_C_EDGE_INDEX = 2;

export const SCREEN_C_TEXTURE_DIR = "/textures/control_panel/screen_c/";

const SCREEN_C_MESH_NAME = "control_panel_screen_c";

const SCREEN_EMISSIVE_COLOR = 0x1a58ff;
const SCREEN_EMISSIVE_INTENSITY = 1.75;

const MAP_FILES = {
  albedo: "screen_c_albedo.webp",
  normal: "screen_c_normal.webp",
  roughness: "screen_c_roughness.webp",
  emissive: "screen_c_emissive.webp",
  ao: "screen_c_ao.webp",
};

const _loader = new THREE.TextureLoader();
/** @type {Promise<boolean> | null} */
let _preloadPromise = null;
/** @type {THREE.MeshStandardMaterial | null} */
let _screenMat = null;

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
  return _loader.loadAsync(`${SCREEN_C_TEXTURE_DIR}${file}`);
}

export function resetControlPanelScreenCTextureCache() {
  _screenMat?.dispose();
  _screenMat = null;
  _preloadPromise = null;
}

export function isControlPanelScreenCTexturesReady() {
  return _screenMat != null;
}

/** @returns {THREE.MeshStandardMaterial | null} */
export function getControlPanelScreenCMaterial() {
  return _screenMat;
}

/**
 * @param {number} brightness
 * @param {{ emissiveIntensity?: number, blueBias?: number }} [options]
 */
export function updateControlPanelScreenBrightness(brightness, options = {}) {
  applyControlPanelScreenBrightness(_screenMat, {
    brightness,
    ...options,
  });
}

/**
 * @param {number} rotUDeg
 * @param {number} rotVDeg
 * @param {THREE.Group[]} [groups]
 */
export function updateControlPanelScreenUVRotation(rotUDeg, rotVDeg, groups = []) {
  for (const group of groups) {
    const mesh = group.children.find((c) => c.name === SCREEN_C_MESH_NAME);
    if (mesh?.isMesh) {
      applyProfileEdgeMeshUV(mesh, rotUDeg, rotVDeg, _screenMat);
    }
  }
}

export function preloadControlPanelScreenCTextures() {
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
      _screenMat = new THREE.MeshStandardMaterial({
        map: albedo,
        color: new THREE.Color(1, 1, 1),
        normalMap: normal,
        roughnessMap: roughness,
        aoMap: ao,
        aoMapIntensity: 0.4,
        emissiveMap: emissive,
        emissive: new THREE.Color(SCREEN_EMISSIVE_COLOR),
        emissiveIntensity: SCREEN_EMISSIVE_INTENSITY,
        roughness: 0.82,
        metalness: 0,
        name: "control_panel_screen_c",
      });
      _screenMat.normalScale.set(
        CONTROL_PANEL_SCREEN_MIRROR_U ? -0.75 : 0.75,
        0.75,
      );
      _screenMat.side = THREE.DoubleSide;
      applyProfileEdgePolygonOffset(_screenMat);
      applyControlPanelScreenBrightness(_screenMat, {
        emissiveIntensity: loadControlPanelScreenEmissiveIntensity(),
      });
      return true;
    } catch (err) {
      console.warn("[control-panel] screen C textures not loaded:", err);
      _preloadPromise = null;
      return false;
    }
  })();
  return _preloadPromise;
}

export function buildControlPanelScreenCGeometry(
  profile,
  height,
  depth,
  width,
  edgeIndex = CONTROL_PANEL_SCREEN_C_EDGE_INDEX,
) {
  return buildControlPanelProfileEdgeQuad(profile, height, depth, width, edgeIndex);
}

/** @param {THREE.Material | null | undefined} material */
export function isControlPanelScreenCSharedMaterial(material) {
  return material != null && material === _screenMat;
}

/** @param {THREE.Group} group */
export function removeControlPanelScreenC(group) {
  const mesh = group.children.find((c) => c.name === SCREEN_C_MESH_NAME);
  if (!mesh) return;
  group.remove(mesh);
  mesh.geometry?.dispose();
  if (!isControlPanelScreenCSharedMaterial(mesh.material)) {
    mesh.material?.dispose?.();
  }
}

/** @param {THREE.Group} group */
export function attachControlPanelScreenC(group) {
  removeControlPanelScreenC(group);
  if (!_screenMat) return false;

  const height = group.userData.controlPanelHeight ?? 1.65;
  const depth = group.userData.controlPanelDepth ?? height * 0.62;
  const width = group.userData.controlPanelWidth ?? height * 0.46;
  const profile = resolveControlPanelProfile(group.userData.controlPanelProfile);

  const geo = buildControlPanelProfileEdgeQuad(
    profile,
    height,
    depth,
    width,
    CONTROL_PANEL_SCREEN_C_EDGE_INDEX,
  );
  const mat = group.userData?.roomId ? _screenMat.clone() : _screenMat;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = SCREEN_C_MESH_NAME;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  mesh.userData.controlPanelSurface = "C";
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

/** @param {THREE.Group} group */
export function patchControlPanelScreenCOnGroup(group) {
  return attachControlPanelScreenC(group);
}

/** @param {THREE.Group[]} groups */
export function syncControlPanelScreenC(groups) {
  if (!_screenMat) return;
  for (const group of groups) {
    attachControlPanelScreenC(group);
  }
}
