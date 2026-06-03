import * as THREE from "three";

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

/**
 * Ensure alpha-cutout casters use an isolated depth material so the shadow pass
 * never binds another mesh's albedo/alpha texture on a shared depth slot.
 * @param {THREE.Mesh} mesh
 */
export function attachShadowCastHygiene(mesh) {
  if (!meshCastsAlphaShadow(mesh)) return;

  if (!mesh.customDepthMaterial) {
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
}

/** @param {THREE.Object3D} root */
export function applyShadowCastHygiene(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.isMesh) attachShadowCastHygiene(obj);
  });
}
