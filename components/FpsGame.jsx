"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { disposeLevelGroup } from "@/lib/level/Level";
import { createLevelFromConfig } from "@/lib/level/createLevelFromConfig";
import { spawnFootYContextFromLevel } from "@/lib/physics/Collision";
import {
  getInteriorAmbientIntensity,
  getInteriorClearColor,
  isInteriorEnvironmentLevel,
  shouldAutoDayNight,
  shouldLoadSky,
  shouldUseOutdoorSun,
} from "@/lib/level/InteriorEnvironment";
import {
  collectArenaTextureIds,
  getLevelMeta,
  isArenaLoadAbortError,
  loadArenaConfig,
  levelConfigUrl,
} from "@/lib/level/loadArena";
import {
  AVAILABLE_LEVELS,
  isPlayableLevel,
  LEVEL_SELECT_OPTIONS,
  resolvePlayLevelNumber,
  saveSelectedLevel,
} from "@/lib/LevelSelectTuning";
import { loadLevelTextureLibrary, initLevelTexturesOnGpu } from "@/lib/level/LevelTextures";
import {
  createSkyDome,
  setSunOcclusionRoot,
  addRoomLights,
  ensureRoomInteriorAmbient,
  applyDayNightAtmosphere,
  applyDayNightEnvironment,
  applyDayNightEnvironmentNightness,
  computeSkyNightBlend,
  createOutdoorLights,
  DAY_CLEAR_COLOR,
  enableShadowsOn,
  disableInteriorCastShadows,
  fitDirectionalLightShadow,
  fitMoonDirectionalLightShadow,
  registerOutdoorLightsForDayNight,
  renderCrosshairPass,
  renderViewmodelPass,
  renderSceneWithLayeredLighting,
  resetLightingZoneCache,
  resetCameraRenderLayers,
  resetRoomInteriorAmbient,
  resetViewmodelInteriorAmbient,
  syncLightLayersForZone,
  syncOilBarrelFireLightLayers,
} from "@/lib/lighting/SceneEnvironment";
import {
  assignWorldLayers,
  HEALTH_BAR_LAYER,
  ROOM_INTERIOR_LAYER,
  VIEWMODEL_LAYER,
  WORLD_LAYER,
} from "@/lib/lighting/LightingLayers";
import {
  isPointInsideAnyRoom,
  isPointInsideAnyFloorExtension,
  findFloorExtensionFootprintAtZ,
  FLOOR_EXTENSION_WALK_PAD,
  isIndoorLightingZone,
} from "@/lib/rooms/RoomPlacement";
import {
  resolveViewmodelLightingZone,
  isEnclosedViewmodelZone,
} from "@/lib/lighting/LightingZones";
import {
  buildRainOccluderSlabs,
  buildSnowOccluderSlabs,
  createRainSystem,
  disposeRain,
  updateRain,
} from "@/lib/Rain.js";
import {
  loadRainEnabled,
  loadRainIntensity,
  MAX_RAIN_INTENSITY,
  MIN_RAIN_INTENSITY,
  saveRainEnabled,
  saveRainIntensity,
} from "@/lib/RainTuning.js";
import {
  createSnowSystem,
  disposeSnow,
  resetSnowSettled,
  updateSnow,
} from "@/lib/Snow.js";
import {
  loadSnowEnabled,
  loadSnowIntensity,
  loadSnowStickRate,
  MAX_SNOW_INTENSITY,
  MAX_SNOW_STICK_RATE,
  MIN_SNOW_INTENSITY,
  MIN_SNOW_STICK_RATE,
  saveSnowEnabled,
  saveSnowIntensity,
  saveSnowStickRate,
} from "@/lib/SnowTuning.js";
import { buildRoomCullables, updateRoomCulling } from "@/lib/rooms/RoomCulling";
import {
  initCandleFlicker,
  updateCandleFlicker,
} from "@/lib/lighting/CandleFlicker";
import { getArenaAttachWall } from "@/lib/rooms/DoorwayWall";
import { createInput } from "@/lib/player/Input";
import { prefersTouchControls } from "@/lib/player/TouchDetect.js";
import TouchControls from "@/components/TouchControls";
import {
  createPlayerController,
  RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC,
  RADIOACTIVE_OVERFLOW_DECAY_PCT,
} from "@/lib/player/PlayerController";
import {
  createSoundManager,
  DEFAULT_LEVEL_TRACK_ID,
  loadStoredLoadingTrackId,
} from "@/lib/audio/Sound";
import LoadingAudioViz from "@/components/LoadingAudioViz";
import PickupFlashLayer from "@/components/PickupFlashLayer";
import {
  clearGameplayHintPulse,
  createGameplayHintRuntime,
  dismissGameplayHint,
  hintMessageForId,
  pulseGameplayHint,
  tickGameplayHintDisplay,
} from "@/lib/ui/GameplayHints.js";
import { initPickupPreviewEngine } from "@/lib/pickups/PickupPreviewEngine";
import {
  getLaserPalette,
  loadViewWeapon,
  resolveAimBlendSpeed,
} from "@/lib/weapons/ViewWeapon";
import {
  createDefaultAmmoPool,
  createDefaultFireModePool,
  getOtherPrimaryWeaponId,
  getPrimaryWeaponConfig,
  PRIMARY_WEAPONS,
  resolveFireModeForWeapon,
} from "@/lib/weapons/PrimaryWeapons";
import {
  getPrimaryWeaponIdFromSlotInput,
  wasPrimarySwapPressed,
} from "@/lib/weapons/PrimaryWeaponSlots";
import {
  DEFAULT_PISTOL_ADS_POSE,
  DEFAULT_PISTOL_HIP_POSE,
  loadPistolTuning,
} from "@/lib/weapons/PistolTuning";
import { createWeaponSwapController } from "@/lib/weapons/WeaponSwap";
import {
  spawnAmmoDrop, updateAmmoDrops,
  disposeAllAmmoDrops,
  preloadAmmoCrateAssets,
  refreshLevelPickupShadows,
} from "@/lib/pickups/AmmoCrate";
import {
  preloadScorePackAssets,
  SCORE_PACK_DEFAULT_VALUE,
} from "@/lib/pickups/ScorePack.js";
import {
  preloadOilBarrelAssets,
  ensureOilBarrelInteriorTextures,
  ensureOilBarrelInteriorVideo,
  setOilBarrelTuning as applyOilBarrelMaterialTuning,
  OIL_BARREL_FIRE_PROXIMITY_DAMAGE,
  tickOilBarrelFireProximityDamage,
  tickOilBarrelInteriorVideo,
  buildOilBarrelRuntimeIndex,
  collectOilBarrelFireLights,
  ensureOilBarrelFlameMeshes,
  refreshOilBarrelRenderLayers,
} from "@/lib/oil-barrel/OilBarrel";
import {
  collectVx27ContainerRoomLights,
  preloadVx27ContainerAssets,
  resolveVx27ContainerForPlayer,
  collidersForRagdollNear,
  consumeVx27DoorColliderDirty,
  invalidateVx27ContainerColliderCache,
  refreshVx27ContainerRenderLayers,
  initVx27ContainerCeilingLightFlicker,
  setVx27ContainerCeilingLightEnabled,
  setVx27ContainerMaterialTuning,
  updateVx27ContainerDoorAnimations,
} from "@/lib/vx27-container/Vx27Container";
import {
  buildVx27ContainerCullables,
  updateVx27ContainerCulling,
} from "@/lib/vx27-container/Vx27ContainerCulling";
import {
  loadVx27ContainerCeilingLightEnabled,
  saveVx27ContainerCeilingLightEnabled,
} from "@/lib/vx27-container/Vx27ContainerCeilingLightTuning";
import {
  collectVx27DoorInteractMeshes,
  getVx27DoorInteractLabel,
  pickVx27DoorUnderCrosshair,
  toggleVx27ContainerDoorLeaf,
} from "@/lib/vx27-container/Vx27ContainerDoorInteract";
import {
  findNearestHackableControlPanel,
  getControlPanelHackLabel,
  updateControlPanelHackPrompt,
} from "@/lib/control-panel/ControlPanelHackInteract";
import ConsoleHackScreen from "@/components/ConsoleHackScreen";
import { loadConsoleHackLayout } from "@/lib/console-hack/ConsoleHackLayoutTuning.js";
import { formatHackGrantedRewards } from "@/lib/console-hack/ConsoleHackGame.js";
import {
  loadVx27ContainerMaterialTuning,
  normalizeVx27ContainerMaterialTuning,
} from "@/lib/vx27-container/Vx27ContainerMaterialTuning";
import {
  readVx27ContainerPlacement,
  syncVx27ContainerCollider,
} from "@/lib/vx27-container/Vx27ContainerTuning";
import {
  initOilBarrelFireLightFlicker,
  updateOilBarrelFireShadowBudget,
} from "@/lib/oil-barrel/OilBarrelFireLight";
import {
  loadOilBarrelTuning,
  normalizeOilBarrelTuning,
  saveOilBarrelTuning,
} from "@/lib/oil-barrel/OilBarrelTuning";
import { rebuildLevelOilBarrels } from "@/lib/level/LevelProps";
import {
  spawnLevelCollectibles,
  mountCompassCollectibleMarkers,
  ensureCompassCollectibleMarkers,
  updateCompassCollectibleMarkers,
  hideCompassCollectibleMarker,
  disposeCompassCollectibleMarkers,
  updateLevelCollectibles,
  LEVEL_COLLECTIBLE_TEST_RESPAWN,
} from "@/lib/pickups/LevelCollectibles";
import {
  updateCompassEnemyBlips,
  updateCompassRewardBlips,
} from "@/lib/CompassBlips";

import {
  spawnGrenade, updateGrenades, disposeAllGrenades,
  updateTrajectoryPreview, hideTrajectoryPreview, disposePreview,
  applyScreenShake,
  triggerScreenShake,
  triggerHurtScreenShake,
  getGrenadeParams,
  spawnGrenadeDrop, updateGrenadeDrops, disposeAllGrenadeDrops,
  preloadGrenadeAssets,
  PROJECTILE_FLASHBANG,
} from "@/lib/combat/Grenade";
import { groundSupportFromLevel } from "@/lib/physics/GroundSupport";
import {
  preloadGameGpu,
  settleGpuSpawnAfterLoad,
  resetGameGpuPreload,
  getGpuPreloadLoadLabel,
  GPU_PRELOAD_READY_LABEL,
} from "@/lib/dev/GpuPreload";
import { resetArenaCeilingDayNightCache } from "@/lib/lighting/ArenaCeilingDayNight";
import { applyCombatScore, formatKillCallout } from "@/lib/combat/Score";
import { createScorePopupLayer } from "@/lib/combat/ScorePopups";
import {
  applyTargetHit,
  activateTargetAt,
  deactivateTarget,
  disposeAllTargetHealthBars,
  disposeAllHpOrbs,
  pickRandomSpawnPosition,
  resolveAuthoredSpawnPosition,
  renderTargetHealthBarsPass,
  hasVisibleTargetHealthBars,
  setHealthBarOccluders,
  spawnHpOrb,
  startDeathAnimation,
  updateDeathAnimations,
  flushPendingRagdolls,
  prebuildRagdollTemplates,
  updateHpOrbs,
  preloadHpOrbAssets,
  updateLiveTargetsFloorHoles,
  updateTargetsRepair,
  updateTargetHealthBars,
  blindTargetFromFlashbang,
  updateFlashbangBlindVisuals,
  getFlashbangBlindDurationSec,
  FLASHBANG_BLIND_FULL_SEC,
  FLASHBANG_BLIND_FADE_SEC,
  FLASHBANG_BLIND_FULL_OPACITY,
} from "@/lib/combat/Targets";
import {
  flushKillPredictiveGpuWarm,
  resetKillPredictiveCache,
  updateKillPredictiveCache,
} from "@/lib/combat/KillPredictiveCache";
import {
  disposeAllBloodSplatters,
  spawnBloodSplatter,
  spawnBloodMarkOnTarget,
  updateBloodSplatters,
} from "@/lib/combat/BloodParticles";
import {
  applyBulletSurfaceHit,
  collectLevelHitMeshes,
  pickClosestBulletHit,
  disposeAllBulletHoles,
  preloadBulletHoleTextures,
  updateBulletHoles,
} from "@/lib/combat/BulletHoles";
import { hasLineOfSightToPoint } from "@/lib/combat/LineOfSight";
import {
  DEFAULT_ADS_POSE,
  DEFAULT_BODY_LOOK_DOWN_AMOUNT,
  DEFAULT_BODY_LOOK_UP_AMOUNT,
  DEFAULT_HIP_POSE,
  DEFAULT_MAX_LOOK_RATE,
  LOOK_MAX_RATE_KEY,
  loadLookTuning,
  loadWeaponTuning,
} from "@/lib/weapons/WeaponTuning";
import { createScreenCrosshair } from "@/lib/ui/ScreenCrosshair";
import {
  DEFAULT_CROSSHAIR_TUNING,
  loadCrosshairTuning,
} from "@/lib/weapons/CrosshairTuning";
import {
  DEFAULT_AIM_ROUND_DISPLAY,
  DEFAULT_HIP_ROUND_DISPLAY,
  loadWeaponRoundDisplayTuning,
} from "@/lib/weapons/WeaponRoundDisplayTuning";
import {
  shouldDropAmmoCrate,
  loadAmmoDropSpareThreshold,
  saveAmmoDropSpareThreshold,
  AMMO_DROP_SPARE_THRESHOLD_MAX,
  DEFAULT_AMMO_DROP_SPARE_THRESHOLD,
} from "@/lib/pickups/RewardDropSettings";
import HudCompass from "@/components/HudCompass";
import HudFireModeCarousel from "@/components/HudFireModeCarousel";
import HudPrimaryWeaponStack from "@/components/HudPrimaryWeaponStack";
import HudBottomBarTunePanel from "@/components/tuning-panels/HudBottomBarTunePanel";
import {
  getStackDepthInOrder,
  getStackFrameStyleFromDepth,
  resolveStackSelection,
} from "@/lib/ui/WeaponStackLayout";
import { SettingsSection } from "@/components/SettingsSection";
import {
  DEFAULT_HEMI_DAY,
  DEFAULT_HEMI_NIGHT,
  applyHemisphereSettings,
  loadHemiDay,
  loadHemiNight,
} from "@/lib/lighting/HemisphereTuning";
import { loadStairTuning } from "@/lib/stairs/StairTuning";
import {
  applySunLightPosition,
  loadSunAngles,
  loadSunDayMode,
  saveSunDayMode,
  sunPositionFromAngles,
} from "@/lib/lighting/SunLightTuning";
import {
  applyMoonLightPosition,
  loadMoonAngles,
  loadMoonIntensity,
  moonPositionFromAngles,
} from "@/lib/lighting/MoonLightTuning";
import { loadWalkBobTuning, resolveWalkBobTuning } from "@/lib/player/WalkBobTuning";
import { loadStairWalkTuning, normalizeStairWalkTuning } from "@/lib/stairs/StairWalkTuning";
import { loadHudBarTuning } from "@/lib/ui/HudBarTuning";
import {
  loadHudBottomBarTuneEnabled,
  loadHudBottomBarTuning,
  saveHudBottomBarTuneEnabled,
  saveHudBottomBarTuning,
} from "@/lib/ui/HudBottomBarTuning";
import ControlsPanel from "@/components/ControlsPanel";
import {
  preloadControlPanelScreenCTextures,
  resetControlPanelScreenCTextureCache,
} from "@/lib/control-panel/ControlPanelScreenC";
import {
  preloadControlPanelScreenCHackFlashTextures,
  startControlPanelScreenCHackFlash,
  updateControlPanelScreenCHackFlashes,
} from "@/lib/control-panel/ControlPanelScreenCHackFlash.js";
import {
  preloadControlPanelShelfDTextures,
  resetControlPanelShelfDTextureCache,
} from "@/lib/control-panel/ControlPanelScreenD";
import {
  preloadControlPanelBodyTextures,
  resetControlPanelBodyTextureCache,
} from "@/lib/control-panel/ControlPanelBody";
import {
  refreshControlPanelRenderLayers,
  syncControlPanelScreenMaterials,
  updateControlPanelMaterialsLive,
} from "@/lib/control-panel/ControlPanel";
import {
  applyShadowMapTypeToRenderer,
  enableRendererShadowPipeline,
  loadPlainShadowDepthEnabled,
  loadShadowMapType,
  setPlainShadowDepthRuntime,
  setShadowMapTypeRuntime,
} from "@/lib/dev/ShadowDebug";
import {
  resetAndApplyShadowCastHygiene,
} from "@/lib/lighting/ShadowMaterialHygiene";
import {
  applyFrameShadowUpdates,
  beginShadowStartupWindow,
  requestShadowMapUpdate,
} from "@/lib/lighting/ShadowUpdatePolicy";
import {
  isBindingDown,
  loadBindings,
  saveBindings,
  wasBindingPressed,
} from "@/lib/player/KeyBindings";

const WEAPON_SLOT_IDS = [1, 2, 3, 4];
const GRENADE_WEAPON_SLOT = 1;
const FLASHBANG_WEAPON_SLOT = 2;
const DEFAULT_FLASHBANG_COUNT = 4;

/** Bottom-right super-weapon stack — keys 1–4 (slots 3–4 reserved). */
const SECONDARY_WEAPON_UI = {
  [GRENADE_WEAPON_SLOT]: {
    label: "GRANADE",
    icon: "/ui/grenade.webp",
  },
  [FLASHBANG_WEAPON_SLOT]: {
    label: "FLASHBANG",
    icon: "/ui/grenade.webp",
  },
};

/** TEMP — every kill drops HP + ammo + grenade for pickup sound testing. */
const DEV_DROP_ALL_REWARDS = false;

const DEFAULT_WEAPON_STACK_TUNE = {
  1: { x: -39, y: -137, scale: 0.8 },
  2: { x: -21, y: -94, scale: 0.8 },
  3: { x: -12, y: -52, scale: 0.8 },
};

/** Super-weapon slots with stock > 0 (hides empty reserved slots). */
function getVisibleSecondarySlotIds(grenadeCount, flashbangCount) {
  return WEAPON_SLOT_IDS.filter((slotId) => {
    const ui = SECONDARY_WEAPON_UI[slotId];
    if (!ui) return false;
    if (slotId === GRENADE_WEAPON_SLOT) return grenadeCount > 0;
    if (slotId === FLASHBANG_WEAPON_SLOT) return flashbangCount > 0;
    return false;
  });
}

const INVERT_Y_KEY = "fps-invert-y";
const KEYBOARD_LOOK_KEY = "fps-keyboard-look";
const KEYBOARD_EASE_KEY = "fps-keyboard-ease";
const MOUSE_LOOK_KEY = "fps-mouse-look";
const MOUSE_EASE_KEY = "fps-mouse-ease";
const LEGACY_LOOK_SPEED_KEY = "fps-look-speed";
const LEGACY_LOOK_EASE_KEY = "fps-look-ease";
const RENDER_SCALE_KEY = "fps-render-scale";
const PLAYER_HEIGHT_KEY = "fps-player-height";
const SHOW_HUD_KEY = "fps-show-hud";
const MUSIC_ENABLED_KEY = "fps-music-enabled";
const DEFAULT_KEYBOARD_LOOK = 5;
const DEFAULT_KEYBOARD_EASE = 0;
const DEFAULT_MOUSE_LOOK = 7;
const DEFAULT_MOUSE_EASE = 1;
const DEFAULT_PLAYER_HEIGHT = 1.65;
/** Multiplier on `min(devicePixelRatio, 2)` — 1.0 = full quality, 0.5 = quarter pixel count. */
const DEFAULT_RENDER_SCALE = 0.4;
const MIN_RENDER_SCALE = 0.25;
const MAX_RENDER_SCALE = 1.0;

/** Survives React Fast Refresh so a dev reload keeps in-level state (music, overlay). */
let gameSessionStarted = false;

function loadRenderScale() {
  if (typeof window === "undefined") return DEFAULT_RENDER_SCALE;
  const raw = window.localStorage.getItem(RENDER_SCALE_KEY);
  if (!raw) return DEFAULT_RENDER_SCALE;
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) return DEFAULT_RENDER_SCALE;
  return Math.min(MAX_RENDER_SCALE, Math.max(MIN_RENDER_SCALE, v));
}

function effectivePixelRatio(scale) {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2) * scale;
}
function loadShowHud() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SHOW_HUD_KEY) !== "false";
}

function loadMusicEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUSIC_ENABLED_KEY) !== "false";
}
/** Manual day/night toggle (settings + KeyN). */
const DAY_NIGHT_SWITCHER_ENABLED = true;
/** Auto day/night flip while actively playing (demo showcase). Set false to pause. */
const DAY_NIGHT_DEMO_CYCLE_ENABLED = false;

/** Seconds for the day/night toggle to crossfade from one state to the other. */
const DAY_NIGHT_FADE_DURATION = 10;
/** Auto day/night flip while actively playing (demo showcase). */
const DAY_NIGHT_DEMO_CYCLE_SEC = 300;
/** Meters below `floorY` (feet) at which a falling player is considered dead.
 *  Matches hole-fall remove depth so the tumble finishes before the overlay. */
const DEATH_FALL_DROP = 12;
/** Minimum time the death overlay stays fully opaque before the player
 *  can click to respawn. Prevents accidentally clicking through it. */
const DEATH_MIN_DISPLAY_MS = 800;
/** Time the overlay takes to fade out AFTER the player has respawned.
 *  The player can move/shoot/look around during this window — the fade
 *  is purely a visual transition off the death screen. */
const DEATH_FADE_MS = 1200;
/** Brief pulse of the death-screen vignette (open centre) when the player takes damage. */
const HURT_VIGNETTE_FLASH_MS = 720;
const HURT_VIGNETTE_PEAK_OPACITY = 1;
/** Shrink HUD ammo digits when a stat exceeds two digits. */
function hudAmmoValueClass(value) {
  return value >= 100 ? " hudAmmoValueCompact" : "";
}
const BURST_SHOT_COUNT = 3;
const BURST_INTERVAL = 0.085;
const AUTO_FIRE_INTERVAL = 0.1;
/** Grenade drop chance when player has 0, 1, 2, 3, 4, or 5+ grenades. */
const GRENADE_DROP_CHANCE_BY_COUNT = [0.7, 0.5, 0.3, 0.25, 0.05, 0];

function rollGrenadeDrop(grenadeCount) {
  const idx = Math.min(
    Math.max(0, grenadeCount),
    GRENADE_DROP_CHANCE_BY_COUNT.length - 1
  );
  return Math.random() < GRENADE_DROP_CHANCE_BY_COUNT[idx];
}

/**
 * Show the full-screen death overlay with the given reason text. The overlay
 * is permanently mounted; we just update the reason copy and toggle classes
 * that drive the two-phase sequence (opaque hold → post-respawn fade). The
 * reflow trick (remove → reflow → re-add) lets back-to-back deaths replay
 * the animation instead of being deduped by the browser.
 */
function showDeathOverlay(overlayEl, reasonEl, reason) {
  if (reasonEl) reasonEl.textContent = reason ?? "";
  if (!overlayEl) return;
  overlayEl.classList.remove("deathOverlayFading");
  overlayEl.classList.remove("deathOverlayActive");
  // eslint-disable-next-line no-unused-expressions
  void overlayEl.offsetWidth;
  overlayEl.classList.add("deathOverlayActive");
}

/**
 * Switch the overlay from the opaque "hold" state to the fade-out state.
 * Called the moment the player respawns so the fade happens AFTER the world
 * has been restored behind the overlay.
 */
function beginDeathOverlayFade(overlayEl) {
  if (!overlayEl) return;
  overlayEl.classList.remove("deathOverlayActive");
  // eslint-disable-next-line no-unused-expressions
  void overlayEl.offsetWidth;
  overlayEl.classList.add("deathOverlayFading");
}

function hideDeathOverlay(overlayEl) {
  if (!overlayEl) return;
  overlayEl.classList.remove("deathOverlayActive");
  overlayEl.classList.remove("deathOverlayFading");
}

/** CSS overlay: 3s full blind → smooth fade out. HUD stays above (z-index 15+). */
function getFlashbangOverlayOpacity(elapsedSec) {
  const fullEnd = FLASHBANG_BLIND_FULL_SEC;
  const total = getFlashbangBlindDurationSec();
  if (elapsedSec >= total) return 0;
  if (elapsedSec < fullEnd) return FLASHBANG_BLIND_FULL_OPACITY;
  const fadeT = Math.min(1, (elapsedSec - fullEnd) / FLASHBANG_BLIND_FADE_SEC);
  const eased = fadeT * fadeT * (3 - 2 * fadeT);
  return FLASHBANG_BLIND_FULL_OPACITY * (1 - eased);
}

function updateFlashbangOverlay(el, blindStartMs) {
  if (!el) return;
  if (!blindStartMs) {
    el.style.opacity = "0";
    el.style.visibility = "hidden";
    return;
  }
  const elapsed = (performance.now() - blindStartMs) / 1000;
  const opacity = getFlashbangOverlayOpacity(elapsed);
  el.style.visibility = opacity > 0 ? "visible" : "hidden";
  el.style.opacity = String(opacity);
}

function safeRequestPointerLock(canvas, retries = 3) {
  if (touchControlsGateRef.current || !canvas) return;
  if (document.pointerLockElement === canvas) return;

  const attempt = (remaining) => {
    if (document.pointerLockElement === canvas) return;
    canvas.focus?.({ preventScroll: true });
    canvas.requestPointerLock().catch(() => {
      if (remaining > 0) {
        requestAnimationFrame(() => attempt(remaining - 1));
      }
    });
  };
  attempt(retries);
}

function safeExitPointerLock() {
  if (!document.pointerLockElement) return;
  try {
    document.exitPointerLock();
  } catch {
    // ignore — lock may already be releasing
  }
}

/** Death-screen blood art, masked so the crosshair view stays clear in the middle. */
function triggerHurtVignetteFlash(flashEndRef) {
  flashEndRef.current = performance.now() + HURT_VIGNETTE_FLASH_MS;
}

/** Vignette pulse + camera shake + pain vocal — use whenever the player takes damage. */
function triggerPlayerHurtFeedback(flashEndRef, sounds = null) {
  triggerHurtVignetteFlash(flashEndRef);
  triggerHurtScreenShake();
  sounds?.playPlayerHurt?.();
}

function updateHurtVignette(el, flashEndMs) {
  if (!el) return;
  const now = performance.now();
  if (now >= flashEndMs) {
    el.style.opacity = "0";
    el.style.visibility = "hidden";
    return;
  }
  const elapsed = HURT_VIGNETTE_FLASH_MS - (flashEndMs - now);
  const t = Math.min(1, Math.max(0, elapsed / HURT_VIGNETTE_FLASH_MS));
  let intensity;
  if (t < 0.1) intensity = t / 0.1;
  else if (t < 0.42) intensity = 1;
  else intensity = 1 - (t - 0.42) / 0.58;
  el.style.visibility = "visible";
  el.style.opacity = String(HURT_VIGNETTE_PEAK_OPACITY * intensity);
}

/** Low-health red ring — driven from the game loop, not CSS animation. */
function updateDamageVignette(el, hp, visible) {
  if (!el) return;
  if (!visible || hp <= 0 || hp > 25) {
    el.style.opacity = "0";
    el.style.visibility = "hidden";
    return;
  }
  el.style.visibility = "visible";
  const base = 0.5 + 0.5 * ((25 - hp) / 25);
  const flicker = 0.88 + Math.sin(performance.now() * 0.01) * 0.12;
  el.style.opacity = String(base * flicker);
}

function formatMissionTimer(totalSecs) {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Synced each render — skips pointer lock on touch/iPad UI. */
const touchControlsGateRef = { current: false };

/** Direct DOM update — avoids re-rendering the whole game tree every second. */
function updateMissionTimerHud(el, totalSecs) {
  if (!el) return;
  const text = formatMissionTimer(totalSecs);
  if (el.textContent !== text) el.textContent = text;
}

function updateHostileCountHud(el, count) {
  if (!el) return;
  const text = String(count).padStart(2, "0");
  if (el.textContent !== text) el.textContent = text;
}

function updateScoreHud(el, score) {
  if (!el) return;
  const text = String(score);
  if (el.textContent !== text) el.textContent = text;
}

function updateWalkPowerHud(el, stamina, staminaMax, playerHealth, visible) {
  if (!el) return;
  if (!visible || playerHealth <= 0) {
    el.style.visibility = "hidden";
    return;
  }
  el.style.visibility = "visible";

  const radioactive = playerHealth > 100;
  const overload = playerHealth > 150;
  const hpCap = radioactive ? playerHealth : 100;
  const displayVal = Math.round(Math.max(0, stamina) * 100);
  const pctOfHpCap = hpCap > 0 ? Math.min(1, displayVal / hpCap) : 0;
  let greenOp = 0;
  if (displayVal > 100 && hpCap > 100) {
    greenOp = Math.min(1, (Math.min(displayVal, hpCap) - 100) / (hpCap - 100));
  }

  const track = el.querySelector(".hudStaminaTrack");
  if (track) {
    track.classList.toggle("hudWalkPowerRadioactive", greenOp > 0.01);
    track.classList.toggle("hudWalkPowerOverload", overload && greenOp > 0.01);
    if (greenOp > 0.01) {
      if (overload) {
        track.style.setProperty(
          "--shake-speed",
          `${Math.max(0.15, 0.6 - (Math.min(playerHealth, 190) - 150) * 0.01125)}s`
        );
      } else {
        track.style.removeProperty("--shake-speed");
      }
    } else {
      track.style.removeProperty("--shake-speed");
    }
  }

  const fill = el.querySelector(".hudWalkPowerFill");
  if (fill) {
    fill.style.width = `${pctOfHpCap * 100}%`;
    let orangeOp = 0;
    let redOp = 0;
    if (displayVal <= 100) {
      if (displayVal <= 50) orangeOp = 1;
      if (displayVal <= 25) redOp = 1;
    } else if (!radioactive) {
      if (pctOfHpCap <= 0.5) orangeOp = 1;
      if (pctOfHpCap <= 0.25) redOp = 1;
    }
    fill.style.setProperty("--orange-op", orangeOp);
    fill.style.setProperty("--red-op", redOp);
  }

  const radioLayer = el.querySelector(".hudWalkPowerRadioactiveLayer");
  if (radioLayer) {
    radioLayer.style.opacity = String(greenOp);
  }

  const label = `${displayVal}%`;
  const textWhite = el.querySelector(".hudStaminaTextWhite");
  const textBlack = el.querySelector(".hudStaminaTextBlack");
  if (textWhite) textWhite.textContent = label;
  if (textBlack) {
    textBlack.textContent = label;
    textBlack.style.width = `${pctOfHpCap * 100}%`;
  }
}

const WeaponSlotStack = memo(function WeaponSlotStack({
  grenadeCount,
  flashbangCount,
  selectedWeaponSlot,
  weaponStackTune,
  frameX,
  frameY,
  layoutStyle,
}) {
  const visibleSlots = getVisibleSecondarySlotIds(grenadeCount, flashbangCount);
  const stackSelected = resolveStackSelection(selectedWeaponSlot, visibleSlots);

  if (visibleSlots.length === 0) return null;

  return (
    <div
      className="hudSecondWeapon"
      style={{
        "--grenade-frame-x": `${frameX}px`,
        "--grenade-frame-y": `${frameY}px`,
        ...layoutStyle,
      }}
    >
      <div className="hudWeaponSlots">
        {visibleSlots.map((slotId) => {
          const weaponUi = SECONDARY_WEAPON_UI[slotId];
          const isSelected = slotId === stackSelected;
          const count =
            slotId === GRENADE_WEAPON_SLOT ? grenadeCount : flashbangCount;

          return (
            <div
              key={slotId}
              className={[
                "hudSecondWeaponFrame",
                isSelected ? "hudSecondWeaponFrame--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={getStackFrameStyleFromDepth(
                getStackDepthInOrder(slotId, stackSelected, visibleSlots),
                weaponStackTune,
                visibleSlots.length,
              )}
            >
              <span className="hudSecondWeaponKey">{slotId}</span>
              <div className="hudSecondWeaponBody">
                <img
                  src={weaponUi.icon}
                  className="hudSecondWeaponIcon"
                  alt=""
                />
                <span className="hudSecondWeaponLabel">{weaponUi.label}</span>
                <span className="hudSecondWeaponCount">
                  {String(count).padStart(2, "0")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default function FpsGame() {
  const canvasRef = useRef(null);
  const screenCrosshairRef = useRef(null);
  const doorInteractPromptRef = useRef(null);
  const missionTimerHudRef = useRef(null);
  const hostileCountHudRef = useRef(null);
  const scoreHudRef = useRef(null);
  const playerScoreRef = useRef(0);
  const playerCoordsMenuRef = useRef(null);
  const showHudRef = useRef(true);
  const gameRootRef = useRef(null);
  const compassTapeRef = useRef(null);
  const compassViewportRef = useRef(null);
  const compassMarkersRef = useRef(null);
  const compassBlipsRef = useRef(null);
  const deathOverlayRef = useRef(null);
  const flashbangOverlayRef = useRef(null);
  const flashbangBlindStartRef = useRef(0);
  const damageVignetteRef = useRef(null);
  const hurtVignetteRef = useRef(null);
  const hurtVignetteFlashEndRef = useRef(0);
  const walkPowerRef = useRef(null);
  const deathReasonRef = useRef(null);
  /** Non-null while a death sequence is playing. The player stays frozen
   *  until they click to respawn. Input/physics/weapon are gated on this. */
  const deathStateRef = useRef(null);
  const grenadeSuicideRef = useRef(false);
  /** One-shot hole-fall cry — reset when no longer in a committed hole fall. */
  const holeFallCryPlayedRef = useRef(false);
  /** Callback set by the game loop to trigger a respawn from outside the
   *  effect (e.g. the overlay's onClick handler). */
  const respawnCallbackRef = useRef(null);
  const [invertYLook, setInvertYLook] = useState(false);
  const [renderScale, setRenderScale] = useState(DEFAULT_RENDER_SCALE);
  const renderScaleRef = useRef(DEFAULT_RENDER_SCALE);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const soundsRef = useRef(null);
  const [keyboardLook, setKeyboardLook] = useState(DEFAULT_KEYBOARD_LOOK);
  const [keyboardEase, setKeyboardEase] = useState(DEFAULT_KEYBOARD_EASE);
  const [mouseLook, setMouseLook] = useState(DEFAULT_MOUSE_LOOK);
  const [mouseEase, setMouseEase] = useState(DEFAULT_MOUSE_EASE);
  const [maxLookRate, setMaxLookRate] = useState(DEFAULT_MAX_LOOK_RATE);
  const [playerHeight, setPlayerHeight] = useState(DEFAULT_PLAYER_HEIGHT);
  const initialMoonAngles = loadMoonAngles();
  const [sunIsDay, setSunIsDay] = useState(() =>
    DAY_NIGHT_SWITCHER_ENABLED ? loadSunDayMode() : true
  );
  const initialStairTuning = loadStairTuning();
  const initialWalkBobTuning = loadWalkBobTuning();
  const initialStairWalkTuning = loadStairWalkTuning();
  const hudBarLayout = loadHudBarTuning();
  const [selectedLevel, setSelectedLevel] = useState(() => resolvePlayLevelNumber());
  const [levelMeta, setLevelMeta] = useState({
    number: 1,
    id: "level1",
    name: "Level 1",
    objective: "HOLD ZONE",
  });
  const [oilBarrelTuning, setOilBarrelTuning] = useState(() =>
    loadOilBarrelTuning()
  );
  const oilBarrelTuningRef = useRef(loadOilBarrelTuning());
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadAssetLabel, setLoadAssetLabel] = useState("Initializing…");
  const [assetsReady, setAssetsReady] = useState(false);
  const [loadDone, setLoadDone] = useState(() => gameSessionStarted);
  const loadDoneRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [showHud, setShowHud] = useState(() => loadShowHud());
  const [musicEnabled, setMusicEnabled] = useState(true);
  const musicEnabledRef = useRef(true);
  const [vx27ContainerCeilingLight, setVx27ContainerCeilingLight] = useState(
    () => loadVx27ContainerCeilingLightEnabled()
  );
  const vx27ContainerCeilingLightRef = useRef(
    loadVx27ContainerCeilingLightEnabled()
  );
  const [snowEnabled, setSnowEnabled] = useState(() => loadSnowEnabled());
  const snowEnabledRef = useRef(loadSnowEnabled());
  const [snowIntensity, setSnowIntensity] = useState(() => loadSnowIntensity());
  const snowIntensityRef = useRef(loadSnowIntensity());
  const [snowStickRate, setSnowStickRate] = useState(() => loadSnowStickRate());
  const snowStickRateRef = useRef(loadSnowStickRate());
  const [rainIntensity, setRainIntensity] = useState(() => loadRainIntensity());
  const rainIntensityRef = useRef(loadRainIntensity());
  const [rainEnabled, setRainEnabled] = useState(
    () => loadRainEnabled() && !loadSnowEnabled()
  );
  const rainEnabledRef = useRef(loadRainEnabled() && !loadSnowEnabled());
  const [ammoDropSpareThreshold, setAmmoDropSpareThreshold] = useState(
    DEFAULT_AMMO_DROP_SPARE_THRESHOLD
  );
  const ammoDropSpareThresholdRef = useRef(DEFAULT_AMMO_DROP_SPARE_THRESHOLD);
  const loadingMusicTrackIdRef = useRef(loadStoredLoadingTrackId());
  const levelMusicTrackIdRef = useRef(DEFAULT_LEVEL_TRACK_ID);
  const [hudBottomBarTuning, setHudBottomBarTuning] = useState(() =>
    loadHudBottomBarTuning(),
  );
  const [hudBottomBarTuneEnabled, setHudBottomBarTuneEnabled] = useState(() =>
    loadHudBottomBarTuneEnabled(),
  );
  const hbCorner = 3;
  const sceneRef = useRef(null);
  const snowRef = useRef(null);
  const [bindings, setBindings] = useState(() => loadBindings());
  const gameplayHintsDismissedRef = useRef(new Set());
  const gameplayHintRef = useRef(null);
  const gameplayHintRuntimeRef = useRef(createGameplayHintRuntime());
  const flashlightOnRef = useRef(false);
  const inputRef = useRef(null);
  const [touchControlsActive, setTouchControlsActive] = useState(false);
  const [touchShowInteract, setTouchShowInteract] = useState(false);
  const touchShowInteractRef = useRef(false);
  const [touchShowHack, setTouchShowHack] = useState(false);
  const touchShowHackRef = useRef(false);
  const [consoleHackOpen, setConsoleHackOpen] = useState(false);
  const [consoleHackPanelId, setConsoleHackPanelId] = useState(null);
  const [consoleHackPanelLabel, setConsoleHackPanelLabel] = useState(null);
  const consoleHackOpenRef = useRef(false);
  const consoleHackPanelRef = useRef(null);
  const consoleHackPromptRef = useRef(null);
  const consoleHackLayoutRef = useRef(loadConsoleHackLayout());
  const [consoleHackLayout, setConsoleHackLayout] = useState(() => loadConsoleHackLayout());
  const handleConsoleHackComplete = useCallback((rewards) => {
    playerScoreRef.current += rewards.credits ?? 0;
    updateScoreHud(scoreHudRef.current, playerScoreRef.current);

    const pistolSpare = Math.ceil((rewards.pistolAmmo ?? 0) / 12);
    if (pistolSpare > 0) {
      ammoPoolSnapshotRef.current.pistol.spare += pistolSpare;
    }

    let playedHpPickup = false;
    if (rewards.medkit) {
      playerHealthRef.current = Math.min(100, playerHealthRef.current + 40 * rewards.medkit);
      soundsRef.current?.playHpPickup?.();
      playedHpPickup = true;
    }

    for (const item of formatHackGrantedRewards(rewards)) {
      pickupFlashLayerRef.current?.show(item.pickup);
    }
    if (!playedHpPickup && (rewards.pistolAmmo || rewards.credits)) {
      soundsRef.current?.playSupplyPickup?.();
    }

    if (consoleHackPanelRef.current) {
      startControlPanelScreenCHackFlash(consoleHackPanelRef.current, "success");
    }

    scheduleGameplayHudSyncRef.current?.();
  }, []);

  const handleConsoleHackFailed = useCallback(() => {
    if (consoleHackPanelRef.current) {
      startControlPanelScreenCHackFlash(consoleHackPanelRef.current, "failed");
    }
  }, []);

  const closeConsoleHackRef = useRef(() => {});
  const openConsoleHackRef = useRef(() => {});
  const resumeLevelMusicAfterHack = useCallback(() => {
    if (!musicEnabledRef.current || !loadDoneRef.current) return;
    soundsRef.current?.startLevelMusic({
      trackId: levelMusicTrackIdRef.current,
    });
  }, []);

  const openConsoleHack = useCallback((target) => {
    const canvas = canvasRef.current;
    inputRef.current?.discardLookDelta?.();
    inputRef.current?.clearHeldState?.();
    consoleHackPanelRef.current = target.group;
    setConsoleHackPanelId(target.group.userData.controlPanelPropId ?? null);
    setConsoleHackPanelLabel(getControlPanelHackLabel(target.group));
    const hackLayout = loadConsoleHackLayout();
    consoleHackLayoutRef.current = hackLayout;
    setConsoleHackLayout(hackLayout);
    setConsoleHackOpen(true);
    updateControlPanelHackPrompt(consoleHackPromptRef.current, bindingsRef.current, false);
    if (musicEnabledRef.current) {
      soundsRef.current?.startHackMusic?.();
    }
    safeRequestPointerLock(canvas);
  }, []);

  const closeConsoleHack = useCallback(() => {
    const canvas = canvasRef.current;
    inputRef.current?.discardLookDelta?.();
    inputRef.current?.clearHeldState?.();
    soundsRef.current?.stopHackMusic?.();
    resumeLevelMusicAfterHack();
    consoleHackPanelRef.current = null;
    setConsoleHackPanelId(null);
    setConsoleHackPanelLabel(null);
    setConsoleHackOpen(false);
    safeRequestPointerLock(canvas);
    requestAnimationFrame(() => safeRequestPointerLock(canvas));
  }, [resumeLevelMusicAfterHack]);

  const handleConsoleHackDismissed = useCallback(
    (timerRemainingMs) => {
      const panel = consoleHackPanelRef.current;
      if (panel && timerRemainingMs > 0) {
        startControlPanelScreenCHackFlash(panel, "failed", {
          holdMs: timerRemainingMs,
        });
      }
      closeConsoleHack();
    },
    [closeConsoleHack]
  );

  const consoleHackSounds = useMemo(
    () => ({
      playSupplyPickup: () => soundsRef.current?.playSupplyPickup?.(),
      playHackDeath: () => soundsRef.current?.playHackDeath?.(),
      playHackConnect: () => soundsRef.current?.playHackConnect?.(),
    }),
    []
  );
  const [rebindAction, setRebindAction] = useState(null);
  const bindingsRef = useRef(loadBindings());
  const settingsOpenRef = useRef(false);
  const controlsOpenRef = useRef(false);
  const invertYRef = useRef(false);
  const keyboardLookRef = useRef(DEFAULT_KEYBOARD_LOOK);
  const keyboardEaseRef = useRef(DEFAULT_KEYBOARD_EASE);
  const mouseLookRef = useRef(DEFAULT_MOUSE_LOOK);
  const mouseEaseRef = useRef(DEFAULT_MOUSE_EASE);
  const maxLookRateRef = useRef(DEFAULT_MAX_LOOK_RATE);
  const playerHeightRef = useRef(DEFAULT_PLAYER_HEIGHT);
  const storedSunAngles = loadSunAngles();
  const sunAnglesRef = useRef(storedSunAngles);
  const sunLightPosRef = useRef(
    sunPositionFromAngles(storedSunAngles.azimuth, storedSunAngles.elevation)
  );
  const moonAnglesRef = useRef(initialMoonAngles);
  const moonIntensityRef = useRef(loadMoonIntensity());
  const moonLightPosRef = useRef(
    moonPositionFromAngles(initialMoonAngles.azimuth, initialMoonAngles.elevation)
  );
  const refitSunShadowRef = useRef(null);
  const refitMoonShadowRef = useRef(null);
  const rebuildOilBarrelsRef = useRef(null);
  const levelRef = useRef(null);
  const vx27ContainersRef = useRef([]);
  const vx27ContainerCullablesRef = useRef([]);
  const controlPanelsRef = useRef([]);
  const syncControlPanelCollidersRef = useRef(null);
  const playerPlacementRef = useRef({ x: 0, z: 0, y: 0 });
  const arenaLiveRef = useRef(null);
  const onOilBarrelTuningChange = useCallback((key, value) => {
    setOilBarrelTuning((prev) => {
      const next = normalizeOilBarrelTuning({ ...prev, [key]: value });
      saveOilBarrelTuning(next);
      oilBarrelTuningRef.current = next;
      applyOilBarrelMaterialTuning(next, sceneRef.current ?? undefined);
      if (key === "topCap") {
        if (value === false) {
          ensureOilBarrelInteriorTextures().then(() => {
            rebuildOilBarrelsRef.current?.();
          });
        } else {
          rebuildOilBarrelsRef.current?.();
        }
      } else if (key === "interiorFire" && value === true) {
        ensureOilBarrelInteriorTextures()
          .then(() => ensureOilBarrelInteriorVideo())
          .then(() => rebuildOilBarrelsRef.current?.());
      }
      return next;
    });
  }, []);

  const stairParamsRef = useRef(initialStairTuning);
  const walkBobTuningRef = useRef(initialWalkBobTuning);
  const stairWalkTuningRef = useRef(initialStairWalkTuning);
  const sunRef = useRef(null);
  const moonRef = useRef(null);
  const sunBaseIntensityRef = useRef(2.85);
  const sunIsDayRef = useRef(
    DAY_NIGHT_SWITCHER_ENABLED ? loadSunDayMode() : true
  );
  const applyDayNightRef = useRef(null);
  // Continuous 0 (full day) → 1 (full night) value driving the day/night fade.
  // `target` is set instantly by the toggle; `cur` is slewed toward it in the
  // animate loop so every light/atmosphere/hemi setting eases together.
  const dayNightTargetNightnessRef = useRef(
    DAY_NIGHT_SWITCHER_ENABLED && !loadSunDayMode() ? 1 : 0
  );
  const dayNightCurNightnessRef = useRef(
    DAY_NIGHT_SWITCHER_ENABLED && !loadSunDayMode() ? 1 : 0
  );
  const dayNightDemoCycleElapsedRef = useRef(0);
  const skyRef = useRef(null);
  const weaponRef = useRef(null);
  const hemiRef = useRef(null);
  const roomLightsRef = useRef([]);
  const oilBarrelFireLightsRef = useRef([]);
  const roomCullablesRef = useRef([]);
  const dayNightToggleRef = useRef(null);
  const hemiDayRef = useRef(loadHemiDay());
  const hemiNightRef = useRef(loadHemiNight());
  const [fireMode, setFireMode] = useState("auto");
  const [activePrimaryWeapon, setActivePrimaryWeapon] = useState("rifle");
  const [activeMagazineSize, setActiveMagazineSize] = useState(
    PRIMARY_WEAPONS.rifle.magazineSize,
  );
  const [activeLowAmmoThreshold, setActiveLowAmmoThreshold] = useState(
    PRIMARY_WEAPONS.rifle.lowAmmoThreshold,
  );
  const [roundsInMag, setRoundsInMag] = useState(
    PRIMARY_WEAPONS.rifle.magazineSize,
  );
  const [spareMags, setSpareMags] = useState(
    PRIMARY_WEAPONS.rifle.spareMagazines,
  );
  const [playerHealth, setPlayerHealth] = useState(100);
  const pickupFlashLayerRef = useRef(null);
  const hudSyncPendingRef = useRef(false);
  const scheduleGameplayHudSyncRef = useRef(() => {});
  const [grenadeCount, setGrenadeCount] = useState(
    () => getGrenadeParams().grenadeCount
  );
  const grenadeCountRef = useRef(getGrenadeParams().grenadeCount);
  const [flashbangCount, setFlashbangCount] = useState(DEFAULT_FLASHBANG_COUNT);
  const flashbangCountRef = useRef(DEFAULT_FLASHBANG_COUNT);
  const [grenFrameWidthRem, setGrenFrameWidthRem] = useState(12.3);
  const [grenFrameScale, setGrenFrameScale] = useState(1);
  const [grenFrameX, setGrenFrameX] = useState(17);
  const [grenFrameY, setGrenFrameY] = useState(15);
  const [grenHudKeyX, setGrenHudKeyX] = useState(2);
  const [grenHudKeyY, setGrenHudKeyY] = useState(0);
  const [grenHudKeyScale, setGrenHudKeyScale] = useState(1.49);
  const [grenHudIconX, setGrenHudIconX] = useState(11);
  const [grenHudIconY, setGrenHudIconY] = useState(1);
  const [grenHudIconScale, setGrenHudIconScale] = useState(0.91);
  const [grenHudLabelX, setGrenHudLabelX] = useState(-13);
  const [grenHudLabelY, setGrenHudLabelY] = useState(10);
  const [grenHudLabelScale, setGrenHudLabelScale] = useState(1);
  const [grenHudCountX, setGrenHudCountX] = useState(-10);
  const [grenHudCountY, setGrenHudCountY] = useState(-6);
  const [grenHudCountScale, setGrenHudCountScale] = useState(1.15);
  const weaponStackTune = {
    1: { ...DEFAULT_WEAPON_STACK_TUNE[1] },
    2: { ...DEFAULT_WEAPON_STACK_TUNE[2] },
    3: { ...DEFAULT_WEAPON_STACK_TUNE[3] },
  };
  const [selectedWeaponSlot, setSelectedWeaponSlot] = useState(GRENADE_WEAPON_SLOT);
  const selectedWeaponSlotRef = useRef(GRENADE_WEAPON_SLOT);
  const [primaryAmmo, setPrimaryAmmo] = useState(() => createDefaultAmmoPool());
  const ammoPoolSnapshotRef = useRef(createDefaultAmmoPool());
  selectedWeaponSlotRef.current = selectedWeaponSlot;
  const [playerLives, setPlayerLives] = useState(3);
  const missionTimeRef = useRef(0);
  const hostileCountRef = useRef(0);
  const playerHealthRef = useRef(100);
  const playerLivesRef = useRef(3);
  const fireModeRef = useRef("auto");
  const fireModeByWeaponRef = useRef(createDefaultFireModePool());
  const cycleFireModeHud = useCallback(() => {
    const modes = PRIMARY_WEAPONS[activePrimaryWeapon].fireModes;
    if (modes.length <= 1) return;
    const i = modes.indexOf(fireModeRef.current);
    const next = modes[(i + 1) % modes.length];
    const resolved = resolveFireModeForWeapon(activePrimaryWeapon, next);
    fireModeByWeaponRef.current[activePrimaryWeapon] = resolved;
    fireModeRef.current = resolved;
    setFireMode(resolved);
  }, [activePrimaryWeapon]);
  const activePrimaryIdRef = useRef("rifle");
  const roundsInMagRef = useRef(PRIMARY_WEAPONS.rifle.magazineSize);
  const spareMagsRef = useRef(PRIMARY_WEAPONS.rifle.spareMagazines);
  const setAmmoStateRef = useRef(null);
  const [hipWeaponPose, setHipWeaponPose] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_HIP_POSE;
    return loadWeaponTuning().hip;
  });
  const [adsWeaponPose, setAdsWeaponPose] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_ADS_POSE;
    return loadWeaponTuning().ads;
  });
  const [bodyLookUpAmount, setBodyLookUpAmount] = useState(
    DEFAULT_BODY_LOOK_UP_AMOUNT
  );
  const [bodyLookDownAmount, setBodyLookDownAmount] = useState(
    DEFAULT_BODY_LOOK_DOWN_AMOUNT
  );
  const weaponTuningRef = useRef({
    hip: DEFAULT_HIP_POSE,
    ads: DEFAULT_ADS_POSE,
    bodyLookUpAmount: DEFAULT_BODY_LOOK_UP_AMOUNT,
    bodyLookDownAmount: DEFAULT_BODY_LOOK_DOWN_AMOUNT,
  });
  const [pistolHipPose, setPistolHipPose] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_PISTOL_HIP_POSE;
    return loadPistolTuning().hip;
  });
  const [pistolAdsPose, setPistolAdsPose] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_PISTOL_ADS_POSE;
    return loadPistolTuning().ads;
  });
  const pistolTuningRef = useRef({
    hip: DEFAULT_PISTOL_HIP_POSE,
    ads: DEFAULT_PISTOL_ADS_POSE,
    bodyLookUpAmount: DEFAULT_BODY_LOOK_UP_AMOUNT,
    bodyLookDownAmount: DEFAULT_BODY_LOOK_DOWN_AMOUNT,
  });
  const [crosshairTuning, setCrosshairTuning] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_CROSSHAIR_TUNING;
    return loadCrosshairTuning();
  });
  const crosshairTuningRef = useRef(
    typeof window === "undefined"
      ? DEFAULT_CROSSHAIR_TUNING
      : loadCrosshairTuning(),
  );
  const [roundDisplayHip, setRoundDisplayHip] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_HIP_ROUND_DISPLAY;
    return loadWeaponRoundDisplayTuning().hip;
  });
  const [roundDisplayAim, setRoundDisplayAim] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_AIM_ROUND_DISPLAY;
    return loadWeaponRoundDisplayTuning().aim;
  });
  const roundDisplayTuningRef = useRef(
    typeof window === "undefined"
      ? { hip: DEFAULT_HIP_ROUND_DISPLAY, aim: DEFAULT_AIM_ROUND_DISPLAY }
      : loadWeaponRoundDisplayTuning()
  );
  const rebindActionRef = useRef(null);

  useEffect(() => {
    const tuning = loadWeaponTuning();
    setHipWeaponPose(tuning.hip);
    setAdsWeaponPose(tuning.ads);
    const look = loadLookTuning();
    setBodyLookUpAmount(look.bodyLookUpAmount);
    setBodyLookDownAmount(look.bodyLookDownAmount);
    setMaxLookRate(look.maxLookRate);
    maxLookRateRef.current = look.maxLookRate;
    weaponTuningRef.current = {
      hip: tuning.hip,
      ads: tuning.ads,
      bodyLookUpAmount: look.bodyLookUpAmount,
      bodyLookDownAmount: look.bodyLookDownAmount,
    };

    const roundTuning = loadWeaponRoundDisplayTuning();
    roundDisplayTuningRef.current = roundTuning;
    setRoundDisplayHip(roundTuning.hip);
    setRoundDisplayAim(roundTuning.aim);

    const crosshair = loadCrosshairTuning();
    crosshairTuningRef.current = crosshair;
    setCrosshairTuning(crosshair);

    const pistolTuning = loadPistolTuning();
    setPistolHipPose(pistolTuning.hip);
    setPistolAdsPose(pistolTuning.ads);
    pistolTuningRef.current = {
      hip: pistolTuning.hip,
      ads: pistolTuning.ads,
      bodyLookUpAmount: look.bodyLookUpAmount,
      bodyLookDownAmount: look.bodyLookDownAmount,
    };
  }, []);
  weaponTuningRef.current = {
    hip: hipWeaponPose,
    ads: adsWeaponPose,
    bodyLookUpAmount,
    bodyLookDownAmount,
  };
  pistolTuningRef.current = {
    hip: pistolHipPose,
    ads: pistolAdsPose,
    bodyLookUpAmount,
    bodyLookDownAmount,
  };
  roundDisplayTuningRef.current = {
    hip: roundDisplayHip,
    aim: roundDisplayAim,
  };
  crosshairTuningRef.current = crosshairTuning;
  bindingsRef.current = bindings;
  rebindActionRef.current = rebindAction;
  fireModeRef.current = fireMode;
  loadDoneRef.current = loadDone;
  if (loadDone) gameSessionStarted = true;
  musicEnabledRef.current = musicEnabled;
  ammoDropSpareThresholdRef.current = ammoDropSpareThreshold;
  showHudRef.current = showHud;
  oilBarrelTuningRef.current = oilBarrelTuning;

  scheduleGameplayHudSyncRef.current = () => {
    if (hudSyncPendingRef.current) return;
    hudSyncPendingRef.current = true;
    requestAnimationFrame(() => {
      hudSyncPendingRef.current = false;
      setPlayerHealth(playerHealthRef.current);
      setGrenadeCount(grenadeCountRef.current);
      setRoundsInMag(roundsInMagRef.current);
      setSpareMags(spareMagsRef.current);
      setPrimaryAmmo({
        rifle: { ...ammoPoolSnapshotRef.current.rifle },
        pistol: { ...ammoPoolSnapshotRef.current.pistol },
      });
    });
  };

  setAmmoStateRef.current = (rounds, spare) => {
    roundsInMagRef.current = rounds;
    spareMagsRef.current = spare;
    setRoundsInMag(rounds);
    setSpareMags(spare);
  };

  useEffect(() => {
    const s = soundsRef.current;
    if (!s || !loadDone || !assetsReady) return;
    s.stopLoadingMusic();
    if (musicEnabledRef.current) {
      s.startLevelMusic({ trackId: levelMusicTrackIdRef.current });
    }
  }, [loadDone, assetsReady]);

  useEffect(() => {
    if (!rebindAction) return;
    const onKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        setRebindAction(null);
        return;
      }
      if (e.code.startsWith("Mouse") || e.code === "Tab") return;
      setBindings((prev) => {
        const next = { ...prev, [rebindAction]: e.code };
        saveBindings(next);
        bindingsRef.current = next;
        return next;
      });
      setRebindAction(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [rebindAction]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.repeat || rebindActionRef.current) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "KeyI") {
        const next = !showHudRef.current;
        showHudRef.current = next;
        localStorage.setItem(SHOW_HUD_KEY, String(next));
        gameRootRef.current?.classList.toggle("gameHudHidden", !next);
        if (settingsOpenRef.current) {
          setShowHud(next);
        }
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const storedInvert = localStorage.getItem(INVERT_Y_KEY) === "true";
    const legacySpeed = parseFloat(localStorage.getItem(LEGACY_LOOK_SPEED_KEY));
    const legacyEase = parseFloat(localStorage.getItem(LEGACY_LOOK_EASE_KEY));
    const read = (key, fallback) => {
      const v = parseFloat(localStorage.getItem(key));
      return Number.isNaN(v) ? fallback : v;
    };
    const speedFallback = Number.isNaN(legacySpeed)
      ? DEFAULT_KEYBOARD_LOOK
      : legacySpeed;
    const easeFallback = Number.isNaN(legacyEase)
      ? DEFAULT_KEYBOARD_EASE
      : legacyEase;
    const mouseEaseFallback = Number.isNaN(legacyEase)
      ? DEFAULT_MOUSE_EASE
      : legacyEase;
    const kbLook = read(KEYBOARD_LOOK_KEY, speedFallback);
    const kbEase = read(KEYBOARD_EASE_KEY, easeFallback);
    const mLook = read(MOUSE_LOOK_KEY, DEFAULT_MOUSE_LOOK);
    const mEase = read(MOUSE_EASE_KEY, mouseEaseFallback);
    const look = loadLookTuning();
    const maxRate = look.maxLookRate;

    setInvertYLook(storedInvert);
    const storedScale = loadRenderScale();
    setRenderScale(storedScale);
    renderScaleRef.current = storedScale;
    setShowHud(loadShowHud());
    const storedMusicEnabled = loadMusicEnabled();
    const storedLoadingTrack = loadStoredLoadingTrackId();
    setMusicEnabled(storedMusicEnabled);
    musicEnabledRef.current = storedMusicEnabled;
    const storedAmmoDropThreshold = loadAmmoDropSpareThreshold();
    setAmmoDropSpareThreshold(storedAmmoDropThreshold);
    ammoDropSpareThresholdRef.current = storedAmmoDropThreshold;
    loadingMusicTrackIdRef.current = storedLoadingTrack;
    const barrelTuning = loadOilBarrelTuning();
    setOilBarrelTuning(barrelTuning);
    oilBarrelTuningRef.current = barrelTuning;
    applyOilBarrelMaterialTuning(barrelTuning, sceneRef.current ?? undefined);
    setKeyboardLook(kbLook);
    setKeyboardEase(kbEase);
    setMouseLook(mLook);
    setMouseEase(mEase);
    setMaxLookRate(maxRate);
    const storedHeight = read(PLAYER_HEIGHT_KEY, DEFAULT_PLAYER_HEIGHT);
    setPlayerHeight(storedHeight);
    playerHeightRef.current = storedHeight;
    invertYRef.current = storedInvert;
    keyboardLookRef.current = kbLook;
    keyboardEaseRef.current = kbEase;
    mouseLookRef.current = mLook;
    mouseEaseRef.current = mEase;
    maxLookRateRef.current = maxRate;
  }, []);

  invertYRef.current = invertYLook;
  renderScaleRef.current = renderScale;
  keyboardLookRef.current = keyboardLook;
  keyboardEaseRef.current = keyboardEase;
  mouseLookRef.current = mouseLook;
  mouseEaseRef.current = mouseEase;
  maxLookRateRef.current = maxLookRate;
  playerHeightRef.current = playerHeight;
  sunIsDayRef.current = sunIsDay;
  rainEnabledRef.current = rainEnabled;
  rainIntensityRef.current = rainIntensity;
  snowEnabledRef.current = snowEnabled;
  snowIntensityRef.current = snowIntensity;
  snowStickRateRef.current = snowStickRate;
  settingsOpenRef.current = settingsOpen;
  controlsOpenRef.current = controlsOpen;
  consoleHackOpenRef.current = consoleHackOpen;
  closeConsoleHackRef.current = closeConsoleHack;
  openConsoleHackRef.current = openConsoleHack;
  touchControlsGateRef.current = touchControlsActive;

  useEffect(() => {
    setTouchControlsActive(prefersTouchControls());
  }, []);

  useEffect(() => {
    inputRef.current?.setTouchMode(touchControlsActive);
  }, [touchControlsActive]);

  const refreshGameplayHintHudRef = useRef(() => {});
  const refreshGameplayHintHud = () => {
    tickGameplayHintDisplay(
      gameplayHintRef.current ?? document.getElementById("gameplayHint"),
      gameplayHintRuntimeRef.current,
      {
        now: performance.now(),
        loadDone: loadDoneRef.current,
        showHud: showHudRef.current,
        settingsOpen: settingsOpenRef.current,
        controlsOpen: controlsOpenRef.current,
        isDay: sunIsDayRef.current,
        flashlightOn: flashlightOnRef.current,
        bindings: bindingsRef.current,
        dismissed: gameplayHintsDismissedRef.current,
        dayNightEnabled: DAY_NIGHT_SWITCHER_ENABLED,
      },
    );
  };
  refreshGameplayHintHudRef.current = refreshGameplayHintHud;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resetGameGpuPreload();

    let sky = null;
    let scene = null;
    let levelTextures = null;
    let disposed = false;
    let rafId = 0;
    let level = null;
    let player = null;
    let input = null;
    let weapon = null;
    const primaryWeapons = { rifle: null, pistol: null };
    let activePrimaryId = "rifle";
    const ammoPool = createDefaultAmmoPool();
    const weaponSwap = createWeaponSwapController();
    let weaponLoadId = 0;
    let flashTimeout = null;
    let hpOrbs = [];
    let ammoDrops = [];
    let collectibleEntries = [];
    let grenades = [];
    let grenadeDrops = [];
    let bloodSplatters = [];
    let rain = null;
    let snow = null;
    /** Kill-shot blood — waits for ragdoll, then spawns next frame. */
    let pendingKillBlood = [];
    let bloodAfterRagdoll = [];
    let gameReady = false;
    let healthRegenTimer = 0;
    let radioactiveOverflowDecayTimer = 0;
    const HEALTH_REGEN_INTERVAL = 10;
    const HEALTH_REGEN_AMOUNT = 1;
    let scorePopupLayer = null;
    let scorePopupContainer = null;
    let onCanvasClick = null;
    let onPointerLockChange = null;
    let onKeyDown = null;
    let onResize = null;
    const arenaAbort = new AbortController();
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      // Log depth breaks directional shadow maps in many Three.js builds.
      logarithmicDepthBuffer: false,
    });
    rendererRef.current = renderer;

    async function init() {
      const isActive = () => !disposed;
      renderer.setPixelRatio(effectivePixelRatio(renderScaleRef.current));
      renderer.setSize(window.innerWidth, window.innerHeight);
      enableRendererShadowPipeline(renderer);
      setShadowMapTypeRuntime(loadShadowMapType());
      setPlainShadowDepthRuntime(loadPlainShadowDepthEnabled());
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(DAY_CLEAR_COLOR, 1);

      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(DAY_CLEAR_COLOR, 45, 95);
      sceneRef.current = scene;

      const HIP_FOV = 75;
      const ADS_FOV = 52;
      const camera = new THREE.PerspectiveCamera(
        HIP_FOV,
        window.innerWidth / window.innerHeight,
        0.1,
        200
      );
      camera.layers.enable(WORLD_LAYER);
      camera.layers.enable(ROOM_INTERIOR_LAYER);
      camera.layers.enable(VIEWMODEL_LAYER);
      camera.layers.enable(HEALTH_BAR_LAYER);
      cameraRef.current = camera;
      screenCrosshairRef.current = createScreenCrosshair(scene);
      const sounds = createSoundManager(camera);
      soundsRef.current = sounds;
      const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

      const reportLoad = (progress, label) => {
        setLoadProgress(progress);
        setLoadAssetLabel(label);
      };

      reportLoad(5, "Renderer & scene");
      reportLoad(8, "Loading music");
      await sounds.preloadMusic();
      if (!isActive()) return;
      reportLoad(14, "Music ready");
      if (musicEnabledRef.current) {
        sounds.resume();
        if (loadDoneRef.current) {
          sounds.stopLoadingMusic();
          sounds.startLevelMusic({ trackId: levelMusicTrackIdRef.current });
        } else {
          sounds.startLoadingMusic({ trackId: loadingMusicTrackIdRef.current });
        }
      }

      const sfxPromise = sounds.preloadSfx();

      reportLoad(18, "Arena config");
      const arena = await loadArenaConfig(levelConfigUrl(selectedLevel), {
        signal: arenaAbort.signal,
      });
      if (!isActive()) return;
      setLevelMeta(getLevelMeta(arena));
      reportLoad(20, "Arena config");

      reportLoad(22, "Level textures");
      levelTextures = await loadLevelTextureLibrary(
        maxAnisotropy,
        collectArenaTextureIds(arena)
      );
      if (!isActive()) return;
      initLevelTexturesOnGpu(renderer, levelTextures);
      reportLoad(45, "Level textures");

      reportLoad(48, "Grenade pickup model");
      await preloadGrenadeAssets(maxAnisotropy);
      if (!isActive()) return;
      reportLoad(52, "Ammo crate textures");
      await preloadAmmoCrateAssets();
      if (!isActive()) return;
      reportLoad(53, "Score pack texture");
      await preloadScorePackAssets();
      if (!isActive()) return;
      reportLoad(54, "Oil barrel assets");
      await preloadOilBarrelAssets(arena);
      if (!isActive()) return;
      await preloadVx27ContainerAssets(arena);
      if (!isActive()) return;
      resetControlPanelScreenCTextureCache();
      resetControlPanelShelfDTextureCache();
      resetControlPanelBodyTextureCache();
      await Promise.all([
        preloadControlPanelScreenCTextures(),
        preloadControlPanelScreenCHackFlashTextures(),
        preloadControlPanelShelfDTextures(),
        preloadControlPanelBodyTextures(),
      ]);
      if (!isActive()) return;
      reportLoad(55, "HP orb textures");
      await preloadHpOrbAssets();
      if (!isActive()) return;
      reportLoad(58, "Pickup assets");
      initPickupPreviewEngine();
      if (!isActive()) return;
      reportLoad(59, "Pickup preview ready");

      reportLoad(60, "Building level");
      const interiorLevel = isInteriorEnvironmentLevel(arena);
      const sheltered =
        interiorLevel || (arena.ceilingThickness ?? 0) > 0;
      const { sun, moon, hemi, outdoorLights } = createOutdoorLights(scene, {
        sheltered,
      });
      if (interiorLevel && !shouldUseOutdoorSun(arena)) {
        sun.intensity = 0;
        sun.castShadow = false;
        moon.intensity = 0;
        moon.castShadow = false;
        hemi.intensity = getInteriorAmbientIntensity(arena);
        for (const light of outdoorLights) {
          light.intensity = 0;
        }
        scene.background = new THREE.Color(getInteriorClearColor(arena));
        renderer.setClearColor(getInteriorClearColor(arena), 1);
      }
      hemiRef.current = hemi;
      registerOutdoorLightsForDayNight(outdoorLights);
      const attachWall = getArenaAttachWall(arena);
      const arenaHalf = arena.size ? arena.size / 2 : 14;
      const roomLights = addRoomLights(
        scene,
        arena.rooms,
        arenaHalf,
        attachWall,
        arena.floorExtensions ?? []
      );
      // Give the warm interior point lights a candle-like flicker so the
      // off-arena room feels alive instead of locked to a flat brightness.
      initCandleFlicker(roomLights);
      roomLightsRef.current = roomLights;
      ensureRoomInteriorAmbient(scene);
      syncLightLayersForZone(scene, interiorLevel, outdoorLights, roomLights);
      const stairParams = loadStairTuning(arena.stairs, arena);
      stairParamsRef.current = stairParams;
      const arenaLive = { ...arena, stairs: stairParams };
      arenaLiveRef.current = arenaLive;
      level = createLevelFromConfig(scene, arenaLive, levelTextures);
      levelRef.current = level;
      if (level.interiorLights?.length) {
        roomLights.push(...level.interiorLights);
      }
      const vx27ContainerLights = collectVx27ContainerRoomLights(
        level.vx27ContainerMeshes
      );
      if (vx27ContainerLights.length) {
        roomLights.push(...vx27ContainerLights);
      }
      if (level.interiorLights?.length || vx27ContainerLights.length) {
        roomLightsRef.current = roomLights;
        resetLightingZoneCache();
        syncLightLayersForZone(scene, interiorLevel, outdoorLights, roomLights);
      }
      if (!isActive()) {
        if (level?.group) disposeLevelGroup(level.group);
        resetArenaCeilingDayNightCache();
        levelTextures?.dispose();
        return;
      }
      enableShadowsOn(level.group);
      if (!interiorLevel) {
        assignWorldLayers(level.group);
      }
      disableInteriorCastShadows(level.group);
      setHealthBarOccluders(level.group);
      setSunOcclusionRoot(level.group);
      reportLoad(72, "Level geometry");
      if (shouldLoadSky(arena)) {
        const weatherOccluders = buildRainOccluderSlabs(
          level.groundSurfaces,
          level.catwalkDeckY,
          level.ceilingColliders.filter((c) => c.kind === "deck"),
          level.stairColliders
        );
        const snowOccluders = buildSnowOccluderSlabs(
          level.groundSurfaces,
          level.catwalkDeckY,
          level.ceilingColliders.filter((c) => c.kind === "deck"),
          level.stairColliders
        );
        rain = createRainSystem(scene);
        rain.occluders = weatherOccluders;
        snow = createSnowSystem(scene);
        snow.occluders = snowOccluders;
        snowRef.current = snow;
      }
      prebuildRagdollTemplates(level.targets);
      vx27ContainersRef.current = level.vx27ContainerMeshes ?? [];
      vx27ContainerCullablesRef.current = buildVx27ContainerCullables(
        vx27ContainersRef.current
      );
      controlPanelsRef.current = level.controlPanelMeshes ?? [];
      syncControlPanelScreenMaterials(controlPanelsRef.current);
      let vx27DoorInteractMeshesCache = collectVx27DoorInteractMeshes(
        vx27ContainersRef.current
      );
      if (vx27ContainersRef.current.length > 0) {
        const firstGroup = vx27ContainersRef.current[0];
        const propMaterial = firstGroup.userData.vx27PropDef?.materialTuning;
        const materialTuning = propMaterial
          ? normalizeVx27ContainerMaterialTuning(propMaterial)
          : loadVx27ContainerMaterialTuning();
        setVx27ContainerMaterialTuning(materialTuning, firstGroup);
        setVx27ContainerCeilingLightEnabled(
          vx27ContainersRef.current,
          vx27ContainerCeilingLightRef.current
        );
      }
      preloadBulletHoleTextures();
      const levelHitMeshes = collectLevelHitMeshes(level.group, level.targets);
      const syncInteriorLighting = () => {
        oilBarrelFireLightsRef.current = collectOilBarrelFireLights(level.group);
        initOilBarrelFireLightFlicker(oilBarrelFireLightsRef.current);
        initVx27ContainerCeilingLightFlicker(vx27ContainersRef.current);
        rebuildFlickerLights();
        rebuildOilBarrelRuntimeIndex();
        roomCullablesRef.current = buildRoomCullables(
          level.group,
          arena.rooms ?? [],
          [...roomLightsRef.current, ...oilBarrelFireLightsRef.current],
          arenaHalf,
          attachWall,
          arena.wallHeight,
          arena.floorExtensions ?? []
        );
      };
      /** @type {THREE.Light[]} Reused each frame — room + barrel fire flicker lights. */
      const flickerLights = [];
      let oilBarrelRuntimeIndex = buildOilBarrelRuntimeIndex(level.group);
      function rebuildFlickerLights() {
        flickerLights.length = 0;
        for (const light of roomLightsRef.current) flickerLights.push(light);
        for (const light of oilBarrelFireLightsRef.current) flickerLights.push(light);
      }
      function rebuildOilBarrelRuntimeIndex() {
        oilBarrelRuntimeIndex = buildOilBarrelRuntimeIndex(level.group);
      }
      ensureOilBarrelFlameMeshes(level.group);
      refreshOilBarrelRenderLayers(level.group);
      refreshVx27ContainerRenderLayers(level.group);
      refreshControlPanelRenderLayers(level.group);
      syncInteriorLighting();
      syncOilBarrelFireLightLayers(oilBarrelFireLightsRef.current, false);
      applySunLightPosition(sun, sunLightPosRef.current);
      applyMoonLightPosition(moon, moonLightPosRef.current);
      sunRef.current = sun;
      moonRef.current = moon;
      sunBaseIntensityRef.current = sun.intensity;
      applyDayNightRef.current = (arg) => {
        // Accept either a boolean (legacy `isDay`) or a 0..1 nightness so
        // callers don't all have to be updated at once. The animate loop
        // passes the current nightness directly each frame.
        const nightness =
          typeof arg === "boolean"
            ? arg ? 0 : 1
            : THREE.MathUtils.clamp(arg ?? dayNightCurNightnessRef.current, 0, 1);
        dayNightCurNightnessRef.current = nightness;

        // Drive the sun across the sky from its configured elevation down
        // through the horizon to a mirrored elevation below it, while the
        // moon rises from the opposite (below-horizon) angle up to its
        // configured peak. At nightness=0.5 both lights are at the horizon
        // casting long shadows — that's the dawn/dusk moment.
        const sunCfg = sunAnglesRef.current;
        const moonCfg = moonAnglesRef.current;
        const sunElev = THREE.MathUtils.lerp(
          sunCfg.elevation,
          -sunCfg.elevation,
          nightness
        );
        const moonElev = THREE.MathUtils.lerp(
          -moonCfg.elevation,
          moonCfg.elevation,
          nightness
        );
        const animSunPos = sunPositionFromAngles(sunCfg.azimuth, sunElev);
        const animMoonPos = moonPositionFromAngles(moonCfg.azimuth, moonElev);

        applySunLightPosition(sun, animSunPos);

        const sunFactor = THREE.MathUtils.smoothstep(sunElev, -2, 5);
        const moonFactor = THREE.MathUtils.smoothstep(moonElev, -2, 5);
        const skyBlend = computeSkyNightBlend(nightness, sunFactor, moonFactor);

        applyDayNightEnvironmentNightness(
          sun,
          scene,
          renderer,
          sky ?? skyRef.current,
          {
            outdoorLights,
            sheltered,
            sunBaseIntensity: sunBaseIntensityRef.current,
            moon,
            moonIntensity: moonIntensityRef.current,
            moonPosition: animMoonPos,
            nightness,
            levelRoot: level?.group ?? null,
            skyBlend,
          }
        );

        // Override the linear nightness-based intensity with an elevation-
        // based one. Each light fades naturally as it approaches the horizon
        // and is gone once it dips below — this is also what kills shadows
        // before they'd otherwise render from below the floor.
        sun.intensity = sunBaseIntensityRef.current * sunFactor;
        moon.intensity = moonIntensityRef.current * moonFactor;
        // Only one directional shadow map during dawn/dusk — both lights can be
        // above the horizon at once, and dual shadow passes hitch the fade.
        const sunShadowOn = sun.intensity > 0.001;
        const moonShadowOn = moon.intensity > 0.001;
        if (sunShadowOn && moonShadowOn) {
          if (sun.intensity >= moon.intensity) {
            sun.castShadow = true;
            moon.castShadow = false;
          } else {
            sun.castShadow = false;
            moon.castShadow = true;
          }
        } else {
          sun.castShadow = sunShadowOn;
          moon.castShadow = moonShadowOn;
        }

        // Pin the sky's sun/moon billboards to the same animated positions so
        // the discs visibly track the light sources. Opacity follows each
        // light's elevation factor so the disc fades with the actual lighting
        // contribution (and disappears below the horizon).
        const activeSky = sky ?? skyRef.current;
        if (activeSky) {
          activeSky.setSunPosition?.(animSunPos);
          activeSky.setMoonPosition?.(animMoonPos);
          activeSky.setSunOpacity?.(sunFactor);
          activeSky.setMoonOpacity?.(moonFactor);
        }

        // Hemi is user-tunable per mode — lerp temperature + intensity between
        // the two stored settings so the sky/ground hemi color eases too.
        const dayHemi = hemiDayRef.current;
        const nightHemi = hemiNightRef.current;
        const hemiIntensity = THREE.MathUtils.lerp(
          dayHemi.intensity,
          nightHemi.intensity,
          nightness
        );
        const shelteredHemiMul = sheltered ? 0.78 : 1;
        applyHemisphereSettings(
          hemiRef.current,
          {
            temperature: THREE.MathUtils.lerp(
              dayHemi.temperature,
              nightHemi.temperature,
              nightness
            ),
            intensity: hemiIntensity * shelteredHemiMul,
          },
          { sheltered }
        );

        updateControlPanelMaterialsLive({
          nightness,
          groups: controlPanelsRef.current,
        });
      };
      refitSunShadowRef.current = () => {
        if (!level?.group) return;
        applySunLightPosition(sun, sunLightPosRef.current);
        fitDirectionalLightShadow(sun, level.group, {
          arenaSize: arena.size,
        });
        sun.updateMatrixWorld(true);
        sun.target.updateMatrixWorld(true);
      };
      refitMoonShadowRef.current = () => {
        if (!level?.group || !moon) return;
        applyMoonLightPosition(moon, moonLightPosRef.current);
        fitMoonDirectionalLightShadow(moon, level.group, {
          arenaSize: arena.size,
        });
        moon.updateMatrixWorld(true);
        moon.target.updateMatrixWorld(true);
      };
      const mountLevelCollectibles = () => {
        if (disposed || !level) return;
        const spawnedCollectibles = spawnLevelCollectibles(
          level.pickupsGroup ?? scene,
          arena
        );
        collectibleEntries = spawnedCollectibles.entries;
        if (level.pickupsGroup) enableShadowsOn(level.pickupsGroup);
        refreshLevelPickupShadows(
          level.pickupsGroup ?? scene,
          collectibleEntries.map((e) => e.drop?.mesh),
          level.group
        );
        requestShadowMapUpdate(renderer);
        mountCompassCollectibleMarkers(
          compassMarkersRef.current,
          collectibleEntries
        );
      };
      applyDayNightRef.current(sunIsDayRef.current);
      mountLevelCollectibles();
      applyShadowMapTypeToRenderer(renderer);
      resetAndApplyShadowCastHygiene(level.group);
      if (level.pickupsGroup) {
        resetAndApplyShadowCastHygiene(level.pickupsGroup);
      }
      requestShadowMapUpdate(renderer);
      if (sunIsDayRef.current) {
        refitSunShadowRef.current();
      } else {
        refitMoonShadowRef.current();
      }
      sun.updateMatrixWorld(true);
      sun.target.updateMatrixWorld(true);
      moon.updateMatrixWorld(true);
      moon.target.updateMatrixWorld(true);
      input = createInput(canvas, () => bindingsRef.current);
      inputRef.current = input;
      if (touchControlsGateRef.current) input.setTouchMode(true);
      /** Stable collider list — avoids spreading into a new array on every physics query. */
      const allColliders = [];
      function syncAllColliders() {
        allColliders.length = 0;
        allColliders.push(
          ...level.colliders,
          ...level.stairColliders,
          ...level.ceilingColliders
        );
        invalidateVx27ContainerColliderCache();
      }
      syncAllColliders();
      const targetSpawnCtx = spawnFootYContextFromLevel(level);
      syncControlPanelCollidersRef.current = () => {
        const arena = arenaLiveRef.current;
        const lvl = levelRef.current;
        if (!arena || !lvl) return;
        lvl.resyncControlPanelColliders?.();
        syncAllColliders();
      };
      for (const group of vx27ContainersRef.current) {
        syncVx27ContainerCollider(
          level.colliders,
          group.userData.vx27PropId,
          readVx27ContainerPlacement(group),
          {
            ...group.userData.vx27PropDef,
            interiorInsets: group.userData.vx27InteriorInsets,
            edgeRadius: group.userData.vx27EdgeRadius,
            exteriorCornerRadius: group.userData.vx27ExteriorCornerRadius,
            scale: group.userData.vx27Scale,
            width: group.userData.vx27Width,
            height: group.userData.vx27Height,
            length: group.userData.vx27Length,
            doorTuning: group.userData.vx27DoorTuning,
          }
        );
      }
      syncAllColliders();
      rebuildOilBarrelsRef.current = () => {
        const arena = arenaLiveRef.current;
        if (!arena || !level?.group) return;
        rebuildLevelOilBarrels(level.group, arena);
        level?.resyncOilBarrelColliders?.();
        syncInteriorLighting();
      };
      const playerSpawn = arena.playerSpawn;
      player = createPlayerController(camera, level.bounds, level.floorY, {
        initialPosition: playerSpawn
          ? {
              x: playerSpawn.x ?? 0,
              y: playerSpawn.y,
              z: playerSpawn.z ?? 6,
            }
          : undefined,
        initialYaw: playerSpawn?.yaw,
        getColliders: () => allColliders,
        getGroundSurfaces: () => level.groundSurfaces,
        getFloorHoles: () => level.floorHoles ?? [],
        getFloorBounds: () => level.floorBounds,
        arenaBounds: level.arenaBounds,
        wallStandoff: arena.wallStandoff ?? 0.5,
        getDoorwayPassages: () => level.doorwayPassages ?? [],
        getDoorwayOpenings: () => level.doorwayOpenings ?? [],
        getAttachWall: () => level.attachWall ?? "north",
        getIsInRoom: (x, z) =>
          isPointInsideAnyRoom(
            x,
            z,
            level.rooms ?? [],
            arenaHalf,
            level.attachWall ?? attachWall
          ) ||
          isPointInsideAnyFloorExtension(
            x,
            z,
            arena.floorExtensions ?? [],
            level.attachWall ?? attachWall,
            arenaHalf,
            arena.wallThickness ?? 0.5,
            FLOOR_EXTENSION_WALK_PAD
          ),
        findFloorExtensionAtZ: (z) =>
          findFloorExtensionFootprintAtZ(
            z,
            arena.floorExtensions ?? [],
            level.attachWall ?? attachWall,
            arenaHalf,
            arena.wallThickness ?? 0.5
          ),
        getBindings: () => bindingsRef.current,
        getInvertYLook: () => invertYRef.current,
        getKeyboardLookSpeed: () => keyboardLookRef.current,
        getKeyboardLookEase: () => keyboardEaseRef.current,
        getMouseLookSpeed: () => mouseLookRef.current,
        getMouseLookEase: () => mouseEaseRef.current,
        getMaxLookRate: () => maxLookRateRef.current,
        getStandEyeHeight: () => playerHeightRef.current,
        getWalkBobTuning: () =>
          resolveWalkBobTuning(walkBobTuningRef.current),
        getStairWalkTuning: () =>
          normalizeStairWalkTuning(stairWalkTuningRef.current),
        getStaminaMax: () => {
          const hp = playerHealthRef.current;
          return hp > 100 ? hp / 100 : 1;
        },
        onFootstep: ({ speed, crouching, sprinting, onStairs }) => {
          if (!loadDoneRef.current) return;
          const t = resolveWalkBobTuning(walkBobTuningRef.current);
          const speedNorm = speed / Math.max(t.walkSpeed, 0.1);
          const playbackRate = THREE.MathUtils.clamp(
            0.94 + (speedNorm - 1) * 0.06,
            0.9,
            1.08
          );
          let volume = 0.5;
          if (crouching) volume *= 0.5;
          else if (sprinting) volume *= 1.08;
          if (onStairs) volume *= stairWalkTuningRef.current.footstepVolumeScale;
          sounds.playFootstep({ volume, playbackRate });
        },
      });

      respawnCallbackRef.current = () => {
        player.respawn();
        weapon?.replayRaise?.();
      };

      const shootRaycaster = new THREE.Raycaster();
      shootRaycaster.layers.enable(WORLD_LAYER);
      shootRaycaster.layers.enable(ROOM_INTERIOR_LAYER);
      const hitRaycaster = new THREE.Raycaster();
      hitRaycaster.layers.enable(WORLD_LAYER);
      hitRaycaster.layers.enable(ROOM_INTERIOR_LAYER);
      const screenCenter = new THREE.Vector2(0, 0);

      const currentWeaponLoad = ++weaponLoadId;
      reportLoad(74, "View weapons (rifle + pistol)");
      const rifleCfg = PRIMARY_WEAPONS.rifle;
      const pistolCfg = PRIMARY_WEAPONS.pistol;
      const weaponPromise = Promise.all([
        loadViewWeapon(camera, scene, rifleCfg.modelUrl, {
          maxAnisotropy,
          ...rifleCfg.viewOptions,
          weaponId: "rifle",
        }),
        loadViewWeapon(camera, scene, pistolCfg.modelUrl, {
          maxAnisotropy,
          ...pistolCfg.viewOptions,
          weaponId: "pistol",
        }),
      ])
        .then(([rifle, pistol]) => {
          if (disposed || currentWeaponLoad !== weaponLoadId) {
            rifle?.dispose();
            pistol?.dispose();
            return null;
          }
          primaryWeapons.rifle = rifle;
          primaryWeapons.pistol = pistol;
          rifle.holder.visible = true;
          pistol.holder.visible = false;
          weapon = rifle;
          weaponRef.current = rifle;
          rifle.update(camera, 0, 0, weaponTuningRef, {
            roundDisplayTuningRef,
          });
          return { rifle, pistol };
        })
        .catch((err) => {
          console.error("Primary weapon models failed to load:", err);
          return null;
        });
      hpOrbs = [];
      ammoDrops = [];
      grenades = [];
      grenadeDrops = [];
      bloodSplatters = [];
      pendingKillBlood = [];
      bloodAfterRagdoll = [];
      let grenadeHeld = false;
      let simTime = 0;
      let _lastHostileCount = -1;
      const BULLET_MAX_RANGE = 55;
      const _muzzlePos = new THREE.Vector3();
      const _muzzleDir = new THREE.Vector3();
      const targetConfig = level.targetConfig;

      const liveTargetsScratch = [];
      function refreshLiveTargets() {
        liveTargetsScratch.length = 0;
        for (const t of level.targets) {
          if (t.visible && t.userData.health > 0) liveTargetsScratch.push(t);
        }
        return liveTargetsScratch;
      }

      function getLiveTargets() {
        return refreshLiveTargets();
      }

      const flashbangLosRaycaster = new THREE.Raycaster();
      flashbangLosRaycaster.layers.enable(WORLD_LAYER);
      flashbangLosRaycaster.layers.enable(ROOM_INTERIOR_LAYER);
      const _flashBlindPos = new THREE.Vector3();
      const _flashBlindDir = new THREE.Vector3();
      const _flashBlindNdc = new THREE.Vector3();

      /** True when the blast is on-screen and not blocked by level geometry. */
      function canFlashbangBlindPlayer(explosionPos) {
        const blindRadius = getGrenadeParams().flashbangBlindRadius ?? 18;
        _flashBlindPos.copy(explosionPos);
        _flashBlindPos.y += 0.35;

        const dist = camera.position.distanceTo(_flashBlindPos);
        if (dist > blindRadius) return false;

        _flashBlindNdc.copy(_flashBlindPos).project(camera);
        if (_flashBlindNdc.z > 1) return false;
        if (
          Math.abs(_flashBlindNdc.x) > 1.3 ||
          Math.abs(_flashBlindNdc.y) > 1.3
        ) {
          return false;
        }

        _flashBlindDir.subVectors(_flashBlindPos, camera.position);
        const distLen = _flashBlindDir.length();
        if (distLen < 0.08) return true;

        if (!hasLineOfSightToPoint(camera.position, _flashBlindPos, levelHitMeshes)) {
          return false;
        }

        _flashBlindDir.multiplyScalar(1 / distLen);
        flashbangLosRaycaster.set(camera.position, _flashBlindDir);
        flashbangLosRaycaster.far = distLen + 0.2;
        flashbangLosRaycaster.near = 0.05;

        for (const hit of flashbangLosRaycaster.intersectObjects(
          getLiveTargets(),
          true
        )) {
          if (hit.object.isSprite) continue;
          if (hit.distance < distLen - 0.45) return false;
        }

        return true;
      }

      function scheduleRespawn(mesh) {
        const delayMs = targetConfig.respawnDelay * 1000;
        setTimeout(() => {
          if (disposed) return;
          const fixed = mesh.userData.fixedSpawn;
          if (fixed) {
            const pos = resolveAuthoredSpawnPosition(fixed.x, fixed.z, {
              bounds: level.arenaBounds,
              colliders: allColliders,
              targets: level.targets,
              config: targetConfig,
              skip: mesh,
              spawnPoint: fixed,
              spawnCtx: targetSpawnCtx,
            });
            if (!pos) return;
            activateTargetAt(
              mesh,
              pos.x,
              pos.z,
              targetConfig,
              pos.y ?? fixed.y ?? 0,
              fixed.yaw
            );
            return;
          }
          const pos = pickRandomSpawnPosition({
            bounds: level.arenaBounds,
            colliders: allColliders,
            targets: level.targets,
            config: targetConfig,
            skip: mesh,
            floorHoles: level.floorHoles,
            spawnCtx: targetSpawnCtx,
          });
          if (!pos) return;
          activateTargetAt(mesh, pos.x, pos.z, targetConfig, pos.y);
        }, delayMs);
      }

      function scheduleKillDrops(deathPos, zone) {
        const rndAngle = Math.random() * Math.PI * 2;
        const rndOff = 0.3 + Math.random() * 0.5;
        const hpDelay = 800 + Math.random() * 400;
        const ammoDelay = 1800 + Math.random() * 400;
        const grenDelay = 2200 + Math.random() * 500;

        const dropAt = (angle, delayMs, spawn) => {
          setTimeout(() => {
            spawn(
              new THREE.Vector3(
                deathPos.x + Math.cos(angle) * rndOff,
                deathPos.y,
                deathPos.z + Math.sin(angle) * rndOff
              )
            );
          }, delayMs);
        };

        if (DEV_DROP_ALL_REWARDS) {
          dropAt(rndAngle, hpDelay, (p) =>
            hpOrbs.push(spawnHpOrb(scene, p, level.floorY))
          );
          dropAt(rndAngle + Math.PI * 0.66, ammoDelay, (p) =>
            ammoDrops.push(spawnAmmoDrop(scene, p, level.floorY))
          );
          dropAt(rndAngle + Math.PI * 1.33, grenDelay, (p) =>
            grenadeDrops.push(spawnGrenadeDrop(scene, p, level.floorY))
          );
          return;
        }

        if (zone === "head" || playerHealthRef.current < 50) {
          dropAt(rndAngle, hpDelay, (p) =>
            hpOrbs.push(spawnHpOrb(scene, p, level.floorY))
          );
        }
        if (shouldDropAmmoCrate(spareMagsRef.current, ammoDropSpareThresholdRef.current)) {
          dropAt(rndAngle + Math.PI, ammoDelay, (p) =>
            ammoDrops.push(spawnAmmoDrop(scene, p, level.floorY))
          );
        }
        if (rollGrenadeDrop(grenadeCountRef.current)) {
          dropAt(rndAngle + Math.PI * 0.5, grenDelay, (p) =>
            grenadeDrops.push(spawnGrenadeDrop(scene, p, level.floorY))
          );
        }
      }

      function scheduleGrenadeKillDrops(deathPos) {
        const rndAngle = Math.random() * Math.PI * 2;
        const rndOff = 0.3 + Math.random() * 0.5;
        const hpDelay = 800 + Math.random() * 400;
        const ammoDelay = 1800 + Math.random() * 400;
        const grenDelay = 2200 + Math.random() * 500;

        const dropAt = (angle, delayMs, spawn) => {
          setTimeout(() => {
            spawn(
              new THREE.Vector3(
                deathPos.x + Math.cos(angle) * rndOff,
                deathPos.y,
                deathPos.z + Math.sin(angle) * rndOff
              )
            );
          }, delayMs);
        };

        if (DEV_DROP_ALL_REWARDS) {
          dropAt(rndAngle, hpDelay, (p) =>
            hpOrbs.push(spawnHpOrb(scene, p, level.floorY))
          );
          dropAt(rndAngle + Math.PI * 0.66, ammoDelay, (p) =>
            ammoDrops.push(spawnAmmoDrop(scene, p, level.floorY))
          );
          dropAt(rndAngle + Math.PI * 1.33, grenDelay, (p) =>
            grenadeDrops.push(spawnGrenadeDrop(scene, p, level.floorY))
          );
          return;
        }

        dropAt(rndAngle, hpDelay, (p) =>
          hpOrbs.push(spawnHpOrb(scene, p, level.floorY))
        );
        if (shouldDropAmmoCrate(spareMagsRef.current, ammoDropSpareThresholdRef.current)) {
          dropAt(rndAngle + Math.PI, ammoDelay, (p) =>
            ammoDrops.push(spawnAmmoDrop(scene, p, level.floorY))
          );
        }
        if (rollGrenadeDrop(grenadeCountRef.current)) {
          dropAt(rndAngle + Math.PI * 0.5, grenDelay, (p) =>
            grenadeDrops.push(spawnGrenadeDrop(scene, p, level.floorY))
          );
        }
      }

      function flushBloodAfterRagdoll() {
        if (!bloodAfterRagdoll.length) return;
        for (const pending of bloodAfterRagdoll) {
          const splatter = spawnBloodSplatter(
            scene,
            pending.point,
            pending.dir,
            pending.damage,
          );
          if (splatter) bloodSplatters.push(splatter);
          if (pending.mesh) {
            spawnBloodMarkOnTarget(
              pending.mesh,
              pending.point,
              pending.face ?? null,
              pending.dir,
              pending.damage,
            );
          }
        }
        bloodAfterRagdoll.length = 0;
      }

      function flushPendingKillBlood() {
        if (!pendingKillBlood.length) return;
        for (let i = pendingKillBlood.length - 1; i >= 0; i -= 1) {
          const pending = pendingKillBlood[i];
          if (!pending.mesh?.userData?.ragdoll) continue;
          bloodAfterRagdoll.push(pending);
          pendingKillBlood.splice(i, 1);
        }
      }

      function playTargetHitSound(mesh, hitPoint, hitZone) {
        sounds.playEnemyHit(scene, hitPoint, {
          headshot: hitZone === "head",
        });
      }

      function playTargetDeathSound(mesh, hitPoint, hitZone) {
        const pos = hitPoint?.clone?.() ?? mesh.position.clone();
        if (!hitPoint) {
          const h = mesh.userData?.height ?? 1.8;
          pos.y += h * 0.55;
        }
        sounds.playEnemyDeath(scene, pos, {
          headshot: hitZone === "head",
          blast: hitZone === "grenade",
        });
      }

      function playTargetHoleFallSound(mesh, position) {
        const pos = position?.clone?.() ?? mesh.position.clone();
        sounds.playHoleFallDeathWorld(scene, pos);
      }

      function awardCombatScoreAt(mesh, hitResult, hitPoint) {
        const scoreResult = applyCombatScore(mesh, hitResult);
        if (scoreResult.score <= 0) return;

        playerScoreRef.current += scoreResult.score;
        if (showHudRef.current) {
          updateScoreHud(scoreHudRef.current, playerScoreRef.current);
        }

        if (hitResult.killed && hitPoint && scorePopupLayer && !deathStateRef.current) {
          scorePopupLayer.spawn({
            point: hitPoint,
            text: formatKillCallout(
              hitResult.zone,
              scoreResult.score,
              mesh.id,
            ),
            zone: hitResult.zone,
          });
        }
      }

      function applyHit(hit, bulletDirection, targetMesh) {
        const mesh = targetMesh ?? hit.object;
        const { killed, zone, damage } = applyTargetHit(mesh, hit.point, bulletDirection);
        if (zone !== "miss") {
          awardCombatScoreAt(mesh, { zone, damage, killed }, hit.point);
          playTargetHitSound(mesh, hit.point, zone);
          if (killed) {
            playTargetDeathSound(mesh, hit.point, zone);
          }
          const splatterDamage = Math.max(damage, 4);
          if (killed) {
            pendingKillBlood.push({
              mesh,
              point: hit.point.clone(),
              dir: bulletDirection?.clone?.() ?? bulletDirection,
              face: hit.face ?? null,
              damage: splatterDamage,
            });
          } else {
            const splatter = spawnBloodSplatter(
              scene,
              hit.point,
              bulletDirection,
              splatterDamage,
            );
            if (splatter) bloodSplatters.push(splatter);
            spawnBloodMarkOnTarget(
              mesh,
              hit.point,
              hit.face,
              bulletDirection,
              splatterDamage,
            );
          }
        }
        if (killed) {
          const deathPos = mesh.position.clone();
          scheduleKillDrops(deathPos, zone);
          startDeathAnimation(mesh, bulletDirection, {
            scene,
            colliders:
              mesh.userData.predictiveDeathColliders ??
              collidersForRagdollNear(
                deathPos.x,
                deathPos.z,
                allColliders,
                vx27ContainersRef.current
              ),
            floorY: level.floorY,
            bounds: level.bounds,
            hitZone: zone,
            hitPoint: hit.point,
          });
        }
      }

      function applyGrenadeHit(mesh, hitPoint, blastDir, damage) {
        const ud = mesh.userData;
        if (ud.health <= 0) return { killed: false };
        ud.health = Math.max(0, ud.health - damage);
        ud.repairCooldown = ud.repairDelayAfterHit ?? 3;
        const ratio = ud.health / ud.maxHealth;
        const killed = ud.health <= 0;
        awardCombatScoreAt(mesh, { zone: "grenade", damage, killed }, hitPoint);
        if (killed) {
          scheduleGrenadeKillDrops(mesh.position.clone());
        }
        return { killed, health: ud.health, ratio };
      }

      function flashMuzzle() {
        if (!weapon) return;
        const palette = getLaserPalette(playerHealthRef.current > 100);
        weapon.muzzleFlash.color.setHex(palette.muzzle);
        weapon.muzzleFlash.intensity = 5;
        if (flashTimeout) clearTimeout(flashTimeout);
        flashTimeout = setTimeout(() => {
          weapon.muzzleFlash.intensity = 0;
        }, 60);
      }

      let burstShotsLeft = 0;
      let burstTimer = 0;
      let autoFireTimer = 0;

      function getActiveWeaponConfig() {
        return getPrimaryWeaponConfig(activePrimaryId);
      }

      function getActiveTuningRef() {
        return activePrimaryId === "pistol" ? pistolTuningRef : weaponTuningRef;
      }

      function syncAmmoPoolSnapshot() {
        ammoPoolSnapshotRef.current = {
          rifle: {
            rounds: ammoPool.rifle.rounds,
            spare: ammoPool.rifle.spare,
          },
          pistol: {
            rounds: ammoPool.pistol.rounds,
            spare: ammoPool.pistol.spare,
          },
        };
      }

      function persistActiveAmmo() {
        ammoPool[activePrimaryId].rounds = roundsInMagRef.current;
        ammoPool[activePrimaryId].spare = spareMagsRef.current;
        syncAmmoPoolSnapshot();
      }

      function applyFireModeForWeapon(id) {
        const mode = resolveFireModeForWeapon(
          id,
          fireModeByWeaponRef.current[id],
        );
        fireModeByWeaponRef.current[id] = mode;
        fireModeRef.current = mode;
        setFireMode(mode);
      }

      function setFireModeForActiveWeapon(mode) {
        const resolved = resolveFireModeForWeapon(activePrimaryId, mode);
        fireModeByWeaponRef.current[activePrimaryId] = resolved;
        fireModeRef.current = resolved;
        setFireMode(resolved);
      }

      function loadActiveAmmo(id) {
        const cfg = getPrimaryWeaponConfig(id);
        const store = ammoPool[id];
        roundsInMagRef.current = store.rounds;
        spareMagsRef.current = store.spare;
        activePrimaryIdRef.current = id;
        setActivePrimaryWeapon(id);
        setActiveMagazineSize(cfg.magazineSize);
        setActiveLowAmmoThreshold(cfg.lowAmmoThreshold);
        setRoundsInMag(store.rounds);
        setSpareMags(store.spare);
        applyFireModeForWeapon(id);
      }

      function setActivePrimaryWeaponView(id) {
        activePrimaryId = id;
        activePrimaryIdRef.current = id;
        weapon = primaryWeapons[id];
        weaponRef.current = weapon;
      }

      function syncAmmoToUi() {
        setAmmoStateRef.current?.(
          roundsInMagRef.current,
          spareMagsRef.current
        );
      }

      function tryReload(force) {
        const cfg = getActiveWeaponConfig();
        if (spareMagsRef.current <= 0) return false;
        if (!force && roundsInMagRef.current >= cfg.lowAmmoThreshold) {
          return false;
        }
        spareMagsRef.current -= 1;
        roundsInMagRef.current = Math.min(
          roundsInMagRef.current + cfg.magazineSize,
          cfg.magazineSize * 2
        );
        persistActiveAmmo();
        scheduleGameplayHudSyncRef.current();
        sounds.playSupplyPickup();
        return true;
      }

      function fireOneRound() {
        if (roundsInMagRef.current <= 0 && !tryReload(true)) return false;

        roundsInMagRef.current -= 1;
        persistActiveAmmo();
        scheduleGameplayHudSyncRef.current();

        weapon.getMuzzleWorld(_muzzlePos, _muzzleDir, camera);
        hitRaycaster.setFromCamera(screenCenter, camera);

        const camDir = hitRaycaster.ray.direction.clone();
        const radioactive = playerHealthRef.current > 100;
        flashMuzzle();
        sounds.play("laser_shot", { volume: 0.65 });
        const ads = weapon.getAimBlend?.() ?? 0;
        const scale = 1 - ads * 0.45;
        player.addAimRecoil(scale);
        weapon.applyFireKick(ads);

        refreshLiveTargets();
        shootRaycaster.set(hitRaycaster.ray.origin, camDir);
        shootRaycaster.far = BULLET_MAX_RANGE;
        const targetHits = shootRaycaster.intersectObjects(
          liveTargetsScratch,
          true
        );
        const surfaceHits = shootRaycaster.intersectObjects(
          levelHitMeshes,
          false
        );
        const bestHit = pickClosestBulletHit(targetHits, surfaceHits);
        if (bestHit) {
          let targetNode = bestHit.object;
          while (targetNode && !targetNode.userData?.isTarget) {
            targetNode = targetNode.parent;
          }
          if (targetNode?.userData?.isTarget && targetNode.userData.health > 0) {
            applyHit(bestHit, camDir, targetNode);
          } else {
            applyBulletSurfaceHit(bestHit, camDir, radioactive);
          }
        }
        return true;
      }

      function processWeaponFire(dt) {
        if (!weapon || weaponSwap.isBusy()) return;
        if ((weapon.getHolsterAmount?.() ?? 0) > 0.02) return;

        const cfg = getActiveWeaponConfig();
        const mode =
          cfg.fireModes.length === 1 ? cfg.fireModes[0] : fireModeRef.current;
        if (
          burstShotsLeft === 0 &&
          mode === "burst" &&
          input.consumeShoot()
        ) {
          burstShotsLeft = BURST_SHOT_COUNT;
          burstTimer = 0;
        }

        if (burstShotsLeft > 0) {
          burstTimer -= dt;
          while (burstShotsLeft > 0 && burstTimer <= 0) {
            if (!fireOneRound()) {
              burstShotsLeft = 0;
              break;
            }
            burstShotsLeft -= 1;
            burstTimer = burstShotsLeft > 0 ? BURST_INTERVAL : 0;
          }
          return;
        }

        if (mode === "single" && input.consumeShoot()) {
          fireOneRound();
        } else if (mode === "auto") {
          autoFireTimer -= dt;
          if (
            input.isShootHeld() &&
            (input.consumeShoot() || autoFireTimer <= 0)
          ) {
            if (fireOneRound()) autoFireTimer = AUTO_FIRE_INTERVAL;
          }
        }
      }

      let lastTime = performance.now();

      function syncPointerLocked() {
        const locked = document.pointerLockElement === canvas;
        if (locked) sounds.resume();
      }

      function animate(now) {
        if (disposed || !gameReady || !level?.group) return;
        if (!level.group.parent) scene.add(level.group);
        try {
        flushBloodAfterRagdoll();
        flushPendingRagdolls();
        flushKillPredictiveGpuWarm();
        flushPendingKillBlood();
        tickOilBarrelInteriorVideo(camera, oilBarrelRuntimeIndex);
        sounds.updateOilBarrelFire(
          oilBarrelRuntimeIndex.fireLights,
          oilBarrelTuningRef.current.interiorFire !== false
        );
        const rawFrameDt = Math.min((now - lastTime) / 1000, 0.15);
        const dt = Math.min(rawFrameDt, 0.05);
        lastTime = now;
        if (dt > 0) simTime += dt;
        if (dt > 0 && player && settingsOpenRef.current && playerCoordsMenuRef.current) {
          const yawDeg = (player.getYaw() * 180) / Math.PI;
          const footY = player.getFootY();
          const px = camera.position.x;
          const pz = camera.position.z;
          const text =
            `X ${px.toFixed(3)}  Z ${pz.toFixed(3)}  foot ${footY.toFixed(3)}  eye ${camera.position.y.toFixed(3)}  yaw ${yawDeg.toFixed(1)}°`;
          const json = JSON.stringify({
            x: +px.toFixed(3),
            z: +pz.toFixed(3),
            footY: +footY.toFixed(3),
            eyeY: +camera.position.y.toFixed(3),
            yawDeg: +yawDeg.toFixed(1),
          });
          playerCoordsMenuRef.current.textContent = text;
          playerCoordsMenuRef.current.dataset.coords = json;
        }

        // Candle-flicker the warm interior lights. Uses rAF's absolute
        // timestamp so the wobble keeps phase across frame-time hitches.
        updateCandleFlicker(flickerLights, now * 0.001);

        const locked = input.isLocked();
        const pointerActive = input.isPointerActive();
        const touchMode = input.isTouchMode();
        const aimHeld =
          !rebindActionRef.current &&
          isBindingDown(input, bindingsRef.current, "aim");
        const aimTarget = aimHeld ? 1 : 0;

        // Death sequence (two phases):
        //   1. FREEZE  — overlay is fully opaque, player is not respawned,
        //                input/physics/weapons are disabled. Stays until the
        //                player clicks to respawn (after a brief minimum
        //                display time to prevent accidental click-through).
        //   2. FADE    — player has just been respawned; the overlay fades
        //                out over `DEATH_FADE_MS` while the player can
        //                already move and shoot.
        // `frozen` is the only thing that gates input/physics; the fade
        // phase deliberately does NOT block gameplay.
        const deathState = deathStateRef.current;
        let frozen = false;
        if (deathState) {
          if (!deathState.respawned) {
            const canRespawn = now >= deathState.minDisplayEnd;
            if (canRespawn && input.consumeShoot()) {
              player.respawn();
              weapon?.replayRaise?.();
              deathState.respawned = true;
              playerHealthRef.current = 100;
              setPlayerHealth(100);
              grenadeCountRef.current = getGrenadeParams().grenadeCount;
              setGrenadeCount(grenadeCountRef.current);
              flashbangBlindStartRef.current = 0;
              updateFlashbangOverlay(flashbangOverlayRef.current, 0);
              deathState.fadeEndTime = now + DEATH_FADE_MS;
              beginDeathOverlayFade(deathOverlayRef.current);
            }
          }
          if (deathState.respawned && now >= deathState.fadeEndTime) {
            hideDeathOverlay(deathOverlayRef.current);
            deathStateRef.current = null;
          } else {
            frozen = !deathState.respawned;
          }
        }

        const canUseWeapons =
          !frozen &&
          !rebindActionRef.current &&
          !settingsOpenRef.current &&
          !controlsOpenRef.current &&
          !consoleHackOpenRef.current;

        if (consoleHackOpenRef.current) {
          input.discardLookDelta?.();
          if (!touchMode && document.pointerLockElement !== canvas) {
            safeRequestPointerLock(canvas);
          }
        }

        if (!frozen && !consoleHackOpenRef.current) {
          player.update(input, dt);
          playerPlacementRef.current = {
            x: player.getX(),
            z: player.getZ(),
            y: player.getFootY(),
          };

          if (player.isFallingThroughHole?.()) {
            if (!holeFallCryPlayedRef.current) {
              holeFallCryPlayedRef.current = true;
              sounds.playHoleFallDeath();
            }
          } else {
            holeFallCryPlayedRef.current = false;
          }

          if (
            playerHealthRef.current > 0 &&
            tickOilBarrelFireProximityDamage(
              level.group,
              camera.position,
              dt,
              oilBarrelTuningRef.current,
              levelHitMeshes
            )
          ) {
            const newHp = Math.max(
              0,
              playerHealthRef.current - OIL_BARREL_FIRE_PROXIMITY_DAMAGE
            );
            playerHealthRef.current = newHp;
            setPlayerHealth(newHp);
            triggerPlayerHurtFeedback(hurtVignetteFlashEndRef, sounds);
          }

          // Death-fall: dropped through a floor hole — trigger after the fall
          // animation (foot crosses kill depth), not on hole entry. Hole entry
          // only commits movement lock + tumble in PlayerController.
          if (
            !deathStateRef.current &&
            player.getFootY() < level.floorY - DEATH_FALL_DROP
          ) {
            const reason = "You fell to your death";
            playerLivesRef.current = Math.max(0, playerLivesRef.current - 1);
            setPlayerLives(playerLivesRef.current);
            playerHealthRef.current = 0;
            setPlayerHealth(0);
            deathStateRef.current = {
              reason,
              respawned: false,
              minDisplayEnd: now + DEATH_MIN_DISPLAY_MS,
              fadeEndTime: Infinity,
            };
            showDeathOverlay(
              deathOverlayRef.current,
              deathReasonRef.current,
              reason
            );
            frozen = true;
          }
          if (
            !deathStateRef.current &&
            playerHealthRef.current <= 0
          ) {
            const reason = grenadeSuicideRef.current
              ? "Suicide is never the answer"
              : "You were killed by an enemy";
            grenadeSuicideRef.current = false;
            playerLivesRef.current = Math.max(0, playerLivesRef.current - 1);
            setPlayerLives(playerLivesRef.current);
            playerHealthRef.current = 0;
            setPlayerHealth(0);
            sounds.playPlayerDeath();
            deathStateRef.current = {
              reason,
              respawned: false,
              minDisplayEnd: now + DEATH_MIN_DISPLAY_MS,
              fadeEndTime: Infinity,
            };
            showDeathOverlay(
              deathOverlayRef.current,
              deathReasonRef.current,
              reason
            );
            frozen = true;
          }
        }
        if (showHudRef.current && compassTapeRef.current && compassViewportRef.current) {
          const yawDeg = (player.getYaw() * 180) / Math.PI;
          const bearing = (((-yawDeg % 360) + 360) % 360);
          const viewport = compassViewportRef.current;
          const tape = compassTapeRef.current;
          const pxPerDeg = viewport.offsetWidth / 105;
          tape.style.setProperty("--compass-px-per-deg", `${pxPerDeg}px`);
          const center = viewport.offsetWidth * 0.5;
          tape.style.transform = `translateX(${center - bearing * pxPerDeg}px)`;
          if (collectibleEntries.length > 0 && compassMarkersRef.current) {
            ensureCompassCollectibleMarkers(
              compassMarkersRef.current,
              collectibleEntries
            );
            updateCompassCollectibleMarkers(
              collectibleEntries,
              camera.position.x,
              camera.position.z,
              player.getYaw(),
              viewport,
              pxPerDeg
            );
          }
          if (compassBlipsRef.current) {
            const px = camera.position.x;
            const pz = camera.position.z;
            const yaw = player.getYaw();
            if (level?.targets) {
              updateCompassEnemyBlips(
                compassBlipsRef.current,
                level.targets,
                px,
                pz,
                yaw,
                viewport,
                pxPerDeg
              );
            }
            const levelDrops = collectibleEntries
              .filter((e) => !e.collected && e.drop?.mesh?.position)
              .map((e) => e.drop);
            const allDrops = [...hpOrbs, ...ammoDrops, ...grenadeDrops, ...levelDrops]
              .filter((d) => !d.collected && d.mesh?.position);
            updateCompassRewardBlips(
              compassBlipsRef.current,
              allDrops,
              px,
              pz,
              yaw,
              viewport,
              pxPerDeg
            );
          }
        }
        camera.updateMatrixWorld(true);

        const canInteract =
          pointerActive &&
          !frozen &&
          !rebindActionRef.current &&
          !settingsOpenRef.current &&
          !controlsOpenRef.current &&
          !consoleHackOpenRef.current;
        let doorTarget = null;
        if (canInteract && vx27DoorInteractMeshesCache.length > 0) {
          hitRaycaster.setFromCamera(screenCenter, camera);
          doorTarget = pickVx27DoorUnderCrosshair(
            hitRaycaster,
            vx27DoorInteractMeshesCache
          );
        }
        if (touchMode) {
          const showDoor = Boolean(doorTarget);
          if (showDoor !== touchShowInteractRef.current) {
            touchShowInteractRef.current = showDoor;
            setTouchShowInteract(showDoor);
          }
        }
        const doorPromptEl = doorInteractPromptRef.current;
        if (doorPromptEl) {
          if (doorTarget) {
            doorPromptEl.textContent = getVx27DoorInteractLabel(
              doorTarget.group,
              doorTarget.end,
              doorTarget.side
            );
            doorPromptEl.classList.add("doorInteractPromptVisible");
            doorPromptEl.setAttribute("aria-hidden", "false");
          } else {
            doorPromptEl.textContent = "";
            doorPromptEl.classList.remove("doorInteractPromptVisible");
            doorPromptEl.setAttribute("aria-hidden", "true");
          }
        }
        if (
          doorTarget &&
          canInteract &&
          wasBindingPressed(input, bindingsRef.current, "interact")
        ) {
          toggleVx27ContainerDoorLeaf(
            doorTarget.group,
            doorTarget.end,
            doorTarget.side
          );
        }

        updateControlPanelScreenCHackFlashes(
          controlPanelsRef.current,
          dayNightCurNightnessRef.current,
          now
        );

        let hackTarget = null;
        if (
          !consoleHackOpenRef.current &&
          !settingsOpenRef.current &&
          !controlsOpenRef.current &&
          !frozen &&
          controlPanelsRef.current.length > 0
        ) {
          hackTarget = findNearestHackableControlPanel(
            camera,
            controlPanelsRef.current
          );
        }
        const showHackPrompt = Boolean(hackTarget) && !doorTarget;
        updateControlPanelHackPrompt(
          consoleHackPromptRef.current,
          bindingsRef.current,
          showHackPrompt
        );
        if (touchMode) {
          const showHack = showHackPrompt && canInteract;
          if (showHack !== touchShowHackRef.current) {
            touchShowHackRef.current = showHack;
            setTouchShowHack(showHack);
          }
        }
        if (
          hackTarget &&
          showHackPrompt &&
          canInteract &&
          wasBindingPressed(input, bindingsRef.current, "hack")
        ) {
          openConsoleHackRef.current(hackTarget);
        }

        if (
          canUseWeapons &&
          activePrimaryId === "rifle" &&
          wasBindingPressed(input, bindingsRef.current, "flashlight")
        ) {
          const nowOn = weapon?.toggleFlashlight();
          if (nowOn !== undefined) {
            flashlightOnRef.current = nowOn;
            dismissGameplayHint(gameplayHintsDismissedRef.current, "flashlight");
            clearGameplayHintPulse(gameplayHintRuntimeRef.current);
            refreshGameplayHintHudRef.current();
          }
        }

        if (
          DAY_NIGHT_SWITCHER_ENABLED &&
          canUseWeapons &&
          wasBindingPressed(input, bindingsRef.current, "dayNightToggle")
        ) {
          dayNightToggleRef.current?.(!sunIsDayRef.current);
          refreshGameplayHintHudRef.current();
        }

        const keyboardShoot =
          canUseWeapons &&
          isBindingDown(input, bindingsRef.current, "shoot");

        if (!frozen && !consoleHackOpenRef.current) {
          const rounds = roundsInMagRef.current;
          const spare = spareMagsRef.current;
          weaponSwap.update(dt, primaryWeapons, () => activePrimaryId, (id) => {
            persistActiveAmmo();
            setActivePrimaryWeaponView(id);
            loadActiveAmmo(id);
            primaryWeapons[id]?.replayRaise?.();
          });

          const cfg = getActiveWeaponConfig();
          weapon?.update(camera, aimTarget, dt, getActiveTuningRef(), {
            snapAim: !locked && !touchMode,
            moveSpeed: player.getHorizontalSpeed(),
            onStairs: player.isOnStairs(),
            walkBobTuning: resolveWalkBobTuning(walkBobTuningRef.current),
            stairWalkTuning: normalizeStairWalkTuning(stairWalkTuningRef.current),
            nightness: dayNightCurNightnessRef.current,
            roundCount: rounds,
            roundDisplayLow:
              rounds < cfg.lowAmmoThreshold || (rounds === 0 && spare === 0),
            roundDisplayHp: playerHealthRef.current,
            roundDisplayStamina: player.getStamina(),
            roundDisplayTuningRef,
            onTorchShadowStart: () => {
              if (!rendererRef.current) return;
              beginShadowStartupWindow();
              requestShadowMapUpdate(rendererRef.current);
            },
          });
          const torchLit = weapon?.isFlashlightOn?.();
          if (torchLit !== undefined) flashlightOnRef.current = torchLit;
          for (const id of ["rifle", "pistol"]) {
            const w = primaryWeapons[id];
            if (!w || w === weapon || !w.holder.visible) continue;
            w.update(camera, 0, dt, id === "pistol" ? pistolTuningRef : weaponTuningRef, {
              snapAim: true,
              roundDisplayTuningRef:
                id === "rifle" ? roundDisplayTuningRef : undefined,
            });
          }
        }

        const aimBlend = weapon?.getAimBlend() ?? 0;
        const activeWeaponCfg = getActiveWeaponConfig();
        const showGunReticule = activeWeaponCfg.viewOptions.gunReticule;
        const standardCrosshairOnly =
          activeWeaponCfg.viewOptions.standardCrosshairOnly;
        screenCrosshairRef.current?.update({
          aimBlend,
          tuning: crosshairTuningRef.current,
          showGunReticule,
          standardCrosshairOnly,
          doorTarget: Boolean(doorTarget),
          camera,
          canvasHeight: canvas.clientHeight,
        });
        const targetFov = THREE.MathUtils.lerp(HIP_FOV, ADS_FOV, aimBlend);
        const fovBlendSpeed = resolveAimBlendSpeed(aimTarget, aimBlend);
        camera.fov +=
          (targetFov - camera.fov) * (1 - Math.exp(-fovBlendSpeed * dt));
        camera.updateProjectionMatrix();

        if (canUseWeapons && (pointerActive || keyboardShoot)) {
          processWeaponFire(dt);
        }

        if (
          !rebindActionRef.current &&
          !settingsOpenRef.current &&
          !controlsOpenRef.current &&
          wasBindingPressed(input, bindingsRef.current, "reload")
        ) {
          tryReload();
        }

        if (
          !rebindActionRef.current &&
          !settingsOpenRef.current &&
          !controlsOpenRef.current &&
          wasBindingPressed(input, bindingsRef.current, "cycleFireMode")
        ) {
          const modes = getActiveWeaponConfig().fireModes;
          if (modes.length > 1) {
            const i = modes.indexOf(fireModeRef.current);
            const next = modes[(i + 1) % modes.length];
            setFireModeForActiveWeapon(next);
          }
        }

        if (
          !frozen &&
          !rebindActionRef.current &&
          !settingsOpenRef.current &&
          !controlsOpenRef.current &&
          !weaponSwap.isBusy()
        ) {
          const slotPick = getPrimaryWeaponIdFromSlotInput(input);
          const swapToggle =
            wasBindingPressed(input, bindingsRef.current, "swapWeapon") ||
            wasPrimarySwapPressed(input);
          const nextId =
            slotPick ??
            (swapToggle ? getOtherPrimaryWeaponId(activePrimaryId) : null);
          if (nextId && nextId !== activePrimaryId) {
            persistActiveAmmo();
            weaponSwap.requestSwap(nextId, activePrimaryId, primaryWeapons);
          }
        }

        if (
          !frozen &&
          !rebindActionRef.current &&
          !settingsOpenRef.current &&
          !controlsOpenRef.current
        ) {
          for (let slot = 1; slot <= 4; slot++) {
            if (
              input.wasPressed(`Digit${slot}`) ||
              input.wasPressed(`Numpad${slot}`)
            ) {
              setSelectedWeaponSlot(slot);
              break;
            }
          }
        }

        // Grenade / flashbang: hold G to preview, release to throw
        const activeSlot = selectedWeaponSlotRef.current;
        const throwingGrenade = activeSlot === GRENADE_WEAPON_SLOT;
        const throwingFlashbang = activeSlot === FLASHBANG_WEAPON_SLOT;
        const canThrowSecondary =
          (throwingGrenade && grenadeCountRef.current > 0) ||
          (throwingFlashbang && flashbangCountRef.current > 0);
        const gDown = isBindingDown(input, bindingsRef.current, "grenade");
        if (gDown && !grenadeHeld && !frozen && canThrowSecondary) {
          grenadeHeld = true;
        }
        if (grenadeHeld && gDown && !frozen && canThrowSecondary) {
          updateTrajectoryPreview(
            scene,
            camera,
            level.floorY,
            allColliders,
            level.bounds,
            groundSupportFromLevel(level, 0.05)
          );
        } else if (gDown && !canThrowSecondary) {
          hideTrajectoryPreview();
        }
        if (grenadeHeld && !gDown) {
          grenadeHeld = false;
          hideTrajectoryPreview();
          if (!frozen && canThrowSecondary) {
            if (throwingGrenade) {
              grenadeCountRef.current--;
              setGrenadeCount(grenadeCountRef.current);
            } else if (throwingFlashbang) {
              flashbangCountRef.current--;
              setFlashbangCount(flashbangCountRef.current);
            }
            const g = spawnGrenade(
              scene,
              camera,
              level.floorY,
              allColliders,
              level.bounds,
              level.floorHoles ?? [],
              groundSupportFromLevel(level, 0.05),
              throwingFlashbang ? PROJECTILE_FLASHBANG : undefined
            );
            grenades.push(g);
            sounds.playGrenadeWhoosh({ volume: 0.8 });
          }
        }

        const dnTarget = dayNightTargetNightnessRef.current;
        let dnCur = dayNightCurNightnessRef.current;
        if (dnCur !== dnTarget) {
          const dnStep = dt / DAY_NIGHT_FADE_DURATION;
          dnCur =
            dnTarget > dnCur
              ? Math.min(dnTarget, dnCur + dnStep)
              : Math.max(dnTarget, dnCur - dnStep);
          dayNightCurNightnessRef.current = dnCur;
          applyDayNightRef.current?.(dnCur);
        }
        const hudRoot = gameRootRef.current;
        if (hudRoot) {
          hudRoot.style.setProperty(
            "--hud-night-grayscale",
            String(dayNightCurNightnessRef.current)
          );
        }

        if (
          DAY_NIGHT_DEMO_CYCLE_ENABLED &&
          !frozen &&
          !settingsOpenRef.current &&
          !controlsOpenRef.current
        ) {
          dayNightDemoCycleElapsedRef.current += dt;
          if (dayNightDemoCycleElapsedRef.current >= DAY_NIGHT_DEMO_CYCLE_SEC) {
            dayNightDemoCycleElapsedRef.current = 0;
            dayNightToggleRef.current?.(!sunIsDayRef.current, {
              persist: false,
            });
          }
        }

        refreshGameplayHintHudRef.current();

        refreshLiveTargets();
        if (
          !frozen &&
          locked &&
          !settingsOpenRef.current &&
          !controlsOpenRef.current &&
          player
        ) {
          updateKillPredictiveCache({
            playerX: player.getX(),
            playerZ: player.getZ(),
            camera,
            liveTargets: liveTargetsScratch,
            levelHitMeshes,
            raycaster: hitRaycaster,
            scene,
            allColliders,
            containers: vx27ContainersRef.current,
            dt,
          });
        }
        updateBloodSplatters(bloodSplatters, dt, scene);
        scorePopupLayer?.update(camera, dt);
        updateBulletHoles(dt);

        updateGrenades(
          grenades,
          dt,
          scene,
          getLiveTargets,
          applyGrenadeHit,
          (mesh, blastDir, opts) => {
            playTargetDeathSound(mesh, opts?.hitPoint, opts?.hitZone);
            startDeathAnimation(mesh, blastDir, opts);
          },
          {
            scene,
            colliders: allColliders,
            floorY: level.floorY,
            bounds: level.bounds,
            floorHoles: level.floorHoles ?? [],
            groundSupport: groundSupportFromLevel(level, 0.05),
            simTime,
            hitMeshes: levelHitMeshes,
            onBloodSplatter: (splatter) => {
              if (splatter) bloodSplatters.push(splatter);
            },
            onFloorHit: (pos, impact) => {
              sounds.playGrenadeFloorHit(scene, pos, { impact });
            },
            onExplode: (pos, isFlashbang) => {
              sounds.playGrenadeExplosion(scene, pos);
              triggerScreenShake(camera.position, pos);
              if (isFlashbang) return;
              const distToPlayer = camera.position.distanceTo(pos);
              if (distToPlayer >= getGrenadeParams().blastRadius) return;
              _flashBlindPos.copy(pos);
              _flashBlindPos.y += 0.35;
              if (
                !hasLineOfSightToPoint(
                  _flashBlindPos,
                  camera.position,
                  levelHitMeshes,
                  { blockEpsilon: 0.35 }
                )
              ) {
                return;
              }
              const newHp = Math.max(0, playerHealthRef.current - 60);
              playerHealthRef.current = newHp;
              setPlayerHealth(newHp);
              triggerPlayerHurtFeedback(hurtVignetteFlashEndRef, sounds);
              if (newHp <= 0) grenadeSuicideRef.current = true;
            },
            countdownDuration: sounds.getGrenadeCountdownDuration(),
            onCountdown: (pos, playbackRate) => {
              sounds.playGrenadeCountdown(scene, pos, { playbackRate });
            },
            canFlashbangBlindPlayer,
            onPlayerBlinded: () => {
              flashbangBlindStartRef.current = performance.now();
            },
            onTargetBlinded: (mesh, time) => {
              blindTargetFromFlashbang(mesh, time);
            },
            viewerPos: camera.position,
          }
        );
        applyScreenShake(camera, dt);
        updateFlashbangBlindVisuals(level.targets, simTime);
        updateFlashbangOverlay(
          flashbangOverlayRef.current,
          flashbangBlindStartRef.current
        );
        if (flashbangBlindStartRef.current) {
          const blindElapsed =
            (performance.now() - flashbangBlindStartRef.current) / 1000;
          if (blindElapsed >= getFlashbangBlindDurationSec()) {
            flashbangBlindStartRef.current = 0;
          }
        }

        // Health auto-regen: 1 HP every 10 seconds while below 100
        if (playerHealthRef.current > 0 && playerHealthRef.current < 100) {
          healthRegenTimer += dt;
          if (healthRegenTimer >= HEALTH_REGEN_INTERVAL) {
            healthRegenTimer -= HEALTH_REGEN_INTERVAL;
            const newHp = Math.min(100, playerHealthRef.current + HEALTH_REGEN_AMOUNT);
            playerHealthRef.current = newHp;
            setPlayerHealth(newHp);
          }
          radioactiveOverflowDecayTimer = 0;
        } else if (playerHealthRef.current > 100) {
          healthRegenTimer = 0;
          radioactiveOverflowDecayTimer += dt;
          if (radioactiveOverflowDecayTimer >= RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC) {
            radioactiveOverflowDecayTimer -= RADIOACTIVE_OVERFLOW_DECAY_INTERVAL_SEC;
            const newHp = Math.max(
              100,
              playerHealthRef.current - RADIOACTIVE_OVERFLOW_DECAY_PCT
            );
            if (newHp !== playerHealthRef.current) {
              playerHealthRef.current = newHp;
              player.syncStaminaMaxFromHp();
              setPlayerHealth(newHp);
            }
          }
        } else {
          healthRegenTimer = 0;
          radioactiveOverflowDecayTimer = 0;
        }

        updateTargetsRepair(level.targets, dt);
        updateLiveTargetsFloorHoles(
          level.targets,
          dt,
          level.floorY,
          level.floorHoles ?? [],
          (mesh) => {
            deactivateTarget(mesh);
            scheduleRespawn(mesh);
          },
          (mesh, position) => {
            playTargetHoleFallSound(mesh, position);
          },
        );
        if (showHudRef.current) {
          updateTargetHealthBars(level.targets, dt, camera);
        }
        updateDeathAnimations(level.targets, dt, (mesh) => {
          deactivateTarget(mesh);
          scheduleRespawn(mesh);
        }, {
          colliders: allColliders,
          floorY: level.floorY,
          bounds: level.bounds,
          floorHoles: level.floorHoles ?? [],
          onBodyFloorHit: (pos, impact) => {
            sounds.playBodyFloorHit(scene, pos, { impact });
          },
          onHoleFall: (mesh, position) => {
            playTargetHoleFallSound(mesh, position);
          },
        });


        updateHpOrbs(
          hpOrbs, dt, camera.position,
          (value) => {
            playerHealthRef.current += value;
            player.syncStaminaMaxFromHp();
            pickupFlashLayerRef.current?.show("hp");
            sounds.playHpPickup();
            scheduleGameplayHudSyncRef.current();
          },
          allColliders,
          level.bounds,
          level.floorHoles ?? [],
        );

        updateAmmoDrops(
          ammoDrops, dt, camera.position,
          (value, drop) => {
            if (drop?.compassMarkerId) {
              hideCompassCollectibleMarker(collectibleEntries, drop.compassMarkerId);
            }
            roundsInMagRef.current += value;
            persistActiveAmmo();
            pickupFlashLayerRef.current?.show("ammo");
            sounds.playSupplyPickup();
            scheduleGameplayHudSyncRef.current();
          },
          allColliders,
          level.bounds,
          level.floorHoles ?? [],
        );

        updateLevelCollectibles(
          collectibleEntries,
          dt,
          player.getX(),
          player.getFootY(),
          player.getZ(),
          (value, drop, entry) => {
            if (drop?.compassMarkerId) {
              hideCompassCollectibleMarker(collectibleEntries, drop.compassMarkerId);
            }
            const kind = entry?.type ?? drop?.rewardType ?? "ammo";
            if (kind === "hp") {
              playerHealthRef.current = Math.min(
                100,
                playerHealthRef.current + (value ?? 10)
              );
              setPlayerHealth(playerHealthRef.current);
              pickupFlashLayerRef.current?.show("hp");
              sounds.playHpPickup();
            } else if (kind === "grenade") {
              grenadeCountRef.current += value ?? 1;
              setGrenadeCount(grenadeCountRef.current);
              pickupFlashLayerRef.current?.show("grenade");
              sounds.playSupplyPickup();
            } else if (kind === "flashbang") {
              flashbangCountRef.current += value ?? 1;
              setFlashbangCount(flashbangCountRef.current);
              pickupFlashLayerRef.current?.show("grenade");
              sounds.playSupplyPickup();
            } else if (kind === "score") {
              const credits = value ?? SCORE_PACK_DEFAULT_VALUE;
              playerScoreRef.current += credits;
              updateScoreHud(scoreHudRef.current, playerScoreRef.current);
              pickupFlashLayerRef.current?.show({
                type: "score",
                label: `+ ${credits} CREDITS`,
              });
              sounds.playSupplyPickup();
            } else {
              roundsInMagRef.current += value ?? 10;
              persistActiveAmmo();
              pickupFlashLayerRef.current?.show("ammo");
              sounds.playSupplyPickup();
            }
            scheduleGameplayHudSyncRef.current();
          },
          {
            testRespawn: LEVEL_COLLECTIBLE_TEST_RESPAWN,
            scene: level.pickupsGroup ?? scene,
            arena,
            catwalkDeckY: level.catwalkDeckY,
            compassContainer: compassMarkersRef.current,
          }
        );

        updateGrenadeDrops(
          grenadeDrops,
          dt,
          camera.position,
          (value) => {
            grenadeCountRef.current += value;
            pickupFlashLayerRef.current?.show("grenade");
            sounds.playSupplyPickup();
            scheduleGameplayHudSyncRef.current();
          },
          allColliders,
          level.bounds,
          level.floorHoles ?? []
        );

        if (!frozen) {
          missionTimeRef.current += dt;
          if (showHudRef.current) {
            const secs = Math.floor(missionTimeRef.current);
            if (secs !== Math.floor(missionTimeRef.current - dt)) {
              updateMissionTimerHud(missionTimerHudRef.current, secs);
            }
          }
        }
        let aliveCount = 0;
        for (const t of level.targets) {
          if (t.visible && t.userData.health > 0 && !t.userData.dying) aliveCount++;
        }
        if (aliveCount !== _lastHostileCount) {
          _lastHostileCount = aliveCount;
          hostileCountRef.current = aliveCount;
          if (showHudRef.current) {
            updateHostileCountHud(hostileCountHudRef.current, aliveCount);
          }
        }

        if (showHudRef.current) {
          updateDamageVignette(
            damageVignetteRef.current,
            playerHealthRef.current,
            loadDoneRef.current && !deathStateRef.current
          );
          updateHurtVignette(
            hurtVignetteRef.current,
            hurtVignetteFlashEndRef.current
          );
          updateWalkPowerHud(
            walkPowerRef.current,
            player.getStamina(),
            player.getStaminaMax(),
            playerHealthRef.current,
            loadDoneRef.current && !deathStateRef.current
          );
        }

        input.endFrame();
        sun.target.updateMatrixWorld();

        resetCameraRenderLayers(camera);
        const { visibleCount: visibleRoomCount } = updateRoomCulling(
          roomCullablesRef.current,
          camera,
          {
            x: player.getX(),
            z: player.getZ(),
            footY: player.getFootY(),
          },
          arenaHalf,
          attachWall,
          level.catwalkDeckY,
          level.doorwayOpenings ?? [],
          arena.wallThickness ?? 0.5
        );

        const playerVx27Container = resolveVx27ContainerForPlayer(
          player.getX(),
          player.getZ(),
          vx27ContainersRef.current,
          allColliders
        );
        const { anyVisible: inContainerPass } = updateVx27ContainerCulling(
          vx27ContainerCullablesRef.current,
          camera,
          playerVx27Container
        );
        updateVx27ContainerDoorAnimations(vx27ContainersRef.current, dt);
        let doorCollidersDirty = false;
        for (const doorGroup of vx27ContainersRef.current) {
          if (!consumeVx27DoorColliderDirty(doorGroup)) continue;
          doorCollidersDirty = true;
          syncVx27ContainerCollider(
            level.colliders,
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
        if (doorCollidersDirty) syncAllColliders();

        const interiorLevelFrame = isInteriorEnvironmentLevel(arenaLiveRef.current);
        const inRoomBody =
          interiorLevelFrame ||
          isIndoorLightingZone(
            player.getX(),
            player.getZ(),
            player.getFootY(),
            arena.rooms,
            arenaHalf,
            attachWall,
            level.catwalkDeckY,
            level.doorwayOpenings ?? [],
            arena.wallThickness ?? 0.5,
            arena.floorExtensions ?? []
          );
        // Room pass follows camera frustum (+ body-in-room). Viewmodel lighting follows
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
                x: player.getX(),
                z: player.getZ(),
                footY: player.getFootY(),
                rooms: arena.rooms,
                arenaHalf,
                attachWall,
                arenaWallThickness: arena.wallThickness ?? 0.5,
                catwalkDeckY: level.catwalkDeckY,
                colliders: allColliders,
              });
        syncLightLayersForZone(
          scene,
          viewmodelLightingZone,
          outdoorLights,
          roomLightsRef.current
        );
        syncOilBarrelFireLightLayers(
          oilBarrelFireLightsRef.current,
          isEnclosedViewmodelZone(viewmodelLightingZone)
        );

        const rainOccluders =
          rain?.occluders ??
          buildRainOccluderSlabs(
            level.groundSurfaces,
            level.catwalkDeckY,
            level.ceilingColliders.filter((c) => c.kind === "deck"),
            level.stairColliders
          );
        const snowOccluders =
          snow?.occluders ??
          buildSnowOccluderSlabs(
            level.groundSurfaces,
            level.catwalkDeckY,
            level.ceilingColliders.filter((c) => c.kind === "deck"),
            level.stairColliders
          );

        const snowActive =
          snowEnabledRef.current && viewmodelLightingZone !== "container";

        updateRain(rain, camera, dt, {
          active:
            rainEnabledRef.current &&
            !snowEnabledRef.current &&
            viewmodelLightingZone !== "container",
          enclosed: inRoomBody,
          playerX: player.getX(),
          attachWall,
          arenaHalf,
          wallThickness: arena.wallThickness ?? 0.5,
          occluders: rainOccluders,
          intensity: rainIntensityRef.current,
          floorY: arena.floorY ?? 0,
        });

        updateSnow(snow, camera, dt, now * 0.001, {
          active: snowActive,
          enclosed: inRoomBody,
          allowSettle: snowActive && !inRoomBody,
          intensity: snowIntensityRef.current,
          stickRate: snowStickRateRef.current,
          playerX: player.getX(),
          attachWall,
          arenaHalf,
          wallThickness: arena.wallThickness ?? 0.5,
          occluders: snowOccluders,
          floorY: arena.floorY ?? 0,
        });

        const barrelFireShadowCount = updateOilBarrelFireShadowBudget(
          oilBarrelRuntimeIndex.fireLights,
          camera.position,
          oilBarrelTuningRef.current
        );
        applyFrameShadowUpdates(renderer, {
          sunCastsShadow:
            (sunRef.current?.castShadow && sunRef.current.intensity > 0.001) ||
            false,
          moonCastsShadow:
            (moonRef.current?.castShadow && moonRef.current.intensity > 0.001) ||
            false,
          dayNightAnimating:
            dayNightCurNightnessRef.current !==
            dayNightTargetNightnessRef.current,
          flashlightShadow: weapon?.isFlashlightCastingShadow?.() ?? false,
          barrelFireShadowCount,
        });

        sky?.update(camera);
        renderSceneWithLayeredLighting(renderer, scene, camera, {
          skyRoot: sky?.mesh ?? null,
          skipRoomPass: !inRoomPass,
        });
        if (
          level?.targets &&
          showHudRef.current &&
          hasVisibleTargetHealthBars(level.targets)
        ) {
          renderTargetHealthBarsPass(renderer, scene, camera, level.targets);
        }
        renderCrosshairPass(renderer, scene, camera);
        renderViewmodelPass(renderer, scene, camera);
        } catch (err) {
          if (!disposed) console.error("Frame render failed:", err);
        }
        if (!disposed && gameReady) {
          rafId = requestAnimationFrame(animate);
        }
      }

      onCanvasClick = (e) => {
        if (e.target !== canvas) return;
        sounds.resume();
        if (loadDoneRef.current && musicEnabledRef.current) {
          sounds.startLevelMusic({ trackId: levelMusicTrackIdRef.current });
        }
        const ds = deathStateRef.current;
        if (ds && !ds.respawned && performance.now() >= ds.minDisplayEnd) {
          player.respawn();
          weapon?.replayRaise?.();
          ds.respawned = true;
          ds.fadeEndTime = performance.now() + DEATH_FADE_MS;
          playerHealthRef.current = 100;
          setPlayerHealth(100);
          flashbangBlindStartRef.current = 0;
          updateFlashbangOverlay(flashbangOverlayRef.current, 0);
          beginDeathOverlayFade(deathOverlayRef.current);
        }
        if (!consoleHackOpenRef.current) {
          safeRequestPointerLock(canvas);
        }
      };
      onPointerLockChange = () => syncPointerLocked();
      onKeyDown = (e) => {
        if (e.code === "Escape") {
          if (settingsOpenRef.current) {
            setSettingsOpen(false);
          } else if (controlsOpenRef.current) {
            setControlsOpen(false);
          } else if (consoleHackOpenRef.current) {
            closeConsoleHackRef.current();
          } else {
            safeExitPointerLock();
          }
        }
      };
      onResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(effectivePixelRatio(renderScaleRef.current));
        renderer.setSize(w, h);
      };

      canvas.addEventListener("click", onCanvasClick);
      document.addEventListener("pointerlockchange", onPointerLockChange);
      document.addEventListener("pointerlockerror", onPointerLockChange);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("resize", onResize);
      if (!isActive()) {
        if (level?.group) disposeLevelGroup(level.group);
        resetArenaCeilingDayNightCache();
        levelTextures?.dispose();
        return;
      }
      if (level?.group && !level.group.parent) {
        scene.add(level.group);
      }
      if (shouldLoadSky(arena)) {
        reportLoad(85, "Sky dome textures");
        try {
          const loaded = await createSkyDome(scene, { renderer });
          if (!isActive()) {
            loaded.dispose();
            return;
          }
          sky = loaded;
          skyRef.current = loaded;
          loaded.update(camera);
          applyDayNightAtmosphere(
            scene,
            renderer,
            loaded,
            sunIsDayRef.current
          );
          // Sky was loaded after the first applyDayNightRef pass, so the sun
          // and moon discs are still at the origin / fully transparent. Re-run
          // the applier with the current nightness so they snap into place.
          applyDayNightRef.current?.(dayNightCurNightnessRef.current);
        } catch (err) {
          console.error("Sky dome failed to load:", err);
        }
        if (!isActive()) return;
        reportLoad(88, "Sky dome");
      } else {
        reportLoad(88, "Interior environment");
      }

      await weaponPromise;
      if (!isActive()) return;
      reportLoad(96, "View weapon");

      await sfxPromise;
      if (!isActive()) return;
      reportLoad(97, "Sound effects");

      reportLoad(98, getGpuPreloadLoadLabel());
      const spawnFootY = player.getFootY();
      const spawnEyeY = player.getY();
      const getShadowFrameOpts = () => {
        const barrelFireShadowCount = updateOilBarrelFireShadowBudget(
          oilBarrelRuntimeIndex.fireLights,
          camera.position,
          oilBarrelTuningRef.current
        );
        return {
          sunCastsShadow:
            sunRef.current?.castShadow && sunRef.current.intensity > 0.001,
          moonCastsShadow:
            moonRef.current?.castShadow && moonRef.current.intensity > 0.001,
          dayNightAnimating: false,
          flashlightShadow: weapon?.isFlashlightCastingShadow?.() ?? false,
          barrelFireShadowCount,
        };
      };
      await preloadGameGpu({
        renderer,
        scene,
        camera,
        level,
        weapon,
        sky,
        floorY: level.floorY,
        outdoorLights,
        roomLights: roomLightsRef.current,
        oilBarrelFireLights: oilBarrelFireLightsRef.current,
        doorwayOpenings: level.doorwayOpenings ?? [],
        catwalkDeckY: level.catwalkDeckY,
        stairPlacement: stairParamsRef.current,
        arenaHalf,
        attachWall,
        arenaRooms: arena.rooms ?? [],
        floorExtensions: arena.floorExtensions ?? [],
        roomCullables: roomCullablesRef.current,
        vx27ContainerCullables: vx27ContainerCullablesRef.current,
        wallThickness: arena.wallThickness ?? 0.5,
        spawnX: player.getX(),
        spawnEyeY,
        spawnZ: player.getZ(),
        spawnFootY,
        spawnYaw: player.getYaw?.() ?? 0,
        primeDirectionalShadow: () => {
          if (sunIsDayRef.current) refitSunShadowRef.current?.();
          else refitMoonShadowRef.current?.();
        },
        getShadowFrameOpts,
        applyDayNightNightness: (nightness) => {
          applyDayNightRef.current?.(nightness);
        },
        initialDayNightNightness: dayNightCurNightnessRef.current,
        isActive,
      });
      applyDayNightRef.current?.(dayNightCurNightnessRef.current);
      if (!isActive()) return;
      refreshLevelPickupShadows(
        level.pickupsGroup ?? scene,
        collectibleEntries.map((e) => e.drop?.mesh),
        level.group
      );
      await settleGpuSpawnAfterLoad({
        renderer,
        scene,
        camera,
        level,
        weapon,
        sky,
        floorY: level.floorY,
        outdoorLights,
        roomLights: roomLightsRef.current,
        oilBarrelFireLights: oilBarrelFireLightsRef.current,
        doorwayOpenings: level.doorwayOpenings ?? [],
        catwalkDeckY: level.catwalkDeckY,
        arenaHalf,
        attachWall,
        arenaRooms: arena.rooms ?? [],
        floorExtensions: arena.floorExtensions ?? [],
        roomCullables: roomCullablesRef.current,
        vx27ContainerCullables: vx27ContainerCullablesRef.current,
        wallThickness: arena.wallThickness ?? 0.5,
        spawnX: player.getX(),
        spawnEyeY: player.getY(),
        spawnZ: player.getZ(),
        spawnFootY: player.getFootY(),
        spawnYaw: player.getYaw?.() ?? 0,
        getShadowFrameOpts,
        frames: level.vx27ContainerMeshes?.length ? 8 : 4,
        isActive,
      });
      reportLoad(99, GPU_PRELOAD_READY_LABEL);

      scorePopupContainer = document.createElement("div");
      scorePopupContainer.className = "killCalloutLayer";
      scorePopupContainer.setAttribute("aria-hidden", "true");
      gameRootRef.current?.appendChild(scorePopupContainer);
      scorePopupLayer = createScorePopupLayer(scorePopupContainer);

      gameReady = true;
      gameRootRef.current?.style.setProperty(
        "--hud-night-grayscale",
        String(dayNightCurNightnessRef.current)
      );
      reportLoad(100, "Ready");
      setAssetsReady(true);
      rafId = requestAnimationFrame(animate);
    }

    init().catch((err) => {
      if (
        disposed ||
        arenaAbort.signal.aborted ||
        isArenaLoadAbortError(err, arenaAbort.signal)
      ) {
        return;
      }
      const detail =
        err instanceof Error
          ? err.stack || err.message
          : typeof err === "object" && err !== null
            ? JSON.stringify(err)
            : String(err);
      console.error("Game init failed:", detail || err, err);
    });

    return () => {
      disposed = true;
      gameReady = false;
      resetKillPredictiveCache();
      resetGameGpuPreload();
      arenaAbort.abort();
      weaponLoadId += 1;
      cancelAnimationFrame(rafId);
      if (flashTimeout) clearTimeout(flashTimeout);
      if (onKeyDown) {
        canvas.removeEventListener("click", onCanvasClick);
        document.removeEventListener("pointerlockchange", onPointerLockChange);
        document.removeEventListener("pointerlockerror", onPointerLockChange);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("resize", onResize);
      }
      const targets = level?.targets;
      if (level?.group) {
        disposeLevelGroup(level.group);
        resetArenaCeilingDayNightCache();
        resetLightingZoneCache();
        level = null;
      }
      if (targets) {
        disposeAllTargetHealthBars(targets);
      }
      disposeAllHpOrbs(hpOrbs);
      disposeCompassCollectibleMarkers(collectibleEntries);
      disposeAllAmmoDrops(ammoDrops);
      disposeAllGrenades(grenades, scene);
      disposeAllGrenadeDrops(grenadeDrops);
      disposeAllBloodSplatters(bloodSplatters, scene);
      scorePopupLayer?.dispose();
      scorePopupLayer = null;
      scorePopupContainer?.remove();
      scorePopupContainer = null;
      disposeAllBulletHoles();
      disposePreview();
      setHealthBarOccluders(null);
      setSunOcclusionRoot(null);
      levelTextures?.dispose();
      levelTextures = null;
      primaryWeapons.rifle?.dispose();
      primaryWeapons.pistol?.dispose();
      primaryWeapons.rifle = null;
      primaryWeapons.pistol = null;
      weapon = null;
      weaponRef.current = null;
      screenCrosshairRef.current?.dispose();
      screenCrosshairRef.current = null;
      soundsRef.current?.dispose();
      soundsRef.current = null;
      respawnCallbackRef.current = null;
      hemiRef.current = null;
      inputRef.current = null;
      input?.dispose();
      sky?.dispose();
      skyRef.current = null;
      disposeRain(rain);
      rain = null;
      disposeSnow(snow);
      snow = null;
      snowRef.current = null;
      resetViewmodelInteriorAmbient();
      resetRoomInteriorAmbient();
      renderer.dispose();
      rendererRef.current = null;
      resetArenaCeilingDayNightCache();
      safeExitPointerLock();
    };
  }, [selectedLevel]);

  const handleLoadingLevelSelect = useCallback(
    (levelNumber) => {
      if (loadDoneRef.current || !isPlayableLevel(levelNumber)) return;
      if (levelNumber === selectedLevel) return;
      saveSelectedLevel(levelNumber);
      setSelectedLevel(levelNumber);
      setAssetsReady(false);
      setLoadProgress(0);
      setLoadAssetLabel("Switching level…");
    },
    [selectedLevel]
  );

  const handleDayNightChange = (isDay, { persist = true } = {}) => {
    if (!DAY_NIGHT_SWITCHER_ENABLED) return;
    if (!shouldAutoDayNight(arenaLiveRef.current)) return;
    const wasDay = sunIsDayRef.current;
    if (wasDay !== isDay) {
      dismissGameplayHint(
        gameplayHintsDismissedRef.current,
        wasDay ? "dayNight-night" : "dayNight-day",
      );
      if (
        !isDay &&
        !flashlightOnRef.current &&
        !gameplayHintsDismissedRef.current.has("flashlight")
      ) {
        pulseGameplayHint(
          gameplayHintRuntimeRef.current,
          hintMessageForId(bindingsRef.current, "flashlight"),
          performance.now(),
        );
      }
      gameplayHintRuntimeRef.current.lastIsDay = isDay;
    }
    setSunIsDay(isDay);
    sunIsDayRef.current = isDay;
    if (persist) saveSunDayMode(isDay);
    dayNightDemoCycleElapsedRef.current = 0;
    // Setting the target lets the animate loop ease toward it; pre-fit the
    // destination shadow caster so it's ready when its intensity rises.
    dayNightTargetNightnessRef.current = isDay ? 0 : 1;
    if (isDay) refitSunShadowRef.current?.();
    else refitMoonShadowRef.current?.();
    refreshGameplayHintHudRef.current();
  };
  // Keep the ref pointing at the current closure so the animate loop and
  // any keypress handler can always call the latest version (without
  // having to be re-declared inside the init effect).
  dayNightToggleRef.current = handleDayNightChange;

  const weaponSlotLayoutStyle = {
    "--grenade-frame-w": `${grenFrameWidthRem}rem`,
    "--grenade-frame-scale": String(grenFrameScale),
    "--grenade-key-x": `${grenHudKeyX}px`,
    "--grenade-key-y": `${grenHudKeyY}px`,
    "--grenade-key-scale": String(grenHudKeyScale),
    "--grenade-icon-x": `${grenHudIconX}px`,
    "--grenade-icon-y": `${grenHudIconY}px`,
    "--grenade-icon-scale": String(grenHudIconScale),
    "--grenade-label-x": `${grenHudLabelX}px`,
    "--grenade-label-y": `${grenHudLabelY}px`,
    "--grenade-label-scale": String(grenHudLabelScale),
    "--grenade-count-x": `${grenHudCountX}px`,
    "--grenade-count-y": `${grenHudCountY}px`,
    "--grenade-count-scale": String(grenHudCountScale),
  };

  const handleMusicEnabledChange = (checked) => {
    setMusicEnabled(checked);
    musicEnabledRef.current = checked;
    localStorage.setItem(MUSIC_ENABLED_KEY, String(checked));
    const s = soundsRef.current;
    if (!s) return;
    if (!checked) {
      s.stopLoadingMusic();
      s.stopLevelMusic();
      s.stopHackMusic?.();
    } else if (loadDoneRef.current) {
      s.resume();
      s.startLevelMusic({ trackId: levelMusicTrackIdRef.current });
    } else if (!loadDoneRef.current) {
      s.resume();
      s.startLoadingMusic({ trackId: loadingMusicTrackIdRef.current });
    }
  };

  const handleStartGame = () => {
    if (loadDone || !assetsReady) return;
    gameSessionStarted = true;
    loadDoneRef.current = true;
    beginShadowStartupWindow();
    soundsRef.current?.resume();
    setLoadDone(true);
    if (!touchControlsActive) {
      safeRequestPointerLock(canvasRef.current);
    }
  };

  return (
    <div
      ref={gameRootRef}
      className={`gameRoot${showHud ? "" : " gameHudHidden"}${touchControlsActive ? " gameRoot--touch" : ""}`}
    >
      <div
        className={`loadingOverlay${loadDone ? " loadingDone" : ""}`}
        onClick={() => {
          if (loadDone || assetsReady) return;
          const s = soundsRef.current;
          if (!s) return;
          s.resume();
          if (musicEnabledRef.current && !loadDoneRef.current) {
            s.startLoadingMusic({ trackId: loadingMusicTrackIdRef.current });
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="loadingHeroStack">
          <img src="/ui/logo.png" alt="VX-27" className="loadingLogo" />
        </div>
        {!loadDone ? (
          <div
            className="loadingLevelSelect"
            role="group"
            aria-label="Select level"
            onClick={(e) => e.stopPropagation()}
          >
            {LEVEL_SELECT_OPTIONS.map(({ number, label }) => (
              <button
                key={number}
                type="button"
                className={`loadingLevelBtn${selectedLevel === number ? " active" : ""}`}
                aria-pressed={selectedLevel === number}
                disabled={selectedLevel === number}
                onClick={() => handleLoadingLevelSelect(number)}
              >
                <span className="loadingLevelBtnNum">Level {number}</span>
                <span className="loadingLevelBtnLabel">{label}</span>
              </button>
            ))}
          </div>
        ) : null}
        {assetsReady ? (
          <button
            type="button"
            className="loadingStartBtn"
            onClick={(e) => {
              e.stopPropagation();
              handleStartGame();
            }}
          >
            Start Game
          </button>
        ) : (
          <>
            <div className="loadingBarTrack">
              <div className="loadingBarFill" style={{ width: `${loadProgress}%` }} />
            </div>
            <div className="loadingAssetLabel">{loadAssetLabel}</div>
          </>
        )}
        {!loadDone ? (
          <div className="loadingTopRight">
            <LoadingAudioViz
              className="loadingAudioBarCorner"
              musicEnabled={musicEnabled}
              onMusicEnabledChange={handleMusicEnabledChange}
              showVisualizer={false}
              active={!loadDone}
            />
            <Link
              href="/credits"
              className="loadingCreditsLink"
              onClick={(e) => e.stopPropagation()}
            >
              Credits
            </Link>
          </div>
        ) : null}
      </div>
      <canvas ref={canvasRef} className="gameCanvas" tabIndex={-1} />
      <TouchControls
        active={
          touchControlsActive &&
          loadDone &&
          !settingsOpen &&
          !controlsOpen &&
          !consoleHackOpen
        }
        inputRef={inputRef}
        showInteract={touchShowInteract}
        showHack={touchShowHack}
      />
      <ConsoleHackScreen
        open={consoleHackOpen}
        layout={consoleHackLayout}
        panelId={consoleHackPanelId}
        panelLabel={consoleHackPanelLabel}
        onClose={closeConsoleHack}
        hackKeyCode={bindings.hack}
        onHackDismiss={handleConsoleHackDismissed}
        onHackComplete={handleConsoleHackComplete}
        onHackFailed={handleConsoleHackFailed}
        sounds={consoleHackSounds}
      />
      <div
        ref={flashbangOverlayRef}
        className="flashbangOverlay"
        aria-hidden="true"
      />
      <div
        className="hudBottomBar"
        role="region"
        aria-label="Loadout HUD"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          "--hud-bar-scale": String(hudBottomBarTuning.barScale),
          "--hud-cog-x": `${hudBottomBarTuning.cogX}%`,
          "--hud-cog-y": `${hudBottomBarTuning.cogY}%`,
          "--hud-cog-size": `${hudBottomBarTuning.cogSize}%`,
          "--hud-rounds-x": `${hudBottomBarTuning.roundsX}%`,
          "--hud-rounds-y": `${hudBottomBarTuning.roundsY}%`,
          "--hud-mag-x": `${hudBottomBarTuning.magX}%`,
          "--hud-mag-y": `${hudBottomBarTuning.magY}%`,
          "--hud-mags-x": `${hudBottomBarTuning.magsX}%`,
          "--hud-mags-y": `${hudBottomBarTuning.magsY}%`,
          "--hud-value-font": `${hudBottomBarTuning.valueFont}vw`,
          "--hud-label-scale": String(hudBottomBarTuning.labelScale),
          "--hud-label-y": `${hudBottomBarTuning.labelY}px`,
          "--hud-fire-carousel-x": `${hudBottomBarTuning.fireCarouselX}%`,
          "--hud-fire-carousel-y": `${hudBottomBarTuning.fireCarouselY}%`,
          "--hud-fire-carousel-scale": String(hudBottomBarTuning.fireCarouselScale),
        }}
      >
        {/* Settings button — sits in the top-left decorative tab */}
        <button
          type="button"
          className="hudGearBtn"
          aria-label="Open settings"
          title="Settings"
          onClick={() => {
            safeExitPointerLock();
            setSettingsOpen(true);
          }}
        >
          <img src="/ui/settings.webp" alt="" className="hudGearImg" />
        </button>

        {/* Left section — ROUNDS */}
        <div className={`hudAmmoStat hudAmmoStatLeft${roundsInMag < activeLowAmmoThreshold || (roundsInMag === 0 && spareMags === 0) ? " hudAmmoLow" : ""}`}>
          <span className="hudAmmoLabel">ROUNDS</span>
          <span className={`hudAmmoValue${hudAmmoValueClass(roundsInMag)}`}>{String(roundsInMag).padStart(2, "0")}</span>
        </div>

        {/* Centre section — MAG */}
        <div className={`hudAmmoStat hudAmmoStatCenter${roundsInMag === 0 && spareMags === 0 ? " hudAmmoLow" : ""}`}>
          <span className="hudAmmoLabel">MAG</span>
          <span className={`hudAmmoValue${hudAmmoValueClass(activeMagazineSize)}`}>{String(activeMagazineSize).padStart(2, "0")}</span>
        </div>

        {/* Right section — MAGS */}
        <div className={`hudAmmoStat hudAmmoStatRight${roundsInMag === 0 && spareMags === 0 ? " hudAmmoLow" : ""}`}>
          <span className="hudAmmoLabel">MAGS</span>
          <span className={`hudAmmoValue${hudAmmoValueClass(spareMags)}`}>{String(spareMags).padStart(2, "0")}</span>
        </div>

        <HudFireModeCarousel
          modes={PRIMARY_WEAPONS[activePrimaryWeapon].fireModes}
          activeMode={fireMode}
          onCycle={cycleFireModeHud}
        />
      </div>

      {/* Stamina bar + score — top left */}
      <div className="hudStaminaCluster">
        <div
          ref={walkPowerRef}
          className="hudStaminaBar"
          role="status"
          aria-label="Sprint stamina"
          style={{
            "--sb-icon-x": `${hudBarLayout.hbLivesX}%`,
            "--sb-icon-y": `${hudBarLayout.hbLivesY}%`,
            "--sb-bar-x": `${hudBarLayout.sbBarX}%`,
            "--sb-bar-y": `${hudBarLayout.sbBarY}%`,
            "--sb-bar-w": `${hudBarLayout.sbBarW}%`,
            "--sb-bar-h": `${hudBarLayout.sbBarH}%`,
            "--hb-corner": `${hbCorner}px`,
          }}
        >
          <div className="hudStaminaIcon" aria-hidden="true">
            <img src="/ui/stamina-icon.webp" className="hudStaminaFist" alt="" />
          </div>
          <div className="hudStaminaTrack">
            <div
              className="hudWalkPowerFill"
              style={{
                width: "100%",
                "--orange-op": 0,
                "--red-op": 0,
                "--hb-corner": `${hbCorner}px`,
              }}
            >
              <div className="hudHealthLayer hudHealthBlue" />
              <div
                className="hudHealthLayer hudHealthOrange"
                style={{ opacity: "var(--orange-op)" }}
              />
              <div
                className="hudHealthLayer hudHealthRed"
                style={{ opacity: "var(--red-op)" }}
              />
              <div
                className="hudHealthLayer hudHealthFillRadioactive hudWalkPowerRadioactiveLayer"
                style={{ opacity: 0 }}
              />
            </div>
            <span className="hudHealthText hudHealthTextWhite hudStaminaTextWhite">100%</span>
            <span
              className="hudHealthText hudHealthTextBlack hudStaminaTextBlack"
              style={{ width: "100%" }}
            >
              100%
            </span>
          </div>
        </div>
      </div>

      <div className="hudScorePanel" role="status" aria-label="Combat score">
        <span className="hudScoreLabel">SCORE</span>
        <strong ref={scoreHudRef} className="hudScoreValue">0</strong>
      </div>

      {/* Compass — top centre, aligned with stamina / health bars */}
      <HudCompass
        tapeRef={compassTapeRef}
        viewportRef={compassViewportRef}
        markersRef={compassMarkersRef}
        blipsRef={compassBlipsRef}
      />

      {/* Health bar — top right */}
      <div
        className="hudHealthBar"
        role="status"
        aria-label="Player health"
        style={{
          "--hb-lives-x": `${hudBarLayout.hbLivesX}%`,
          "--hb-lives-y": `${hudBarLayout.hbLivesY}%`,
          "--hb-lives-size": `${hudBarLayout.hbLivesSize}vw`,
          "--hb-bar-x": `${hudBarLayout.hbBarX}%`,
          "--hb-bar-y": `${hudBarLayout.hbBarY}%`,
          "--hb-bar-w": `${hudBarLayout.hbBarW}%`,
          "--hb-bar-h": `${hudBarLayout.hbBarH}%`,
          "--hb-corner": `${hbCorner}px`,
        }}
      >
        <div className="hudHealthLives">
          <span className="hudHealthLivesValue">{String(playerLives).padStart(2, "0")}</span>
        </div>
        <div
          className={`hudHealthTrack${playerHealth <= 25 ? " hudHealthCritical" : ""}${playerHealth > 100 ? " hudHealthRadioactive" : ""}${playerHealth > 150 ? " hudHealthOverload" : ""}`}
          style={playerHealth > 150 ? {
            "--shake-speed": `${Math.max(0.15, 0.6 - (Math.min(playerHealth, 190) - 150) * 0.01125)}s`,
          } : undefined}
        >
          <div
            className="hudHealthFill"
            style={(() => {
              const hp = Math.min(playerHealth, 100);
              const pct = hp / 100;
              let orangeOp = 0, redOp = 0;
              if (hp <= 50) {
                orangeOp = 1;
              }
              if (hp <= 25) {
                redOp = 1;
              }
              return {
                width: `${hp}%`,
                "--orange-op": orangeOp,
                "--red-op": redOp,
              };
            })()}
          >
            <div className="hudHealthLayer hudHealthBlue" />
            <div className="hudHealthLayer hudHealthOrange" style={{ opacity: `var(--orange-op)` }} />
            <div className="hudHealthLayer hudHealthRed" style={{ opacity: `var(--red-op)` }} />
            <div
              className="hudHealthLayer hudHealthFillRadioactive"
              style={{ opacity: playerHealth > 100 ? 1 : 0 }}
            />
          </div>
          <span className="hudHealthText hudHealthTextWhite">{playerHealth} HP</span>
          <span className="hudHealthText hudHealthTextBlack" style={{ width: `${Math.min(playerHealth, 100)}%` }}>{playerHealth} HP</span>
        </div>
      </div>

      {/* Mission info — below health bar */}
      <div className="hudMissionInfo">
        <div className="hudMissionLevel">{levelMeta.name}</div>
        <div className="hudMissionObjective">
          OBJECTIVE: {levelMeta.objective ?? "HOLD ZONE"}
        </div>
        <div className="hudMissionStats">
          <span className="hudMissionStat">HOSTILES: <strong ref={hostileCountHudRef}>00</strong></span>
          <span className="hudMissionStat">TIMER: <strong ref={missionTimerHudRef}>00:00</strong></span>
        </div>
      </div>

      {/* Red vignette when low health — opacity set in game loop */}
      <div ref={damageVignetteRef} className="hudDamageVignette" aria-hidden="true" />

      {/* Brief hurt flash — death overlay art, open centre (game loop opacity) */}
      <div ref={hurtVignetteRef} className="hurtVignetteOverlay" aria-hidden="true" />

      {settingsOpen && (
        <div
          className="settingsBackdrop"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="settingsModal"
            role="dialog"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="settingsHeader">
              <h2 id="settings-title">Settings</h2>
              <button
                type="button"
                className="settingsClose"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="settingsBody">
            <SettingsSection title="Controls" defaultOpen>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Configure keyboard and mouse bindings.
              </p>
              <button
                type="button"
                className="settingsBtn settingsInlineBtn"
                onClick={() => {
                  setSettingsOpen(false);
                  setControlsOpen(true);
                }}
              >
                Open key bindings…
              </button>
            </SettingsSection>

            <SettingsSection title="Audio" defaultOpen>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={musicEnabled}
                  onChange={(e) => handleMusicEnabledChange(e.target.checked)}
                />
                Music
              </label>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Background music on the loading screen and in-game. Same
                setting as the loading-screen toggle.
              </p>
            </SettingsSection>

            {DAY_NIGHT_SWITCHER_ENABLED &&
              shouldAutoDayNight(arenaLiveRef.current) && (
              <SettingsSection title="Time of Day">
                <div
                  className="settingRow settingRowButtons"
                  role="group"
                  aria-label="Time of day"
                >
                  <button
                    type="button"
                    className={`settingsBtn settingsToggleBtn${sunIsDay ? " active" : ""}`}
                    aria-pressed={sunIsDay}
                    onClick={() => handleDayNightChange(true)}
                  >
                    ☀ Day
                  </button>
                  <button
                    type="button"
                    className={`settingsBtn settingsToggleBtn${!sunIsDay ? " active" : ""}`}
                    aria-pressed={!sunIsDay}
                    onClick={() => handleDayNightChange(false)}
                  >
                    ☾ Night
                  </button>
                </div>
                <p className="settingsHint">
                  Crossfades the sun and moon over {DAY_NIGHT_FADE_DURATION}{" "}
                  seconds. While playing, day and night auto-flip every 5 minutes.
                  You can also press the bound Day/Night key.
                </p>
              </SettingsSection>
            )}

            <SettingsSection title="General">
              {shouldLoadSky(arenaLiveRef.current) ? (
                <>
                  <label className="settingRow">
                    <input
                      type="checkbox"
                      checked={rainEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setRainEnabled(enabled);
                        rainEnabledRef.current = enabled;
                        saveRainEnabled(enabled);
                        if (enabled) {
                          setSnowEnabled(false);
                          snowEnabledRef.current = false;
                          saveSnowEnabled(false);
                          resetSnowSettled(snowRef.current);
                        }
                      }}
                    />
                    Rain
                  </label>
                  <label className="sliderRow">
                    <span className="sliderLabel">
                      Rain intensity{" "}
                      <output>{Math.round(rainIntensity * 100)}%</output>
                    </span>
                    <input
                      type="range"
                      min={MIN_RAIN_INTENSITY}
                      max={MAX_RAIN_INTENSITY}
                      step="0.05"
                      value={rainIntensity}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setRainIntensity(value);
                        rainIntensityRef.current = value;
                        saveRainIntensity(value);
                      }}
                    />
                  </label>
                  <label className="settingRow">
                    <input
                      type="checkbox"
                      checked={snowEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setSnowEnabled(enabled);
                        snowEnabledRef.current = enabled;
                        saveSnowEnabled(enabled);
                        if (enabled) {
                          setRainEnabled(false);
                          rainEnabledRef.current = false;
                          saveRainEnabled(false);
                        } else {
                          resetSnowSettled(snowRef.current);
                        }
                      }}
                    />
                    Snow
                  </label>
                  <label className="sliderRow">
                    <span className="sliderLabel">
                      Snow intensity{" "}
                      <output>{Math.round(snowIntensity * 100)}%</output>
                    </span>
                    <input
                      type="range"
                      min={MIN_SNOW_INTENSITY}
                      max={MAX_SNOW_INTENSITY}
                      step="0.05"
                      value={snowIntensity}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setSnowIntensity(value);
                        snowIntensityRef.current = value;
                        saveSnowIntensity(value);
                      }}
                    />
                  </label>
                  <label className="sliderRow">
                    <span className="sliderLabel">
                      Snow stick{" "}
                      <output>{Math.round(snowStickRate * 100)}%</output>
                    </span>
                    <input
                      type="range"
                      min={MIN_SNOW_STICK_RATE}
                      max={MAX_SNOW_STICK_RATE}
                      step="0.05"
                      value={snowStickRate}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setSnowStickRate(value);
                        snowStickRateRef.current = value;
                        saveSnowStickRate(value);
                      }}
                    />
                  </label>
                  <p className="settingsHint" style={{ marginTop: 0 }}>
                    Rain or snow outdoors (not both). Intensity runs from light
                    drizzle / flurry up to 500% storm. Snow stick (to 500%)
                    controls how much stays on catwalks, stairs, and the arena
                    floor — separate from how hard it falls. Off in containers.
                  </p>
                </>
              ) : null}
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={invertYLook}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setInvertYLook(checked);
                    invertYRef.current = checked;
                    localStorage.setItem(INVERT_Y_KEY, String(checked));
                  }}
                />
                Invert look (mouse & arrows)
              </label>
              <label className="sliderRow">
                <span className="sliderLabel">
                  Render scale{" "}
                  <output>{Math.round(renderScale * 100)}%</output>
                </span>
                <input
                  type="range"
                  min={MIN_RENDER_SCALE}
                  max={MAX_RENDER_SCALE}
                  step="0.05"
                  value={renderScale}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setRenderScale(value);
                    renderScaleRef.current = value;
                    localStorage.setItem(RENDER_SCALE_KEY, String(value));
                    const r = rendererRef.current;
                    if (r) {
                      r.setPixelRatio(effectivePixelRatio(value));
                      r.setSize(window.innerWidth, window.innerHeight);
                    }
                  }}
                />
              </label>
              <p className="settingsHint">
                Lowers internal rendering resolution. The single biggest
                framerate knob — fragment shader cost scales with pixel
                count. 100% = native; 50% = a quarter of the pixels.
              </p>
            </SettingsSection>

            <SettingsSection title="Gameplay">
              <label className="sliderRow">
                <span className="sliderLabel">
                  Ammo crate when spare mags ≤{" "}
                  <output>{ammoDropSpareThreshold}</output>
                </span>
                <input
                  type="range"
                  min={0}
                  max={AMMO_DROP_SPARE_THRESHOLD_MAX}
                  step={1}
                  value={ammoDropSpareThreshold}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    setAmmoDropSpareThreshold(value);
                    ammoDropSpareThresholdRef.current = value;
                    saveAmmoDropSpareThreshold(value);
                  }}
                />
              </label>
              <p className="settingsHint">
                Enemies drop an ammo crate on kill when your spare magazine
                count is at or below this value. Default 1 (drops when you have
                one or no spares left). Set to {AMMO_DROP_SPARE_THRESHOLD_MAX}{" "}
                to always drop.
              </p>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={oilBarrelTuning.interiorFire !== false}
                  onChange={(e) =>
                    onOilBarrelTuningChange("interiorFire", e.target.checked)
                  }
                />
                Oil barrel flames
              </label>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Interior fire video on open-top oil barrels. Saved with other
                oil-barrel tuning.
              </p>
            </SettingsSection>

            <SettingsSection title="Player">
              <label className="sliderRow">
                <span className="sliderLabel">
                  Eye height <output>{playerHeight.toFixed(2)}m</output>
                </span>
                <input
                  type="range"
                  min="1.0"
                  max="2.2"
                  step="0.05"
                  value={playerHeight}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setPlayerHeight(value);
                    playerHeightRef.current = value;
                    localStorage.setItem(PLAYER_HEIGHT_KEY, String(value));
                  }}
                />
              </label>
              <p className="settingsHint">
                Camera height when standing. Default 1.65m (≈ 5′9″ total).
              </p>
            </SettingsSection>

            <SettingsSection title="Keyboard">
              <label className="sliderRow">
                <span className="sliderLabel">
                  Keyboard look <output>{keyboardLook.toFixed(1)}×</output>
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={keyboardLook}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setKeyboardLook(value);
                    keyboardLookRef.current = value;
                    localStorage.setItem(KEYBOARD_LOOK_KEY, String(value));
                  }}
                />
              </label>
              <label className="sliderRow">
                <span className="sliderLabel">
                  Keyboard easing <output>{keyboardEase.toFixed(1)}</output>
                </span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={keyboardEase}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setKeyboardEase(value);
                    keyboardEaseRef.current = value;
                    localStorage.setItem(KEYBOARD_EASE_KEY, String(value));
                  }}
                />
              </label>
            </SettingsSection>

            <SettingsSection title="Mouse">
              <label className="sliderRow">
                <span className="sliderLabel">
                  Mouse look <output>{mouseLook.toFixed(1)}×</output>
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={mouseLook}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setMouseLook(value);
                    mouseLookRef.current = value;
                    localStorage.setItem(MOUSE_LOOK_KEY, String(value));
                  }}
                />
              </label>
              <label className="sliderRow">
                <span className="sliderLabel">
                  Mouse easing <output>{mouseEase.toFixed(1)}</output>
                </span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={mouseEase}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setMouseEase(value);
                    mouseEaseRef.current = value;
                    localStorage.setItem(MOUSE_EASE_KEY, String(value));
                  }}
                />
              </label>
            </SettingsSection>

            <SettingsSection title="Development">
              <p className="settingsGroupLabel">Level</p>
              <div className="sliderRow">
                <span className="sliderLabel">Arena config</span>
                <select
                  className="settingsSelect"
                  value={selectedLevel}
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10);
                    if (!AVAILABLE_LEVELS.includes(next)) return;
                    saveSelectedLevel(next);
                    if (loadDoneRef.current) {
                      window.location.reload();
                      return;
                    }
                    setSelectedLevel(next);
                    setAssetsReady(false);
                    setLoadProgress(0);
                    setLoadAssetLabel("Switching level…");
                  }}
                >
                  {AVAILABLE_LEVELS.map((n) => (
                    <option key={n} value={n}>
                      Level {n}
                    </option>
                  ))}
                </select>
              </div>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Also on the loading screen. In-game changes reload the page; on the
                loading screen the selected level re-warms without a full refresh.
              </p>
              <p className="settingsGroupLabel">Player position</p>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Live readout while settings are open. Stand at a spot and copy coordinates
                below. Toggle the gameplay HUD with <strong>I</strong>.
              </p>
              <div
                ref={playerCoordsMenuRef}
                className="settingsDevCoords"
                aria-live="polite"
              >
                X —  Z —  foot —
              </div>
              <button
                type="button"
                className="settingsBtn settingsInlineBtn"
                onClick={() => {
                  const json = playerCoordsMenuRef.current?.dataset.coords;
                  if (json) navigator.clipboard?.writeText(json);
                }}
              >
                Copy coordinates JSON
              </button>
              <p className="settingsGroupLabel">Ammo HUD</p>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={hudBottomBarTuneEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setHudBottomBarTuneEnabled(enabled);
                    saveHudBottomBarTuneEnabled(enabled);
                  }}
                />
                <span>Bottom bar layout tuning wizard</span>
              </label>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Live sliders for ROUNDS / MAG / MAGS and the fire-mode carousel on
                the ammo bar. Copy JSON when aligned.
              </p>
              <p className="settingsGroupLabel">VX-27 container</p>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={vx27ContainerCeilingLight}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setVx27ContainerCeilingLight(enabled);
                    vx27ContainerCeilingLightRef.current = enabled;
                    saveVx27ContainerCeilingLightEnabled(enabled);
                    setVx27ContainerCeilingLightEnabled(
                      vx27ContainersRef.current,
                      enabled
                    );
                  }}
                />
                Container ceiling light
              </label>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Static blue ceiling light inside VX-27 containers. Off for
                comparing sun leak on end caps and doors.
              </p>
            </SettingsSection>
            </div>
          </div>
        </div>
      )}
      {controlsOpen && (
        <ControlsPanel
          onClose={() => setControlsOpen(false)}
          onReleasePointer={safeExitPointerLock}
          bindings={bindings}
          onBindingsChange={(next) => {
            setBindings(next);
            bindingsRef.current = next;
          }}
          rebindAction={rebindAction}
          onRebindActionChange={setRebindAction}
        />
      )}
      {loadDone && (
        <button
          type="button"
          className="hudRestoreChip"
          onClick={() => {
            showHudRef.current = true;
            localStorage.setItem(SHOW_HUD_KEY, "true");
            gameRootRef.current?.classList.remove("gameHudHidden");
            if (settingsOpenRef.current) {
              setShowHud(true);
            }
          }}
        >
          Show HUD (I)
        </button>
      )}
      <PickupFlashLayer ref={pickupFlashLayerRef} />
      {hudBottomBarTuneEnabled ? (
        <HudBottomBarTunePanel
          tuning={hudBottomBarTuning}
          onChange={(next) => {
            setHudBottomBarTuning(next);
            saveHudBottomBarTuning(next);
          }}
        />
      ) : null}
      <HudPrimaryWeaponStack
        activePrimaryWeapon={activePrimaryWeapon}
        primaryAmmo={primaryAmmo}
        frameX={grenFrameX}
        frameY={grenFrameY}
        layoutStyle={weaponSlotLayoutStyle}
      />
      <WeaponSlotStack
        grenadeCount={grenadeCount}
        flashbangCount={flashbangCount}
        selectedWeaponSlot={selectedWeaponSlot}
        weaponStackTune={weaponStackTune}
        frameX={grenFrameX}
        frameY={grenFrameY}
        layoutStyle={weaponSlotLayoutStyle}
      />
      <div
        id="gameplayHint"
        ref={gameplayHintRef}
        className="gameplayHint"
        role="status"
        aria-live="polite"
        aria-hidden="true"
      />
      <div
        ref={doorInteractPromptRef}
        className="doorInteractPrompt"
        aria-hidden="true"
      />
      <div
        ref={consoleHackPromptRef}
        className="gameplayHint consoleHackPrompt"
        role="status"
        aria-live="polite"
        aria-hidden="true"
      />
      <div
        ref={deathOverlayRef}
        className="deathOverlay"
        role="alertdialog"
        aria-live="assertive"
        aria-hidden="true"
        onClick={() => {
          const ds = deathStateRef.current;
          if (ds && !ds.respawned && performance.now() >= ds.minDisplayEnd) {
            respawnCallbackRef.current?.();
            ds.respawned = true;
            ds.fadeEndTime = performance.now() + DEATH_FADE_MS;
            playerHealthRef.current = 100;
            setPlayerHealth(100);
            grenadeCountRef.current = getGrenadeParams().grenadeCount;
            setGrenadeCount(grenadeCountRef.current);
            flashbangBlindStartRef.current = 0;
            updateFlashbangOverlay(flashbangOverlayRef.current, 0);
            beginDeathOverlayFade(deathOverlayRef.current);
          }
          safeRequestPointerLock(canvasRef.current);
        }}
      >
        <div className="deathOverlayInner">
          <h1 className="deathOverlayTitle">YOU DIED</h1>
          <p
            ref={deathReasonRef}
            className="deathOverlayReason"
          />
          <p className="deathOverlayHint">Click to respawn</p>
        </div>
      </div>
    </div>
  );
}
