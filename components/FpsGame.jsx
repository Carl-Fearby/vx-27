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
  WEATHER_LAYER,
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
  createRainSystem,
  disposeRain,
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
  toggleWeather,
  WEATHER_MAX_DURATION_SEC,
} from "@/lib/weather/WeatherToggle.js";
import { createWeatherTransitionState } from "@/lib/weather/WeatherTransition.js";
import { createLightningFlashState } from "@/lib/weather/LightningFlash.js";
import {
  collectRainWetSurfaces,
  mergeRainWetSurfaces,
  resetRainWetness,
  updateRainWetness,
} from "@/lib/weather/RainWetness.js";
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
} from "@/lib/player/PlayerController";
import { createGameCoreEngine } from "@/lib/game-core/gameCore";
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
  pulseFlashlightGameplayHint,
  tickGameplayHintDisplay,
} from "@/lib/ui/GameplayHints.js";
import {
  createCenterPromptState,
  pulseCenterPrompt,
  tickCenterInteractPrompt,
} from "@/lib/ui/CenterInteractPrompt.js";
import CenterInteractPrompt from "@/components/CenterInteractPrompt";
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
  getPrimaryWeaponStartingAmmo,
  PRIMARY_WEAPONS,
  resolveFireModeForWeapon,
} from "@/lib/weapons/PrimaryWeapons";
import {
  getPrimaryWeaponIdFromSlotInput,
  wasPrimarySwapPressed,
} from "@/lib/weapons/PrimaryWeaponSlots";
import { createPistolShop, createRifleShop } from "@/lib/weapons/RifleShop";
import { createDefaultWallShopStages, SERVICE_ROOM_RIFLE_SHOP_OFFER } from "@/lib/weapons/WallWeaponShop";
import {
  applyDevStartBothPrimaryWeapons,
  loadDevStartBothPrimaryWeapons,
} from "@/lib/weapons/DevStartWeaponsTuning.js";
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
  getOilBarrelTuning,
  refreshOilBarrelMaterials,
} from "@/lib/oil-barrel/OilBarrel";
import {
  collectVx27ContainerRoomLights,
  preloadVx27ContainerAssets,
  resolveVx27ContainerForPlayer,
  collidersForRagdollNear,
  consumeVx27DoorColliderDirty,
  invalidateVx27ContainerColliderCache,
  refreshVx27ContainerRenderLayers,
  setVx27ContainerCeilingLightEnabled,
  setVx27ContainerMaterialTuning,
  updateVx27ContainerDoorAnimations,
  applyVx27ContainerDoorTuning,
  readVx27ContainerDoorTuning,
} from "@/lib/vx27-container/Vx27Container";
import {
  buildVx27ContainerCullables,
  updateVx27ContainerCulling,
} from "@/lib/vx27-container/Vx27ContainerCulling";
import {
  loadVx27ContainerCeilingLightEnabled,
} from "@/lib/vx27-container/Vx27ContainerCeilingLightTuning";
import {
  collectVx27DoorInteractMeshes,
  pickVx27DoorUnderCrosshair,
  toggleVx27ContainerDoorLeaf,
} from "@/lib/vx27-container/Vx27ContainerDoorInteract";
import {
  getControlPanelHackLabel,
} from "@/lib/control-panel/ControlPanelHackInteract";
import ConsoleHackScreen from "@/components/ConsoleHackScreen";
import { loadConsoleHackLayout } from "@/lib/console-hack/ConsoleHackLayoutTuning.js";
import { formatHackGrantedRewards } from "@/lib/console-hack/ConsoleHackGame.js";
import {
  loadVx27ContainerMaterialTuning,
  normalizeVx27ContainerMaterialTuning,
  saveVx27ContainerMaterialTuning,
} from "@/lib/vx27-container/Vx27ContainerMaterialTuning";
import {
  readVx27ContainerPlacement,
  syncVx27ContainerCollider,
} from "@/lib/vx27-container/Vx27ContainerTuning";
import {
  initOilBarrelFireLightFlicker,
} from "@/lib/oil-barrel/OilBarrelFireLight";
import {
  loadOilBarrelTuning,
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
  disposePreview,
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
  getGpuPreloadMode,
  GPU_PRELOAD_READY_LABEL,
} from "@/lib/dev/GpuPreload";
import { clearGameLocalStorage, formatGameLocalStorageJson } from "@/lib/dev/readLocalStorageTuning";
import {
  applyToxicOilSpillTuning,
  createToxicOilSpill,
  disposeToxicOilSpill,
} from "@/lib/oil-barrel/ToxicOilSpill";
import { loadToxicOilSpillTuning } from "@/lib/oil-barrel/ToxicOilSpillTuning";
import { resetArenaCeilingDayNightCache } from "@/lib/lighting/ArenaCeilingDayNight";
import { createScorePopupLayer } from "@/lib/combat/ScorePopups";
import {
  applyTargetHit,
  activateTargetAt,
  deactivateTarget,
  disposeAllTargetHealthBars,
  disposeAllHpOrbs,
  renderTargetHealthBarsPass,
  hasVisibleTargetHealthBars,
  setHealthBarOccluders,
  spawnHpOrb,
  startDeathAnimation,
  updateDeathAnimations,
  flushAllPendingRagdolls,
  flushPendingRagdolls,
  prebuildRagdollTemplates,
  updateHpOrbs,
  preloadHpOrbAssets,
  updateLiveTargetsFloorHoles,
  updateTargetsRepair,
  updateTargetHealthBars,
  resetAllTargetsToSpawn,
  blindTargetFromFlashbang,
  updateFlashbangBlindVisuals,
  getFlashbangOverlayOpacity,
} from "@/lib/combat/Targets";
import {
  flushKillPredictiveGpuWarm,
  resetKillPredictiveCache,
  updateKillPredictiveCache,
} from "@/lib/combat/KillPredictiveCache";
import { createGameLoop } from "@/lib/gameLoop/createGameLoop.js";
import { attachCombatRuntime } from "@/lib/gameLoop/attachCombatRuntime.js";
import {
  disposeAllBloodSplatters,
  spawnBloodSplatter,
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
import { createLaserTracerSystem } from "@/lib/combat/LaserTracers";
import { createEnemyMuzzlePreviewSystem } from "@/lib/combat/EnemyMuzzlePreview.js";
import {
  createEnemyNavigation,
  disposeEnemyNavigation,
} from "@/lib/combat/EnemyNavigation.js";
import {
  applyEnemyRigTuning,
  applyEnemyRigNightness,
  attachAllEnemyRigs,
  ensureEnemyRigAttached,
  preloadEnemyRig,
  refreshAllEnemyRigVisuals,
  refreshEnemyRigPerfForTargets,
  resetEnemyRigAsset,
} from "@/lib/combat/EnemyRig.js";
import {
  loadSimpleEnemyMeshes,
  setSimpleEnemyMeshesRuntime,
} from "@/lib/combat/EnemyRigPerf.js";
import {
  loadEnemyRigTuning,
  saveEnemyRigTuning,
  setEnemyRigWizardPreviewActive,
} from "@/lib/combat/EnemyRigTuning.js";
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
  DEFAULT_PISTOL_AIM_ROUND_DISPLAY,
  DEFAULT_PISTOL_HIP_ROUND_DISPLAY,
  getPistolRoundDisplayTuning,
  getWeaponRoundDisplayTuning,
  loadPistolRoundDisplayTuning,
  loadWeaponRoundDisplayTuning,
} from "@/lib/weapons/WeaponRoundDisplayTuning";
import {
  DEFAULT_LASER_EMITTER_TUNING,
  loadLaserEmitterTuning,
} from "@/lib/weapons/LaserEmitterTuning";
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
import {
  loadCargoModuleDoorTuning,
} from "@/lib/vx27-container/CargoModuleDoorGeometryTuning";
import {
  CARGO_CONSOLE_PROP_ID,
  CARGO_CONTAINER_PROP_ID,
  loadCargoModulePropsPlacement,
} from "@/lib/vx27-container/CargoModulePropsTuning";
import {
  getStackDepthInOrder,
  getStackFrameStyleFromDepth,
  resolveStackSelection,
} from "@/lib/ui/WeaponStackLayout";
import { SettingsSection } from "@/components/SettingsSection";
import EnemyRigTuningWizard from "@/components/EnemyRigTuningWizard";
import OutdoorLightingTuningWizard from "@/components/OutdoorLightingTuningWizard";
import CargoCrateSurfaceTuningWizard from "@/components/CargoCrateSurfaceTuningWizard";
import {
  DEFAULT_HEMI_DAY,
  DEFAULT_HEMI_NIGHT,
  applyHemisphereSettings,
  loadHemiDay,
  loadHemiNight,
} from "@/lib/lighting/HemisphereTuning";
import { loadStairTuning } from "@/lib/stairs/StairTuning";
import {
  applyOutdoorLightingLive,
  loadOutdoorLightingTuning,
  saveOutdoorLightingTuning,
} from "@/lib/lighting/OutdoorLightingTuning";
import {
  applySunLightColor,
  applySunLightPosition,
  loadShelteredHemiMul,
  loadSunAngles,
  loadSunDayMode,
  loadSunIntensity,
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
import { loadRecoilTuning } from "@/lib/player/RecoilTuning";
import { loadStairWalkTuning, normalizeStairWalkTuning } from "@/lib/stairs/StairWalkTuning";
import { loadHudBarTuning } from "@/lib/ui/HudBarTuning";
import {
  loadHudBottomBarTuning,
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
/** Seconds before another grenade/flashbang throw via G. */
const GRENADE_THROW_COOLDOWN_SEC = 5;

/** Bottom-right super-weapon stack — keys 1–4. */
const SECONDARY_WEAPON_UI = {
  [GRENADE_WEAPON_SLOT]: {
    label: "GRANADE",
    icon: "/ui/grenade.webp",
  },
  [FLASHBANG_WEAPON_SLOT]: {
    label: "FLASHBANG",
    icon: "/ui/grenade.webp",
  },
  3: { label: "", icon: null, reserved: true },
  4: { label: "", icon: null, reserved: true },
};

/** TEMP — every kill drops HP + ammo + grenade for pickup sound testing. */
const DEV_DROP_ALL_REWARDS = false;

const DEFAULT_WEAPON_STACK_TUNE = {
  1: { x: -39, y: -137, scale: 0.8 },
  2: { x: -21, y: -94, scale: 0.8 },
  3: { x: -12, y: -52, scale: 0.8 },
};

/** All super-weapon stack slots (1–4); stock may be zero on slots 1–2. */
function getSecondaryWeaponSlotIds() {
  return WEAPON_SLOT_IDS;
}

/** @param {number} slotId */
function isThrowableSecondarySlot(slotId) {
  return slotId === GRENADE_WEAPON_SLOT || slotId === FLASHBANG_WEAPON_SLOT;
}

/** @param {number} slotId @param {number} grenadeCount @param {number} flashbangCount */
function getSecondarySlotStock(slotId, grenadeCount, flashbangCount) {
  if (slotId === GRENADE_WEAPON_SLOT) return grenadeCount;
  if (slotId === FLASHBANG_WEAPON_SLOT) return flashbangCount;
  return null;
}

/** @param {number} slotId */
function secondaryWeaponEmptyMessage(slotId) {
  const ui = SECONDARY_WEAPON_UI[slotId];
  if (!ui) return null;
  return `No ${ui.label} left`;
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
/**
 * Show the full-screen death overlay with the given reason text. The overlay
 * is permanently mounted; we just update the reason copy and toggle classes
 * that drive the two-phase sequence (opaque hold → post-respawn fade). The
 * reflow trick (remove → reflow → re-add) lets back-to-back deaths replay
 * the animation instead of being deduped by the browser.
 */
function showDeathOverlay(overlayEl, reasonEl, reason, opts = {}) {
  const { gameOver = false, titleEl, hintEl } = opts;
  if (titleEl) {
    titleEl.textContent = gameOver ? "GAME OVER" : "YOU DIED";
  }
  if (hintEl) {
    hintEl.textContent = gameOver ? "Click to restart" : "Click to respawn";
  }
  if (reasonEl) {
    reasonEl.textContent = gameOver
      ? "No lives remaining"
      : (reason ?? "");
  }
  if (!overlayEl) return;
  overlayEl.setAttribute("aria-hidden", "false");
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
  overlayEl.setAttribute("aria-hidden", "true");
}

/** CSS overlay: 3s full blind → smooth fade out. HUD stays above (z-index 15+). */
function updateFlashbangOverlay(el, blindStartMs, gameCore = null) {
  if (!el) return;
  if (!blindStartMs) {
    el.style.opacity = "0";
    el.style.visibility = "hidden";
    return;
  }
  const elapsed = (performance.now() - blindStartMs) / 1000;
  const opacity = getFlashbangOverlayOpacity(elapsed, gameCore);
  el.style.visibility = opacity > 0 ? "visible" : "hidden";
  el.style.opacity = String(opacity);
}

function safeRequestPointerLock(canvas, retries = 3) {
  if (touchControlsGateRef.current || !canvas) {
    return;
  }
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

function getWalkPowerHudParts(el) {
  if (!el.__walkPowerHudParts) {
    el.__walkPowerHudParts = {
      track: el.querySelector(".hudStaminaTrack"),
      fill: el.querySelector(".hudWalkPowerFill"),
      radioLayer: el.querySelector(".hudWalkPowerRadioactiveLayer"),
      textWhite: el.querySelector(".hudStaminaTextWhite"),
      textBlack: el.querySelector(".hudStaminaTextBlack"),
      visible: null,
      radioactive: null,
      overload: null,
      shakeSpeed: null,
      fillWidth: null,
      orangeOp: null,
      redOp: null,
      greenOp: null,
      label: null,
      textBlackWidth: null,
    };
  }
  return el.__walkPowerHudParts;
}

function updateWalkPowerHud(el, stamina, staminaMax, playerHealth, visible) {
  if (!el) return;
  const parts = getWalkPowerHudParts(el);
  if (!visible || playerHealth <= 0) {
    if (parts.visible !== false) {
      el.style.visibility = "hidden";
      parts.visible = false;
    }
    return;
  }
  if (parts.visible !== true) {
    el.style.visibility = "visible";
    parts.visible = true;
  }

  const radioactive = playerHealth > 100;
  const overload = playerHealth > 150;
  const hpCap = radioactive ? playerHealth : 100;
  const displayVal = Math.round(Math.max(0, stamina) * 100);
  const pctOfHpCap = hpCap > 0 ? Math.min(1, displayVal / hpCap) : 0;
  let greenOp = 0;
  if (displayVal > 100 && hpCap > 100) {
    greenOp = Math.min(1, (Math.min(displayVal, hpCap) - 100) / (hpCap - 100));
  }

  const track = parts.track;
  if (track) {
    const radioactiveOn = greenOp > 0.01;
    const overloadOn = overload && radioactiveOn;
    if (parts.radioactive !== radioactiveOn) {
      track.classList.toggle("hudWalkPowerRadioactive", radioactiveOn);
      parts.radioactive = radioactiveOn;
    }
    if (parts.overload !== overloadOn) {
      track.classList.toggle("hudWalkPowerOverload", overloadOn);
      parts.overload = overloadOn;
    }
    if (greenOp > 0.01) {
      if (overload) {
        const shakeSpeed = `${Math.max(0.15, 0.6 - (Math.min(playerHealth, 190) - 150) * 0.01125)}s`;
        if (parts.shakeSpeed !== shakeSpeed) {
          track.style.setProperty("--shake-speed", shakeSpeed);
          parts.shakeSpeed = shakeSpeed;
        }
      } else {
        if (parts.shakeSpeed !== "") {
          track.style.removeProperty("--shake-speed");
          parts.shakeSpeed = "";
        }
      }
    } else {
      if (parts.shakeSpeed !== "") {
        track.style.removeProperty("--shake-speed");
        parts.shakeSpeed = "";
      }
    }
  }

  const fill = parts.fill;
  if (fill) {
    const fillWidth = `${pctOfHpCap * 100}%`;
    if (parts.fillWidth !== fillWidth) {
      fill.style.width = fillWidth;
      parts.fillWidth = fillWidth;
    }
    let orangeOp = 0;
    let redOp = 0;
    if (displayVal <= 100) {
      if (displayVal <= 50) orangeOp = 1;
      if (displayVal <= 25) redOp = 1;
    } else if (!radioactive) {
      if (pctOfHpCap <= 0.5) orangeOp = 1;
      if (pctOfHpCap <= 0.25) redOp = 1;
    }
    if (parts.orangeOp !== orangeOp) {
      fill.style.setProperty("--orange-op", orangeOp);
      parts.orangeOp = orangeOp;
    }
    if (parts.redOp !== redOp) {
      fill.style.setProperty("--red-op", redOp);
      parts.redOp = redOp;
    }
  }

  const radioLayer = parts.radioLayer;
  if (radioLayer && parts.greenOp !== greenOp) {
    radioLayer.style.opacity = String(greenOp);
    parts.greenOp = greenOp;
  }

  const label = `${displayVal}%`;
  const textWhite = parts.textWhite;
  const textBlack = parts.textBlack;
  if (parts.label !== label) {
    if (textWhite) textWhite.textContent = label;
    if (textBlack) textBlack.textContent = label;
    parts.label = label;
  }
  const textBlackWidth = `${pctOfHpCap * 100}%`;
  if (textBlack && parts.textBlackWidth !== textBlackWidth) {
    textBlack.textContent = label;
    textBlack.style.width = textBlackWidth;
    parts.textBlackWidth = textBlackWidth;
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
  cooldownBarRef,
}) {
  const visibleSlots = getSecondaryWeaponSlotIds();
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
          const stock = getSecondarySlotStock(slotId, grenadeCount, flashbangCount);
          const isReserved = weaponUi?.reserved === true;
          const isEmpty = stock != null && stock <= 0;

          return (
            <div
              key={slotId}
              className={[
                "hudSecondWeaponFrame",
                isSelected ? "hudSecondWeaponFrame--selected" : "",
                isEmpty ? "hudSecondWeaponFrame--empty" : "",
                isReserved ? "hudSecondWeaponFrame--reserved" : "",
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
                {weaponUi?.icon ? (
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
                {weaponUi?.label ? (
                  <span className="hudSecondWeaponLabel">{weaponUi.label}</span>
                ) : null}
                {stock != null ? (
                  <span className="hudSecondWeaponCount">
                    {String(stock).padStart(2, "0")}
                  </span>
                ) : (
                  <span className="hudSecondWeaponCount hudSecondWeaponCount--reserved">
                    —
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div
        ref={cooldownBarRef}
        className="hudGrenadeCooldownBar"
        aria-hidden="true"
      >
        <div className="hudGrenadeCooldownSegments" />
      </div>
    </div>
  );
});

export default function FpsGame() {
  const canvasRef = useRef(null);
  const screenCrosshairRef = useRef(null);
  const centerInteractPromptRef = useRef(null);
  const centerPromptStateRef = useRef(createCenterPromptState());
  const missionTimerHudRef = useRef(null);
  const hostileCountHudRef = useRef(null);
  const scoreHudRef = useRef(null);
  const STARTING_PLAYER_SCORE = 0;
  const playerScoreRef = useRef(STARTING_PLAYER_SCORE);
  const devStartBothPrimaryWeaponsEnabled = loadDevStartBothPrimaryWeapons();
  const rifleUnlockedRef = useRef(devStartBothPrimaryWeaponsEnabled);
  const wallShopStageRef = useRef(
    devStartBothPrimaryWeaponsEnabled
      ? { ...createDefaultWallShopStages(), rifle: 1 }
      : createDefaultWallShopStages(),
  );
  /** @type {import("@/lib/weapons/PrimaryWeapons.js").PrimaryWeaponId | null} */
  const pendingWallWeaponEquipRef = useRef(null);
  const rifleShopRef = useRef(null);
  const wallWeaponShopsRef = useRef([]);
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
  const deathTitleRef = useRef(null);
  const deathHintRef = useRef(null);
  /** Non-null while a death sequence is playing. The player stays frozen
   *  until they click to respawn. Input/physics/weapon are gated on this. */
  const deathStateRef = useRef(null);
  const grenadeSuicideRef = useRef(false);
  /** One-shot hole-fall cry — reset when no longer in a committed hole fall. */
  const holeFallCryPlayedRef = useRef(false);
  /** Callback set by the game loop to trigger a respawn from outside the
   *  effect (e.g. the overlay's onClick handler). */
  const respawnCallbackRef = useRef(null);
  const resetGameToStartScreenRef = useRef(null);
  const [invertYLook, setInvertYLook] = useState(false);
  const [renderScale, setRenderScale] = useState(DEFAULT_RENDER_SCALE);
  const renderScaleRef = useRef(DEFAULT_RENDER_SCALE);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const gameCoreRef = useRef(null);
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
  const [loadAssetLabel, setLoadAssetLabel] = useState(
    "Initializing…"
  );
  const [assetsReady, setAssetsReady] = useState(false);
  const [loadDone, setLoadDone] = useState(() => gameSessionStarted);
  const loadDoneRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [enemyRigWizardOpen, setEnemyRigWizardOpen] = useState(false);
  const [outdoorLightingWizardOpen, setOutdoorLightingWizardOpen] = useState(false);
  const [cargoCrateSurfaceWizardOpen, setCargoCrateSurfaceWizardOpen] = useState(false);
  const [enemyRigTuning, setEnemyRigTuning] = useState(() =>
    loadEnemyRigTuning(),
  );
  const [outdoorLightingTuning, setOutdoorLightingTuning] = useState(() =>
    loadOutdoorLightingTuning(),
  );
  const [cargoCrateSurfaceTuning, setCargoCrateSurfaceTuning] = useState(() =>
    loadVx27ContainerMaterialTuning(),
  );
  const [simpleEnemyMeshes, setSimpleEnemyMeshes] = useState(() =>
    loadSimpleEnemyMeshes(),
  );
  const updateEnemyRigTuning = useCallback((patch) => {
    setEnemyRigTuning((current) => {
      const next = saveEnemyRigTuning({ ...current, ...patch });
      setEnemyRigWizardPreviewActive(
        enemyRigWizardOpenRef.current && next.previewAnimation,
      );
      applyEnemyRigTuning(next);
      return next;
    });
  }, []);
  const updateOutdoorLightingTuning = useCallback((patch) => {
    setOutdoorLightingTuning((current) => {
      const next = saveOutdoorLightingTuning({ ...current, ...patch });
      sunBaseIntensityRef.current = next.sunIntensity;
      hemiDayRef.current = next.hemiDay;
      shelteredHemiMulRef.current = next.shelteredHemiMul;
      if (sunRef.current) {
        applySunLightColor(sunRef.current, next.sunTemperature);
      }
      applyDayNightRef.current?.(sunIsDayRef.current);
      return next;
    });
  }, []);
  const updateCargoCrateSurfaceTuning = useCallback((patch) => {
    setCargoCrateSurfaceTuning((current) => {
      const next = normalizeVx27ContainerMaterialTuning({ ...current, ...patch });
      saveVx27ContainerMaterialTuning(next);
      const root = levelRef.current?.group;
      if (root) setVx27ContainerMaterialTuning(next, root);
      return next;
    });
  }, []);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [showHud, setShowHud] = useState(() => loadShowHud());
  const [musicEnabled, setMusicEnabled] = useState(true);
  const musicEnabledRef = useRef(true);
  const vx27ContainerCeilingLightRef = useRef(
    loadVx27ContainerCeilingLightEnabled()
  );
  const cargoModuleDoorTuningRef = useRef(loadCargoModuleDoorTuning());
  const cargoModulePropsRef = useRef(loadCargoModulePropsPlacement());
  const toxicOilSpillTuningRef = useRef(loadToxicOilSpillTuning());
  const toxicOilSpillRef = useRef(null);
  const [rainIntensity, setRainIntensity] = useState(() => loadRainIntensity());
  const rainIntensityRef = useRef(loadRainIntensity());
  const [rainEnabled, setRainEnabled] = useState(() => loadRainEnabled());
  const rainEnabledRef = useRef(loadRainEnabled());
  const weatherSessionRef = useRef({ active: false, elapsed: 0 });
  const weatherTransitionRef = useRef(
    createWeatherTransitionState({
      rainOn: loadRainEnabled(),
    }),
  );
  const lightningFlashRef = useRef(createLightningFlashState());
  const lightningFlashOverlayRef = useRef(null);
  const weatherToggleRef = useRef(null);
  const [ammoDropSpareThreshold, setAmmoDropSpareThreshold] = useState(
    DEFAULT_AMMO_DROP_SPARE_THRESHOLD
  );
  const ammoDropSpareThresholdRef = useRef(DEFAULT_AMMO_DROP_SPARE_THRESHOLD);
  const loadingMusicTrackIdRef = useRef(loadStoredLoadingTrackId());
  const levelMusicTrackIdRef = useRef(DEFAULT_LEVEL_TRACK_ID);
  const [hudBottomBarTuning, setHudBottomBarTuning] = useState(() =>
    loadHudBottomBarTuning(),
  );
  const hbCorner = 3;
  const sceneRef = useRef(null);
  const [bindings, setBindings] = useState(() => loadBindings());
  const gameplayHintsDismissedRef = useRef(new Set());
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
  const consoleHackLayoutRef = useRef(loadConsoleHackLayout());
  const [consoleHackLayout, setConsoleHackLayout] = useState(() => loadConsoleHackLayout());
  const handleConsoleHackComplete = useCallback((rewards) => {
    playerScoreRef.current += rewards.credits ?? 0;
    gameCoreRef.current?.syncPlayerScore(playerScoreRef.current);
    updateScoreHud(scoreHudRef.current, playerScoreRef.current);

    const syncPistolSpareToActive = () => {
      if (activePrimaryIdRef.current !== "pistol") return;
      const spare = ammoPoolRef.current?.pistol?.spare ??
        ammoPoolSnapshotRef.current.pistol.spare;
      spareMagsRef.current = spare;
      setSpareMags(spare);
    };

    const syncRifleSpareToActive = () => {
      if (activePrimaryIdRef.current !== "rifle") return;
      const spare =
        ammoPoolRef.current?.rifle?.spare ??
        ammoPoolSnapshotRef.current.rifle?.spare ??
        0;
      spareMagsRef.current = spare;
      setSpareMags(spare);
    };

    const syncRifleAmmoToActive = () => {
      if (activePrimaryIdRef.current !== "rifle") return;
      const store = ammoPoolRef.current?.rifle ?? ammoPoolSnapshotRef.current.rifle;
      if (!store) return;
      roundsInMagRef.current = store.rounds;
      spareMagsRef.current = store.spare;
      setRoundsInMag(store.rounds);
      setSpareMags(store.spare);
    };

    const pushRifleStore = (store) => {
      if (ammoPoolRef.current) {
        ammoPoolRef.current.rifle = {
          rounds: store.rounds,
          spare: store.spare,
        };
      }
      ammoPoolSnapshotRef.current.rifle = {
        rounds: store.rounds,
        spare: store.spare,
      };
    };

    if (rewards.rifle) {
      rifleUnlockedRef.current = true;
      setRifleUnlocked(true);
      const wasOwned = (wallShopStageRef.current?.rifle ?? 0) >= 1;
      wallShopStageRef.current = {
        ...wallShopStageRef.current,
        rifle: Math.max(wallShopStageRef.current?.rifle ?? 0, 1),
      };
      const store = {
        ...(ammoPoolRef.current?.rifle ??
          ammoPoolSnapshotRef.current.rifle ?? { rounds: 0, spare: 0 }),
      };
      if (wasOwned) {
        store.spare += SERVICE_ROOM_RIFLE_SHOP_OFFER.resupplyMagCount;
      } else {
        const starting = getPrimaryWeaponStartingAmmo("rifle");
        store.rounds = starting.rounds;
        store.spare = starting.spare;
      }
      pushRifleStore(store);
      syncRifleAmmoToActive();
    }

    if (rewards.pistolAmmo > 0) {
      if (ammoPoolRef.current) {
        ammoPoolRef.current.pistol.spare += 1;
      }
      ammoPoolSnapshotRef.current.pistol.spare += 1;
      syncPistolSpareToActive();
    }

    if (rewards.rifleSpareMag > 0 && rifleUnlockedRef.current) {
      const store = {
        ...(ammoPoolRef.current?.rifle ??
          ammoPoolSnapshotRef.current.rifle ?? { rounds: 0, spare: 0 }),
      };
      store.spare += rewards.rifleSpareMag;
      pushRifleStore(store);
      syncRifleSpareToActive();
    } else if (rewards.rifleSpareMag > 0 && !rifleUnlockedRef.current) {
      if (ammoPoolRef.current) {
        ammoPoolRef.current.pistol.spare += 1;
      }
      ammoPoolSnapshotRef.current.pistol.spare += 1;
      syncPistolSpareToActive();
    }

    let playedHpPickup = false;
    if (rewards.medkit) {
      playerHealthRef.current = Math.min(100, playerHealthRef.current + 40 * rewards.medkit);
      gameCoreRef.current?.setPlayerHealth(playerHealthRef.current);
      soundsRef.current?.playHpPickup?.();
      playedHpPickup = true;
    }

    if (rewards.grenade) {
      grenadeCountRef.current += rewards.grenade;
      gameCoreRef.current?.syncThrowableCounts(
        grenadeCountRef.current,
        flashbangCountRef.current,
      );
      setGrenadeCount(grenadeCountRef.current);
    }
    if (rewards.flashbang) {
      flashbangCountRef.current += rewards.flashbang;
      gameCoreRef.current?.syncThrowableCounts(
        grenadeCountRef.current,
        flashbangCountRef.current,
      );
      setFlashbangCount(flashbangCountRef.current);
    }

    const displayRewards = { ...rewards };
    if (rewards.rifleSpareMag > 0 && !rifleUnlockedRef.current) {
      displayRewards.rifleSpareMag = 0;
      displayRewards.pistolAmmo = PRIMARY_WEAPONS.pistol.magazineSize;
    }

    for (const item of formatHackGrantedRewards(displayRewards, {
      grantRifleAmmo: rifleUnlockedRef.current,
    })) {
      pickupFlashLayerRef.current?.show(item.pickup);
    }
    if (
      !playedHpPickup &&
      (rewards.pistolAmmo ||
        rewards.rifleSpareMag ||
        rewards.credits ||
        rewards.grenade ||
        rewards.flashbang ||
        rewards.rifle)
    ) {
      soundsRef.current?.playSupplyPickup?.();
    }

    const pistolMagGranted =
      rewards.pistolAmmo > 0 ||
      (rewards.rifleSpareMag > 0 && !rifleUnlockedRef.current);
    const rifleMagGranted =
      rewards.rifleSpareMag > 0 && rifleUnlockedRef.current;
    const grantedActiveAmmo =
      (pistolMagGranted && activePrimaryIdRef.current === "pistol") ||
      (activePrimaryIdRef.current === "rifle" &&
        rifleUnlockedRef.current &&
        (rifleMagGranted || rewards.rifle));
    if (
      grantedActiveAmmo &&
      roundsInMagRef.current <= 0 &&
      spareMagsRef.current > 0
    ) {
      tryReloadRef.current?.(true);
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
    inputRef.current?.discardLookDelta?.();
    inputRef.current?.clearHeldState?.();
    consoleHackPanelRef.current = target.group;
    setConsoleHackPanelId(target.group.userData.controlPanelPropId ?? null);
    setConsoleHackPanelLabel(getControlPanelHackLabel(target.group));
    const hackLayout = loadConsoleHackLayout();
    consoleHackLayoutRef.current = hackLayout;
    setConsoleHackLayout(hackLayout);
    setConsoleHackOpen(true);
    resetKillPredictiveCache();
    safeExitPointerLock();
    if (musicEnabledRef.current) {
      soundsRef.current?.startHackMusic?.();
    }
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
  const enemyRigWizardOpenRef = useRef(false);
  const enemyMuzzlePreviewRef = useRef(null);
  const outdoorLightingWizardOpenRef = useRef(false);
  const cargoCrateSurfaceWizardOpenRef = useRef(false);
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

  function applyToxicOilSpill(tuning) {
    const spill = toxicOilSpillRef.current;
    if (!spill?.group) return;
    const floorY = levelRef.current?.floorY ?? 0;
    applyToxicOilSpillTuning(spill, floorY, tuning);
  }

  const syncControlPanelCollidersRef = useRef(null);
  const playerPlacementRef = useRef({ x: 0, z: 0, y: 0 });
  const arenaLiveRef = useRef(null);

  const stairParamsRef = useRef(initialStairTuning);
  const walkBobTuningRef = useRef(initialWalkBobTuning);
  const recoilTuningRef = useRef(loadRecoilTuning());
  const stairWalkTuningRef = useRef(initialStairWalkTuning);
  const sunRef = useRef(null);
  const moonRef = useRef(null);
  const sunBaseIntensityRef = useRef(loadSunIntensity(true));
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
  const shelteredHemiMulRef = useRef(loadShelteredHemiMul());
  const [fireMode, setFireMode] = useState("single");
  const [localStorageClearMsg, setLocalStorageClearMsg] = useState("");
  const [rifleUnlocked, setRifleUnlocked] = useState(
    () => loadDevStartBothPrimaryWeapons(),
  );
  const [activePrimaryWeapon, setActivePrimaryWeapon] = useState("pistol");
  const [activeMagazineSize, setActiveMagazineSize] = useState(
    PRIMARY_WEAPONS.pistol.magazineSize,
  );
  const [activeLowAmmoThreshold, setActiveLowAmmoThreshold] = useState(
    PRIMARY_WEAPONS.pistol.lowAmmoThreshold,
  );
  const [roundsInMag, setRoundsInMag] = useState(
    PRIMARY_WEAPONS.pistol.magazineSize,
  );
  const [spareMags, setSpareMags] = useState(
    PRIMARY_WEAPONS.pistol.spareMagazines,
  );
  const [playerHealth, setPlayerHealth] = useState(100);
  const pickupFlashLayerRef = useRef(null);
  const hudSyncPendingRef = useRef(false);
  const scheduleGameplayHudSyncRef = useRef(() => {});
  const tryReloadRef = useRef(null);
  const [grenadeCount, setGrenadeCount] = useState(
    () => getGrenadeParams().grenadeCount
  );
  const grenadeCountRef = useRef(getGrenadeParams().grenadeCount);
  const [flashbangCount, setFlashbangCount] = useState(DEFAULT_FLASHBANG_COUNT);
  const flashbangCountRef = useRef(DEFAULT_FLASHBANG_COUNT);
  const grenadeCooldownRemainingRef = useRef(0);
  const grenadeCooldownBarRef = useRef(null);
  const grenadeCooldownSegmentsRef = useRef(null);
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
  const [primaryAmmo, setPrimaryAmmo] = useState(() => {
    const pool = createDefaultAmmoPool();
    if (loadDevStartBothPrimaryWeapons()) {
      applyDevStartBothPrimaryWeapons(pool);
    }
    return pool;
  });
  const ammoPoolSnapshotRef = useRef((() => {
    const pool = createDefaultAmmoPool();
    if (loadDevStartBothPrimaryWeapons()) {
      applyDevStartBothPrimaryWeapons(pool);
    }
    return pool;
  })());
  /** Live combat ammo pool — set when the game loop mounts. */
  const ammoPoolRef = useRef(null);
  selectedWeaponSlotRef.current = selectedWeaponSlot;
  const [playerLives, setPlayerLives] = useState(3);
  const missionTimeRef = useRef(0);
  const hostileCountRef = useRef(0);
  const playerHealthRef = useRef(100);
  const playerLivesRef = useRef(3);
  const fireModeRef = useRef("single");
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
  const activePrimaryIdRef = useRef("pistol");
  const roundsInMagRef = useRef(PRIMARY_WEAPONS.pistol.magazineSize);
  const spareMagsRef = useRef(PRIMARY_WEAPONS.pistol.spareMagazines);
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
  const roundDisplayTuningRef = useRef(
    typeof window === "undefined"
      ? { hip: DEFAULT_HIP_ROUND_DISPLAY, aim: DEFAULT_AIM_ROUND_DISPLAY }
      : loadWeaponRoundDisplayTuning()
  );
  const [roundDisplayHip, setRoundDisplayHip] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_HIP_ROUND_DISPLAY;
    return loadWeaponRoundDisplayTuning().hip;
  });
  const [roundDisplayAim, setRoundDisplayAim] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_AIM_ROUND_DISPLAY;
    return loadWeaponRoundDisplayTuning().aim;
  });
  const [pistolRoundDisplayHip, setPistolRoundDisplayHip] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_PISTOL_HIP_ROUND_DISPLAY;
    return loadPistolRoundDisplayTuning().hip;
  });
  const [pistolRoundDisplayAim, setPistolRoundDisplayAim] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_PISTOL_AIM_ROUND_DISPLAY;
    return loadPistolRoundDisplayTuning().aim;
  });
  const pistolRoundDisplayTuningRef = useRef(
    typeof window === "undefined"
      ? {
          hip: DEFAULT_PISTOL_HIP_ROUND_DISPLAY,
          aim: DEFAULT_PISTOL_AIM_ROUND_DISPLAY,
        }
      : loadPistolRoundDisplayTuning()
  );
  const laserEmitterTuningRef = useRef(
    typeof window === "undefined"
      ? DEFAULT_LASER_EMITTER_TUNING
      : loadLaserEmitterTuning(),
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

    const pistolRoundTuning = loadPistolRoundDisplayTuning();
    pistolRoundDisplayTuningRef.current = pistolRoundTuning;
    setPistolRoundDisplayHip(pistolRoundTuning.hip);
    setPistolRoundDisplayAim(pistolRoundTuning.aim);

    const laserTuning = loadLaserEmitterTuning();
    laserEmitterTuningRef.current = laserTuning;
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
  roundDisplayTuningRef.current = getWeaponRoundDisplayTuning();
  pistolRoundDisplayTuningRef.current = getPistolRoundDisplayTuning();
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
  settingsOpenRef.current =
    settingsOpen ||
    enemyRigWizardOpen ||
    outdoorLightingWizardOpen ||
    cargoCrateSurfaceWizardOpen;
  enemyRigWizardOpenRef.current = enemyRigWizardOpen;
  outdoorLightingWizardOpenRef.current = outdoorLightingWizardOpen;
  cargoCrateSurfaceWizardOpenRef.current = cargoCrateSurfaceWizardOpen;
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

  useEffect(() => {
    if (!loadDone) return;
    applyToxicOilSpill(toxicOilSpillTuningRef.current);
  }, [loadDone]);

  const refreshGameplayHintHudRef = useRef(() => {});

  invertYRef.current = invertYLook;
  const refreshGameplayHintHud = () => {
    const now = performance.now();
    const loadDone = loadDoneRef.current;
    const showHud = showHudRef.current;
    const settingsOpen = settingsOpenRef.current;
    const controlsOpen = controlsOpenRef.current;
    const consoleHackOpen = consoleHackOpenRef.current;

    tickGameplayHintDisplay(
      centerPromptStateRef.current,
      gameplayHintRuntimeRef.current,
      {
        now,
        loadDone,
        showHud,
        settingsOpen,
        controlsOpen,
        isDay: sunIsDayRef.current,
        flashlightOn: flashlightOnRef.current,
        bindings: bindingsRef.current,
        dismissed: gameplayHintsDismissedRef.current,
        dayNightEnabled: DAY_NIGHT_SWITCHER_ENABLED,
      },
    );
    tickCenterInteractPrompt(
      centerInteractPromptRef.current,
      centerPromptStateRef.current,
      now,
      {
        pulseVisible:
          loadDone && showHud && !settingsOpen && !controlsOpen,
        persistentVisible:
          loadDone && !settingsOpen && !controlsOpen && !consoleHackOpen,
      },
    );
  };
  refreshGameplayHintHudRef.current = refreshGameplayHintHud;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resetGameGpuPreload();

    playerScoreRef.current = STARTING_PLAYER_SCORE;
    updateScoreHud(scoreHudRef.current, STARTING_PLAYER_SCORE);
    const devStartBoth = loadDevStartBothPrimaryWeapons();
    if (devStartBoth) {
      rifleUnlockedRef.current = true;
      wallShopStageRef.current = { ...createDefaultWallShopStages(), rifle: 1 };
      setRifleUnlocked(true);
    } else {
      rifleUnlockedRef.current = false;
      wallShopStageRef.current = createDefaultWallShopStages();
      setRifleUnlocked(false);
    }
    pendingWallWeaponEquipRef.current = null;
    wallWeaponShopsRef.current = [];

    let sky = null;
    let scene = null;
    let levelTextures = null;
    let disposed = false;
    let rafId = 0;
    let level = null;
    let player = null;
    let gameCore = null;
    let input = null;
    let weapon = null;
    const primaryWeapons = { rifle: null, pistol: null };
    let activePrimaryId = "pistol";
    let rifleShopInteractMeshesCache = [];
    const ammoPool = createDefaultAmmoPool();
    if (devStartBoth) {
      applyDevStartBothPrimaryWeapons(ammoPool);
      ammoPoolSnapshotRef.current = {
        rifle: { ...ammoPool.rifle },
        pistol: { ...ammoPool.pistol },
      };
    }
    ammoPoolRef.current = ammoPool;
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
    let rainWetSurfaces = null;
    let laserTracers = null;
    let enemyMuzzlePreview = null;
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
      laserTracers = createLaserTracerSystem(scene);
      laserTracers.setResolution(window.innerWidth, window.innerHeight);
      enemyMuzzlePreview = createEnemyMuzzlePreviewSystem(scene);
      enemyMuzzlePreview.setResolution(window.innerWidth, window.innerHeight);
      enemyMuzzlePreviewRef.current = enemyMuzzlePreview;
      scene.fog = new THREE.Fog(DAY_CLEAR_COLOR, 45, 95);
      sceneRef.current = scene;

      const HIP_FOV = 75;
      const ADS_FOV = 41.6;
      gameCore = await createGameCoreEngine(playerHealthRef.current);
      gameCore.syncThrowableCounts(
        grenadeCountRef.current,
        flashbangCountRef.current,
      );
      gameCore.syncPlayerScore(playerScoreRef.current);
      gameCore.syncPlayerLives(playerLivesRef.current);
      gameCoreRef.current = gameCore;
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
      camera.layers.enable(WEATHER_LAYER);
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

      reportLoad(59.5, "Enemy rig");
      if (!loadSimpleEnemyMeshes()) {
        await preloadEnemyRig();
      }
      if (!isActive()) return;

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
      if (!interiorLevel || shouldUseOutdoorSun(arena)) {
        const outdoorTuning = loadOutdoorLightingTuning();
        sunBaseIntensityRef.current = outdoorTuning.sunIntensity;
        hemiDayRef.current = outdoorTuning.hemiDay;
        shelteredHemiMulRef.current = outdoorTuning.shelteredHemiMul;
        applyOutdoorLightingLive({
          sun,
          hemi,
          sheltered,
          hemiDay: outdoorTuning.hemiDay,
          shelteredHemiMul: outdoorTuning.shelteredHemiMul,
          nightness: dayNightCurNightnessRef.current,
        });
      }
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
      level = createLevelFromConfig(scene, arenaLive, levelTextures, gameCore);
      reportLoad(68, "Enemy navigation");
      level.enemyNavigation = await createEnemyNavigation(level);
      if (!isActive()) {
        disposeEnemyNavigation(level);
        disposeLevelGroup(level.group);
        resetArenaCeilingDayNightCache();
        levelTextures?.dispose();
        return;
      }
      levelRef.current = level;
      if (!loadSimpleEnemyMeshes()) {
        await attachAllEnemyRigs(level.targets);
        applyEnemyRigTuning(loadEnemyRigTuning());
      }
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
        rain = createRainSystem(scene);
        rain.occluders = weatherOccluders;
        rainWetSurfaces = collectRainWetSurfaces(level.group);
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
      refreshOilBarrelMaterials(getOilBarrelTuning(), level.group);
      refreshVx27ContainerRenderLayers(level.group);
      refreshControlPanelRenderLayers(level.group);
      syncInteriorLighting();
      syncOilBarrelFireLightLayers(oilBarrelFireLightsRef.current, false);
      applySunLightPosition(sun, sunLightPosRef.current);
      applyMoonLightPosition(moon, moonLightPosRef.current);
      sunRef.current = sun;
      moonRef.current = moon;
      sunBaseIntensityRef.current = loadOutdoorLightingTuning().sunIntensity;
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
        sun.userData.sunRainMul = 1;
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
        const shelteredHemiMul = sheltered ? shelteredHemiMulRef.current : 1;
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
        applyEnemyRigNightness(nightness);
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
          arena,
          gameCore
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
        getRecoilTuning: () => recoilTuningRef.current,
        getStairWalkTuning: () =>
          normalizeStairWalkTuning(stairWalkTuningRef.current),
        getStaminaMax: () => {
          const hp = playerHealthRef.current;
          return hp > 100 ? hp / 100 : 1;
        },
        gameCore,
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
      reportLoad(74, "View weapon");
      const rifleCfg = PRIMARY_WEAPONS.rifle;
      const pendingPrimaryWeaponLoads = { rifle: null, pistol: null };
      function primeLoadedPrimaryWeapon(id, loadedWeapon) {
        const tuningRef = id === "pistol" ? pistolTuningRef : weaponTuningRef;
        if (id === "pistol") {
          pistolRoundDisplayTuningRef.current = loadPistolRoundDisplayTuning();
        } else if (id === "rifle") {
          roundDisplayTuningRef.current = loadWeaponRoundDisplayTuning();
        }
        const displayTuningRef =
          id === "pistol" ? pistolRoundDisplayTuningRef : roundDisplayTuningRef;
        const cfg = PRIMARY_WEAPONS[id] ?? rifleCfg;
        const ammo = ammoPoolSnapshotRef.current[id];
        loadedWeapon.setLaserEmitterOffset?.(laserEmitterTuningRef.current?.[id]);
        loadedWeapon.update(camera, 0, 0, tuningRef, {
          snapAim: true,
          roundCount: ammo?.rounds ?? cfg.magazineSize,
          roundDisplayLow:
            (ammo?.rounds ?? cfg.magazineSize) < cfg.lowAmmoThreshold ||
            ((ammo?.rounds ?? 0) === 0 && (ammo?.spare ?? 0) === 0),
          roundDisplayHp: playerHealthRef.current,
          roundDisplayStamina: player?.getStamina?.() ?? 1,
          roundDisplayTuningRef: displayTuningRef,
          laserEmitterOffset: laserEmitterTuningRef.current?.[id],
        });
      }
      function loadPrimaryWeapon(id) {
        if (disposed || currentWeaponLoad !== weaponLoadId) {
          return Promise.resolve(null);
        }
        if (primaryWeapons[id]) return Promise.resolve(primaryWeapons[id]);
        if (pendingPrimaryWeaponLoads[id]) return pendingPrimaryWeaponLoads[id];
        const cfg = PRIMARY_WEAPONS[id] ?? rifleCfg;
        pendingPrimaryWeaponLoads[id] = loadViewWeapon(camera, scene, cfg.modelUrl, {
          maxAnisotropy,
          ...cfg.viewOptions,
          weaponId: id,
          laserEmitterOffset: laserEmitterTuningRef.current?.[id],
          getRecoilTuning: () => recoilTuningRef.current,
          getGameCore: () => gameCoreRef.current,
        })
        .then((loadedWeapon) => {
          if (disposed || currentWeaponLoad !== weaponLoadId) {
            loadedWeapon?.dispose();
            return null;
          }
          primaryWeapons[id] = loadedWeapon;
          loadedWeapon.holder.visible =
            id === activePrimaryId ||
            pendingWallWeaponEquipRef.current === id;
          primeLoadedPrimaryWeapon(id, loadedWeapon);
          return loadedWeapon;
        })
        .catch((err) => {
          console.error(`Primary weapon model failed to load (${id}):`, err);
          return null;
        })
        .finally(() => {
          pendingPrimaryWeaponLoads[id] = null;
        });
        return pendingPrimaryWeaponLoads[id];
      }
      function scheduleBackgroundPrimaryWeaponLoad(id) {
        const run = () => {
          if (!disposed && currentWeaponLoad === weaponLoadId) {
            void loadPrimaryWeapon(id);
          }
        };
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(run, { timeout: 4000 });
        } else {
          window.setTimeout(run, 1500);
        }
      }
      const weaponPromise = loadPrimaryWeapon("pistol").then((pistol) => {
        if (!pistol || disposed || currentWeaponLoad !== weaponLoadId) return null;
        weapon = pistol;
        weaponRef.current = pistol;
        pistol.holder.visible = true;
        return pistol;
      });
      /** Rifle GLB is large — start loading during the load screen, not on wall purchase. */
      void weaponPromise.then(() => {
        if (!disposed && currentWeaponLoad === weaponLoadId) {
          void loadPrimaryWeapon("rifle");
        }
      });
      const rifleShop = createRifleShop(level.group, { maxAnisotropy, arena });
      const pistolShop = createPistolShop(level.group, { maxAnisotropy, arena });
      rifleShopRef.current = rifleShop;
      wallWeaponShopsRef.current = [rifleShop, pistolShop];
      rifleShopInteractMeshesCache.length = 0;
      rifleShopInteractMeshesCache.push(
        ...rifleShop.interactMeshes,
        ...pistolShop.interactMeshes,
      );
      disposeToxicOilSpill(toxicOilSpillRef.current);
      toxicOilSpillRef.current = createToxicOilSpill(
        level.group,
        level.floorY ?? 0,
        toxicOilSpillTuningRef.current,
        { maxAnisotropy },
      );
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

      function updateGrenadeCooldownHud() {
        const bar = grenadeCooldownBarRef.current;
        if (!bar) return;
        const rem = grenadeCooldownRemainingRef.current;
        const active = rem > 0;
        bar.classList.toggle("hudGrenadeCooldownBar--active", active);
        let segments = grenadeCooldownSegmentsRef.current;
        if (!segments || segments.parentElement !== bar) {
          segments = bar.querySelector(".hudGrenadeCooldownSegments");
          grenadeCooldownSegmentsRef.current = segments;
        }
        if (segments) {
          const remainingRatio = rem / GRENADE_THROW_COOLDOWN_SEC;
          // Full bar on throw → clip from the right → empty → hide.
          const clipRight = (1 - remainingRatio) * 100;
          segments.style.clipPath = `inset(0 ${clipRight}% 0 0)`;
        }
      }

      function showGrenadeCooldownHint(now) {
        pulseCenterPrompt(
          centerPromptStateRef.current,
          "Grenade cooling down",
          now,
        );
      }

      function tickCenterInteractPromptHud(now) {
        tickCenterInteractPrompt(
          centerInteractPromptRef.current,
          centerPromptStateRef.current,
          now,
          {
            pulseVisible:
              loadDoneRef.current &&
              showHudRef.current &&
              !settingsOpenRef.current &&
              !controlsOpenRef.current,
            persistentVisible:
              loadDoneRef.current &&
              !settingsOpenRef.current &&
              !controlsOpenRef.current &&
              !consoleHackOpenRef.current,
          },
        );
      }
      let lastTime = performance.now();

      function syncPointerLocked() {
        const locked = document.pointerLockElement === canvas;
        if (locked) sounds.resume();
      }

      const liveTargetsScratch = [];
      const gameLoopCtx = {
        isDisposed: () => disposed,
        scene,
        level,
        camera,
        player,
        get gameCore() { return gameCore; },
        input,
        get weapon() { return weapon; },
        set weapon(v) { weapon = v; },
        sounds,
        renderer,
        get sky() { return sky; },
        arena,
        rain,
        get rainWetSurfaces() {
          return rainWetSurfaces;
        },
        lastTime: performance.now(),
        simTime: 0,
        grenadeHeld: false,
        healthRegenTimer: 0,
        radioactiveOverflowDecayTimer: 0,
        _lastHostileCount: -1,
        get activePrimaryId() { return activePrimaryId; },
        set activePrimaryId(v) { activePrimaryId = v; },
        get flashTimeout() { return flashTimeout; },
        set flashTimeout(v) { flashTimeout = v; },
        grenades,
        bloodSplatters,
        pendingKillBlood,
        bloodAfterRagdoll,
        hpOrbs,
        ammoDrops,
        grenadeDrops,
        collectibleEntries,
        liveTargetsScratch,
        allColliders,
        levelHitMeshes,
        primaryWeapons,
        ensurePrimaryWeaponLoaded: loadPrimaryWeapon,
        weaponSwap,
        ammoPool,
        hitRaycaster,
        shootRaycaster,
        laserTracers,
        enemyMuzzlePreview,
        enemyMuzzlePreviewRef,
        enemyRigWizardOpenRef,
        screenCenter,
        canvas,
        canvasHeight: window.innerHeight,
        flickerLights,
        oilBarrelRuntimeIndex,
        screenCrosshairRef,
        crosshairTuningRef,
        rainEnabledRef,
        rainIntensityRef,
        outdoorLights,
        targetSpawnCtx,
        get scorePopupLayer() { return scorePopupLayer; },
        vx27DoorInteractMeshesCache,
        rifleUnlockedRef,
        wallShopStageRef,
        pendingWallWeaponEquipRef,
        rifleShopRef,
        wallWeaponShopsRef,
        rifleShopInteractMeshesCache,
        setRifleUnlocked,
        syncAllColliders,
        playerHealthRef,
        playerScoreRef,
        showHudRef,
        scoreHudRef,
        deathStateRef,
        spareMagsRef,
        grenadeCountRef,
        flashbangCountRef,
        ammoDropSpareThresholdRef,
        roundsInMagRef,
        fireModeRef,
        fireModeByWeaponRef,
        activePrimaryIdRef,
        weaponRef,
        pistolTuningRef,
        weaponTuningRef,
        walkBobTuningRef,
        recoilTuningRef,
        stairWalkTuningRef,
        ammoPoolSnapshotRef,
        scheduleGameplayHudSyncRef,
        settingsOpenRef,
        playerCoordsMenuRef,
        rebindActionRef,
        bindingsRef,
        controlsOpenRef,
        consoleHackOpenRef,
        holeFallCryPlayedRef,
        playerPlacementRef,
        playerLivesRef,
        grenadeSuicideRef,
        deathOverlayRef,
        deathReasonRef,
        deathTitleRef,
        deathHintRef,
        flashbangOverlayRef,
        flashbangBlindStartRef,
        compassTapeRef,
        compassViewportRef,
        compassMarkersRef,
        compassBlipsRef,
        touchShowInteractRef,
        touchShowHackRef,
        centerInteractPromptRef,
        centerPromptStateRef,
        controlPanelsRef,
        openConsoleHackRef,
        dayNightCurNightnessRef,
        dayNightTargetNightnessRef,
        dayNightDemoCycleElapsedRef,
        dayNightToggleRef,
        weatherSessionRef,
        weatherTransitionRef,
        weatherToggleRef,
        lightningFlash: lightningFlashRef.current,
        lightningFlashOverlayRef,
        sunIsDayRef,
        gameplayHintsDismissedRef,
        gameplayHintRuntimeRef,
        refreshGameplayHintHudRef,
        flashlightOnRef,
        selectedWeaponSlotRef,
        grenadeCooldownRemainingRef,
        missionTimeRef,
        hostileCountRef,
        missionTimerHudRef,
        hostileCountHudRef,
        damageVignetteRef,
        hurtVignetteRef,
        hurtVignetteFlashEndRef,
        walkPowerRef,
        loadDoneRef,
        pickupFlashLayerRef,
        vx27ContainersRef,
        vx27ContainerCullablesRef,
        roomCullablesRef,
        arenaLiveRef,
        sunRef,
        moonRef,
        refitSunShadowRef,
        refitMoonShadowRef,
        oilBarrelTuningRef,
        oilBarrelFireLightsRef,
        roomLightsRef,
        roundDisplayTuningRef,
        pistolRoundDisplayTuningRef,
        laserEmitterTuningRef,
        gameRootRef,
        rendererRef,
        arenaHalf,
        attachWall,
        applyDayNightRef,
        setPlayerHealth,
        setGrenadeCount,
        setFlashbangCount,
        setPlayerLives,
        setSelectedWeaponSlot,
        setFireMode,
        setActivePrimaryWeapon,
        setActiveMagazineSize,
        setActiveLowAmmoThreshold,
        setRoundsInMag,
        setSpareMags,
        setTouchShowInteract,
        setTouchShowHack,
        showDeathOverlay,
        beginDeathOverlayFade,
        hideDeathOverlay,
        updateFlashbangOverlay: (el, blindStartMs) =>
          updateFlashbangOverlay(el, blindStartMs, gameCoreRef.current),
        updateFlashbangBlindVisuals: (targets, simTime) =>
          updateFlashbangBlindVisuals(targets, simTime, gameCoreRef.current),
        safeRequestPointerLock,
        updateDamageVignette,
        updateHurtVignette,
        updateWalkPowerHud,
        updateScoreHud,
        updateMissionTimerHud,
        updateHostileCountHud,
        triggerPlayerHurtFeedback,
        secondaryWeaponEmptyMessage,
        isThrowableSecondarySlot,
        showGrenadeCooldownHint,
        updateGrenadeCooldownHud,
        tickCenterInteractPrompt: tickCenterInteractPromptHud,
      };
      attachCombatRuntime(gameLoopCtx);
      tryReloadRef.current = gameLoopCtx.tryReload ?? null;

      resetGameToStartScreenRef.current = () => {
        if (disposed) return;

        gameSessionStarted = false;
        loadDoneRef.current = false;
        setLoadDone(false);

        sounds?.updateOilBarrelFire?.(oilBarrelRuntimeIndex.fireLights, false);

        input?.discardLookDelta?.();
        input?.clearHeldState?.();
        safeExitPointerLock();

        hideDeathOverlay(deathOverlayRef.current);
        deathStateRef.current = null;

        if (consoleHackOpenRef.current) {
          closeConsoleHackRef.current?.();
        }

        playerScoreRef.current = STARTING_PLAYER_SCORE;
        gameCore?.syncPlayerScore(STARTING_PLAYER_SCORE);
        updateScoreHud(scoreHudRef.current, STARTING_PLAYER_SCORE);

        playerLivesRef.current = 3;
        gameCore?.syncPlayerLives(3);
        setPlayerLives(3);

        playerHealthRef.current = 100;
        gameCore?.setPlayerHealth(100);
        gameCore?.resetPlayerCore?.();
        setPlayerHealth(100);

        grenadeCountRef.current = getGrenadeParams().grenadeCount;
        setGrenadeCount(grenadeCountRef.current);
        flashbangCountRef.current = DEFAULT_FLASHBANG_COUNT;
        setFlashbangCount(flashbangCountRef.current);
        gameCore?.syncThrowableCounts(
          grenadeCountRef.current,
          flashbangCountRef.current,
        );
        gameCore?.setGrenadeCooldown(0);
        grenadeCooldownRemainingRef.current = 0;
        flashbangBlindStartRef.current = 0;
        updateFlashbangOverlay(flashbangOverlayRef.current, 0);
        grenadeSuicideRef.current = false;
        holeFallCryPlayedRef.current = false;

        missionTimeRef.current = 0;
        updateMissionTimerHud(missionTimerHudRef.current, 0);
        hostileCountRef.current = 0;
        updateHostileCountHud(hostileCountHudRef.current, 0);

        const devStartBothWeapons = loadDevStartBothPrimaryWeapons();
        if (devStartBothWeapons) {
          rifleUnlockedRef.current = true;
          wallShopStageRef.current = { ...createDefaultWallShopStages(), rifle: 1 };
          setRifleUnlocked(true);
        } else {
          rifleUnlockedRef.current = false;
          wallShopStageRef.current = createDefaultWallShopStages();
          setRifleUnlocked(false);
        }
        pendingWallWeaponEquipRef.current = null;

        Object.assign(ammoPool, createDefaultAmmoPool());
        if (devStartBothWeapons) {
          applyDevStartBothPrimaryWeapons(ammoPool);
        }
        ammoPoolSnapshotRef.current = {
          rifle: { ...ammoPool.rifle },
          pistol: { ...ammoPool.pistol },
        };

        fireModeByWeaponRef.current = createDefaultFireModePool();
        fireModeRef.current = fireModeByWeaponRef.current.pistol;
        setFireMode(fireModeRef.current);
        setSelectedWeaponSlot(GRENADE_WEAPON_SLOT);
        selectedWeaponSlotRef.current = GRENADE_WEAPON_SLOT;

        disposeAllHpOrbs(hpOrbs);
        hpOrbs.length = 0;
        disposeAllAmmoDrops(ammoDrops);
        ammoDrops.length = 0;
        disposeAllGrenades(grenades, scene);
        grenades.length = 0;
        disposeAllGrenadeDrops(grenadeDrops);
        grenadeDrops.length = 0;
        disposeAllBloodSplatters(bloodSplatters, scene);
        bloodSplatters.length = 0;
        pendingKillBlood.length = 0;
        bloodAfterRagdoll.length = 0;
        disposeAllBulletHoles();
        resetKillPredictiveCache();

        if (level?.targets?.length) {
          resetAllTargetsToSpawn(level.targets, {
            config: level.targetConfig,
            bounds: level.arenaBounds,
            colliders: level.colliders,
            floorHoles: level.floorHoles,
            spawnCtx: targetSpawnCtx,
            gameCore: gameCoreRef.current,
          });
        }

        player?.respawn();
        if (primaryWeapons.rifle) {
          primaryWeapons.rifle.holder.visible = false;
        }
        if (primaryWeapons.pistol) {
          primaryWeapons.pistol.holder.visible = true;
        }
        activePrimaryId = "pistol";
        gameLoopCtx.setActivePrimaryWeaponView("pistol");
        gameLoopCtx.loadActiveAmmo("pistol");
        weapon = primaryWeapons.pistol ?? null;
        weaponRef.current = weapon;
        weapon?.replayRaise?.();

        const wallShops = wallWeaponShopsRef.current;
        if (Array.isArray(wallShops)) {
          for (const shop of wallShops) shop?.syncWallPrice?.(gameLoopCtx);
        } else {
          rifleShopRef.current?.syncWallPrice?.(gameLoopCtx);
        }

        sounds?.stopLevelMusic();
        if (musicEnabledRef.current) {
          sounds?.resume();
          sounds?.startLoadingMusic({ trackId: loadingMusicTrackIdRef.current });
        }

        scheduleGameplayHudSyncRef.current?.();
      };

      const animate = createGameLoop(gameLoopCtx, {
        isDisposed: () => disposed,
        isReady: () => gameReady,
        scheduleNextFrame: (fn) => {
          rafId = requestAnimationFrame(fn);
        },
      });

      onCanvasClick = (e) => {
        if (e.target !== canvas) return;
        if (!loadDoneRef.current) return;
        sounds.resume();
        if (loadDoneRef.current && musicEnabledRef.current) {
          sounds.startLevelMusic({ trackId: levelMusicTrackIdRef.current });
        }
        const ds = deathStateRef.current;
        if (
          ds?.gameOver &&
          performance.now() >= ds.minDisplayEnd
        ) {
          resetGameToStartScreenRef.current?.();
          return;
        }
        if (ds && !ds.respawned && !ds.gameOver && performance.now() >= ds.minDisplayEnd) {
          const now = performance.now();
          const respawn =
            gameCoreRef.current?.planPlayerRespawn(now, DEATH_FADE_MS) ??
            {
              canRespawn: true,
              playerHealth: 100,
              fadeEndTime: now + DEATH_FADE_MS,
            };
          if (!respawn.canRespawn) return;
          player.respawn();
          weapon?.replayRaise?.();
          ds.respawned = true;
          ds.fadeEndTime = respawn.fadeEndTime;
          playerHealthRef.current = respawn.playerHealth;
          setPlayerHealth(respawn.playerHealth);
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
          if (enemyRigWizardOpenRef.current) {
            setEnemyRigWizardOpen(false);
          } else if (outdoorLightingWizardOpenRef.current) {
            setOutdoorLightingWizardOpen(false);
          } else if (cargoCrateSurfaceWizardOpenRef.current) {
            setCargoCrateSurfaceWizardOpen(false);
          } else if (settingsOpenRef.current) {
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
        gameLoopCtx.canvasHeight = h;
        laserTracers?.setResolution(w, h);
        enemyMuzzlePreview?.setResolution(w, h);
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

      const gpuWarmMode = getGpuPreloadMode();
      reportLoad(98, getGpuPreloadLoadLabel(gpuWarmMode));
      const spawnFootY = player.getFootY();
      const spawnEyeY = player.getY();
      const spawnX = player.getX();
      const spawnZ = player.getZ();
      const spawnYaw = player.getYaw?.() ?? 0;
      const getShadowFrameOpts = () => {
        return {
          sunCastsShadow:
            sunRef.current?.castShadow && sunRef.current.intensity > 0.001,
          moonCastsShadow:
            moonRef.current?.castShadow && moonRef.current.intensity > 0.001,
          dayNightAnimating: false,
          flashlightShadow: weapon?.isFlashlightCastingShadow?.() ?? false,
        };
      };
      if (gpuWarmMode === "full") {
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
          spawnX,
          spawnEyeY,
          spawnZ,
          spawnFootY,
          spawnYaw,
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
          spawnX,
          spawnEyeY: player.getY(),
          spawnZ,
          spawnFootY: player.getFootY(),
          spawnYaw,
          getShadowFrameOpts,
          frames: level.vx27ContainerMeshes?.length ? 8 : 4,
          isActive,
        });
      }
      if (rainWetSurfaces && level?.group) {
        mergeRainWetSurfaces(rainWetSurfaces, level.group);
      }
      if (!isActive()) return;
      reportLoad(99, GPU_PRELOAD_READY_LABEL);

      scorePopupContainer = document.createElement("div");
      scorePopupContainer.className = "killCalloutLayer";
      scorePopupContainer.setAttribute("aria-hidden", "true");
      gameRootRef.current?.appendChild(scorePopupContainer);
      scorePopupLayer = createScorePopupLayer(scorePopupContainer);

      gameReady = true;
      reportLoad(100, "Ready");
      setAssetsReady(true);
      scheduleBackgroundPrimaryWeaponLoad("rifle");
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
      ammoPoolRef.current = null;
      tryReloadRef.current = null;
      resetGameToStartScreenRef.current = null;
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
        disposeEnemyNavigation(level);
        disposeLevelGroup(level.group);
        resetArenaCeilingDayNightCache();
        resetLightingZoneCache();
        level = null;
      }
      resetEnemyRigAsset();
      if (targets) {
        disposeAllTargetHealthBars(targets);
      }
      disposeAllHpOrbs(hpOrbs);
      disposeCompassCollectibleMarkers(collectibleEntries);
      disposeAllAmmoDrops(ammoDrops);
      disposeAllGrenades(grenades, scene);
      disposeAllGrenadeDrops(grenadeDrops);
      disposeAllBloodSplatters(bloodSplatters, scene);
      laserTracers?.dispose();
      laserTracers = null;
      enemyMuzzlePreview?.dispose();
      enemyMuzzlePreview = null;
      enemyMuzzlePreviewRef.current = null;
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
      rifleShopRef.current = null;
      wallWeaponShopsRef.current = [];
      screenCrosshairRef.current?.dispose();
      screenCrosshairRef.current = null;
      soundsRef.current?.dispose();
      soundsRef.current = null;
      gameCoreRef.current = null;
      respawnCallbackRef.current = null;
      hemiRef.current = null;
      inputRef.current = null;
      input?.dispose();
      sky?.dispose();
      skyRef.current = null;
      disposeRain(rain);
      rain = null;
      resetRainWetness(rainWetSurfaces ?? []);
      rainWetSurfaces = null;
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
        pulseFlashlightGameplayHint(
          centerPromptStateRef.current,
          bindingsRef.current,
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

  const handleWeatherToggle = (opts = {}) => {
    toggleWeather(
      {
        rainEnabledRef,
        weatherSessionRef,
        setRainEnabled,
      },
      opts,
    );
  };
  weatherToggleRef.current = handleWeatherToggle;

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
        {!loadDone && assetsReady ? (
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
        ) : null}
        {!loadDone && !assetsReady ? (
          <>
            <div className="loadingBarTrack">
              <div className="loadingBarFill" style={{ width: `${loadProgress}%` }} />
            </div>
            <div className="loadingAssetLabel">{loadAssetLabel}</div>
          </>
        ) : null}
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

      {/* Storm lightning — cool white pulse while raining (game loop opacity) */}
      <div ref={lightningFlashOverlayRef} className="lightningFlashOverlay" aria-hidden="true" />

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
                  <p className="settingsHint" style={{ marginTop: 0 }}>
                    Outdoor rain with intensity from light drizzle up to 500%
                    storm. Off in containers. While playing, press <kbd>.</kbd> to
                    start rain (auto-off after{" "}
                    {Math.round(WEATHER_MAX_DURATION_SEC / 60)} min); press{" "}
                    <kbd>.</kbd> again to stop. Rain darkens and shines outdoor
                    floor textures while it lasts.
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
              <p className="settingsGroupLabel">Enemy performance</p>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Simple meshes use the lightweight procedural rifle dummy and skip
                the PX-27 GLB rigs. With GLB enabled, every hostile uses the
                full PX-27 model at all distances.
              </p>
              <label className="settingsRow">
                <input
                  type="checkbox"
                  checked={simpleEnemyMeshes}
                  onChange={async (event) => {
                    const next = event.target.checked;
                    setSimpleEnemyMeshesRuntime(next);
                    setSimpleEnemyMeshes(next);
                    const targets = levelRef.current?.targets ?? [];
                    const playerPos = cameraRef.current?.position;
                    if (!next) {
                      await preloadEnemyRig();
                      for (const mesh of targets) {
                        mesh.userData.hasRifle = true;
                        await ensureEnemyRigAttached(
                          mesh,
                          mesh.userData.height,
                        );
                      }
                      applyEnemyRigTuning(loadEnemyRigTuning());
                    }
                    refreshAllEnemyRigVisuals(targets);
                    if (playerPos) {
                      refreshEnemyRigPerfForTargets(targets, playerPos);
                    }
                  }}
                />
                Simple enemy meshes (max FPS)
              </label>
              <p className="settingsGroupLabel">Cargo crate surfaces</p>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                VX-27 cargo module exterior, interior, and corner materials.
                Brighten shadowed panels after outdoor lighting changes.
              </p>
              <button
                type="button"
                className="settingsBtn settingsInlineBtn"
                onClick={() => {
                  safeExitPointerLock();
                  setSettingsOpen(false);
                  setCargoCrateSurfaceWizardOpen(true);
                }}
              >
                Open cargo crate surface wizard…
              </button>
              <p className="settingsGroupLabel">Outdoor lighting</p>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Live sun and hemisphere fill for outdoor arenas. Values persist in
                localStorage and can be copied as JSON to bake into defaults.
              </p>
              <button
                type="button"
                className="settingsBtn settingsInlineBtn"
                onClick={() => {
                  safeExitPointerLock();
                  setSettingsOpen(false);
                  setOutdoorLightingWizardOpen(true);
                }}
              >
                Open outdoor lighting wizard…
              </button>
              <p className="settingsGroupLabel">Enemy rig wizard</p>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Opens beside the game for live rifle-enemy alignment and animation
                preview. Enemy damage remains disabled by default.
              </p>
              <button
                type="button"
                className="settingsBtn settingsInlineBtn"
                onClick={() => {
                  safeExitPointerLock();
                  setSettingsOpen(false);
                  setEnemyRigWizardOpen(true);
                }}
              >
                Open enemy rig wizard…
              </button>
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
              <p className="settingsGroupLabel">Tuning export</p>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Copies every <code>fps-*</code> localStorage entry as JSON — paste into
                chat to bake into <code>lib/*Tuning.js</code> defaults.
              </p>
              <button
                type="button"
                className="settingsBtn settingsInlineBtn"
                onClick={() => {
                  navigator.clipboard?.writeText(formatGameLocalStorageJson());
                }}
              >
                Copy tuning JSON
              </button>
              <p className="settingsGroupLabel">Tuning reset</p>
              <p className="settingsHint" style={{ marginTop: 0 }}>
                Removes every <code>fps-*</code> localStorage entry (settings, stale
                tuning overrides). Built-in defaults apply after reload.
              </p>
              <button
                type="button"
                className="settingsBtn settingsInlineBtn"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Remove all fps-* localStorage entries? Reload the page afterward to apply built-in defaults.",
                    )
                  ) {
                    return;
                  }
                  const removed = clearGameLocalStorage();
                  setLocalStorageClearMsg(
                    removed
                      ? `Removed ${removed} entries. Reload to apply built-in defaults.`
                      : "No fps-* entries to remove.",
                  );
                }}
              >
                Clear fps-* localStorage
              </button>
              {localStorageClearMsg ? (
                <p className="settingsHint" role="status">
                  {localStorageClearMsg}
                </p>
              ) : null}
            </SettingsSection>
            </div>
          </div>
        </div>
      )}
      {cargoCrateSurfaceWizardOpen && (
        <CargoCrateSurfaceTuningWizard
          tuning={cargoCrateSurfaceTuning}
          onChange={updateCargoCrateSurfaceTuning}
          onClose={() => setCargoCrateSurfaceWizardOpen(false)}
        />
      )}
      {outdoorLightingWizardOpen && (
        <OutdoorLightingTuningWizard
          tuning={outdoorLightingTuning}
          onChange={updateOutdoorLightingTuning}
          onClose={() => setOutdoorLightingWizardOpen(false)}
        />
      )}
      {enemyRigWizardOpen && (
        <EnemyRigTuningWizard
          tuning={enemyRigTuning}
          onChange={updateEnemyRigTuning}
          onClose={() => {
            setEnemyRigWizardOpen(false);
            setEnemyRigWizardPreviewActive(false);
            enemyMuzzlePreviewRef.current?.setVisible(false);
            updateEnemyRigTuning({
              previewAnimation: false,
              previewReverse: false,
            });
          }}
        />
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
      <HudPrimaryWeaponStack
        activePrimaryWeapon={activePrimaryWeapon}
        primaryAmmo={primaryAmmo}
        rifleUnlocked={rifleUnlocked}
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
        cooldownBarRef={grenadeCooldownBarRef}
      />
      <CenterInteractPrompt promptRef={centerInteractPromptRef} />
      <div
        ref={deathOverlayRef}
        className="deathOverlay"
        role="alertdialog"
        aria-live="assertive"
        aria-hidden="true"
        onClick={(e) => {
          e.stopPropagation();
          const ds = deathStateRef.current;
          if (
            ds?.gameOver &&
            performance.now() >= ds.minDisplayEnd
          ) {
            resetGameToStartScreenRef.current?.();
            return;
          }
          if (ds && !ds.respawned && !ds.gameOver && performance.now() >= ds.minDisplayEnd) {
            const now = performance.now();
            const respawn =
              gameCoreRef.current?.planPlayerRespawn(now, DEATH_FADE_MS) ??
              {
                canRespawn: true,
                playerHealth: 100,
                fadeEndTime: now + DEATH_FADE_MS,
              };
            if (!respawn.canRespawn) return;
            respawnCallbackRef.current?.();
            ds.respawned = true;
            ds.fadeEndTime = respawn.fadeEndTime;
            playerHealthRef.current = respawn.playerHealth;
            setPlayerHealth(respawn.playerHealth);
            grenadeCountRef.current = getGrenadeParams().grenadeCount;
            setGrenadeCount(grenadeCountRef.current);
            gameCoreRef.current?.syncThrowableCounts(
              grenadeCountRef.current,
              flashbangCountRef.current,
            );
            flashbangBlindStartRef.current = 0;
            updateFlashbangOverlay(flashbangOverlayRef.current, 0);
            beginDeathOverlayFade(deathOverlayRef.current);
          }
          safeRequestPointerLock(canvasRef.current);
        }}
      >
        <div className="deathOverlayInner">
          <h1 ref={deathTitleRef} className="deathOverlayTitle">
            YOU DIED
          </h1>
          <p
            ref={deathReasonRef}
            className="deathOverlayReason"
          />
          <p ref={deathHintRef} className="deathOverlayHint">
            Click to respawn
          </p>
        </div>
      </div>
    </div>
  );
}
