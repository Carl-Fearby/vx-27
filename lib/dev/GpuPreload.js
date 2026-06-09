import * as THREE from "three";
import {
  renderCrosshairPass,
  renderSceneWithLayeredLighting,
  renderViewmodelPass,
  resetCameraRenderLayers,
  syncLightLayersForZone,
  syncOilBarrelFireLightLayers,
} from "../lighting/SceneEnvironment.js";
import { renderTargetHealthBarsPass } from "../combat/Targets.js";
import {
  applyFrameShadowUpdates,
  requestShadowMapUpdate,
} from "../lighting/ShadowUpdatePolicy.js";
import { tickOilBarrelInteriorVideo } from "../oil-barrel/OilBarrelInteriorVideo.js";
import { updateRoomCulling } from "../rooms/RoomCulling.js";
import { getStairFullClimbPathSegments } from "../stairs/LevelStairs.js";
import {
  isIndoorLightingZone,
  getArenaDoorInnerZ,
  getAttachedRoomCenterZ,
} from "../rooms/RoomPlacement.js";
import {
  resolveViewmodelLightingZone,
} from "../lighting/LightingZones.js";
import { resolveVx27ContainerForPlayer } from "../vx27-container/Vx27Container.js";
import { warmHeadshotRagdollGpu } from "../combat/Targets.js";
import {
  buildVx27ContainerCullables,
  updateVx27ContainerCulling,
} from "../vx27-container/Vx27ContainerCulling.js";

/** Load-screen GPU bake — compile + draw with the real gameplay render path. No shadow/material reset afterward. */
export const GPU_PRELOAD_ENABLED = true;

/** Loading overlay copy — keep in sync with FpsGame reportLoad labels. */
export const GPU_PRELOAD_LOAD_LABEL = "GPU preload";
export const GPU_PRELOAD_READY_LABEL = "GPU preload ready";
export const GPU_PRELOAD_SKIPPED_LABEL = "GPU preload skipped";

/** Container interior pass baked during load. */
export const VX27_CONTAINER_GPU_WARM_SIM_SEC = 0.5;
export const VX27_CONTAINER_GPU_WARM_FRAMES = 8;

export function getGpuPreloadLoadLabel(enabled = GPU_PRELOAD_ENABLED) {
  return enabled ? GPU_PRELOAD_LOAD_LABEL : GPU_PRELOAD_SKIPPED_LABEL;
}

const FLOOR_DOOR_DELTAS = [-1.5, -1.0, -0.55, -0.25, -0.08, 0.08, 0.25, 0.55, 0.9, 1.35];
const _lookTarget = new THREE.Vector3();
const _pathPos = new THREE.Vector3();
const _pathFromLook = new THREE.Vector3();
const _pathToLook = new THREE.Vector3();

/** @type {WeakMap<THREE.Object3D, { visible: boolean, frustumCulled: boolean }[]>} */
const _drawStateCache = new WeakMap();

/** Bumped on HMR / level teardown so in-flight preload stops touching disposed renderers. */
let _gpuPreloadEpoch = 0;

export function resetGameGpuPreload() {
  _gpuPreloadEpoch += 1;
}

/** @param {THREE.WebGLRenderer | null | undefined} renderer */
function isRendererUsable(renderer) {
  if (!renderer) return false;
  try {
    const gl = renderer.getContext?.();
    return !!(gl && gl.isContextLost?.() !== true);
  } catch {
    return false;
  }
}

/**
 * @param {{ epoch?: number, isActive?: () => boolean, renderer?: THREE.WebGLRenderer }} ctx
 */
function gpuPreloadActive(ctx) {
  if (ctx.epoch != null && ctx.epoch !== _gpuPreloadEpoch) return false;
  if (ctx.isActive?.() === false) return false;
  if (!isRendererUsable(ctx.renderer)) return false;
  return true;
}

/**
 * Upload decoded textures to GPU memory before first gameplay draw.
 * @param {THREE.WebGLRenderer | null | undefined} renderer
 * @param {Iterable<THREE.Texture | null | undefined>} textures
 */
export function initTexturesOnGpu(renderer, textures) {
  if (!renderer || typeof renderer.initTexture !== "function") return;
  for (const tex of textures) {
    if (tex?.isTexture) renderer.initTexture(tex);
  }
}

/**
 * Collect unique textures referenced by mesh materials under `root`.
 * @param {THREE.Object3D | null | undefined} root
 * @returns {THREE.Texture[]}
 */
export function collectObjectTextures(root) {
  /** @type {Set<THREE.Texture>} */
  const found = new Set();
  if (!root) return [];

  root.traverse((obj) => {
    if (!obj.isMesh && !obj.isSprite && !obj.isPoints) return;
    const { material } = obj;
    if (!material) return;
    const mats = Array.isArray(material) ? material : [material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const key of Object.keys(mat)) {
        const value = mat[key];
        if (value?.isTexture) found.add(value);
      }
    }
  });

  return [...found];
}

function captureDrawState(root) {
  if (!root) return [];
  let entries = _drawStateCache.get(root);
  if (entries) return entries;
  entries = [];
  root.traverse((obj) => {
    entries.push({
      obj,
      visible: obj.visible,
      frustumCulled: obj.frustumCulled,
    });
  });
  _drawStateCache.set(root, entries);
  return entries;
}

function setDrawStateVisible(entries) {
  for (const { obj } of entries) {
    obj.visible = true;
    obj.frustumCulled = false;
  }
}

function restoreDrawState(entries) {
  for (const { obj, visible, frustumCulled } of entries) {
    obj.visible = visible;
    obj.frustumCulled = frustumCulled;
  }
}

/**
 * @param {number} [count]
 * @param {{ epoch?: number, isActive?: () => boolean, renderer?: THREE.WebGLRenderer }} [guard]
 */
function awaitFrames(count = 1, guard) {
  let pending = count;
  return new Promise((resolve) => {
    const step = () => {
      if (guard && !gpuPreloadActive(guard)) {
        resolve();
        return;
      }
      pending -= 1;
      if (pending <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {{ epoch?: number, isActive?: () => boolean, renderer?: THREE.WebGLRenderer }} [guard]
 */
async function compileScene(renderer, scene, camera, guard) {
  const ctx = guard ?? { renderer };
  if (!gpuPreloadActive(ctx) || !scene || !camera) return;
  try {
    if (typeof renderer.compileAsync === "function") {
      await renderer.compileAsync(scene, camera);
    } else if (typeof renderer.compile === "function") {
      renderer.compile(scene, camera);
    }
  } catch (err) {
    if (!gpuPreloadActive(ctx)) return;
    console.warn("GPU compile skipped:", err);
  }
}

function setCameraPose(camera, x, eyeY, z, lookX, lookY, lookZ) {
  camera.position.set(x, eyeY, z);
  _lookTarget.set(lookX, lookY, lookZ);
  camera.lookAt(_lookTarget);
  camera.updateMatrixWorld(true);
}

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} spawnX
 * @param {number} spawnEyeY
 * @param {number} spawnZ
 * @param {number} [spawnYaw=0]
 */
function spawnLookAt(camera, spawnX, spawnEyeY, spawnZ, spawnYaw = 0) {
  const lookX = spawnX - Math.sin(spawnYaw) * 3;
  const lookZ = spawnZ - Math.cos(spawnYaw) * 3;
  setCameraPose(camera, spawnX, spawnEyeY, spawnZ, lookX, spawnEyeY, lookZ);
}

/**
 * @returns {{ label: string, x: number, eyeY: number, z: number, footY: number, lookX: number, lookY: number, lookZ: number, frames?: number }[]}
 */
function buildPreloadPoses({
  floorY,
  catwalkDeckY,
  arenaHalf,
  attachWall,
  wallThickness,
  arenaRooms,
  floorExtensions,
  doorwayOpenings = [],
  spawnX,
  spawnEyeY,
  spawnZ,
  spawnFootY,
  spawnYaw = 0,
}) {
  const floorEyeY = spawnEyeY;
  const catwalkEyeY =
    catwalkDeckY != null ? catwalkDeckY + (spawnEyeY - spawnFootY) : floorEyeY;
  const attached = [...(arenaRooms ?? []), ...(floorExtensions ?? [])];
  const spawnLookX = spawnX - Math.sin(spawnYaw) * 3;
  const spawnLookZ = spawnZ - Math.cos(spawnYaw) * 3;

  /** @type {ReturnType<typeof buildPreloadPoses>} */
  const poses = [
    {
      label: "spawn",
      x: spawnX,
      eyeY: spawnEyeY,
      z: spawnZ,
      footY: spawnFootY,
      lookX: spawnLookX,
      lookY: spawnFootY + 1.4,
      lookZ: spawnLookZ,
      frames: 8,
    },
    {
      label: "outdoor_center_north",
      x: 0,
      eyeY: floorEyeY,
      z: 0,
      footY: floorY,
      lookX: 0,
      lookY: floorY + 1.4,
      lookZ: attachWall === "north" ? -arenaHalf : arenaHalf,
      frames: 4,
    },
  ];

  if (attached.length === 0) return poses;

  const space = attached[0];
  const roomCenterZ = getAttachedRoomCenterZ(
    space,
    arenaHalf,
    attachWall,
    wallThickness
  );
  const arenaInnerZ = getArenaDoorInnerZ(attachWall, arenaHalf, wallThickness);
  const towardArena = (delta) =>
    attachWall === "north" ? arenaInnerZ + delta : arenaInnerZ - delta;

  poses.push({
    label: "room_interior",
    x: space.centerX ?? 0,
    eyeY: floorEyeY,
    z: roomCenterZ,
    footY: floorY,
    lookX: space.centerX ?? 0,
    lookY: floorY + 1.4,
    lookZ: roomCenterZ + (attachWall === "north" ? -2 : 2),
    frames: 4,
  });

  const doorXs = doorwayOpenings.length
    ? [...new Set(doorwayOpenings.map((o) => o.centerX ?? 0))]
    : [space.centerX ?? 0];

  for (const doorX of doorXs) {
    for (const delta of FLOOR_DOOR_DELTAS) {
      const z = towardArena(delta);
      poses.push({
        label: `door_floor_${doorX}_${delta.toFixed(2)}`,
        x: doorX,
        eyeY: floorEyeY,
        z,
        footY: floorY,
        lookX: doorX,
        lookY: floorY + 1.4,
        lookZ: z + (attachWall === "north" ? -2 : 2),
        frames: 5,
      });
    }
  }

  if (catwalkDeckY != null) {
    for (const doorX of doorXs) {
      for (const delta of [-0.15, 0.35, 2.5, 5.5]) {
        const z = towardArena(delta);
        poses.push({
          label: `catwalk_${doorX}_${delta}`,
          x: doorX,
          eyeY: catwalkEyeY,
          z,
          footY: catwalkDeckY,
          lookX: doorX,
          lookY: catwalkDeckY + 1.4,
          lookZ: z + (attachWall === "north" ? -2 : 2),
          frames: 4,
        });
      }
    }
  }

  return poses;
}

/**
 * @param {object} ctx
 * @param {number} px
 * @param {number} pz
 * @param {number} py
 */
function applyZoneState(ctx, px, pz, py) {
  const {
    camera,
    level,
    roomCullables,
    arenaHalf,
    attachWall,
    catwalkDeckY,
    doorwayOpenings,
    wallThickness,
    arenaRooms,
    floorExtensions,
    scene,
    outdoorLights,
    roomLights,
    oilBarrelFireLights,
  } = ctx;

  let visibleCount = 0;
  if (roomCullables?.length) {
    ({ visibleCount } = updateRoomCulling(
      roomCullables,
      camera,
      { x: px, z: pz, footY: py },
      arenaHalf,
      attachWall,
      catwalkDeckY,
      doorwayOpenings,
      wallThickness
    ));
  }
  const inRoomBody = isIndoorLightingZone(
    px,
    pz,
    py,
    arenaRooms,
    arenaHalf,
    attachWall,
    catwalkDeckY,
    doorwayOpenings,
    wallThickness,
    floorExtensions
  );
  let inContainerPass = false;
  if (ctx.vx27ContainerCullables?.length) {
    ({ anyVisible: inContainerPass } = updateVx27ContainerCulling(
      ctx.vx27ContainerCullables,
      camera,
      null
    ));
  }
  const inRoomPass = inRoomBody || visibleCount > 0 || inContainerPass;
  const viewmodelLightingZone = resolveViewmodelLightingZone({
    x: px,
    z: pz,
    footY: py,
    rooms: arenaRooms,
    arenaHalf,
    attachWall,
    arenaWallThickness: wallThickness,
    catwalkDeckY,
    colliders: ctx.level?.colliders ?? ctx.colliders ?? [],
  });
  syncLightLayersForZone(scene, viewmodelLightingZone, outdoorLights, roomLights);
  if (oilBarrelFireLights.length > 0) {
    syncOilBarrelFireLightLayers(
      oilBarrelFireLights,
      viewmodelLightingZone === "room"
    );
  }
  return { inRoomPass, viewmodelLightingZone, visibleCount };
}

/** One gameplay frame — mirrors the main loop's render + shadow path. */
function renderGameplayFrame(ctx, skipRoomPass) {
  if (!gpuPreloadActive(ctx)) return;
  const { renderer, scene, camera, level, weapon, sky, getShadowFrameOpts } = ctx;

  if (typeof getShadowFrameOpts === "function") {
    applyFrameShadowUpdates(renderer, getShadowFrameOpts());
  } else {
    requestShadowMapUpdate(renderer);
  }

  sky?.update?.(camera);
  if (level?.group) {
    tickOilBarrelInteriorVideo(camera, level.group);
  }

  resetCameraRenderLayers(camera);
  renderSceneWithLayeredLighting(renderer, scene, camera, {
    skyRoot: sky?.mesh ?? null,
    skipRoomPass,
  });
  if (level?.targets?.length) {
    renderTargetHealthBarsPass(renderer, scene, camera, level.targets);
  }
  if (weapon?.holder) {
    weapon.holder.visible = true;
    renderCrosshairPass(renderer, scene, camera);
    renderViewmodelPass(renderer, scene, camera);
  }
}

/**
 * @param {object} ctx
 * @param {{ x: number, eyeY: number, z: number, footY: number, lookX: number, lookY: number, lookZ: number, frames?: number }} pose
 */
async function warmPose(ctx, pose) {
  if (!gpuPreloadActive(ctx)) return;
  const { renderer, scene, camera } = ctx;
  const frames = pose.frames ?? 3;

  setCameraPose(
    camera,
    pose.x,
    pose.eyeY,
    pose.z,
    pose.lookX,
    pose.lookY,
    pose.lookZ
  );
  const { inRoomPass } = applyZoneState(ctx, pose.x, pose.z, pose.footY);
  await compileScene(renderer, scene, camera, ctx);
  for (let i = 0; i < frames; i += 1) {
    if (!gpuPreloadActive(ctx)) return;
    renderGameplayFrame(ctx, !inRoomPass);
    await awaitFrames(1, ctx);
  }
}

const _vx27WarmWorldPos = new THREE.Vector3();

/**
 * Camera poses that hit container exterior + interior room pass.
 * @param {THREE.Object3D[]} containers
 * @param {number} standEye
 */
function buildVx27ContainerWarmPoses(containers, standEye) {
  /** @type {{ label: string, x: number, eyeY: number, z: number, footY: number, lookX: number, lookY: number, lookZ: number }[]} */
  const poses = [];
  for (const container of containers) {
    if (!container?.isObject3D) continue;
    container.updateMatrixWorld(true);
    container.getWorldPosition(_vx27WarmWorldPos);
    const footY = _vx27WarmWorldPos.y;
    const eyeY = footY + standEye;
    const rotY = container.rotation.y;
    const length = container.userData.vx27Length ?? 12;
    const sinR = Math.sin(rotY);
    const cosR = Math.cos(rotY);
    const outDist = length * 0.5 + 2.8;
    const lookAhead = 2.2;

    poses.push({
      label: `vx27_outside_${container.userData.vx27PropId ?? "prop"}`,
      x: _vx27WarmWorldPos.x + sinR * outDist,
      eyeY,
      z: _vx27WarmWorldPos.z + cosR * outDist,
      footY,
      lookX: _vx27WarmWorldPos.x + sinR * lookAhead,
      lookY: eyeY,
      lookZ: _vx27WarmWorldPos.z + cosR * lookAhead,
    });
    poses.push({
      label: `vx27_inside_${container.userData.vx27PropId ?? "prop"}`,
      x: _vx27WarmWorldPos.x,
      eyeY,
      z: _vx27WarmWorldPos.z,
      footY: footY + 0.05,
      lookX: _vx27WarmWorldPos.x + sinR * lookAhead,
      lookY: eyeY,
      lookZ: _vx27WarmWorldPos.z + cosR * lookAhead,
    });
  }
  return poses;
}

/** @param {import("../vx27-container/Vx27ContainerCulling.js").Vx27ContainerCullable[]} cullables */
function forceVx27ContainerCullablesVisible(cullables) {
  for (const cullable of cullables) {
    cullable.visible = true;
    cullable.container.userData.vx27CullVisible = true;
    if (cullable.interior) cullable.interior.visible = true;
  }
}

/**
 * Render container interior pass on the load screen so room shaders compile before gameplay.
 * @param {Parameters<typeof warmPose>[0]} ctx
 */
async function warmVx27ContainerSystems(ctx) {
  if (!gpuPreloadActive(ctx)) return;
  const containers = ctx.level?.vx27ContainerMeshes ?? [];
  if (!containers.length) return;

  const { renderer, scene, camera, spawnEyeY, spawnFootY, spawnX, spawnZ, spawnYaw = 0 } =
    ctx;
  const standEye = spawnEyeY - spawnFootY;
  const cullables =
    ctx.vx27ContainerCullables ?? buildVx27ContainerCullables(containers);
  ctx.vx27ContainerCullables = cullables;

  const warmPoses = [
    {
      label: "vx27_spawn_view",
      x: spawnX,
      eyeY: spawnEyeY,
      z: spawnZ,
      footY: spawnFootY,
      lookX: spawnX - Math.sin(spawnYaw) * 3,
      lookY: spawnEyeY,
      lookZ: spawnZ - Math.cos(spawnYaw) * 3,
    },
    ...buildVx27ContainerWarmPoses(containers, standEye),
  ];

  const framesPerPose = Math.max(
    8,
    Math.ceil(VX27_CONTAINER_GPU_WARM_FRAMES / warmPoses.length)
  );
  const dt = VX27_CONTAINER_GPU_WARM_SIM_SEC / VX27_CONTAINER_GPU_WARM_FRAMES;
  let timeSec = performance.now() * 0.001;

  for (const pose of warmPoses) {
    if (!gpuPreloadActive(ctx)) return;
    setCameraPose(
      camera,
      pose.x,
      pose.eyeY,
      pose.z,
      pose.lookX,
      pose.lookY,
      pose.lookZ
    );
    forceVx27ContainerCullablesVisible(cullables);
    await compileScene(renderer, scene, camera, ctx);

    for (let i = 0; i < framesPerPose; i += 1) {
      if (!gpuPreloadActive(ctx)) return;
      timeSec += dt;
      applyZoneState(ctx, pose.x, pose.z, pose.footY);
      renderGameplayFrame(ctx, false);
      await awaitFrames(1, ctx);
    }
  }

  await warmContainerTargetRagdolls(ctx, containers, warmPoses, cullables);
}

/**
 * Pre-bake head-ragdoll GPU path for every target standing inside each container.
 * @param {Parameters<typeof warmPose>[0]} ctx
 * @param {THREE.Object3D[]} containers
 * @param {ReturnType<typeof buildVx27ContainerWarmPoses>} warmPoses
 * @param {import("../vx27-container/Vx27ContainerCulling.js").Vx27ContainerCullable[]} cullables
 */
async function warmContainerTargetRagdolls(ctx, containers, warmPoses, cullables) {
  if (!gpuPreloadActive(ctx)) return;
  const { renderer, scene, camera, level } = ctx;
  const targets = (level?.targets ?? []).filter((m) => m?.userData?.isTarget);
  const colliders = level?.colliders ?? [];
  if (!targets.length) return;

  const insidePoses = warmPoses.filter((pose) =>
    pose.label.startsWith("vx27_inside_")
  );
  for (const pose of insidePoses) {
    if (!gpuPreloadActive(ctx)) return;
    const propId = pose.label.slice("vx27_inside_".length);
    const container = containers.find(
      (c) => (c.userData?.vx27PropId ?? "prop") === propId
    );
    if (!container) continue;

    const inContainer = targets.filter((mesh) => {
      const match = resolveVx27ContainerForPlayer(
        mesh.position.x,
        mesh.position.z,
        containers,
        colliders
      );
      return match === container;
    });
    if (!inContainer.length) continue;

    setCameraPose(
      camera,
      pose.x,
      pose.eyeY,
      pose.z,
      pose.lookX,
      pose.lookY,
      pose.lookZ
    );
    forceVx27ContainerCullablesVisible(cullables);
    await compileScene(renderer, scene, camera, ctx);

    for (const mesh of inContainer) {
      if (!gpuPreloadActive(ctx)) return;
      warmHeadshotRagdollGpu(scene, mesh, { hide: true });
      mesh.userData.predictiveKillGpuWarmed = true;
      for (let i = 0; i < 4; i += 1) {
        if (!gpuPreloadActive(ctx)) return;
        applyZoneState(ctx, pose.x, pose.z, pose.footY);
        renderGameplayFrame(ctx, false);
        await awaitFrames(1, ctx);
      }
    }
  }
}

/**
 * Pre-bake ragdoll GPU for every live target at spawn (outdoor / general kills).
 * @param {Parameters<typeof warmPose>[0]} ctx
 */
async function warmAllTargetRagdollsAtSpawn(ctx) {
  if (!gpuPreloadActive(ctx)) return;
  const targets = (ctx.level?.targets ?? []).filter((m) => m?.userData?.isTarget);
  if (!targets.length) return;

  const { scene, spawnX, spawnZ, spawnFootY } = ctx;
  for (const mesh of targets) {
    if (!gpuPreloadActive(ctx)) return;
    warmHeadshotRagdollGpu(scene, mesh, { hide: true });
    mesh.userData.predictiveKillGpuWarmed = true;
    applyZoneState(ctx, spawnX, spawnZ, spawnFootY);
    renderGameplayFrame(ctx, false);
    await awaitFrames(1, ctx);
  }
}

async function warmStairClimb(ctx) {
  if (!gpuPreloadActive(ctx)) return;
  const { renderer, scene, camera, stairPlacement, catwalkDeckY, primeDirectionalShadow } =
    ctx;
  const segments = getStairFullClimbPathSegments(
    stairPlacement,
    catwalkDeckY,
    ctx.spawnEyeY - ctx.spawnFootY
  );
  if (!segments.length) return;

  if (typeof primeDirectionalShadow === "function") {
    primeDirectionalShadow();
  }

  for (const seg of segments) {
    if (!gpuPreloadActive(ctx)) return;
    _pathFromLook.set(seg.from.lookX, seg.from.lookY, seg.from.lookZ);
    _pathToLook.set(seg.to.lookX, seg.to.lookY, seg.to.lookZ);
    const segFrames = Math.max(2, Math.ceil(seg.frames / 4));
    for (let i = 0; i < segFrames; i += 1) {
      const hold =
        seg.from.x === seg.to.x &&
        seg.from.z === seg.to.z &&
        seg.from.eyeY === seg.to.eyeY;
      const t = hold ? 1 : (i + 1) / segFrames;
      _pathPos.set(
        THREE.MathUtils.lerp(seg.from.x, seg.to.x, t),
        THREE.MathUtils.lerp(seg.from.eyeY, seg.to.eyeY, t),
        THREE.MathUtils.lerp(seg.from.z, seg.to.z, t)
      );
      camera.position.copy(_pathPos);
      _lookTarget.lerpVectors(_pathFromLook, _pathToLook, t);
      camera.lookAt(_lookTarget);
      camera.updateMatrixWorld(true);

      const standEye = ctx.spawnEyeY - ctx.spawnFootY;
      const footY = Math.max(ctx.floorY, _pathPos.y - standEye);
      const { inRoomPass } = applyZoneState(ctx, _pathPos.x, _pathPos.z, footY);
      if (i === 0 || i === segFrames - 1) {
        await compileScene(renderer, scene, camera, ctx);
      }
      renderGameplayFrame(ctx, !inRoomPass);
      await awaitFrames(1, ctx);
    }
  }
}

/**
 * Bake shaders, geometry, and textures into GPU memory on the loading screen.
 */
export async function preloadGameGpu({
  renderer,
  scene,
  camera,
  level,
  weapon,
  sky,
  outdoorLights = [],
  roomLights = [],
  oilBarrelFireLights = [],
  doorwayOpenings = [],
  catwalkDeckY = null,
  stairPlacement = null,
  arenaHalf = 14,
  attachWall = "north",
  arenaRooms = [],
  floorExtensions = [],
  roomCullables = [],
  vx27ContainerCullables = [],
  wallThickness = 0.5,
  floorY = 0,
  spawnX = 0,
  spawnEyeY = 1.65,
  spawnZ = 6,
  spawnFootY = 0,
  spawnYaw = 0,
  primeDirectionalShadow = null,
  getShadowFrameOpts = null,
  applyDayNightNightness = null,
  initialDayNightNightness = 0,
  extraTextures = [],
  isActive,
}) {
  if (!GPU_PRELOAD_ENABLED || !renderer || !scene || !camera) return;
  const epoch = _gpuPreloadEpoch;
  if (isActive?.() === false) return;

  const roots = [
    level?.group,
    level?.pickupsGroup,
    sky?.mesh,
    weapon?.holder,
    ...(level?.targets ?? []),
  ];
  const textureList = [];
  for (const root of roots) {
    textureList.push(...collectObjectTextures(root));
  }
  textureList.push(...extraTextures);
  initTexturesOnGpu(renderer, textureList);

  const drawEntries = roots.flatMap((root) => captureDrawState(root));
  setDrawStateVisible(drawEntries);

  /** @type {Parameters<typeof warmPose>[0]} */
  const ctx = {
    renderer,
    scene,
    camera,
    level,
    weapon,
    sky,
    outdoorLights,
    roomLights,
    oilBarrelFireLights,
    doorwayOpenings,
    catwalkDeckY,
    stairPlacement,
    arenaHalf,
    attachWall,
    arenaRooms,
    floorExtensions,
    roomCullables,
    vx27ContainerCullables,
    wallThickness,
    floorY,
    spawnX,
    spawnEyeY,
    spawnZ,
    spawnFootY,
    spawnYaw,
    primeDirectionalShadow,
    getShadowFrameOpts,
    isActive,
    epoch,
  };

  const makeRenderFrame = (skipRoomPass) => (r, s, c) => {
    renderGameplayFrame({ ...ctx, renderer: r, scene: s, camera: c }, skipRoomPass);
  };

  try {
    if (typeof applyDayNightNightness === "function") {
      applyDayNightNightness(initialDayNightNightness);
    }
    if (typeof primeDirectionalShadow === "function") {
      primeDirectionalShadow();
    }
    requestShadowMapUpdate(renderer);
    await compileScene(renderer, scene, camera, ctx);

    const poses = buildPreloadPoses({
      floorY,
      catwalkDeckY,
      arenaHalf,
      attachWall,
      wallThickness,
      arenaRooms,
      floorExtensions,
      doorwayOpenings,
      spawnX,
      spawnEyeY,
      spawnZ,
      spawnFootY,
      spawnYaw,
    });

    for (const pose of poses) {
      if (!gpuPreloadActive(ctx)) return;
      await warmPose(ctx, pose);
    }

    if (stairPlacement && catwalkDeckY != null) {
      if (!gpuPreloadActive(ctx)) return;
      await warmStairClimb(ctx);
    }

    if (level?.vx27ContainerMeshes?.length) {
      if (!gpuPreloadActive(ctx)) return;
      await warmVx27ContainerSystems(ctx);
    }

    if (!gpuPreloadActive(ctx)) return;
    await warmAllTargetRagdollsAtSpawn(ctx);

    if (!gpuPreloadActive(ctx)) return;
    spawnLookAt(camera, spawnX, spawnEyeY, spawnZ, spawnYaw);
    applyZoneState(ctx, spawnX, spawnZ, spawnFootY);
    await compileScene(renderer, scene, camera, ctx);

    if (typeof weapon?.preloadFlashlightGpu === "function") {
      await weapon.preloadFlashlightGpu(renderer, scene, camera, {
        frames: 8,
        renderFrame: makeRenderFrame(false),
      });
    }
    if (typeof weapon?.preloadMuzzleFlashGpu === "function") {
      await weapon.preloadMuzzleFlashGpu(renderer, scene, camera, {
        frames: 2,
        renderFrame: makeRenderFrame(false),
      });
    }

    for (let i = 0; i < 6; i += 1) {
      if (!gpuPreloadActive(ctx)) return;
      const { inRoomPass } = applyZoneState(ctx, spawnX, spawnZ, spawnFootY);
      renderGameplayFrame(ctx, !inRoomPass);
      await awaitFrames(1, ctx);
    }
  } finally {
    if (gpuPreloadActive(ctx)) {
      restoreDrawState(drawEntries);
      spawnLookAt(camera, spawnX, spawnEyeY, spawnZ, spawnYaw);
      applyZoneState(ctx, spawnX, spawnZ, spawnFootY);
    }
  }

  await awaitFrames(2, ctx);
}

/**
 * After day/night or pickup-shadow refresh, render a few spawn frames so the
 * first gameplay frame does not pay shader/shadow recompile.
 */
export async function settleGpuSpawnAfterLoad({
  renderer,
  scene,
  camera,
  level,
  weapon,
  sky,
  outdoorLights = [],
  roomLights = [],
  oilBarrelFireLights = [],
  doorwayOpenings = [],
  catwalkDeckY = null,
  arenaHalf = 14,
  attachWall = "north",
  arenaRooms = [],
  floorExtensions = [],
  roomCullables = [],
  vx27ContainerCullables = [],
  wallThickness = 0.5,
  floorY = 0,
  spawnX = 0,
  spawnEyeY = 1.65,
  spawnZ = 6,
  spawnFootY = 0,
  spawnYaw = 0,
  getShadowFrameOpts = null,
  frames = 4,
  isActive,
}) {
  if (!renderer || !scene || !camera) return;
  const epoch = _gpuPreloadEpoch;
  if (isActive?.() === false) return;

  const ctx = {
    renderer,
    scene,
    camera,
    level,
    weapon,
    sky,
    outdoorLights,
    roomLights,
    oilBarrelFireLights,
    doorwayOpenings,
    catwalkDeckY,
    arenaHalf,
    attachWall,
    arenaRooms,
    floorExtensions,
    roomCullables,
    vx27ContainerCullables,
    wallThickness,
    floorY,
    spawnX,
    spawnEyeY,
    spawnZ,
    spawnFootY,
    spawnYaw,
    getShadowFrameOpts,
    isActive,
    epoch,
  };

  if (!gpuPreloadActive(ctx)) return;
  spawnLookAt(camera, spawnX, spawnEyeY, spawnZ, spawnYaw);
  await compileScene(renderer, scene, camera, ctx);
  for (let i = 0; i < frames; i += 1) {
    if (!gpuPreloadActive(ctx)) return;
    const { inRoomPass } = applyZoneState(ctx, spawnX, spawnZ, spawnFootY);
    renderGameplayFrame(ctx, !inRoomPass);
    await awaitFrames(1, ctx);
  }
}
