import * as THREE from "three";
import { arePlainShadowDepthEnabled } from "../dev/ShadowDebug.js";

/** Meshes whose shadow cast hooks were installed by this module (not occluders/pickups). */
const HYGIENE_FLAG = "shadowCastHygiene";

/** Per-mesh depth material — shared Three.js depth mats pick up stale alphaMap refs. */
function createShadowDepthMaterial() {
  const depthMat = new THREE.MeshDepthMaterial();
  depthMat.depthTest = true;
  depthMat.depthWrite = true;
  return depthMat;
}

function materialNeedsAlphaShadowCutout(material) {
  if (!material) return false;
  return (
    Boolean(material.alphaMap) ||
    Boolean(material.map && material.alphaTest > 0) ||
    material.alphaToCoverage === true ||
    Boolean(material.displacementMap && material.displacementScale !== 0)
  );
}

function meshCastsAlphaShadow(mesh) {
  if (!mesh?.isMesh || !mesh.castShadow) return false;
  const { material } = mesh;
  if (!material) return false;
  if (Array.isArray(material)) {
    return material.some(materialNeedsAlphaShadowCutout);
  }
  return materialNeedsAlphaShadowCutout(material);
}

function clearHygieneOnBeforeShadow(mesh) {
  if (!mesh.userData.shadowHygieneOnBeforeShadow) return;
  delete mesh.onBeforeShadow;
  delete mesh.userData.shadowHygieneOnBeforeShadow;
}

function disposeMeshShadowDepthMaterial(mesh) {
  if (!mesh.userData[HYGIENE_FLAG]) return;

  if (mesh.userData.plainShadowDepthMat) {
    mesh.userData.plainShadowDepthMat.dispose?.();
    delete mesh.userData.plainShadowDepthMat;
  }
  if (mesh.userData.shadowDepthMaterial) {
    mesh.userData.shadowDepthMaterial.dispose?.();
    delete mesh.userData.shadowDepthMaterial;
  }

  mesh.customDepthMaterial = undefined;
  clearHygieneOnBeforeShadow(mesh);
  delete mesh.userData[HYGIENE_FLAG];
}

/**
 * Ensure alpha-cutout casters use an isolated depth material so the shadow pass
 * never binds another mesh's albedo/alpha texture on a shared depth slot.
 * @param {THREE.Mesh} mesh
 */
export function attachShadowCastHygiene(mesh) {
  if (!mesh?.isMesh || !mesh.castShadow) return;

  if (arePlainShadowDepthEnabled()) {
    if (meshCastsAlphaShadow(mesh)) {
      mesh.userData[HYGIENE_FLAG] = true;
      clearHygieneOnBeforeShadow(mesh);
      if (!mesh.userData.plainShadowDepthMat) {
        mesh.userData.plainShadowDepthMat = createShadowDepthMaterial();
      }
      mesh.customDepthMaterial = mesh.userData.plainShadowDepthMat;
    } else if (mesh.userData[HYGIENE_FLAG]) {
      disposeMeshShadowDepthMaterial(mesh);
    }
    return;
  }

  if (!meshCastsAlphaShadow(mesh)) {
    if (mesh.userData[HYGIENE_FLAG]) {
      disposeMeshShadowDepthMaterial(mesh);
    }
    return;
  }

  mesh.userData[HYGIENE_FLAG] = true;

  if (!mesh.customDepthMaterial || !mesh.userData.shadowDepthMaterial) {
    if (mesh.userData.plainShadowDepthMat) {
      mesh.userData.plainShadowDepthMat.dispose?.();
      delete mesh.userData.plainShadowDepthMat;
    }
    const depthMat = createShadowDepthMaterial();
    mesh.customDepthMaterial = depthMat;
    mesh.userData.shadowDepthMaterial = depthMat;
  }

  mesh.onBeforeShadow = () => {
    const depthMat = mesh.customDepthMaterial;
    if (!depthMat) return;
    const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!source) {
      depthMat.alphaMap = null;
      depthMat.map = null;
      depthMat.alphaTest = 0;
      depthMat.displacementMap = null;
      return;
    }
    depthMat.alphaMap = source.alphaMap ?? null;
    depthMat.map = source.map && source.alphaTest > 0 ? source.map : null;
    depthMat.alphaTest = source.alphaToCoverage === true ? 0.5 : source.alphaTest ?? 0;
    depthMat.displacementMap = source.displacementMap ?? null;
    depthMat.displacementScale = source.displacementScale ?? 0;
    depthMat.displacementBias = source.displacementBias ?? 0;
  };
  mesh.userData.shadowHygieneOnBeforeShadow = true;
}

/** @param {THREE.Object3D} root */
export function applyShadowCastHygiene(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.isMesh) attachShadowCastHygiene(obj);
  });
}

/** Re-apply hygiene after shadow experiment toggles — only touches hygiene-managed meshes. */
export function resetAndApplyShadowCastHygiene(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.isMesh && obj.userData[HYGIENE_FLAG]) {
      disposeMeshShadowDepthMaterial(obj);
    }
  });
  applyShadowCastHygiene(root);
}
