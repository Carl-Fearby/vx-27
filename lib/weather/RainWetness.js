import * as THREE from "three";

/** Dry → wet roughness on upward-facing pixels only. */
const WET_ROUGHNESS = 0.08;

const _normal = new THREE.Vector3();
const _quat = new THREE.Quaternion();

const RAIN_WET_INSTALLED_FLAG = "rainWetnessInstalled";
const RAIN_WET_PATCH_SIG = "float rainWet = clamp(uRainWetness * rainFaceUp";

/**
 * @typedef {{
 *   uniform: { value: number } | null,
 *   pendingWetness: number,
 * }} RainWetState
 */

/**
 * @typedef {{
 *   state: RainWetState,
 *   baseOnBeforeCompile: ((shader: object, renderer: THREE.WebGLRenderer) => void) | null,
 *   baseProgramCacheKey: (() => string) | null,
 * }} RainWetInstall
 */

/** @type {WeakMap<THREE.MeshStandardMaterial, RainWetInstall>} */
const _rainWetInstallByMaterial = new WeakMap();

/**
 * @param {object} shader
 * @param {RainWetState} state
 */
function reconnectRainWetUniform(shader, state) {
  if (!shader.uniforms.uRainWetness) {
    shader.uniforms.uRainWetness = { value: state.pendingWetness ?? 0 };
  }
  state.uniform = shader.uniforms.uRainWetness;
  if (state.pendingWetness > 0) {
    state.uniform.value = state.pendingWetness;
  }
}

/**
 * @param {object} shader
 * @returns {boolean}
 */
function isRainWetShaderPatched(shader) {
  return shader.fragmentShader.includes(RAIN_WET_PATCH_SIG);
}

/**
 * @param {object} shader
 * @param {RainWetState} state
 */
function patchRainWetnessShader(shader, state) {
  if (isRainWetShaderPatched(shader)) {
    reconnectRainWetUniform(shader, state);
    return;
  }

  const wetness = state.pendingWetness ?? state.uniform?.value ?? 0;
  shader.uniforms.uRainWetness = { value: wetness };
  state.uniform = shader.uniforms.uRainWetness;

  if (!shader.vertexShader.includes("varying vec3 vRainWorldNormal")) {
    shader.vertexShader = `varying vec3 vRainWorldNormal;\n${shader.vertexShader}`;
  }
  if (
    !shader.vertexShader.includes("vRainWorldNormal = normalize") &&
    shader.vertexShader.includes("#include <worldpos_vertex>")
  ) {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
       vRainWorldNormal = normalize(mat3(modelMatrix) * normal);`
    );
  }

  if (!shader.fragmentShader.includes("uniform float uRainWetness")) {
    shader.fragmentShader =
      `uniform float uRainWetness;\nvarying vec3 vRainWorldNormal;\n` +
      shader.fragmentShader;
  }

  if (
    shader.fragmentShader.includes("#include <color_fragment>") &&
    !shader.fragmentShader.includes(RAIN_WET_PATCH_SIG)
  ) {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `float rainFaceUp = smoothstep(0.38, 0.72, vRainWorldNormal.y);
       float rainWet = clamp(uRainWetness * rainFaceUp, 0.0, 1.0);
       #include <color_fragment>`
    );
  }

  if (
    shader.fragmentShader.includes("#include <roughnessmap_fragment>") &&
    !shader.fragmentShader.includes(
      `mix(roughnessFactor, ${WET_ROUGHNESS.toFixed(4)}, rainWet)`
    )
  ) {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
       roughnessFactor = mix(roughnessFactor, ${WET_ROUGHNESS.toFixed(4)}, rainWet);`
    );
  }
}

/**
 * @param {THREE.MeshStandardMaterial} mat
 * @param {RainWetInstall} install
 */
function bindRainWetCompileHandler(mat, install) {
  mat.customProgramCacheKey = () =>
    `rainWet_v10:${install.baseProgramCacheKey ? install.baseProgramCacheKey() : mat.uuid}`;

  /** @param {object} shader @param {THREE.WebGLRenderer} renderer */
  const handler = (shader, renderer) => {
    install.baseOnBeforeCompile?.(shader, renderer);
    patchRainWetnessShader(shader, install.state);
  };
  handler.__rainWetCompile = true;
  mat.onBeforeCompile = handler;
  mat.needsUpdate = true;
}

/**
 * @param {THREE.MeshStandardMaterial} mat
 */
function installRainWetnessMaterial(mat) {
  let install = _rainWetInstallByMaterial.get(mat);
  if (install) {
    return { material: mat, state: install.state };
  }

  const legacyInstalled = !!mat.userData[RAIN_WET_INSTALLED_FLAG];
  const alreadyWrapped = !!mat.onBeforeCompile?.__rainWetCompile;

  install = {
    state: { uniform: null, pendingWetness: 0 },
    baseOnBeforeCompile: legacyInstalled || alreadyWrapped
      ? null
      : (mat.onBeforeCompile ?? null),
    baseProgramCacheKey:
      legacyInstalled || alreadyWrapped
        ? null
        : (mat.customProgramCacheKey?.bind(mat) ?? null),
  };
  _rainWetInstallByMaterial.set(mat, install);
  mat.userData[RAIN_WET_INSTALLED_FLAG] = true;
  bindRainWetCompileHandler(mat, install);

  return { material: mat, state: install.state };
}

/** @param {THREE.Object3D} obj */
function isRainWetMesh(obj) {
  if (obj.userData.arenaCatwalkDeck) return true;
  if (obj.userData.roomCatwalkDeck) return true;
  if (obj.userData.rainWetSurface) return true;
  if (obj.userData.stairWalkTread) return true;
  if (obj.userData.arenaFloorExtension) return true;
  if (obj.userData.arenaCeiling && obj.receiveShadow) return true;

  obj.getWorldQuaternion(_quat);
  _normal.set(0, 1, 0).applyQuaternion(_quat);
  return _normal.y > 0.92;
}

/**
 * @param {THREE.Object3D | null | undefined} root
 * @returns {{ material: THREE.MeshStandardMaterial, state: RainWetState }[]}
 */
export function collectRainWetSurfaces(root) {
  /** @type {ReturnType<typeof collectRainWetSurfaces>} */
  const entries = [];
  const seen = new Set();

  if (!root) return entries;

  root.updateWorldMatrix(true, true);
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mat = obj.material;
    if (!mat?.isMeshStandardMaterial || !mat.map) return;

    if (obj.userData.controlPanelSurface) return;
    if (obj.userData.isHorizontalShadowBlocker) return;
    if (obj.userData.isShadowOccluder) return;
    if (obj.userData.arenaDoorwayWall) return;
    if (obj.userData.floorExtensionWall) return;
    if (obj.userData.arenaPillarId) return;
    if (obj.userData.bulletHole) return;

    let underContainer = false;
    let underRoomInterior = false;
    let p = obj.parent;
    while (p) {
      if (p.userData?.controlPanel) return;
      if (p.userData?.containerInterior) underContainer = true;
      if (p.userData?.roomInterior) underRoomInterior = true;
      p = p.parent;
    }
    if (underContainer) return;
    if (
      underRoomInterior &&
      !obj.userData.roomCatwalkDeck &&
      !obj.userData.arenaCatwalkDeck
    ) {
      return;
    }

    if (!isRainWetMesh(obj)) return;

    if (seen.has(mat)) return;
    seen.add(mat);
    entries.push(installRainWetnessMaterial(mat));
  });

  return entries;
}

/**
 * @param {ReturnType<typeof collectRainWetSurfaces>} surfaces
 * @param {THREE.Object3D | null | undefined} root
 */
export function mergeRainWetSurfaces(surfaces, root) {
  const seen = new Set(surfaces.map((entry) => entry.material));
  for (const entry of collectRainWetSurfaces(root)) {
    if (seen.has(entry.material)) continue;
    seen.add(entry.material);
    surfaces.push(entry);
  }
  return surfaces;
}

/**
 * @param {ReturnType<typeof collectRainWetSurfaces>} surfaces
 * @param {number} wetness
 */
export function updateRainWetness(surfaces, wetness) {
  const w = Math.min(1, Math.max(0, wetness));
  for (const { state } of surfaces) {
    state.pendingWetness = w;
    if (state.uniform) state.uniform.value = w;
  }
}

/** @param {ReturnType<typeof collectRainWetSurfaces>} surfaces */
export function resetRainWetness(surfaces) {
  updateRainWetness(surfaces, 0);
}
