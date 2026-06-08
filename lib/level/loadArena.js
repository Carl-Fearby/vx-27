import { getDefaultStairPlacement } from "../stairs/StairTuning.js";
import level1Bundled from "../../public/levels/level1.json";
import level2Bundled from "../../public/levels/level2.json";

/** @type {Map<string, ArenaConfig>} */
const arenaConfigCache = new Map();

const ARENA_CACHE_ENABLED = process.env.NODE_ENV !== "development";

/** Drop cached arena JSON (e.g. after editing public/levels/*.json in dev). */
export function clearArenaConfigCache() {
  arenaConfigCache.clear();
}

/** Bundled fallbacks when `/public` fetch fails (HMR, Dropbox cache, offline). */
/** @type {Record<number, object>} */
const BUNDLED_ARENAS = {
  1: level1Bundled,
  2: level2Bundled,
};

/** First playable level — add `level2.json`, `level3.json`, etc. under public/levels/. */
export const DEFAULT_LEVEL = 1;

/** @param {number} levelNumber */
export function levelConfigUrl(levelNumber) {
  return `/levels/level${levelNumber}.json`;
}

export const DEFAULT_ARENA_URL = levelConfigUrl(DEFAULT_LEVEL);

/**
 * @typedef {Object} ArenaWallPoster
 * @property {"north" | "south" | "east" | "west"} wall Perimeter wall the poster sits on
 * @property {number} [along] X on north/south walls, Z on east/west walls
 * @property {number} [centerY] World Y of poster center
 * @property {string} [poster] Image under /public (default vx-27poster)
 * @property {number} [posterWidth] World width in meters before posterScale
 * @property {number} [posterAspect] Height / width (default matches vx27 poster art)
 * @property {number} [posterFaceEpsilon] Offset past wall inner face (default ~3mm)
 * @property {number} [posterScale] Multiplier on posterWidth
 * @property {number} [posterRollDeg] Roll in degrees (crooked on the wall)
 * @property {number} [posterPitchDeg] Pitch in degrees (lean back from wall)
 * @property {number} [posterYawOffsetDeg] Extra yaw offset in degrees
 * @property {number} [posterTiltDeg] Alias for posterRollDeg
 * @property {number} [posterMargin] Clearance from floor/ceiling when auto-fitting (default 0.35m)
 * @property {boolean} [posterFit] Scale/clamp so the full poster fits on the wall (default true)
 */

/**
 * @typedef {Object} ArenaPillarDefaults
 * @property {"box" | "rounded"} [shape]
 * @property {number} [cornerRadius] Meters; default ~10% of pillar width
 * @property {number} [cornerSegments] RoundedBox detail (default 4)
 */

/**
 * @typedef {Object} ArenaPillar
 * @property {number} x
 * @property {number} z
 * @property {string} [texture] Material folder id under /public/textures (overrides textures.pillar)
 * @property {"box" | "rounded"} [shape]
 * @property {number} [cornerRadius]
 * @property {number} [cornerSegments]
 * @property {string} [poster] Image under /public (e.g. `/ui/vx-27poster.png` or `vx-27poster`)
 * @property {number} [posterYaw] Radians — which face the poster faces (default: rotationY or 0)
 * @property {number} [posterWidth] World width in meters
 * @property {number} [posterCenterY] World Y of poster center
 * @property {number} [posterAspect] Height / width (default matches vx27 poster art)
 * @property {number} [posterFaceEpsilon] Local offset past pillar face (default ~3mm)
 * @property {number} [posterScale] Multiplier on posterWidth (e.g. 0.8 = 20% smaller)
 * @property {number} [posterRollDeg] Roll in degrees (crooked on the face)
 * @property {number} [posterPitchDeg] Pitch in degrees (lean back from face)
 * @property {number} [posterYawOffsetDeg] Extra yaw offset in degrees on top of posterYaw
 */

/**
 * @typedef {Object} ArenaDoorway
 * @property {"north" | "south"} [wall]
 * @property {number} [centerX]
 * @property {number} [width]
 * @property {number} [height]
 * @property {"flat" | "arch"} [top]
 */

/**
 * @typedef {Object} ArenaRoomLight
 * @property {"point"} [type]
 * @property {[number, number, number]} position Offset from room center (x, y, z)
 * @property {string} [color]
 * @property {number} [intensity]
 * @property {number} [distance]
 * @property {number} [decay]
 */

/**
 * @typedef {Object} ArenaRoom
 * @property {string} id
 * @property {number} centerX
 * @property {number} width
 * @property {number} depth
 * @property {number} [height]
 * @property {number} [wallThickness]
 * @property {number} [ceilingThickness] Overrides arena default for this room
 * @property {{ floor: string, wall: string, ceiling?: string }} textures
 * @property {ArenaRoomLight[]} [lights]
 * @property {boolean} [pillarShell] World-layer shell only (like pillars); interior pass is floor + ceiling + lights
 */

/**
 * Extra arena floor slab beyond the main square — same footprint math as {@link ArenaRoom}
 * without building an interior shell (used after removing attached rooms).
 *
 * @typedef {Object} ArenaFloorExtension
 * @property {string} [id]
 * @property {number} centerX
 * @property {number} width
 * @property {number} depth
 * @property {number} [wallThickness]
 * @property {number} [height] Wall height (default arena wallHeight)
 * @property {{ wall?: string, ceiling?: string, floor?: string }} [textures]
 * @property {ArenaRoomLight[]} [lights]
 */

/**
 * @typedef {Object} LevelMeta
 * @property {number} number
 * @property {string} id
 * @property {string} name
 * @property {string} [objective]
 * @property {string} [description]
 */

/**
 * @typedef {Object} ArenaCollectible
 * @property {string} id Unique id (used for compass marker)
 * @property {"ammo" | "score"} type
 * @property {number} [x]
 * @property {number} [z]
 * @property {number | "catwalk"} [y]
 * @property {"floor" | "catwalk"} [surface]
 * @property {number} [floorY]
 * @property {"catwalkBackRight" | "catwalkRandom" | "arenaFloorRandom"} [preset]
 *   Shorthand placements — deck back-right, random catwalk, or random arena floor
 * @property {number} [inset] Edge inset for preset placement (meters)
 * @property {number} [value] Pickup amount (default 10)
 * @property {string} [note]
 */

/**
 * @typedef {Object} ArenaProp
 * @property {string} [id]
 * @property {"oilBarrel" | "vx27Container" | "controlPanel"} type
 * @property {number} [height] Control panel height override (default player stand height)
 * @property {number} [depth] Control panel profile depth override (front–back)
 * @property {number} [panelWidth] Control panel extrusion width override (left–right)
 * @property {[number, number][]} [sideProfile] Normalised side silhouette corners (x depth 0–1, y height 0–1)
 * @property {number} x
 * @property {number} z
 * @property {number} [y] Floor Y (prop base)
 * @property {number} [floorY] Alias for y
 * @property {number} [rotationY] Radians
 * @property {number} [length] Container length override (m)
 * @property {number} [width] Container width override (m)
 * @property {number} [height] Container height override (m)
 * @property {number} [scale] Uniform scale multiplier (default 1)
 * @property {number} [rotationX] Radians (euler, with rotationY / rotationZ)
 * @property {number} [rotationZ] Radians
 * @property {boolean} [layOnSide] Barrel axis horizontal; rests on rim (no interior fire; sets rotationZ = π/2 if rotationZ omitted)
 * @property {boolean} [topCap=true] Flat top endcap disk (false = open top, rim kept)
 * @property {boolean} [interiorFire] Interior flame + damage (default: global oil barrel tuning)
 * @property {string} [roomId] Attached room id — ties fire point light to room culling / interior layer
 * @property {string} [note]
 * @property {import("../vx27-container/Vx27ContainerDoorTuning.js").Vx27ContainerDoorTuning} [doorTuning]
 */

/**
 * @typedef {Object} LevelCollectibleEntry
 * @property {string} id
 * @property {"ammo" | "hp" | "grenade" | "flashbang" | "score"} type
 * @property {object} drop
 * @property {HTMLElement | null} markerEl
 * @property {boolean} collected
 */

/**
 * @typedef {Object} ArenaConfig
 * @property {LevelMeta} meta
 * @property {string} id
 * @property {string} name
 * @property {number} size
 * @property {number} wallHeight
 * @property {number} wallThickness
 * @property {number} [ceilingThickness] Solid deck slab on top of walls (meters)
 * @property {number} [catwalkClearance] Headroom under deck for a future catwalk (meters)
 * @property {number} [westWallHeightRatio] West wall height as fraction of wallHeight (clerestory; default 0.5)
 * @property {number} [ceilingWestOpenRatio] West-side deck width left open (0–1; default 0.5 when clerestory)
 * @property {number} pillarSize
 * @property {ArenaPillarDefaults} [pillarDefaults]
 * @property {ArenaDoorway} [doorway]
 * @property {ArenaDoorway[]} [doorways]
 * @property {ArenaRoom[]} [rooms]
 * @property {ArenaFloorExtension[]} [floorExtensions] Extra arena deck beyond the main square (former attached-room footprints)
 * @property {boolean | Record<string, unknown>} [stairs]
 *   Set `false` to omit stairs. Any other value (or omitting the key) uses
 *   baked-in placement from StairTuning.js — level JSON does not author coords.
 * @property {number} [playerBoundsInset] Legacy — use {@link wallStandoff} instead
 * @property {number} [wallStandoff] Clearance from inner wall face to player body edge (default 0.5)
 * @property {{ floor: string, wall: string, pillar: string, ceiling?: string }} textures
 * @property {{ x: number, z: number, radius: number }[]} [floorHoles] Circular cutouts in the arena floor — player falls through and is respawned by the death-fall handler
 * @property {ArenaPillar[]} pillars
 * @property {ArenaWallPoster[]} [posters] Promo posters on arena perimeter walls
 * @property {ArenaCollectible[]} [collectibles] Static pickups placed in the level
 * @property {ArenaProp[]} [props] Static decor (oil barrels, etc.)
 * @property {{ x: number, z: number }[]} [targets] Legacy fixed positions (count fallback only)
 * @property {{
 *   count?: number,
 *   radius?: number,
 *   height?: number,
 *   maxHealth?: number,
 *   respawnDelay?: number,
 *   spawnMargin?: number,
 *   repairPerSecond?: number,
 *   repairDelayAfterHit?: number,
 *   width?: number,
 *   depth?: number,
 *   spawnPoints?: { x: number, z: number, y?: number, yaw?: number, random?: boolean, chance?: number, note?: string }[],
 * }} [target]
 */

/** @param {string} url */
function resolveConfigUrl(url) {
  if (typeof window === "undefined") return url;
  if (/^https?:\/\//i.test(url)) return url;
  const href = new URL(url, window.location.origin).href;
  if (!ARENA_CACHE_ENABLED) {
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}_=${Date.now()}`;
  }
  return href;
}

/** @param {string} url @returns {object | null} */
function bundledArenaForUrl(url) {
  const levelNumber = parseLevelNumberFromUrl(url);
  const raw = BUNDLED_ARENAS[levelNumber];
  return raw ? structuredClone(raw) : null;
}

/** @param {string} url */
function parseLevelNumberFromUrl(url) {
  const match = url.match(/\/level(\d+)\.json(?:\?|$)/i);
  return match ? parseInt(match[1], 10) : DEFAULT_LEVEL;
}

/**
 * Merge `meta` with legacy top-level id/name and filename-derived level number.
 * @param {ArenaConfig & { meta?: Partial<LevelMeta> }} arena
 * @param {number} [levelNumber]
 */
export function normalizeLevelMeta(arena, levelNumber = DEFAULT_LEVEL) {
  const legacyId = arena.id;
  const legacyName = arena.name;
  const raw = arena.meta ?? {};

  const number = raw.number ?? levelNumber;
  /** @type {LevelMeta} */
  const meta = {
    number,
    id: raw.id ?? legacyId ?? `level${number}`,
    name: raw.name ?? legacyName ?? `Level ${number}`,
  };
  if (raw.objective) meta.objective = raw.objective;
  if (raw.description) meta.description = raw.description;

  arena.meta = meta;
  arena.id = meta.id;
  arena.name = meta.name;
}

/** @param {ArenaConfig} arena @returns {LevelMeta} */
export function getLevelMeta(arena) {
  return arena.meta;
}

/**
 * Stair placement is authored in code (StairTuning.js), not level JSON.
 * @param {ArenaConfig} arena
 */
function applyStairPlacementFromCode(arena) {
  if (arena.stairs === false) {
    delete arena.stairs;
    return;
  }
  arena.stairs = getDefaultStairPlacement();
}

/** @param {unknown} err @param {AbortSignal | undefined} signal */
export function isArenaLoadAbortError(err, signal) {
  if (signal?.aborted) return true;
  if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
    return true;
  }
  return false;
}

/**
 * @param {object} raw
 * @param {string} url
 * @returns {ArenaConfig}
 */
function finalizeArena(raw, url) {
  const arena = structuredClone(raw);
  normalizeLevelMeta(arena, parseLevelNumberFromUrl(url));
  if (arena.levelType === "corridor" || arena.corridor) {
    arena.stairs = false;
  } else {
    applyStairPlacementFromCode(arena);
  }
  return arena;
}

/**
 * @param {string} url
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<ArenaConfig>}
 */
async function fetchArenaJson(url, signal) {
  const fetchUrl = resolveConfigUrl(url);
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(fetchUrl, { cache: "no-store", signal });
      if (!res.ok) {
        throw new Error(`Arena config not found: ${url} (HTTP ${res.status})`);
      }
      return await res.json();
    } catch (err) {
      if (isArenaLoadAbortError(err, signal)) throw err;
      lastErr = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

/**
 * @param {string} [url]
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<ArenaConfig>}
 */
export async function loadArenaConfig(url = DEFAULT_ARENA_URL, options = {}) {
  const { signal } = options;
  if (ARENA_CACHE_ENABLED) {
    const cached = arenaConfigCache.get(url);
    if (cached) {
      return structuredClone(cached);
    }
  }

  let raw;
  try {
    raw = await fetchArenaJson(url, signal);
  } catch (err) {
    if (isArenaLoadAbortError(err, signal)) throw err;
    raw = bundledArenaForUrl(url);
    if (!raw) throw err;
    if (typeof console !== "undefined") {
      console.warn(
        `[loadArena] fetch failed for ${url}; using bundled level config.`,
        err
      );
    }
  }

  const arena = finalizeArena(raw, url);
  if (ARENA_CACHE_ENABLED) {
    arenaConfigCache.set(url, structuredClone(arena));
  }
  return arena;
}

/** @param {number} [levelNumber] @returns {Promise<ArenaConfig>} */
export function loadLevelConfig(levelNumber = DEFAULT_LEVEL) {
  return loadArenaConfig(levelConfigUrl(levelNumber));
}

/** @param {ArenaConfig} arena */
export function collectArenaTextureIds(arena) {
  const ids = new Set();
  const tex = arena.textures ?? arena.corridor?.textures ?? {};
  if (tex.floor) ids.add(tex.floor);
  if (tex.wall) ids.add(tex.wall);
  if (tex.pillar) ids.add(tex.pillar);
  if (tex.ceiling) ids.add(tex.ceiling);
  for (const pillar of arena.pillars ?? []) {
    if (pillar.texture) ids.add(pillar.texture);
  }
  for (const room of arena.rooms ?? []) {
    if (room.textures?.floor) ids.add(room.textures.floor);
    if (room.textures?.wall) ids.add(room.textures.wall);
    if (room.textures?.ceiling) ids.add(room.textures.ceiling);
  }
  for (const ext of arena.floorExtensions ?? []) {
    if (ext.textures?.wall) ids.add(ext.textures.wall);
    if (ext.textures?.ceiling) ids.add(ext.textures.ceiling);
    if (ext.textures?.floor) ids.add(ext.textures.floor);
  }
  if (arena.stairs !== false) {
    ids.add("decal_hazard_stripes_worn");
    ids.add("floor_metal_grate_rusty");
  }
  const corridorTex = arena.corridor?.textures;
  if (corridorTex) {
    if (corridorTex.floor) ids.add(corridorTex.floor);
    if (corridorTex.wall) ids.add(corridorTex.wall);
    if (corridorTex.ceiling) ids.add(corridorTex.ceiling);
  }
  return [...ids];
}
