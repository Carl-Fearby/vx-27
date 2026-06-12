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
import {
  pickFirstBulletHit,
  updateBulletHoles,
} from "@/lib/combat/BulletHoles.js";
import { hasLineOfSightToPoint } from "@/lib/combat/LineOfSight.js";
import { groundSupportFromLevel } from "@/lib/physics/GroundSupport.js";
import { updateCandleFlicker } from "@/lib/lighting/CandleFlicker.js";
import {
  renderCrosshairPass,
  renderViewmodelPass,
  renderSceneWithLayeredLighting,
  resetCameraRenderLayers,
  syncLightLayersForZone,
  syncOilBarrelFireLightLayers,
} from "@/lib/lighting/SceneEnvironment.js";
import { resolveViewmodelLightingZone, isEnclosedViewmodelZone } from "@/lib/lighting/LightingZones.js";
import { updateRoomCulling } from "@/lib/rooms/RoomCulling.js";
import { isIndoorLightingZone } from "@/lib/rooms/RoomPlacement.js";
import { isInteriorEnvironmentLevel } from "@/lib/level/InteriorEnvironment.js";
import { buildRainOccluderSlabs, updateRain } from "@/lib/Rain.js";
import { buildSnowOccluderSlabs, updateSnow } from "@/lib/Snow.js";
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
import {
  getBarrelPlacementHighlightIds,
  pickOilBarrelPropUnderCrosshair,
} from "@/lib/oil-barrel/OilBarrelPlacementPick.js";
import { updateBarrelPlacementHighlights } from "@/lib/oil-barrel/OilBarrelPlacementHighlight.js";
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
import {
  RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC,
  RADIOACTIVE_OVERFLOW_DECAY_PCT,
} from "@/lib/player/PlayerController.js";
import {
  DEATH_FALL_DROP,
  DEATH_MIN_DISPLAY_MS,
  DEATH_FADE_MS,
  OIL_BARREL_FIRE_PROXIMITY_DAMAGE,
  HEALTH_REGEN_INTERVAL,
  HEALTH_REGEN_AMOUNT,
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
  getOtherPrimaryWeaponId,
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
import { normalizeStairWalkTuning } from "@/lib/stairs/StairWalkTuning.js";
import { startFrameProfile } from "@/lib/gameLoop/FrameProfiler.js";

const LASER_EMITTER_PREVIEW_RANGE = 55;

/** @param {import("./gameLoopContext.js").GameLoopContext} ctx */
function ensureWeatherOccluders(ctx) {
  if (ctx.weatherOccluders) return ctx.weatherOccluders;
  const deckCeilings = ctx.level.ceilingColliders.filter((c) => c.kind === "deck");
  ctx.weatherOccluders = {
    rain: buildRainOccluderSlabs(
      ctx.level.groundSurfaces,
      ctx.level.catwalkDeckY,
      deckCeilings,
      ctx.level.stairColliders
    ),
    snow: buildSnowOccluderSlabs(
      ctx.level.groundSurfaces,
      ctx.level.catwalkDeckY,
      deckCeilings,
      ctx.level.stairColliders
    ),
  };
  return ctx.weatherOccluders;
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

/** @param {import("./gameLoopContext.js").GameLoopContext} ctx */
function isWeaponTuningLaserPreviewActive(ctx) {
  return Boolean(ctx.primaryWeaponTuneEnabledRef?.current);
}

/** @param {import("./gameLoopContext.js").GameLoopContext} ctx */
function resolveWeaponTuningPreviewWeapon(ctx) {
  if (!ctx.primaryWeaponTuneEnabledRef?.current) return null;
  const id = ctx.primaryWeaponTuneWeaponRef?.current ?? ctx.activePrimaryId;
  return (
    ctx.primaryWeapons?.[id] ??
    (ctx.activePrimaryId === id ? ctx.weapon : null)
  );
}

/** @param {import("./gameLoopContext.js").GameLoopContext} ctx */
function updateWeaponTuningLaserPreview(ctx) {
  const laserTracers = ctx.laserTracers;
  if (!laserTracers?.showPreview) return;

  if (
    !isWeaponTuningLaserPreviewActive(ctx) ||
    ctx.controlsOpenRef.current ||
    ctx.consoleHackOpenRef.current
  ) {
    laserTracers.hidePreview?.();
    return;
  }

  const previewWeapon = resolveWeaponTuningPreviewWeapon(ctx);
  if (!previewWeapon?.getMuzzleWorld) {
    laserTracers.hidePreview?.();
    return;
  }

  const from =
    ctx.laserEmitterPreviewFrom ??
    (ctx.laserEmitterPreviewFrom = new THREE.Vector3());
  const muzzleDir =
    ctx.laserEmitterPreviewMuzzleDir ??
    (ctx.laserEmitterPreviewMuzzleDir = new THREE.Vector3());
  const camDir =
    ctx.laserEmitterPreviewCamDir ??
    (ctx.laserEmitterPreviewCamDir = new THREE.Vector3());
  const to =
    ctx.laserEmitterPreviewTo ??
    (ctx.laserEmitterPreviewTo = new THREE.Vector3());
  const hits =
    ctx.laserEmitterPreviewHits ?? (ctx.laserEmitterPreviewHits = []);

  previewWeapon.getMuzzleWorld(from, muzzleDir, ctx.camera);
  const previousFar = ctx.hitRaycaster.far;
  ctx.hitRaycaster.setFromCamera(ctx.screenCenter, ctx.camera);
  ctx.hitRaycaster.far = LASER_EMITTER_PREVIEW_RANGE;
  camDir.copy(ctx.hitRaycaster.ray.direction);

  hits.length = 0;
  if (ctx.levelHitMeshes?.length) {
    ctx.hitRaycaster.intersectObjects(ctx.levelHitMeshes, false, hits);
  }
  const surfaceHit = pickFirstBulletHit(hits);
  if (surfaceHit) {
    to.copy(surfaceHit.point);
  } else {
    to.copy(from).addScaledVector(camDir, LASER_EMITTER_PREVIEW_RANGE);
  }
  ctx.hitRaycaster.far = previousFar;

  laserTracers.showPreview(from, to, {
    radioactive: ctx.playerHealthRef.current > 100,
  });
}

/** @param {import("./gameLoopContext.js").GameLoopContext} ctx @param {number} now */
export function runGameFrame(ctx, now) {
  const frameProfile = startFrameProfile(ctx);
  const consoleHackUiOpen = ctx.consoleHackOpenRef.current;
  const flashBlindPos =
    ctx.flashBlindPosScratch ?? (ctx.flashBlindPosScratch = new THREE.Vector3());
  const projectileGroundSupport =
    ctx.projectileGroundSupport ??
    (ctx.projectileGroundSupport = groundSupportFromLevel(ctx.level, 0.05));
  ctx.combat.flushBloodAfterRagdoll();
  ctx.combat.flushPendingRagdolls();
  ctx.combat.flushPendingKillBlood();
  tickOilBarrelInteriorVideo(ctx.camera, ctx.oilBarrelRuntimeIndex);
  ctx.sounds.updateOilBarrelFire(
    ctx.oilBarrelRuntimeIndex.fireLights,
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
  const rifleRoundDisplayAimTabActive =
    ctx.roundDisplayTuneEnabledRef?.current &&
    ctx.roundDisplayPreviewAimRef?.current &&
    ctx.activePrimaryId === "rifle";
  const pistolRoundDisplayAimTabActive =
    ctx.pistolRoundDisplayTuneEnabledRef?.current &&
    ctx.pistolRoundDisplayPreviewAimRef?.current &&
    ctx.activePrimaryId === "pistol";
  const primaryWeaponTuneAimTabActive =
    ctx.primaryWeaponTuneEnabledRef?.current &&
    ctx.primaryWeaponTuneModeRef?.current === "ads" &&
    ctx.primaryWeaponTuneWeaponRef?.current === ctx.activePrimaryId;
  const aimTarget =
    aimHeld ||
    rifleRoundDisplayAimTabActive ||
    pistolRoundDisplayAimTabActive ||
    primaryWeaponTuneAimTabActive
      ? 1
      : 0;
  
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
    if (!deathState.respawned) {
      const canRespawn = now >= deathState.minDisplayEnd;
      if (canRespawn && ctx.input.consumeShoot()) {
        ctx.player.respawn();
        ctx.weapon?.replayRaise?.();
        deathState.respawned = true;
        ctx.playerHealthRef.current = 100;
        ctx.setPlayerHealth(100);
        ctx.grenadeCountRef.current = getGrenadeParams().grenadeCount;
        ctx.setGrenadeCount(ctx.grenadeCountRef.current);
        ctx.flashbangBlindStartRef.current = 0;
        ctx.updateFlashbangOverlay(ctx.flashbangOverlayRef.current, 0);
        deathState.fadeEndTime = now + DEATH_FADE_MS;
        ctx.beginDeathOverlayFade(ctx.deathOverlayRef.current);
      }
    }
    if (deathState.respawned && now >= deathState.fadeEndTime) {
      ctx.hideDeathOverlay(ctx.deathOverlayRef.current);
      ctx.deathStateRef.current = null;
    } else {
      frozen = !deathState.respawned;
    }
  }
  
  const canUseWeapons =
    !frozen &&
    !ctx.rebindActionRef.current &&
    !ctx.settingsOpenRef.current &&
    !ctx.controlsOpenRef.current &&
    !ctx.consoleHackOpenRef.current &&
    !ctx.oilBarrelPlacementTuneEnabledRef?.current;
  
  if (ctx.consoleHackOpenRef.current) {
    ctx.input.discardLookDelta?.();
    if (!touchMode && document.pointerLockElement !== ctx.canvas) {
      ctx.safeRequestPointerLock(ctx.canvas);
    }
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
        ctx.levelHitMeshes
      )
    ) {
      const newHp = Math.max(
        0,
        ctx.playerHealthRef.current - OIL_BARREL_FIRE_PROXIMITY_DAMAGE
      );
      ctx.playerHealthRef.current = newHp;
      ctx.setPlayerHealth(newHp);
      ctx.triggerPlayerHurtFeedback(ctx.hurtVignetteFlashEndRef, ctx.sounds);
    }
  
    // Death-fall: dropped through a floor hole — trigger after the fall
    // animation (foot crosses kill depth), not on hole entry. Hole entry
    // only commits movement lock + tumble in PlayerController.
    if (
      !ctx.deathStateRef.current &&
      ctx.player.getFootY() < ctx.level.floorY - DEATH_FALL_DROP
    ) {
      const reason = "You fell to your death";
      ctx.playerLivesRef.current = Math.max(0, ctx.playerLivesRef.current - 1);
      ctx.setPlayerLives(ctx.playerLivesRef.current);
      ctx.playerHealthRef.current = 0;
      ctx.setPlayerHealth(0);
      ctx.deathStateRef.current = {
        reason,
        respawned: false,
        minDisplayEnd: now + DEATH_MIN_DISPLAY_MS,
        fadeEndTime: Infinity,
      };
      ctx.showDeathOverlay(
        ctx.deathOverlayRef.current,
        ctx.deathReasonRef.current,
        reason
      );
      frozen = true;
    }
    if (
      !ctx.deathStateRef.current &&
      ctx.playerHealthRef.current <= 0
    ) {
      const reason = ctx.grenadeSuicideRef.current
        ? "Suicide is never the answer"
        : "You were killed by an enemy";
      ctx.grenadeSuicideRef.current = false;
      ctx.playerLivesRef.current = Math.max(0, ctx.playerLivesRef.current - 1);
      ctx.setPlayerLives(ctx.playerLivesRef.current);
      ctx.playerHealthRef.current = 0;
      ctx.setPlayerHealth(0);
      ctx.sounds.playPlayerDeath();
      ctx.deathStateRef.current = {
        reason,
        respawned: false,
        minDisplayEnd: now + DEATH_MIN_DISPLAY_MS,
        fadeEndTime: Infinity,
      };
      ctx.showDeathOverlay(
        ctx.deathOverlayRef.current,
        ctx.deathReasonRef.current,
        reason
      );
      frozen = true;
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
  
  const canInteract =
    pointerActive &&
    !frozen &&
    !ctx.rebindActionRef.current &&
    !ctx.settingsOpenRef.current &&
    !ctx.controlsOpenRef.current &&
    !ctx.consoleHackOpenRef.current;
  let doorTarget = null;
  let wallWeaponShopTarget = null;
  let hackTarget = null;
  if (canInteract && ctx.vx27DoorInteractMeshesCache.length > 0) {
    ctx.hitRaycaster.setFromCamera(ctx.screenCenter, ctx.camera);
    doorTarget = pickVx27DoorUnderCrosshair(
      ctx.hitRaycaster,
      ctx.vx27DoorInteractMeshesCache
    );
  }
  const wallWeaponShops =
    ctx.wallWeaponShopsRef?.current?.length > 0
      ? ctx.wallWeaponShopsRef.current
      : ctx.rifleShopRef?.current
        ? [ctx.rifleShopRef.current]
        : [];
  for (const shop of wallWeaponShops) {
    if (!shop?.visible || !shop.group) continue;
    ctx.hitRaycaster.setFromCamera(ctx.screenCenter, ctx.camera);
    const shopHit = pickRifleShopUnderCrosshair(
      ctx.hitRaycaster,
      shop.group,
    );
    if (shopHit) {
      wallWeaponShopTarget = { ...shopHit, shop };
      break;
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
    ctx.hitRaycaster.setFromCamera(ctx.screenCenter, ctx.camera);
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
  if (
    !frozen &&
    !ctx.rebindActionRef.current &&
    !ctx.settingsOpenRef.current &&
    !ctx.controlsOpenRef.current &&
    !ctx.consoleHackOpenRef.current &&
    ctx.oilBarrelPlacementTuneEnabledRef?.current &&
    ctx.oilBarrelPickMeshesCache?.length
  ) {
    ctx.hitRaycaster.setFromCamera(ctx.screenCenter, ctx.camera);
    const propId = pickOilBarrelPropUnderCrosshair(
      ctx.hitRaycaster,
      ctx.oilBarrelPickMeshesCache
    );
    if (
      propId &&
      ctx.handleOilBarrelPlacementPickRef?.current &&
      ctx.input.consumeShoot()
    ) {
      ctx.handleOilBarrelPlacementPickRef.current(propId);
    }
  }
  if (
    ctx.oilBarrelPlacementTuneEnabledRef?.current &&
    ctx.level?.group &&
    ctx.oilBarrelPlacementRef?.current
  ) {
    updateBarrelPlacementHighlights(
      ctx.level.group,
      getBarrelPlacementHighlightIds(ctx.oilBarrelPlacementRef.current)
    );
  }
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
  updateWeaponTuningLaserPreview(ctx);
  
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
    crosshairUpdateOptions.canvasHeight = ctx.canvas.clientHeight;
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
  
  if (
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

  const pendingPrimaryWeaponTuneWeapon =
    ctx.pendingPrimaryWeaponTuneSwapRef?.current;
  if (
    pendingPrimaryWeaponTuneWeapon &&
    !ctx.weaponSwap.isBusy() &&
    ctx.activePrimaryId !== pendingPrimaryWeaponTuneWeapon
  ) {
    if (!ctx.primaryWeapons[pendingPrimaryWeaponTuneWeapon]) {
      ctx.ensurePrimaryWeaponLoaded?.(pendingPrimaryWeaponTuneWeapon);
      if (pendingPrimaryWeaponTuneWeapon === "rifle") {
        ctx.rifleUnlockedRef.current = true;
        ctx.setRifleUnlocked?.(true);
      }
    } else {
      ctx.pendingPrimaryWeaponTuneSwapRef.current = null;
      ctx.persistActiveAmmo();
      ctx.weaponSwap.requestSwap(
        pendingPrimaryWeaponTuneWeapon,
        ctx.activePrimaryId,
        ctx.primaryWeapons,
      );
    }
  } else if (pendingPrimaryWeaponTuneWeapon === ctx.activePrimaryId) {
    ctx.pendingPrimaryWeaponTuneSwapRef.current = null;
  }

  if (
    ctx.pendingRifleRoundDisplayTuneSwapRef?.current &&
    !ctx.weaponSwap.isBusy() &&
    ctx.activePrimaryId !== "rifle"
  ) {
    if (!ctx.primaryWeapons.rifle) {
      ctx.ensurePrimaryWeaponLoaded?.("rifle");
    } else {
      ctx.pendingRifleRoundDisplayTuneSwapRef.current = false;
      ctx.persistActiveAmmo();
      ctx.weaponSwap.requestSwap(
        "rifle",
        ctx.activePrimaryId,
        ctx.primaryWeapons,
      );
    }
  }

  if (
    ctx.pendingPistolRoundDisplayTuneSwapRef?.current &&
    !ctx.weaponSwap.isBusy() &&
    ctx.activePrimaryId !== "pistol"
  ) {
    if (!ctx.primaryWeapons.pistol) {
      ctx.ensurePrimaryWeaponLoaded?.("pistol");
    } else {
      ctx.pendingPistolRoundDisplayTuneSwapRef.current = false;
      ctx.persistActiveAmmo();
      ctx.weaponSwap.requestSwap(
        "pistol",
        ctx.activePrimaryId,
        ctx.primaryWeapons,
      );
    }
  }

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
    const nextId =
      slotPick ??
      (swapToggle ? getOtherPrimaryWeaponId(ctx.activePrimaryId, rifleUnlocked) : null);
    if (
      nextId &&
      nextId !== ctx.activePrimaryId &&
      (nextId !== "rifle" || rifleUnlocked) &&
      (nextId !== "pistol" || pistolOwned)
    ) {
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
  
  if (ctx.grenadeCooldownRemainingRef.current > 0) {
    ctx.grenadeCooldownRemainingRef.current = Math.max(
      0,
      ctx.grenadeCooldownRemainingRef.current - dt,
    );
  }
  ctx.updateGrenadeCooldownHud();
  ctx.tickCenterInteractPrompt(now);
  frameProfile?.mark("interact-weapon");
  
  // Grenade / flashbang: hold G to preview, release to throw
  const activeSlot = ctx.selectedWeaponSlotRef.current;
  const throwingGrenade = activeSlot === GRENADE_WEAPON_SLOT;
  const throwingFlashbang = activeSlot === FLASHBANG_WEAPON_SLOT;
  const cooldownReady = ctx.grenadeCooldownRemainingRef.current <= 0;
  const canThrowSecondary =
    cooldownReady &&
    ((throwingGrenade && ctx.grenadeCountRef.current > 0) ||
      (throwingFlashbang && ctx.flashbangCountRef.current > 0));
  const gDown = isBindingDown(ctx.input, ctx.bindingsRef.current, "grenade");
  if (
    wasBindingPressed(ctx.input, ctx.bindingsRef.current, "grenade") &&
    !frozen &&
    ctx.isThrowableSecondarySlot(activeSlot)
  ) {
    if (!cooldownReady) {
      ctx.showGrenadeCooldownHint(now);
    } else if (!canThrowSecondary) {
      const emptyMsg = ctx.secondaryWeaponEmptyMessage(activeSlot);
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
      ctx.weapon
    );
  } else if (gDown && !canThrowSecondary) {
    hideTrajectoryPreview();
  }
  if (ctx.grenadeHeld && !gDown) {
    ctx.grenadeHeld = false;
    hideTrajectoryPreview();
    if (!frozen && canThrowSecondary) {
      if (throwingGrenade) {
        ctx.grenadeCountRef.current--;
        ctx.setGrenadeCount(ctx.grenadeCountRef.current);
      } else if (throwingFlashbang) {
        ctx.flashbangCountRef.current--;
        ctx.setFlashbangCount(ctx.flashbangCountRef.current);
      }
      const g = spawnGrenade(
        ctx.scene,
        ctx.camera,
        ctx.level.floorY,
        ctx.allColliders,
        ctx.level.bounds,
        ctx.level.floorHoles ?? [],
        projectileGroundSupport,
        throwingFlashbang ? PROJECTILE_FLASHBANG : undefined,
        ctx.weapon
      );
      ctx.grenades.push(g);
      ctx.sounds.playGrenadeWhoosh({ volume: 0.8 });
      ctx.grenadeCooldownRemainingRef.current = GRENADE_THROW_COOLDOWN_SEC;
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
        const newHp = Math.max(0, ctx.playerHealthRef.current - 60);
        ctx.playerHealthRef.current = newHp;
        ctx.setPlayerHealth(newHp);
        ctx.triggerPlayerHurtFeedback(ctx.hurtVignetteFlashEndRef, ctx.sounds);
        if (newHp <= 0) ctx.grenadeSuicideRef.current = true;
      },
      countdownDuration: ctx.sounds.getGrenadeCountdownDuration(),
      onCountdown: (pos, playbackRate) => {
        ctx.sounds.playGrenadeCountdown(ctx.scene, pos, { playbackRate });
      },
      canFlashbangBlindPlayer: ctx.combat.canFlashbangBlindPlayer,
      onPlayerBlinded: () => {
        ctx.flashbangBlindStartRef.current = performance.now();
      },
      onTargetBlinded: (mesh, time) => {
        blindTargetFromFlashbang(mesh, time);
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
    if (blindElapsed >= getFlashbangBlindDurationSec()) {
      ctx.flashbangBlindStartRef.current = 0;
    }
  }
  
  // Health auto-regen: 1 HP every 10 seconds while below 100
  if (ctx.playerHealthRef.current > 0 && ctx.playerHealthRef.current < 100) {
    ctx.healthRegenTimer += dt;
    if (ctx.healthRegenTimer >= HEALTH_REGEN_INTERVAL) {
      ctx.healthRegenTimer -= HEALTH_REGEN_INTERVAL;
      const newHp = Math.min(100, ctx.playerHealthRef.current + HEALTH_REGEN_AMOUNT);
      ctx.playerHealthRef.current = newHp;
      ctx.setPlayerHealth(newHp);
    }
    ctx.radioactiveOverflowDecayTimer = 0;
  } else if (ctx.playerHealthRef.current > 100) {
    ctx.healthRegenTimer = 0;
    ctx.radioactiveOverflowDecayTimer += dt;
    if (ctx.radioactiveOverflowDecayTimer >= RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC) {
      ctx.radioactiveOverflowDecayTimer -= RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC;
      const newHp = Math.max(
        100,
        ctx.playerHealthRef.current - RADIOACTIVE_OVERFLOW_DECAY_PCT
      );
      if (newHp !== ctx.playerHealthRef.current) {
        ctx.playerHealthRef.current = newHp;
        ctx.player.syncStaminaMaxFromHp();
        ctx.setPlayerHealth(newHp);
      }
    }
  } else {
    ctx.healthRegenTimer = 0;
    ctx.radioactiveOverflowDecayTimer = 0;
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
  );
  if (ctx.showHudRef.current) {
    updateTargetHealthBars(ctx.level.targets, dt, ctx.camera);
  }
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
      ctx.playerHealthRef.current += value;
      ctx.player.syncStaminaMaxFromHp();
      ctx.pickupFlashLayerRef.current?.show("hp");
      ctx.sounds.playHpPickup();
      ctx.scheduleGameplayHudSyncRef.current();
    },
    ctx.allColliders,
    ctx.level.bounds,
    ctx.level.floorHoles ?? [],
  );
  
  updateAmmoDrops(
    ctx.ammoDrops, dt, ctx.camera.position,
    (value, drop) => {
      if (drop?.compassMarkerId) {
        hideCompassCollectibleMarker(ctx.collectibleEntries, drop.compassMarkerId);
      }
      ctx.roundsInMagRef.current += value;
      ctx.persistActiveAmmo();
      ctx.pickupFlashLayerRef.current?.show("ammo");
      ctx.sounds.playSupplyPickup();
      ctx.scheduleGameplayHudSyncRef.current();
    },
    ctx.allColliders,
    ctx.level.bounds,
    ctx.level.floorHoles ?? [],
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
        ctx.playerHealthRef.current = Math.min(
          100,
          ctx.playerHealthRef.current + (value ?? 10)
        );
        ctx.setPlayerHealth(ctx.playerHealthRef.current);
        ctx.pickupFlashLayerRef.current?.show("hp");
        ctx.sounds.playHpPickup();
      } else if (kind === "grenade") {
        ctx.grenadeCountRef.current += value ?? 1;
        ctx.setGrenadeCount(ctx.grenadeCountRef.current);
        ctx.pickupFlashLayerRef.current?.show("grenade");
        ctx.sounds.playSupplyPickup();
      } else if (kind === "flashbang") {
        ctx.flashbangCountRef.current += value ?? 1;
        ctx.setFlashbangCount(ctx.flashbangCountRef.current);
        ctx.pickupFlashLayerRef.current?.show("grenade");
        ctx.sounds.playSupplyPickup();
      } else if (kind === "score") {
        const credits = value ?? SCORE_PACK_DEFAULT_VALUE;
        ctx.playerScoreRef.current += credits;
        ctx.updateScoreHud(ctx.scoreHudRef.current, ctx.playerScoreRef.current);
        ctx.pickupFlashLayerRef.current?.show({
          type: "score",
          label: `+ ${credits} CREDITS`,
        });
        ctx.sounds.playSupplyPickup();
      } else {
        ctx.roundsInMagRef.current += value ?? 10;
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
    }
  );
  
  updateGrenadeDrops(
    ctx.grenadeDrops,
    dt,
    ctx.camera.position,
    (value) => {
      ctx.grenadeCountRef.current += value;
      ctx.pickupFlashLayerRef.current?.show("grenade");
      ctx.sounds.playSupplyPickup();
      ctx.scheduleGameplayHudSyncRef.current();
    },
    ctx.allColliders,
    ctx.level.bounds,
    ctx.level.floorHoles ?? []
  );
  frameProfile?.mark("pickups");
  
  if (!frozen) {
    ctx.missionTimeRef.current += dt;
    if (ctx.showHudRef.current) {
      const secs = Math.floor(ctx.missionTimeRef.current);
      if (secs !== Math.floor(ctx.missionTimeRef.current - dt)) {
        ctx.updateMissionTimerHud(ctx.missionTimerHudRef.current, secs);
      }
    }
  }
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
  const rainOccluders = ctx.rain?.occluders ?? cachedWeatherOccluders.rain;
  const snowOccluders = ctx.snow?.occluders ?? cachedWeatherOccluders.snow;
  
  const snowActive =
    ctx.snowEnabledRef.current && viewmodelLightingZone !== "container";
  
  updateRain(ctx.rain, ctx.camera, dt, {
    active:
      ctx.rainEnabledRef.current &&
      !ctx.snowEnabledRef.current &&
      viewmodelLightingZone !== "container",
    enclosed: inRoomBody,
    playerX: ctx.player.getX(),
    attachWall: ctx.attachWall,
    arenaHalf: ctx.arenaHalf,
    wallThickness: ctx.arena.wallThickness ?? 0.5,
    occluders: rainOccluders,
    intensity: ctx.rainIntensityRef.current,
    floorY: ctx.arena.floorY ?? 0,
  });
  
  updateSnow(ctx.snow, ctx.camera, dt, now * 0.001, {
    active: snowActive,
    enclosed: inRoomBody,
    allowSettle: snowActive && !inRoomBody,
    intensity: ctx.snowIntensityRef.current,
    stickRate: ctx.snowStickRateRef.current,
    playerX: ctx.player.getX(),
    attachWall: ctx.attachWall,
    arenaHalf: ctx.arenaHalf,
    wallThickness: ctx.arena.wallThickness ?? 0.5,
    occluders: snowOccluders,
    floorY: ctx.arena.floorY ?? 0,
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
  renderSceneWithLayeredLighting(ctx.renderer, ctx.scene, ctx.camera, {
    skyRoot: ctx.sky?.mesh ?? null,
    skipRoomPass: !inRoomPass,
  });
  if (
    !consoleInteractFocus &&
    ctx.level?.targets &&
    ctx.showHudRef.current &&
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
