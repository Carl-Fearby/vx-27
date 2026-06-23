import * as THREE from "three";
import { flushKillPredictiveGpuWarm } from "@/lib/combat/KillPredictiveCache.js";
import { updateKillPredictiveCache } from "@/lib/combat/KillPredictiveCache.js";
import {
  flushAllPendingRagdolls,
  updateDeathAnimations,
  updateLiveTargetsFloorHoles,
  updateTargetsRepair,
  updateTargetHealthBars,
  deactivateTarget,
  startDeathAnimation,
  blindTargetFromFlashbang,
  updateHpOrbs,
  hasVisibleTargetHealthBars,
  renderTargetHealthBarsPass,
  getFlashbangBlindDurationSec,
} from "@/lib/combat/Targets.js";
import { updateAmmoDrops } from "@/lib/pickups/AmmoCrate.js";
import {
  updateGrenadeDrops,
  updateGrenades,
  hideTrajectoryPreview,
  updateTrajectoryPreview,
  spawnGrenade,
  getGrenadeParams,
  PROJECTILE_FLASHBANG,
  applyScreenShake,
  triggerScreenShake,
} from "@/lib/combat/Grenade.js";
import { updateBloodSplatters } from "@/lib/combat/BloodParticles.js";
import { updateBulletHoles } from "@/lib/combat/BulletHoles.js";
import { hasLineOfSightToPoint } from "@/lib/combat/LineOfSight.js";
import { updateEnemyAi } from "@/lib/combat/EnemyAi.js";
import { getEnemyRigTuning } from "@/lib/combat/EnemyRigTuning.js";
import { groundSupportFromLevel } from "@/lib/physics/GroundSupport.js";
import { updateCandleFlicker } from "@/lib/lighting/CandleFlicker.js";
import {
  renderCrosshairPass,
  renderViewmodelPass,
  renderSceneWithLayeredLighting,
  renderWeatherPass,
  resetCameraRenderLayers,
  syncLightLayersForZone,
  syncOilBarrelFireLightLayers,
} from "@/lib/lighting/SceneEnvironment.js";
import { resolveViewmodelLightingZone, isEnclosedViewmodelZone } from "@/lib/lighting/LightingZones.js";
import { updateRoomCulling } from "@/lib/rooms/RoomCulling.js";
import {
  isIndoorLightingZone,
  isPlayerInsideRoomForLighting,
} from "@/lib/rooms/RoomPlacement.js";
import { isInteriorEnvironmentLevel } from "@/lib/level/InteriorEnvironment.js";
import { buildRainOccluderSlabs, buildContainerRoofRainOccluders, buildInteriorFloorHideZones, updateRain } from "@/lib/Rain.js";
import {
  updateLevelCollectibles,
  hideCompassCollectibleMarker,
  ensureCompassCollectibleMarkers,
  updateCompassCollectibleMarkers,
} from "@/lib/pickups/LevelCollectibles.js";
import {
  tickOilBarrelInteriorVideo,
  tickOilBarrelFireProximityDamage,
} from "@/lib/oil-barrel/OilBarrel.js";
import { updateOilBarrelContainerDoorFireSpill } from "@/lib/oil-barrel/OilBarrelFireLight.js";
import {
  resolveVx27ContainerForPlayer,
  updateVx27ContainerBeaconLights,
  updateVx27ContainerDoorAnimations,
  consumeVx27DoorColliderDirty,
} from "@/lib/vx27-container/Vx27Container.js";
import { updateVx27ContainerCulling } from "@/lib/vx27-container/Vx27ContainerCulling.js";
import {
  pickVx27DoorUnderCrosshair,
  getVx27DoorInteractPrompt,
  toggleVx27ContainerDoorLeaf,
} from "@/lib/vx27-container/Vx27ContainerDoorInteract.js";
import {
  syncVx27ContainerCollider,
  readVx27ContainerPlacement,
} from "@/lib/vx27-container/Vx27ContainerTuning.js";
import { pickHackableControlPanelUnderCrosshair } from "@/lib/control-panel/ControlPanelHackInteract.js";
import { updateControlPanelScreenCHackFlashes } from "@/lib/control-panel/ControlPanelScreenCHackFlash.js";
import {
  updateCompassEnemyBlips,
  updateCompassRewardBlips,
} from "@/lib/CompassBlips.js";
import { isBindingDown, wasBindingPressed } from "@/lib/player/KeyBindings.js";
import { tickWeatherSession } from "@/lib/weather/WeatherToggle.js";
import { tickWeatherTransition } from "@/lib/weather/WeatherTransition.js";
import {
  applyLightningFlashAtmosphere,
  getLightningSkyFlashStrength,
  tickLightningFlash,
  updateLightningFlashOverlay,
} from "@/lib/weather/LightningFlash.js";
import {
  buildRainCanopyFootprints,
  isUnderRainCanopy,
} from "@/lib/weather/RainCanopy.js";
import { updateRainWetness } from "@/lib/weather/RainWetness.js";
import {
  DEATH_FALL_DROP,
  DEATH_MIN_DISPLAY_MS,
  DEATH_FADE_MS,
  OIL_BARREL_FIRE_PROXIMITY_DAMAGE,
  GRENADE_WEAPON_SLOT,
  FLASHBANG_WEAPON_SLOT,
  GRENADE_THROW_COOLDOWN_SEC,
  DAY_NIGHT_DEMO_CYCLE_ENABLED,
  DAY_NIGHT_DEMO_CYCLE_SEC,
  DAY_NIGHT_FADE_DURATION,
  DAY_NIGHT_SWITCHER_ENABLED,
  HIP_FOV,
  ADS_FOV,
  SCORE_PACK_DEFAULT_VALUE,
  LEVEL_COLLECTIBLE_TEST_RESPAWN,
  DEV_DROP_ALL_REWARDS,
} from "@/lib/gameLoop/constants.js";
import {
  dismissGameplayHint,
  clearGameplayHintPulse,
  pulseGameplayHint,
} from "@/lib/ui/GameplayHints.js";
import {
  clearCenterPromptPersistent,
  setCenterPromptPersistent,
  tickCenterInteractPrompt,
} from "@/lib/ui/CenterInteractPrompt.js";
import { beginShadowStartupWindow, requestShadowMapUpdate, applyFrameShadowUpdates } from "@/lib/lighting/ShadowUpdatePolicy.js";
import { resolveAimBlendSpeed } from "@/lib/weapons/ViewWeapon.js";
import {
  getPrimaryWeaponConfig,
} from "@/lib/weapons/PrimaryWeapons.js";
import {
  getPrimaryWeaponIdFromSlotInput,
  wasPrimarySwapPressed,
} from "@/lib/weapons/PrimaryWeaponSlots.js";
import {
  isPlayerWithinWallWeaponShopRange,
  pickRifleShopUnderCrosshair,
  tryPurchaseWallWeaponShop,
} from "@/lib/weapons/RifleShop.js";
import {
  isWallWeaponOwned,
  tickPendingWallWeaponEquip,
} from "@/lib/weapons/WallWeaponShop.js";
import { resolveWalkBobTuning } from "@/lib/player/WalkBobTuning.js";
import { normalizeRecoilTuning } from "@/lib/player/RecoilTuning.js";
import { normalizeStairWalkTuning } from "@/lib/stairs/StairWalkTuning.js";
import { startFrameProfile } from "@/lib/gameLoop/FrameProfiler.js";
import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";

/** @param {import("./gameLoopContext.js").GameLoopContext} ctx */
function ensureRainCanopy(ctx) {
  if (ctx.rainCanopySlabs) return ctx.rainCanopySlabs;
  // Use allColliders (not just level.ceilingColliders) so room ceilings are included —
  // consistent with ensureWeatherOccluders. Room ceiling deck colliders are added by
  // LevelRoom.js into allColliders but not into level.ceilingColliders.
  const deckCeilings = (ctx.allColliders ?? []).filter((c) => c.kind === "deck");
  const containerRoofs = (ctx.allColliders ?? []).filter(
    (c) => c.containerPart === "roof"
  );
  ctx.rainCanopySlabs = buildRainCanopyFootprints(
    ctx.level.groundSurfaces,
    ctx.level.catwalkDeckY,
    deckCeilings,
    containerRoofs,
    ctx.arena.floorY ?? 0,
  );
  return ctx.rainCanopySlabs;
}

/** @param {import("./gameLoopContext.js").GameLoopContext} ctx */
function ensureWeatherOccluders(ctx) {
  if (ctx.weatherOccluders) return ctx.weatherOccluders;
  // Use allColliders (not just level.ceilingColliders) so room ceilings are included.
  const deckCeilings = (ctx.allColliders ?? []).filter((c) => c.kind === "deck");
  const containerRoofs = buildContainerRoofRainOccluders(ctx.allColliders ?? []);
  const floorY = ctx.arena.floorY ?? 0;
  const rainSlabs = buildRainOccluderSlabs(
    ctx.level.groundSurfaces,
    ctx.level.catwalkDeckY,
    deckCeilings,
    ctx.level.stairColliders,
    floorY,
  );
  ctx.weatherOccluders = {
    rain: [...rainSlabs, ...containerRoofs],
  };
  return ctx.weatherOccluders;
}

function syncGameCoreFrame(ctx, dt, paused) {
  const core = ctx.gameCore;
  if (!core) return;
  const state = core.tickFrame({ dt, paused });
  if (Number.isFinite(state.playerHealth) && state.playerHealth !== ctx.playerHealthRef.current) {
    ctx.playerHealthRef.current = state.playerHealth;
    ctx.setPlayerHealth(state.playerHealth);
  }
  if (
    Number.isFinite(state.grenadeCooldownRemaining) &&
    state.grenadeCooldownRemaining !== ctx.grenadeCooldownRemainingRef.current
  ) {
    ctx.grenadeCooldownRemainingRef.current = state.grenadeCooldownRemaining;
  }
  if (Number.isFinite(state.missionTime)) {
    const prevMissionTime = ctx.missionTimeRef.current;
    ctx.missionTimeRef.current = state.missionTime;
    if (ctx.showHudRef.current && Math.floor(state.missionTime) !== Math.floor(prevMissionTime)) {
      ctx.updateMissionTimerHud(
        ctx.missionTimerHudRef.current,
        Math.floor(state.missionTime),
      );
    }
  }
  ctx.healthRegenTimer = state.healthRegenTimer ?? 0;
  ctx.radioactiveOverflowDecayTimer = state.radioactiveOverflowDecayTimer ?? 0;
  if (state.staminaShouldSyncFromHealth) {
    ctx.player?.syncStaminaMaxFromHp?.();
  }
}

function tickEnemyAi(ctx, dt, active) {
  let runtime = ctx.enemyAiRuntime;
  if (!runtime) {
    runtime = {
      frame: {
        targets: null,
        playerPosition: ctx.camera.position,
        levelHitMeshes: ctx.levelHitMeshes,
        navigation: ctx.level?.enemyNavigation ?? null,
        groundSupport: ctx.projectileGroundSupport ?? null,
        hasLineOfSight: (from, to, hitMeshes) => hasLineOfSightToPoint(
          from,
          to,
          hitMeshes,
          { blockEpsilon: 0.25 },
        ),
        dt: 0,
        simTime: 0,
        active: false,
        config: null,
        laserTracers: ctx.laserTracers,
        playShot: () => ctx.sounds.play("laser_shot", { volume: 0.3 }),
        onPlayerHit: (damage) => {
          if (!getEnemyRigTuning().damageEnabled) return;
          if (ctx.playerHealthRef.current <= 0 || ctx.deathStateRef.current) return;
          const newHp = Math.max(0, ctx.playerHealthRef.current - damage);
          ctx.playerHealthRef.current = newHp;
          requireWasmMethod(ctx.gameCore, "setPlayerHealth")(newHp);
          ctx.setPlayerHealth(newHp);
          ctx.triggerPlayerHurtFeedback(ctx.hurtVignetteFlashEndRef, ctx.sounds);
        },
        gameCore: ctx.gameCore,
      },
    };
    ctx.enemyAiRuntime = runtime;
  }

  const frame = runtime.frame;
  frame.targets = ctx.level?.targets;
  frame.playerPosition = ctx.camera.position;
  frame.levelHitMeshes = ctx.levelHitMeshes;
  frame.navigation = ctx.level?.enemyNavigation ?? null;
  frame.groundSupport = ctx.projectileGroundSupport ?? null;
  frame.dt = dt;
  frame.simTime = ctx.simTime;
  frame.active = active && ctx.playerHealthRef.current > 0;
  frame.config = ctx.level?.targetConfig?.ai;
  frame.laserTracers = ctx.laserTracers;
  frame.gameCore = ctx.gameCore;
  updateEnemyAi(frame);
}

function applyPlayerDeath(ctx, kind, now) {
  requireWasmMethod(ctx.gameCore, "syncPlayerLives")(ctx.playerLivesRef.current);
  const death = requireWasmMethod(ctx.gameCore, "applyPlayerDeath")(
    kind,
    now,
    DEATH_MIN_DISPLAY_MS,
  );
  if (!death.died) return null;
  ctx.playerLivesRef.current = death.playerLives;
  ctx.setPlayerLives(ctx.playerLivesRef.current);
  ctx.playerHealthRef.current = death.playerHealth;
  ctx.setPlayerHealth(death.playerHealth);
  ctx.deathStateRef.current = {
    reason: death.reason,
    respawned: false,
    gameOver: death.gameOver,
    minDisplayEnd: death.minDisplayEnd,
    fadeEndTime: death.fadeEndTime,
  };
  return death;
}

function showPlayerDeathOverlay(ctx, death) {
  ctx.showDeathOverlay(
    ctx.deathOverlayRef.current,
    ctx.deathReasonRef.current,
    death.reason,
    {
      gameOver: death.gameOver,
      titleEl: ctx.deathTitleRef?.current,
      hintEl: ctx.deathHintRef?.current,
    },
  );
}

function applyPlayerRespawn(ctx, now) {
  const respawn = requireWasmMethod(ctx.gameCore, "planPlayerRespawn")(
    now,
    DEATH_FADE_MS,
  );
  if (!respawn.canRespawn) return null;
  ctx.player.respawn();
  ctx.weapon?.replayRaise?.();
  ctx.playerHealthRef.current = respawn.playerHealth;
  ctx.setPlayerHealth(respawn.playerHealth);
  ctx.grenadeCountRef.current = getGrenadeParams().grenadeCount;
  ctx.setGrenadeCount(ctx.grenadeCountRef.current);
  requireWasmMethod(ctx.gameCore, "syncThrowableCounts")(
    ctx.grenadeCountRef.current,
    ctx.flashbangCountRef.current,
  );
  ctx.flashbangBlindStartRef.current = 0;
  ctx.updateFlashbangOverlay(ctx.flashbangOverlayRef.current, 0);
  ctx.beginDeathOverlayFade(ctx.deathOverlayRef.current);
  return respawn;
}

/** @param {import("./gameLoopContext.js").GameLoopContext} ctx @param {HTMLElement} viewport */
function readCompassMetrics(ctx, viewport) {
  const cache =
    ctx.compassMetrics ??
    (ctx.compassMetrics = {
      viewport: null,
      framesUntilRefresh: 0,
      width: 0,
      center: 0,
      pxPerDeg: 0,
      pxPerDegStyle: "",
    });

  cache.framesUntilRefresh -= 1;
  if (
    cache.viewport !== viewport ||
    cache.width <= 0 ||
    cache.framesUntilRefresh <= 0
  ) {
    cache.viewport = viewport;
    cache.framesUntilRefresh = 30;
    const width = viewport.offsetWidth;
    if (width !== cache.width) {
      cache.width = width;
      cache.center = width * 0.5;
      cache.pxPerDeg = width / 105;
      cache.pxPerDegStyle = `${cache.pxPerDeg}px`;
    }
  }

  return cache;
}

/** @param {import("./gameLoopContext.js").GameLoopContext} ctx @param {number} now */
export function runGameFrame(ctx, now) {
  const frameProfile = startFrameProfile(ctx);
  const consoleHackUiOpen = ctx.consoleHackOpenRef.current;
  const flashBlindPos =
    ctx.flashBlindPosScratch ?? (ctx.flashBlindPosScratch = new THREE.Vector3());
  const projectileGroundSupport =
    ctx.projectileGroundSupport ??
    (ctx.projectileGroundSupport = groundSupportFromLevel(ctx.level, 0.05, ctx.gameCore));
  ctx.combat.flushBloodAfterRagdoll();
  ctx.combat.flushPendingRagdolls();
  ctx.combat.flushPendingKillBlood();
  tickOilBarrelInteriorVideo(ctx.camera, ctx.oilBarrelRuntimeIndex);
  ctx.sounds.updateOilBarrelFire(
    ctx.oilBarrelRuntimeIndex.fireLights,
    ctx.loadDoneRef.current &&
      ctx.oilBarrelTuningRef.current.interiorFire !== false
  );
  const rawFrameDt = Math.min((now - ctx.lastTime) / 1000, 0.15);
  const dt = Math.min(rawFrameDt, 0.05);
  ctx.lastTime = now;
  if (dt > 0) ctx.simTime += dt;
  if (dt > 0 && ctx.player && ctx.settingsOpenRef.current && ctx.playerCoordsMenuRef.current) {
    const yawDeg = (ctx.player.getYaw() * 180) / Math.PI;
    const footY = ctx.player.getFootY();
    const px = ctx.camera.position.x;
    const pz = ctx.camera.position.z;
    const text =
      `X ${px.toFixed(3)}  Z ${pz.toFixed(3)}  foot ${footY.toFixed(3)}  eye ${ctx.camera.position.y.toFixed(3)}  yaw ${yawDeg.toFixed(1)}°`;
    const json = JSON.stringify({
      x: +px.toFixed(3),
      z: +pz.toFixed(3),
      footY: +footY.toFixed(3),
      eyeY: +ctx.camera.position.y.toFixed(3),
      yawDeg: +yawDeg.toFixed(1),
    });
    ctx.playerCoordsMenuRef.current.textContent = text;
    ctx.playerCoordsMenuRef.current.dataset.coords = json;
  }
  
  // Candle-flicker the warm interior lights. Uses rAF's absolute
  // timestamp so the wobble keeps phase across frame-time hitches.
  updateCandleFlicker(ctx.flickerLights, now * 0.001);
  
  const locked = ctx.input.isLocked();
  const pointerActive = ctx.input.isPointerActive();
  const touchMode = ctx.input.isTouchMode();
  const aimHeld =
    !ctx.rebindActionRef.current &&
    isBindingDown(ctx.input, ctx.bindingsRef.current, "aim");
  const aimTarget = aimHeld ? 1 : 0;
  
  // Death sequence (two phases):
  //   1. FREEZE  — overlay is fully opaque, ctx.player is not respawned,
  //                ctx.input/physics/weapons are disabled. Stays until the
  //                ctx.player clicks to respawn (after a brief minimum
  //                display time to prevent accidental click-through).
  //   2. FADE    — ctx.player has just been respawned; the overlay fades
  //                out over `DEATH_FADE_MS` while the ctx.player can
  //                already move and shoot.
  // `frozen` is the only thing that gates ctx.input/physics; the fade
  // phase deliberately does NOT block gameplay.
  const deathState = ctx.deathStateRef.current;
  let frozen = false;
  if (deathState) {
    if (deathState.gameOver) {
      frozen = true;
    } else if (!deathState.respawned) {
      const canRespawn = now >= deathState.minDisplayEnd;
      if (canRespawn && ctx.input.consumeShoot()) {
        const respawn = applyPlayerRespawn(ctx, now);
        if (!respawn) {
          frozen = true;
          return;
        }
        deathState.respawned = true;
        deathState.fadeEndTime = respawn.fadeEndTime;
      }
    }
    if (!deathState.gameOver && deathState.respawned && now >= deathState.fadeEndTime) {
      ctx.hideDeathOverlay(ctx.deathOverlayRef.current);
      ctx.deathStateRef.current = null;
    } else if (deathState.gameOver || !deathState.respawned) {
      frozen = true;
    }
  }

  if (!ctx.loadDoneRef.current) {
    frozen = true;
    ctx.input.discardLookDelta?.();
  }

  if (dt > 0) syncGameCoreFrame(ctx, dt, frozen);
  
  const canUseWeapons =
    !frozen &&
    ctx.loadDoneRef.current &&
    !ctx.rebindActionRef.current &&
    !ctx.settingsOpenRef.current &&
    !ctx.controlsOpenRef.current &&
    !ctx.consoleHackOpenRef.current;
  
  if (ctx.consoleHackOpenRef.current) {
    ctx.input.discardLookDelta?.();
  }
  
  if (!frozen && !ctx.consoleHackOpenRef.current) {
    ctx.player.update(ctx.input, dt);
    const playerPlacement =
      ctx.playerPlacementRef.current ??
      (ctx.playerPlacementRef.current = { x: 0, z: 0, y: 0 });
    playerPlacement.x = ctx.player.getX();
    playerPlacement.z = ctx.player.getZ();
    playerPlacement.y = ctx.player.getFootY();
  
    if (ctx.player.isFallingThroughHole?.()) {
      if (!ctx.holeFallCryPlayedRef.current) {
        ctx.holeFallCryPlayedRef.current = true;
        ctx.sounds.playHoleFallDeath();
      }
    } else {
      ctx.holeFallCryPlayedRef.current = false;
    }
  
    if (
      ctx.playerHealthRef.current > 0 &&
      tickOilBarrelFireProximityDamage(
        ctx.level.group,
        ctx.camera.position,
        dt,
        ctx.oilBarrelTuningRef.current,
        ctx.levelHitMeshes,
        ctx.gameCore
      )
    ) {
      const newHp = Math.max(
        0,
        ctx.playerHealthRef.current - OIL_BARREL_FIRE_PROXIMITY_DAMAGE
      );
      ctx.playerHealthRef.current = newHp;
      requireWasmMethod(ctx.gameCore, "setPlayerHealth")(newHp);
      ctx.setPlayerHealth(newHp);
      ctx.triggerPlayerHurtFeedback(ctx.hurtVignetteFlashEndRef, ctx.sounds);
    }

    tickEnemyAi(
      ctx,
      dt,
      canUseWeapons && (locked || touchMode),
    );
    frameProfile?.mark("enemy-ai");
  
    const deathTrigger = requireWasmMethod(ctx.gameCore, "resolvePlayerDeathTrigger")({
      deathStateActive: Boolean(ctx.deathStateRef.current),
      footY: ctx.player.getFootY(),
      floorY: ctx.level.floorY,
      fallDrop: DEATH_FALL_DROP,
      playerHealth: ctx.playerHealthRef.current,
      grenadeSuicide: ctx.grenadeSuicideRef.current === true,
    });
    if (deathTrigger.shouldDie) {
      const deathKind = deathTrigger.kind;
      if (deathTrigger.consumeGrenadeSuicide) {
        ctx.grenadeSuicideRef.current = false;
      }
      if (deathKind !== "fall") {
        ctx.sounds.playPlayerDeath();
      }
      ctx.grenadeSuicideRef.current = false;
      const death = applyPlayerDeath(ctx, deathKind, now);
      if (death) {
        showPlayerDeathOverlay(ctx, death);
        frozen = true;
      }
    }
  }
  if (ctx.showHudRef.current && ctx.compassTapeRef.current && ctx.compassViewportRef.current) {
    const yawDeg = (ctx.player.getYaw() * 180) / Math.PI;
    const bearing = (((-yawDeg % 360) + 360) % 360);
    const viewport = ctx.compassViewportRef.current;
    const tape = ctx.compassTapeRef.current;
    const { center, pxPerDeg, pxPerDegStyle } = readCompassMetrics(ctx, viewport);
    if (ctx.compassPxPerDegStyle !== pxPerDegStyle) {
      ctx.compassPxPerDegStyle = pxPerDegStyle;
      tape.style.setProperty("--compass-px-per-deg", pxPerDegStyle);
    }
    tape.style.transform = `translateX(${center - bearing * pxPerDeg}px)`;
    if (ctx.collectibleEntries.length > 0 && ctx.compassMarkersRef.current) {
      ensureCompassCollectibleMarkers(
        ctx.compassMarkersRef.current,
        ctx.collectibleEntries
      );
      updateCompassCollectibleMarkers(
        ctx.collectibleEntries,
        ctx.camera.position.x,
        ctx.camera.position.z,
        ctx.player.getYaw(),
        viewport,
        pxPerDeg,
        center
      );
    }
    if (ctx.compassBlipsRef.current) {
      const px = ctx.camera.position.x;
      const pz = ctx.camera.position.z;
      const yaw = ctx.player.getYaw();
      if (ctx.level?.targets) {
        updateCompassEnemyBlips(
          ctx.compassBlipsRef.current,
          ctx.level.targets,
          px,
          pz,
          yaw,
          viewport,
          pxPerDeg,
          center
        );
      }
      const allDrops =
        ctx.compassRewardDropsScratch ?? (ctx.compassRewardDropsScratch = []);
      allDrops.length = 0;
      for (const drop of ctx.hpOrbs) {
        if (!drop.collected && drop.mesh?.position) allDrops.push(drop);
      }
      for (const drop of ctx.ammoDrops) {
        if (!drop.collected && drop.mesh?.position) allDrops.push(drop);
      }
      for (const drop of ctx.grenadeDrops) {
        if (!drop.collected && drop.mesh?.position) allDrops.push(drop);
      }
      for (const entry of ctx.collectibleEntries) {
        const drop = entry.drop;
        if (!entry.collected && drop?.mesh?.position) allDrops.push(drop);
      }
      updateCompassRewardBlips(
        ctx.compassBlipsRef.current,
        allDrops,
        px,
        pz,
        yaw,
        viewport,
        pxPerDeg,
        center
      );
    }
  }
  ctx.camera.updateMatrixWorld(true);
  frameProfile?.mark("player-hud");
  
  const canInteract = requireWasmMethod(ctx.gameCore, "canInteractGate")({
    pointerActive: Boolean(pointerActive),
    frozen: Boolean(frozen),
    rebindActionOpen: ctx.rebindActionRef.current === true,
    settingsOpen: ctx.settingsOpenRef.current === true,
    controlsOpen: ctx.controlsOpenRef.current === true,
    consoleHackOpen: ctx.consoleHackOpenRef.current === true,
  });
  let centerHitRayReady = false;
  let doorTarget = null;
  let wallWeaponShopTarget = null;
  let hackTarget = null;
  if (canInteract && ctx.vx27DoorInteractMeshesCache.length > 0) {
    ctx.hitRaycaster.setFromCamera(ctx.screenCenter, ctx.camera);
    centerHitRayReady = true;
    doorTarget = pickVx27DoorUnderCrosshair(
      ctx.hitRaycaster,
      ctx.vx27DoorInteractMeshesCache
    );
  }
  const wallWeaponShopHitScratch =
    ctx.wallWeaponShopHitScratch ?? (ctx.wallWeaponShopHitScratch = {});
  const wallWeaponShops = ctx.wallWeaponShopsRef?.current;
  const wallWeaponShopCount = wallWeaponShops?.length ?? 0;
  for (let i = 0; i < wallWeaponShopCount; i += 1) {
    const shop = wallWeaponShops[i];
    if (!shop?.visible || !shop.group) continue;
    if (!centerHitRayReady) {
      ctx.hitRaycaster.setFromCamera(ctx.screenCenter, ctx.camera);
      centerHitRayReady = true;
    }
    const shopHit = pickRifleShopUnderCrosshair(
      ctx.hitRaycaster,
      shop.group,
      undefined,
      wallWeaponShopHitScratch,
    );
    if (shopHit) {
      shopHit.shop = shop;
      wallWeaponShopTarget = shopHit;
      break;
    }
  }
  if (wallWeaponShopCount === 0 && ctx.rifleShopRef?.current) {
    const shop = ctx.rifleShopRef.current;
    if (shop?.visible && shop.group) {
      if (!centerHitRayReady) {
        ctx.hitRaycaster.setFromCamera(ctx.screenCenter, ctx.camera);
        centerHitRayReady = true;
      }
      const shopHit = pickRifleShopUnderCrosshair(
        ctx.hitRaycaster,
        shop.group,
        undefined,
        wallWeaponShopHitScratch,
      );
      if (shopHit) {
        shopHit.shop = shop;
        wallWeaponShopTarget = shopHit;
      }
    }
  }
  if (
    !ctx.consoleHackOpenRef.current &&
    !ctx.settingsOpenRef.current &&
    !ctx.controlsOpenRef.current &&
    !frozen &&
    ctx.controlPanelsRef.current.length > 0 &&
    ctx.levelHitMeshes?.length
  ) {
    if (!centerHitRayReady) {
      ctx.hitRaycaster.setFromCamera(ctx.screenCenter, ctx.camera);
      centerHitRayReady = true;
    }
    hackTarget = pickHackableControlPanelUnderCrosshair(
      ctx.hitRaycaster,
      ctx.camera,
      ctx.levelHitMeshes
    );
  }
  const showHackPrompt = Boolean(hackTarget) && !doorTarget;
  const showHackCrosshair = showHackPrompt && canInteract;
  const showWallWeaponShopPrompt =
    Boolean(wallWeaponShopTarget) &&
    !doorTarget &&
    isPlayerWithinWallWeaponShopRange(ctx, wallWeaponShopTarget?.shop);
  if (showWallWeaponShopPrompt) {
    wallWeaponShopTarget.shop?.syncWallPrice?.(ctx);
  }
  const showWallWeaponShopInteract = showWallWeaponShopPrompt && canInteract;
  if (touchMode) {
    const showDoor = Boolean(doorTarget) || Boolean(wallWeaponShopTarget);
    if (showDoor !== ctx.touchShowInteractRef.current) {
      ctx.touchShowInteractRef.current = showDoor;
      ctx.setTouchShowInteract(showDoor);
    }
  }
  const centerPromptState = ctx.centerPromptStateRef.current;
  if (
    doorTarget &&
    canInteract &&
    wasBindingPressed(ctx.input, ctx.bindingsRef.current, "interact")
  ) {
    toggleVx27ContainerDoorLeaf(
      doorTarget.group,
      doorTarget.end,
      doorTarget.side
    );
  } else if (
    showHackCrosshair &&
    (wasBindingPressed(ctx.input, ctx.bindingsRef.current, "hack") ||
      ctx.input.consumeShoot())
  ) {
    ctx.openConsoleHackRef.current(hackTarget);
  } else if (
    showWallWeaponShopInteract &&
    (wasBindingPressed(ctx.input, ctx.bindingsRef.current, "interact") ||
      ctx.input.consumeShoot())
  ) {
    tryPurchaseWallWeaponShop(ctx, wallWeaponShopTarget?.shop, now);
  }
  
  updateControlPanelScreenCHackFlashes(
    ctx.controlPanelsRef.current,
    ctx.dayNightCurNightnessRef.current,
    now
  );
  const consoleInteractFocus = consoleHackUiOpen || showHackCrosshair;
  if (doorTarget) {
    setCenterPromptPersistent(
      centerPromptState,
      getVx27DoorInteractPrompt(
        doorTarget.group,
        doorTarget.end,
        doorTarget.side,
        ctx.bindingsRef.current,
      ),
    );
  } else {
    clearCenterPromptPersistent(centerPromptState);
  }
  if (touchMode) {
    const showHack = showHackCrosshair;
    if (showHack !== ctx.touchShowHackRef.current) {
      ctx.touchShowHackRef.current = showHack;
      ctx.setTouchShowHack(showHack);
    }
  }
  if (
    canUseWeapons &&
    getPrimaryWeaponConfig(ctx.activePrimaryId).viewOptions.flashlight &&
    wasBindingPressed(ctx.input, ctx.bindingsRef.current, "flashlight")
  ) {
    const nowOn = ctx.weapon?.toggleFlashlight();
    if (nowOn !== undefined) {
      ctx.flashlightOnRef.current = nowOn;
      dismissGameplayHint(ctx.gameplayHintsDismissedRef.current, "flashlight");
      clearGameplayHintPulse(ctx.centerPromptStateRef.current);
      ctx.refreshGameplayHintHudRef.current();
    }
  }
  
  if (
    DAY_NIGHT_SWITCHER_ENABLED &&
    canUseWeapons &&
    wasBindingPressed(ctx.input, ctx.bindingsRef.current, "dayNightToggle")
  ) {
    ctx.dayNightToggleRef.current?.(!ctx.sunIsDayRef.current);
    ctx.refreshGameplayHintHudRef.current();
  }

  if (
    canUseWeapons &&
    ctx.rain &&
    wasBindingPressed(ctx.input, ctx.bindingsRef.current, "weatherToggle")
  ) {
    ctx.weatherToggleRef.current?.();
  }
  
  const keyboardShoot =
    canUseWeapons &&
    isBindingDown(ctx.input, ctx.bindingsRef.current, "shoot");
  
  if (!frozen && !ctx.consoleHackOpenRef.current) {
    const rounds = ctx.roundsInMagRef.current;
    const spare = ctx.spareMagsRef.current;
    const getActivePrimaryForSwap =
      ctx.getActivePrimaryForSwap ??
      (ctx.getActivePrimaryForSwap = () => ctx.activePrimaryId);
    const onPrimarySwapComplete =
      ctx.onPrimarySwapComplete ??
      (ctx.onPrimarySwapComplete = (id) => {
        ctx.persistActiveAmmo();
        ctx.setActivePrimaryWeaponView(id);
        ctx.loadActiveAmmo(id);
        ctx.primaryWeapons[id]?.replayRaise?.();
      });
    const wallWeaponShopBlocksFire = showWallWeaponShopInteract;
    const hackBlocksFire = showHackCrosshair;
    if (
      canUseWeapons &&
      (pointerActive || keyboardShoot) &&
      !wallWeaponShopBlocksFire &&
      !hackBlocksFire
    ) {
      ctx.combat.processWeaponFire(dt);
    }
    ctx.player.tickAimRecoil(dt);

    ctx.weaponSwap.update(
      dt,
      ctx.primaryWeapons,
      getActivePrimaryForSwap,
      onPrimarySwapComplete
    );
  
    const cfg = ctx.getActiveWeaponConfig();
    const activeWeaponUpdateOptions =
      ctx.activeWeaponUpdateOptions ??
      (ctx.activeWeaponUpdateOptions = {
        onTorchShadowStart: () => {
          if (!ctx.rendererRef.current) return;
          beginShadowStartupWindow();
          requestShadowMapUpdate(ctx.rendererRef.current);
        },
      });
    activeWeaponUpdateOptions.snapAim = !locked && !touchMode;
    activeWeaponUpdateOptions.moveSpeed = ctx.player.getHorizontalSpeed();
    activeWeaponUpdateOptions.onStairs = ctx.player.isOnStairs();
    activeWeaponUpdateOptions.walkBobTuning = resolveWalkBobTuning(
      ctx.walkBobTuningRef.current
    );
    activeWeaponUpdateOptions.recoilTuning = normalizeRecoilTuning(
      ctx.recoilTuningRef.current
    );
    activeWeaponUpdateOptions.stairWalkTuning = normalizeStairWalkTuning(
      ctx.stairWalkTuningRef.current
    );
    activeWeaponUpdateOptions.nightness = ctx.dayNightCurNightnessRef.current;
    activeWeaponUpdateOptions.roundCount = rounds;
    activeWeaponUpdateOptions.roundDisplayLow =
      rounds < cfg.lowAmmoThreshold || (rounds === 0 && spare === 0);
    activeWeaponUpdateOptions.roundDisplayHp = ctx.playerHealthRef.current;
    activeWeaponUpdateOptions.roundDisplayStamina = ctx.player.getStamina();
    activeWeaponUpdateOptions.roundDisplayTuningRef =
      ctx.activePrimaryId === "pistol"
        ? ctx.pistolRoundDisplayTuningRef
        : ctx.roundDisplayTuningRef;
    activeWeaponUpdateOptions.laserEmitterOffset =
      ctx.laserEmitterTuningRef?.current?.[ctx.activePrimaryId];
    ctx.weapon?.update(
      ctx.camera,
      aimTarget,
      dt,
      ctx.getActiveTuningRef(),
      activeWeaponUpdateOptions
    );
    const torchLit = ctx.weapon?.isFlashlightOn?.();
    if (torchLit !== undefined) ctx.flashlightOnRef.current = torchLit;
    const idleWeaponUpdateOptions =
      ctx.idleWeaponUpdateOptions ??
      (ctx.idleWeaponUpdateOptions = {
        snapAim: true,
        moveSpeed: 0,
        onStairs: false,
        nightness: 0,
        onTorchShadowStart: undefined,
      });
    for (const id of ["rifle", "pistol"]) {
      const w = ctx.primaryWeapons[id];
      if (!w || w === ctx.weapon || !w.holder.visible) continue;
      const idleAmmo = ctx.ammoPoolSnapshotRef?.current?.[id];
      const idleCfg = getPrimaryWeaponConfig(id);
      const idleRounds = idleAmmo?.rounds ?? 0;
      const idleSpare = idleAmmo?.spare ?? 0;
      idleWeaponUpdateOptions.roundCount = idleRounds;
      idleWeaponUpdateOptions.roundDisplayLow =
        idleRounds < idleCfg.lowAmmoThreshold ||
        (idleRounds === 0 && idleSpare === 0);
      idleWeaponUpdateOptions.roundDisplayHp = ctx.playerHealthRef.current;
      idleWeaponUpdateOptions.roundDisplayStamina = ctx.player.getStamina();
      idleWeaponUpdateOptions.roundDisplayTuningRef =
        id === "pistol"
          ? ctx.pistolRoundDisplayTuningRef
          : ctx.roundDisplayTuningRef;
      idleWeaponUpdateOptions.laserEmitterOffset =
        ctx.laserEmitterTuningRef?.current?.[id];
      w.update(
        ctx.camera,
        0,
        dt,
        id === "pistol" ? ctx.pistolTuningRef : ctx.weaponTuningRef,
        idleWeaponUpdateOptions
      );
    }
  }

  const aimBlend = ctx.weapon?.getAimBlend() ?? 0;
  const activeWeaponCfg = ctx.getActiveWeaponConfig();
  const showGunReticule = activeWeaponCfg.viewOptions.gunReticule;
  const standardCrosshairOnly =
    activeWeaponCfg.viewOptions.standardCrosshairOnly;
  if (ctx.screenCrosshairRef.current) {
    const crosshairUpdateOptions =
      ctx.crosshairUpdateOptions ?? (ctx.crosshairUpdateOptions = {});
    crosshairUpdateOptions.aimBlend = aimBlend;
    crosshairUpdateOptions.tuning = ctx.crosshairTuningRef.current;
    crosshairUpdateOptions.showGunReticule = showGunReticule;
    crosshairUpdateOptions.standardCrosshairOnly = standardCrosshairOnly;
    crosshairUpdateOptions.doorTarget = Boolean(doorTarget);
    crosshairUpdateOptions.hackTarget = showHackCrosshair;
    crosshairUpdateOptions.purchaseTarget = showWallWeaponShopInteract;
    crosshairUpdateOptions.dt = dt;
    crosshairUpdateOptions.camera = ctx.camera;
    crosshairUpdateOptions.canvasHeight =
      ctx.canvasHeight ?? ctx.canvas.clientHeight;
    ctx.screenCrosshairRef.current.update(crosshairUpdateOptions);
  }
  const targetFov = THREE.MathUtils.lerp(HIP_FOV, ADS_FOV, aimBlend);
  const fovBlendSpeed = resolveAimBlendSpeed(aimTarget, aimBlend);
  const fovDelta = targetFov - ctx.camera.fov;
  if (Math.abs(fovDelta) > 0.001) {
    const nextFov =
      ctx.camera.fov + fovDelta * (1 - Math.exp(-fovBlendSpeed * dt));
    ctx.camera.fov =
      Math.abs(targetFov - nextFov) > 0.001 ? nextFov : targetFov;
    ctx.camera.updateProjectionMatrix();
  }

  if (
    canUseWeapons &&
    !ctx.rebindActionRef.current &&
    !ctx.settingsOpenRef.current &&
    !ctx.controlsOpenRef.current &&
    wasBindingPressed(ctx.input, ctx.bindingsRef.current, "reload")
  ) {
    ctx.tryReload();
  }
  
  if (
    !ctx.rebindActionRef.current &&
    !ctx.settingsOpenRef.current &&
    !ctx.controlsOpenRef.current &&
    wasBindingPressed(ctx.input, ctx.bindingsRef.current, "cycleFireMode")
  ) {
    const modes = ctx.getActiveWeaponConfig().fireModes;
    if (modes.length > 1) {
      const i = modes.indexOf(ctx.fireModeRef.current);
      const next = modes[(i + 1) % modes.length];
      ctx.setFireModeForActiveWeapon(next);
    }
  }

  tickPendingWallWeaponEquip(ctx);

  if (
    !frozen &&
    !ctx.rebindActionRef.current &&
    !ctx.settingsOpenRef.current &&
    !ctx.controlsOpenRef.current &&
    !ctx.weaponSwap.isBusy()
  ) {
    const rifleUnlocked = Boolean(ctx.rifleUnlockedRef?.current);
    const pistolOwned = isWallWeaponOwned(ctx, "pistol");
    const slotPick = getPrimaryWeaponIdFromSlotInput(ctx.input, rifleUnlocked);
    const swapToggle =
      wasBindingPressed(ctx.input, ctx.bindingsRef.current, "swapWeapon") ||
      wasPrimarySwapPressed(ctx.input);
    const swap = requireWasmMethod(ctx.gameCore, "resolvePrimaryWeaponSwap")({
      activeId: ctx.activePrimaryId,
      slotPick,
      swapToggle,
      rifleUnlocked,
      pistolOwned,
    });
    const nextId = swap.nextId;
    if (swap.allowed && nextId) {
      if (!ctx.primaryWeapons[nextId]) {
        ctx.ensurePrimaryWeaponLoaded?.(nextId);
        pulseGameplayHint(
          ctx.centerPromptStateRef.current,
          "Weapon loading",
          now,
        );
        ctx.refreshGameplayHintHudRef.current();
      } else {
        ctx.persistActiveAmmo();
        ctx.weaponSwap.requestSwap(nextId, ctx.activePrimaryId, ctx.primaryWeapons);
      }
    }
  }
  
  if (
    !frozen &&
    !ctx.rebindActionRef.current &&
    !ctx.settingsOpenRef.current &&
    !ctx.controlsOpenRef.current
  ) {
    for (let slot = 1; slot <= 4; slot += 1) {
      if (
        ctx.input.wasPressed(`Digit${slot}`) ||
        ctx.input.wasPressed(`Numpad${slot}`)
      ) {
        ctx.setSelectedWeaponSlot(slot);
        break;
      }
    }
  }
  
  ctx.updateGrenadeCooldownHud();
  ctx.tickCenterInteractPrompt(now);
  frameProfile?.mark("interact-weapon");
  
  // Grenade / flashbang: hold G to preview, release to throw
  const activeSlot = ctx.selectedWeaponSlotRef.current;
  const secondarySlot = requireWasmMethod(ctx.gameCore, "resolveSecondarySlot")({
    slot: activeSlot,
    grenadeSlot: GRENADE_WEAPON_SLOT,
    flashbangSlot: FLASHBANG_WEAPON_SLOT,
    grenadeCount: ctx.grenadeCountRef.current,
    flashbangCount: ctx.flashbangCountRef.current,
    cooldownRemaining: ctx.grenadeCooldownRemainingRef.current,
  });
  const throwingGrenade = secondarySlot.kind === "grenade";
  const throwingFlashbang = secondarySlot.kind === "flashbang";
  const cooldownReady = secondarySlot.cooldownReady;
  const canThrowSecondary = secondarySlot.canThrow;
  const gDown = isBindingDown(ctx.input, ctx.bindingsRef.current, "grenade");
  if (
    wasBindingPressed(ctx.input, ctx.bindingsRef.current, "grenade") &&
    !frozen &&
    secondarySlot.throwable
  ) {
    if (!cooldownReady) {
      ctx.showGrenadeCooldownHint(now);
    } else if (!canThrowSecondary) {
      const emptyMsg =
        secondarySlot.emptyMessage || ctx.secondaryWeaponEmptyMessage(activeSlot);
      if (emptyMsg) {
        pulseGameplayHint(
          ctx.centerPromptStateRef.current,
          emptyMsg,
          now,
        );
        ctx.refreshGameplayHintHudRef.current();
      }
    }
  }
  if (gDown && !ctx.grenadeHeld && !frozen && canThrowSecondary) {
    ctx.grenadeHeld = true;
  }
  if (ctx.grenadeHeld && gDown && !frozen && canThrowSecondary) {
    updateTrajectoryPreview(
      ctx.scene,
      ctx.camera,
      ctx.level.floorY,
      ctx.allColliders,
      ctx.level.bounds,
      projectileGroundSupport,
      ctx.weapon,
      ctx.gameCore,
    );
  } else if (gDown && !canThrowSecondary) {
    hideTrajectoryPreview();
  }
  if (ctx.grenadeHeld && !gDown) {
    ctx.grenadeHeld = false;
    hideTrajectoryPreview();
    if (!frozen && canThrowSecondary) {
      const throwKind = throwingFlashbang ? "flashbang" : "grenade";
      requireWasmMethod(ctx.gameCore, "syncThrowableCounts")(
        ctx.grenadeCountRef.current,
        ctx.flashbangCountRef.current,
      );
      const throwResult = requireWasmMethod(ctx.gameCore, "tryThrowThrowable")(
        throwKind,
        GRENADE_THROW_COOLDOWN_SEC,
      );
      if (!throwResult.thrown) {
        ctx.updateGrenadeCooldownHud();
        return;
      }
      ctx.grenadeCountRef.current = throwResult.grenadeCount;
      ctx.flashbangCountRef.current = throwResult.flashbangCount;
      ctx.grenadeCooldownRemainingRef.current = throwResult.cooldownRemaining;
      ctx.setGrenadeCount(ctx.grenadeCountRef.current);
      ctx.setFlashbangCount(ctx.flashbangCountRef.current);
      const g = spawnGrenade(
        ctx.scene,
        ctx.camera,
        ctx.level.floorY,
        ctx.allColliders,
        ctx.level.bounds,
        ctx.level.floorHoles ?? [],
        projectileGroundSupport,
        throwingFlashbang ? PROJECTILE_FLASHBANG : undefined,
        ctx.weapon,
        ctx.gameCore,
      );
      ctx.grenades.push(g);
      ctx.sounds.playGrenadeWhoosh({ volume: 0.8 });
      ctx.updateGrenadeCooldownHud();
    }
  }
  
  const dnTarget = ctx.dayNightTargetNightnessRef.current;
  let dnCur = ctx.dayNightCurNightnessRef.current;
  if (dnCur !== dnTarget) {
    const dnStep = dt / DAY_NIGHT_FADE_DURATION;
    dnCur =
      dnTarget > dnCur
        ? Math.min(dnTarget, dnCur + dnStep)
        : Math.max(dnTarget, dnCur - dnStep);
    ctx.dayNightCurNightnessRef.current = dnCur;
    ctx.applyDayNightRef.current?.(dnCur);
  }
  if (
    DAY_NIGHT_DEMO_CYCLE_ENABLED &&
    !frozen &&
    !ctx.settingsOpenRef.current &&
    !ctx.controlsOpenRef.current
  ) {
    ctx.dayNightDemoCycleElapsedRef.current += dt;
    if (ctx.dayNightDemoCycleElapsedRef.current >= DAY_NIGHT_DEMO_CYCLE_SEC) {
      ctx.dayNightDemoCycleElapsedRef.current = 0;
      ctx.dayNightToggleRef.current?.(!ctx.sunIsDayRef.current, {
        persist: false,
      });
    }
  }
  
  if (!consoleInteractFocus) {
    ctx.refreshGameplayHintHudRef.current();
  }
  
  ctx.combat.refreshLiveTargets();
  if (
    !consoleInteractFocus &&
    !frozen &&
    locked &&
    !ctx.settingsOpenRef.current &&
    !ctx.controlsOpenRef.current &&
    ctx.player
  ) {
    flushKillPredictiveGpuWarm();
    updateKillPredictiveCache({
      playerX: ctx.player.getX(),
      playerZ: ctx.player.getZ(),
      camera: ctx.camera,
      liveTargets: ctx.liveTargetsScratch,
      levelHitMeshes: ctx.levelHitMeshes,
      raycaster: ctx.hitRaycaster,
      scene: ctx.scene,
      allColliders: ctx.allColliders,
      containers: ctx.vx27ContainersRef.current,
      dt,
    });
  }
  updateBloodSplatters(ctx.bloodSplatters, dt, ctx.scene);
  ctx.scorePopupLayer?.update(ctx.camera, dt);
  updateBulletHoles(dt);
  ctx.laserTracers?.update(dt);
  const enemyMuzzlePreview = ctx.enemyMuzzlePreviewRef?.current;
  if (enemyMuzzlePreview && ctx.enemyRigWizardOpenRef?.current) {
    if (!enemyMuzzlePreview.isVisible()) enemyMuzzlePreview.setVisible(true);
    enemyMuzzlePreview.update(ctx.level?.targets ?? []);
  } else if (enemyMuzzlePreview?.isVisible()) {
    enemyMuzzlePreview.setVisible(false);
  }
  
  updateGrenades(
    ctx.grenades,
    dt,
    ctx.scene,
    ctx.combat.getLiveTargets,
    ctx.combat.applyGrenadeHit,
    (mesh, blastDir, opts) => {
      ctx.combat.playTargetDeathSound(mesh, opts?.hitPoint, opts?.hitZone);
      startDeathAnimation(mesh, blastDir, opts);
    },
    {
      scene: ctx.scene,
      colliders: ctx.allColliders,
      floorY: ctx.level.floorY,
      bounds: ctx.level.bounds,
      floorHoles: ctx.level.floorHoles ?? [],
      groundSupport: projectileGroundSupport,
      simTime: ctx.simTime,
      hitMeshes: ctx.levelHitMeshes,
      onBloodSplatter: (splatter) => {
        if (splatter) ctx.bloodSplatters.push(splatter);
      },
      onFloorHit: (pos, impact) => {
        ctx.sounds.playGrenadeFloorHit(ctx.scene, pos, { impact });
      },
      onExplode: (pos, isFlashbang) => {
        ctx.sounds.playGrenadeExplosion(ctx.scene, pos);
        triggerScreenShake(ctx.camera.position, pos);
        if (isFlashbang) return;
        const distToPlayer = ctx.camera.position.distanceTo(pos);
        if (distToPlayer >= getGrenadeParams().blastRadius) return;
        flashBlindPos.copy(pos);
        flashBlindPos.y += 0.35;
        if (
          !hasLineOfSightToPoint(
            flashBlindPos,
            ctx.camera.position,
            ctx.levelHitMeshes,
            { blockEpsilon: 0.35 }
          )
        ) {
          return;
        }
        const newHp = requireWasmMethod(ctx.gameCore, "applyGrenadeExplosionDamage")();
        ctx.playerHealthRef.current = newHp;
        ctx.setPlayerHealth(newHp);
        ctx.triggerPlayerHurtFeedback(ctx.hurtVignetteFlashEndRef, ctx.sounds);
        if (newHp <= 0) ctx.grenadeSuicideRef.current = true;
      },
      calculateGrenadeBlastHit: (distance, blastRadius, maxDamage, falloffPower) =>
        requireWasmMethod(ctx.gameCore, "calculateGrenadeBlastHit")(
          distance,
          blastRadius,
          maxDamage,
          falloffPower,
        ),
      gameCore: ctx.gameCore,
      countdownDuration: ctx.sounds.getGrenadeCountdownDuration(),
      onCountdown: (pos, playbackRate) => {
        ctx.sounds.playGrenadeCountdown(ctx.scene, pos, { playbackRate });
      },
      canFlashbangBlindPlayer: ctx.combat.canFlashbangBlindPlayer,
      onPlayerBlinded: () => {
        ctx.flashbangBlindStartRef.current = performance.now();
      },
      onTargetBlinded: (mesh, time) => {
        blindTargetFromFlashbang(mesh, time, ctx.gameCore);
      },
      viewerPos: ctx.camera.position,
    }
  );
  applyScreenShake(ctx.camera, dt);
  ctx.updateFlashbangBlindVisuals(ctx.level.targets, ctx.simTime);
  ctx.updateFlashbangOverlay(
    ctx.flashbangOverlayRef.current,
    ctx.flashbangBlindStartRef.current
  );
  if (ctx.flashbangBlindStartRef.current) {
    const blindElapsed =
      (performance.now() - ctx.flashbangBlindStartRef.current) / 1000;
    if (blindElapsed >= getFlashbangBlindDurationSec(ctx.gameCore)) {
      ctx.flashbangBlindStartRef.current = 0;
    }
  }
  
  updateTargetsRepair(ctx.level.targets, dt);
  updateLiveTargetsFloorHoles(
    ctx.level.targets,
    dt,
    ctx.level.floorY,
    ctx.level.floorHoles ?? [],
    (mesh) => {
      deactivateTarget(mesh);
      ctx.combat.scheduleRespawn(mesh);
    },
    (mesh, position) => {
      ctx.combat.playTargetHoleFallSound(mesh, position);
    },
    ctx.gameCore,
  );
  updateTargetHealthBars(ctx.level.targets, dt, ctx.camera, {
    playerX: ctx.player.getX(),
    playerZ: ctx.player.getZ(),
    containers: ctx.vx27ContainersRef.current,
    colliders: ctx.allColliders,
  });
  flushAllPendingRagdolls();
  ctx.combat.flushPendingKillBlood();
  updateDeathAnimations(ctx.level.targets, dt, (mesh) => {
    deactivateTarget(mesh);
    ctx.combat.scheduleRespawn(mesh);
  }, {
    colliders: ctx.allColliders,
    floorY: ctx.level.floorY,
    bounds: ctx.level.bounds,
    floorHoles: ctx.level.floorHoles ?? [],
    gameCore: ctx.gameCore,
    onBodyFloorHit: (pos, impact) => {
      ctx.sounds.playBodyFloorHit(ctx.scene, pos, { impact });
    },
    onHoleFall: (mesh, position) => {
      ctx.combat.playTargetHoleFallSound(mesh, position);
    },
  });
  frameProfile?.mark("combat");
  
  
  updateHpOrbs(
    ctx.hpOrbs, dt, ctx.camera.position,
    (value) => {
      const reward = requireWasmMethod(ctx.gameCore, "applyPickupReward")(
        "hp",
        value,
        value,
        Number.POSITIVE_INFINITY,
      );
      ctx.playerHealthRef.current = reward.playerHealth;
      ctx.player.syncStaminaMaxFromHp();
      ctx.pickupFlashLayerRef.current?.show("hp");
      ctx.sounds.playHpPickup();
      ctx.scheduleGameplayHudSyncRef.current();
    },
    ctx.allColliders,
    ctx.level.bounds,
    ctx.level.floorHoles ?? [],
    ctx.gameCore,
  );
  
  updateAmmoDrops(
    ctx.ammoDrops, dt, ctx.camera.position,
    (value, drop) => {
      if (drop?.compassMarkerId) {
        hideCompassCollectibleMarker(ctx.collectibleEntries, drop.compassMarkerId);
      }
      const ammo = requireWasmMethod(ctx.gameCore, "addWeaponRounds")(
        ctx.activePrimaryId,
        value,
      );
      ctx.roundsInMagRef.current = ammo.rounds;
      ctx.spareMagsRef.current = ammo.spare;
      ctx.persistActiveAmmo();
      ctx.pickupFlashLayerRef.current?.show("ammo");
      ctx.sounds.playSupplyPickup();
      ctx.scheduleGameplayHudSyncRef.current();
    },
    ctx.allColliders,
    ctx.level.bounds,
    ctx.level.floorHoles ?? [],
    null,
    ctx.gameCore,
  );
  
  updateLevelCollectibles(
    ctx.collectibleEntries,
    dt,
    ctx.player.getX(),
    ctx.player.getFootY(),
    ctx.player.getZ(),
    (value, drop, entry) => {
      if (drop?.compassMarkerId) {
        hideCompassCollectibleMarker(ctx.collectibleEntries, drop.compassMarkerId);
      }
      const kind = entry?.type ?? drop?.rewardType ?? "ammo";
      if (kind === "hp") {
        const reward = requireWasmMethod(ctx.gameCore, "applyPickupReward")(
          "hp",
          value ?? 0,
          10,
          100,
        );
        ctx.playerHealthRef.current = reward.playerHealth;
        ctx.setPlayerHealth(ctx.playerHealthRef.current);
        ctx.pickupFlashLayerRef.current?.show("hp");
        ctx.sounds.playHpPickup();
      } else if (kind === "grenade") {
        const reward = requireWasmMethod(ctx.gameCore, "applyPickupReward")(
          "grenade",
          value ?? 0,
          1,
          100,
        );
        ctx.grenadeCountRef.current = reward.grenadeCount;
        ctx.setGrenadeCount(ctx.grenadeCountRef.current);
        ctx.pickupFlashLayerRef.current?.show("grenade");
        ctx.sounds.playSupplyPickup();
      } else if (kind === "flashbang") {
        const reward = requireWasmMethod(ctx.gameCore, "applyPickupReward")(
          "flashbang",
          value ?? 0,
          1,
          100,
        );
        ctx.flashbangCountRef.current = reward.flashbangCount;
        ctx.setFlashbangCount(ctx.flashbangCountRef.current);
        ctx.pickupFlashLayerRef.current?.show("grenade");
        ctx.sounds.playSupplyPickup();
      } else if (kind === "score") {
        const reward = requireWasmMethod(ctx.gameCore, "applyPickupReward")(
          "score",
          value ?? 0,
          SCORE_PACK_DEFAULT_VALUE,
          100,
        );
        const credits = reward.value;
        ctx.playerScoreRef.current = reward.playerScore;
        ctx.updateScoreHud(ctx.scoreHudRef.current, ctx.playerScoreRef.current);
        ctx.pickupFlashLayerRef.current?.show({
          type: "score",
          label: `+ ${credits} CREDITS`,
        });
        ctx.sounds.playSupplyPickup();
      } else {
        const ammo = requireWasmMethod(ctx.gameCore, "addWeaponRounds")(
          ctx.activePrimaryId,
          value ?? 10,
        );
        ctx.roundsInMagRef.current = ammo.rounds;
        ctx.spareMagsRef.current = ammo.spare;
        ctx.persistActiveAmmo();
        ctx.pickupFlashLayerRef.current?.show("ammo");
        ctx.sounds.playSupplyPickup();
      }
      ctx.scheduleGameplayHudSyncRef.current();
    },
    {
      testRespawn: LEVEL_COLLECTIBLE_TEST_RESPAWN,
      scene: ctx.level.pickupsGroup ?? ctx.scene,
      arena: ctx.arena,
      catwalkDeckY: ctx.level.catwalkDeckY,
      compassContainer: ctx.compassMarkersRef.current,
      gameCore: ctx.gameCore,
    }
  );
  
  updateGrenadeDrops(
    ctx.grenadeDrops,
    dt,
    ctx.camera.position,
    (value) => {
      const reward = requireWasmMethod(ctx.gameCore, "applyPickupReward")(
        "grenade",
        value,
        1,
        100,
      );
      ctx.grenadeCountRef.current = reward.grenadeCount;
      ctx.setGrenadeCount(ctx.grenadeCountRef.current);
      ctx.pickupFlashLayerRef.current?.show("grenade");
      ctx.sounds.playSupplyPickup();
      ctx.scheduleGameplayHudSyncRef.current();
    },
    ctx.allColliders,
    ctx.level.bounds,
    ctx.level.floorHoles ?? [],
    ctx.gameCore,
  );
  frameProfile?.mark("pickups");
  
  let aliveCount = 0;
  for (const t of ctx.level.targets) {
    if (t.visible && t.userData.health > 0 && !t.userData.dying) aliveCount++;
  }
  if (aliveCount !== ctx._lastHostileCount) {
    ctx._lastHostileCount = aliveCount;
    ctx.hostileCountRef.current = aliveCount;
    if (ctx.showHudRef.current) {
      ctx.updateHostileCountHud(ctx.hostileCountHudRef.current, aliveCount);
    }
  }
  
  if (ctx.showHudRef.current) {
    ctx.updateDamageVignette(
      ctx.damageVignetteRef.current,
      ctx.playerHealthRef.current,
      ctx.loadDoneRef.current && !ctx.deathStateRef.current
    );
    ctx.updateHurtVignette(
      ctx.hurtVignetteRef.current,
      ctx.hurtVignetteFlashEndRef.current
    );
    ctx.updateWalkPowerHud(
      ctx.walkPowerRef.current,
      ctx.player.getStamina(),
      ctx.player.getStaminaMax(),
      ctx.playerHealthRef.current,
      ctx.loadDoneRef.current && !ctx.deathStateRef.current
    );
  }
  
  ctx.input.endFrame();
  ctx.sunRef.current?.target?.updateMatrixWorld(true);

  resetCameraRenderLayers(ctx.camera);
  const { visibleCount: visibleRoomCount } = updateRoomCulling(
    ctx.roomCullablesRef.current,
    ctx.camera,
    {
      x: ctx.player.getX(),
      z: ctx.player.getZ(),
      footY: ctx.player.getFootY(),
    },
    ctx.arenaHalf,
    ctx.attachWall,
    ctx.level.catwalkDeckY,
    ctx.level.doorwayOpenings ?? [],
    ctx.arena.wallThickness ?? 0.5
  );
  
  const playerVx27Container = resolveVx27ContainerForPlayer(
    ctx.player.getX(),
    ctx.player.getZ(),
    ctx.vx27ContainersRef.current,
    ctx.allColliders
  );
  const { anyVisible: inContainerPass } = updateVx27ContainerCulling(
    ctx.vx27ContainerCullablesRef.current,
    ctx.camera,
    playerVx27Container
  );
  updateVx27ContainerBeaconLights();
  updateVx27ContainerDoorAnimations(ctx.vx27ContainersRef.current, dt);
  let doorCollidersDirty = false;
  for (const doorGroup of ctx.vx27ContainersRef.current) {
    if (!consumeVx27DoorColliderDirty(doorGroup)) continue;
    doorCollidersDirty = true;
    syncVx27ContainerCollider(
      ctx.level.colliders,
      doorGroup.userData.vx27PropId,
      readVx27ContainerPlacement(doorGroup),
      {
        ...doorGroup.userData.vx27PropDef,
        interiorInsets: doorGroup.userData.vx27InteriorInsets,
        edgeRadius: doorGroup.userData.vx27EdgeRadius,
        exteriorCornerRadius: doorGroup.userData.vx27ExteriorCornerRadius,
        scale: doorGroup.userData.vx27Scale,
        width: doorGroup.userData.vx27Width,
        height: doorGroup.userData.vx27Height,
        length: doorGroup.userData.vx27Length,
        doorTuning: doorGroup.userData.vx27DoorTuning,
      }
    );
  }
  if (doorCollidersDirty) ctx.syncAllColliders();
  
  const interiorLevelFrame = isInteriorEnvironmentLevel(ctx.arenaLiveRef.current);
  const inRoomInterior =
    interiorLevelFrame ||
    isPlayerInsideRoomForLighting(
      ctx.player.getX(),
      ctx.player.getZ(),
      ctx.player.getFootY(),
      ctx.arena.rooms,
      ctx.arenaHalf,
      ctx.attachWall,
      ctx.level.catwalkDeckY,
      ctx.arena.floorExtensions ?? [],
      ctx.arena.wallThickness ?? 0.5
    );
  const inRoomBody =
    interiorLevelFrame ||
    isIndoorLightingZone(
      ctx.player.getX(),
      ctx.player.getZ(),
      ctx.player.getFootY(),
      ctx.arena.rooms,
      ctx.arenaHalf,
      ctx.attachWall,
      ctx.level.catwalkDeckY,
      ctx.level.doorwayOpenings ?? [],
      ctx.arena.wallThickness ?? 0.5,
      ctx.arena.floorExtensions ?? []
    );
  // Room pass follows ctx.camera frustum (+ body-in-room). Viewmodel lighting follows
  // feet / door threshold only — not raw frustum (service-room bbox is huge).
  const inRoomPass =
    interiorLevelFrame ||
    inRoomBody ||
    visibleRoomCount > 0 ||
    inContainerPass;
  const viewmodelLightingZone =
    interiorLevelFrame
      ? "room"
      : resolveViewmodelLightingZone({
          x: ctx.player.getX(),
          z: ctx.player.getZ(),
          footY: ctx.player.getFootY(),
          rooms: ctx.arena.rooms,
          arenaHalf: ctx.arenaHalf,
          attachWall: ctx.attachWall,
          arenaWallThickness: ctx.arena.wallThickness ?? 0.5,
          catwalkDeckY: ctx.level.catwalkDeckY,
          colliders: ctx.allColliders,
        });
  syncLightLayersForZone(
    ctx.scene,
    viewmodelLightingZone,
    ctx.outdoorLights,
    ctx.roomLightsRef.current
  );
  syncOilBarrelFireLightLayers(
    ctx.oilBarrelFireLightsRef.current,
    isEnclosedViewmodelZone(viewmodelLightingZone)
  );
  
  const cachedWeatherOccluders = ensureWeatherOccluders(ctx);
  const rainOccluders = cachedWeatherOccluders.rain;
  const rainCanopySlabs = ensureRainCanopy(ctx);

  const inContainer = viewmodelLightingZone === "container";
  const underCanopy = isUnderRainCanopy(
    ctx.player.getX(),
    ctx.player.getZ(),
    ctx.player.getFootY(),
    rainCanopySlabs,
    ctx.level.catwalkDeckY
  );
  tickWeatherSession(ctx.weatherSessionRef, dt, () => {
    ctx.weatherToggleRef.current?.({ forceOff: true });
  });

  const rainWanted = ctx.rainEnabledRef.current;
  const weatherTransition = ctx.weatherTransitionRef.current;
  const rainWetnessWanted = ctx.rainEnabledRef.current;
  tickWeatherTransition(weatherTransition, dt, {
    rainWanted,
    rainWetnessWanted,
  });

  const rainAmbientFade = inRoomInterior
    ? 0
    : inRoomBody
      ? weatherTransition.rainFade * 0.15
      : underCanopy || inContainer
        ? weatherTransition.rainFade * 0.22
        : weatherTransition.rainFade;
  const containerColliders = inContainer ? ctx.allColliders : [];
  // Full-column rain suppression for every covered area (catwalk decks, container
  // roofs). Active whenever the player is below deck height so rain doesn't render
  // "through" the ceiling even though depthTest is off on the material. Disabled
  // when the player is on the deck itself (open sky) so rain is still visible there.
  const playerOnDeck =
    ctx.level.catwalkDeckY != null &&
    ctx.player.getFootY() >= ctx.level.catwalkDeckY - 0.45;
  const belowCatwalk =
    ctx.level.catwalkDeckY != null &&
    ctx.player.getFootY() < ctx.level.catwalkDeckY - 0.45;
  // Full rain occluder list (uncapped) — rainCanopySlabs is capped at 24 for ambient muffling only.
  const canopyOccluders = playerOnDeck ? [] : rainOccluders;
  const interiorFloorZones = buildInteriorFloorHideZones(ctx.level.groundSurfaces);

  updateRain(ctx.rain, ctx.camera, dt, {
    fade: weatherTransition.rainFade,
    // Only kill rain entirely for pure interior levels (no exterior door to look through).
    // For room interiors use enclosed/vista mode so rain is visible through the doorway.
    hideRain: interiorLevelFrame,
    canopyOccluders,
    interiorFloorZones,
    useRainDepthTest: inRoomInterior || belowCatwalk,
    inContainer,
    containerColliders,
    enclosed: inRoomBody,
    playerX: ctx.player.getX(),
    attachWall: ctx.attachWall,
    arenaHalf: ctx.arenaHalf,
    wallThickness: ctx.arena.wallThickness ?? 0.5,
    occluders: rainOccluders,
    intensity: ctx.rainIntensityRef.current,
    floorY: ctx.arena.floorY ?? 0,
  });

  updateRainWetness(
    ctx.rainWetSurfaces ?? [],
    interiorLevelFrame
      ? 0
      : (weatherTransition.rainWetFade ?? weatherTransition.rainFade),
    {
      canopySlabs: rainCanopySlabs,
      interiorFloorZones,
    },
  );

  ctx.sounds.updateRainAmbient(rainAmbientFade, now);

  tickLightningFlash(ctx.lightningFlash, dt, {
    rainFade: weatherTransition.rainFade,
    active: rainWanted,
  });

  applyFrameShadowUpdates(ctx.renderer, {
    sunCastsShadow:
      (ctx.sunRef.current?.castShadow && ctx.sunRef.current.intensity > 0.001) ||
      false,
    moonCastsShadow:
      (ctx.moonRef.current?.castShadow && ctx.moonRef.current.intensity > 0.001) ||
      false,
    dayNightAnimating:
      ctx.dayNightCurNightnessRef.current !==
      ctx.dayNightTargetNightnessRef.current,
    flashlightShadow:
      !consoleInteractFocus &&
      (ctx.weapon?.isFlashlightCastingShadow?.() ?? false),
  });
  frameProfile?.mark("world");
  
  ctx.sky?.update(ctx.camera);
  {
    const nightness = ctx.dayNightCurNightnessRef.current;
    // How much "daytime rain" is happening: 0 = none, 1 = full rain at midday.
    const rainDay = weatherTransition.rainFade * (1 - nightness);
    const skyLightning = getLightningSkyFlashStrength(ctx.lightningFlash, nightness);
    if (ctx.sky) {
      ctx.sky.setBrightness?.(1 - 0.30 * rainDay);
      ctx.sky.setGreyness?.(0.88 * rainDay);
      ctx.sky.setSunRainDim?.(1 - 0.85 * rainDay);
      ctx.sky.setLightningFlash?.(skyLightning);
    }
    applyLightningFlashAtmosphere(
      ctx.scene,
      ctx.renderer,
      ctx.lightningFlash,
      nightness,
      rainDay
    );
    updateLightningFlashOverlay(ctx.lightningFlashOverlayRef?.current ?? null, ctx.lightningFlash, {
      sheltered: inRoomInterior || inRoomBody || inContainer,
      nightness,
    });
    if (ctx.sunRef?.current) {
      const sun = ctx.sunRef.current;
      const prevMul = sun.userData.sunRainMul ?? 1;
      const newMul = 1 - 0.20 * rainDay;
      sun.intensity = (sun.intensity / prevMul) * newMul;
      sun.userData.sunRainMul = newMul;
    }
  }
  updateOilBarrelContainerDoorFireSpill(
    ctx.oilBarrelFireLightsRef.current,
    ctx.vx27ContainersRef.current,
    isEnclosedViewmodelZone(viewmodelLightingZone),
    now * 0.001,
  );
  renderSceneWithLayeredLighting(ctx.renderer, ctx.scene, ctx.camera, {
    skyRoot: ctx.sky?.mesh ?? null,
    skipRoomPass: !inRoomPass,
  });
  renderWeatherPass(ctx.renderer, ctx.scene, ctx.camera);
  if (
    !consoleInteractFocus &&
    ctx.level?.targets &&
    hasVisibleTargetHealthBars(ctx.level.targets)
  ) {
    renderTargetHealthBarsPass(ctx.renderer, ctx.scene, ctx.camera, ctx.level.targets);
  }
  if (!consoleHackUiOpen) {
    renderCrosshairPass(ctx.renderer, ctx.scene, ctx.camera);
    renderViewmodelPass(ctx.renderer, ctx.scene, ctx.camera);
  }
  frameProfile?.end("render");
}
