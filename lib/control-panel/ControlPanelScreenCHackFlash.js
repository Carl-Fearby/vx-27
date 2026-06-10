import * as THREE from "three";
import { applyProfileEdgeMeshUV } from "./ControlPanelProfileEdgeQuad.js";
import {
  CONTROL_PANEL_CONTAINER_BRIGHTNESS_SCALE,
  CONTROL_PANEL_ROOM_BRIGHTNESS_SCALE,
  CONTROL_PANEL_SHELTERED_BRIGHTNESS_SCALE,
} from "./ControlPanelRoomTuning.js";
import {
  applyControlPanelScreenBrightness,
  loadControlPanelScreenRotU,
  loadControlPanelScreenRotV,
  resolveControlPanelScreenBrightness,
} from "./ControlPanelScreenCTuning.js";
import {
  loadControlPanelScreenBlueBias,
  loadControlPanelScreenEmissiveIntensity,
} from "./ControlPanelEmissiveTuning.js";
import { loadControlPanelScreenHackFlashBrightness } from "./ControlPanelScreenCHackFlashTuning.js";
import {
  getControlPanelScreenCMaterial,
  isControlPanelScreenCSharedMaterial,
  SCREEN_C_TEXTURE_DIR,
} from "./ControlPanelScreenC.js";

const SCREEN_C_MESH_NAME = "control_panel_screen_c";

const HOLD_MS = 30_000;
const FADE_MS = 4_000;

const VARIANT_FILES = {
  green: {
    albedo: "screen_c_albedo_green.webp",
    emissive: "screen_c_emissive_green.webp",
  },
  red: {
    albedo: "screen_c_albedo_red.webp",
    emissive: "screen_c_emissive_red.webp",
  },
};

const EMISSIVE_TINT = {
  green: new THREE.Color(0.12, 0.92, 0.38),
  red: new THREE.Color(0.95, 0.1, 0.08),
};

const _loader = new THREE.TextureLoader();
/** @type {Promise<boolean> | null} */
let _preloadPromise = null;

/** @type {{ albedo: THREE.Texture, emissive: THREE.Texture } | null} */
let _blueMaps = null;
/** @type {Record<'green' | 'red', { albedo: THREE.Texture, emissive: THREE.Texture }>} */
const _variantMaps = { green: null, red: null };

function configureColorTex(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

async function loadVariantMaps(key) {
  const files = VARIANT_FILES[key];
  const [albedo, emissive] = await Promise.all([
    _loader.loadAsync(`${SCREEN_C_TEXTURE_DIR}${files.albedo}`),
    _loader.loadAsync(`${SCREEN_C_TEXTURE_DIR}${files.emissive}`),
  ]);
  configureColorTex(albedo);
  configureColorTex(emissive);
  return { albedo, emissive };
}

function captureBlueMapsFromDefaultMaterial() {
  const mat = getControlPanelScreenCMaterial();
  if (!mat?.map || !mat?.emissiveMap) return null;
  return { albedo: mat.map, emissive: mat.emissiveMap };
}

export function preloadControlPanelScreenCHackFlashTextures() {
  if (_preloadPromise) return _preloadPromise;
  _preloadPromise = (async () => {
    try {
      if (!getControlPanelScreenCMaterial()) {
        const { preloadControlPanelScreenCTextures } = await import(
          "./ControlPanelScreenC.js"
        );
        await preloadControlPanelScreenCTextures();
      }
      _blueMaps = captureBlueMapsFromDefaultMaterial();
      if (!_blueMaps) {
        const [albedo, emissive] = await Promise.all([
          _loader.loadAsync(`${SCREEN_C_TEXTURE_DIR}screen_c_albedo.webp`),
          _loader.loadAsync(`${SCREEN_C_TEXTURE_DIR}screen_c_emissive.webp`),
        ]);
        configureColorTex(albedo);
        configureColorTex(emissive);
        _blueMaps = { albedo, emissive };
      }
      _variantMaps.green = await loadVariantMaps("green");
      _variantMaps.red = await loadVariantMaps("red");
      return true;
    } catch (err) {
      console.warn("[control-panel] screen C hack flash textures not loaded:", err);
      _preloadPromise = null;
      return false;
    }
  })();
  return _preloadPromise;
}

/** @param {THREE.Group | null | undefined} group */
export function isControlPanelScreenCHackFlashActive(group) {
  return !!group?.userData?.controlPanelScreenHackFlash;
}

/** @param {THREE.MeshStandardMaterial | null | undefined} material */
function isHackVariantMaterial(material) {
  if (!material?.map || !_variantMaps.green) return false;
  return (
    material.map === _variantMaps.green.albedo ||
    material.map === _variantMaps.red.albedo
  );
}

/** @param {THREE.Group | null | undefined} group */
export function isControlPanelScreenCHackVariantShowing(group) {
  const mesh = getScreenMesh(group);
  return mesh?.material?.isMeshStandardMaterial
    ? isHackVariantMaterial(mesh.material)
    : false;
}

/**
 * Console cannot be hacked while flashing, previewing, or stuck on a variant.
 *
 * @param {THREE.Group | null | undefined} group
 */
export function isControlPanelScreenCHackBlocked(group) {
  if (!group) return false;
  if (group.userData?.controlPanelScreenHackFlash) return true;
  if (group.userData?.controlPanelScreenHackFlashPreview) return true;
  return isControlPanelScreenCHackVariantShowing(group);
}

/** @param {THREE.Group} group */
function getScreenMesh(group) {
  const mesh = group.children.find((c) => c.name === SCREEN_C_MESH_NAME);
  return mesh?.isMesh ? mesh : null;
}

/**
 * Outdoor panels share one material — clone before swapping maps so only this
 * console changes.
 *
 * @param {THREE.Group} group
 */
function ensureIsolatedScreenMaterial(group) {
  const mesh = getScreenMesh(group);
  if (!mesh) return null;
  if (isControlPanelScreenCSharedMaterial(mesh.material)) {
    mesh.material = mesh.material.clone();
  }
  return mesh;
}

/** @param {THREE.Group} group */
function getGroupScreenBrightnessScale(group) {
  if (group.userData?.inVx27Container) {
    return CONTROL_PANEL_CONTAINER_BRIGHTNESS_SCALE;
  }
  if (group.userData?.roomId) return CONTROL_PANEL_ROOM_BRIGHTNESS_SCALE;
  if (group.userData?.controlPanelShelteredOutdoor) {
    return CONTROL_PANEL_SHELTERED_BRIGHTNESS_SCALE;
  }
  return 1;
}

/**
 * Outdoor/sheltered tuning (34 / 30.5) is authored for deck consoles. Attached
 * rooms trim screen diffuse under point lights — same 0.15× as blue screens.
 *
 * @param {THREE.Group} group
 * @param {'green' | 'red'} outcome
 */
function resolveGroupHackFlashBrightness(group, outcome) {
  const base = loadControlPanelScreenHackFlashBrightness(outcome);
  if (group.userData?.inVx27Container) {
    const scaled = base * CONTROL_PANEL_CONTAINER_BRIGHTNESS_SCALE;
    return { brightness: scaled, emissiveBrightness: scaled };
  }
  if (group.userData?.roomId) {
    const scaled = base * CONTROL_PANEL_ROOM_BRIGHTNESS_SCALE;
    return { brightness: scaled, emissiveBrightness: scaled };
  }
  return { brightness: base, emissiveBrightness: base };
}

/**
 * @param {THREE.MeshStandardMaterial} material
 * @param {THREE.Group} group
 * @param {'green' | 'red'} outcome
 * @param {number} strength 0–1
 */
function applyHackScreenLook(material, group, outcome, strength) {
  const maps = _variantMaps[outcome];
  if (!maps) return;
  material.map = maps.albedo;
  material.emissiveMap = maps.emissive;
  const { brightness, emissiveBrightness } = resolveGroupHackFlashBrightness(
    group,
    outcome,
  );
  const emissiveScale = loadControlPanelScreenEmissiveIntensity();
  material.color.setScalar(brightness);
  material.emissive.copy(EMISSIVE_TINT[outcome]);
  material.emissiveIntensity =
    emissiveScale *
    (0.45 + emissiveBrightness * 0.4) *
    Math.max(0, strength);
  material.needsUpdate = true;
}

/** @param {THREE.Group} group @param {number} nightness */
function resolveGroupScreenBlueBrightness(group, nightness) {
  const brightnessScale = getGroupScreenBrightnessScale(group);
  const emissiveBrightness = resolveControlPanelScreenBrightness(nightness);
  return {
    brightness: emissiveBrightness * brightnessScale,
    emissiveBrightness,
  };
}

/**
 * Outdoor hack flashes clone the shared screen material — rejoin it so
 * brightness matches neighbouring consoles.
 *
 * @param {THREE.Group} group
 */
function restoreOutdoorSharedScreenMaterial(group) {
  if (group.userData?.roomId) return;

  const mesh = getScreenMesh(group);
  const sharedMat = getControlPanelScreenCMaterial();
  if (!mesh || !sharedMat || isControlPanelScreenCSharedMaterial(mesh.material)) {
    return;
  }

  const oldMat = mesh.material;
  mesh.material = sharedMat;
  if (oldMat !== sharedMat) {
    oldMat.dispose();
  }
  applyProfileEdgeMeshUV(
    mesh,
    loadControlPanelScreenRotU(),
    loadControlPanelScreenRotV(),
    sharedMat,
  );
}

/**
 * @param {THREE.Group} group
 * @param {number} nightness
 * @param {number} strength 0–1
 */
function restoreGroupBlueScreenLook(group, nightness, strength) {
  restoreOutdoorSharedScreenMaterial(group);

  const mesh = getScreenMesh(group);
  if (!mesh?.material?.isMeshStandardMaterial) return;

  if (!_blueMaps) {
    _blueMaps = captureBlueMapsFromDefaultMaterial();
  }
  if (!_blueMaps) return;

  if (!isControlPanelScreenCSharedMaterial(mesh.material)) {
    mesh.material.map = _blueMaps.albedo;
    mesh.material.emissiveMap = _blueMaps.emissive;
  }

  const { brightness, emissiveBrightness } = resolveGroupScreenBlueBrightness(
    group,
    nightness,
  );
  applyControlPanelScreenBrightness(mesh.material, {
    brightness,
    emissiveBrightness,
    emissiveIntensity: loadControlPanelScreenEmissiveIntensity(),
    blueBias: loadControlPanelScreenBlueBias(),
  });
  if (strength < 1) {
    mesh.material.emissiveIntensity *= Math.max(0, strength);
  }
  mesh.material.needsUpdate = true;
}

/**
 * @param {THREE.Group | null | undefined} group
 * @param {'success' | 'failed'} outcome
 * @param {{ holdMs?: number }} [opts]
 */
export function startControlPanelScreenCHackFlash(group, outcome, opts = {}) {
  if (!group || !_variantMaps.green || !_variantMaps.red) return;
  const mesh = ensureIsolatedScreenMaterial(group);
  if (!mesh?.material?.isMeshStandardMaterial) return;

  const variant = outcome === "success" ? "green" : "red";
  delete group.userData.controlPanelScreenHackFlashPreview;
  group.userData.controlPanelScreenHackFlash = {
    outcome: variant,
    startedAt: performance.now(),
    holdMs: opts.holdMs ?? HOLD_MS,
  };
  applyHackScreenLook(mesh.material, group, variant, 1);
}

/**
 * Dev tuning preview — does not start the timed flash cycle.
 *
 * @param {THREE.Group | null | undefined} group
 * @param {'green' | 'red' | null} outcome
 * @param {number} nightness
 */
export function setControlPanelScreenCHackFlashPreview(group, outcome, nightness) {
  if (!group) return;
  if (group.userData.controlPanelScreenHackFlash) return;

  if (outcome) {
    const mesh = ensureIsolatedScreenMaterial(group);
    if (!mesh?.material?.isMeshStandardMaterial) return;
    group.userData.controlPanelScreenHackFlashPreview = outcome;
    applyHackScreenLook(mesh.material, group, outcome, 1);
    return;
  }

  delete group.userData.controlPanelScreenHackFlashPreview;
  restoreGroupBlueScreenLook(group, nightness, 1);
}

/** @param {THREE.Group} group @param {number} nightness */
function finishControlPanelScreenCHackFlash(group, nightness) {
  restoreGroupBlueScreenLook(group, nightness, 1);
  delete group.userData.controlPanelScreenHackFlash;
  delete group.userData.controlPanelScreenHackFlashPreview;
}

/**
 * @param {THREE.Group[]} groups
 * @param {number} nightness
 */
export function clearAllControlPanelScreenCHackFlashPreviews(groups, nightness) {
  for (const group of groups) {
    if (!group?.userData?.controlPanelScreenHackFlashPreview) continue;
    setControlPanelScreenCHackFlashPreview(group, null, nightness);
  }
}

/**
 * @param {THREE.Group[]} groups
 * @param {number} nightness
 * @param {number} [now]
 */
export function updateControlPanelScreenCHackFlashes(groups, nightness, now = performance.now()) {
  for (const group of groups) {
    const flash = group.userData.controlPanelScreenHackFlash;
    if (flash) {
      const mesh = getScreenMesh(group);
      if (!mesh?.material?.isMeshStandardMaterial) {
        delete group.userData.controlPanelScreenHackFlash;
        continue;
      }

      const elapsed = now - flash.startedAt;
      const holdMs = flash.holdMs ?? HOLD_MS;
      if (elapsed < holdMs) {
        applyHackScreenLook(mesh.material, group, flash.outcome, 1);
        continue;
      }

      if (elapsed < holdMs + FADE_MS) {
        const t = (elapsed - holdMs) / FADE_MS;
        if (t < 0.5) {
          applyHackScreenLook(mesh.material, group, flash.outcome, 1 - t * 2);
        } else {
          restoreGroupBlueScreenLook(group, nightness, (t - 0.5) * 2);
        }
        continue;
      }

      finishControlPanelScreenCHackFlash(group, nightness);
      continue;
    }

    if (
      !group.userData.controlPanelScreenHackFlashPreview &&
      isControlPanelScreenCHackVariantShowing(group)
    ) {
      restoreGroupBlueScreenLook(group, nightness, 1);
    }
  }
}
