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
import { setAllLevelRoomSunOccludersCast } from "../rooms/RoomCulling.js";
import { requestShadowMapUpdate } from "../lighting/ShadowUpdatePolicy.js";
import {
  getAttachedRoomCenterZ,
  isIndoorLightingZone,
  isPointInsideAttachedRoom,
} from "../rooms/RoomPlacement.js";

let _gameGpuWarmed = false;

/** Doorway farthest from arena center — arch at centerX 3.6 on level1. */
function pickOffsetDoorOpening(doorwayOpenings) {
  if (!doorwayOpenings?.length) return null;
  let best = doorwayOpenings[0];
  for (const op of doorwayOpenings) {
    if (Math.abs(op.centerX) > Math.abs(best.centerX)) best = op;
  }
  return best;
}

/**
 * Prime the arch / offset catwalk exit: indoor zone on the deck at the opening,
 * then outdoor once feet leave the room footprint (matches runtime after the
 * isIndoorLightingZone catwalk peek rule).
 */
async function warmupOffsetDoorwayExitTransition({
  renderer,
  scene,
  camera,
  levelGroup,
  rooms,
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

  const opening = pickOffsetDoorOpening(doorwayOpenings);
  if (!opening) return;

  const room = rooms[0];
  const halfD = room.depth / 2;
  const roomCenterZ = getAttachedRoomCenterZ(
    room,
    arenaHalf,
    attachWall,
    wallThickness
  );
  const x = opening.centerX;
  const footY = catwalkDeckY;
  const zOnCatwalkAtDoor =
    attachWall === "north"
      ? roomCenterZ - halfD + 0.55
      : roomCenterZ + halfD - 0.55;
  const zPastFootprint =
    attachWall === "north"
      ? roomCenterZ - halfD - 0.85
      : roomCenterZ + halfD + 0.85;

  const savedPos = camera.position.clone();
  const savedQuat = camera.quaternion.clone();
  const eyeY = catwalkDeckY + 1.62;

  const applyZoneFromFeet = (px, pz, py) => {
    const indoor = isIndoorLightingZone(
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
    syncLightLayersForZone(scene, indoor, outdoor, roomLights);
    if (oilBarrelFireLights.length > 0) {
      syncOilBarrelFireLightLayers(oilBarrelFireLights, indoor);
    }
    const insideFloor =
      isPointInsideAttachedRoom(px, pz, room, arenaHalf, attachWall, wallThickness) &&
      py < catwalkDeckY - 0.5;
    setAllLevelRoomSunOccludersCast(levelGroup, insideFloor);
    requestShadowMapUpdate(renderer);
    return indoor;
  };

  try {
    camera.position.set(x, eyeY, zOnCatwalkAtDoor);
    applyZoneFromFeet(x, zOnCatwalkAtDoor, footY);
    for (let i = 0; i < 5; i += 1) {
      renderWithRoom(renderer, scene, camera);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    camera.position.set(x, eyeY, zPastFootprint);
    applyZoneFromFeet(x, zPastFootprint, footY);
    for (let i = 0; i < 5; i += 1) {
      renderWithRoom(renderer, scene, camera);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    for (let i = 0; i < 3; i += 1) {
      renderOutdoorOnly(renderer, scene, camera);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  } finally {
    camera.position.copy(savedPos);
    camera.quaternion.copy(savedQuat);
    syncLightLayersForZone(scene, false, outdoor, roomLights);
    if (oilBarrelFireLights.length > 0) {
      syncOilBarrelFireLightLayers(oilBarrelFireLights, false);
    }
    setAllLevelRoomSunOccludersCast(levelGroup, false);
    requestShadowMapUpdate(renderer);
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
 * and post-hit health-bar pass indoors.
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
  arenaHalf = 14,
  attachWall = "north",
  arenaRooms = [],
  wallThickness = 0.5,
  applyDayNightNightness = null,
  initialDayNightNightness = 0,
}) {
  if (!renderer || !scene || !camera) return;

  const shadowEnabledForGameplay = renderer.shadowMap.enabled;
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

  if (!_gameGpuWarmed) {
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
      for (const target of level.targets.slice(0, 3)) {
        setWarmupDrawFlags(target);
        await compileAndRender(renderer, target, camera, scene, {
          frames: 3,
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

      const warmTarget = level.targets[0];
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
      // Use dedicated material warmup that renders through full gameplay pipeline
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
      // Stronger warmup: use many frames so GL uploads and shader compiles
      // reliably finish before the first real shot. Also warm every surface
      // (not just a representative subset) so decal builds are exercised.
      // Use a progressive warmup that spreads work across multiple frames
      // to avoid a long blocking startup while still exercising all surfaces.
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

    _gameGpuWarmed = true;
    } finally {
      if (barrelRoot) {
        refreshOilBarrelFireLights(barrelRoot, getOilBarrelTuning());
      }
    }

    // Room interior pass + barrel-fire shadows were disabled above — compile them
    // here so the first 30s of gameplay does not hitch on shader/shadow setup.
    if (level?.group) {
      renderer.shadowMap.needsUpdate = true;
      await compileAndRender(renderer, level.group, camera, scene, {
        frames: 6,
        renderFrame: layeredRenderWithRoom,
      });
      for (let i = 0; i < 4; i += 1) {
        tickOilBarrelInteriorVideo(camera, level.group);
        layeredRenderWithRoom(renderer, scene, camera);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      // Gameplay defaults to outdoor light layers; prime inRoom=true (room lights on
      // viewmodel + room pass) and the post-hit health-bar pass before first doorstep.
      const hasAttachedRooms = roomLights.length > 0;
      if (hasAttachedRooms) {
        syncLightLayersForZone(scene, true, outdoor, roomLights);
        if (oilBarrelFireLights.length > 0) {
          syncOilBarrelFireLightLayers(oilBarrelFireLights, true);
        }
        setAllLevelRoomSunOccludersCast(level.group, true);
        requestShadowMapUpdate(renderer);

        if (level.targets?.length) {
          await warmupTargetHealthBarGpu(level.targets, {
            renderer,
            scene,
            camera,
            renderFrame: layeredRenderWithRoom,
            frames: 4,
          });
        }

        for (let i = 0; i < 6; i += 1) {
          tickOilBarrelInteriorVideo(camera, level.group);
          layeredRenderWithRoom(renderer, scene, camera);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }

      // Torch shadow map must compile with the room pass active — doing it earlier
      // or toggling castShadow on first F-key causes a multi-hundred-ms hitch.
      if (typeof weapon?.warmupFlashlight === "function") {
        await weapon.warmupFlashlight(renderer, scene, camera, {
          frames: 8,
          renderFrame: layeredRenderWithRoom,
        });
      }

      if (typeof weapon?.warmupMuzzleFlash === "function") {
        await weapon.warmupMuzzleFlash(renderer, scene, camera, {
          frames: 2,
          renderFrame: layeredRenderWithRoom,
        });
      }

      if (hasAttachedRooms) {
        syncLightLayersForZone(scene, false, outdoor, roomLights);
        if (oilBarrelFireLights.length > 0) {
          syncOilBarrelFireLightLayers(oilBarrelFireLights, false);
        }
        setAllLevelRoomSunOccludersCast(level.group, false);
        requestShadowMapUpdate(renderer);

        // Leaving the room: outdoor lights on viewmodel, room pass may still run
        // in frustum, then drops once fully outside.
        for (let i = 0; i < 6; i += 1) {
          tickOilBarrelInteriorVideo(camera, level.group);
          layeredRenderWithRoom(renderer, scene, camera);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        for (let i = 0; i < 4; i += 1) {
          layeredRender(renderer, scene, camera);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }
    } else {
      if (typeof weapon?.warmupFlashlight === "function") {
        await weapon.warmupFlashlight(renderer, scene, camera, {
          frames: 8,
          renderFrame: layeredRenderWithRoom,
        });
      }

      if (typeof weapon?.warmupMuzzleFlash === "function") {
        await weapon.warmupMuzzleFlash(renderer, scene, camera, {
          frames: 2,
          renderFrame: layeredRenderWithRoom,
        });
      }
    }

    if (applyDayNightNightness) {
      await warmupDayNightCrossfade(renderer, scene, camera, {
        applyNightness: applyDayNightNightness,
        renderFrame: layeredRenderWithRoom,
        restoreNightness: initialDayNightNightness,
      });
    }
  } else {
    warm = (object) =>
      warmObjectInView(
        renderer,
        scene,
        camera,
        object,
        warmSlot++,
        makeGameplayRenderFrame(false),
      );
  }

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
  }

  renderer.shadowMap.enabled = shadowEnabledForGameplay;
  finalizeGpuWarmupRendererState(renderer, scene, {
    camera,
    renderFrame: makeGameplayRenderFrame(false),
    cleanFrames: 2,
  });

  // Offset arch exit: light-layer flip + sun occluders + shadow maps must compile
  // with shadows enabled — the shadow-off warmup above cannot prime this path.
  if (
    level?.group &&
    roomLights.length > 0 &&
    doorwayOpenings.length > 0 &&
    catwalkDeckY != null &&
    arenaRooms.length > 0
  ) {
    await warmupOffsetDoorwayExitTransition({
      renderer,
      scene,
      camera,
      levelGroup: level.group,
      rooms: arenaRooms,
      doorwayOpenings,
      catwalkDeckY,
      arenaHalf,
      attachWall,
      wallThickness,
      outdoor,
      roomLights,
      oilBarrelFireLights,
      renderWithRoom: makeGameplayRenderFrame(false),
      renderOutdoorOnly: makeGameplayRenderFrame(true),
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
