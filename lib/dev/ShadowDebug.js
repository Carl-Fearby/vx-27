import * as THREE from "three";

/** Settings → Development, or localStorage before load. Requires Start Game / reload. */
export const SHADOWS_DISABLED_KEY = "fps-shadows-disabled";
export const SHADOW_MAP_TYPE_KEY = "fps-shadow-map-type";
export const PLAIN_SHADOW_DEPTH_KEY = "fps-plain-shadow-depth";

/** @typedef {"basic" | "pcf" | "vsm"} ShadowMapTypeId */

export const SHADOW_MAP_TYPE_OPTIONS = [
  { id: "pcf", label: "PCF (default)" },
  { id: "basic", label: "Basic (hard edges)" },
  { id: "vsm", label: "VSM (variance + blur)" },
];

let _shadowsDisabled = false;

/** @type {ShadowMapTypeId} */
let _shadowMapType = readStoredShadowMapType();

let _plainShadowDepth =
  typeof window !== "undefined" &&
  localStorage.getItem(PLAIN_SHADOW_DEPTH_KEY) === "true";

function readStoredShadowMapType() {
  if (typeof window === "undefined") return "pcf";
  const raw = localStorage.getItem(SHADOW_MAP_TYPE_KEY);
  if (raw === "basic" || raw === "vsm" || raw === "pcf") return raw;
  return "pcf";
}

export function loadShadowsDisabled() {
  return _shadowsDisabled;
}

export function areShadowsDisabled() {
  return _shadowsDisabled;
}

export function setShadowsDisabledRuntime(disabled) {
  _shadowsDisabled = disabled === true;
  if (typeof window !== "undefined") {
    localStorage.setItem(SHADOWS_DISABLED_KEY, String(_shadowsDisabled));
  }
}

/** @returns {ShadowMapTypeId} */
export function loadShadowMapType() {
  return _shadowMapType;
}

/** @param {ShadowMapTypeId} type */
export function setShadowMapTypeRuntime(type) {
  _shadowMapType =
    type === "basic" || type === "vsm" || type === "pcf" ? type : "pcf";
  if (typeof window !== "undefined") {
    localStorage.setItem(SHADOW_MAP_TYPE_KEY, _shadowMapType);
  }
}

export function loadPlainShadowDepthEnabled() {
  return _plainShadowDepth;
}

export function arePlainShadowDepthEnabled() {
  return _plainShadowDepth;
}

export function setPlainShadowDepthRuntime(enabled) {
  _plainShadowDepth = enabled === true;
  if (typeof window !== "undefined") {
    localStorage.setItem(PLAIN_SHADOW_DEPTH_KEY, String(_plainShadowDepth));
  }
}

/** @param {THREE.WebGLRenderer | null | undefined} renderer */
export function applyShadowMapTypeToRenderer(renderer) {
  if (!renderer?.shadowMap) return;
  switch (_shadowMapType) {
    case "basic":
      renderer.shadowMap.type = THREE.BasicShadowMap;
      break;
    case "vsm":
      renderer.shadowMap.type = THREE.VSMShadowMap;
      break;
    case "pcf":
    default:
      renderer.shadowMap.type = THREE.PCFShadowMap;
      break;
  }
}

export function enableRendererShadowPipeline(renderer) {
  if (!renderer?.shadowMap) return;
  renderer.shadowMap.enabled = true;
  applyShadowMapTypeToRenderer(renderer);
  renderer.shadowMap.autoUpdate = false;
}

/**
 * Hard off — shadow map plus every cast/receive flag under `root`.
 * @param {THREE.WebGLRenderer | null | undefined} renderer
 * @param {THREE.Object3D | null | undefined} root
 */
export function disableAllShadows(renderer, root) {
  if (renderer?.shadowMap) {
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.needsUpdate = false;
  }
  if (!root) return;
  root.traverse((obj) => {
    if (obj.isLight) obj.castShadow = false;
    if (obj.isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });
}
