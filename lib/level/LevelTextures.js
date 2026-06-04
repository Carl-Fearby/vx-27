import * as THREE from "three";

const TEXTURE_ROOT = "/textures";

/** @typedef {{ map: THREE.Texture, normalMap: THREE.Texture, roughnessMap: THREE.Texture, tileSizeMeters: number }} TextureSet */

/** Default tile size (meters) per material folder id. */
export const TEXTURE_TILE_SIZES = {
  ground_concrete_asphalt_dirty: 4,
  wall_poured_concrete_industrial: 4,
  wall_corrugated_metal_weathered: 3,
  ground_smooth_concrete_worn: 3,
  wall_blue_cinderblock_worn: 3.2,
  decal_hazard_stripes_worn: 2,
  floor_metal_grate_rusty: 2,
};

/** Normal strength — placeholders need a boost to read under sun + point lights. */
const NORMAL_SCALE = 1.15;

/**
 * Set texture offset on all maps of a MeshStandardMaterial.
 * @param {THREE.MeshStandardMaterial} mat
 * @param {number} u
 * @param {number} v
 */
export function setMaterialOffset(mat, u, v) {
  for (const tex of [mat.map, mat.normalMap, mat.roughnessMap]) {
    if (tex) tex.offset.set(u, v);
  }
}

function configureTileTexture(texture, repeatU, repeatV, colorSpace, anisotropy) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatU, repeatV);
  texture.colorSpace = colorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

async function loadTextureSet(loader, materialId, tileSizeMeters, anisotropy) {
  const base = `${TEXTURE_ROOT}/${materialId}`;
  const [map, normalMap, roughnessMap] = await Promise.all([
    loader.loadAsync(`${base}/${materialId}_albedo_tileable.webp`),
    loader.loadAsync(`${base}/${materialId}_normal_placeholder.webp`),
    loader.loadAsync(`${base}/${materialId}_roughness_placeholder.webp`),
  ]);

  map.colorSpace = THREE.SRGBColorSpace;
  normalMap.colorSpace = THREE.LinearSRGBColorSpace;
  roughnessMap.colorSpace = THREE.LinearSRGBColorSpace;

  for (const tex of [map, normalMap, roughnessMap]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = anisotropy;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
  }

  return { map, normalMap, roughnessMap, tileSizeMeters };
}

/**
 * @param {number} [maxAnisotropy]
 * @param {string[]} [materialIds]
 */
export async function loadLevelTextureLibrary(maxAnisotropy = 4, materialIds) {
  const loader = new THREE.TextureLoader();
  const aniso = Math.max(1, maxAnisotropy);
  const ids = materialIds?.length
    ? materialIds
    : Object.keys(TEXTURE_TILE_SIZES);
  const sets = {};

  try {
    for (const materialId of ids) {
      const tileSizeMeters =
        TEXTURE_TILE_SIZES[materialId] ?? 4;
      sets[materialId] = await loadTextureSet(
        loader,
        materialId,
        tileSizeMeters,
        aniso
      );
    }
  } catch (err) {
    console.warn("Level textures failed to load:", err);
    return null;
  }

  const clonedTextures = [];
  /** @type {THREE.Texture[]} Base + tiled clones — safe to pass to renderer.initTexture(). */
  const gpuUploadTextures = [];
  for (const set of Object.values(sets)) {
    gpuUploadTextures.push(set.map, set.normalMap, set.roughnessMap);
  }

  /**
   * @param {string} materialId Folder name under /public/textures
   * @param {number} repeatU
   * @param {number} repeatV
   */
  function createTiled(materialId, repeatU, repeatV) {
    const set = sets[materialId];
    if (!set) {
      return new THREE.MeshStandardMaterial({ color: 0x888888 });
    }

    const map = set.map.clone();
    const normalMap = set.normalMap.clone();
    const roughnessMap = set.roughnessMap.clone();
    clonedTextures.push(map, normalMap, roughnessMap);
    gpuUploadTextures.push(map, normalMap, roughnessMap);

    configureTileTexture(map, repeatU, repeatV, THREE.SRGBColorSpace, aniso);
    configureTileTexture(
      normalMap,
      repeatU,
      repeatV,
      THREE.LinearSRGBColorSpace,
      aniso
    );
    configureTileTexture(
      roughnessMap,
      repeatU,
      repeatV,
      THREE.LinearSRGBColorSpace,
      aniso
    );

    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      roughnessMap,
      roughness: 1,
      metalness: 0,
    });
    if (mat.normalMap) {
      mat.normalScale.set(NORMAL_SCALE, NORMAL_SCALE);
    }
    return mat;
  }

  return {
    createTiled,
    gpuUploadTextures,
    tileSize(materialId) {
      return sets[materialId]?.tileSizeMeters ?? TEXTURE_TILE_SIZES[materialId] ?? 4;
    },
    dispose() {
      for (const set of Object.values(sets)) {
        set.map.dispose();
        set.normalMap.dispose();
        set.roughnessMap.dispose();
      }
      for (const tex of clonedTextures) tex.dispose();
    },
  };
}

/** Push level texture library images into GPU memory during the load screen. */
export function initLevelTexturesOnGpu(renderer, library) {
  if (!library?.gpuUploadTextures) return;
  if (!renderer || typeof renderer.initTexture !== "function") return;
  for (const tex of library.gpuUploadTextures) {
    if (tex?.isTexture) renderer.initTexture(tex);
  }
}
