import * as THREE from "three";

/** Tiled PBR for hull sides A,B,E–J and end caps K,L (not C/D overlays). */
export const HULL_TEXTURE_DIR = "/textures/control_panel/hull/";

const MAP_FILES = {
  albedo: "hull_albedo.webp",
  normal: "hull_normal.webp",
  roughness: "hull_roughness.webp",
  metallic: "hull_metallic.webp",
  emissive: "hull_emissive.webp",
  ao: "hull_ao.webp",
};

const HULL_EMISSIVE_COLOR = 0x4da8ff;
const HULL_EMISSIVE_INTENSITY = 0.45;

const _loader = new THREE.TextureLoader();
/** @type {Promise<boolean> | null} */
let _preloadPromise = null;
/** @type {THREE.MeshStandardMaterial | null} */
let _hullMat = null;
/** @type {THREE.MeshStandardMaterial | null} */
let _sideGreyMat = null;

function configureClampColorTex(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1, 1);
  tex.offset.set(0, 0);
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function configureClampDataTex(tex) {
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1, 1);
  tex.offset.set(0, 0);
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

async function loadTex(file) {
  return _loader.loadAsync(`${HULL_TEXTURE_DIR}${file}`);
}

export function getSideGreyMaterial() {
  if (!_sideGreyMat) {
    _sideGreyMat = new THREE.MeshStandardMaterial({
      color: 0x5c6470,
      roughness: 0.58,
      metalness: 0.42,
      name: "control_panel_body_grey",
    });
  }
  return _sideGreyMat;
}

export function resetControlPanelBodyTextureCache() {
  _hullMat?.dispose();
  _hullMat = null;
  _preloadPromise = null;
}

export function isControlPanelBodyTexturesReady() {
  return _hullMat != null;
}

/** Shared by hull edge quads and end caps. */
export function getControlPanelHullBodyMaterial() {
  return _hullMat;
}

/**
 * [cap textured, extruded sides grey — hull quads cover A,B,E–J].
 * @returns {[THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]}
 */
export function getControlPanelHullMaterials() {
  if (!_hullMat) {
    throw new Error("control panel hull textures not loaded");
  }
  return [_hullMat, getSideGreyMaterial()];
}

export function preloadControlPanelBodyTextures() {
  if (_preloadPromise) return _preloadPromise;
  _preloadPromise = (async () => {
    try {
      const [albedo, normal, roughness, metallic, emissive, ao] =
        await Promise.all([
          loadTex(MAP_FILES.albedo),
          loadTex(MAP_FILES.normal),
          loadTex(MAP_FILES.roughness),
          loadTex(MAP_FILES.metallic),
          loadTex(MAP_FILES.emissive),
          loadTex(MAP_FILES.ao),
        ]);
      configureClampColorTex(albedo);
      configureClampColorTex(emissive);
      configureClampDataTex(normal);
      configureClampDataTex(roughness);
      configureClampDataTex(metallic);
      configureClampDataTex(ao);

      _hullMat = new THREE.MeshStandardMaterial({
        map: albedo,
        color: new THREE.Color(1, 1, 1),
        normalMap: normal,
        roughnessMap: roughness,
        metalnessMap: metallic,
        aoMap: ao,
        emissiveMap: emissive,
        emissive: new THREE.Color(HULL_EMISSIVE_COLOR),
        emissiveIntensity: HULL_EMISSIVE_INTENSITY,
        aoMapIntensity: 0.5,
        roughness: 0.72,
        metalness: 0.28,
        name: "control_panel_hull",
      });
      _hullMat.normalScale.set(-0.85, 0.85);
      return true;
    } catch (err) {
      console.warn("[control-panel] hull textures not loaded:", err);
      _preloadPromise = null;
      return false;
    }
  })();
  return _preloadPromise;
}
