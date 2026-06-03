import * as THREE from "three";

/** Settings → Development, or localStorage before load. Requires Start Game / reload. */
export const TEXTURES_DISABLED_KEY = "fps-textures-disabled";

let _texturesDisabled =
  typeof window !== "undefined" &&
  localStorage.getItem(TEXTURES_DISABLED_KEY) === "true";

/** Shared flat material — scene.overrideMaterial skips all map sampling. */
const _flatOverrideMaterial = new THREE.MeshLambertMaterial({
  color: 0x888888,
  flatShading: false,
});

export function loadTexturesDisabled() {
  return _texturesDisabled;
}

export function areTexturesDisabled() {
  return _texturesDisabled;
}

export function setTexturesDisabledRuntime(disabled) {
  _texturesDisabled = disabled === true;
  if (typeof window !== "undefined") {
    localStorage.setItem(TEXTURES_DISABLED_KEY, String(_texturesDisabled));
  }
}

/**
 * Replace every mesh material with a flat grey Lambert (no maps).
 * @param {THREE.Scene | null | undefined} scene
 * @param {boolean} disabled
 */
export function applyTextureOverride(scene, disabled) {
  if (!scene) return;
  scene.overrideMaterial = disabled ? _flatOverrideMaterial : null;
}
