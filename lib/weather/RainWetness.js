import * as THREE from "three";
import {
  MAX_RAIN_WET_BLOCKERS,
  slabToRainWetObb,
} from "@/lib/weather/RainCanopy.js";

/** Dry → wet roughness on upward-facing pixels only. */
const WET_ROUGHNESS = 0.08;

const _normal = new THREE.Vector3();
const _quat = new THREE.Quaternion();

const RAIN_WET_INSTALLED_FLAG = "rainWetnessInstalled";
const RAIN_WET_PATCH_SIG = "if (uRainWetness > 0.001)";

/** Shared blocker uniforms — one pack per frame, all wet materials read the same data. */
const _rainWetBlockers = {
  count: { value: 0 },
  obb: {
    value: Array.from({ length: MAX_RAIN_WET_BLOCKERS }, () => new THREE.Vector4()),
  },
  rotY: { value: new Float32Array(MAX_RAIN_WET_BLOCKERS) },
  blockY: { value: new Float32Array(MAX_RAIN_WET_BLOCKERS) },
};

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

const RAIN_WET_BLOCKER_GLSL = /* glsl */ `
float rainWetHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float rainWetSdBox2(vec2 p, vec2 halfExt) {
  vec2 q = abs(p) - halfExt;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

float rainWetBlockerExposure(vec2 localD, vec2 halfExt, float bleedIn, float bleedOut, vec2 worldXZ) {
  float dist = rainWetSdBox2(localD, halfExt);
  float exposed = smoothstep(-bleedIn, bleedOut, dist);
  float edgeBand = 1.0 - abs(exposed - 0.5) * 2.0;
  exposed += (rainWetHash(worldXZ * 5.7) * 2.0 - 1.0) * 0.09 * edgeBand;
  return clamp(exposed, 0.0, 1.0);
}

float rainWetBlockerMask(vec3 worldPos) {
  if (uRainBlockCount <= 0) return 1.0;
  float exposed = 1.0;
  for (int i = 0; i < ${MAX_RAIN_WET_BLOCKERS}; i++) {
    if (i >= uRainBlockCount) break;
    if (worldPos.y >= uRainBlockY[i] - 0.35) continue;
    vec4 obb = uRainBlockOBB[i];
    float rot = uRainBlockRotY[i];
    vec2 d = worldPos.xz - obb.xy;
    if (abs(rot) > 0.001) {
      float c = cos(-rot);
      float s = sin(-rot);
      d = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
    }
    vec2 halfExt = obb.zw;
    float bleedIn = 0.62;
    float bleedOut = 0.38;
    float blockerExposed = rainWetBlockerExposure(d, halfExt, bleedIn, bleedOut, worldPos.xz);
    exposed = min(exposed, blockerExposed);
  }
  return exposed;
}
`;

/**
 * @param {import("@/lib/weather/RainCanopy.js").RainCanopySlab[]} canopySlabs
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }[]} [interiorFloorZones]
 */
export function packRainWetBlockers(canopySlabs = [], interiorFloorZones = []) {
  let i = 0;
  const { obb, rotY, blockY } = _rainWetBlockers;

  for (const slab of canopySlabs) {
    if (i >= MAX_RAIN_WET_BLOCKERS) break;
    const packed = slabToRainWetObb(slab);
    obb.value[i].set(packed.x, packed.z, packed.halfX, packed.halfZ);
    rotY.value[i] = packed.rotY;
    blockY.value[i] = slab.y ?? 999;
    i += 1;
  }

  for (const zone of interiorFloorZones) {
    if (i >= MAX_RAIN_WET_BLOCKERS) break;
    obb.value[i].set(
      (zone.minX + zone.maxX) * 0.5,
      (zone.minZ + zone.maxZ) * 0.5,
      (zone.maxX - zone.minX) * 0.5,
      (zone.maxZ - zone.minZ) * 0.5,
    );
    rotY.value[i] = 0;
    blockY.value[i] = 999;
    i += 1;
  }

  _rainWetBlockers.count.value = i;
}

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
  shader.uniforms.uRainBlockCount = _rainWetBlockers.count;
  shader.uniforms.uRainBlockOBB = _rainWetBlockers.obb;
  shader.uniforms.uRainBlockRotY = _rainWetBlockers.rotY;
  shader.uniforms.uRainBlockY = _rainWetBlockers.blockY;
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
  shader.uniforms.uRainBlockCount = _rainWetBlockers.count;
  shader.uniforms.uRainBlockOBB = _rainWetBlockers.obb;
  shader.uniforms.uRainBlockRotY = _rainWetBlockers.rotY;
  shader.uniforms.uRainBlockY = _rainWetBlockers.blockY;

  if (!shader.vertexShader.includes("varying vec3 vRainWorldNormal")) {
    shader.vertexShader = `varying vec3 vRainWorldNormal;\nvarying vec3 vRainWorldPos;\n${shader.vertexShader}`;
  }
  if (
    !shader.vertexShader.includes("vRainWorldPos =") &&
    shader.vertexShader.includes("#include <worldpos_vertex>")
  ) {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
       vRainWorldNormal = normalize(mat3(modelMatrix) * normal);
       vRainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );
  } else if (
    !shader.vertexShader.includes("vRainWorldNormal = normalize") &&
    shader.vertexShader.includes("#include <worldpos_vertex>")
  ) {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
       vRainWorldNormal = normalize(mat3(modelMatrix) * normal);
       vRainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );
  }

  if (!shader.fragmentShader.includes("uniform float uRainWetness")) {
    shader.fragmentShader =
      `uniform float uRainWetness;
       uniform int uRainBlockCount;
       uniform vec4 uRainBlockOBB[${MAX_RAIN_WET_BLOCKERS}];
       uniform float uRainBlockRotY[${MAX_RAIN_WET_BLOCKERS}];
       uniform float uRainBlockY[${MAX_RAIN_WET_BLOCKERS}];
       varying vec3 vRainWorldNormal;
       varying vec3 vRainWorldPos;
       ${RAIN_WET_BLOCKER_GLSL}
       ` + shader.fragmentShader;
  }

  if (
    shader.fragmentShader.includes("#include <color_fragment>") &&
    !shader.fragmentShader.includes(RAIN_WET_PATCH_SIG)
  ) {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `float rainWet = 0.0;
       if (uRainWetness > 0.001) {
         float rainFaceUp = smoothstep(0.38, 0.72, vRainWorldNormal.y);
         float rainExposed = rainWetBlockerMask(vRainWorldPos);
         rainWet = clamp(uRainWetness * rainFaceUp * rainExposed, 0.0, 1.0);
       }
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
    `rainWet_v14:${install.baseProgramCacheKey ? install.baseProgramCacheKey() : mat.uuid}`;

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
 * @param {{
 *   canopySlabs?: import("@/lib/weather/RainCanopy.js").RainCanopySlab[],
 *   interiorFloorZones?: { minX: number, maxX: number, minZ: number, maxZ: number }[],
 * }} [opts]
 */
export function updateRainWetness(surfaces, wetness, opts = {}) {
  const w = Math.min(1, Math.max(0, wetness));
  if (w > 0) {
    packRainWetBlockers(opts.canopySlabs ?? [], opts.interiorFloorZones ?? []);
  } else {
    _rainWetBlockers.count.value = 0;
  }
  for (const { state } of surfaces) {
    state.pendingWetness = w;
    if (state.uniform) state.uniform.value = w;
  }
}

/** @param {ReturnType<typeof collectRainWetSurfaces>} surfaces */
export function resetRainWetness(surfaces) {
  updateRainWetness(surfaces, 0);
}
