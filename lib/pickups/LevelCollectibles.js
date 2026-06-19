import * as THREE from "three";
import { getArenaDeckWalkSurface } from "../stairs/LevelStairs.js";
import { getArenaCatwalkDeckY } from "../stairs/StairTuning.js";
import {
  spawnLevelCollectiblePickup,
  tickLevelCollectibleDrop,
  tickLevelCollectibleCollectFade,
  canCollectLevelCollectible,
  disposeAmmoPickupMeshShadow,
  finalizePickupInScene,
  setPickupSurface,
} from "./AmmoCrate.js";
import { spawnHpOrb, getOrbMaterials } from "../combat/Targets.js";
import {
  spawnGrenadeDrop,
  disposeGrenadeModel,
  PROJECTILE_FLASHBANG,
} from "../combat/Grenade.js";
import {
  spawnLevelScorePackPickup,
  tickScorePackCollectFade,
  tickScorePackDrop,
  disposeScorePackMesh,
} from "./ScorePack.js";
import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";

const COMPASS_POINTER_SRC = "/ui/compass-pointer.webp";
const COMPASS_MARKER_FOV_DEG = 52.5;
/** Matches player capsule radius — crate sits just inboard of the walk limit. */
const CATWALK_CORNER_INSET = 0.55;

/** QA — after pickup, respawn a random floor/catwalk reward with a new compass marker. */
export const LEVEL_COLLECTIBLE_TEST_RESPAWN = true;

export const TEST_REWARD_TYPES = ["ammo", "hp", "grenade", "flashbang", "score"];

const SOFT_DROP_VY = -1.2;
const HP_SETTLE_Y = 0.065 + 0.02;
const GREN_SETTLE_Y = 0.07;
const SPIN = 2.5;

/**
 * @param {import("../level/loadArena.js").ArenaConfig} arena
 * @param {import("../level/loadArena.js").ArenaCollectible} def
 */
function getArenaFloorWalkBounds(arena) {
  const wallStandoff = arena.wallStandoff ?? 0.5;
  const inner = arena.size / 2 - wallStandoff;
  return {
    minX: -inner,
    maxX: inner,
    minZ: -inner,
    maxZ: inner,
    y: arena.floorY ?? 0,
  };
}

export function resolveCollectiblePosition(arena, def, gameCore = null) {
  if (def.preset === "catwalkBackRight") {
    const westOpen =
      arena.ceilingWestOpenRatio ??
      ((arena.westWallHeightRatio ?? 1) < 1 ? 0.5 : 0);
    const deck = getArenaDeckWalkSurface(
      arena,
      getArenaCatwalkDeckY(arena),
      westOpen
    );
    const inset = def.inset ?? CATWALK_CORNER_INSET;
    return {
      x: deck.maxX - inset,
      z: deck.maxZ - inset,
      y: deck.y,
      floorY: deck.y,
      surface: "catwalk",
    };
  }

  if (def.preset === "arenaFloorRandom") {
    return {
      ...pickRandomArenaFloorCollectiblePosition(arena, def.inset ?? 0.85, gameCore),
      surface: "floor",
    };
  }

  if (def.preset === "catwalkRandom") {
    return {
      ...pickRandomCatwalkCollectiblePosition(arena, def.inset ?? 0.85, gameCore),
      surface: "catwalk",
    };
  }

  const onCatwalk =
    def.surface === "catwalk" || def.y === "catwalk";
  const floorY = onCatwalk
    ? getArenaCatwalkDeckY(arena)
    : def.floorY ?? arena.floorY ?? 0;
  const y = onCatwalk ? floorY : def.y ?? floorY;

  return {
    x: def.x,
    z: def.z,
    y,
    floorY,
    surface: onCatwalk ? "catwalk" : def.surface ?? "floor",
  };
}

/**
 * @param {THREE.Object3D} root Scene or level pickups group
 * @param {import("../level/loadArena.js").ArenaConfig} arena
 */
export function spawnLevelCollectibles(root, arena, gameCore = null) {
  /** @type {import("../level/loadArena.js").LevelCollectibleEntry[]} */
  const entries = [];
  const drops = [];

  for (const def of arena.collectibles ?? []) {
    if (!def?.id || (def.type !== "ammo" && def.type !== "score")) continue;

    const pos = resolveCollectiblePosition(arena, def, gameCore);
    const rewardType = def.type;
    const drop =
      rewardType === "score"
        ? spawnLevelScorePackPickup(
            root,
            pos.x,
            pos.z,
            pos.floorY,
            def.value ?? undefined
          )
        : spawnLevelCollectiblePickup(
            root,
            pos.x,
            pos.z,
            pos.floorY,
            def.value ?? 10
          );

    if (rewardType === "ammo") {
      finalizePickupInScene(drop.mesh);
      setPickupSurface(drop.mesh, pos.surface ?? "catwalk");
    }

    drop.compassMarkerId = def.id;
    drop.rewardType = rewardType;
    drop.pickupKind = rewardType;
    drop.surface = pos.surface ?? "catwalk";

    entries.push({
      id: def.id,
      type: rewardType,
      drop,
      markerEl: null,
      collected: false,
    });
    drops.push(drop);
  }

  return { entries, drops };
}

function planRandomCollectible(gameCore, arena, surfaceMode, margin, rewardTypes) {
  const floor = getArenaFloorWalkBounds(arena);
  const westOpen =
    arena.ceilingWestOpenRatio ??
    ((arena.westWallHeightRatio ?? 1) < 1 ? 0.5 : 0);
  const deck = getArenaDeckWalkSurface(
    arena,
    getArenaCatwalkDeckY(arena),
    westOpen
  );
  return requireWasmMethod(gameCore, "planCollectibleSpawn")({
    rewardTypes,
    rewardRoll: Math.random(),
    surfaceMode,
    surfaceRoll: Math.random(),
    xRoll: Math.random(),
    zRoll: Math.random(),
    margin,
    floorMinX: floor.minX,
    floorMaxX: floor.maxX,
    floorMinZ: floor.minZ,
    floorMaxZ: floor.maxZ,
    floorY: floor.y,
    catwalkMinX: deck.minX,
    catwalkMaxX: deck.maxX,
    catwalkMinZ: deck.minZ,
    catwalkMaxZ: deck.maxZ,
    catwalkY: deck.y,
  });
}

export function pickRandomTestRewardType(gameCore) {
  return requireWasmMethod(gameCore, "planCollectibleSpawn")({
    rewardTypes: TEST_REWARD_TYPES,
    rewardRoll: Math.random(),
    surfaceMode: "floor",
    surfaceRoll: 0,
    xRoll: 0,
    zRoll: 0,
    margin: 0,
    floorMinX: 0,
    floorMaxX: 0,
    floorMinZ: 0,
    floorMaxZ: 0,
    floorY: 0,
    catwalkMinX: 0,
    catwalkMaxX: 0,
    catwalkMinZ: 0,
    catwalkMaxZ: 0,
    catwalkY: 0,
  }).rewardType;
}

/**
 * Random point on the arena floor (inset from wall standoff).
 * @param {import("../level/loadArena.js").ArenaConfig} arena
 */
export function pickRandomArenaFloorCollectiblePosition(arena, margin = 0.85, gameCore = null) {
  return planRandomCollectible(gameCore, arena, "floor", margin, ["ammo"]);
}

/**
 * Random point on the east catwalk deck (inset from edges).
 * @param {import("../level/loadArena.js").ArenaConfig} arena
 */
export function pickRandomCatwalkCollectiblePosition(arena, margin = 0.85, gameCore = null) {
  return planRandomCollectible(gameCore, arena, "catwalk", margin, ["ammo"]);
}

/** Random reward point on arena floor or catwalk (50/50). */
export function pickRandomLevelCollectiblePosition(arena, margin = 0.85, gameCore = null) {
  return planRandomCollectible(gameCore, arena, "random", margin, ["ammo"]);
}

function prepSoftDrop(drop) {
  drop.velX = 0;
  drop.velZ = 0;
  drop.velY = SOFT_DROP_VY;
  drop.settled = false;
  drop.settledTime = 0;
  drop.settleBlend = 0;
  drop.collected = false;
  drop.collectTime = undefined;
  drop.levelCollectible = true;
  if (drop.mesh) {
    drop.mesh.visible = true;
    drop.mesh.position.y = drop.floorY + 0.45;
  }
  return drop;
}

/**
 * @param {THREE.Scene} scene
 * @param {"ammo" | "hp" | "grenade" | "flashbang" | "score"} rewardType
 * @param {{ x: number, z: number, floorY: number }} pos
 * @param {import("@/lib/game-core/types.ts").GameCoreEngine | null} [gameCore]
 */
export function spawnCollectibleByType(scene, rewardType, pos, gameCore = null) {
  const vec = new THREE.Vector3(pos.x, pos.floorY + 0.45, pos.z);
  const surface = pos.surface ?? "catwalk";

  if (rewardType === "hp") {
    const drop = prepSoftDrop(spawnHpOrb(scene, vec, pos.floorY, gameCore));
    drop.pickupKind = "hp";
    drop.rewardType = "hp";
    drop.surface = surface;
    drop.baseScale = drop.baseScale ?? 1;
    return drop;
  }

  if (rewardType === "grenade" || rewardType === "flashbang") {
    const drop = prepSoftDrop(spawnGrenadeDrop(scene, vec, pos.floorY, gameCore));
    drop.pickupKind = rewardType;
    drop.rewardType = rewardType;
    drop.surface = surface;
    drop.type = rewardType === "flashbang" ? PROJECTILE_FLASHBANG : "grenade";
    drop.baseScale = drop.mesh.scale.x;
    drop.value = 1;
    return drop;
  }

  if (rewardType === "score") {
    const drop = prepSoftDrop(
      spawnLevelScorePackPickup(scene, pos.x, pos.z, pos.floorY)
    );
    drop.pickupKind = "score";
    drop.rewardType = "score";
    drop.surface = surface;
    drop.baseScale = drop.baseScale ?? drop.mesh.scale.x;
    return drop;
  }

  const drop = spawnLevelCollectiblePickup(scene, pos.x, pos.z, pos.floorY, 10);
  finalizePickupInScene(drop.mesh);
  setPickupSurface(drop.mesh, surface);
  drop.pickupKind = "ammo";
  drop.rewardType = "ammo";
  drop.surface = surface;
  drop.baseScale = drop.mesh.scale.x;
  return drop;
}

function tickSoftCollectiblePhysics(d, dt, settleY, spinAxis = "y") {
  if (!d?.mesh) return;
  const motion = requireWasmMethod(d.gameCore, "tickCollectibleMotion")({
    kind: d.rewardType ?? d.type ?? "hp",
    dt,
    time: d.time,
    y: d.mesh.position.y,
    velY: d.velY,
    floorY: d.floorY,
    settleY,
    settled: Boolean(d.settled),
    settledTime: d.settledTime ?? 0,
    settleBlend: d.settleBlend ?? 0,
  });
  d.time = motion.time;
  d.mesh.position.y = motion.y;
  d.velY = motion.velY;
  d.settled = motion.settled;
  d.settledTime = motion.settledTime;
  d.settleBlend = motion.settleBlend;

  if (spinAxis === "z") {
    d.mesh.rotation.z += SPIN * dt;
  } else {
    d.mesh.rotation.y += SPIN * dt;
  }
  d.worldX = d.mesh.position.x;
  d.worldZ = d.mesh.position.z;
}

function tickCollectibleDrop(entry, dt) {
  const d = entry.drop;
  const kind = entry.type ?? d?.rewardType ?? "ammo";
  if (kind === "ammo") {
    tickLevelCollectibleDrop(d, dt);
    return;
  }
  if (kind === "hp") {
    tickSoftCollectiblePhysics(d, dt, HP_SETTLE_Y, "y");
    return;
  }
  if (kind === "score") {
    tickScorePackDrop(d, dt);
    return;
  }
  tickSoftCollectiblePhysics(d, dt, GREN_SETTLE_Y, "z");
}

/** @returns {boolean} true when the mesh should be removed */
function tickCollectibleCollectFade(entry, dt) {
  const d = entry.drop;
  if (!d?.mesh || !d.collected) return false;

  const kind = entry.type ?? d?.rewardType ?? "ammo";

  if (kind === "ammo") {
    return tickLevelCollectibleCollectFade(d, dt);
  }

  if (kind === "score") {
    return tickScorePackCollectFade(d, dt);
  }

  const fadeRule = requireWasmMethod(d.gameCore, "resolveCollectFade")({
    time: d.time,
    collectTime: d.collectTime ?? d.time,
    duration: 0.25,
  });
  const fade = fadeRule.scale;
  const base = d.baseScale ?? d.mesh.scale.x;
  d.mesh.scale.setScalar(base * fade);
  d.mesh.position.y += dt * 3;

  if (kind === "hp") {
    if (!d.ownMats) {
      d.ownMats = true;
      d.mesh.material = getOrbMaterials().map((m) => m.clone());
    }
    const mats = Array.isArray(d.mesh.material)
      ? d.mesh.material
      : [d.mesh.material];
    for (const m of mats) {
      if (m) {
        m.transparent = true;
        m.opacity = fade;
      }
    }
  }

  return fadeRule.remove;
}

function disposeCollectibleDrop(drop) {
  if (!drop?.mesh) return;
  drop.mesh.parent?.remove(drop.mesh);
  if (drop.pickupKind === "grenade" || drop.pickupKind === "flashbang") {
    disposeGrenadeModel(drop.mesh);
    return;
  }
  if (drop.pickupKind === "score") {
    disposeScorePackMesh(drop.mesh);
    return;
  }
  disposeAmmoPickupMeshShadow(drop.mesh);
  if (drop.ownMats) {
    const mats = Array.isArray(drop.mesh.material)
      ? drop.mesh.material
      : [drop.mesh.material];
    for (const m of mats) m.dispose?.();
  }
}

/** @param {HTMLElement | null} container */
export function addCompassCollectibleMarker(container, entry) {
  if (!container || entry.collected || entry.markerEl) return;
  const el = document.createElement("img");
  el.src = COMPASS_POINTER_SRC;
  el.alt = "";
  el.className = "hudCompassPointer";
  el.dataset.collectibleId = entry.id;
  el.draggable = false;
  el.style.opacity = "0";
  container.appendChild(el);
  entry.markerEl = el;
}

/**
 * @param {THREE.Scene} scene
 * @param {import("../level/loadArena.js").ArenaConfig} arena
 * @param {import("../level/loadArena.js").LevelCollectibleEntry} entry
 * @param {HTMLElement | null} compassContainer
 * @param {"ammo" | "hp" | "grenade" | "flashbang" | "score"} [rewardType]
 * @param {import("@/lib/game-core/types.ts").GameCoreEngine | null} [gameCore]
 */
export function respawnLevelCollectibleEntry(
  scene,
  arena,
  entry,
  compassContainer,
  rewardType = null,
  gameCore = null
) {
  const plan = planRandomCollectible(
    gameCore,
    arena,
    "random",
    0.85,
    rewardType ? [rewardType] : TEST_REWARD_TYPES
  );
  entry.type = plan.rewardType;
  entry.collected = false;
  entry.drop = spawnCollectibleByType(scene, plan.rewardType, plan, gameCore);
  entry.drop.compassMarkerId = entry.id;
  addCompassCollectibleMarker(compassContainer, entry);
}

/**
 * Animate and collect level pickups — separate from enemy ammoDrops so init
 * resets cannot orphan static crates.
 *
 * @param {import("../level/loadArena.js").LevelCollectibleEntry[]} entries
 * @param {number} dt
 * @param {number} playerX
 * @param {number} playerFootY
 * @param {number} playerZ
 * @param {(value: number, drop: object, entry: import("../level/loadArena.js").LevelCollectibleEntry) => void} onCollect
 * @param {{ testRespawn?: boolean, scene?: THREE.Scene, arena?: import("../level/loadArena.js").ArenaConfig, compassContainer?: HTMLElement | null, catwalkDeckY?: number, gameCore?: import("@/lib/game-core/types.ts").GameCoreEngine | null }} [opts]
 */
export function updateLevelCollectibles(
  entries,
  dt,
  playerX,
  playerFootY,
  playerZ,
  onCollect,
  opts = {}
) {
  const {
    testRespawn = false,
    scene = null,
    arena = null,
    compassContainer = null,
    catwalkDeckY = arena ? getArenaCatwalkDeckY(arena) : 4.35,
    gameCore = null,
  } = opts;

  for (const entry of entries) {
    const d = entry.drop;
    if (!d?.mesh) continue;
    d.gameCore = gameCore;

    tickCollectibleDrop(entry, dt);

    if (
      !entry.collected &&
      canCollectLevelCollectible(d, playerX, playerFootY, playerZ, catwalkDeckY)
    ) {
      entry.collected = true;
      d.collected = true;
      d.collectTime = d.time;
      onCollect(d.value, d, entry);
    }

    if (d.collected && tickCollectibleCollectFade(entry, dt)) {
      disposeCollectibleDrop(d);
      entry.drop = null;

      if (
        testRespawn &&
        scene &&
        arena &&
        LEVEL_COLLECTIBLE_TEST_RESPAWN
      ) {
        respawnLevelCollectibleEntry(
          scene,
          arena,
          entry,
          compassContainer,
          null,
          gameCore
        );
      }
    }
  }
}

/**
 * @param {HTMLElement | null} container
 * @param {import("../level/loadArena.js").LevelCollectibleEntry[]} entries
 */
export function mountCompassCollectibleMarkers(container, entries) {
  if (!container) return;
  container.replaceChildren();

  for (const entry of entries) {
    if (entry.collected || !entry.drop?.mesh) continue;
    const el = document.createElement("img");
    el.src = COMPASS_POINTER_SRC;
    el.alt = "";
    el.className = "hudCompassPointer";
    el.dataset.collectibleId = entry.id;
    el.draggable = false;
    el.style.opacity = "0";
    container.appendChild(el);
    entry.markerEl = el;
  }
}

/** Mount markers once the compass HUD ref is available (async level load). */
export function ensureCompassCollectibleMarkers(container, entries) {
  if (!container || entries.length === 0) return;
  if (
    entries.some(
      (entry) => !entry.collected && !entry.markerEl && entry.drop?.mesh
    )
  ) {
    mountCompassCollectibleMarkers(container, entries);
  }
}

/**
 * @param {import("../level/loadArena.js").LevelCollectibleEntry[]} entries
 * @param {number} playerX
 * @param {number} playerZ
 * @param {number} playerYaw Player look yaw in radians (0 = facing −Z)
 * @param {HTMLElement} viewport
 * @param {number} pxPerDeg
 */
export function updateCompassCollectibleMarkers(
  entries,
  playerX,
  playerZ,
  playerYaw,
  viewport,
  pxPerDeg,
  centerPx = viewport.offsetWidth * 0.5
) {
  for (const entry of entries) {
    const el = entry.markerEl;
    if (!el || entry.collected) continue;

    const drop = entry.drop;
    if (!drop?.mesh) {
      el.style.opacity = "0";
      continue;
    }
    const wx = drop.worldX ?? drop.mesh.position.x;
    const wz = drop.worldZ ?? drop.mesh.position.z;
    const dx = wx - playerX;
    const dz = wz - playerZ;
    const targetYaw = -Math.atan2(dx, -dz);
    let rel = ((playerYaw - targetYaw) * 180) / Math.PI;
    while (rel > 180) rel -= 360;
    while (rel < -180) rel += 360;

    if (Math.abs(rel) > COMPASS_MARKER_FOV_DEG) {
      el.style.opacity = "0";
      continue;
    }

    el.style.opacity = "1";
    el.style.left = `${centerPx + rel * pxPerDeg}px`;
  }
}

/**
 * @param {import("../level/loadArena.js").LevelCollectibleEntry[]} entries
 * @param {string} markerId
 */
export function hideCompassCollectibleMarker(entries, markerId) {
  for (const entry of entries) {
    if (entry.id !== markerId) continue;
    entry.collected = true;
    entry.markerEl?.remove();
    entry.markerEl = null;
    break;
  }
}

/**
 * @param {import("../level/loadArena.js").LevelCollectibleEntry[]} entries
 */
export function disposeCompassCollectibleMarkers(entries) {
  for (const entry of entries) {
    entry.markerEl?.remove();
    entry.markerEl = null;
  }
  entries.length = 0;
}
