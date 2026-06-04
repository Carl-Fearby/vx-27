"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createLevelFromArena, disposeLevelGroup } from "@/lib/level/Level";
import {
  collectArenaTextureIds,
  getLevelMeta,
  isArenaLoadAbortError,
  loadArenaConfig,
} from "@/lib/level/loadArena";
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
  resolveViewmodelIndoorLightingZone,
} from "@/lib/rooms/RoomPlacement";
import { buildRoomCullables, updateRoomCulling } from "@/lib/rooms/RoomCulling";
import {
  initCandleFlicker,
  updateCandleFlicker,
} from "@/lib/lighting/CandleFlicker";
import { getArenaAttachWall } from "@/lib/rooms/DoorwayWall";
import { createInput } from "@/lib/player/Input";
import { createPlayerController } from "@/lib/player/PlayerController";
import {
  createSoundManager,
  DEFAULT_LEVEL_TRACK_ID,
  loadStoredLoadingTrackId,
} from "@/lib/audio/Sound";
import LoadingAudioViz from "@/components/LoadingAudioViz";
import PickupFlashLayer from "@/components/PickupFlashLayer";
import { initPickupPreviewEngine } from "@/lib/pickups/PickupPreviewEngine";
import { getLaserPalette, loadViewWeapon } from "@/lib/weapons/ViewWeapon";
import {
  spawnAmmoDrop, updateAmmoDrops,
  disposeAllAmmoDrops,
  preloadAmmoCrateAssets,
  refreshLevelPickupShadows,
} from "@/lib/pickups/AmmoCrate";
import {
  preloadOilBarrelAssets,
  ensureOilBarrelInteriorTextures,
  ensureOilBarrelInteriorVideo,
  setOilBarrelTuning as applyOilBarrelMaterialTuning,
  getOilBarrelTuning,
  OIL_BARREL_FIRE_PROXIMITY_DAMAGE,
  tickOilBarrelFireProximityDamage,
  tickOilBarrelInteriorVideo,
  buildOilBarrelRuntimeIndex,
  collectOilBarrelFireLights,
  ensureOilBarrelFlameMeshes,
  refreshOilBarrelRenderLayers,
} from "@/lib/oil-barrel/OilBarrel";
import { arenaHasVx27Containers, preloadVx27ContainerAssets, applyVx27ContainerDoorTuning, consumeVx27DoorColliderDirty, readVx27ContainerDoorTuning, readVx27ContainerEdgeRadius, readVx27ContainerExteriorCornerRadius, readVx27ContainerInteriorInsets, readVx27ContainerScale, rebuildVx27ContainerExterior, rebuildVx27ContainerInterior, rebuildVx27ContainerScale, refreshVx27ContainerRenderLayers, setVx27ContainerExteriorCornerRadius, setVx27ContainerMaterialTuning, updateVx27ContainerDoorAnimations } from "@/lib/vx27-container/Vx27Container";
import { updateVx27ContainerDoorWizard } from "@/lib/vx27-container/Vx27ContainerDoorWizard";
import {
  collectVx27DoorInteractMeshes,
  getVx27DoorInteractLabel,
  pickVx27DoorUnderCrosshair,
  toggleVx27ContainerDoorLeaf,
} from "@/lib/vx27-container/Vx27ContainerDoorInteract";
import { DEFAULT_VX27_CONTAINER_DOOR_TUNING } from "@/lib/vx27-container/Vx27ContainerDoorTuning";
import {
  DEFAULT_VX27_CONTAINER_MATERIAL_TUNING,
  loadVx27ContainerMaterialTuning,
  normalizeVx27ContainerMaterialTuning,
  saveVx27ContainerMaterialTuning,
} from "@/lib/vx27-container/Vx27ContainerMaterialTuning";
import {
  applyVx27ContainerPlacement,
  buildVx27ContainerPropJson,
  getVx27ContainerPlacementBounds,
  loadVx27ContainerInteriorInsets,
  loadVx27ContainerEdgeRadius,
  loadVx27ContainerExteriorCornerRadius,
  loadVx27ContainerTuneEnabled,
  readVx27ContainerPlacement,
  saveVx27ContainerEdgeRadius,
  saveVx27ContainerExteriorCornerRadius,
  saveVx27ContainerInteriorInsets,
  saveVx27ContainerTuneEnabled,
  syncVx27ContainerCollider,
  VX27_CONTAINER_TUNE_ENABLED_KEY,
} from "@/lib/vx27-container/Vx27ContainerTuning";
// Vx27 container tuning panel moved to components/tuning-panels
import {
  initOilBarrelFireLightFlicker,
  updateOilBarrelFireShadowBudget,
} from "@/lib/oil-barrel/OilBarrelFireLight";
import {
  DEFAULT_OIL_BARREL_TUNING,
  loadOilBarrelTuneEnabled,
  loadOilBarrelTuning,
  OIL_BARREL_TUNE_ENABLED_KEY,
  normalizeOilBarrelTuning,
  saveOilBarrelTuneEnabled,
  saveOilBarrelTuning,
} from "@/lib/oil-barrel/OilBarrelTuning";
// Oil barrel tuning panel moved to components/tuning-panels
import {
  isOilBarrelPileManagedProp,
  applyOilBarrelPileToArena,
  checkArenaOilBarrelPile,
  loadPileWizardPrefs,
  savePileWizardPrefs,
} from "@/lib/oil-barrel/OilBarrelPileLayout";
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
  setBulletHolesEnabled,
} from "@/lib/combat/BulletHoles";
import { hasLineOfSightToPoint } from "@/lib/combat/LineOfSight";
import {
  DEFAULT_ADS_POSE,
  DEFAULT_BODY_LOOK_DOWN_AMOUNT,
  DEFAULT_BODY_LOOK_UP_AMOUNT,
  DEFAULT_HIP_POSE,
  loadBodyLookDownAmount,
  loadBodyLookUpAmount,
  WEAPON_TUNE_ENABLED_KEY,
  loadWeaponTuning,
  saveWeaponTuneEnabled,
} from "@/lib/weapons/WeaponTuning";
import StairTunePanel from "@/components/tuning-panels/StairTunePanel";
import {
  shouldDropAmmoCrate,
  loadAmmoDropSpareThreshold,
  saveAmmoDropSpareThreshold,
  AMMO_DROP_SPARE_THRESHOLD_MAX,
  DEFAULT_AMMO_DROP_SPARE_THRESHOLD,
} from "@/lib/pickups/RewardDropSettings";
import HudCompass from "@/components/HudCompass";
import HudBarCompass from "@/components/HudBarCompass";
import { SettingsSection } from "@/components/SettingsSection";
import {
  DEFAULT_HEMI_DAY,
  DEFAULT_HEMI_NIGHT,
  applyHemisphereSettings,
  loadHemiDay,
  loadHemiNight,
  saveHemiDay,
  saveHemiNight,
} from "@/lib/lighting/HemisphereTuning";
import {
  getArenaCatwalkDeckY,
  getArenaFloorDeckY,
  loadStairTuning,
  saveStairTuning,
} from "@/lib/stairs/StairTuning";
import {
  applySunLightPosition,
  loadSunAngles,
  loadSunDayMode,
  saveSunAngles,
  saveSunDayMode,
  sunPositionFromAngles,
} from "@/lib/lighting/SunLightTuning";
import {
  applyMoonLightPosition,
  loadMoonAngles,
  loadMoonIntensity,
  moonPositionFromAngles,
  saveMoonAngles,
  saveMoonIntensity,
} from "@/lib/lighting/MoonLightTuning";
import {
  DEFAULT_WALK_BOB_SIMPLE,
  loadWalkBobTuneEnabled,
  loadWalkBobTuning,
  normalizeWalkBobSimple,
  resolveWalkBobTuning,
  saveWalkBobTuneEnabled,
  saveWalkBobTuning,
  WALK_BOB_TUNE_ENABLED_KEY,
} from "@/lib/player/WalkBobTuning";
import {
  DEFAULT_STAIR_WALK_TUNING,
  loadStairWalkTuneEnabled,
  loadStairWalkTuning,
  normalizeStairWalkTuning,
  saveStairWalkTuneEnabled,
  saveStairWalkTuning,
  STAIR_WALK_TUNE_ENABLED_KEY,
} from "@/lib/stairs/StairWalkTuning";
import {
  DEFAULT_HUD_BAR_TUNING,
  loadHudBarTuneEnabled,
  loadHudBarTuning,
  normalizeHudBarTuning,
  saveHudBarTuneEnabled,
  saveHudBarTuning,
  HUD_BAR_TUNE_ENABLED_KEY,
} from "@/lib/ui/HudBarTuning";
import ControlsPanel from "@/components/ControlsPanel";
import {
  DEV_TUNE_BOOT_KEY,
  isLocalDevHost,
  resolveDevTuneEnabled,
} from "@/lib/dev/DevTuneSession";
import {
  applyDevSceneVisibility,
  DEV_SHOW_BARRELS_KEY,
  DEV_SHOW_CONTAINERS_KEY,
  DEV_SHOW_ENEMIES_KEY,
  DEV_SHOW_LENS_FLARE_KEY,
  DEV_SHOW_PILLARS_KEY,
  DEV_SHOW_STAIRS_KEY,
  DEV_SHOW_SUN_DISC_KEY,
  DEV_DISABLE_HOLE_DECALS_KEY,
  loadDevSceneShow,
} from "@/lib/dev/DevSceneVisibility";
import {
  createFrameHitchProfiler,
  FRAME_HITCH_PROFILER_KEY,
  loadFrameHitchProfilerEnabled,
} from "@/lib/dev/FrameHitchProfiler";
import {
  areShadowsDisabled,
  applyShadowMapTypeToRenderer,
  disableAllShadows,
  enableRendererShadowPipeline,
  loadPlainShadowDepthEnabled,
  loadShadowMapType,
  loadShadowsDisabled,
  setPlainShadowDepthRuntime,
  setShadowMapTypeRuntime,
  setShadowsDisabledRuntime,
  SHADOW_MAP_TYPE_OPTIONS,
} from "@/lib/dev/ShadowDebug";
import {
  resetAndApplyShadowCastHygiene,
} from "@/lib/lighting/ShadowMaterialHygiene";
import {
  applyTextureOverride,
  areTexturesDisabled,
  loadTexturesDisabled,
  setTexturesDisabledRuntime,
} from "@/lib/dev/TextureDebug";
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

const _radarScratch = new Array(64);

const WEAPON_SLOT_IDS = [1, 2, 3, 4];
const GRENADE_WEAPON_SLOT = 1;
const FLASHBANG_WEAPON_SLOT = 2;
const DEFAULT_FLASHBANG_COUNT = 4;

/** HUD-only secondary weapons (gameplay not wired yet). */
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

/** Steps from selected slot forward in cyclic order 1→2→3→4→1. */
function getWeaponStackDepth(slotId, selectedSlot) {
  if (slotId === selectedSlot) return 0;
  let depth = 0;
  let current = selectedSlot;
  while (current !== slotId) {
    current = current === 4 ? 1 : current + 1;
    depth += 1;
  }
  return depth;
}

function getWeaponStackFrameStyle(slotId, selectedSlot, tune) {
  const depth = getWeaponStackDepth(slotId, selectedSlot);
  if (depth === 0) {
    return {
      "--slot-x": "0px",
      "--slot-y": "0px",
      "--slot-scale": "1",
      "--slot-z": 4,
    };
  }
  const t = tune[depth];
  return {
    "--slot-x": `${t.x}px`,
    "--slot-y": `${t.y}px`,
    "--slot-scale": String(t.scale),
    "--slot-z": 4 - depth,
  };
}

const INVERT_Y_KEY = "fps-invert-y";
const KEYBOARD_LOOK_KEY = "fps-keyboard-look";
const KEYBOARD_EASE_KEY = "fps-keyboard-ease";
const MOUSE_LOOK_KEY = "fps-mouse-look";
const MOUSE_EASE_KEY = "fps-mouse-ease";
const LOOK_MAX_RATE_KEY = "fps-look-max-rate";
const SUN_TUNE_ENABLED_KEY = "fps-sun-tune-enabled";
const HEMI_TUNE_ENABLED_KEY = "fps-hemi-tune-enabled";
const STAIRS_TUNE_ENABLED_KEY = "fps-stairs-tune-enabled";
const LEGACY_LOOK_SPEED_KEY = "fps-look-speed";
const LEGACY_LOOK_EASE_KEY = "fps-look-ease";
const RENDER_SCALE_KEY = "fps-render-scale";
const PLAYER_HEIGHT_KEY = "fps-player-height";
const SHOW_FPS_KEY = "fps-show-counter";
const SHOW_HUD_KEY = "fps-show-hud";
const SHOW_PLAYER_COORDS_KEY = "fps-show-player-coords";
const MUSIC_ENABLED_KEY = "fps-music-enabled";
const DEFAULT_KEYBOARD_LOOK = 5;
const DEFAULT_KEYBOARD_EASE = 0;
const DEFAULT_MOUSE_LOOK = 7;
const DEFAULT_MOUSE_EASE = 1;
const DEFAULT_MAX_LOOK_RATE = 2.5;
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
/** Persisted dev-only "Show FPS counter" toggle. Default off so a normal
 *  player never sees the dev HUD. */
function loadShowFps() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SHOW_FPS_KEY) === "true";
}

function loadShowHud() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SHOW_HUD_KEY) !== "false";
}

function loadMusicEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUSIC_ENABLED_KEY) !== "false";
}
/** Seconds for the day/night toggle to crossfade from one state to the other. */
const DAY_NIGHT_FADE_DURATION = 10;
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
const MAGAZINE_SIZE = 80;
const SPARE_MAGAZINES = 4;
/** Shrink HUD ammo digits when a stat exceeds two digits. */
function hudAmmoValueClass(value) {
  return value >= 100 ? " hudAmmoValueCompact" : "";
}
const BURST_SHOT_COUNT = 3;
const BURST_INTERVAL = 0.085;
const AUTO_FIRE_INTERVAL = 0.1;
const FIRE_MODE_ORDER = ["auto", "burst", "single"];
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

function safeRequestPointerLock(canvas) {
  if (document.pointerLockElement === canvas) return;
  canvas.requestPointerLock().catch(() => {});
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

/** Vignette pulse + camera shake — use whenever the player takes damage. */
function triggerPlayerHurtFeedback(flashEndRef) {
  triggerHurtVignetteFlash(flashEndRef);
  triggerHurtScreenShake();
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

function updateWalkPowerHud(el, stamina, staminaMax, playerHealth, visible) {
  if (!el) return;
  if (!visible || playerHealth <= 0) {
    el.style.visibility = "hidden";
    return;
  }
  el.style.visibility = "visible";

  const radioactive = playerHealth > 100;
  const overload = playerHealth > 150;
  const pct = staminaMax > 0 ? Math.min(1, Math.max(0, stamina / staminaMax)) : 0;
  const displayMax = radioactive ? playerHealth : 100;
  const displayVal = Math.round(pct * displayMax);
  let greenOp = 0;
  if (radioactive && displayMax > 100 && displayVal > 100) {
    greenOp = Math.min(1, (displayVal - 100) / (displayMax - 100));
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
    fill.style.width = `${pct * 100}%`;
    let orangeOp = 0;
    let redOp = 0;
    if (displayVal <= 100) {
      if (displayVal <= 50) orangeOp = 1;
      if (displayVal <= 25) redOp = 1;
    } else if (!radioactive) {
      if (pct <= 0.5) orangeOp = 1;
      if (pct <= 0.25) redOp = 1;
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
    textBlack.style.width = `${pct * 100}%`;
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
        {WEAPON_SLOT_IDS.map((slotId) => {
          const weaponUi = SECONDARY_WEAPON_UI[slotId];
          const isSelected = slotId === selectedWeaponSlot;
          const count = weaponUi
            ? slotId === GRENADE_WEAPON_SLOT
              ? grenadeCount
              : slotId === FLASHBANG_WEAPON_SLOT
                ? flashbangCount
                : 0
            : 0;
          const isEmpty = weaponUi ? count === 0 : true;

          return (
            <div
              key={slotId}
              className={[
                "hudSecondWeaponFrame",
                isSelected ? "hudSecondWeaponFrame--selected" : "",
                isEmpty ? "hudSecondWeaponEmpty" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={getWeaponStackFrameStyle(
                slotId,
                selectedWeaponSlot,
                weaponStackTune
              )}
            >
              <span className="hudSecondWeaponKey">{slotId}</span>
              <div className="hudSecondWeaponBody">
                {weaponUi ? (
                  <img
                    src={weaponUi.icon}
                    className="hudSecondWeaponIcon"
                    alt=""
                  />
                ) : (
                  <span
                    className="hudSecondWeaponIcon hudSecondWeaponIcon--placeholder"
                    aria-hidden="true"
                  />
                )}
                <span className="hudSecondWeaponLabel">
                  {weaponUi?.label ?? "EMPTY"}
                </span>
                <span className="hudSecondWeaponCount">
                  {weaponUi ? String(count).padStart(2, "0") : "00"}
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
  const crosshairRef = useRef(null);
  const doorInteractPromptRef = useRef(null);
  const fpsRef = useRef(null);
  const missionTimerHudRef = useRef(null);
  const hostileCountHudRef = useRef(null);
  const playerCoordsMenuRef = useRef(null);
  const playerCoordsHudRef = useRef(null);
  const showDevOverlayRef = useRef(false);
  const showPlayerCoordsRef = useRef(false);
  const showHudRef = useRef(true);
  const gameRootRef = useRef(null);
  const compassTapeRef = useRef(null);
  const compassViewportRef = useRef(null);
  const compassMarkersRef = useRef(null);
  const radarRef = useRef(null);
  const radarSweepRef = useRef(null);
  const radarDotsRef = useRef(null);
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
  const soundsRef = useRef(null);
  const [keyboardLook, setKeyboardLook] = useState(DEFAULT_KEYBOARD_LOOK);
  const [keyboardEase, setKeyboardEase] = useState(DEFAULT_KEYBOARD_EASE);
  const [mouseLook, setMouseLook] = useState(DEFAULT_MOUSE_LOOK);
  const [mouseEase, setMouseEase] = useState(DEFAULT_MOUSE_EASE);
  const [maxLookRate, setMaxLookRate] = useState(DEFAULT_MAX_LOOK_RATE);
  const [playerHeight, setPlayerHeight] = useState(DEFAULT_PLAYER_HEIGHT);
  const [sunAzimuth, setSunAzimuth] = useState(() => loadSunAngles().azimuth);
  const [sunElevation, setSunElevation] = useState(() => loadSunAngles().elevation);
  const initialMoonAngles = loadMoonAngles();
  const [moonAzimuth, setMoonAzimuth] = useState(initialMoonAngles.azimuth);
  const [moonElevation, setMoonElevation] = useState(initialMoonAngles.elevation);
  const [moonIntensity, setMoonIntensity] = useState(() => loadMoonIntensity());
  const [sunIsDay, setSunIsDay] = useState(() => loadSunDayMode());
  const initialStairTuning = loadStairTuning();
  const initialWalkBobTuning = loadWalkBobTuning();
  const initialStairWalkTuning = loadStairWalkTuning();
  const [stairX, setStairX] = useState(initialStairTuning.position.x);
  const [stairY, setStairY] = useState(initialStairTuning.position.y);
  const [stairZ, setStairZ] = useState(initialStairTuning.position.z);
  const [stairRotationY, setStairRotationY] = useState(initialStairTuning.rotationY);
  const [arenaHasStairs, setArenaHasStairs] = useState(false);
  const [levelMeta, setLevelMeta] = useState({
    number: 1,
    id: "level1",
    name: "Level 1",
    objective: "HOLD ZONE",
  });
  const [stairsTuneEnabled, setStairsTuneEnabled] = useState(false);
  const [walkBobTuneEnabled, setWalkBobTuneEnabled] = useState(false);
  const [stairWalkTuneEnabled, setStairWalkTuneEnabled] = useState(false);
  const [hudBarTuneEnabled, setHudBarTuneEnabled] = useState(false);
  const [hudBarLayout, setHudBarLayout] = useState(() => loadHudBarTuning());
  const [oilBarrelTuneEnabled, setOilBarrelTuneEnabled] = useState(false);
  const [oilBarrelTuning, setOilBarrelTuning] = useState(() =>
    loadOilBarrelTuning()
  );
  const [vx27ContainerTuneEnabled, setVx27ContainerTuneEnabled] = useState(false);
  const vx27ContainerTuneEnabledRef = useRef(false);
  const containerDoorTuningKeyRef = useRef("");
  const [arenaHasVx27ContainersState, setArenaHasVx27ContainersState] = useState(false);
  const [containerTuneIndex, setContainerTuneIndex] = useState(0);
  const containerTuneIndexRef = useRef(0);
  const [containerPropLabels, setContainerPropLabels] = useState([]);
  const [containerX, setContainerX] = useState(0);
  const [containerZ, setContainerZ] = useState(0);
  const [containerFloorY, setContainerFloorY] = useState(0);
  const [containerRotationY, setContainerRotationY] = useState(0);
  const initialContainerInsets = loadVx27ContainerInteriorInsets();
  const [containerInsetLeft, setContainerInsetLeft] = useState(initialContainerInsets.left);
  const [containerInsetRight, setContainerInsetRight] = useState(initialContainerInsets.right);
  const [containerInsetFront, setContainerInsetFront] = useState(initialContainerInsets.front);
  const [containerInsetBack, setContainerInsetBack] = useState(initialContainerInsets.back);
  const [containerFloorOffset, setContainerFloorOffset] = useState(
    initialContainerInsets.floorOffset
  );
  const [containerCeilingOffset, setContainerCeilingOffset] = useState(
    initialContainerInsets.ceilingOffset
  );
  const [containerEdgeRadius, setContainerEdgeRadius] = useState(() =>
    loadVx27ContainerEdgeRadius()
  );
  const [containerExteriorCornerRadius, setContainerExteriorCornerRadius] =
    useState(() => loadVx27ContainerExteriorCornerRadius());
  const [containerScale, setContainerScale] = useState(1);
  const [containerMaterialTuning, setContainerMaterialTuning] = useState(() =>
    loadVx27ContainerMaterialTuning()
  );
  const [containerDoorTuning, setContainerDoorTuning] = useState(
    () => DEFAULT_VX27_CONTAINER_DOOR_TUNING
  );
  const [containerDoorWizardEnabled, setContainerDoorWizardEnabled] = useState(false);
  const containerDoorWizardEnabledRef = useRef(false);
  const [containerBounds, setContainerBounds] = useState(() =>
    getVx27ContainerPlacementBounds(null, 0, 4.35)
  );
  const pilePrefs = loadPileWizardPrefs();
  const [pileSeed, setPileSeed] = useState(pilePrefs.seed);
  const [pileHubX, setPileHubX] = useState(pilePrefs.hub.x);
  const [pileHubZ, setPileHubZ] = useState(pilePrefs.hub.z);
  const [pileHubRotationY, setPileHubRotationY] = useState(
    pilePrefs.hub.rotationY ?? 0
  );
  const [pileStatus, setPileStatus] = useState("");
  const [pileBusy, setPileBusy] = useState(false);
  const [walkBobTuning, setWalkBobTuning] = useState(initialWalkBobTuning);
  const [stairWalkTuning, setStairWalkTuning] = useState(initialStairWalkTuning);
  const [sunTuneEnabled, setSunTuneEnabled] = useState(false);
  const [hemiTuneEnabled, setHemiTuneEnabled] = useState(false);
  const [floorDeckY, setFloorDeckY] = useState(0);
  const [catwalkDeckY, setCatwalkDeckY] = useState(4.13);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadAssetLabel, setLoadAssetLabel] = useState("Initializing…");
  const [assetsReady, setAssetsReady] = useState(false);
  const [loadDone, setLoadDone] = useState(() => gameSessionStarted);
  const loadDoneRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [showFps, setShowFps] = useState(false);
  const [showHud, setShowHud] = useState(() => loadShowHud());
  const [musicEnabled, setMusicEnabled] = useState(true);
  const musicEnabledRef = useRef(true);
  const [ammoDropSpareThreshold, setAmmoDropSpareThreshold] = useState(
    DEFAULT_AMMO_DROP_SPARE_THRESHOLD
  );
  const ammoDropSpareThresholdRef = useRef(DEFAULT_AMMO_DROP_SPARE_THRESHOLD);
  const loadingMusicTrackIdRef = useRef(loadStoredLoadingTrackId());
  const levelMusicTrackIdRef = useRef(DEFAULT_LEVEL_TRACK_ID);
  const [showDevOverlay, setShowDevOverlay] = useState(() => window.localStorage.getItem("fps-show-dev-overlay") === "true");
  const [devShowBarrels, setDevShowBarrels] = useState(() => loadDevSceneShow(DEV_SHOW_BARRELS_KEY));
  const [devShowEnemies, setDevShowEnemies] = useState(() => loadDevSceneShow(DEV_SHOW_ENEMIES_KEY));
  const [devShowStairs, setDevShowStairs] = useState(() => loadDevSceneShow(DEV_SHOW_STAIRS_KEY));
  const [devShowContainers, setDevShowContainers] = useState(() =>
    loadDevSceneShow(DEV_SHOW_CONTAINERS_KEY)
  );
  const [devShowPillars, setDevShowPillars] = useState(() => loadDevSceneShow(DEV_SHOW_PILLARS_KEY));
  const [devShowLensFlare, setDevShowLensFlare] = useState(() =>
    loadDevSceneShow(DEV_SHOW_LENS_FLARE_KEY)
  );
  const [devShowSunDisc, setDevShowSunDisc] = useState(() => loadDevSceneShow(DEV_SHOW_SUN_DISC_KEY));
  const [devDisableHoleDecals, setDevDisableHoleDecals] = useState(() => {
    try {
      return window.localStorage.getItem(DEV_DISABLE_HOLE_DECALS_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [frameHitchProfiler, setFrameHitchProfiler] = useState(() =>
    loadFrameHitchProfilerEnabled()
  );
  const frameHitchProfilerRef = useRef(null);
  const [shadowsDisabled, setShadowsDisabled] = useState(() =>
    loadShadowsDisabled()
  );
  const shadowsDisabledRef = useRef(shadowsDisabled);
  const applyShadowDebugRef = useRef(null);
  const [texturesDisabled, setTexturesDisabled] = useState(() =>
    loadTexturesDisabled()
  );
  const texturesDisabledRef = useRef(texturesDisabled);
  const applyTextureDebugRef = useRef(null);
  const [shadowMapType, setShadowMapType] = useState(() => loadShadowMapType());
  const shadowMapTypeRef = useRef(shadowMapType);
  const [plainShadowDepth, setPlainShadowDepth] = useState(() =>
    loadPlainShadowDepthEnabled()
  );
  const plainShadowDepthRef = useRef(plainShadowDepth);
  const applyShadowExperimentRef = useRef(null);
  const [showPlayerCoords, setShowPlayerCoords] = useState(
    () => window.localStorage.getItem(SHOW_PLAYER_COORDS_KEY) === "true"
  );
  const [hudCogX, setHudCogX] = useState(4);
  const [hudCogY, setHudCogY] = useState(32);
  const [hudCogSize, setHudCogSize] = useState(8);
  const [hudRoundsX, setHudRoundsX] = useState(33);
  const [hudRoundsY, setHudRoundsY] = useState(10);
  const [hudMagX, setHudMagX] = useState(50);
  const [hudMagY, setHudMagY] = useState(10);
  const [hudMagsX, setHudMagsX] = useState(67);
  const [hudMagsY, setHudMagsY] = useState(10);
  const [hudValueFont, setHudValueFont] = useState(2.97);
  const [hudLabelY, setHudLabelY] = useState(8);
  const [hudFireModeY, setHudFireModeY] = useState(14.5);
  const [hudBarCompassX, setHudBarCompassX] = useState(92);
  const [hudBarCompassY, setHudBarCompassY] = useState(21);
  const [hudBarCompassSize, setHudBarCompassSize] = useState(6.3);
  const [hbCorner, setHbCorner] = useState(3);
  const [radarInnerX] = useState(49);
  const [radarInnerY] = useState(50);
  const [radarInnerSize] = useState(80);
  const [radarLeft] = useState(1.5);
  const [radarBottom] = useState(1.5);
  const [radarScale] = useState(11);
  const [weaponTuneEnabled, setWeaponTuneEnabled] = useState(false);
  const [levelEditEnabled, setLevelEditEnabled] = useState(false);
  const levelEditEnabledRef = useRef(false);
  const selectedLevelObjectRef = useRef(null);
  const [selectedLevelObjectVer, setSelectedLevelObjectVer] = useState(0);
  const levelObjectsRef = useRef([]);
  const sceneRef = useRef(null);
  const [bindings, setBindings] = useState(() => loadBindings());
  const [rebindAction, setRebindAction] = useState(null);
  const bindingsRef = useRef(loadBindings());
  const settingsOpenRef = useRef(false);
  const controlsOpenRef = useRef(false);
  const weaponTuneEnabledRef = useRef(false);
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
  const rebuildStairsRef = useRef(null);
  const rebuildOilBarrelsRef = useRef(null);
  const pilePlacementRafRef = useRef(0);
  const vx27ContainersRef = useRef([]);
  const vx27ContainerCommitRef = useRef(null);
  const vx27ContainerInteriorCommitRef = useRef(null);
  const vx27ContainerExteriorCommitRef = useRef(null);
  const vx27ContainerExteriorCornerCommitRef = useRef(null);
  const vx27ContainerScaleCommitRef = useRef(null);
  const vx27ContainerDoorCommitRef = useRef(null);
  const getPlayerPlacementRef = useRef(null);
  const arenaLiveRef = useRef(null);
  const onContainerMaterialChange = useCallback((key, value) => {
    setContainerMaterialTuning((prev) => {
      const next = normalizeVx27ContainerMaterialTuning({ ...prev, [key]: value });
      saveVx27ContainerMaterialTuning(next);
      const containerGroup =
        vx27ContainersRef.current[containerTuneIndexRef.current] ??
        sceneRef.current ??
        undefined;
      setVx27ContainerMaterialTuning(next, containerGroup);
      return next;
    });
  }, []);
  const onOilBarrelTuningChange = useCallback((key, value) => {
    setOilBarrelTuning((prev) => {
      const next = normalizeOilBarrelTuning({ ...prev, [key]: value });
      saveOilBarrelTuning(next);
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

  const persistPilePrefs = useCallback((seed, hubX, hubZ, hubRotationY) => {
    savePileWizardPrefs({
      seed,
      hub: { x: hubX, z: hubZ, rotationY: hubRotationY },
    });
  }, []);

  const applyAllTunePanels = useCallback((enabled) => {
    const on = enabled ? "true" : "false";
    saveWeaponTuneEnabled(enabled);
    localStorage.setItem(SUN_TUNE_ENABLED_KEY, on);
    localStorage.setItem(HEMI_TUNE_ENABLED_KEY, on);
    localStorage.setItem(STAIRS_TUNE_ENABLED_KEY, on);
    saveWalkBobTuneEnabled(enabled);
    saveStairWalkTuneEnabled(enabled);
    saveHudBarTuneEnabled(enabled);
    saveOilBarrelTuneEnabled(enabled);
    saveVx27ContainerTuneEnabled(enabled);
    setWeaponTuneEnabled(enabled);
    weaponTuneEnabledRef.current = enabled;
    setSunTuneEnabled(enabled);
    setHemiTuneEnabled(enabled);
    setStairsTuneEnabled(enabled);
    setWalkBobTuneEnabled(enabled);
    setStairWalkTuneEnabled(enabled);
    setHudBarTuneEnabled(enabled);
    setOilBarrelTuneEnabled(enabled);
    setVx27ContainerTuneEnabled(enabled);
  }, []);

  const applyPilePlacementToScene = useCallback(
    (hubX, hubZ, hubRotationY, { persist = true } = {}) => {
      const arena = arenaLiveRef.current;
      if (!arena) {
        setPileStatus("Level not loaded yet.");
        return null;
      }
      const result = applyOilBarrelPileToArena(arena, {
        hub: { x: hubX, z: hubZ },
        rotationY: hubRotationY,
      });
      rebuildOilBarrelsRef.current?.();
      if (persist) {
        persistPilePrefs(pileSeed, hubX, hubZ, hubRotationY);
      }
      const check = checkArenaOilBarrelPile(arena);
      const rotDeg = (hubRotationY * (180 / Math.PI)).toFixed(1);
      if (!result.ok) {
        const miss = result.failed.length
          ? result.failed.join(", ")
          : "not enough barrels placed";
        setPileStatus(
          `Pile at (${hubX.toFixed(2)}, ${hubZ.toFixed(2)}, ${rotDeg}°) — ${miss}.`
        );
      } else if (!check.ok) {
        setPileStatus(
          `Pile at (${hubX.toFixed(2)}, ${hubZ.toFixed(2)}, ${rotDeg}°) — overlaps detected.`
        );
      } else {
        setPileStatus(
          `Pile at (${hubX.toFixed(2)}, ${hubZ.toFixed(2)}, ${rotDeg}°) — check OK.`
        );
      }
      return result;
    },
    [pileSeed, persistPilePrefs]
  );

  const schedulePilePlacement = useCallback(
    (hubX, hubZ, hubRotationY) => {
      if (pilePlacementRafRef.current) {
        cancelAnimationFrame(pilePlacementRafRef.current);
      }
      pilePlacementRafRef.current = requestAnimationFrame(() => {
        pilePlacementRafRef.current = 0;
        applyPilePlacementToScene(hubX, hubZ, hubRotationY);
      });
    },
    [applyPilePlacementToScene]
  );

  const onPileGenerate = useCallback(() => {
    if (pileBusy) return;
    setPileBusy(true);
    setPileStatus("Applying pile layout…");
    void (async () => {
      try {
        await new Promise((r) => setTimeout(r, 0));
        applyPilePlacementToScene(pileHubX, pileHubZ, pileHubRotationY);
      } finally {
        setPileBusy(false);
      }
    })();
  }, [pileBusy, pileHubX, pileHubZ, pileHubRotationY, applyPilePlacementToScene]);

  const onPileCheck = useCallback(() => {
    const arena = arenaLiveRef.current;
    if (!arena) {
      setPileStatus("Level not loaded yet.");
      return;
    }
    const { ok, count } = checkArenaOilBarrelPile(arena);
    setPileStatus(
      ok
        ? `Check OK — ${count} pile barrel(s), no overlaps.`
        : `Check failed — ${count} pile barrel(s) intersect.`
    );
  }, []);

  const onPileCopyJson = useCallback(async () => {
    const arena = arenaLiveRef.current;
    if (!arena) return;
    const pile = (arena.props ?? []).filter((p) => isOilBarrelPileManagedProp(p));
    const text = JSON.stringify(pile, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setPileStatus(`Copied ${pile.length} pile props to clipboard.`);
    } catch {
      setPileStatus("Copy failed — see console.");
      console.log("Oil barrel pile props:", text);
    }
  }, []);

  const stairParamsRef = useRef(initialStairTuning);
  const walkBobTuningRef = useRef(initialWalkBobTuning);
  const stairWalkTuningRef = useRef(initialStairWalkTuning);
  const sunRef = useRef(null);
  const moonRef = useRef(null);
  const sunBaseIntensityRef = useRef(2.85);
  const sunIsDayRef = useRef(loadSunDayMode());
  const applyDayNightRef = useRef(null);
  // Continuous 0 (full day) → 1 (full night) value driving the day/night fade.
  // `target` is set instantly by the toggle; `cur` is slewed toward it in the
  // animate loop so every light/atmosphere/hemi setting eases together.
  const dayNightTargetNightnessRef = useRef(loadSunDayMode() ? 0 : 1);
  const dayNightCurNightnessRef = useRef(loadSunDayMode() ? 0 : 1);
  const skyRef = useRef(null);
  const applyDevSceneVisibilityRef = useRef(null);
  const devSceneShowRef = useRef({
    showBarrels: true,
    showEnemies: true,
    showStairs: true,
    showContainers: true,
    showPillars: true,
    showLensFlare: true,
    showSunDisc: true,
  });
  const weaponRef = useRef(null);
  const hemiRef = useRef(null);
  const roomLightsRef = useRef([]);
  const oilBarrelFireLightsRef = useRef([]);
  const roomCullablesRef = useRef([]);
  const dayNightToggleRef = useRef(null);
  const [hemiDay, setHemiDay] = useState(() => ({ ...DEFAULT_HEMI_DAY }));
  const [hemiNight, setHemiNight] = useState(() => ({ ...DEFAULT_HEMI_NIGHT }));
  const hemiDayRef = useRef({ ...DEFAULT_HEMI_DAY });
  const hemiNightRef = useRef({ ...DEFAULT_HEMI_NIGHT });
  const [weaponPoseMode, setWeaponPoseMode] = useState("hip");
  const [hipWeaponPose, setHipWeaponPose] = useState(DEFAULT_HIP_POSE);
  const [adsWeaponPose, setAdsWeaponPose] = useState(DEFAULT_ADS_POSE);
  const [bodyLookUpAmount, setBodyLookUpAmount] = useState(0);
  const [bodyLookDownAmount, setBodyLookDownAmount] = useState(0);
  const [fireMode, setFireMode] = useState("auto");
  const [roundsInMag, setRoundsInMag] = useState(MAGAZINE_SIZE);
  const [spareMags, setSpareMags] = useState(SPARE_MAGAZINES);
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
  const [weaponStackTune, setWeaponStackTune] = useState(() => ({
    1: { ...DEFAULT_WEAPON_STACK_TUNE[1] },
    2: { ...DEFAULT_WEAPON_STACK_TUNE[2] },
    3: { ...DEFAULT_WEAPON_STACK_TUNE[3] },
  }));
  const [selectedWeaponSlot, setSelectedWeaponSlot] = useState(GRENADE_WEAPON_SLOT);
  const selectedWeaponSlotRef = useRef(GRENADE_WEAPON_SLOT);
  selectedWeaponSlotRef.current = selectedWeaponSlot;
  const [playerLives, setPlayerLives] = useState(3);
  const missionTimeRef = useRef(0);
  const hostileCountRef = useRef(0);
  const playerHealthRef = useRef(100);
  const playerLivesRef = useRef(3);
  const fireModeRef = useRef("auto");
  const roundsInMagRef = useRef(MAGAZINE_SIZE);
  const spareMagsRef = useRef(SPARE_MAGAZINES);
  const setAmmoStateRef = useRef(null);
  const weaponTuningRef = useRef({
    hip: DEFAULT_HIP_POSE,
    ads: DEFAULT_ADS_POSE,
    bodyLookUpAmount: DEFAULT_BODY_LOOK_UP_AMOUNT,
    bodyLookDownAmount: DEFAULT_BODY_LOOK_DOWN_AMOUNT,
  });
  const weaponPoseModeRef = useRef("hip");
  const rebindActionRef = useRef(null);

  useEffect(() => {
    const tuning = loadWeaponTuning();
    setHipWeaponPose(tuning.hip);
    setAdsWeaponPose(tuning.ads);
    setBodyLookUpAmount(loadBodyLookUpAmount());
    setBodyLookDownAmount(loadBodyLookDownAmount());
    const storedHemiDay = loadHemiDay();
    const storedHemiNight = loadHemiNight();
    setHemiDay(storedHemiDay);
    setHemiNight(storedHemiNight);
    hemiDayRef.current = storedHemiDay;
    hemiNightRef.current = storedHemiNight;
    weaponTuningRef.current = {
      ...tuning,
      bodyLookUpAmount: loadBodyLookUpAmount(),
      bodyLookDownAmount: loadBodyLookDownAmount(),
    };
  }, []);

  weaponTuningRef.current = {
    hip: hipWeaponPose,
    ads: adsWeaponPose,
    bodyLookUpAmount,
    bodyLookDownAmount,
  };
  weaponPoseModeRef.current = weaponPoseMode;
  walkBobTuningRef.current = walkBobTuning;
  stairWalkTuningRef.current = stairWalkTuning;
  bindingsRef.current = bindings;
  rebindActionRef.current = rebindAction;
  fireModeRef.current = fireMode;
  loadDoneRef.current = loadDone;
  if (loadDone) gameSessionStarted = true;
  musicEnabledRef.current = musicEnabled;
  ammoDropSpareThresholdRef.current = ammoDropSpareThreshold;
  showDevOverlayRef.current = showDevOverlay;
  devSceneShowRef.current = {
    showBarrels: devShowBarrels,
    showEnemies: devShowEnemies,
    showStairs: devShowStairs,
    showContainers: devShowContainers,
    showPillars: devShowPillars,
    showLensFlare: devShowLensFlare,
    showSunDisc: devShowSunDisc,
  };
  showPlayerCoordsRef.current = showPlayerCoords;
  showHudRef.current = showHud;
  containerTuneIndexRef.current = containerTuneIndex;
  vx27ContainerTuneEnabledRef.current = vx27ContainerTuneEnabled;

  scheduleGameplayHudSyncRef.current = () => {
    if (hudSyncPendingRef.current) return;
    hudSyncPendingRef.current = true;
    requestAnimationFrame(() => {
      hudSyncPendingRef.current = false;
      setPlayerHealth(playerHealthRef.current);
      setGrenadeCount(grenadeCountRef.current);
      setRoundsInMag(roundsInMagRef.current);
      setSpareMags(spareMagsRef.current);
    });
  };

  roundsInMagRef.current = roundsInMag;
  spareMagsRef.current = spareMags;
  setAmmoStateRef.current = (rounds, spare) => {
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

      if (e.code === "KeyH") {
        const next = !showHudRef.current;
        showHudRef.current = next;
        localStorage.setItem(SHOW_HUD_KEY, String(next));
        gameRootRef.current?.classList.toggle("gameHudHidden", !next);
        if (settingsOpenRef.current) {
          setShowHud(next);
        }
        return;
      }
      if (e.code === "KeyI") {
        setInvertYLook((prev) => {
          const next = !prev;
          invertYRef.current = next;
          localStorage.setItem(INVERT_Y_KEY, String(next));
          return next;
        });
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
    const maxRate = read(LOOK_MAX_RATE_KEY, DEFAULT_MAX_LOOK_RATE);

    const persistAllTunePanels = (enabled) => {
      applyAllTunePanels(enabled);
    };

    if (isLocalDevHost() && localStorage.getItem(DEV_TUNE_BOOT_KEY) !== "1") {
      localStorage.setItem(DEV_TUNE_BOOT_KEY, "1");
      persistAllTunePanels(false);
    }

    const tuneEnabled = resolveDevTuneEnabled(WEAPON_TUNE_ENABLED_KEY);
    const sunEnabled = resolveDevTuneEnabled(SUN_TUNE_ENABLED_KEY);
    const hemiEnabled = resolveDevTuneEnabled(HEMI_TUNE_ENABLED_KEY);
    const stairsEnabled = resolveDevTuneEnabled(STAIRS_TUNE_ENABLED_KEY);
    const walkBobEnabled = resolveDevTuneEnabled(WALK_BOB_TUNE_ENABLED_KEY);
    const stairWalkEnabled = resolveDevTuneEnabled(STAIR_WALK_TUNE_ENABLED_KEY);
    const hudBarEnabled = resolveDevTuneEnabled(HUD_BAR_TUNE_ENABLED_KEY);
    const oilBarrelEnabled = resolveDevTuneEnabled(OIL_BARREL_TUNE_ENABLED_KEY);
    const vx27ContainerEnabled = resolveDevTuneEnabled(VX27_CONTAINER_TUNE_ENABLED_KEY);
    setInvertYLook(storedInvert);
    const storedScale = loadRenderScale();
    setRenderScale(storedScale);
    renderScaleRef.current = storedScale;
    setShowFps(loadShowFps());
    setShowHud(loadShowHud());
    const storedMusicEnabled = loadMusicEnabled();
    const storedLoadingTrack = loadStoredLoadingTrackId();
    setMusicEnabled(storedMusicEnabled);
    musicEnabledRef.current = storedMusicEnabled;
    const storedAmmoDropThreshold = loadAmmoDropSpareThreshold();
    setAmmoDropSpareThreshold(storedAmmoDropThreshold);
    ammoDropSpareThresholdRef.current = storedAmmoDropThreshold;
    loadingMusicTrackIdRef.current = storedLoadingTrack;
    setWeaponTuneEnabled(tuneEnabled);
    setSunTuneEnabled(sunEnabled);
    setHemiTuneEnabled(hemiEnabled);
    setStairsTuneEnabled(stairsEnabled);
    setWalkBobTuneEnabled(walkBobEnabled);
    setStairWalkTuneEnabled(stairWalkEnabled);
    setHudBarTuneEnabled(hudBarEnabled);
    setHudBarLayout(loadHudBarTuning());
    setOilBarrelTuneEnabled(oilBarrelEnabled);
    setVx27ContainerTuneEnabled(vx27ContainerEnabled);
    // Dev: disable hole decals toggle
    try {
      const storedDisableHoleDecals = localStorage.getItem(DEV_DISABLE_HOLE_DECALS_KEY) === "true";
      setDevDisableHoleDecals(storedDisableHoleDecals);
      // setBulletHolesEnabled expects an enabled flag, so invert the stored "disable" value
      setBulletHolesEnabled(!storedDisableHoleDecals);
    } catch {
      // ignore
    }
    weaponTuneEnabledRef.current = tuneEnabled;
    const barrelTuning = loadOilBarrelTuning();
    setOilBarrelTuning(barrelTuning);
    applyOilBarrelMaterialTuning(barrelTuning, sceneRef.current ?? undefined);
    setContainerMaterialTuning(loadVx27ContainerMaterialTuning());
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
  }, [applyAllTunePanels]);

  invertYRef.current = invertYLook;
  renderScaleRef.current = renderScale;
  keyboardLookRef.current = keyboardLook;
  keyboardEaseRef.current = keyboardEase;
  mouseLookRef.current = mouseLook;
  mouseEaseRef.current = mouseEase;
  maxLookRateRef.current = maxLookRate;
  playerHeightRef.current = playerHeight;
  sunAnglesRef.current = { azimuth: sunAzimuth, elevation: sunElevation };
  sunLightPosRef.current = sunPositionFromAngles(sunAzimuth, sunElevation);
  moonAnglesRef.current = { azimuth: moonAzimuth, elevation: moonElevation };
  moonIntensityRef.current = moonIntensity;
  moonLightPosRef.current = moonPositionFromAngles(moonAzimuth, moonElevation);
  sunIsDayRef.current = sunIsDay;
  const commitStairParams = (params) => {
    stairParamsRef.current = params;
    saveStairTuning(params);
    rebuildStairsRef.current?.(params);
    applyDayNightRef.current?.(dayNightCurNightnessRef.current);
    refitSunShadowRef.current?.();
    refitMoonShadowRef.current?.();
  };
  settingsOpenRef.current = settingsOpen;
  controlsOpenRef.current = controlsOpen;
  weaponTuneEnabledRef.current = weaponTuneEnabled;

  useEffect(() => {
    const canvas = canvasRef.current;
    const crosshair = crosshairRef.current;
    if (!canvas || !crosshair) return;

    let sky = null;
    let scene = null;
    let levelTextures = null;
    let disposed = false;
    let rafId = 0;
    let level = null;
    let player = null;
    let input = null;
    let weapon = null;
    let weaponLoadId = 0;
    let flashTimeout = null;
    let hpOrbs = [];
    let ammoDrops = [];
    let collectibleEntries = [];
    let grenades = [];
    let grenadeDrops = [];
    let bloodSplatters = [];
    /** Kill-shot blood — waits for ragdoll, then spawns next frame. */
    let pendingKillBlood = [];
    let bloodAfterRagdoll = [];
    let gameReady = false;
    let healthRegenTimer = 0;
    const HEALTH_REGEN_INTERVAL = 10;
    const HEALTH_REGEN_AMOUNT = 1;
    let onCanvasClick = null;
    let onPointerLockChange = null;
    let onKeyDown = null;
    let onResize = null;
    const arenaAbort = new AbortController();
    frameHitchProfilerRef.current = createFrameHitchProfiler({
      enabled: loadFrameHitchProfilerEnabled(),
    });
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
      if (areShadowsDisabled()) {
        renderer.shadowMap.enabled = false;
      } else {
        enableRendererShadowPipeline(renderer);
      }
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(DAY_CLEAR_COLOR, 1);

      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(DAY_CLEAR_COLOR, 45, 95);
      sceneRef.current = scene;
      applyTextureDebugRef.current = (disabled) => {
        setTexturesDisabledRuntime(disabled);
        texturesDisabledRef.current = disabled;
        applyTextureOverride(scene, disabled);
      };
      if (areTexturesDisabled()) {
        applyTextureOverride(scene, true);
      }

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
      const arena = await loadArenaConfig(undefined, {
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
      reportLoad(54, "Oil barrel assets");
      await preloadOilBarrelAssets(arena);
      if (!isActive()) return;
      await preloadVx27ContainerAssets(arena);
      if (!isActive()) return;
      reportLoad(55, "HP orb textures");
      await preloadHpOrbAssets();
      if (!isActive()) return;
      reportLoad(58, "Pickup assets");
      initPickupPreviewEngine();
      if (!isActive()) return;
      reportLoad(59, "Pickup preview ready");

      reportLoad(60, "Building level");
      const sheltered = (arena.ceilingThickness ?? 0) > 0;
      const { sun, moon, hemi, outdoorLights } = createOutdoorLights(scene, {
        sheltered,
      });
      hemiRef.current = hemi;
      registerOutdoorLightsForDayNight(outdoorLights);
      const attachWall = getArenaAttachWall(arena);
      const arenaHalf = arena.size / 2;
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
      syncLightLayersForZone(scene, false, outdoorLights, roomLights);
      setFloorDeckY(getArenaFloorDeckY());
      setCatwalkDeckY(getArenaCatwalkDeckY(arena));
      let stairParams = loadStairTuning(arena.stairs, arena);
      stairParamsRef.current = stairParams;
      setStairX(stairParams.position.x);
      setStairY(stairParams.position.y);
      setStairZ(stairParams.position.z);
      setStairRotationY(stairParams.rotationY);
      const arenaLive = { ...arena, stairs: stairParams };
      arenaLiveRef.current = arenaLive;
      const pileAnchor = arenaLive.props?.find(
        (p) => p.id === "oil_barrel_pile_stop_begin"
      );
      if (pileAnchor) {
        setPileHubX(pileAnchor.x);
        setPileHubZ(pileAnchor.z);
      }
      level = createLevelFromArena(scene, arenaLive, levelTextures);
      setArenaHasStairs(Boolean(arena.stairs));
      if (!isActive()) {
        if (level?.group) disposeLevelGroup(level.group);
        resetArenaCeilingDayNightCache();
        levelTextures?.dispose();
        return;
      }
      enableShadowsOn(level.group);
      assignWorldLayers(level.group);
      disableInteriorCastShadows(level.group);
      if (areShadowsDisabled()) {
        disableAllShadows(renderer, scene);
      }
      setHealthBarOccluders(level.group);
      setSunOcclusionRoot(level.group);
      reportLoad(72, "Level geometry");
      prebuildRagdollTemplates(level.targets);
      levelObjectsRef.current = level.pillarMeshes ?? [];
      vx27ContainersRef.current = level.vx27ContainerMeshes ?? [];
      let vx27DoorInteractMeshesCache = collectVx27DoorInteractMeshes(
        vx27ContainersRef.current
      );
      setArenaHasVx27ContainersState(
        vx27ContainersRef.current.length > 0 || arenaHasVx27Containers(arena)
      );
      setContainerPropLabels(
        vx27ContainersRef.current.map(
          (group) => group.userData.vx27PropId ?? "vx27_container"
        )
      );
      setContainerBounds(
        getVx27ContainerPlacementBounds(
          level.bounds,
          level.floorY,
          level.catwalkDeckY
        )
      );
      if (vx27ContainersRef.current.length > 0) {
        const firstGroup = vx27ContainersRef.current[0];
        const propMaterial = firstGroup.userData.vx27PropDef?.materialTuning;
        const materialTuning = propMaterial
          ? normalizeVx27ContainerMaterialTuning(propMaterial)
          : loadVx27ContainerMaterialTuning();
        setContainerMaterialTuning(materialTuning);
        setVx27ContainerMaterialTuning(materialTuning, firstGroup);

        const placement = readVx27ContainerPlacement(firstGroup);
        const insets = readVx27ContainerInteriorInsets(firstGroup);
        setContainerTuneIndex(0);
        setContainerX(placement.x);
        setContainerZ(placement.z);
        setContainerFloorY(placement.floorY);
        setContainerRotationY(placement.rotationY);
        setContainerInsetLeft(insets.left);
        setContainerInsetRight(insets.right);
        setContainerInsetFront(insets.front);
        setContainerInsetBack(insets.back);
        setContainerFloorOffset(insets.floorOffset);
        setContainerCeilingOffset(insets.ceilingOffset);
        setContainerEdgeRadius(readVx27ContainerEdgeRadius(firstGroup));
        setContainerExteriorCornerRadius(
          readVx27ContainerExteriorCornerRadius(firstGroup)
        );
        setContainerScale(readVx27ContainerScale(firstGroup));
        setContainerDoorTuning(readVx27ContainerDoorTuning(firstGroup));
      }
      preloadBulletHoleTextures();
      const levelHitMeshes = collectLevelHitMeshes(level.group, level.targets);
      const syncInteriorLighting = () => {
        oilBarrelFireLightsRef.current = collectOilBarrelFireLights(level.group);
        initOilBarrelFireLightFlicker(oilBarrelFireLightsRef.current);
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
      applyDevSceneVisibilityRef.current = () => {
        applyDevSceneVisibility({
          levelGroup: level?.group,
          targets: level?.targets,
          containers: vx27ContainersRef.current,
          pillars: levelObjectsRef.current,
          sky: skyRef.current,
          ...devSceneShowRef.current,
        });
      };
      applyDevSceneVisibilityRef.current();
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
        if (areShadowsDisabled()) {
          sun.castShadow = false;
          moon.castShadow = false;
        } else if (sunShadowOn && moonShadowOn) {
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
        const shelteredHemiMul = sheltered ? 0.85 : 1;
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
          { indoor: sheltered }
        );
      };
      refitSunShadowRef.current = () => {
        if (areShadowsDisabled() || !level?.group) return;
        applySunLightPosition(sun, sunLightPosRef.current);
        fitDirectionalLightShadow(sun, level.group, {
          arenaSize: arena.size,
        });
        sun.updateMatrixWorld(true);
        sun.target.updateMatrixWorld(true);
      };
      refitMoonShadowRef.current = () => {
        if (areShadowsDisabled() || !level?.group || !moon) return;
        applyMoonLightPosition(moon, moonLightPosRef.current);
        fitMoonDirectionalLightShadow(moon, level.group, {
          arenaSize: arena.size,
        });
        moon.updateMatrixWorld(true);
        moon.target.updateMatrixWorld(true);
      };
      applyShadowDebugRef.current = (disabled) => {
        setShadowsDisabledRuntime(disabled);
        shadowsDisabledRef.current = disabled;
        if (disabled) {
          disableAllShadows(renderer, scene);
        } else {
          enableRendererShadowPipeline(renderer);
          enableShadowsOn(level.group);
          if (level.pickupsGroup) enableShadowsOn(level.pickupsGroup);
          disableInteriorCastShadows(level.group);
          resetAndApplyShadowCastHygiene(level.group);
          if (level.pickupsGroup) {
            resetAndApplyShadowCastHygiene(level.pickupsGroup);
          }
          refreshLevelPickupShadows(
            level.pickupsGroup ?? scene,
            collectibleEntries.map((e) => e.drop?.mesh),
            level.group
          );
          refitSunShadowRef.current?.();
          refitMoonShadowRef.current?.();
          requestShadowMapUpdate(renderer);
        }
      };
      applyShadowExperimentRef.current = () => {
        if (areShadowsDisabled()) return;
        applyShadowMapTypeToRenderer(renderer);
        resetAndApplyShadowCastHygiene(level.group);
        if (level.pickupsGroup) {
          resetAndApplyShadowCastHygiene(level.pickupsGroup);
        }
        requestShadowMapUpdate(renderer);
      };
      if (areShadowsDisabled()) {
        disableAllShadows(renderer, scene);
      }
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
        if (areShadowsDisabled()) {
          disableAllShadows(renderer, scene);
        } else {
          requestShadowMapUpdate(renderer);
        }
        mountCompassCollectibleMarkers(
          compassMarkersRef.current,
          collectibleEntries
        );
      };
      applyDayNightRef.current(sunIsDayRef.current);
      mountLevelCollectibles();
      applyShadowExperimentRef.current?.();
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
      /** Stable collider list — avoids spreading into a new array on every physics query. */
      const allColliders = [];
      function syncAllColliders() {
        allColliders.length = 0;
        allColliders.push(
          ...level.colliders,
          ...level.stairColliders,
          ...level.ceilingColliders
        );
      }
      syncAllColliders();
      vx27ContainerCommitRef.current = (index, placement) => {
        const group = vx27ContainersRef.current[index];
        if (!group) return;
        applyVx27ContainerPlacement(group, placement);
        syncVx27ContainerCollider(
          level.colliders,
          group.userData.vx27PropId,
          placement,
          {
            ...group.userData.vx27PropDef,
            interiorInsets: group.userData.vx27InteriorInsets,
            edgeRadius: group.userData.vx27EdgeRadius,
            exteriorCornerRadius: group.userData.vx27ExteriorCornerRadius,
            scale: group.userData.vx27Scale,
            doorTuning: group.userData.vx27DoorTuning,
          }
        );
        syncAllColliders();
      };
      vx27ContainerScaleCommitRef.current = (index, scale) => {
        const group = vx27ContainersRef.current[index];
        if (!group) return;
        rebuildVx27ContainerScale(group, scale);
        const placement = readVx27ContainerPlacement(group);
        syncVx27ContainerCollider(
          level.colliders,
          group.userData.vx27PropId,
          placement,
          {
            ...group.userData.vx27PropDef,
            interiorInsets: group.userData.vx27InteriorInsets,
            edgeRadius: group.userData.vx27EdgeRadius,
            exteriorCornerRadius: group.userData.vx27ExteriorCornerRadius,
            scale: group.userData.vx27Scale,
            doorTuning: group.userData.vx27DoorTuning,
          }
        );
        syncAllColliders();
      };
      vx27ContainerInteriorCommitRef.current = (index, insets) => {
        const group = vx27ContainersRef.current[index];
        if (!group) return;
        const normalized = rebuildVx27ContainerInterior(group, insets);
        saveVx27ContainerInteriorInsets(normalized);
        const placement = readVx27ContainerPlacement(group);
        syncVx27ContainerCollider(
          level.colliders,
          group.userData.vx27PropId,
          placement,
          {
            ...group.userData.vx27PropDef,
            interiorInsets: normalized,
            edgeRadius: group.userData.vx27EdgeRadius,
            exteriorCornerRadius: group.userData.vx27ExteriorCornerRadius,
            scale: group.userData.vx27Scale,
            doorTuning: group.userData.vx27DoorTuning,
          }
        );
        syncAllColliders();
      };
      vx27ContainerExteriorCommitRef.current = (index, edgeRadius) => {
        const group = vx27ContainersRef.current[index];
        if (!group) return;
        const normalized = rebuildVx27ContainerExterior(group, edgeRadius);
        saveVx27ContainerEdgeRadius(normalized);
        group.userData.vx27EdgeRadius = normalized;
        const placement = readVx27ContainerPlacement(group);
        syncVx27ContainerCollider(
          level.colliders,
          group.userData.vx27PropId,
          placement,
          {
            ...group.userData.vx27PropDef,
            interiorInsets: group.userData.vx27InteriorInsets,
            edgeRadius: normalized,
            exteriorCornerRadius: group.userData.vx27ExteriorCornerRadius,
            scale: group.userData.vx27Scale,
            width: group.userData.vx27Width,
            height: group.userData.vx27Height,
            length: group.userData.vx27Length,
            doorTuning: group.userData.vx27DoorTuning,
          }
        );
        syncAllColliders();
      };
      vx27ContainerExteriorCornerCommitRef.current = (index, exteriorCornerRadius) => {
        const group = vx27ContainersRef.current[index];
        if (!group) return;
        const normalized = setVx27ContainerExteriorCornerRadius(group, exteriorCornerRadius);
        saveVx27ContainerExteriorCornerRadius(normalized);
        const placement = readVx27ContainerPlacement(group);
        syncVx27ContainerCollider(
          level.colliders,
          group.userData.vx27PropId,
          placement,
          {
            ...group.userData.vx27PropDef,
            interiorInsets: group.userData.vx27InteriorInsets,
            edgeRadius: group.userData.vx27EdgeRadius,
            exteriorCornerRadius: normalized,
            scale: group.userData.vx27Scale,
            width: group.userData.vx27Width,
            height: group.userData.vx27Height,
            length: group.userData.vx27Length,
            doorTuning: group.userData.vx27DoorTuning,
          }
        );
        syncAllColliders();
      };
      vx27ContainerDoorCommitRef.current = (index, doorPatch) => {
        const group = vx27ContainersRef.current[index];
        if (!group) return;
        const normalized = applyVx27ContainerDoorTuning(group, doorPatch, {
          animate: true,
        });
        const placement = readVx27ContainerPlacement(group);
        const anim = group.userData.vx27DoorAnim;
        if (!anim?.active) {
          syncVx27ContainerCollider(
            level.colliders,
            group.userData.vx27PropId,
            placement,
            {
              ...group.userData.vx27PropDef,
              interiorInsets: group.userData.vx27InteriorInsets,
              edgeRadius: group.userData.vx27EdgeRadius,
              exteriorCornerRadius: group.userData.vx27ExteriorCornerRadius,
              scale: group.userData.vx27Scale,
              width: group.userData.vx27Width,
              height: group.userData.vx27Height,
              length: group.userData.vx27Length,
              doorTuning: normalized,
            }
          );
          syncAllColliders();
        }
        if (containerDoorWizardEnabledRef.current) {
          updateVx27ContainerDoorWizard(group, true);
        }
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
      getPlayerPlacementRef.current = () => {
        if (!player) return null;
        return {
          x: camera.position.x,
          z: camera.position.z,
          floorY: player.getFootY(),
        };
      };
      rebuildStairsRef.current = (params) => {
        if (!level?.rebuildStairs) return;
        level.rebuildStairs(params);
        syncAllColliders();
      };
      rebuildOilBarrelsRef.current = () => {
        const arena = arenaLiveRef.current;
        if (!arena || !level?.group) return;
        rebuildLevelOilBarrels(level.group, arena);
        level?.resyncOilBarrelColliders?.();
        syncInteriorLighting();
      };

      player = createPlayerController(camera, level.bounds, level.floorY, {
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
      };

      const shootRaycaster = new THREE.Raycaster();
      shootRaycaster.layers.enable(WORLD_LAYER);
      shootRaycaster.layers.enable(ROOM_INTERIOR_LAYER);
      const hitRaycaster = new THREE.Raycaster();
      hitRaycaster.layers.enable(WORLD_LAYER);
      hitRaycaster.layers.enable(ROOM_INTERIOR_LAYER);
      const screenCenter = new THREE.Vector2(0, 0);

      /** Keep tune-panel open sliders + export JSON aligned with in-game door state. */
      const syncContainerDoorTuningPanel = (group, preferTarget = false) => {
        if (!vx27ContainerTuneEnabledRef.current || !group) return;
        if (group !== vx27ContainersRef.current[containerTuneIndexRef.current]) {
          return;
        }
        const next = readVx27ContainerDoorTuning(group, { preferTarget });
        const key = `${next.frontLeftOpen}|${next.frontRightOpen}|${next.backLeftOpen}|${next.backRightOpen}`;
        if (key === containerDoorTuningKeyRef.current) return;
        containerDoorTuningKeyRef.current = key;
        setContainerDoorTuning(next);
      };

      const currentWeaponLoad = ++weaponLoadId;
      reportLoad(74, "View weapon (rifle GLTF)");
      const weaponPromise = loadViewWeapon(camera, scene, undefined, { maxAnisotropy })
        .then((loaded) => {
          if (disposed || currentWeaponLoad !== weaponLoadId) {
            loaded.dispose();
            return null;
          }
          weapon = loaded;
          weaponRef.current = loaded;
          weapon.update(camera, 0, 0, weaponTuningRef);
          return loaded;
        })
        .catch((err) => {
          console.error("Rifle model failed to load:", err);
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
      let _radarFrameSkip = 0;
      const BULLET_MAX_RANGE = 55;
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

      function applyHit(hit, bulletDirection, targetMesh) {
        const mesh = targetMesh ?? hit.object;
        const { killed, zone, damage } = applyTargetHit(mesh, hit.point, bulletDirection);
        if (zone !== "miss") {
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
          playTargetDeathSound(mesh, hit.point, zone);
          scheduleKillDrops(deathPos, zone);
          startDeathAnimation(mesh, bulletDirection, {
            scene,
            colliders: allColliders,
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

      function syncAmmoToUi() {
        setAmmoStateRef.current?.(
          roundsInMagRef.current,
          spareMagsRef.current
        );
      }

      function tryReload(force) {
        if (spareMagsRef.current <= 0) return false;
        if (!force && roundsInMagRef.current >= 15) return false;
        spareMagsRef.current -= 1;
        roundsInMagRef.current = Math.min(
          roundsInMagRef.current + MAGAZINE_SIZE,
          MAGAZINE_SIZE * 2
        );
        scheduleGameplayHudSyncRef.current();
        sounds.playSupplyPickup();
        return true;
      }

      function fireOneRound() {
        if (roundsInMagRef.current <= 0 && !tryReload(true)) return false;

        roundsInMagRef.current -= 1;
        scheduleGameplayHudSyncRef.current();

        hitRaycaster.setFromCamera(screenCenter, camera);

        if (levelEditEnabledRef.current && levelObjectsRef.current.length) {
          const loHits = hitRaycaster.intersectObjects(levelObjectsRef.current, false);
          if (loHits.length) {
            const prev = selectedLevelObjectRef.current;
            if (prev && prev !== loHits[0].object) {
              prev.material.emissive?.setHex(0x000000);
            }
            const selected = loHits[0].object;
            selected.material.emissive?.setHex(0x222222);
            selectedLevelObjectRef.current = selected;
            setSelectedLevelObjectVer((v) => v + 1);
          }
        }

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
        if (!weapon) return;

        const mode = fireModeRef.current;
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
      let fpsSmooth = 60;

      function syncPointerLocked() {
        const locked = document.pointerLockElement === canvas;
        setPointerLocked(locked);
        if (locked) sounds.resume();
      }

      function animate(now) {
        if (disposed || !gameReady || !level?.group) return;
        if (!level.group.parent) scene.add(level.group);
        rafId = requestAnimationFrame(animate);
        const hitch = frameHitchProfilerRef.current;
        hitch?.frameStart(now);
        try {
        flushBloodAfterRagdoll();
        flushPendingRagdolls();
        flushPendingKillBlood();
        hitch?.mark("deferrals");
        tickOilBarrelInteriorVideo(camera, oilBarrelRuntimeIndex);
        sounds.updateOilBarrelFire(
          oilBarrelRuntimeIndex.fireLights,
          getOilBarrelTuning().interiorFire !== false
        );
        const rawFrameDt = Math.min((now - lastTime) / 1000, 0.15);
        const dt = Math.min(rawFrameDt, 0.05);
        lastTime = now;
        if (dt > 0) simTime += dt;
        if (dt > 0) {
          fpsSmooth += (1 / dt - fpsSmooth) * 0.12;
          if (fpsRef.current) {
            fpsRef.current.textContent = `${Math.round(fpsSmooth)} FPS`;
          }
          if (player && (settingsOpenRef.current || showPlayerCoordsRef.current)) {
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
            if (settingsOpenRef.current && playerCoordsMenuRef.current) {
              playerCoordsMenuRef.current.textContent = text;
              playerCoordsMenuRef.current.dataset.coords = json;
            }
            if (showPlayerCoordsRef.current && playerCoordsHudRef.current) {
              playerCoordsHudRef.current.textContent = text;
              playerCoordsHudRef.current.dataset.coords = json;
            }
          }
        }

        // Candle-flicker the warm interior lights. Uses rAF's absolute
        // timestamp so the wobble keeps phase across frame-time hitches.
        updateCandleFlicker(flickerLights, now * 0.001);

        const locked = input.isLocked();
        const aimHeld =
          !rebindActionRef.current &&
          isBindingDown(input, bindingsRef.current, "aim");
        const aimTabActive =
          weaponTuneEnabledRef.current && weaponPoseModeRef.current === "ads";
        const aimTarget = aimHeld || aimTabActive ? 1 : 0;

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
          !controlsOpenRef.current;

        if (!frozen) {
          player.update(input, dt);

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
              getOilBarrelTuning(),
              levelHitMeshes
            )
          ) {
            const newHp = Math.max(
              0,
              playerHealthRef.current - OIL_BARREL_FIRE_PROXIMITY_DAMAGE
            );
            playerHealthRef.current = newHp;
            setPlayerHealth(newHp);
            triggerPlayerHurtFeedback(hurtVignetteFlashEndRef);
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
        }
        if (showHudRef.current && radarDotsRef.current && level?.targets) {
          const px = camera.position.x;
          const pz = camera.position.z;
          const yaw = player.getYaw();
          const RADAR_RANGE = 30;

          if (radarSweepRef.current) {
            const canvas = radarSweepRef.current;
            const sweepSpeed = 90;
            const prev = parseFloat(canvas.dataset.angle || "0");
            const next = (prev + sweepSpeed * dt) % 360;
            canvas.dataset.angle = next;

            _radarFrameSkip = (_radarFrameSkip + 1) % 3;
            if (_radarFrameSkip === 0) {
              const ctx = canvas.getContext("2d", { alpha: true });
              const cx = canvas.width / 2;
              const cy = canvas.height / 2;
              const r = cx - 2;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              const sweepRad = (next - 90) * (Math.PI / 180);
              const tailSpan = 70 * (Math.PI / 180);
              const slices = 12;
              for (let s = 0; s < slices; s++) {
                const t0 = s / slices;
                const alpha = t0 * t0 * 0.85;
                const a0 = sweepRad - tailSpan + (tailSpan * s) / slices;
                const a1 = sweepRad - tailSpan + (tailSpan * (s + 1)) / slices;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, r, a0, a1);
                ctx.closePath();
                ctx.fillStyle = `rgba(30, 170, 255, ${alpha})`;
                ctx.fill();
              }
              const ex = cx + Math.cos(sweepRad) * r;
              const ey = cy + Math.sin(sweepRad) * r;
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.lineTo(ex, ey);
              ctx.strokeStyle = "rgba(30, 160, 255, 0.35)";
              ctx.lineWidth = 6;
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.lineTo(ex, ey);
              ctx.strokeStyle = "rgba(30, 170, 255, 1)";
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }

          let radarTargetCount = 0;
          for (const t of level.targets) {
            if (!t.visible || t.userData.health <= 0) continue;
            const dx = t.position.x - px;
            const dz = t.position.z - pz;
            if (dx * dx + dz * dz <= RADAR_RANGE * RADAR_RANGE) {
              _radarScratch[radarTargetCount++] = t;
            }
          }
          const container = radarDotsRef.current;
          while (container.children.length > radarTargetCount) container.lastChild.remove();
          while (container.children.length < radarTargetCount) {
            const dot = document.createElement("div");
            dot.className = "radarBlip";
            container.appendChild(dot);
          }
          const sweepAngleDeg = parseFloat(radarSweepRef.current?.dataset.angle || "0");
          const sweepRad = (sweepAngleDeg * Math.PI) / 180;
          for (let i = 0; i < radarTargetCount; i++) {
            const t = _radarScratch[i];
            const dx = t.position.x - px;
            const dz = t.position.z - pz;
            const angle = Math.atan2(dx, -dz) + yaw;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const r = (dist / RADAR_RANGE) * 44;
            const dotX = 50 + Math.sin(angle) * r;
            const dotY = 50 - Math.cos(angle) * r;
            const dot = container.children[i];
            dot.style.left = `${dotX}%`;
            dot.style.top = `${dotY}%`;

            let angleDiff = ((sweepRad - angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            const fade = angleDiff < Math.PI ? Math.max(0, 1 - angleDiff / Math.PI) : 0;
            dot.style.opacity = Math.max(0.15, fade);
          }

          // Reward dots (blue) for HP orbs, ammo drops, grenade drops
          const levelDrops = collectibleEntries
            .filter((e) => !e.collected && e.drop?.mesh?.position)
            .map((e) => e.drop);
          const allDrops = [...hpOrbs, ...ammoDrops, ...grenadeDrops, ...levelDrops]
            .filter(d => !d.collected && d.mesh?.position);
          let rewardContainer = container.parentElement.querySelector(".radarRewardDots");
          if (!rewardContainer) {
            rewardContainer = document.createElement("div");
            rewardContainer.className = "radarRewardDots";
            rewardContainer.style.cssText = "position:absolute;inset:0;pointer-events:none";
            container.parentElement.appendChild(rewardContainer);
          }
          while (rewardContainer.children.length > allDrops.length) rewardContainer.lastChild.remove();
          while (rewardContainer.children.length < allDrops.length) {
            const dot = document.createElement("div");
            dot.style.cssText = "position:absolute;width:5px;height:5px;border-radius:50%;background:#3af;transform:translate(-50%,-50%)";
            rewardContainer.appendChild(dot);
          }
          for (let i = 0; i < allDrops.length; i++) {
            const d = allDrops[i];
            const dx = d.mesh.position.x - px;
            const dz = d.mesh.position.z - pz;
            if (dx * dx + dz * dz > RADAR_RANGE * RADAR_RANGE) {
              rewardContainer.children[i].style.opacity = "0";
              continue;
            }
            const angle = Math.atan2(dx, -dz) + yaw;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const r = (dist / RADAR_RANGE) * 44;
            const dotX = 50 + Math.sin(angle) * r;
            const dotY = 50 - Math.cos(angle) * r;
            const rdot = rewardContainer.children[i];
            rdot.style.left = `${dotX}%`;
            rdot.style.top = `${dotY}%`;
            rdot.style.opacity = "0.85";
          }
        }
        hitch?.mark("player");
        camera.updateMatrixWorld(true);

        const canInteract =
          locked &&
          !frozen &&
          !rebindActionRef.current &&
          !settingsOpenRef.current &&
          !controlsOpenRef.current;
        let doorTarget = null;
        if (canInteract && vx27DoorInteractMeshesCache.length > 0) {
          hitRaycaster.setFromCamera(screenCenter, camera);
          doorTarget = pickVx27DoorUnderCrosshair(
            hitRaycaster,
            vx27DoorInteractMeshesCache
          );
        }
        crosshair.classList.toggle("crosshairDoorTarget", Boolean(doorTarget));
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
          syncContainerDoorTuningPanel(doorTarget.group, true);
        }

        if (
          canUseWeapons &&
          wasBindingPressed(input, bindingsRef.current, "flashlight")
        ) {
          const nowOn = weapon?.toggleFlashlight();
          if (nowOn && rendererRef.current) {
            requestShadowMapUpdate(rendererRef.current);
          }
        }

        if (
          canUseWeapons &&
          wasBindingPressed(input, bindingsRef.current, "dayNightToggle")
        ) {
          // Toggle from the latest ref value so we don't fight the smooth
          // fade — handleDayNightChange just updates the target, the
          // animate loop slews toward it.
          dayNightToggleRef.current?.(!sunIsDayRef.current);
        }

        const keyboardShoot =
          canUseWeapons &&
          isBindingDown(input, bindingsRef.current, "shoot");

        if (canUseWeapons && (locked || keyboardShoot)) {
          processWeaponFire(dt);
        }

        if (!frozen) {
          weapon?.update(camera, aimTarget, dt, weaponTuningRef, {
            snapAim: !locked,
            moveSpeed: player.getHorizontalSpeed(),
            onStairs: player.isOnStairs(),
            walkBobTuning: resolveWalkBobTuning(walkBobTuningRef.current),
            stairWalkTuning: normalizeStairWalkTuning(stairWalkTuningRef.current),
            nightness: dayNightCurNightnessRef.current,
          });
        }

        const aimBlend = weapon?.getAimBlend() ?? 0;
        const targetFov = THREE.MathUtils.lerp(HIP_FOV, ADS_FOV, aimBlend);
        camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-12 * dt));
        camera.updateProjectionMatrix();

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
          const modes = FIRE_MODE_ORDER;
          const i = modes.indexOf(fireModeRef.current);
          const next = modes[(i + 1) % modes.length];
          fireModeRef.current = next;
          setFireMode(next);
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

        refreshLiveTargets();
        updateBloodSplatters(bloodSplatters, dt, scene);
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
              triggerPlayerHurtFeedback(hurtVignetteFlashEndRef);
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
        } else {
          healthRegenTimer = 0;
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
          }
        );
        if (showHudRef.current) {
          updateTargetHealthBars(level.targets, dt, camera);
        }
        updateVx27ContainerDoorAnimations(vx27ContainersRef.current, dt);
        const tunedContainer =
          vx27ContainersRef.current[containerTuneIndexRef.current];
        if (tunedContainer?.userData.vx27DoorAnim?.active) {
          syncContainerDoorTuningPanel(tunedContainer);
        }
        if (containerDoorWizardEnabledRef.current) {
          const wizardGroup = tunedContainer;
          if (wizardGroup) updateVx27ContainerDoorWizard(wizardGroup, true);
        }
        let doorCollidersDirty = false;
        for (const doorGroup of vx27ContainersRef.current) {
          if (!consumeVx27DoorColliderDirty(doorGroup)) continue;
          doorCollidersDirty = true;
          syncContainerDoorTuningPanel(doorGroup);
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
        });


        updateHpOrbs(
          hpOrbs, dt, camera.position,
          (value) => {
            playerHealthRef.current += value;
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
            } else {
              roundsInMagRef.current += value ?? 10;
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

        hitch?.mark("sim");

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

        const inRoomBody = isIndoorLightingZone(
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
        const inRoomPass = inRoomBody || visibleRoomCount > 0;
        const inRoomViewmodel = resolveViewmodelIndoorLightingZone(
          inRoomBody,
          visibleRoomCount,
          player.getX(),
          player.getZ(),
          arena.rooms,
          arena.floorExtensions ?? [],
          arenaHalf,
          attachWall,
          arena.wallThickness ?? 0.5
        );
        syncLightLayersForZone(
          scene,
          inRoomViewmodel,
          outdoorLights,
          roomLightsRef.current
        );
        syncOilBarrelFireLightLayers(
          oilBarrelFireLightsRef.current,
          inRoomViewmodel
        );

        const barrelFireShadowCount = areShadowsDisabled()
          ? 0
          : updateOilBarrelFireShadowBudget(
              oilBarrelRuntimeIndex.fireLights,
              camera.position,
              getOilBarrelTuning()
            );
        applyFrameShadowUpdates(renderer, {
          sunCastsShadow:
            !areShadowsDisabled() &&
            ((sunRef.current?.castShadow && sunRef.current.intensity > 0.001) ||
              false),
          moonCastsShadow:
            !areShadowsDisabled() &&
            ((moonRef.current?.castShadow && moonRef.current.intensity > 0.001) ||
              false),
          dayNightAnimating:
            dayNightCurNightnessRef.current !==
            dayNightTargetNightnessRef.current,
          flashlightShadow:
            !areShadowsDisabled() &&
            (weapon?.isFlashlightCastingShadow?.() ?? false),
          barrelFireShadowCount,
        });

        sky?.update(camera);
        hitch?.mark("scene");
        renderSceneWithLayeredLighting(renderer, scene, camera, {
          skyRoot: sky?.mesh ?? null,
          skipRoomPass: !inRoomPass,
        });
        if (
          level?.targets &&
          showHudRef.current &&
          hasVisibleTargetHealthBars(level.targets)
        ) {
          hitch?.mark("healthBars");
          renderTargetHealthBarsPass(renderer, scene, camera, level.targets);
        }
        hitch?.mark("viewmodel");
        weapon?.renderViewmodel(renderer, scene, camera);
        } catch (err) {
          console.error("Frame render failed:", err);
        }
        hitch?.frameEnd(now);
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
          ds.respawned = true;
          ds.fadeEndTime = performance.now() + DEATH_FADE_MS;
          playerHealthRef.current = 100;
          setPlayerHealth(100);
          flashbangBlindStartRef.current = 0;
          updateFlashbangOverlay(flashbangOverlayRef.current, 0);
          beginDeathOverlayFade(deathOverlayRef.current);
        }
        safeRequestPointerLock(canvas);
      };
      onPointerLockChange = () => syncPointerLocked();
      onKeyDown = (e) => {
        if (e.code === "Escape") {
          if (settingsOpenRef.current) {
            setSettingsOpen(false);
          } else if (controlsOpenRef.current) {
            setControlsOpen(false);
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
        applyDevSceneVisibilityRef.current?.();
      } catch (err) {
        console.error("Sky dome failed to load:", err);
      }
      if (!isActive()) return;
      reportLoad(88, "Sky dome");

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
        const barrelFireShadowCount = areShadowsDisabled()
          ? 0
          : updateOilBarrelFireShadowBudget(
              oilBarrelRuntimeIndex.fireLights,
              camera.position,
              getOilBarrelTuning()
            );
        return {
          sunCastsShadow:
            !areShadowsDisabled() &&
            (sunRef.current?.castShadow && sunRef.current.intensity > 0.001),
          moonCastsShadow:
            !areShadowsDisabled() &&
            (moonRef.current?.castShadow && moonRef.current.intensity > 0.001),
          dayNightAnimating: false,
          flashlightShadow:
            !areShadowsDisabled() &&
            (weapon?.isFlashlightCastingShadow?.() ?? false),
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
        wallThickness: arena.wallThickness ?? 0.5,
        spawnX: player.getX(),
        spawnEyeY: player.getY(),
        spawnZ: player.getZ(),
        spawnFootY: player.getFootY(),
        spawnYaw: player.getYaw?.() ?? 0,
        getShadowFrameOpts,
      });
      beginShadowStartupWindow();
      reportLoad(99, GPU_PRELOAD_READY_LABEL);

      gameReady = true;
      frameHitchProfilerRef.current?.markGameplayStart();
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
      frameHitchProfilerRef.current?.dispose();
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
      disposeAllBulletHoles();
      disposePreview();
      setHealthBarOccluders(null);
      setSunOcclusionRoot(null);
      levelTextures?.dispose();
      levelTextures = null;
      weapon?.dispose();
      weaponRef.current = null;
      soundsRef.current?.dispose();
      soundsRef.current = null;
      respawnCallbackRef.current = null;
      hemiRef.current = null;
      input?.dispose();
      sky?.dispose();
      skyRef.current = null;
      resetViewmodelInteriorAmbient();
      resetRoomInteriorAmbient();
      renderer.dispose();
      rendererRef.current = null;
      resetGameGpuPreload();
      resetArenaCeilingDayNightCache();
      safeExitPointerLock();
    };
  }, []);

  const handleDayNightChange = (isDay) => {
    setSunIsDay(isDay);
    sunIsDayRef.current = isDay;
    saveSunDayMode(isDay);
    // Setting the target lets the animate loop ease toward it; pre-fit the
    // destination shadow caster so it's ready when its intensity rises.
    dayNightTargetNightnessRef.current = isDay ? 0 : 1;
    if (isDay) refitSunShadowRef.current?.();
    else refitMoonShadowRef.current?.();
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
    soundsRef.current?.resume();
    setLoadDone(true);
    safeRequestPointerLock(canvasRef.current);
  };

  return (
    <div
      ref={gameRootRef}
      className={`gameRoot${showHud ? "" : " gameHudHidden"}`}
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
      <canvas ref={canvasRef} className="gameCanvas" />
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
          "--hud-cog-x": `${hudCogX}%`,
          "--hud-cog-y": `${hudCogY}%`,
          "--hud-cog-size": `${hudCogSize}%`,
          "--hud-rounds-x": `${hudRoundsX}%`,
          "--hud-rounds-y": `${hudRoundsY}%`,
          "--hud-mag-x": `${hudMagX}%`,
          "--hud-mag-y": `${hudMagY}%`,
          "--hud-mags-x": `${hudMagsX}%`,
          "--hud-mags-y": `${hudMagsY}%`,
          "--hud-value-font": `${hudValueFont}vw`,
          "--hud-label-y": `${hudLabelY}px`,
          "--hud-firemode-y": `${hudFireModeY}%`,
          "--hud-bar-compass-x": `${hudBarCompassX}%`,
          "--hud-bar-compass-y": `${hudBarCompassY}%`,
          "--hud-bar-compass-size": `${hudBarCompassSize}vw`,
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
        <div className={`hudAmmoStat hudAmmoStatLeft${roundsInMag < 15 || (roundsInMag === 0 && spareMags === 0) ? " hudAmmoLow" : ""}`}>
          <span className="hudAmmoLabel">ROUNDS</span>
          <span className={`hudAmmoValue${hudAmmoValueClass(roundsInMag)}`}>{String(roundsInMag).padStart(2, "0")}</span>
        </div>

        {/* Centre section — MAG */}
        <div className={`hudAmmoStat hudAmmoStatCenter${roundsInMag === 0 && spareMags === 0 ? " hudAmmoLow" : ""}`}>
          <span className="hudAmmoLabel">MAG</span>
          <span className={`hudAmmoValue${hudAmmoValueClass(MAGAZINE_SIZE)}`}>{String(MAGAZINE_SIZE).padStart(2, "0")}</span>
        </div>

        {/* Right section — MAGS */}
        <div className={`hudAmmoStat hudAmmoStatRight${roundsInMag === 0 && spareMags === 0 ? " hudAmmoLow" : ""}`}>
          <span className="hudAmmoLabel">MAGS</span>
          <span className={`hudAmmoValue${hudAmmoValueClass(spareMags)}`}>{String(spareMags).padStart(2, "0")}</span>
        </div>

        {/* Fire mode indicator — auto | burst | single */}
        <div className="hudFireMode">
          <button
            type="button"
            className={`hudFireModeOption${fireMode === "auto" ? " hudFireModeActive" : ""}`}
            onClick={() => { fireModeRef.current = "auto"; setFireMode("auto"); }}
          >
            <img src={fireMode === "auto" ? "/ui/bullet_selected.webp" : "/ui/bullet.webp"} className="hudBulletIcon" alt="" />
            <span className="hudFireModeLabel">A</span>
          </button>
          <button
            type="button"
            className={`hudFireModeOption${fireMode === "burst" ? " hudFireModeActive" : ""}`}
            onClick={() => { fireModeRef.current = "burst"; setFireMode("burst"); }}
          >
            <img src={fireMode === "burst" ? "/ui/bullet_selected.webp" : "/ui/bullet.webp"} className="hudBulletIcon" alt="" />
            <img src={fireMode === "burst" ? "/ui/bullet_selected.webp" : "/ui/bullet.webp"} className="hudBulletIcon" alt="" />
            <img src={fireMode === "burst" ? "/ui/bullet_selected.webp" : "/ui/bullet.webp"} className="hudBulletIcon" alt="" />
          </button>
          <button
            type="button"
            className={`hudFireModeOption${fireMode === "single" ? " hudFireModeActive" : ""}`}
            onClick={() => { fireModeRef.current = "single"; setFireMode("single"); }}
          >
            <img src={fireMode === "single" ? "/ui/bullet_selected.webp" : "/ui/bullet.webp"} className="hudBulletIcon" alt="" />
          </button>
        </div>

        <HudBarCompass />
      </div>

      {/* Stamina bar — top left */}
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

      {/* Compass — top centre, aligned with stamina / health bars */}
      <HudCompass
        tapeRef={compassTapeRef}
        viewportRef={compassViewportRef}
        markersRef={compassMarkersRef}
      />

      {/* Radar — bottom left */}
      <div className="hudRadar" ref={radarRef} style={{
        left: `${radarLeft}rem`,
        bottom: `${radarBottom}rem`,
        width: `${radarScale}rem`,
        height: `${radarScale}rem`,
      }}>
        <div className="radarRing">
          <div className="radarInner" style={{
            left: `${radarInnerX}%`,
            top: `${radarInnerY}%`,
            width: `${radarInnerSize}%`,
            height: `${radarInnerSize}%`,
          }}>
            <canvas ref={radarSweepRef} className="radarSweepCanvas" width="200" height="200" />
            <div ref={radarDotsRef} className="radarDots" />
            <div className="radarCenter" />
          </div>
        </div>
      </div>

      {showDevOverlay && (
        <div className="demoBtnGroup">
          <button
            type="button"
            className="demoDamageBtn"
            onClick={() => {
              const next = Math.max(0, playerHealthRef.current - 10);
              playerHealthRef.current = next;
              setPlayerHealth(next);
              triggerPlayerHurtFeedback(hurtVignetteFlashEndRef);
            }}
          >
            −10 HP
          </button>
          <button
            type="button"
            className="demoHealBtn"
            onClick={() => {
              const next = playerHealthRef.current + 10;
              playerHealthRef.current = next;
              setPlayerHealth(next);
            }}
          >
            +10 HP
          </button>
        </div>
      )}

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
                seconds. You can also press the bound Day/Night key.
              </p>
            </SettingsSection>

            <SettingsSection title="General">
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
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Dev tools and runtime debug toggles. Stairway placement is tuned in-game
                via the panel below when enabled. Other tuning panels live in{" "}
                <code>components/tuning-panels</code> (not mounted here).
              </p>
              <p className="settingsGroupLabel">Tuning panels</p>
              <div className="settingsBtnRow" style={{ marginBottom: "0.65rem" }}>
                <button
                  type="button"
                  className="settingsBtn"
                  onClick={() => applyAllTunePanels(true)}
                >
                  Enable all panels
                </button>
                <button
                  type="button"
                  className="settingsBtn"
                  onClick={() => applyAllTunePanels(false)}
                >
                  Disable all panels
                </button>
              </div>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={stairsTuneEnabled}
                  disabled={!arenaHasStairs}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setStairsTuneEnabled(checked);
                    localStorage.setItem(STAIRS_TUNE_ENABLED_KEY, String(checked));
                  }}
                />
                Stairway tuning
                {!arenaHasStairs && (
                  <span className="settingsHint" style={{ marginLeft: "0.4rem" }}>
                    (no stairs in this arena)
                  </span>
                )}
              </label>
              <p className="settingsGroupLabel">Scene visibility (perf debug)</p>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Hide meshes to isolate FPS cost. Collision and lights stay active unless
                noted — sun toggle is the sky disc only, not the directional light.
              </p>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={devShowBarrels}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDevShowBarrels(checked);
                    devSceneShowRef.current.showBarrels = checked;
                    localStorage.setItem(DEV_SHOW_BARRELS_KEY, String(checked));
                    applyDevSceneVisibilityRef.current?.();
                  }}
                />
                Oil barrels
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={devShowEnemies}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDevShowEnemies(checked);
                    devSceneShowRef.current.showEnemies = checked;
                    localStorage.setItem(DEV_SHOW_ENEMIES_KEY, String(checked));
                    applyDevSceneVisibilityRef.current?.();
                  }}
                />
                Enemies (targets)
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={devShowStairs}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDevShowStairs(checked);
                    devSceneShowRef.current.showStairs = checked;
                    localStorage.setItem(DEV_SHOW_STAIRS_KEY, String(checked));
                    applyDevSceneVisibilityRef.current?.();
                  }}
                />
                Stairs
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={devShowContainers}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDevShowContainers(checked);
                    devSceneShowRef.current.showContainers = checked;
                    localStorage.setItem(DEV_SHOW_CONTAINERS_KEY, String(checked));
                    applyDevSceneVisibilityRef.current?.();
                  }}
                />
                VX-27 containers
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={devShowPillars}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDevShowPillars(checked);
                    devSceneShowRef.current.showPillars = checked;
                    localStorage.setItem(DEV_SHOW_PILLARS_KEY, String(checked));
                    applyDevSceneVisibilityRef.current?.();
                  }}
                />
                Pillars
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={devShowLensFlare}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDevShowLensFlare(checked);
                    devSceneShowRef.current.showLensFlare = checked;
                    localStorage.setItem(DEV_SHOW_LENS_FLARE_KEY, String(checked));
                    applyDevSceneVisibilityRef.current?.();
                  }}
                />
                Lens flare (ghosts + sun spikes)
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={devShowSunDisc}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDevShowSunDisc(checked);
                    devSceneShowRef.current.showSunDisc = checked;
                    localStorage.setItem(DEV_SHOW_SUN_DISC_KEY, String(checked));
                    applyDevSceneVisibilityRef.current?.();
                  }}
                />
                Sun disc (sky sprite, not the light)
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={devDisableHoleDecals}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDevDisableHoleDecals(checked);
                    try {
                      localStorage.setItem(DEV_DISABLE_HOLE_DECALS_KEY, String(checked));
                    } catch {}
                    // checked === true means "disable hole decals", so pass !checked
                    setBulletHolesEnabled(!checked);
                  }}
                />
                Disable hole decals (dev)
              </label>
              <p className="settingsGroupLabel">Debug tools</p>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={shadowsDisabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShadowsDisabled(checked);
                    shadowsDisabledRef.current = checked;
                    setShadowsDisabledRuntime(checked);
                    applyShadowDebugRef.current?.(checked);
                  }}
                />
                Disable all shadows (debug)
              </label>
              <p className="settingsHint" style={{ marginTop: "-0.35rem" }}>
                Sun/moon, flashlight, barrel fire, mesh cast/receive — off entirely.
                Toggle then click <strong>Start Game</strong> if the level is already
                running. Compare stair hitch with this on vs off.
              </p>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={texturesDisabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setTexturesDisabled(checked);
                    texturesDisabledRef.current = checked;
                    setTexturesDisabledRuntime(checked);
                    applyTextureDebugRef.current?.(checked);
                  }}
                />
                Disable all textures (debug)
              </label>
              <p className="settingsHint" style={{ marginTop: "-0.35rem" }}>
                Flat grey Lambert via <code>scene.overrideMaterial</code> — no map
                sampling (walls, floor, props, sky mesh). Toggle then{" "}
                <strong>Start Game</strong> if already in-level.
              </p>
              <p className="settingsGroupLabel">Shadow experiments</p>
              <label className="settingRow">
                <span>Shadow map type</span>
                <select
                  value={shadowMapType}
                  disabled={shadowsDisabled}
                  onChange={(e) => {
                    const value = e.target.value;
                    setShadowMapType(value);
                    shadowMapTypeRef.current = value;
                    setShadowMapTypeRuntime(value);
                    applyShadowExperimentRef.current?.();
                  }}
                  style={{ marginLeft: "0.5rem" }}
                >
                  {SHADOW_MAP_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={plainShadowDepth}
                  disabled={shadowsDisabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setPlainShadowDepth(checked);
                    plainShadowDepthRef.current = checked;
                    setPlainShadowDepthRuntime(checked);
                    applyShadowExperimentRef.current?.();
                  }}
                />
                Plain shadow depth (no alpha/map in cast pass)
              </label>
              <p className="settingsHint" style={{ marginTop: "-0.35rem" }}>
                Bisect the stair hitch: textures+shadows together vs plain depth or
                Basic/VSM map type. Click <strong>Start Game</strong> after changing
                if already in-level.
              </p>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={frameHitchProfiler}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFrameHitchProfiler(checked);
                    localStorage.setItem(FRAME_HITCH_PROFILER_KEY, String(checked));
                    frameHitchProfilerRef.current?.setEnabled(checked);
                  }}
                />
                Log browser long tasks to console (&gt;50ms; enable with DevTools open)
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={levelEditEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setLevelEditEnabled(checked);
                    levelEditEnabledRef.current = checked;
                    if (!checked) {
                      const prev = selectedLevelObjectRef.current;
                      if (prev) prev.material.emissive?.setHex(0x000000);
                      selectedLevelObjectRef.current = null;
                      setSelectedLevelObjectVer((v) => v + 1);
                    }
                  }}
                />
                Level object editor
              </label>
              <p className="settingsHint">
                Shoot a pillar to select it. Adjust texture offset, rotation, and position
                with sliders. Copy JSON to paste into your level file.
              </p>
              <p className="settingsGroupLabel">Player position</p>
              <p className="settingsHint">
                Live readout while settings are open. Stand at a blocked spot and copy
                coordinates below.
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
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={showPlayerCoords}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowPlayerCoords(checked);
                    localStorage.setItem(SHOW_PLAYER_COORDS_KEY, String(checked));
                  }}
                />
                Show player coordinates HUD (in-game)
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={showDevOverlay}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowDevOverlay(checked);
                    localStorage.setItem("fps-show-dev-overlay", String(checked));
                    if (checked) {
                      setHudBarTuneEnabled(true);
                      saveHudBarTuneEnabled(true);
                    }
                  }}
                />
                Show dev overlay (HP demo buttons)
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={showHud}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    showHudRef.current = checked;
                    setShowHud(checked);
                    localStorage.setItem(SHOW_HUD_KEY, String(checked));
                    gameRootRef.current?.classList.toggle("gameHudHidden", !checked);
                  }}
                />
                Show HUD (ammo, health, radar) — press H in-game
              </label>
              <label className="settingRow">
                <input
                  type="checkbox"
                  checked={showFps}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowFps(checked);
                    localStorage.setItem(SHOW_FPS_KEY, String(checked));
                  }}
                />
                Show FPS counter
              </label>
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
      <div className="devTuneStack">
        {arenaHasStairs && stairsTuneEnabled && (
          <StairTunePanel
            floorDeckY={floorDeckY}
            catwalkDeckY={catwalkDeckY}
            x={stairX}
            y={stairY}
            z={stairZ}
            rotationY={stairRotationY}
            onXChange={(value) => {
              setStairX(value);
              commitStairParams({
                ...stairParamsRef.current,
                position: { ...stairParamsRef.current.position, x: value },
              });
            }}
            onYChange={(value) => {
              setStairY(value);
              commitStairParams({
                ...stairParamsRef.current,
                position: { ...stairParamsRef.current.position, y: value },
              });
            }}
            onZChange={(value) => {
              setStairZ(value);
              commitStairParams({
                ...stairParamsRef.current,
                position: { ...stairParamsRef.current.position, z: value },
              });
            }}
            onRotationChange={(value) => {
              setStairRotationY(value);
              commitStairParams({
                ...stairParamsRef.current,
                rotationY: value,
              });
            }}
            onClose={() => {
              setStairsTuneEnabled(false);
              localStorage.setItem(STAIRS_TUNE_ENABLED_KEY, "false");
            }}
          />
        )}
      </div>
      {showFps && (
        <div ref={fpsRef} className="fpsCounter fpsCounterFixed" aria-live="polite">
          — FPS
        </div>
      )}
      {showPlayerCoords && !settingsOpen && (
        <div
          ref={playerCoordsHudRef}
          className="hudPlayerCoords"
          aria-live="polite"
          title="Click to copy JSON"
          onClick={() => {
            const json = playerCoordsHudRef.current?.dataset.coords;
            if (json) navigator.clipboard?.writeText(json);
          }}
        >
          X —  Z —  foot —
        </div>
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
          Show HUD (H)
        </button>
      )}
      <PickupFlashLayer ref={pickupFlashLayerRef} />
      <WeaponSlotStack
        grenadeCount={grenadeCount}
        flashbangCount={flashbangCount}
        selectedWeaponSlot={selectedWeaponSlot}
        weaponStackTune={weaponStackTune}
        frameX={grenFrameX}
        frameY={grenFrameY}
        layoutStyle={weaponSlotLayoutStyle}
      />
      <div ref={crosshairRef} className="crosshair crosshairVisible" />
      <div
        ref={doorInteractPromptRef}
        className="doorInteractPrompt"
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
