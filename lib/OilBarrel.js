import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  ROOM_INTERIOR_LAYER,
  setRoomInteriorLayer,
  setWorldLayer,
  WORLD_LAYER,
} from "./LightingLayers.js";
import {
  ensureOilBarrelInteriorVideo,
  createOilBarrelInteriorVideoMesh,
  applyBarrelInteriorVideoSeed,
  getOilBarrelInteriorVideoMaterial,
  refreshOilBarrelInteriorVideoLayout,
  tickOilBarrelInteriorVideo,
} from "./OilBarrelInteriorVideo.js";
import {
  addOilBarrelFireLight,
  barrelFireFlickerSeedFromPropId,
  collectOilBarrelFireLights,
  refreshOilBarrelFireLights,
} from "./OilBarrelFireLight.js";
import {
  loadOilBarrelTuning,
  normalizeOilBarrelTuning,
} from "./OilBarrelTuning.js";
import {
  OIL_BARREL_HEIGHT,
  OIL_BARREL_RADIUS,
  OIL_BARREL_PLAYER_STAND_EYE,
} from "./OilBarrelDimensions.js";

export { OIL_BARREL_HEIGHT, OIL_BARREL_RADIUS } from "./OilBarrelDimensions.js";

export {
  ensureOilBarrelInteriorVideo,
  tickOilBarrelInteriorVideo,
  collectOilBarrelFireLights,
};

/** Standing eye height — barrel height is ~half of this. */
export const PLAYER_STAND_EYE = OIL_BARREL_PLAYER_STAND_EYE;
/** Enough for a 0.3 m prop; lower = fewer verts (wall + merged rims). */
export const OIL_BARREL_RADIAL_SEGMENTS = 20;
/** Rounded rim where the cylinder wall meets the flat end caps. */
const RIM_BEVEL = Math.min(0.038, OIL_BARREL_RADIUS * 0.11);
/** Nudge end caps off the lathe rim so coplanar faces do not z-fight. */
const CAP_SURFACE_OFFSET = 0.002;
/** Inset for interior oil skin (inside the metal wall / rim). */
const INTERIOR_INSET = 0.014;
/** Interior wall maps tile twice around the cylinder (U). */
const INTERIOR_WALL_TILE_U = 2;
const INTERIOR_WALL_TILE_V = 1;

const TEX_ROOT = "/textures/oil_barrel";
const INSIDE_TEX_ROOT = "/textures/oil_barrel/inside";

/** Runtime paths (WebP — regenerate via scripts/optimize-oil-barrel-textures.mjs). */
const EXTERIOR_TEX_FILES = {
  bodyAlbedo: "barrel_body_albedo.webp",
  bodyNormal: "barrel_body_normal.webp",
  bodyEmissive: "barrel_body_emissive.webp",
  topAlbedo: "barrel_top_endcap_albedo.webp",
  topNormal: "barrel_top_endcap_normal.webp",
  bottomAlbedo: "barrel_bottom_endcap_albedo.webp",
  bottomNormal: "barrel_bottom_endcap_normal.webp",
};

const INTERIOR_TEX_FILES = {
  wallAlbedo: "barrel_inside_wall_albedo.webp",
  wallNormal: "barrel_inside_wall_normal.webp",
  wallOrm: "barrel_inside_wall_orm.webp",
  floorAlbedo: "barrel_inside_floor_albedo.webp",
  floorNormal: "barrel_inside_floor_normal.webp",
  floorOrm: "barrel_inside_floor_orm.webp",
};

const _loader = new THREE.TextureLoader();
/** @type {import("./OilBarrelTuning.js").OilBarrelTuning} */
let _tuning = loadOilBarrelTuning();
/** @type {Record<string, THREE.Texture> | null} */
let _tex = null;
/** @type {{
 *   wallAlbedo: THREE.Texture,
 *   wallNormal: THREE.Texture,
 *   wallOrm: THREE.Texture,
 *   floorAlbedo: THREE.Texture,
 *   floorNormal: THREE.Texture,
 *   floorOrm: THREE.Texture,
 * } | null} */
let _insideTex = null;
let _bodyMat = null;
let _topMat = null;
let _bottomMat = null;
/** @type {THREE.MeshStandardMaterial | null} */
let _oilSurfaceMat = null;
/** @type {THREE.MeshStandardMaterial | null} */
let _oilInteriorWallMat = null;
let _preloadPromise = null;
/** @type {Map<string, THREE.Texture>} */
const _capAlbedoCache = new Map();
/** Configured map instances (one GPU upload per map, no per-material clone). */
let _configuredExteriorMaps = null;

function configureColorTex(tex, repeatU, repeatV, wrap = THREE.RepeatWrapping) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.repeat.set(repeatU, repeatV);
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function configureDataTex(tex, repeatU, repeatV, wrap = THREE.RepeatWrapping) {
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.repeat.set(repeatU, repeatV);
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function applyBrightness(mat, brightness, tuning) {
  mat.color.setRGB(
    brightness,
    brightness * tuning.warmth,
    brightness * tuning.blueTint
  );
  mat.roughness = tuning.roughness;
  mat.metalness = 0;
}

function applyBodySurface(mat, tuning = _tuning) {
  applyBrightness(mat, tuning.bodyBrightness, tuning);
  mat.emissiveIntensity = tuning.emissiveIntensity;
  if (mat.normalScale) {
    mat.normalScale.set(tuning.normalScale, tuning.normalScale);
  }
}

function applyCapSurface(mat, tuning = _tuning) {
  applyBrightness(mat, tuning.capBrightness, tuning);
  if (mat.normalScale) {
    mat.normalScale.set(tuning.capNormalScale, tuning.capNormalScale);
  }
}

/**
 * @param {string | null | undefined} roomId
 * @returns {THREE.MeshStandardMaterial}
 */
function resolveExteriorMaterial(roomId) {
  const base = ensureBodyMaterial();
  if (!roomId) return base;
  const mat = base.clone();
  applyBodySurface(mat);
  mat.emissiveIntensity = _tuning.emissiveIntensity * ROOM_BARREL_EMISSIVE_SCALE;
  return mat;
}

/**
 * @param {"top" | "bottom"} which
 * @param {string | null | undefined} roomId
 * @returns {THREE.MeshStandardMaterial | null}
 */
function resolveCapMaterial(which, roomId) {
  const base = which === "top" ? _topMat : _bottomMat;
  if (!base || !_tex) return base;
  if (!roomId) return base;
  const mat = base.clone();
  applyCapAlbedoMap(
    mat,
    _tex[which === "top" ? "topAlbedo" : "bottomAlbedo"],
    _tuning
  );
  applyCapSurface(mat, {
    ..._tuning,
    capBrightness: _tuning.capBrightness * ROOM_CAP_BRIGHTNESS_SCALE,
  });
  mat.emissiveIntensity = 0;
  return mat;
}

/** @param {THREE.Object3D} [root] */
function refreshRoomBarrelSurfaceMaterials(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material?.isMeshStandardMaterial) return;
    let barrel = obj;
    while (barrel && barrel.name !== "oil_barrel") barrel = barrel.parent;
    const roomId = barrel?.userData?.roomId;
    if (!roomId) return;

    if (BARREL_EXTERIOR_MESH_NAMES.has(obj.name)) {
      const mat = obj.material;
      if (obj.name === "oil_barrel_cap_top" || obj.name === "oil_barrel_cap_bottom") {
        applyCapSurface(mat, {
          ..._tuning,
          capBrightness: _tuning.capBrightness * ROOM_CAP_BRIGHTNESS_SCALE,
        });
        mat.emissiveIntensity = 0;
      } else {
        applyBodySurface(mat);
        mat.emissiveIntensity = _tuning.emissiveIntensity * ROOM_BARREL_EMISSIVE_SCALE;
      }
    }
  });
}

/**
 * Bakes albedo contrast in software (1 = unchanged). Avoids re-exporting endcap PNGs.
 * @param {THREE.Texture} sourceTex
 * @param {number} contrast
 */
function getCapAlbedoTexture(sourceTex, contrast) {
  const cacheKey = `${sourceTex.uuid}|${contrast.toFixed(3)}`;
  const cached = _capAlbedoCache.get(cacheKey);
  if (cached) return cached;

  const wrap = THREE.ClampToEdgeWrapping;
  if (contrast === 1) {
    const clone = configureColorTex(sourceTex.clone(), 1, 1, wrap);
    _capAlbedoCache.set(cacheKey, clone);
    return clone;
  }

  const image = sourceTex.image;
  if (!image?.width || !image?.height) {
    const fallback = configureColorTex(sourceTex.clone(), 1, 1, wrap);
    _capAlbedoCache.set(cacheKey, fallback);
    return fallback;
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = configureColorTex(sourceTex.clone(), 1, 1, wrap);
    _capAlbedoCache.set(cacheKey, fallback);
    return fallback;
  }

  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const n = data[i + c] / 255;
      data[i + c] = Math.round(
        Math.min(255, Math.max(0, ((n - 0.5) * contrast + 0.5) * 255))
      );
    }
  }
  ctx.putImageData(pixels, 0, 0);

  const tex = configureColorTex(new THREE.CanvasTexture(canvas), 1, 1, wrap);
  tex.needsUpdate = true;
  _capAlbedoCache.set(cacheKey, tex);
  return tex;
}

/** @param {THREE.MeshStandardMaterial} mat @param {THREE.Texture} sourceAlbedo */
function applyCapAlbedoMap(mat, sourceAlbedo, tuning = _tuning) {
  mat.map = getCapAlbedoTexture(sourceAlbedo, tuning.capContrast);
  mat.needsUpdate = true;
}

function refreshCapMaterials(tuning = _tuning) {
  if (!_tex || !_topMat || !_bottomMat) return;
  applyCapAlbedoMap(_topMat, _tex.topAlbedo, tuning);
  applyCapAlbedoMap(_bottomMat, _tex.bottomAlbedo, tuning);
  applyCapSurface(_topMat, tuning);
  applyCapSurface(_bottomMat, tuning);
}

/** @param {THREE.Texture} tex @param {number} degrees @param {number} tileU */
function applyInteriorWallTextureRotation(tex, degrees, tileU = INTERIOR_WALL_TILE_U) {
  const deg = ((degrees % 360) + 360) % 360;
  tex.repeat.set(tileU, INTERIOR_WALL_TILE_V);
  tex.offset.x = (deg / 360) * tileU;
  tex.needsUpdate = true;
}

/** @param {THREE.MeshStandardMaterial} mat @param {number} degrees */
function applyInteriorWallMaterialRotation(mat, degrees) {
  const maps = [
    mat.map,
    mat.normalMap,
    mat.aoMap,
    mat.roughnessMap,
    mat.metalnessMap,
  ].filter(Boolean);
  const seen = new Set();
  for (const tex of maps) {
    if (seen.has(tex.uuid)) continue;
    seen.add(tex.uuid);
    applyInteriorWallTextureRotation(tex, degrees);
  }
}

/** @param {import("./OilBarrelTuning.js").OilBarrelTuning} [tuning] */
function applyInteriorTextureRotation(tuning = _tuning) {
  const deg = tuning.interiorTextureRotation ?? 0;
  if (_oilInteriorWallMat) {
    applyInteriorWallMaterialRotation(_oilInteriorWallMat, deg);
  }
}

/**
 * Lit by room point lights in attached rooms. Flame video uses ROOM layer when
 * `roomId` is set so the interior pass draws it after room shell geometry.
 */
const BARREL_INTERIOR_ROOM_MESH_NAMES = new Set([
  "oil_interior_wall",
  "oil_interior_bottom",
]);

const BARREL_BODY_MESH_NAMES = new Set([
  "oil_barrel_exterior",
  "oil_barrel_wall",
  "oil_barrel_rim_top",
  "oil_barrel_rim_bottom",
]);

const BARREL_EXTERIOR_MESH_NAMES = new Set([
  ...BARREL_BODY_MESH_NAMES,
  "oil_barrel_cap_top",
  "oil_barrel_cap_bottom",
]);

/** Room barrels: emissive reads as self-lit in the world pass — pull down to match candle-lit metal. */
const ROOM_BARREL_EMISSIVE_SCALE = 0.08;
/** End caps only drew on WORLD (outdoor pass) in rooms — also dim albedo vs arena barrels. */
const ROOM_CAP_BRIGHTNESS_SCALE = 0.42;

/**
 * Re-bind wall + rim meshes to the shared body material (e.g. after texture load).
 * @param {THREE.Object3D} [root]
 */
export function syncOilBarrelBodyMaterials(root) {
  if (!_bodyMat) return;
  applyBodySurface(_bodyMat, _tuning);
  if (!root) return;
  root.traverse((obj) => {
    if (obj.isMesh && BARREL_BODY_MESH_NAMES.has(obj.name)) {
      obj.material = _bodyMat;
    }
  });
}

/** @param {import("./OilBarrelTuning.js").OilBarrelTuning} [tuning] @param {THREE.Object3D} [root] */
export function   refreshOilBarrelMaterials(tuning = _tuning, root) {
  _tuning = normalizeOilBarrelTuning(tuning);
  syncOilBarrelBodyMaterials(root);
  refreshCapMaterials(_tuning);
  applyInteriorTextureRotation(_tuning);
  if (root) {
    refreshRoomBarrelSurfaceMaterials(root);
    refreshOilBarrelInteriorVideoLayout(root, _tuning);
    refreshOilBarrelFireLights(root, _tuning);
    refreshOilBarrelRenderLayers(root);
  }
}

/** Re-apply WORLD/ROOM layers + render order after hot reload. */
export function refreshOilBarrelRenderLayers(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.name !== "oil_barrel" || !obj.isGroup) return;
    applyBarrelRenderLayers(obj, obj.userData?.roomId ?? null);
  });
}

/**
 * Strip legacy plume / flames group and ensure a single interior video mesh.
 * @param {THREE.Object3D} root
 */
export function ensureOilBarrelFlameMeshes(root) {
  if (!getOilBarrelInteriorVideoMaterial() || _tuning.interiorFire === false) {
    return;
  }
  root.traverse((obj) => {
    if (obj.name !== "oil_barrel" || !obj.isGroup) return;
    const ud = obj.userData;
    if (
      ud.innerRadius == null ||
      ud.floorY == null ||
      ud.clipTopY == null
    ) {
      return;
    }
    if (ud.interiorFire === false) {
      return;
    }

    const remove = [];
    obj.traverse((child) => {
      if (
        child.name === "oil_interior_plume" ||
        child.name === "oil_interior_flames"
      ) {
        remove.push(child);
      }
    });
    for (const node of remove) {
      node.parent?.remove(node);
    }

    let hasVideo = false;
    obj.traverse((child) => {
      if (child.name === "oil_interior_video" && child.isMesh) {
        hasVideo = true;
        applyBarrelInteriorVideoSeed(child, _tuning, ud.fireFlickerSeed ?? 0);
      }
    });
    if (hasVideo) {
      applyBarrelRenderLayers(obj, ud.roomId ?? null);
      return;
    }

    const video = createOilBarrelInteriorVideoMesh(
      ud.innerRadius,
      ud.innerWallHeight,
      ud.floorY,
      ud.clipTopY,
      _tuning,
      ud.fireFlickerSeed ?? 0
    );
    if (video) {
      obj.add(video);
      applyBarrelRenderLayers(obj, ud.roomId ?? null);
    }
  });
}

/** @returns {import("./OilBarrelTuning.js").OilBarrelTuning} */
export function getOilBarrelTuning() {
  return { ..._tuning };
}

/**
 * Burn hazard — horizontal gap from the barrel cylinder wall (not center / fire light).
 * Only {@link isOilBarrelBurning} barrels apply damage.
 */
export const OIL_BARREL_FIRE_PROXIMITY_EDGE_CLEARANCE = 0.65;
export const OIL_BARREL_FIRE_PROXIMITY_DAMAGE = 10;
export const OIL_BARREL_FIRE_PROXIMITY_INTERVAL = 1;

const _barrelWorldPos = new THREE.Vector3();
const _barrelFootBox = new THREE.Box3();
let _fireProximityDamageCooldown = 0;

/** @param {THREE.Object3D} barrelGroup */
export function isOilBarrelBurning(barrelGroup) {
  if (!barrelGroup || barrelGroup.name !== "oil_barrel") return false;
  let burning = false;
  barrelGroup.traverse((child) => {
    if (child.name === "oil_interior_video" && child.visible) burning = true;
  });
  return burning;
}

/**
 * Horizontal distance from player XZ to the barrel cylinder wall (0 = touching the mesh).
 *
 * @param {THREE.Object3D} barrelGroup
 * @param {THREE.Vector3} playerPos
 */
function horizontalDistanceToBarrelEdge(barrelGroup, playerPos) {
  barrelGroup.getWorldPosition(_barrelWorldPos);
  const toCenter = Math.hypot(
    playerPos.x - _barrelWorldPos.x,
    playerPos.z - _barrelWorldPos.z
  );
  return Math.max(0, toCenter - OIL_BARREL_RADIUS);
}

/**
 * {@link OIL_BARREL_FIRE_PROXIMITY_DAMAGE} HP while within
 * {@link OIL_BARREL_FIRE_PROXIMITY_EDGE_CLEARANCE} of a burning barrel's outer wall
 * (at most once per {@link OIL_BARREL_FIRE_PROXIMITY_INTERVAL}s). Closed / unlit barrels
 * never hurt. Returns whether damage applies this frame.
 *
 * @param {THREE.Object3D} root
 * @param {THREE.Vector3} playerPos Player XZ used (typically camera position).
 * @param {number} dt
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning} [tuning]
 */
export function tickOilBarrelFireProximityDamage(root, playerPos, dt, tuning = _tuning) {
  if (!root || tuning?.interiorFire === false) return false;

  _fireProximityDamageCooldown = Math.max(0, _fireProximityDamageCooldown - dt);
  if (_fireProximityDamageCooldown > 0) return false;

  let inRange = false;
  root.traverse((obj) => {
    if (inRange || obj.name !== "oil_barrel") return;
    if (!isOilBarrelBurning(obj)) return;
    if (
      horizontalDistanceToBarrelEdge(obj, playerPos) <=
      OIL_BARREL_FIRE_PROXIMITY_EDGE_CLEARANCE
    ) {
      inRange = true;
    }
  });

  if (!inRange) return false;
  _fireProximityDamageCooldown = OIL_BARREL_FIRE_PROXIMITY_INTERVAL;
  return true;
}

/** @param {THREE.Object3D} root */
function refreshOilBarrelExteriorGeometries(root) {
  const h = OIL_BARREL_HEIGHT;
  const r = OIL_BARREL_RADIUS;
  const segments = OIL_BARREL_RADIAL_SEGMENTS;
  const { bevel, halfHeight: hh } = rimDimensions(r, h, RIM_BEVEL);
  const wallHeight = h - 2 * bevel;
  const geo = getBarrelExteriorMergedGeo(
    r,
    wallHeight,
    bevel,
    hh,
    segments,
    _tuning.rimTileU,
    _tuning.rimTileV
  );
  root.traverse((obj) => {
    if (obj.isMesh && obj.name === "oil_barrel_exterior") {
      obj.geometry = geo;
    }
  });
}

/** @param {Partial<import("./OilBarrelTuning.js").OilBarrelTuning>} patch @param {THREE.Object3D} [root] */
export function setOilBarrelTuning(patch, root) {
  const prevRimU = _tuning.rimTileU;
  const prevRimV = _tuning.rimTileV;
  refreshOilBarrelMaterials({ ..._tuning, ...patch }, root);
  if (
    root &&
    (patch.rimTileU !== undefined || patch.rimTileV !== undefined) &&
    (_tuning.rimTileU !== prevRimU || _tuning.rimTileV !== prevRimV)
  ) {
    refreshOilBarrelExteriorGeometries(root);
  }
}

/** Placeholder or textured body material — wall and rims share this instance. */
function ensureBodyMaterial() {
  if (!_bodyMat) {
    _bodyMat = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    });
    applyBodySurface(_bodyMat);
  }
  return _bodyMat;
}

function ensureConfiguredExteriorMaps() {
  if (_configuredExteriorMaps || !_tex) return _configuredExteriorMaps;
  const capWrap = THREE.ClampToEdgeWrapping;
  _configuredExteriorMaps = {
    bodyMap: configureColorTex(_tex.bodyAlbedo, 1, 1),
    bodyNormal: configureDataTex(_tex.bodyNormal, 1, 1),
    bodyEmissive: configureColorTex(_tex.bodyEmissive, 1, 1),
    topNormal: configureDataTex(_tex.topNormal, 1, 1, capWrap),
    bottomNormal: configureDataTex(_tex.bottomNormal, 1, 1, capWrap),
  };
  return _configuredExteriorMaps;
}

function makeBodyMaterial() {
  const maps = ensureConfiguredExteriorMaps();
  const mat = ensureBodyMaterial();
  if (maps) {
    mat.map = maps.bodyMap;
    mat.normalMap = maps.bodyNormal;
    mat.emissiveMap = maps.bodyEmissive;
  }
  mat.emissive = new THREE.Color(0xffaa44);
  mat.side = THREE.DoubleSide;
  applyBodySurface(mat);
  return mat;
}

function makeCapMaterial(tex, maps) {
  const configured = ensureConfiguredExteriorMaps();
  const wrap = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshStandardMaterial({
    normalMap:
      maps.normal === "topNormal"
        ? configured?.topNormal
        : configured?.bottomNormal,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  if (!mat.normalMap) {
    mat.normalMap = configureDataTex(tex[maps.normal].clone(), 1, 1, wrap);
  }
  applyCapAlbedoMap(mat, tex[maps.albedo], _tuning);
  applyCapSurface(mat);
  return mat;
}

/** @param {THREE.Texture} ormTex ORM: R=AO, G=roughness, B=metallic */
function assignOrmMaps(mat, ormTex, repeatU, repeatV) {
  const orm = configureDataTex(ormTex.clone(), repeatU, repeatV, THREE.ClampToEdgeWrapping);
  mat.aoMap = orm;
  mat.roughnessMap = orm;
  mat.metalnessMap = orm;
  mat.aoMapIntensity = 1;
}

/** @type {{ wallMap: THREE.Texture, wallNormal: THREE.Texture, wallOrm: THREE.Texture, floorMap: THREE.Texture, floorNormal: THREE.Texture, floorOrm: THREE.Texture } | null} */
let _configuredInteriorMaps = null;

function ensureConfiguredInteriorMaps() {
  if (_configuredInteriorMaps || !_insideTex) return _configuredInteriorMaps;
  const wrap = THREE.ClampToEdgeWrapping;
  _configuredInteriorMaps = {
    wallMap: configureColorTex(
      _insideTex.wallAlbedo,
      INTERIOR_WALL_TILE_U,
      INTERIOR_WALL_TILE_V
    ),
    wallNormal: configureDataTex(
      _insideTex.wallNormal,
      INTERIOR_WALL_TILE_U,
      INTERIOR_WALL_TILE_V
    ),
    wallOrm: configureDataTex(
      _insideTex.wallOrm,
      INTERIOR_WALL_TILE_U,
      INTERIOR_WALL_TILE_V
    ),
    floorMap: configureColorTex(_insideTex.floorAlbedo, 1, 1, wrap),
    floorNormal: configureDataTex(_insideTex.floorNormal, 1, 1, wrap),
    floorOrm: configureDataTex(_insideTex.floorOrm, 1, 1, wrap),
  };
  return _configuredInteriorMaps;
}

/** @param {NonNullable<typeof _insideTex>} tex */
function makeInteriorWallMaterial(tex) {
  const maps = ensureConfiguredInteriorMaps();
  const mat = new THREE.MeshStandardMaterial({
    map: maps?.wallMap ?? configureColorTex(tex.wallAlbedo.clone(), INTERIOR_WALL_TILE_U, INTERIOR_WALL_TILE_V),
    normalMap:
      maps?.wallNormal ??
      configureDataTex(tex.wallNormal.clone(), INTERIOR_WALL_TILE_U, INTERIOR_WALL_TILE_V),
    side: THREE.BackSide,
  });
  if (maps) {
    mat.aoMap = maps.wallOrm;
    mat.roughnessMap = maps.wallOrm;
    mat.metalnessMap = maps.wallOrm;
    mat.aoMapIntensity = 1;
  } else {
    assignOrmMaps(mat, tex.wallOrm, INTERIOR_WALL_TILE_U, INTERIOR_WALL_TILE_V);
  }
  return mat;
}

/** @param {NonNullable<typeof _insideTex>} tex */
function makeInteriorFloorMaterial(tex) {
  const maps = ensureConfiguredInteriorMaps();
  const wrap = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshStandardMaterial({
    map: maps?.floorMap ?? configureColorTex(tex.floorAlbedo.clone(), 1, 1, wrap),
    normalMap:
      maps?.floorNormal ?? configureDataTex(tex.floorNormal.clone(), 1, 1, wrap),
    transparent: true,
    alphaTest: 0.35,
    depthWrite: true,
  });
  if (maps) {
    mat.aoMap = maps.floorOrm;
    mat.roughnessMap = maps.floorOrm;
    mat.metalnessMap = maps.floorOrm;
    mat.aoMapIntensity = 1;
  } else {
    assignOrmMaps(mat, tex.floorOrm, 1, 1);
  }
  return mat;
}

function buildOilInteriorMaterials() {
  if (_insideTex) {
    _oilInteriorWallMat = makeInteriorWallMaterial(_insideTex);
    _oilSurfaceMat = makeInteriorFloorMaterial(_insideTex);
    return;
  }

  const base = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x06060a),
    roughness: 0.09,
    metalness: 0.78,
    envMapIntensity: 1.15,
  });
  _oilSurfaceMat = base;
  _oilInteriorWallMat = base.clone();
  _oilInteriorWallMat.side = THREE.BackSide;
}

function buildMaterials() {
  if (!_tex) return;

  ensureConfiguredExteriorMaps();
  _bodyMat = makeBodyMaterial();
  _topMat = makeCapMaterial(_tex, {
    albedo: "topAlbedo",
    normal: "topNormal",
  });
  _bottomMat = makeCapMaterial(_tex, {
    albedo: "bottomAlbedo",
    normal: "bottomNormal",
  });
  buildOilInteriorMaterials();
  refreshOilBarrelMaterials(_tuning);
}

function ensureOilInteriorMaterials() {
  if (_oilSurfaceMat && _oilInteriorWallMat) return;
  buildOilInteriorMaterials();
}

const _wallGeoCache = new Map();
const _rimGeoCache = new Map();
const _exteriorGeoCache = new Map();
const _capDiskGeoCache = new Map();

/**
 * @param {number} radius
 * @param {number} height
 * @param {number} bevel
 */
function rimDimensions(radius, height, bevel) {
  const hh = height / 2;
  const b = Math.min(bevel, radius * 0.2, hh * 0.45);
  return { bevel: b, capR: radius - b, wallHeight: height - 2 * b, halfHeight: hh };
}

/**
 * Quarter-circle fillet from the cylinder lip to the cap edge (local +Y = toward cap).
 * @param {number} radius
 * @param {number} bevel
 * @param {1 | -1} towardCap
 * @param {number} filletSteps
 */
function buildRimFilletProfile(radius, bevel, towardCap, filletSteps = 4) {
  const b = Math.min(bevel, radius * 0.2);
  const capR = radius - b;
  const sign = towardCap === 1 ? 1 : -1;
  const profile = [new THREE.Vector2(radius, 0)];

  for (let i = 1; i <= filletSteps; i++) {
    const angle = (i / filletSteps) * (Math.PI / 2);
    profile.push(
      new THREE.Vector2(
        capR + b * Math.cos(angle),
        sign * b * Math.sin(angle)
      )
    );
  }

  return profile;
}

/** @param {number} radius @param {number} wallHeight @param {number} segments */
function getWallCylinderGeo(radius, wallHeight, segments) {
  const key = `${radius}|${wallHeight}|${segments}`;
  let geo = _wallGeoCache.get(key);
  if (!geo) {
    geo = new THREE.CylinderGeometry(radius, radius, wallHeight, segments, 1, true);
    _wallGeoCache.set(key, geo);
  }
  return geo;
}

/**
 * Rim lathe UVs continue the open cylinder wall (same 1×1 body map).
 * Lip sits at wall V=0 (bottom) or V=1 (top); fillet extends a short span in V.
 *
 * @param {THREE.BufferGeometry} geo
 * @param {number} wallHeight
 * @param {1 | -1} towardCap
 * @param {number} radialSegments
 * @param {number} profilePointCount
 * @param {number} [rimTileU]
 * @param {number} [rimTileV]
 */
function applyRimWallAlignedUVs(
  geo,
  wallHeight,
  towardCap,
  radialSegments,
  profilePointCount,
  rimTileU = 1,
  rimTileV = 1
) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const wallEdgeV = towardCap === 1 ? 1 : 0;

  for (let i = 0; i < pos.count; i++) {
    const phiIndex = Math.floor(i / profilePointCount);
    const u = (phiIndex / radialSegments) * rimTileU;
    const y = pos.getY(i);
    const delta = y / wallHeight;
    const v = wallEdgeV + delta * rimTileV;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

/**
 * @param {number} radius
 * @param {number} bevel
 * @param {1 | -1} towardCap
 * @param {number} segments
 * @param {number} wallHeight
 * @param {number} rimTileU
 * @param {number} rimTileV
 */
function getRimFilletGeo(
  radius,
  bevel,
  towardCap,
  segments,
  wallHeight,
  rimTileU,
  rimTileV
) {
  const profile = buildRimFilletProfile(radius, bevel, towardCap);
  const key = `${radius}|${bevel}|${towardCap}|${segments}|${wallHeight}|${rimTileU}|${rimTileV}`;
  let geo = _rimGeoCache.get(key);
  if (!geo) {
    geo = new THREE.LatheGeometry(profile, segments);
    applyRimWallAlignedUVs(
      geo,
      wallHeight,
      towardCap,
      segments,
      profile.length,
      rimTileU,
      rimTileV
    );
    _rimGeoCache.set(key, geo);
  }
  return geo;
}

/**
 * Wall + both rims as one draw call (same body material / UVs).
 * @param {number} radius
 * @param {number} wallHeight
 * @param {number} bevel
 * @param {number} halfHeight
 * @param {number} segments
 * @param {number} rimTileU
 * @param {number} rimTileV
 */
function getBarrelExteriorMergedGeo(
  radius,
  wallHeight,
  bevel,
  halfHeight,
  segments,
  rimTileU,
  rimTileV
) {
  const hh = halfHeight;
  const key = `ext|${radius}|${wallHeight}|${bevel}|${hh}|${segments}|${rimTileU}|${rimTileV}`;
  let geo = _exteriorGeoCache.get(key);
  if (!geo) {
    const wall = getWallCylinderGeo(radius, wallHeight, segments);
    const bottomRim = getRimFilletGeo(
      radius,
      bevel,
      -1,
      segments,
      wallHeight,
      rimTileU,
      rimTileV
    ).clone();
    bottomRim.translate(0, -hh + bevel, 0);
    const topRim = getRimFilletGeo(
      radius,
      bevel,
      1,
      segments,
      wallHeight,
      rimTileU,
      rimTileV
    ).clone();
    topRim.translate(0, hh - bevel, 0);
    const merged = mergeGeometries([wall, bottomRim, topRim], false);
    if (!merged) {
      return wall;
    }
    merged.computeVertexNormals();
    geo = merged;
    _exteriorGeoCache.set(key, geo);
  }
  return geo;
}

/** @param {number} capRadius @param {number} segments */
function getCapDiskGeo(capRadius, segments) {
  const key = `${capRadius}|${segments}`;
  let geo = _capDiskGeoCache.get(key);
  if (!geo) {
    geo = new THREE.CircleGeometry(capRadius, segments);
    _capDiskGeoCache.set(key, geo);
  }
  return geo;
}

/**
 * @param {number} innerRadius
 * @param {number} wallHeight
 * @param {number} halfHeight
 * @param {number} bevel
 * @param {number} segments
 */
function addOpenBarrelOilInterior(
  group,
  innerRadius,
  wallHeight,
  halfHeight,
  bevel,
  segments,
  roomId = null,
  tuning = _tuning
) {
  ensureOilInteriorMaterials();
  if (!_oilSurfaceMat || !_oilInteriorWallMat) return;

  const hh = halfHeight;
  const floorY = -hh + bevel + 0.003;
  const diskR = innerRadius * 0.992;
  /** Lip where the exterior cylinder meets the top rim; interior wall runs up to here. */
  const topLipY = hh - bevel;
  const innerTopY = topLipY + bevel - 0.002;
  const innerWallHeight = innerTopY - floorY;
  const innerWallCenterY = (innerTopY + floorY) * 0.5;

  const innerWall = new THREE.Mesh(
    getWallCylinderGeo(innerRadius, innerWallHeight, segments),
    _oilInteriorWallMat
  );
  innerWall.name = "oil_interior_wall";
  innerWall.position.y = innerWallCenterY;

  const innerBottom = new THREE.Mesh(
    getCapDiskGeo(diskR, segments),
    _oilSurfaceMat
  );
  innerBottom.name = "oil_interior_bottom";
  innerBottom.rotation.x = -Math.PI / 2;
  innerBottom.position.y = floorY;

  for (const mesh of [innerWall, innerBottom]) {
    mesh.castShadow = false;
    mesh.receiveShadow = true;
  }
  group.add(innerWall, innerBottom);

  const interiorTuning = tuning;
  const barrelSeed = group.userData.fireFlickerSeed ?? 0;
  const videoMesh = createOilBarrelInteriorVideoMesh(
    innerRadius,
    innerWallHeight,
    floorY,
    topLipY,
    interiorTuning,
    barrelSeed
  );
  if (videoMesh) {
    group.add(videoMesh);
  }

  group.userData.innerRadius = innerRadius;
  group.userData.innerWallHeight = innerWallHeight;
  group.userData.floorY = floorY;
  group.userData.clipTopY = topLipY;
  group.userData.interiorFire = interiorTuning.interiorFire !== false;

  if (interiorTuning.interiorFire !== false) {
    addOilBarrelFireLight(
      group,
      innerRadius,
      innerWallHeight,
      floorY,
      topLipY,
      interiorTuning,
      roomId
    );
  }
}

/**
 * @param {{
 *   topCap?: boolean,
 *   roomId?: string | null,
 *   interiorFire?: boolean,
 * }} [options]
 */
function buildBarrelMesh(options = {}) {
  const topCap = options.topCap !== false;
  const interiorTuning =
    options.interiorFire === false
      ? { ..._tuning, interiorFire: false }
      : _tuning;
  const h = OIL_BARREL_HEIGHT;
  const r = OIL_BARREL_RADIUS;
  const radialSegments = OIL_BARREL_RADIAL_SEGMENTS;
  const { bevel, capR, halfHeight: hh } = rimDimensions(r, h, RIM_BEVEL);
  const wallHeight = h - 2 * bevel;
  const capGeo = getCapDiskGeo(capR, radialSegments);

  const roomId = options.roomId ?? null;
  const bodyMat = resolveExteriorMaterial(roomId);

  const exterior = new THREE.Mesh(
    getBarrelExteriorMergedGeo(
      r,
      wallHeight,
      bevel,
      hh,
      radialSegments,
      _tuning.rimTileU,
      _tuning.rimTileV
    ),
    bodyMat
  );
  exterior.name = "oil_barrel_exterior";

  const bottomMat = resolveCapMaterial("bottom", roomId);
  const bottom = new THREE.Mesh(capGeo, bottomMat);
  bottom.name = "oil_barrel_cap_bottom";
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -hh - CAP_SURFACE_OFFSET;
  bottom.renderOrder = 1;

  const group = new THREE.Group();
  group.name = "oil_barrel";
  if (options.fireFlickerSeed != null) {
    group.userData.fireFlickerSeed = options.fireFlickerSeed;
  }
  if (options.roomId != null) {
    group.userData.roomId = options.roomId;
  }
  group.add(exterior, bottom);

  if (topCap) {
    const topMat = resolveCapMaterial("top", roomId);
    const top = new THREE.Mesh(capGeo, topMat);
    top.name = "oil_barrel_cap_top";
    top.rotation.x = -Math.PI / 2;
    top.position.y = hh + CAP_SURFACE_OFFSET;
    top.renderOrder = 1;
    group.add(top);
  } else {
    const shadowShell = new THREE.Mesh(
      new THREE.CylinderGeometry(
        r + 0.026,
        r + 0.026,
        wallHeight + bevel * 3.2,
        radialSegments,
        1,
        true
      ),
      bodyMat
    );
    shadowShell.name = "oil_barrel_shadow_shell";
    shadowShell.position.y = bevel * 0.55;
    shadowShell.castShadow = true;
    shadowShell.receiveShadow = false;
    group.add(shadowShell);

    const innerRadius = Math.max(capR - 0.006, r - INTERIOR_INSET);
    addOpenBarrelOilInterior(
      group,
      innerRadius,
      wallHeight,
      hh,
      bevel,
      radialSegments,
      options.roomId ?? null,
      interiorTuning
    );
  }

  return group;
}

function loadExteriorTextures() {
  const load = (name) => _loader.loadAsync(`${TEX_ROOT}/${name}`);
  const F = EXTERIOR_TEX_FILES;
  return Promise.all([
    load(F.bodyAlbedo),
    load(F.bodyNormal),
    load(F.bodyEmissive),
    load(F.topAlbedo),
    load(F.topNormal),
    load(F.bottomAlbedo),
    load(F.bottomNormal),
  ]).then(
    ([
      bodyAlbedo,
      bodyNormal,
      bodyEmissive,
      topAlbedo,
      topNormal,
      bottomAlbedo,
      bottomNormal,
    ]) => {
      _tex = {
        bodyAlbedo,
        bodyNormal,
        bodyEmissive,
        topAlbedo,
        topNormal,
        bottomAlbedo,
        bottomNormal,
      };
    }
  );
}

function loadInteriorTextures() {
  const load = (name) => _loader.loadAsync(`${INSIDE_TEX_ROOT}/${name}`);
  const F = INTERIOR_TEX_FILES;
  return Promise.all([
    load(F.wallAlbedo),
    load(F.wallNormal),
    load(F.wallOrm),
    load(F.floorAlbedo),
    load(F.floorNormal),
    load(F.floorOrm),
  ]).then(
    ([wallAlbedo, wallNormal, wallOrm, floorAlbedo, floorNormal, floorOrm]) => {
      _insideTex = {
        wallAlbedo,
        wallNormal,
        wallOrm,
        floorAlbedo,
        floorNormal,
        floorOrm,
      };
    }
  );
}

/** @param {import("./loadArena.js").ArenaConfig} [arena] */
export function arenaNeedsOilBarrelInterior(arena) {
  if (!arena?.props?.length) return _tuning.topCap === false;
  for (const def of arena.props) {
    if (def.type !== "oilBarrel") continue;
    if (resolveBarrelTopCap(def) === false) return true;
  }
  return false;
}

let _interiorLoadPromise = null;

/** Load interior WebP pack if an open-top barrel needs it. */
export function ensureOilBarrelInteriorTextures() {
  if (_insideTex) return Promise.resolve();
  if (_interiorLoadPromise) return _interiorLoadPromise;
  _interiorLoadPromise = Promise.all([
    loadInteriorTextures(),
    ensureOilBarrelInteriorVideo().catch((err) => {
      console.warn("Oil barrel interior video failed to load:", err);
    }),
  ])
    .then(() => {
      buildOilInteriorMaterials();
      applyInteriorTextureRotation(_tuning);
    })
    .catch((err) => {
      _interiorLoadPromise = null;
      console.warn("Oil barrel interior textures failed to load:", err);
    });
  return _interiorLoadPromise;
}

/**
 * Decode barrel PBR textures before first spawn.
 * @param {import("./loadArena.js").ArenaConfig} [arena] When set, interior maps load only if needed.
 */
export function preloadOilBarrelAssets(arena) {
  const needInterior = arena ? arenaNeedsOilBarrelInterior(arena) : false;
  if (_tex && (!needInterior || _insideTex)) return Promise.resolve();
  if (_preloadPromise) return _preloadPromise;

  _preloadPromise = Promise.all([
    _tex ? Promise.resolve() : loadExteriorTextures(),
    needInterior
      ? Promise.all([
          !_insideTex ? ensureOilBarrelInteriorTextures() : Promise.resolve(),
          ensureOilBarrelInteriorVideo().catch((err) => {
            console.warn("Oil barrel interior video failed to load:", err);
          }),
        ])
      : Promise.resolve(),
  ])
    .then(() => {
      buildMaterials();
    })
    .catch((err) => {
      _preloadPromise = null;
      console.warn("Oil barrel textures failed to load:", err);
    });

  return _preloadPromise;
}

/**
 * @param {THREE.Object3D} parent
 * @param {number} x
 * @param {number} z
 * @param {number} [floorY=0] World Y of the barrel's lowest point (foot), not the group centre.
 * @param {number} [rotationY=0]
 * @param {{
 *   topCap?: boolean,
 *   roomId?: string | null,
 *   interiorFire?: boolean,
 *   layOnSide?: boolean,
 *   rotationX?: number,
 *   rotationZ?: number,
 *   propId?: string,
 *   fireFlickerSeed?: number,
 * }} [options]
 */
export function createOilBarrel(parent, x, z, floorY = 0, rotationY = 0, options = {}) {
  if (!_bodyMat) {
    buildMaterials();
    if (!_bodyMat) {
      ensureBodyMaterial();
      _topMat = new THREE.MeshStandardMaterial({ color: 0x4a4238 });
      _bottomMat = new THREE.MeshStandardMaterial({ color: 0x3a342c });
      buildOilInteriorMaterials();
    }
  }

  const layOnSide = options.layOnSide === true;
  const h = OIL_BARREL_HEIGHT;
  const r = OIL_BARREL_RADIUS;
  const interiorFire =
    layOnSide || options.interiorFire === false ? false : options.interiorFire;
  const fireFlickerSeed =
    interiorFire !== false
      ? (options.fireFlickerSeed ??
        barrelFireFlickerSeedFromPropId(options.propId))
      : undefined;

  const barrel = buildBarrelMesh({
    topCap: options.topCap,
    roomId: options.roomId ?? null,
    interiorFire,
    fireFlickerSeed,
  });
  const rotX = options.rotationX ?? 0;
  const rotZ = options.rotationZ ?? 0;
  barrel.position.set(x, 0, z);
  if (layOnSide) {
    barrel.rotation.set(0, rotationY, options.rotationZ ?? Math.PI / 2);
  } else {
    barrel.rotation.set(rotX, rotationY, rotZ);
  }
  barrel.userData.roomId = options.roomId ?? null;
  if (fireFlickerSeed != null) {
    barrel.userData.fireFlickerSeed = fireFlickerSeed;
  }
  barrel.castShadow = true;
  barrel.receiveShadow = true;
  barrel.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.name === "oil_interior_video") {
      obj.castShadow = false;
      obj.receiveShadow = false;
      return;
    }
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
  applyBarrelRenderLayers(barrel, options.roomId ?? null);
  parent.add(barrel);
  barrel.updateMatrixWorld(true);
  _barrelFootBox.setFromObject(barrel);
  barrel.position.y += floorY - _barrelFootBox.min.y;
  barrel.updateMatrixWorld(true);
  return barrel;
}

/**
 * World pass always; room barrels also join the interior pass so fire-light shadows
 * can cast from the metal shell onto ROOM-layer interior wall/floor.
 * @param {THREE.Mesh} mesh
 * @param {string | null} roomId
 */
function applyBarrelWorldAndRoomLayers(mesh, roomId) {
  setWorldLayer(mesh);
  if (roomId) {
    mesh.layers.enable(ROOM_INTERIOR_LAYER);
  }
}

/**
 * Exterior + outdoor flames on WORLD. Room barrels: wall/floor + flame video on ROOM
 * (room pass runs after world — world-layer video was getting covered by room shell).
 * @param {THREE.Group} barrel
 * @param {string | null} roomId
 */
function applyBarrelRenderLayers(barrel, roomId) {
  barrel.traverse((obj) => {
    if (!obj.isMesh) return;

    if (
      obj.name === "oil_barrel_exterior" ||
      obj.name === "oil_barrel_shadow_shell" ||
      obj.name === "oil_barrel_cap_top" ||
      obj.name === "oil_barrel_cap_bottom"
    ) {
      applyBarrelWorldAndRoomLayers(obj, roomId);
      obj.renderOrder = 3;
      return;
    }

    if (obj.name === "oil_interior_video") {
      if (roomId) {
        setRoomInteriorLayer(obj);
        obj.layers.enable(WORLD_LAYER);
        obj.renderOrder = 12;
        const mat = obj.material;
        if (mat) {
          mat.polygonOffset = true;
          mat.polygonOffsetFactor = -1;
          mat.polygonOffsetUnits = -1;
        }
      } else {
        setWorldLayer(obj);
        obj.renderOrder = 10;
      }
      return;
    }

    if (roomId && BARREL_INTERIOR_ROOM_MESH_NAMES.has(obj.name)) {
      setRoomInteriorLayer(obj);
    } else {
      setWorldLayer(obj);
    }
  });
}

/**
 * @param {THREE.Object3D} root
 * @param {import("./loadArena.js").ArenaConfig} arena
 * @returns {THREE.Object3D[]}
 */
/** @param {import("./loadArena.js").ArenaProp} def */
export function resolveBarrelTopCap(def) {
  if (def.topCap === true || def.topCap === false) return def.topCap;
  return _tuning.topCap !== false;
}

export function spawnLevelOilBarrels(root, arena) {
  const meshes = [];
  const floorY = arena.floorY ?? 0;

  for (const def of arena.props ?? []) {
    if (def.type !== "oilBarrel") continue;
    const y = def.y ?? def.floorY ?? floorY;
    meshes.push(
      createOilBarrel(root, def.x, def.z, y, def.rotationY ?? 0, {
        topCap: resolveBarrelTopCap(def),
        roomId: def.roomId ?? null,
        interiorFire: def.interiorFire,
        layOnSide: def.layOnSide === true,
        rotationX: def.rotationX,
        rotationZ: def.rotationZ,
        propId: def.id,
        fireFlickerSeed: def.fireFlickerSeed,
      })
    );
  }

  ensureOilBarrelFlameMeshes(root);
  refreshOilBarrelRenderLayers(root);
  return meshes;
}

/** @param {import("./loadArena.js").ArenaProp} def @param {number} floorY */
export function oilBarrelCollider(def, floorY = 0) {
  const y = def.y ?? def.floorY ?? floorY;
  const h = OIL_BARREL_HEIGHT;
  const r = OIL_BARREL_RADIUS;
  if (def.layOnSide === true) {
    return {
      x: def.x,
      z: def.z,
      halfX: h * 0.5,
      halfZ: r,
      rotationY: def.rotationY ?? 0,
      bottomY: y,
      topY: y + r * 2,
      kind: "oilBarrel",
      cornerRadius: 0,
    };
  }
  return {
    x: def.x,
    z: def.z,
    halfX: r,
    halfZ: r,
    rotationY: def.rotationY ?? 0,
    bottomY: y,
    topY: y + h,
    kind: "oilBarrel",
    cornerRadius: 0,
  };
}
