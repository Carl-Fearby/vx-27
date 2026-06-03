import * as THREE from "three";
import {
  spawnAmmoDrop,
  resyncPickupShadowCaster,
  disposeAmmoPickupMeshShadow,
  disposeOrphanedPickupShadowCasters,
} from "../pickups/AmmoCrate.js";
import {
  spawnBloodSplatter,
  disposeAllBloodSplatters,
  warmupBloodMarksGpu,
} from "../combat/BloodParticles.js";
import { warmupBulletHolesGpu } from "../combat/BulletHoles.js";
import {
  spawnGrenadeDrop,
  disposeGrenadeModel,
  warmupGrenadeThrow,
  clearExplosionPool,
} from "../combat/Grenade.js";
import {
  warmupRewardFlashGpu,
  ensureRewardOwnMaterials,
  ensureTraverseOwnMaterials,
} from "../pickups/RewardFlash.js";
import { getMaterials as getAmmoMaterials } from "../pickups/AmmoCrate.js";
import {
  spawnHpOrb,
  prebuildRagdollTemplates,
  buildWarmupRagdoll,
  disposeWarmupRagdoll,
  renderTargetHealthBarsPass,
  warmupTargetHealthBarGpu,
  getOrbMaterials,
  startDeathAnimation,
  flushPendingRagdolls,
  updateDeathAnimations,
} from "../combat/Targets.js";
import {
  renderSceneWithLayeredLighting,
  resetCameraRenderLayers,
  finalizeGpuWarmupRendererState,
  renderViewmodelPass,
  syncLightLayersForZone,
  syncOilBarrelFireLightLayers,
} from "../lighting/SceneEnvironment.js";
import {
  refreshOilBarrelFireLights,
  setBarrelFireLightShadowsEnabled,
} from "../oil-barrel/OilBarrelFireLight.js";
import { getOilBarrelTuning } from "../oil-barrel/OilBarrel.js";
import { tickOilBarrelInteriorVideo } from "../oil-barrel/OilBarrelInteriorVideo.js";
import { warmupBulletMaterialsGpu } from "../weapons/ViewWeapon.js";
import {
  getStairFullClimbPathSegments,
} from "../stairs/LevelStairs.js";
import {
  setAllLevelRoomSunOccludersCast,
  updateRoomCulling,
} from "../rooms/RoomCulling.js";
import { requestShadowMapUpdate } from "../lighting/ShadowUpdatePolicy.js";
import { areShadowsDisabled } from "./ShadowDebug.js";
import {
  getArenaDoorInnerZ,
  isIndoorLightingZone,
  isPointInsideAttachedRoom,
  resolveViewmodelIndoorLightingZone,
} from "../rooms/RoomPlacement.js";

/** Load-screen GPU warmup. Off — warmup + finalizeGpuWarmupRendererState was forcing a
 *  full material/shadow recompile on first gameplay frame (stair hitch ~600ms). Without
 *  warmup the one-time cost is much smaller. Set true only after trimming finalize/recompile. */
export const GPU_WARMUP_ENABLED = false;

let _gameGpuWarmed = false;

const _warmupKillDir = new THREE.Vector3(0, 0, -1);
const _pathPos = new THREE.Vector3();
const _pathLook = new THREE.Vector3();
const _pathFromLook = new THREE.Vector3();
const _pathToLook = new THREE.Vector3();

/**
 * Prime north-wall proximity: room peek zone toggles and skipRoomPass while
 * standing on the catwalk near door openings (x=0 and offset arch).
 */
async function warmupArenaWallProximity({
  renderer,
  scene,
  camera,
  levelGroup,
  rooms,
  roomCullables,
  doorwayOpenings,
  catwalkDeckY,
  arenaHalf,
  attachWall,
  wallThickness,
  wallStandoff,
  outdoor,
  roomLights,
  oilBarrelFireLights,
  renderWithRoom,
  renderOutdoorOnly,
}) {
  if (
    !renderer ||
    !levelGroup ||
    !rooms?.length ||
    catwalkDeckY == null ||
    !doorwayOpenings?.length
  ) {
    return;
  }

  const innerHalf = arenaHalf - wallStandoff;
  const eyeY = catwalkDeckY + 1.62;
  const footY = catwalkDeckY;
  const zNearWall =
    attachWall === "north" ? -innerHalf + 0.65 : innerHalf - 0.65;
  const zAtWallMouth =
    attachWall === "north"
      ? getArenaDoorInnerZ(attachWall, arenaHalf, wallThickness) - 0.05
      : getArenaDoorInnerZ(attachWall, arenaHalf, wallThickness) + 0.05;

  const savedPos = camera.position.clone();
  const savedQuat = camera.quaternion.clone();
  const room = rooms[0];

  const applyRuntimeState = (px, pz, py) => {
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
    const indoorBody = isIndoorLightingZone(
      px,
      pz,
      py,
      rooms,
      arenaHalf,
      attachWall,
      catwalkDeckY,
      doorwayOpenings,
      wallThickness
    );
    const indoor = resolveViewmodelIndoorLightingZone(
      indoorBody,
      visibleCount,
      px,
      pz,
      rooms,
      [],
      arenaHalf,
      attachWall,
      wallThickness
    );
    syncLightLayersForZone(scene, indoor, outdoor, roomLights);
    if (oilBarrelFireLights.length > 0) {
      syncOilBarrelFireLightLayers(oilBarrelFireLights, indoor);
    }
    const insideFloor =
      isPointInsideAttachedRoom(px, pz, room, arenaHalf, attachWall, wallThickness) &&
      py < catwalkDeckY - 0.5;
    setAllLevelRoomSunOccludersCast(levelGroup, insideFloor);
    requestShadowMapUpdate(renderer);
    return { visibleCount };
  };

  const renderFrames = async (count, renderFrame) => {
    for (let i = 0; i < count; i += 1) {
      renderFrame(renderer, scene, camera);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  };

  try {
    for (const opening of doorwayOpenings) {
      camera.position.set(opening.centerX, eyeY, zAtWallMouth);
      let state = applyRuntimeState(opening.centerX, zAtWallMouth, footY);
      await renderFrames(6, state.visibleCount === 0 ? renderOutdoorOnly : renderWithRoom);
    }

    camera.position.set(5.5, eyeY, zNearWall);
    let offDoor = applyRuntimeState(5.5, zNearWall, footY);
    await renderFrames(4, offDoor.visibleCount === 0 ? renderOutdoorOnly : renderWithRoom);

    camera.position.set(0, eyeY, zNearWall);
    offDoor = applyRuntimeState(0, zNearWall, footY);
    await renderFrames(4, offDoor.visibleCount === 0 ? renderOutdoorOnly : renderWithRoom);
  } finally {
    camera.position.copy(savedPos);
    camera.quaternion.copy(savedQuat);
  }
}

/** Deferred ragdoll spawn + kill blood — matches the second kill hitch path. */
async function warmupDeferredKillGpu({
  renderer,
  scene,
  camera,
  target,
  renderFrame,
  floorY,
  colliders,
  bounds,
  warmPos,
  hitZone = "body",
}) {
  if (!target || !renderer || !scene || !camera || !renderFrame) return;

  const ud = target.userData;
  const savedPos = target.position.clone();
  const savedRotY = target.rotation.y;
  const savedVisible = target.visible;
  const savedHealth = ud.health;
  const savedDying = ud.dying;
  const collider = ud.collider;
  const savedCollider = collider
    ? {
        active: collider.active,
        halfX: collider.halfX,
        halfZ: collider.halfZ,
      }
    : null;

  const splatters = [];
  try {
    target.position.copy(warmPos());
    target.visible = true;
    ud.health = 0;
    startDeathAnimation(target, _warmupKillDir, {
      scene,
      colliders,
      floorY,
      bounds,
      hitZone,
      hitPoint: target.position.clone(),
    });
    flushPendingRagdolls(1);

    for (let i = 0; i < 8; i += 1) {
      updateDeathAnimations([target], 1 / 60, () => {}, {
        colliders,
        floorY,
        bounds,
      });
      renderFrame(renderer, scene, camera);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    if (ud.ragdoll?.rootGroup) {
      const splatter = spawnBloodSplatter(
        scene,
        target.position.clone(),
        _warmupKillDir,
        50
      );
      if (splatter) {
        splatters.push(splatter);
        for (let i = 0; i < 3; i += 1) {
          renderFrame(renderer, scene, camera);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }
    }
  } finally {
    if (ud.ragdoll) {
      disposeWarmupRagdoll(ud.ragdoll);
      ud.ragdoll = null;
    }
    ud.dying = savedDying;
    ud.ragdollPending = false;
    ud.health = savedHealth;
    target.position.copy(savedPos);
    target.rotation.y = savedRotY;
    target.visible = savedVisible;
    if (collider && savedCollider) {
      collider.active = savedCollider.active;
      collider.halfX = savedCollider.halfX;
      collider.halfZ = savedCollider.halfZ;
    }
    disposeAllBloodSplatters(splatters, scene);
  }
}

/**
 * Prime the full catwalk exit: floor → door mouth (room pass on) → past footprint
 * (room pass off). Uses the same skipRoomPass rule as gameplay (visibleRoomCount).
 */
async function warmupRoomCatwalkExitTransition({
  renderer,
  scene,
  camera,
  levelGroup,
  rooms,
  roomCullables,
  doorwayOpenings,
  catwalkDeckY,
  arenaHalf,
  attachWall,
  wallThickness,
  outdoor,
  roomLights,
  oilBarrelFireLights,
  renderWithRoom,
  renderOutdoorOnly,
}) {
  if (
    !renderer ||
    !scene ||
    !camera ||
    !levelGroup ||
    !rooms?.length ||
    catwalkDeckY == null ||
    !doorwayOpenings?.length ||
    roomLights.length === 0
  ) {
    return;
  }

  const room = rooms[0];
  const footY = catwalkDeckY;
  const eyeY = catwalkDeckY + 1.62;
  const arenaInnerZ = getArenaDoorInnerZ(attachWall, arenaHalf, wallThickness);
  const towardArena = (delta) =>
    attachWall === "north" ? arenaInnerZ + delta : arenaInnerZ - delta;
  const zInsideFloor = towardArena(-1.4);
  const zCatwalkDeep = towardArena(-1.0);
  const zCatwalkMouth = towardArena(-0.15);
  const zJustPastFootprint = towardArena(0.35);
  const zPastRoomOnCatwalk = towardArena(2.5);
  const zDeepOnCatwalk = towardArena(5.5);

  const savedPos = camera.position.clone();
  const savedQuat = camera.quaternion.clone();

  const applyRuntimeState = (px, pz, py) => {
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
    const indoorBody = isIndoorLightingZone(
      px,
      pz,
      py,
      rooms,
      arenaHalf,
      attachWall,
      catwalkDeckY,
      doorwayOpenings,
      wallThickness
    );
    const indoor = resolveViewmodelIndoorLightingZone(
      indoorBody,
      visibleCount,
      px,
      pz,
      rooms,
      [],
      arenaHalf,
      attachWall,
      wallThickness
    );
    syncLightLayersForZone(scene, indoor, outdoor, roomLights);
    if (oilBarrelFireLights.length > 0) {
      syncOilBarrelFireLightLayers(oilBarrelFireLights, indoor);
    }
    const insideFloor =
      isPointInsideAttachedRoom(px, pz, room, arenaHalf, attachWall, wallThickness) &&
      py < catwalkDeckY - 0.5;
    setAllLevelRoomSunOccludersCast(levelGroup, insideFloor);
    requestShadowMapUpdate(renderer);
    return { indoor, visibleCount };
  };

  const renderForState = (visibleCount) =>
    visibleCount === 0 ? renderOutdoorOnly : renderWithRoom;

  const renderFrames = async (count, renderFrame) => {
    for (let i = 0; i < count; i += 1) {
      renderFrame(renderer, scene, camera);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  };

  const warmExitAlongDoor = async (doorX) => {
    camera.position.set(doorX, eyeY, zCatwalkDeep);
    let state = applyRuntimeState(doorX, zCatwalkDeep, footY);
    await renderFrames(2, renderForState(state.visibleCount));

    camera.position.set(doorX, eyeY, zCatwalkMouth);
    state = applyRuntimeState(doorX, zCatwalkMouth, footY);
    await renderFrames(8, renderForState(state.visibleCount));

    camera.position.set(doorX, eyeY, zJustPastFootprint);
    state = applyRuntimeState(doorX, zJustPastFootprint, footY);
    await renderFrames(12, renderForState(state.visibleCount));

    camera.position.set(doorX, eyeY, zPastRoomOnCatwalk);
    state = applyRuntimeState(doorX, zPastRoomOnCatwalk, footY);
    await renderFrames(8, renderForState(state.visibleCount));
  };

  try {
    camera.position.set(room.centerX ?? 0, 1.62, zInsideFloor);
    const floorState = applyRuntimeState(room.centerX ?? 0, zInsideFloor, 0);
    await renderFrames(4, renderForState(floorState.visibleCount));

    for (const opening of doorwayOpenings) {
      await warmExitAlongDoor(opening.centerX);
    }

    camera.position.set(0, eyeY, zDeepOnCatwalk);
    const deepState = applyRuntimeState(0, zDeepOnCatwalk, footY);
    await renderFrames(6, renderForState(deepState.visibleCount));
  } finally {
    camera.position.copy(savedPos);
    camera.quaternion.copy(savedQuat);
    syncLightLayersForZone(scene, false, outdoor, roomLights);
    if (oilBarrelFireLights.length > 0) {
      syncOilBarrelFireLightLayers(oilBarrelFireLights, false);
    }
    setAllLevelRoomSunOccludersCast(levelGroup, false);
    if (roomCullables?.length) {
      updateRoomCulling(
        roomCullables,
        camera,
        { x: savedPos.x, z: savedPos.z, footY: 0 },
        arenaHalf,
        attachWall,
        catwalkDeckY,
        doorwayOpenings,
        wallThickness
      );
    }
    requestShadowMapUpdate(renderer);
  }
}

/**
 * One-time stair climb GPU prepay — full ramp → exit with gameplay render path.
 * Must run last (after finalizeGpuWarmupRendererState recompiles materials).
 */
async function warmupStairExitHitchPrepay({
  renderer,
  scene,
  camera,
  stairPlacement,
  catwalkDeckY,
  renderFrame,
  primeDirectionalShadow,
}) {
  const segments = getStairFullClimbPathSegments(stairPlacement, catwalkDeckY);
  if (!renderer || !scene || !camera || !segments.length) return;

  const savedPos = camera.position.clone();
  const savedQuat = camera.quaternion.clone();

  try {
    if (typeof primeDirectionalShadow === "function" && !areShadowsDisabled()) {
      primeDirectionalShadow();
    }

    for (const seg of segments) {
      _pathFromLook.set(seg.from.lookX, seg.from.lookY, seg.from.lookZ);
      _pathToLook.set(seg.to.lookX, seg.to.lookY, seg.to.lookZ);
      for (let i = 0; i < seg.frames; i += 1) {
        const hold =
          seg.from.x === seg.to.x &&
          seg.from.z === seg.to.z &&
          seg.from.eyeY === seg.to.eyeY;
        const t = hold ? 1 : (i + 1) / seg.frames;
        _pathPos.set(
          THREE.MathUtils.lerp(seg.from.x, seg.to.x, t),
          THREE.MathUtils.lerp(seg.from.eyeY, seg.to.eyeY, t),
          THREE.MathUtils.lerp(seg.from.z, seg.to.z, t)
        );
        camera.position.copy(_pathPos);
        _pathLook.lerpVectors(_pathFromLook, _pathToLook, t);
        camera.lookAt(_pathLook);
        if (typeof renderer.compile === "function") {
          renderer.compile(scene, camera);
        }
        requestShadowMapUpdate(renderer);
        renderFrame(renderer, scene, camera);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
  } finally {
    camera.position.copy(savedPos);
    camera.quaternion.copy(savedQuat);
  }
}

let _warmupStage = null;
const _warmForward = new THREE.Vector3();

export function resetGameGpuWarmup() {
  _gameGpuWarmed = false;
  clearExplosionPool();
  if (_warmupStage) {
    _warmupStage.parent?.remove(_warmupStage);
    _warmupStage = null;
  }
}

function ensureWarmupStage(scene, camera) {
  if (!_warmupStage) {
    _warmupStage = new THREE.Group();
    _warmupStage.name = "GpuWarmupStage";
    _warmupStage.frustumCulled = false;
    scene.add(_warmupStage);
  }
  camera.getWorldDirection(_warmForward);
  _warmupStage.position.copy(camera.position).addScaledVector(_warmForward, 6);
  _warmupStage.quaternion.copy(camera.quaternion);
  return _warmupStage;
}

/** Warmup position in front of the camera — objects here actually hit the GPU during render. */
export function getWarmupWorldPos(camera, slot = 0) {
  camera.getWorldDirection(_warmForward);
  const dist = 5.5 + (slot % 6) * 0.35;
  const lateral = (slot % 5) - 2;
  const vertical = ((slot / 5) | 0) % 3 - 1;
  return camera.position
    .clone()
    .addScaledVector(_warmForward, dist)
    .add(new THREE.Vector3(lateral * 0.4, vertical * 0.35, 0));
}

export function setWarmupDrawFlags(object, visible = true) {
  if (!object) return;
  object.visible = visible;
  object.frustumCulled = false;
  object.traverse((child) => {
    child.visible = visible;
    child.frustumCulled = false;
  });
}

/** Warmup reparenting must not leave the arena root hidden or orphaned. */
export function ensureLevelGroupVisible(levelGroup) {
  if (!levelGroup) return;
  levelGroup.visible = true;
  levelGroup.traverse((child) => {
    child.visible = true;
  });
}

/** Compile shaders then render several frames so buffers upload while objects are in view. */
export async function compileAndRender(renderer, object, camera, scene, opts = {}) {
  const frames = opts.frames ?? 5;
  const renderFrame = opts.renderFrame ?? ((r, s, c) => r.render(s, c));
  if (!object || !renderer || !camera || !scene) return;

  setWarmupDrawFlags(object, true);

  if (typeof renderer.compile === "function") {
    renderer.compile(object, camera, scene);
  }

  for (let i = 0; i < frames; i += 1) {
    renderFrame(renderer, scene, camera);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** Reparent object in front of the camera for a visible draw, then restore. */
export async function warmObjectInView(
  renderer,
  scene,
  camera,
  object,
  slot = 0,
  renderFrame,
  opts = {},
) {
  if (!object) return;

  const originalParent = object.parent;
  const caster = object.userData?.pickupShadowCaster;
  if (caster?.parent) {
    caster.parent.remove(caster);
  }
  if (caster) caster.castShadow = false;

  const stage = ensureWarmupStage(scene, camera);
  const holder = new THREE.Group();
  holder.frustumCulled = false;
  holder.position.set(
    (slot % 5 - 2) * 0.35,
    ((((slot / 5) | 0) % 3) - 1) * 0.3,
    0
  );
  holder.add(object);
  stage.add(holder);

  await compileAndRender(renderer, object, camera, scene, {
    frames: opts.frames ?? 5,
    renderFrame,
  });

  stage.remove(holder);
  if (object.parent === holder) holder.remove(object);

  // Restore scene graph — level pickups live here; discarding them orphans the mesh.
  if (originalParent) {
    originalParent.attach(object);
    if (caster) {
      originalParent.add(caster);
    }
  }
  resyncPickupShadowCaster(object);
}

/**
 * Warm the main renderer with every gameplay mesh type once the level is live
 * (shadows, lights, layers) so first use of each system doesn't hitch.
 *
 * Covered: level + room pass, sky (two-pass + night blend), targets, ragdoll,
 * viewmodel + flashlight + muzzle palettes, health bar layer (incl. hit flash),
 * pickups + expire blink, blood splatter + body marks, blue/green lasers,
 * bullet holes on level + targets (decal/plane/Lambert) + impact flashes,
 * grenade/explosion VFX + trajectory preview, oil barrel video, day/night crossfade
 * (full applyDayNight path including aligned sky blend), inRoom light-layer zone
 * (room point lights on viewmodel), stepping back out (outdoor layers + occluders off),
 * post-hit health-bar pass indoors, and stair ceiling cutout (deck-hole hitch).
 */
export async function warmupGameGpu({
  renderer,
  scene,
  camera,
  level,
  weapon,
  sky,
  bulletPool,
  floorY,
  colliders,
  bounds,
  levelCollectibleMeshes = [],
  outdoorLights = null,
  outdoorShadowLights = null,
  roomLights = [],
  oilBarrelFireLights = [],
  doorwayOpenings = [],
  catwalkDeckY = null,
  stairPlacement = null,
  arenaHalf = 14,
  attachWall = "north",
  arenaRooms = [],
  roomCullables = [],
  wallThickness = 0.5,
  wallStandoff = 0.5,
  applyDayNightNightness = null,
  initialDayNightNightness = 0,
  primeDirectionalShadow = null,
}) {
  if (!renderer || !scene || !camera) return;
  if (!GPU_WARMUP_ENABLED) return;

  const shadowEnabledForGameplay =
    renderer.shadowMap.enabled && !areShadowsDisabled();
  renderer.shadowMap.enabled = false;

  const outdoor =
    outdoorLights ?? outdoorShadowLights ?? /** @type {THREE.Light[]} */ ([]);

  let warmSlot = 0;
  const warmPos = (slot = warmSlot++) => getWarmupWorldPos(camera, slot);
  /** @type {(object: THREE.Object3D) => Promise<void>} */
  let warm = async () => {};

  const makeGameplayRenderFrame = (skipRoomPass) => (r, s, c) => {
    resetCameraRenderLayers(c);
    renderSceneWithLayeredLighting(r, s, c, {
      skyRoot: sky?.mesh ?? null,
      skipRoomPass,
      outdoorShadowLights: outdoorShadowLights ?? outdoor,
    });
    if (level?.targets?.length) {
      for (const target of level.targets) {
        const bar = target.userData?.healthBar;
        if (bar) bar.visible = true;
      }
      renderTargetHealthBarsPass(r, s, c, level.targets);
    }
    if (weapon?.holder) {
      weapon.holder.visible = true;
      renderViewmodelPass(r, s, c);
    }
  };

  const layeredRender = makeGameplayRenderFrame(true);
  const layeredRenderWithRoom = makeGameplayRenderFrame(false);
  warm = (object, opts) =>
    warmObjectInView(
      renderer,
      scene,
      camera,
      object,
      warmSlot++,
      layeredRenderWithRoom,
      opts
    );

  const barrelRoot = level?.group ?? null;
  setBarrelFireLightShadowsEnabled(barrelRoot, false);

  try {
    if (level?.group) {
      setWarmupDrawFlags(level.group);
      await compileAndRender(renderer, level.group, camera, scene, {
        renderFrame: layeredRender,
      });
    }

    if (level?.targets?.length) {
      prebuildRagdollTemplates(level.targets);
      for (const target of level.targets) {
        setWarmupDrawFlags(target);
        await compileAndRender(renderer, target, camera, scene, {
          frames: 2,
          renderFrame: layeredRender,
        });
      }

      await warmupTargetHealthBarGpu(level.targets, {
        renderer,
        scene,
        camera,
        renderFrame: layeredRenderWithRoom,
        frames: 3,
      });
    }

    if (sky?.mesh) {
      setWarmupDrawFlags(sky.mesh);
      await compileAndRender(renderer, sky.mesh, camera, scene, {
        renderFrame: layeredRender,
      });
    }

    if (weapon?.holder) {
      weapon.holder.visible = true;
      setWarmupDrawFlags(weapon.holder);
      await compileAndRender(renderer, weapon.holder, camera, scene, {
        renderFrame: layeredRender,
      });
    }

    if (floorY != null) {
      const orb = spawnHpOrb(scene, warmPos(), floorY);
      orb.mesh.position.set(0, 0, 0);
      await warm(orb.mesh);
      await warmupRewardFlashGpu(orb.mesh, orb, () => {
        ensureRewardOwnMaterials(orb, getOrbMaterials);
      }, {
        renderer,
        scene,
        camera,
        renderFrame: layeredRenderWithRoom,
        frames: 2,
      });
      orb.mesh.parent?.remove(orb.mesh);

      const ammo = spawnAmmoDrop(scene, warmPos(), floorY);
      ammo.mesh.position.set(0, 0, 0);
      await warm(ammo.mesh);
      await warmupRewardFlashGpu(ammo.mesh, ammo, () => {
        if (!ammo.flashMats?.length) {
          ammo.ownMats = false;
          ensureRewardOwnMaterials(ammo, getAmmoMaterials);
        }
      }, {
        renderer,
        scene,
        camera,
        renderFrame: layeredRenderWithRoom,
        frames: 2,
      });
      disposeAmmoPickupMeshShadow(ammo.mesh);
      ammo.mesh.parent?.remove(ammo.mesh);
      if (ammo.ownMats) {
        for (const m of ammo.mesh.material) m.dispose();
      }

      for (const mesh of levelCollectibleMeshes) {
        if (!mesh) continue;
        await warm(mesh);
        resyncPickupShadowCaster(mesh);
      }

      const grenDrop = spawnGrenadeDrop(scene, warmPos(), floorY);
      grenDrop.mesh.position.set(0, 0, 0);
      await warm(grenDrop.mesh);
      await warmupRewardFlashGpu(grenDrop.mesh, grenDrop, () => {
        ensureTraverseOwnMaterials(grenDrop);
      }, {
        renderer,
        scene,
        camera,
        renderFrame: layeredRenderWithRoom,
        frames: 2,
      });
      disposeGrenadeModel(grenDrop.mesh);
    }

    const splatters = [];
    const splatter = spawnBloodSplatter(
      scene,
      warmPos(),
      new THREE.Vector3(0, 0, -1),
      50
    );
    if (splatter) {
      splatters.push(splatter);
      splatter.points.position.set(0, 0, 0);
      await warm(splatter.points);
      disposeAllBloodSplatters(splatters, scene);
    }

    if (bulletPool) {
      await warmupBulletMaterialsGpu(
        bulletPool,
        scene,
        camera,
        renderer,
        layeredRenderWithRoom
      );
    }

    if (level?.targets?.length) {
      await warmupBloodMarksGpu(level.targets, {
        renderer,
        scene,
        camera,
        renderFrame: layeredRenderWithRoom,
        frames: 3,
      });
    }

    if (level?.group) {
      await warmupBulletHolesGpu(
        renderer,
        scene,
        camera,
        level.group,
        level.targets ?? [],
        { renderFrame: layeredRenderWithRoom, frames: 32, chunkSize: 6 },
      );
    }

    ensureLevelGroupVisible(level.group);

    const hasAttachedRooms = roomLights.length > 0;
    if (level?.group && hasAttachedRooms) {
      syncLightLayersForZone(scene, true, outdoor, roomLights);
      if (oilBarrelFireLights.length > 0) {
        syncOilBarrelFireLightLayers(oilBarrelFireLights, true);
      }
      setAllLevelRoomSunOccludersCast(level.group, true);

      for (let i = 0; i < 4; i += 1) {
        tickOilBarrelInteriorVideo(camera, level.group);
        layeredRenderWithRoom(renderer, scene, camera);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      syncLightLayersForZone(scene, false, outdoor, roomLights);
      if (oilBarrelFireLights.length > 0) {
        syncOilBarrelFireLightLayers(oilBarrelFireLights, false);
      }
      setAllLevelRoomSunOccludersCast(level.group, false);

      for (let i = 0; i < 4; i += 1) {
        layeredRender(renderer, scene, camera);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      if (
        doorwayOpenings.length > 0 &&
        catwalkDeckY != null &&
        arenaRooms.length > 0
      ) {
        await warmupArenaWallProximity({
          renderer,
          scene,
          camera,
          levelGroup: level.group,
          rooms: arenaRooms,
          roomCullables,
          doorwayOpenings,
          catwalkDeckY,
          arenaHalf,
          attachWall,
          wallThickness,
          wallStandoff,
          outdoor,
          roomLights,
          oilBarrelFireLights,
          renderWithRoom: layeredRenderWithRoom,
          renderOutdoorOnly: layeredRender,
        });

        await warmupRoomCatwalkExitTransition({
          renderer,
          scene,
          camera,
          levelGroup: level.group,
          rooms: arenaRooms,
          roomCullables,
          doorwayOpenings,
          catwalkDeckY,
          arenaHalf,
          attachWall,
          wallThickness,
          outdoor,
          roomLights,
          oilBarrelFireLights,
          renderWithRoom: layeredRenderWithRoom,
          renderOutdoorOnly: layeredRender,
        });
      }
    }

    if (level?.targets?.length) {
      for (let i = 0; i < Math.min(2, level.targets.length); i += 1) {
        await warmupDeferredKillGpu({
          renderer,
          scene,
          camera,
          target: level.targets[i],
          renderFrame: layeredRender,
          floorY,
          colliders,
          bounds,
          warmPos,
          hitZone: i === 0 ? "body" : "head",
        });
      }

      for (let i = 0; i < Math.min(2, level.targets.length); i += 1) {
        const warmTarget = level.targets[i];
        const savedPos = warmTarget.position.clone();
        const savedVisible = warmTarget.visible;
        warmTarget.visible = false;
        warmTarget.position.copy(warmPos());
        const ragdoll = buildWarmupRagdoll(warmTarget, scene);
        try {
          setWarmupDrawFlags(ragdoll.rootGroup);
          await compileAndRender(renderer, ragdoll.rootGroup, camera, scene, {
            frames: 4,
            renderFrame: layeredRender,
          });
        } finally {
          disposeWarmupRagdoll(ragdoll);
          warmTarget.position.copy(savedPos);
          warmTarget.visible = savedVisible;
        }
      }
    }

    if (applyDayNightNightness) {
      await warmupDayNightCrossfade(renderer, scene, camera, {
        applyNightness: applyDayNightNightness,
        renderFrame: layeredRenderWithRoom,
        restoreNightness: initialDayNightNightness,
      });
    }
  } finally {
    if (barrelRoot) {
      refreshOilBarrelFireLights(barrelRoot, getOilBarrelTuning());
    }
  }

  _gameGpuWarmed = true;

  await warmupGrenadeThrow(renderer, scene, camera, {
    warmInView: warm,
    compileInPlace: (object) =>
      compileAndRender(renderer, object, camera, scene, {
        renderFrame: makeGameplayRenderFrame(false),
      }),
    getWarmupPos: warmPos,
    floorY,
    colliders,
    bounds,
  });

  if (_warmupStage) {
    _warmupStage.parent?.remove(_warmupStage);
    _warmupStage = null;
  }

  disposeOrphanedPickupShadowCasters(scene);

  if (level?.group) {
    syncLightLayersForZone(scene, false, outdoor, roomLights);
    if (oilBarrelFireLights.length > 0) {
      syncOilBarrelFireLightLayers(oilBarrelFireLights, false);
    }
    setAllLevelRoomSunOccludersCast(level.group, false);
    if (roomCullables?.length) {
      updateRoomCulling(
        roomCullables,
        camera,
        { x: camera.position.x, z: camera.position.z, footY: floorY ?? 0 },
        arenaHalf,
        attachWall,
        catwalkDeckY,
        doorwayOpenings,
        wallThickness
      );
    }
  }

  renderer.shadowMap.enabled =
    shadowEnabledForGameplay && !areShadowsDisabled();
  if (barrelRoot && !areShadowsDisabled()) {
    setBarrelFireLightShadowsEnabled(barrelRoot, true);
    refreshOilBarrelFireLights(barrelRoot, getOilBarrelTuning());
  }

  finalizeGpuWarmupRendererState(renderer, scene, {
    camera,
    renderFrame: layeredRender,
    cleanFrames: 2,
  });

  // Brief shadow-on pass after a clean finalize — long shadow-on warmup causes
  // hundreds of GL sampler mismatch errors during loading.
  if (typeof primeDirectionalShadow === "function" && !areShadowsDisabled()) {
    primeDirectionalShadow();
    requestShadowMapUpdate(renderer);
    for (let i = 0; i < 3; i += 1) {
      layeredRender(renderer, scene, camera);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  if (typeof weapon?.warmupFlashlight === "function") {
    await weapon.warmupFlashlight(renderer, scene, camera, {
      frames: 4,
      renderFrame: layeredRenderWithRoom,
    });
  }

  if (typeof weapon?.warmupMuzzleFlash === "function") {
    await weapon.warmupMuzzleFlash(renderer, scene, camera, {
      frames: 2,
      renderFrame: layeredRenderWithRoom,
    });
  }

  if (bulletPool) {
    await warmupBulletMaterialsGpu(
      bulletPool,
      scene,
      camera,
      renderer,
      layeredRenderWithRoom
    );
  }

  if (
    level?.group &&
    roomLights.length > 0 &&
    doorwayOpenings.length > 0 &&
    catwalkDeckY != null &&
    arenaRooms.length > 0
  ) {
    await warmupRoomCatwalkExitTransition({
      renderer,
      scene,
      camera,
      levelGroup: level.group,
      rooms: arenaRooms,
      roomCullables,
      doorwayOpenings,
      catwalkDeckY,
      arenaHalf,
      attachWall,
      wallThickness,
      outdoor,
      roomLights,
      oilBarrelFireLights,
      renderWithRoom: layeredRenderWithRoom,
      renderOutdoorOnly: layeredRender,
    });
  }

  if (stairPlacement && catwalkDeckY != null && level?.group) {
    await warmupStairExitHitchPrepay({
      renderer,
      scene,
      camera,
      stairPlacement,
      catwalkDeckY,
      renderFrame: layeredRender,
      primeDirectionalShadow,
    });
  }
}

/**
 * Sample day, night, and mid-blend on the main renderer so the first N-key
 * crossfade and sky shader paths do not hitch mid-gameplay.
 */
export async function warmupDayNightCrossfade(
  renderer,
  scene,
  camera,
  { applyNightness, renderFrame, samples = [0, 1, 0.5], restoreNightness = 0 } = {},
) {
  if (!renderer || !scene || !camera || !applyNightness || !renderFrame) return;

  for (const nightness of samples) {
    applyNightness(nightness);
    for (let i = 0; i < 2; i += 1) {
      renderFrame(renderer, scene, camera);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  applyNightness(restoreNightness);
  renderFrame(renderer, scene, camera);
}
