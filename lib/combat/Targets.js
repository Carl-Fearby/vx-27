import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  disposeBloodMarksOnTarget,
  reparentBloodMarks,
  spawnBloodSplatter,
} from "./BloodParticles.js";
import {
  applyRewardExpireVisual,
  ensureRewardOwnMaterials,
  getRewardExpireVisuals,
} from "../pickups/RewardFlash.js";
import {
  beginHoleFall,
  HOLE_FALL_REMOVE_DEPTH,
  pointInFloorHole,
  pushCircleOutOfColliders,
  rotatedBoxOverlapsCircle,
  tickHoleFallY,
  updateEntityForFloorHole,
} from "../physics/Collision.js";
import { HEALTH_BAR_LAYER } from "../lighting/LightingLayers.js";
import { resetTargetScoreState } from "./Score.js";
import {
  getWeaponDamageProfile,
  resolveBodyZoneDamage,
  resolveHeadshotDamage,
  TARGET_DAMAGE,
} from "./WeaponDamage.js";
import { requireWasmMethod } from "@/lib/game-core/requireWasm.js";
import { resolveVx27ContainerForPlayer } from "../vx27-container/Vx27Container.js";
import {
  clampToBoundsCore,
  tickRagdollCoreToppleCore,
  tickRagdollHoleFallCore,
  tickRagdollLaunchCore,
} from "./RagdollPhysicsCore.js";
import {
  applyFlashbangBlindToTarget,
  isFlashbangBlindExpired,
} from "./FlashbangBlind.js";
import {
  resolveTargetRespawnPlacementCore,
} from "./TargetSpawn.js";
import { resolveEnemyAiConfig } from "./EnemyAi.js";

export { TARGET_DAMAGE };

export const DEFAULT_TARGET_CONFIG = {
  count: 5,
  radius: 0.45,
  height: 1.75,
  maxHealth: 30,
  respawnDelay: 4,
  spawnMargin: 1.5,
  repairPerSecond: 0.63,
  repairDelayAfterHit: 1.25,
};

const HEALTH_FULL = { r: 0xcc, g: 0x22, b: 0x22 };
const HEALTH_AMBER = { r: 0xe8, g: 0xa0, b: 0x20 };
const HEALTH_LOW = { r: 0x44, g: 0x22, b: 0x22 };

function rgbToHex({ r, g, b }) {
  return (r << 16) | (g << 8) | b;
}

/**
 * Subtle emissive tint matching the RAG color. Strength is set on the material's
 * `emissiveIntensity` (see `TARGET_EMISSIVE_INTENSITY`), not baked into the hex,
 * so dim values do not collapse to 0 in low channels.
 */
function ragEmissiveHex(ratio) {
  const { r, g, b } = getHealthBarRgb(ratio);
  return (r << 16) | (g << 8) | b;
}

/**
 * Targets are fully scene-lit — no emissive bleed. The RAG tint still lives on
 * `material.emissive` so a future hit pulse can briefly raise `emissiveIntensity`,
 * but at rest the body fades to black with the scene.
 */
const TARGET_EMISSIVE_INTENSITY = 0;

/** @param {import("../level/loadArena.js").ArenaConfig} arena */
export function resolveTargetConfig(arena) {
  const t = arena.target ?? {};
  return {
    count: t.count ?? arena.targets?.length ?? DEFAULT_TARGET_CONFIG.count,
    radius: t.radius ?? (t.width != null ? t.width / 2 : undefined) ?? DEFAULT_TARGET_CONFIG.radius,
    height: t.height ?? DEFAULT_TARGET_CONFIG.height,
    maxHealth: t.maxHealth ?? DEFAULT_TARGET_CONFIG.maxHealth,
    respawnDelay: t.respawnDelay ?? DEFAULT_TARGET_CONFIG.respawnDelay,
    spawnMargin: t.spawnMargin ?? DEFAULT_TARGET_CONFIG.spawnMargin,
    repairPerSecond: t.repairPerSecond ?? DEFAULT_TARGET_CONFIG.repairPerSecond,
    repairDelayAfterHit:
      t.repairDelayAfterHit ?? DEFAULT_TARGET_CONFIG.repairDelayAfterHit,
    spawnPoints: Array.isArray(t.spawnPoints) ? t.spawnPoints : [],
    ai: resolveEnemyAiConfig(t.ai),
  };
}

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function lerpRgb(c0, c1, t) {
  return {
    r: lerpChannel(c0.r, c1.r, t),
    g: lerpChannel(c0.g, c1.g, t),
    b: lerpChannel(c0.b, c1.b, t),
  };
}

function rgbToCss({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

/** @param {number} ratio 0–1 */
export function getHealthBarRgb(ratio) {
  const r = THREE.MathUtils.clamp(ratio, 0, 1);
  if (r >= 0.5) {
    return lerpRgb(HEALTH_AMBER, HEALTH_FULL, (r - 0.5) * 2);
  }
  return lerpRgb(HEALTH_LOW, HEALTH_AMBER, r * 2);
}

/** @param {number} ratio 0–1 */
export function getHealthBarColor(ratio) {
  return rgbToCss(getHealthBarRgb(ratio));
}

const HEALTH_BAR_CANVAS_W = 320;
const HEALTH_BAR_PCT_FONT_BASE = 14;
/** 400% bigger than baseline (5× label area + type size). */
const HEALTH_BAR_PCT_TEXT_SCALE = 5;
const HEALTH_BAR_PCT_FONT_PX =
  HEALTH_BAR_PCT_FONT_BASE * HEALTH_BAR_PCT_TEXT_SCALE;
const HEALTH_BAR_LABEL_H = 18 * HEALTH_BAR_PCT_TEXT_SCALE;
const HEALTH_BAR_BAR_H = 32;
const HEALTH_BAR_CANVAS_H = HEALTH_BAR_LABEL_H + HEALTH_BAR_BAR_H;
/** World width at ~1 m; scaled up with distance so it stays a small HUD strip. */
const HEALTH_BAR_WORLD_W_NEAR = 0.22;
const HEALTH_BAR_WORLD_W_PER_M = 0.055;
const HEALTH_BAR_WORLD_W_MAX = 0.55;
const HEALTH_BAR_FILL_SPEED = 14;
const _healthBarWorldPos = new THREE.Vector3();
const _healthBarAimPos = new THREE.Vector3();
const _healthBarLosOrigin = new THREE.Vector3();
const _healthBarLosDir = new THREE.Vector3();
const _healthBarLosHits = [];
const _healthBarLosRaycaster = new THREE.Raycaster();
const HEALTH_BAR_HIT_PULSE_DECAY = 18;
/** Level root for line-of-sight checks (walls, pillars, room shells). */
let healthBarOccluderRoot = null;

/** Seconds the bar stays fully visible after a hit before starting to fade. */
const HEALTH_BAR_HIT_HOLD_DURATION = 3;
/** Seconds the bar takes to fade from full-visible to invisible. */
const HEALTH_BAR_HIT_FADE_DURATION = 0.5;

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawHealthBarCanvas(ctx, ratio, hitFlash = 0) {
  const w = HEALTH_BAR_CANVAS_W;
  const h = HEALTH_BAR_CANVAS_H;
  ctx.clearRect(0, 0, w, h);

  const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
  const pctLabel = `${Math.round(clamped * 100)}%`;
  ctx.font = `600 ${HEALTH_BAR_PCT_FONT_PX}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.lineWidth = 3 * HEALTH_BAR_PCT_TEXT_SCALE;
  ctx.strokeText(pctLabel, w / 2, HEALTH_BAR_LABEL_H / 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.fillText(pctLabel, w / 2, HEALTH_BAR_LABEL_H / 2);

  const barH = Math.round(HEALTH_BAR_BAR_H * 0.72);
  const barY =
    HEALTH_BAR_LABEL_H + Math.round((HEALTH_BAR_BAR_H - barH) / 2);
  const trackW = Math.round(w * 0.94);
  const barX = Math.round((w - trackW) / 2);
  const radius = barH / 2;
  const fillW =
    clamped <= 0 ? 0 : Math.max(2, Math.round(trackW * clamped));

  ctx.fillStyle = "rgba(8, 10, 14, 0.72)";
  roundRect(ctx, barX, barY, trackW, barH, radius);
  ctx.fill();

  if (fillW > 0) {
    const { r, g, b } = getHealthBarRgb(clamped);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.save();
    ctx.beginPath();
    ctx.rect(barX, barY, fillW, barH);
    ctx.clip();
    roundRect(ctx, barX, barY, trackW, barH, radius);
    ctx.fill();
    ctx.restore();

    const strokeAlpha = 0.38 + Math.min(1, hitFlash) * 0.5;
    ctx.strokeStyle = `rgba(255, 255, 255, ${strokeAlpha})`;
    ctx.lineWidth = 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(barX, barY, fillW, barH);
    ctx.clip();
    roundRect(ctx, barX + 1, barY + 1, trackW - 2, barH - 2, radius - 1);
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;
  roundRect(ctx, barX + 0.5, barY + 0.5, trackW - 1, barH - 1, radius - 0.5);
  ctx.stroke();
}

function createHealthBarSprite(height) {
  const canvas = document.createElement("canvas");
  canvas.width = HEALTH_BAR_CANVAS_W;
  canvas.height = HEALTH_BAR_CANVAS_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = HEALTH_BAR_CANVAS_H / HEALTH_BAR_CANVAS_W;
  const nearH = HEALTH_BAR_WORLD_W_NEAR * aspect;
  const yOffset = ((HEALTH_BAR_LABEL_H / 2) / HEALTH_BAR_CANVAS_H) * nearH;
  sprite.scale.set(HEALTH_BAR_WORLD_W_NEAR, nearH, 1);
  sprite.position.set(0, height * 0.56 + yOffset, 0);
  sprite.layers.set(HEALTH_BAR_LAYER);
  sprite.renderOrder = 25;
  sprite.userData.healthBarCanvas = canvas;
  sprite.userData.healthBarCtx = ctx;
  sprite.userData.healthBarTexture = texture;
  sprite.userData.hitFlash = 0;
  sprite.userData.barYOffset =
    (HEALTH_BAR_LABEL_H / 2) / HEALTH_BAR_CANVAS_H;
  return sprite;
}

function targetHealthRatio(mesh) {
  const ud = mesh.userData;
  if (!ud.maxHealth) return 0;
  return THREE.MathUtils.clamp(ud.health / ud.maxHealth, 0, 1);
}

function paintHealthBar(mesh, ratio) {
  const bar = mesh.userData.healthBar;
  if (!bar) return;
  drawHealthBarCanvas(
    bar.userData.healthBarCtx,
    ratio,
    bar.userData.hitFlash ?? 0
  );
  bar.userData.healthBarTexture.needsUpdate = true;
}

function setHealthBarTarget(mesh, ratio) {
  mesh.userData.healthBarTargetRatio = THREE.MathUtils.clamp(ratio, 0, 1);
}

function resetHealthBarAnimation(mesh, ratio = 1) {
  const r = THREE.MathUtils.clamp(ratio, 0, 1);
  mesh.userData.healthBarDisplayRatio = r;
  mesh.userData.healthBarTargetRatio = r;
  paintHealthBar(mesh, r);
}

/** Show the RAG + percentage strip immediately after damage (bullet, grenade, etc.). */
export function flashTargetHealthBarOnHit(mesh, ratio) {
  const bar = mesh.userData.healthBar;
  if (!bar) return;
  const r = THREE.MathUtils.clamp(ratio, 0, 1);
  mesh.userData.healthBarTargetRatio = r;
  mesh.userData.healthBarDisplayRatio = r;
  mesh.userData.healthBarHitTime = 0;
  mesh.userData.healthBarHitVisibility = 1;
  bar.userData.hitFlash = 1;
  paintHealthBar(mesh, r);
  bar.material.opacity = 1;
}

/** @param {THREE.Object3D | null} root */
export function setHealthBarOccluders(root) {
  healthBarOccluderRoot = root;
}

/** @type {{ playerX: number, playerZ: number, containers: THREE.Object3D[], colliders: import("../physics/Collision.js").ColliderBox[] } | null} */
let healthBarLosContext = null;

function resolveSharedVx27Container(mesh, losContext) {
  if (!losContext) return null;
  const targetContainer = resolveVx27ContainerForPlayer(
    mesh.position.x,
    mesh.position.z,
    losContext.containers,
    losContext.colliders,
  );
  if (!targetContainer) return null;
  const playerContainer = resolveVx27ContainerForPlayer(
    losContext.playerX,
    losContext.playerZ,
    losContext.containers,
    losContext.colliders,
  );
  return playerContainer && playerContainer === targetContainer ? targetContainer : null;
}

function isDescendantOf(object, ancestor) {
  let o = object;
  while (o) {
    if (o === ancestor) return true;
    o = o.parent;
  }
  return false;
}

/**
 * True when no level geometry blocks the ray from the camera to the target body.
 * @param {THREE.Mesh} mesh
 * @param {THREE.Camera} camera
 * @param {{
 *   playerX: number,
 *   playerZ: number,
 *   containers: THREE.Object3D[],
 *   colliders: import("../physics/Collision.js").ColliderBox[],
 * } | null} [losContext]
 */
export function isTargetVisibleFromCamera(mesh, camera, losContext = healthBarLosContext) {
  if (!healthBarOccluderRoot || !camera) return true;

  if (resolveSharedVx27Container(mesh, losContext)) return true;

  const height = mesh.userData.height ?? 2.2;
  mesh.getWorldPosition(_healthBarAimPos);
  _healthBarAimPos.y += height * 0.05;

  _healthBarLosOrigin.copy(camera.position);
  _healthBarLosDir.subVectors(_healthBarAimPos, _healthBarLosOrigin);
  const dist = _healthBarLosDir.length();
  if (dist < 0.08) return true;

  _healthBarLosDir.multiplyScalar(1 / dist);
  _healthBarLosRaycaster.set(_healthBarLosOrigin, _healthBarLosDir);
  _healthBarLosRaycaster.far = dist + 0.08;
  _healthBarLosRaycaster.near = 0.05;

  _healthBarLosHits.length = 0;
  _healthBarLosRaycaster.intersectObject(
    healthBarOccluderRoot,
    true,
    _healthBarLosHits
  );

  for (const hit of _healthBarLosHits) {
    if (hit.object.isSprite) continue;
    if (isDescendantOf(hit.object, mesh)) return true;
    return false;
  }
  return true;
}

function refreshHealthBarVisibility(mesh, camera, losContext = healthBarLosContext) {
  const bar = mesh.userData.healthBar;
  if (!bar) return;

  const alive = mesh.visible && mesh.userData.health > 0;
  const hitVis = mesh.userData.healthBarHitVisibility ?? 0;
  if (!alive || hitVis <= 0) {
    bar.visible = false;
    return;
  }

  bar.visible =
    !camera || isTargetVisibleFromCamera(mesh, camera, losContext);
}

export function syncTargetHealthBar(mesh, camera) {
  const bar = mesh.userData.healthBar;
  if (!bar) return;

  refreshHealthBarVisibility(mesh, camera);
  if (!bar.visible) return;

  const ratio = targetHealthRatio(mesh);
  setHealthBarTarget(mesh, ratio);
}

function tickHealthBar(mesh, dt) {
  const bar = mesh.userData.healthBar;
  if (!bar?.visible) return;

  const target = mesh.userData.healthBarTargetRatio ?? 1;
  let display = mesh.userData.healthBarDisplayRatio ?? 1;
  let dirty = false;

  if (Math.abs(display - target) > 0.0005) {
    const blend = 1 - Math.exp(-HEALTH_BAR_FILL_SPEED * dt);
    display += (target - display) * blend;
    if (Math.abs(display - target) < 0.001) display = target;
    mesh.userData.healthBarDisplayRatio = display;
    dirty = true;
  }

  if (bar.userData.hitFlash > 0) {
    bar.userData.hitFlash = Math.max(
      0,
      bar.userData.hitFlash - dt * HEALTH_BAR_HIT_PULSE_DECAY
    );
    dirty = true;
  }

  if (dirty) paintHealthBar(mesh, display);
}

function updateHealthBarScale(mesh, camera) {
  const bar = mesh.userData.healthBar;
  if (!bar?.visible) return;

  mesh.getWorldPosition(_healthBarWorldPos);
  const dist = Math.max(0.5, camera.position.distanceTo(_healthBarWorldPos));
  const worldW = THREE.MathUtils.clamp(
    HEALTH_BAR_WORLD_W_NEAR + dist * HEALTH_BAR_WORLD_W_PER_M,
    HEALTH_BAR_WORLD_W_NEAR,
    HEALTH_BAR_WORLD_W_MAX
  );
  const aspect = HEALTH_BAR_CANVAS_H / HEALTH_BAR_CANVAS_W;
  const worldH = worldW * aspect;
  bar.scale.set(worldW, worldH, 1);
  const height = mesh.userData.height ?? 2.2;
  const yOffset = (bar.userData.barYOffset ?? 0) * worldH;
  bar.position.set(0, height * 0.56 + yOffset, 0);
}

/**
 * Advance the per-target "seconds since last hit" timer and push the resulting
 * opacity into the bar. The bar stays fully opaque for HOLD seconds, then
 * linearly fades over FADE seconds to invisible. Bar color stays neutral white
 * so the canvas's painted RAG fill renders at its true color — no scene
 * lighting affects readability.
 */
function updateHealthBarHitFade(mesh, dt) {
  const bar = mesh.userData.healthBar;
  if (!bar) return;

  const totalLifetime =
    HEALTH_BAR_HIT_HOLD_DURATION + HEALTH_BAR_HIT_FADE_DURATION;
  let t = mesh.userData.healthBarHitTime ?? Infinity;
  if (t < totalLifetime) {
    t = Math.min(totalLifetime, t + dt);
    mesh.userData.healthBarHitTime = t;
  }

  let vis;
  if (t <= HEALTH_BAR_HIT_HOLD_DURATION) {
    vis = 1;
  } else if (t >= totalLifetime) {
    vis = 0;
  } else {
    vis = 1 - (t - HEALTH_BAR_HIT_HOLD_DURATION) / HEALTH_BAR_HIT_FADE_DURATION;
  }

  mesh.userData.healthBarHitVisibility = vis;
  bar.material.opacity = vis;
  bar.material.color.setRGB(1, 1, 1);
}

/**
 * Smoothly animate health bars toward current target health and fade out the
 * hit-visibility timer. LOS raycasts are staggered across frames to reduce cost.
 */
const HEALTH_BAR_LOS_INTERVAL = 4;
let _healthBarLosFrame = 0;

export function updateTargetHealthBars(
  targets,
  dt,
  camera /* , scene */,
  losContext = healthBarLosContext,
) {
  _healthBarLosFrame += 1;
  for (let i = 0; i < targets.length; i += 1) {
    const mesh = targets[i];
    if (!mesh.userData.healthBar) continue;
    const hitVis = mesh.userData.healthBarHitVisibility ?? 0;
    if (
      !camera ||
      hitVis > 0 ||
      (_healthBarLosFrame + i) % HEALTH_BAR_LOS_INTERVAL === 0
    ) {
      refreshHealthBarVisibility(mesh, camera, losContext);
    }
    tickHealthBar(mesh, dt);
    if (camera) updateHealthBarScale(mesh, camera);
    updateHealthBarHitFade(mesh, dt);
  }
}

/** True when at least one health bar sprite is visible (skip GPU pass otherwise). */
export function hasVisibleTargetHealthBars(targets) {
  if (!targets?.length) return false;
  for (const mesh of targets) {
    if (mesh.userData.healthBar?.visible) return true;
  }
  return false;
}

/**
 * Draw visible health bar sprites after world + room (depth-tested against geometry).
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {THREE.Mesh[]} targets
 */
export function renderTargetHealthBarsPass(renderer, scene, camera, targets) {
  if (!hasVisibleTargetHealthBars(targets)) return;

  const prevAutoClear = renderer.autoClear;
  const prevMask = camera.layers.mask;

  for (const mesh of targets) {
    if (!mesh.visible || mesh.userData.health <= 0) continue;
    const bar = mesh.userData.healthBar;
    if (!bar?.visible) continue;
    mesh.updateMatrixWorld(true);
    bar.updateMatrixWorld(true);
  }

  try {
    renderer.autoClear = false;
    camera.layers.set(HEALTH_BAR_LAYER);
    renderer.render(scene, camera);
  } finally {
    renderer.autoClear = prevAutoClear;
    camera.layers.mask = prevMask;
  }
}

/**
 * Draw health bars in hit-flash + low-HP states so first damage doesn't hitch.
 * @param {THREE.Mesh[]} targets
 * @param {{ renderFrame?: (r: THREE.WebGLRenderer, s: THREE.Scene, c: THREE.Camera) => void, frames?: number, renderer?: THREE.WebGLRenderer, scene?: THREE.Scene, camera?: THREE.Camera }} [opts]
 */
export async function warmupTargetHealthBarGpu(targets, opts = {}) {
  if (!targets?.length) return;

  const renderFrame = opts.renderFrame;
  const frames = opts.frames ?? 3;
  const saved = [];

  for (const mesh of targets.slice(0, 3)) {
    const bar = mesh.userData?.healthBar;
    if (!bar) continue;
    saved.push({
      mesh,
      hitFlash: bar.userData.hitFlash ?? 0,
      visible: bar.visible,
      hitVisibility: mesh.userData.healthBarHitVisibility ?? 0,
      hitTime: mesh.userData.healthBarHitTime ?? Infinity,
      displayRatio: mesh.userData.healthBarDisplayRatio ?? 1,
      targetRatio: mesh.userData.healthBarTargetRatio ?? 1,
    });
    bar.userData.hitFlash = 1;
    bar.visible = true;
    mesh.userData.healthBarHitVisibility = 1;
    mesh.userData.healthBarHitTime = 0;
    mesh.userData.healthBarDisplayRatio = 0.32;
    mesh.userData.healthBarTargetRatio = 0.32;
    paintHealthBar(mesh, 0.32);
  }

  if (renderFrame && saved.length) {
    for (let i = 0; i < frames; i += 1) {
      renderFrame(opts.renderer, opts.scene, opts.camera);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  for (const state of saved) {
    const bar = state.mesh.userData.healthBar;
    if (!bar) continue;
    bar.userData.hitFlash = state.hitFlash;
    bar.visible = state.visible;
    state.mesh.userData.healthBarHitVisibility = state.hitVisibility;
    state.mesh.userData.healthBarHitTime = state.hitTime;
    state.mesh.userData.healthBarDisplayRatio = state.displayRatio;
    state.mesh.userData.healthBarTargetRatio = state.targetRatio;
    paintHealthBar(state.mesh, state.displayRatio);
  }
}

export function disposeTargetHealthBar(mesh) {
  const bar = mesh.userData.healthBar;
  if (!bar) return;
  mesh.remove(bar);
  bar.material.map?.dispose();
  bar.material.dispose();
  mesh.userData.healthBar = null;
}

/** @param {THREE.Mesh[]} targets */
export function disposeAllTargetHealthBars(targets) {
  for (const mesh of targets) {
    disposeTargetHealthBar(mesh);
  }
}

function overlapsBox(x, z, radius, margin, box, gameCore = null) {
  return rotatedBoxOverlapsCircle(box, x, z, radius + margin, gameCore);
}

/** @param {number} [footY] @param {number} [bodyTop] @param {import("@/lib/game-core/types.ts").GameCoreEngine | null} [gameCore] */
function pushOutOfWalls(px, pz, r, colliders, footY, bodyTop, gameCore = null) {
  if (!colliders) return { x: px, z: pz };
  return pushCircleOutOfColliders(px, pz, r, colliders, { footY, bodyTop, gameCore });
}

/* ── Hit-zone definitions ─────────────────────────────────────────────
 * fromTop / toTop are fractions measured from the top of the model.
 * mult is the damage multiplier applied to TARGET_DAMAGE.
 * color is the vertex-color RGB used to visually distinguish each band.
 */
export const HIT_ZONES = [
  { id: "head",        fromTop: 0.00, toTop: 0.08, mult: 2.5,  color: [0.95, 0.15, 0.12] },
  { id: "neck",        fromTop: 0.08, toTop: 0.14, mult: 2.0,  color: [0.95, 0.35, 0.12] },
  { id: "upper_chest", fromTop: 0.14, toTop: 0.25, mult: 1.5,  color: [0.95, 0.55, 0.12] },
  { id: "lower_chest", fromTop: 0.25, toTop: 0.32, mult: 1.25, color: [0.95, 0.75, 0.15] },
  { id: "stomach",     fromTop: 0.32, toTop: 0.42, mult: 1.1,  color: [0.85, 0.85, 0.12] },
  { id: "pelvis",      fromTop: 0.42, toTop: 0.48, mult: 1.0,  color: [0.55, 0.85, 0.12] },
  { id: "thigh",       fromTop: 0.48, toTop: 0.70, mult: 0.75, color: [0.20, 0.75, 0.25] },
  { id: "knee",        fromTop: 0.70, toTop: 0.78, mult: 1.0,  color: [0.85, 0.55, 0.12] },
  { id: "lower_leg",   fromTop: 0.78, toTop: 0.92, mult: 0.6,  color: [0.12, 0.60, 0.70] },
  { id: "foot",        fromTop: 0.92, toTop: 1.00, mult: 0.4,  color: [0.20, 0.30, 0.85] },
  { id: "arm",         fromTop: 0.14, toTop: 0.46, mult: 0.65, color: [0.15, 0.65, 0.85] },
];

const BODY_ZONES = HIT_ZONES.filter((z) => z.id !== "arm");

/* ── Target pose ──────────────────────────────────────────────────── */

export const DEFAULT_TARGET_POSE = {
  armAngle: 0.45,
  elbowBend: 0.0,
  legAngle: 0.10,
  armOffset: 0.12,
  legOffset: 0.048,
  ankleBend: 0.0,
};

/** Chest-ready pose: firing hand on the grip, support hand under the handguard. */
export const RIFLE_TARGET_POSE = {
  ...DEFAULT_TARGET_POSE,
  rifleHold: true,
  legAngle: 0.19,
  legOffset: 0.065,
};

const TARGET_RIFLE_COLOR = 0xf0f2f4;

function createTargetRifle(height) {
  const rear = new THREE.Vector3(height * -0.02, height * 0.36, height * -0.01);
  const muzzle = new THREE.Vector3(height * -0.02, height * 0.36, height * 0.34);
  const geometry = new THREE.CylinderGeometry(
    height * 0.018,
    height * 0.025,
    rear.distanceTo(muzzle),
    8,
  );
  orientGeometryBetween(geometry, rear, muzzle);

  const material = new THREE.MeshLambertMaterial({ color: TARGET_RIFLE_COLOR });
  const rifle = new THREE.Mesh(geometry, material);
  rifle.name = "target-rifle-placeholder";
  rifle.castShadow = true;
  rifle.receiveShadow = true;
  rifle.userData.muzzleLocal = muzzle.clone();
  rifle.userData.isTargetRifle = true;
  return rifle;
}

function getRifleArmJoints(height) {
  const point = (x, y, z) => new THREE.Vector3(x * height, y * height, z * height);
  return {
    L: {
      shoulder: point(0.12, 0.33, 0),
      elbow: point(0.12, 0.20, 0.11),
      hand: point(-0.015, 0.34, 0.24),
    },
    R: {
      shoulder: point(-0.12, 0.33, 0),
      elbow: point(-0.18, 0.18, 0.05),
      hand: point(-0.05, 0.35, 0.12),
    },
  };
}

function orientGeometryBetween(geometry, start, end) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  geometry.applyQuaternion(quaternion);
  geometry.translate(midpoint.x, midpoint.y, midpoint.z);
  return geometry;
}

function rifleArmPart(start, end, radiusTop, radiusBottom, sides, color) {
  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    start.distanceTo(end),
    sides,
  );
  return paintColor(orientGeometryBetween(geometry, start, end), color);
}

function rifleHandPart(elbow, hand, height, color) {
  const handDirection = new THREE.Vector3().subVectors(hand, elbow).normalize();
  const halfLength = height * 0.035;
  const start = hand.clone().addScaledVector(handDirection, -halfLength);
  const end = hand.clone().addScaledVector(handDirection, halfLength);
  return rifleArmPart(start, end, height * 0.018, height * 0.021, 6, color);
}

/* ── Humanoid geometry builder ────────────────────────────────────── */

function paintColor(g, color) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = color[0];
    c[i * 3 + 1] = color[1];
    c[i * 3 + 2] = color[2];
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
  return g;
}

function coloredPart(geo, color, x, y, z) {
  const g = geo.clone();
  g.translate(x ?? 0, y, z ?? 0);
  return paintColor(g, color);
}

function buildHumanoidGeometry(height, pose) {
  const h = height;
  const S = 8;
  const p = pose ?? DEFAULT_TARGET_POSE;
  const parts = [];

  const zy = (from, to) => h * (0.5 - (from + to) / 2);
  const zh = (from, to) => h * (to - from);

  const z = Object.fromEntries(HIT_ZONES.map((zone) => [zone.id, zone]));

  // Head — sphere
  parts.push(coloredPart(
    new THREE.SphereGeometry(0.055 * h, S + 2, S), z.head.color,
    0, zy(z.head.fromTop, z.head.toTop), 0,
  ));

  // Neck — thin cylinder
  parts.push(coloredPart(
    new THREE.CylinderGeometry(0.032 * h, 0.038 * h, zh(z.neck.fromTop, z.neck.toTop), S),
    z.neck.color, 0, zy(z.neck.fromTop, z.neck.toTop), 0,
  ));

  // Torso segments — oval cross-section for a human silhouette
  const TORSO_XS = 1.15;
  const TORSO_ZS = 0.7;
  const torsoZones = [
    { zone: z.upper_chest, rTop: 0.100, rBot: 0.092 },
    { zone: z.lower_chest, rTop: 0.092, rBot: 0.080 },
    { zone: z.stomach,     rTop: 0.080, rBot: 0.075 },
    { zone: z.pelvis,      rTop: 0.078, rBot: 0.090 },
  ];
  for (const { zone, rTop, rBot } of torsoZones) {
    const cyl = new THREE.CylinderGeometry(rTop * h, rBot * h, zh(zone.fromTop, zone.toTop), S);
    cyl.scale(TORSO_XS, 1, TORSO_ZS);
    cyl.translate(0, zy(zone.fromTop, zone.toTop), 0);
    parts.push(paintColor(cyl, zone.color));
  }

  // Arms — upper arm, elbow sphere, forearm (bendable), hand
  const armTotalH = zh(z.arm.fromTop, z.arm.toTop);
  const armOff = (p.armOffset ?? 0.12) * h;
  const armAngle = p.armAngle ?? 0.45;
  const elbowBend = p.elbowBend ?? 0.0;
  const shoulderDrop = 0.03;
  const shoulderY = h * (0.5 - z.arm.fromTop - shoulderDrop);

  const upperArmH = armTotalH * 0.46;
  const forearmH = armTotalH * 0.38;
  const handH = armTotalH * 0.14;
  const elbowR = 0.032 * h;
  const upperArmGeo = new THREE.CylinderGeometry(0.028 * h, 0.024 * h, upperArmH, S);
  const elbowGeo = new THREE.SphereGeometry(elbowR, S, S - 2);
  const forearmGeo = new THREE.CylinderGeometry(0.023 * h, 0.019 * h, forearmH, S);
  const handGeo = new THREE.BoxGeometry(0.026 * h, handH, 0.018 * h);

  const shoulderR = 0.034 * h;
  const shoulderGeo = new THREE.SphereGeometry(shoulderR, S, S - 2);

  // Trapezius slope from neck base down to each shoulder
  const neckBaseY = zy(z.neck.fromTop, z.neck.toTop) - zh(z.neck.fromTop, z.neck.toTop) / 2;
  const trapTopR = 0.033 * h;
  const trapBotR = 0.045 * h;
  const trapDy = neckBaseY - shoulderY;
  const trapLen = Math.sqrt(armOff * armOff + trapDy * trapDy);
  const trapTilt = Math.atan2(armOff, trapDy);
  for (const sign of [-1, 1]) {
    const trap = new THREE.CylinderGeometry(trapTopR, trapBotR, trapLen, S);
    trap.scale(1, 1, TORSO_ZS);
    trap.translate(0, -trapLen / 2, 0);
    trap.rotateZ(sign * trapTilt);
    trap.translate(0, neckBaseY, 0);
    parts.push(paintColor(trap, z.upper_chest.color));
  }

  if (p.rifleHold) {
    const joints = getRifleArmJoints(h);
    for (const side of ["L", "R"]) {
      const { shoulder, elbow, hand } = joints[side];
      const sh = shoulderGeo.clone();
      sh.scale(1.0, 1, 1.15);
      sh.translate(shoulder.x, shoulder.y, shoulder.z);
      parts.push(paintColor(sh, z.arm.color));
      parts.push(rifleArmPart(
        shoulder,
        elbow,
        0.024 * h,
        0.028 * h,
        S,
        z.arm.color,
      ));

      const eb = elbowGeo.clone();
      eb.translate(elbow.x, elbow.y, elbow.z);
      parts.push(paintColor(eb, z.arm.color));
      parts.push(rifleArmPart(
        elbow,
        hand,
        0.019 * h,
        0.023 * h,
        S,
        z.arm.color,
      ));
      parts.push(rifleHandPart(elbow, hand, h, z.arm.color));
    }
  } else {
    for (const sign of [-1, 1]) {
      const sh = shoulderGeo.clone();
      sh.scale(1.0, 1, 1.15);
      sh.translate(sign * armOff, shoulderY, 0);
      parts.push(paintColor(sh, z.arm.color));

      const ua = upperArmGeo.clone();
      ua.translate(0, -upperArmH / 2, 0);
      ua.rotateZ(sign * armAngle);
      ua.translate(sign * armOff, shoulderY, 0);
      parts.push(paintColor(ua, z.arm.color));

      const elbowLocalY = -upperArmH;
      const eb = elbowGeo.clone();
      eb.translate(0, elbowLocalY, 0);
      eb.rotateZ(sign * armAngle);
      eb.translate(sign * armOff, shoulderY, 0);
      parts.push(paintColor(eb, z.arm.color));

      // Forearm + hand pivot around the elbow (bends forward)
      const fa = forearmGeo.clone();
      fa.translate(0, -forearmH / 2, 0);
      fa.rotateX(-elbowBend);
      fa.translate(0, elbowLocalY, 0);
      fa.rotateZ(sign * armAngle);
      fa.translate(sign * armOff, shoulderY, 0);
      parts.push(paintColor(fa, z.arm.color));

      const hd = handGeo.clone();
      hd.translate(0, -forearmH - handH / 2, 0);
      hd.rotateX(-elbowBend);
      hd.translate(0, elbowLocalY, 0);
      hd.rotateZ(sign * armAngle);
      hd.translate(sign * armOff, shoulderY, 0);
      parts.push(paintColor(hd, z.arm.color));
    }
  }

  // Waist ball — between stomach and pelvis
  const waistY = zy(z.stomach.toTop, z.stomach.toTop);
  const waistR = 0.082 * h;
  const waistGeo = new THREE.SphereGeometry(waistR, S, S - 2);
  waistGeo.scale(TORSO_XS, 1, TORSO_ZS);
  waistGeo.translate(0, waistY, 0);
  parts.push(paintColor(waistGeo, z.pelvis.color));

  // Legs — hip ball, thigh, knee sphere, lower leg
  const legOff = (p.legOffset ?? 0.048) * h;
  const legAngle = p.legAngle ?? 0.10;
  const hipY = h * (0.5 - z.thigh.fromTop);
  const hipR = 0.050 * h;
  const hipGeo = new THREE.SphereGeometry(hipR, S, S - 2);
  const kneeR = 0.050 * h;
  const kneeSphereGeo = new THREE.SphereGeometry(kneeR, S, S - 2);
  const kneeY = zy(z.knee.fromTop, z.knee.toTop);

  // Hip balls
  for (const sign of [-1, 1]) {
    const hp = hipGeo.clone();
    hp.scale(TORSO_XS, 1, TORSO_ZS);
    hp.translate(sign * legOff, hipY, 0);
    parts.push(paintColor(hp, z.pelvis.color));
  }

  const legZones = [
    { zone: z.thigh,     rTop: 0.048, rBot: 0.040 },
    { zone: z.lower_leg, rTop: 0.037, rBot: 0.030 },
  ];
  for (const { zone, rTop, rBot } of legZones) {
    const base = new THREE.CylinderGeometry(rTop * h, rBot * h, zh(zone.fromTop, zone.toTop), S);
    const cy = zy(zone.fromTop, zone.toTop);
    for (const sign of [-1, 1]) {
      const g = base.clone();
      g.translate(0, cy - hipY, 0);
      g.rotateZ(sign * legAngle);
      g.translate(sign * legOff, hipY, 0);
      parts.push(paintColor(g, zone.color));
    }
  }

  // Knee spheres
  for (const sign of [-1, 1]) {
    const k = kneeSphereGeo.clone();
    k.translate(0, kneeY - hipY, 0);
    k.rotateZ(sign * legAngle);
    k.translate(sign * legOff, hipY, 0);
    parts.push(paintColor(k, z.knee.color));
  }

  // Ankle spheres
  const ankleY = zy(z.lower_leg.toTop, z.foot.fromTop);
  const ankleR = 0.032 * h;
  const ankleSphereGeo = new THREE.SphereGeometry(ankleR, S, S - 2);
  for (const sign of [-1, 1]) {
    const a = ankleSphereGeo.clone();
    a.translate(0, ankleY - hipY, 0);
    a.rotateZ(sign * legAngle);
    a.translate(sign * legOff, hipY, 0);
    parts.push(paintColor(a, z.lower_leg.color));
  }

  // Feet — sole slab on the ground with a heel riser, pivoting at ankle
  const ankleBend = p.ankleBend ?? 0.0;
  const footH = zh(z.foot.fromTop, z.foot.toTop);
  const footBottom = -h / 2;
  const footW = 0.038 * h;
  const footLen = 0.11 * h;
  const soleH = footH * 0.35;
  const heelH = footH;
  const heelD = footLen * 0.4;
  const soleGeo = new THREE.BoxGeometry(footW, soleH, footLen);
  const heelGeo = new THREE.BoxGeometry(footW * 0.9, heelH, heelD);
  for (const sign of [-1, 1]) {
    const sole = soleGeo.clone();
    sole.translate(0, footBottom + soleH / 2 - ankleY, footLen * 0.35);
    sole.rotateX(-ankleBend);
    sole.translate(0, ankleY - hipY, 0);
    sole.rotateZ(sign * legAngle);
    sole.translate(sign * legOff, hipY, 0);
    parts.push(paintColor(sole, z.foot.color));

    const heel = heelGeo.clone();
    heel.translate(0, footBottom + heelH / 2 - ankleY, -(footLen / 2 - heelD / 2) + footLen * 0.35);
    heel.rotateX(-ankleBend);
    heel.translate(0, ankleY - hipY, 0);
    heel.rotateZ(sign * legAngle);
    heel.translate(sign * legOff, hipY, 0);
    parts.push(paintColor(heel, z.foot.color));
  }

  const merged = mergeGeometries(parts);
  for (const pt of parts) pt.dispose();
  return merged;
}

/**
 * Build separate geometry segments for the ragdoll death effect.
 * Each segment has its own geometry (centered at its local origin),
 * a body-local center position, and a collision radius.
 */
function buildRagdollSegments(height, pose) {
  const h = height;
  const S = 6;
  const p = pose ?? DEFAULT_TARGET_POSE;
  const z = Object.fromEntries(HIT_ZONES.map((zone) => [zone.id, zone]));
  const zy = (from, to) => h * (0.5 - (from + to) / 2);
  const zh = (from, to) => h * (to - from);
  const TORSO_XS = 1.15;
  const TORSO_ZS = 0.7;
  const segments = [];

  function makeSegment(id, rawParts, radiusOverride) {
    if (!rawParts.length) return;
    const merged = mergeGeometries(rawParts);
    for (const g of rawParts) g.dispose();
    merged.computeBoundingBox();
    const bb = merged.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    merged.translate(-cx, -cy, -cz);
    segments.push({
      id,
      geometry: merged,
      center: new THREE.Vector3(cx, cy, cz),
      radius: radiusOverride ?? Math.max(
        (bb.max.x - bb.min.x) / 2,
        (bb.max.z - bb.min.z) / 2,
        0.04
      ),
    });
  }

  // Head + neck
  makeSegment("head", [
    coloredPart(
      new THREE.SphereGeometry(0.055 * h, S + 2, S), z.head.color,
      0, zy(z.head.fromTop, z.head.toTop), 0
    ),
    coloredPart(
      new THREE.CylinderGeometry(0.032 * h, 0.038 * h, zh(z.neck.fromTop, z.neck.toTop), S),
      z.neck.color, 0, zy(z.neck.fromTop, z.neck.toTop), 0
    ),
  ]);

  // Torso (upper_chest + lower_chest + stomach + trapezoids)
  {
    const tParts = [];
    for (const { zone, rTop, rBot } of [
      { zone: z.upper_chest, rTop: 0.100, rBot: 0.092 },
      { zone: z.lower_chest, rTop: 0.092, rBot: 0.080 },
      { zone: z.stomach, rTop: 0.080, rBot: 0.075 },
    ]) {
      const cyl = new THREE.CylinderGeometry(rTop * h, rBot * h, zh(zone.fromTop, zone.toTop), S);
      cyl.scale(TORSO_XS, 1, TORSO_ZS);
      cyl.translate(0, zy(zone.fromTop, zone.toTop), 0);
      tParts.push(paintColor(cyl, zone.color));
    }
    const neckBaseY = zy(z.neck.fromTop, z.neck.toTop) - zh(z.neck.fromTop, z.neck.toTop) / 2;
    const armOff = (p.armOffset ?? 0.12) * h;
    const shoulderY = h * (0.5 - z.arm.fromTop - 0.03);
    const trapTopR = 0.033 * h;
    const trapBotR = 0.045 * h;
    const trapDy = neckBaseY - shoulderY;
    const trapLen = Math.sqrt(armOff * armOff + trapDy * trapDy);
    const trapTilt = Math.atan2(armOff, trapDy);
    for (const sign of [-1, 1]) {
      const trap = new THREE.CylinderGeometry(trapTopR, trapBotR, trapLen, S);
      trap.scale(1, 1, TORSO_ZS);
      trap.translate(0, -trapLen / 2, 0);
      trap.rotateZ(sign * trapTilt);
      trap.translate(0, neckBaseY, 0);
      tParts.push(paintColor(trap, z.upper_chest.color));
    }
    makeSegment("torso", tParts);
  }

  // Pelvis (pelvis cylinder + waist ball + hip balls)
  {
    const pParts = [];
    const cyl = new THREE.CylinderGeometry(0.078 * h, 0.090 * h, zh(z.pelvis.fromTop, z.pelvis.toTop), S);
    cyl.scale(TORSO_XS, 1, TORSO_ZS);
    cyl.translate(0, zy(z.pelvis.fromTop, z.pelvis.toTop), 0);
    pParts.push(paintColor(cyl, z.pelvis.color));
    const waistY = zy(z.stomach.toTop, z.stomach.toTop);
    const waistR = 0.082 * h;
    const waistGeo = new THREE.SphereGeometry(waistR, S, S - 2);
    waistGeo.scale(TORSO_XS, 1, TORSO_ZS);
    waistGeo.translate(0, waistY, 0);
    pParts.push(paintColor(waistGeo, z.pelvis.color));
    const legOff = (p.legOffset ?? 0.048) * h;
    const hipY = h * (0.5 - z.thigh.fromTop);
    const hipR = 0.050 * h;
    for (const sign of [-1, 1]) {
      const hp = new THREE.SphereGeometry(hipR, S, S - 2);
      hp.scale(TORSO_XS, 1, TORSO_ZS);
      hp.translate(sign * legOff, hipY, 0);
      pParts.push(paintColor(hp, z.pelvis.color));
    }
    makeSegment("pelvis", pParts);
  }

  // Arms — split into upper arm (shoulder→elbow) and forearm (elbow→hand)
  {
    const armTotalH = zh(z.arm.fromTop, z.arm.toTop);
    const armOff = (p.armOffset ?? 0.12) * h;
    const armAngle = p.armAngle ?? 0.45;
    const elbowBend = p.elbowBend ?? 0.0;
    const shoulderDrop = 0.03;
    const shoulderY = h * (0.5 - z.arm.fromTop - shoulderDrop);
    const upperArmH = armTotalH * 0.46;
    const forearmH = armTotalH * 0.38;
    const handH = armTotalH * 0.14;
    const elbowR = 0.032 * h;
    const elbowLocalY = -upperArmH;
    const shoulderR = 0.034 * h;

    if (p.rifleHold) {
      const joints = getRifleArmJoints(h);
      for (const side of ["L", "R"]) {
        const { shoulder, elbow, hand } = joints[side];
        const upperParts = [];
        const sh = new THREE.SphereGeometry(shoulderR, S, S - 2);
        sh.scale(1.0, 1, 1.15);
        sh.translate(shoulder.x, shoulder.y, shoulder.z);
        upperParts.push(paintColor(sh, z.arm.color));
        upperParts.push(rifleArmPart(
          shoulder,
          elbow,
          0.024 * h,
          0.028 * h,
          S,
          z.arm.color,
        ));
        const eb = new THREE.SphereGeometry(elbowR, S, S - 2);
        eb.translate(elbow.x, elbow.y, elbow.z);
        upperParts.push(paintColor(eb, z.arm.color));
        makeSegment(`upperArm${side}`, upperParts, 0.035 * h);

        makeSegment(`forearm${side}`, [
          rifleArmPart(
            elbow,
            hand,
            0.019 * h,
            0.023 * h,
            S,
            z.arm.color,
          ),
          rifleHandPart(elbow, hand, h, z.arm.color),
        ], 0.025 * h);
      }
    } else {
      for (const [label, sign] of [["upperArmL", -1], ["upperArmR", 1]]) {
        const aParts = [];
        const sh = new THREE.SphereGeometry(shoulderR, S, S - 2);
        sh.scale(1.0, 1, 1.15);
        sh.translate(sign * armOff, shoulderY, 0);
        aParts.push(paintColor(sh, z.arm.color));
        const ua = new THREE.CylinderGeometry(0.028 * h, 0.024 * h, upperArmH, S);
        ua.translate(0, -upperArmH / 2, 0);
        ua.rotateZ(sign * armAngle);
        ua.translate(sign * armOff, shoulderY, 0);
        aParts.push(paintColor(ua, z.arm.color));
        const eb = new THREE.SphereGeometry(elbowR, S, S - 2);
        eb.translate(0, elbowLocalY, 0);
        eb.rotateZ(sign * armAngle);
        eb.translate(sign * armOff, shoulderY, 0);
        aParts.push(paintColor(eb, z.arm.color));
        makeSegment(label, aParts, 0.035 * h);
      }

      for (const [label, sign] of [["forearmL", -1], ["forearmR", 1]]) {
        const fParts = [];
        const fa = new THREE.CylinderGeometry(0.023 * h, 0.019 * h, forearmH, S);
        fa.translate(0, -forearmH / 2, 0);
        fa.rotateX(-elbowBend);
        fa.translate(0, elbowLocalY, 0);
        fa.rotateZ(sign * armAngle);
        fa.translate(sign * armOff, shoulderY, 0);
        fParts.push(paintColor(fa, z.arm.color));
        const hd = new THREE.BoxGeometry(0.026 * h, handH, 0.018 * h);
        hd.translate(0, -forearmH - handH / 2, 0);
        hd.rotateX(-elbowBend);
        hd.translate(0, elbowLocalY, 0);
        hd.rotateZ(sign * armAngle);
        hd.translate(sign * armOff, shoulderY, 0);
        fParts.push(paintColor(hd, z.arm.color));
        makeSegment(label, fParts, 0.025 * h);
      }
    }
  }

  // Legs — split into thigh (hip→knee) and shin (knee→foot)
  {
    const legOff = (p.legOffset ?? 0.048) * h;
    const legAngle = p.legAngle ?? 0.10;
    const hipY = h * (0.5 - z.thigh.fromTop);
    const kneeY = zy(z.knee.fromTop, z.knee.toTop);
    const ankleY = zy(z.lower_leg.toTop, z.foot.fromTop);
    const ankleBend = p.ankleBend ?? 0.0;
    const footLen = 0.11 * h;
    const footW = 0.038 * h;
    const footH = zh(z.foot.fromTop, z.foot.toTop);
    const soleH = footH * 0.35;
    const heelH = footH;
    const heelD = footLen * 0.4;

    for (const [label, sign] of [["thighL", -1], ["thighR", 1]]) {
      const tParts = [];
      const thigh = new THREE.CylinderGeometry(0.048 * h, 0.040 * h, zh(z.thigh.fromTop, z.thigh.toTop), S);
      const thighCy = zy(z.thigh.fromTop, z.thigh.toTop);
      thigh.translate(0, thighCy - hipY, 0);
      thigh.rotateZ(sign * legAngle);
      thigh.translate(sign * legOff, hipY, 0);
      tParts.push(paintColor(thigh, z.thigh.color));
      const knee = new THREE.SphereGeometry(0.050 * h, S, S - 2);
      knee.translate(0, kneeY - hipY, 0);
      knee.rotateZ(sign * legAngle);
      knee.translate(sign * legOff, hipY, 0);
      tParts.push(paintColor(knee, z.knee.color));
      makeSegment(label, tParts, 0.05 * h);
    }

    for (const [label, sign] of [["shinL", -1], ["shinR", 1]]) {
      const sParts = [];
      const lowerLeg = new THREE.CylinderGeometry(0.037 * h, 0.030 * h, zh(z.lower_leg.fromTop, z.lower_leg.toTop), S);
      const llCy = zy(z.lower_leg.fromTop, z.lower_leg.toTop);
      lowerLeg.translate(0, llCy - hipY, 0);
      lowerLeg.rotateZ(sign * legAngle);
      lowerLeg.translate(sign * legOff, hipY, 0);
      sParts.push(paintColor(lowerLeg, z.lower_leg.color));
      const ankle = new THREE.SphereGeometry(0.032 * h, S, S - 2);
      ankle.translate(0, ankleY - hipY, 0);
      ankle.rotateZ(sign * legAngle);
      ankle.translate(sign * legOff, hipY, 0);
      sParts.push(paintColor(ankle, z.lower_leg.color));
      const sole = new THREE.BoxGeometry(footW, soleH, footLen);
      sole.translate(0, -h / 2 + soleH / 2 - ankleY, footLen * 0.35);
      sole.rotateX(-ankleBend);
      sole.translate(0, ankleY - hipY, 0);
      sole.rotateZ(sign * legAngle);
      sole.translate(sign * legOff, hipY, 0);
      sParts.push(paintColor(sole, z.foot.color));
      const heel = new THREE.BoxGeometry(footW * 0.9, heelH, heelD);
      heel.translate(0, -h / 2 + heelH / 2 - ankleY, -(footLen / 2 - heelD / 2) + footLen * 0.35);
      heel.rotateX(-ankleBend);
      heel.translate(0, ankleY - hipY, 0);
      heel.rotateZ(sign * legAngle);
      heel.translate(sign * legOff, hipY, 0);
      sParts.push(paintColor(heel, z.foot.color));
      makeSegment(label, sParts, 0.04 * h);
    }
  }

  return segments;
}

function createTargetMaterial() {
  return new THREE.MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
  });
}

/** One dark material per ragdoll — shared across all limbs (opacity fades per ragdoll). */
let _ragdollMatTemplate = null;
const RAGDOLL_MAT_POOL_MAX = 6;
/** Pull corpse meshes above arena floor (-3) to stop z-fighting. */
const RAGDOLL_POLYGON_OFFSET = { factor: -8, units: -12 };
const RAGDOLL_SHIN_POLYGON_OFFSET = { factor: -12, units: -16 };
/** @type {THREE.MeshLambertMaterial[]} */
const _ragdollMatPool = [];

function createRagdollMaterial() {
  if (!_ragdollMatTemplate) {
    _ragdollMatTemplate = new THREE.MeshLambertMaterial({
      color: 0x262626,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: RAGDOLL_POLYGON_OFFSET.factor,
      polygonOffsetUnits: RAGDOLL_POLYGON_OFFSET.units,
    });
  }
  return _ragdollMatTemplate.clone();
}

function acquireRagdollMaterial() {
  const mat = _ragdollMatPool.pop();
  if (mat) {
    mat.opacity = 1;
    mat.depthWrite = true;
    mat.transparent = true;
    mat.polygonOffsetFactor = RAGDOLL_POLYGON_OFFSET.factor;
    mat.polygonOffsetUnits = RAGDOLL_POLYGON_OFFSET.units;
    return mat;
  }
  return createRagdollMaterial();
}

/** @param {THREE.Material | null | undefined} mat */
function releaseRagdollMaterial(mat) {
  if (!mat) return;
  if (_ragdollMatPool.length >= RAGDOLL_MAT_POOL_MAX) {
    mat.dispose();
    return;
  }
  _ragdollMatPool.push(mat);
}

/** Pre-clone ragdoll materials so the first kill avoids shader setup on the hit frame. */
export function prewarmRagdollMaterialPool(count = RAGDOLL_MAT_POOL_MAX) {
  createRagdollMaterial();
  while (_ragdollMatPool.length < count) {
    _ragdollMatPool.push(createRagdollMaterial());
  }
}

function configureRagdollMesh(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;
}

function disableRagdollShadowCast(ragdoll) {
  ragdoll.coreMesh.castShadow = false;
  for (const limb of ragdoll.limbs) {
    limb.mesh.castShadow = false;
  }
  for (const chunk of ragdoll.severed ?? []) {
    for (const obj of chunk.root.children) {
      if (obj.isMesh) obj.castShadow = false;
    }
  }
}

/** @returns {boolean} true when the ragdoll should be removed */
function tickRagdollFade(ragdoll) {
  let fadeT = -1;
  if (ragdoll.allResting) {
    fadeT = Math.max(
      0,
      ragdoll.time - (ragdoll.restingTime + RAGDOLL_SETTLE_DELAY),
    ) / RAGDOLL_FADE_DURATION;
  }
  if (ragdoll.time >= RAGDOLL_MAX_TIME) {
    fadeT = Math.max(
      fadeT,
      (ragdoll.time - RAGDOLL_MAX_TIME) / RAGDOLL_FADE_DURATION,
    );
  }
  if (fadeT < 0) return false;

  const opacity = THREE.MathUtils.clamp(1 - fadeT, 0, 1);
  const noWrite = opacity < 1;
  ragdoll.coreMesh.material.opacity = opacity;
  if (noWrite) {
    ragdoll.coreMesh.material.depthWrite = false;
    ragdoll.coreMesh.castShadow = false;
  }
  for (const limb of ragdoll.limbs) {
    limb.mesh.material.opacity = opacity;
    if (noWrite) {
      limb.mesh.material.depthWrite = false;
      limb.mesh.castShadow = false;
    }
  }
  for (const chunk of ragdoll.severed ?? []) {
    for (const mat of chunk.materials) {
      mat.opacity = opacity;
      if (noWrite) {
        mat.transparent = true;
        mat.depthWrite = false;
      }
    }
    for (const obj of chunk.root.children) {
      if (obj.isMesh) obj.castShadow = !noWrite;
    }
  }
  return fadeT >= 1;
}

/** Cached segment + core geometry keyed by target height/pose — avoids mergeGeometries on every kill. */
const _ragdollTemplateCache = new Map();

function ragdollTemplateKey(height, pose) {
  const p = pose ?? DEFAULT_TARGET_POSE;
  return [
    Number(height).toFixed(4),
    p.armAngle ?? 0.45,
    p.elbowBend ?? 0,
    p.legAngle ?? 0.10,
    p.armOffset ?? 0.12,
    p.legOffset ?? 0.048,
    p.ankleBend ?? 0,
    p.rifleHold ? 1 : 0,
  ].join("|");
}

function getRagdollTemplate(height, pose) {
  const key = ragdollTemplateKey(height, pose);
  let template = _ragdollTemplateCache.get(key);
  if (template) return template;

  const built = buildRagdollSegments(height, pose);
  const coreIds = new Set(["head", "torso", "pelvis"]);
  const coreSegs = built.filter((s) => coreIds.has(s.id));
  const coreGeos = coreSegs.map((s) => {
    const g = s.geometry.clone();
    g.translate(s.center.x, s.center.y, s.center.z);
    return g;
  });
  const coreMerged = mergeGeometries(coreGeos);
  for (const g of coreGeos) g.dispose();
  coreMerged.computeBoundingBox();
  const cbb = coreMerged.boundingBox;
  template = {
    segments: built,
    coreMerged,
    coreHalfX: (cbb.max.x - cbb.min.x) / 2,
    coreHalfZ: (cbb.max.z - cbb.min.z) / 2,
  };
  _ragdollTemplateCache.set(key, template);
  return template;
}

function cloneRagdollSegments(template) {
  return template.segments.map((s) => ({
    id: s.id,
    geometry: s.geometry.clone(),
    center: s.center.clone(),
    radius: s.radius,
  }));
}

/** Pre-build ragdoll geometry templates during load so the first kill only clones buffers. */
export function prebuildRagdollTemplates(targets) {
  prewarmRagdollMaterialPool();
  for (const mesh of targets ?? []) {
    ensureTargetRagdollTemplate(mesh);
  }
}

/** @param {THREE.Mesh} mesh */
export function ensureTargetRagdollTemplate(mesh) {
  if (!mesh?.userData?.isTarget) return;
  const height = mesh.userData.height ?? DEFAULT_TARGET_CONFIG.height;
  const pose = mesh.userData.targetPose ?? DEFAULT_TARGET_POSE;
  getRagdollTemplate(height, pose);
}

/** @param {THREE.Mesh} mesh */
export function reservePredictiveRagdollMaterial(mesh) {
  if (!mesh?.userData || mesh.userData.predictiveRagdollMat) return;
  mesh.userData.predictiveRagdollMat = acquireRagdollMaterial();
}

/** @param {THREE.Mesh} mesh */
export function clearTargetKillPredictiveCache(mesh) {
  if (!mesh?.userData) return;
  if (mesh.userData.predictiveRagdollMat) {
    releaseRagdollMaterial(mesh.userData.predictiveRagdollMat);
    mesh.userData.predictiveRagdollMat = null;
  }
  mesh.userData.predictiveDeathColliders = null;
  mesh.userData.predictiveKillGpuWarmed = false;
}

const _warmupBulletDir = new THREE.Vector3(0, 0, -1);

/** Build a throwaway ragdoll for GPU shader warmup (caller must dispose). */
export function buildWarmupRagdoll(mesh, scene, hitZone = "body") {
  return createRagdoll(mesh, _warmupBulletDir, scene, hitZone, null);
}

export function disposeWarmupRagdoll(ragdoll) {
  disposeRagdoll(ragdoll);
}

/**
 * Bake headshot ragdoll shaders (room pass) during load — first in-container headshot
 * should not pay createRagdoll + Lambert compile on the kill frame.
 * @param {THREE.Scene} scene
 * @param {THREE.Mesh} mesh
 */
/**
 * @param {THREE.Scene} scene
 * @param {THREE.Mesh} mesh
 * @param {{ hitZone?: string, hide?: boolean }} [options]
 */
export function warmHeadshotRagdollGpu(scene, mesh, options = {}) {
  if (!scene?.isScene || !mesh?.userData?.isTarget) return;
  const ragdoll = buildWarmupRagdoll(mesh, scene, options.hitZone ?? "head");
  if (ragdoll?.rootGroup && options.hide !== false) {
    ragdoll.rootGroup.visible = false;
    ragdoll.rootGroup.position.y -= 1000;
    ragdoll.rootGroup.updateMatrixWorld(true);
  }
  disposeWarmupRagdoll(ragdoll);
}

/** Ragdoll builds are deferred when GPU is not pre-warmed so kill shots don't hitch. */
const _pendingRagdolls = [];

/**
 * @param {THREE.Mesh} mesh
 * @param {THREE.Vector3 | null | undefined} bulletDir
 * @param {{
 *   scene: THREE.Scene,
 *   hitZone?: string,
 *   hitPoint?: THREE.Vector3 | null,
 *   knockbackMul?: number,
 *   blastFalloff?: number,
 *   onBloodSplatter?: ((splatter: unknown) => void) | null,
 *   gameCore?: import("@/lib/game-core/types.ts").GameCoreEngine | null,
 * }} opts
 */
function spawnRagdollForDeath(mesh, bulletDir, opts) {
  const ud = mesh.userData;
  if (!ud.dying || ud.ragdoll) return;
  ud.ragdollPending = false;
  ud.ragdoll = createRagdoll(
    mesh,
    bulletDir,
    opts.scene,
    opts.hitZone ?? "body",
    opts.hitPoint ?? null,
    opts.knockbackMul ?? 1,
    opts.blastFalloff ?? 1,
    opts.onBloodSplatter ?? null,
    opts.gameCore ?? null,
  );
  reparentBloodMarks(mesh, ud.ragdoll.rootGroup);
  mesh.visible = false;
  const vMat = mesh.material;
  vMat.transparent = true;
  vMat.depthWrite = true;
}

/**
 * Spawn ragdolls queued by `startDeathAnimation`.
 * Default spreads one per frame at loop start; use {@link flushAllPendingRagdolls}
 * before death physics so kills appear same frame.
 */
export function flushPendingRagdolls(maxPerFrame = 1) {
  if (!_pendingRagdolls.length) return;
  const count = Math.min(maxPerFrame, _pendingRagdolls.length);
  for (let i = 0; i < count; i += 1) {
    const pending = _pendingRagdolls.shift();
    spawnRagdollForDeath(pending.mesh, pending.bulletDir, pending.opts);
  }
}

/** Drain the ragdoll queue — call before `updateDeathAnimations` each frame. */
export function flushAllPendingRagdolls() {
  flushPendingRagdolls(_pendingRagdolls.length);
}

/**
 * @param {object} opts
 * @param {THREE.Group} opts.group
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} opts.bounds
 * @param {object[]} opts.colliders
 * @param {ReturnType<typeof resolveTargetConfig>} opts.config
 */
/**
 * @param {object} opts
 * @param {THREE.Group} opts.group
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} opts.bounds
 * @param {object[]} opts.colliders - Colliders used for spawn-position checks
 * @param {object[]} [opts.targetColliderSink] - Array to push new target colliders into (defaults to opts.colliders)
 * @param {ReturnType<typeof resolveTargetConfig>} opts.config
 * @param {{ x: number, z: number, radius: number }[]} [opts.floorHoles]
 * @param {import("../physics/Collision.js").SpawnFootYContext} [opts.spawnCtx]
 */
export function spawnTargets(opts) {
  const { group, bounds, colliders, config, floorHoles, spawnCtx, gameCore = null } = opts;
  const targetColliderSink = opts.targetColliderSink ?? colliders;
  const targets = [];
  const sharedGeo = buildHumanoidGeometry(config.height);
  const rifleGeo = buildHumanoidGeometry(config.height, RIFLE_TARGET_POSE);

  function addTarget(pos, yaw, fixedSpawn, rifleOverride) {
    const targetIndex = targets.length;
    const hasRifle = rifleOverride ?? targetIndex % 2 === 0;
    const targetPose = hasRifle ? RIFLE_TARGET_POSE : DEFAULT_TARGET_POSE;
    const mesh = new THREE.Mesh(hasRifle ? rifleGeo : sharedGeo, createTargetMaterial());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(pos.x, pos.y + config.height / 2, pos.z);
    mesh.rotation.y = yaw ?? Math.random() * Math.PI * 2;

    mesh.userData.isTarget = true;
    mesh.userData.targetPose = { ...targetPose };
    mesh.userData.hasRifle = hasRifle;
    mesh.userData.maxHealth = config.maxHealth;
    mesh.userData.health = config.maxHealth;
    mesh.userData.height = config.height;
    mesh.userData.radius = config.radius;
    mesh.userData.repairPerSecond = config.repairPerSecond;
    mesh.userData.repairDelayAfterHit = config.repairDelayAfterHit;
    mesh.userData.repairCooldown = 0;
    if (fixedSpawn) mesh.userData.fixedSpawn = fixedSpawn;
    resetTargetScoreState(mesh);

    if (hasRifle) {
      const rifle = createTargetRifle(config.height);
      mesh.add(rifle);
      mesh.userData.enemyRifle = rifle;
    }

    const healthBar = createHealthBarSprite(config.height);
    mesh.add(healthBar);
    mesh.userData.healthBar = healthBar;
    resetHealthBarAnimation(mesh, 1);

    const collider = {
      x: pos.x,
      z: pos.z,
      halfX: config.radius,
      halfZ: config.radius,
      active: true,
      targetMesh: mesh,
    };
    mesh.userData.collider = collider;
    targetColliderSink.push(collider);
    colliders.push(collider);

    group.add(mesh);
    targets.push(mesh);
  }

  for (const pt of config.spawnPoints) {
    if (targets.length >= config.count) break;
    if (pt?.x == null || pt?.z == null) continue;
    const authoredSpawn = {
      x: pt.x,
      z: pt.z,
      y: pt.y ?? null,
      yaw: pt.yaw ?? null,
      random: pt.random === true,
      chance: pt.chance ?? 0.5,
      rifle: typeof pt.rifle === "boolean" ? pt.rifle : null,
    };
    const placement = resolveTargetRespawnPlacementCore(gameCore, {
      bounds,
      radius: config.radius,
      margin: config.spawnMargin,
      height: config.height,
      floorY: spawnCtx?.floorY ?? 0,
      floorBounds: spawnCtx?.floorBounds ?? null,
      floorHoles: floorHoles ?? [],
      groundSurfaces: spawnCtx?.groundSurfaces ?? [],
      colliders,
      targets,
      maxAttempts: 100,
      randomRolls: [],
      fixedSpawn: authoredSpawn,
      spawnPointRoll: Math.random(),
    });
    if (!placement.found) continue;
    addTarget(placement, placement.yaw ?? 0, {
      x: placement.x,
      z: placement.z,
      y: placement.y,
      yaw: placement.yaw ?? 0,
    }, authoredSpawn.rifle);
  }

  while (targets.length < config.count) {
    const placement = resolveTargetRespawnPlacementCore(gameCore, {
      bounds,
      radius: config.radius,
      margin: config.spawnMargin,
      height: config.height,
      floorY: spawnCtx?.floorY ?? 0,
      floorBounds: spawnCtx?.floorBounds ?? null,
      floorHoles: floorHoles ?? [],
      groundSurfaces: spawnCtx?.groundSurfaces ?? [],
      colliders,
      targets,
      maxAttempts: 100,
      randomRolls: Array.from({ length: 200 }, () => Math.random()),
      fixedSpawn: null,
      spawnPointRoll: null,
    });
    if (!placement.found) break;
    addTarget(placement);
  }

  return { targets, sharedGeo };
}

/** Full white blind, then gradual fade (see getFlashbangOverlayOpacity). */
export {
  FLASHBANG_BLIND_DIM_OPACITY,
  FLASHBANG_BLIND_DIM_SEC,
  FLASHBANG_BLIND_FADE_SEC,
  FLASHBANG_BLIND_FULL_OPACITY,
  FLASHBANG_BLIND_FULL_SEC,
  applyFlashbangBlindToTarget,
  getFlashbangBlindDurationSec,
  getFlashbangOverlayOpacity,
  isFlashbangBlindExpired,
} from "./FlashbangBlind.js";

/** Apply flashbang blindness to a living target (no damage, no mesh tint). */
export function blindTargetFromFlashbang(mesh, simTime, gameCore = null) {
  const ud = mesh.userData;
  const result = applyFlashbangBlindToTarget(
    gameCore,
    simTime,
    Boolean(ud.flashbangBlinding),
    ud.flashbangBlindStart ?? 0,
    ud.flashbangBlindFadeEnd ?? 0,
  );
  ud.flashbangBlindStart = result.blindStart;
  ud.flashbangBlindFadeEnd = result.blindFadeEnd;
  ud.flashbangBlinding = result.blinding;
}

/** Clear expired flashbang-blind state on targets (visuals use CSS overlay for player). */
export function updateFlashbangBlindVisuals(targets, simTime, gameCore = null) {
  for (const mesh of targets) {
    const ud = mesh.userData;
    if (!ud.flashbangBlinding) continue;
    if (isFlashbangBlindExpired(gameCore, simTime, ud.flashbangBlindFadeEnd ?? 0)) {
      ud.flashbangBlinding = false;
      ud.flashbangBlindStart = 0;
      ud.flashbangBlindFadeEnd = 0;
    }
  }
}

export function setTargetHealthVisual(mesh, healthRatio) {
  const mat = mesh.material;
  if (!mat?.color) return;
  const alive = healthRatio > 0;
  const b = alive ? 0.30 + 0.70 * healthRatio : 0.15;
  mat.color.setRGB(b, b, b);
  mat.emissive?.setHex(0x000000);
  if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0;
  const bar = mesh.userData.healthBar;
  if (!bar) return;
  if (!alive) {
    bar.visible = false;
    return;
  }
  setHealthBarTarget(mesh, healthRatio);
}

function headshotDamageFor(mesh, profile, shotDistance = 0, gameCore = null) {
  return resolveHeadshotDamage(
    profile,
    mesh.userData.health,
    mesh.userData.maxHealth ?? DEFAULT_TARGET_CONFIG.maxHealth,
    shotDistance,
    gameCore
  );
}

function bodyDamageFor(profile, zoneId, zoneMult = 1, shotDistance = 0, gameCore = null) {
  return resolveBodyZoneDamage(profile, zoneId, zoneMult, shotDistance, gameCore);
}

function buildTargetZoneDamageInput(mesh, hitPoint, bulletDir, weaponId, shotDistance) {
  const ud = mesh.userData;
  const pose = ud.targetPose ?? DEFAULT_TARGET_POSE;
  /** @type {import("@/lib/game-core/types.ts").TargetZoneDamageInput} */
  const input = {
    weaponId,
    currentHealth: ud.health,
    maxHealth: ud.maxHealth ?? DEFAULT_TARGET_CONFIG.maxHealth,
    shotDistance,
    height: ud.height ?? DEFAULT_TARGET_CONFIG.height,
    targetX: mesh.position.x,
    targetY: mesh.position.y,
    targetZ: mesh.position.z,
    pose: {
      armAngle: pose.armAngle,
      legAngle: pose.legAngle,
      armOffset: pose.armOffset,
      legOffset: pose.legOffset,
    },
  };
  if (hitPoint) {
    input.hitX = hitPoint.x;
    input.hitY = hitPoint.y;
    input.hitZ = hitPoint.z;
  }
  if (bulletDir) {
    input.bulletDirX = bulletDir.x;
    input.bulletDirY = bulletDir.y;
    input.bulletDirZ = bulletDir.z;
  }
  return input;
}

export function applyTargetHit(
  mesh,
  hitPoint,
  bulletDir,
  weaponId = "rifle",
  shotDistance = 0,
  damageScale = 1,
  gameCore
) {
  const ud = mesh.userData;
  const profile = getWeaponDamageProfile(weaponId);
  const result = hitPoint
    ? requireWasmMethod(gameCore, "resolveTargetZoneDamage")(
        buildTargetZoneDamageInput(mesh, hitPoint, bulletDir, weaponId, shotDistance)
      )
    : {
        zone: "body",
        damage: bodyDamageFor(profile, "body", 1, shotDistance, gameCore),
      };

  if (!result) {
    return { killed: false, health: ud.health, ratio: ud.health / ud.maxHealth, zone: "miss" };
  }
  const { zone, damage: baseDamage } = result;
  const damage = baseDamage * Math.max(0, damageScale);
  const damageResult = requireWasmMethod(gameCore, "applyTargetDamage")(
    ud.health,
    ud.maxHealth,
    damage,
  );
  ud.health = damageResult.health;
  ud.repairCooldown = ud.repairDelayAfterHit ?? DEFAULT_TARGET_CONFIG.repairDelayAfterHit;
  const ratio = damageResult.ratio;
  setTargetHealthVisual(mesh, ratio);
  flashTargetHealthBarOnHit(mesh, ratio);
  return { killed: damageResult.killed, health: ud.health, ratio, zone, damage };
}

/** Slowly restore health on living targets after a post-hit delay. */
export function updateTargetsRepair(targets, dt) {
  const dtPos = Math.max(0, dt);
  for (const mesh of targets) {
    if (!mesh.visible || mesh.userData.health <= 0) continue;
    const ud = mesh.userData;
    const maxHealth = Math.max(0, ud.maxHealth);
    if (maxHealth <= 0) continue;
    let health = Math.min(ud.health, maxHealth);
    let cooldown = Math.max(0, ud.repairCooldown ?? 0);

    if (cooldown > 0) {
      cooldown = Math.max(0, cooldown - dtPos);
    } else if (health < maxHealth) {
      const rate = ud.repairPerSecond ?? DEFAULT_TARGET_CONFIG.repairPerSecond;
      const before = health;
      health = Math.min(maxHealth, health + Math.max(0, rate) * dtPos);
      if (health > before) {
        setTargetHealthVisual(mesh, health / maxHealth);
      }
    }

    ud.health = health;
    ud.repairCooldown = cooldown;
  }
}

/**
 * Live targets over a floor hole lose support and fall through.
 * @param {THREE.Mesh[]} targets
 * @param {number} dt
 * @param {number} floorY
 * @param {{ x: number, z: number, radius?: number }[]} [floorHoles]
 * @param {(mesh: THREE.Mesh) => void} [onRemoved]
 * @param {(mesh: THREE.Mesh, position: THREE.Vector3) => void} [onHoleFall]
 */
export function updateLiveTargetsFloorHoles(
  targets,
  dt,
  floorY,
  floorHoles,
  onRemoved,
  onHoleFall,
  gameCore = null,
) {
  if (!floorHoles?.length) return;
  for (const mesh of targets) {
    const ud = mesh.userData;
    if (!mesh.visible || ud.health <= 0 || ud.dying) continue;

    const inset = ud.radius ?? 0.35;
    if (
      !ud.fallingThroughHole &&
      pointInFloorHole(mesh.position.x, mesh.position.z, floorHoles, inset, gameCore)
    ) {
      beginHoleFall(ud);
      // A target dropping through the hole is no longer a solid obstacle. Drop its
      // collider now so the fading body can't act as an invisible wall while it
      // sinks (it was only cleared on full removal ~12 units down).
      const collider = ud.collider;
      if (collider) {
        collider.active = false;
        collider.halfX = 0;
        collider.halfZ = 0;
      }
      onHoleFall?.(mesh, mesh.position.clone());
    }

    if (!ud.fallingThroughHole) continue;

    const { nextY, remove } = tickHoleFallY(ud, mesh.position.y, floorY, dt);
    mesh.position.y = nextY;
    const fallDepth = floorY - mesh.position.y;
    if (fallDepth > 0.5) {
      mesh.material.opacity = Math.max(0, 1 - (fallDepth - 0.5) / 4);
      mesh.material.transparent = true;
    }
    if (remove) onRemoved?.(mesh);
  }
}

/**
 * @param {THREE.Mesh} mesh
 * @param {number} x
 * @param {number} z
 * @param {ReturnType<typeof resolveTargetConfig>} config
 * @param {number} [floorY=0]
 * @param {number} [yaw] Fixed facing; random when omitted.
 */
export function activateTargetAt(mesh, x, z, config, floorY = 0, yaw) {
  const ud = mesh.userData;
  if (ud.ragdoll) {
    disposeBloodMarksOnTarget(ud.ragdoll.rootGroup);
    disposeRagdoll(ud.ragdoll);
    ud.ragdoll = null;
  }
  disposeBloodMarksOnTarget(mesh);
  const collider = ud.collider;
  ud.health = ud.maxHealth;
  ud.repairCooldown = 0;
  ud.healthBarHitVisibility = 0;
  ud.healthBarHitTime = Infinity;
  ud.flashbangBlinding = false;
  ud.flashbangBlindStart = 0;
  ud.flashbangBlindFadeEnd = 0;
  ud.enemyAi = null;
  ud.dying = false;
  ud.fallingThroughHole = false;
  ud.holeFallVelY = 0;
  mesh.visible = true;
  mesh.rotation.set(0, yaw ?? Math.random() * Math.PI * 2, 0);
  const vMat = mesh.material;
  vMat.opacity = 1;
  vMat.transparent = false;
  mesh.position.set(x, floorY + config.height / 2, z);
  collider.x = x;
  collider.z = z;
  collider.halfX = config.radius;
  collider.halfZ = config.radius;
  collider.active = true;
  resetHealthBarAnimation(mesh, 1);
  setTargetHealthVisual(mesh, 1);
  resetTargetScoreState(mesh);
}

/** Respawn every target at its fixed point or a fresh random spot (session reset). */
export function resetAllTargetsToSpawn(targets, opts) {
  const { config, bounds, colliders, floorHoles, spawnCtx, gameCore = null } = opts;
  for (const mesh of targets) {
    const fixed = mesh.userData.fixedSpawn;
    if (fixed) {
      const placement = resolveTargetRespawnPlacementCore(gameCore, {
        bounds,
        radius: config.radius,
        margin: config.spawnMargin,
        height: config.height,
        floorY: spawnCtx?.floorY ?? 0,
        floorBounds: spawnCtx?.floorBounds ?? null,
        floorHoles: floorHoles ?? [],
        groundSurfaces: spawnCtx?.groundSurfaces ?? [],
        colliders,
        targets,
        skip: mesh,
        maxAttempts: 100,
        randomRolls: [],
        fixedSpawn: fixed,
        spawnPointRoll: null,
      });
      if (placement.found) {
        activateTargetAt(
          mesh,
          placement.x,
          placement.z,
          config,
          placement.y,
          placement.yaw ?? undefined,
        );
      }
      continue;
    }
    const placement = resolveTargetRespawnPlacementCore(gameCore, {
      bounds,
      radius: config.radius,
      margin: config.spawnMargin,
      height: config.height,
      floorY: spawnCtx?.floorY ?? 0,
      floorBounds: spawnCtx?.floorBounds ?? null,
      floorHoles: floorHoles ?? [],
      groundSurfaces: spawnCtx?.groundSurfaces ?? [],
      colliders,
      targets,
      skip: mesh,
      maxAttempts: 100,
      randomRolls: Array.from({ length: 200 }, () => Math.random()),
      fixedSpawn: null,
      spawnPointRoll: null,
    });
    if (placement.found) {
      activateTargetAt(mesh, placement.x, placement.z, config, placement.y);
    } else {
      deactivateTarget(mesh);
    }
  }
}

export function deactivateTarget(mesh) {
  if (mesh.userData.ragdoll) {
    disposeBloodMarksOnTarget(mesh.userData.ragdoll.rootGroup);
    disposeRagdoll(mesh.userData.ragdoll);
    mesh.userData.ragdoll = null;
  }
  disposeBloodMarksOnTarget(mesh);
  mesh.visible = false;
  mesh.userData.health = 0;
  mesh.userData.healthBarHitVisibility = 0;
  mesh.userData.healthBarHitTime = Infinity;
  mesh.userData.dying = false;
  mesh.userData.deathColliders = null;
  clearTargetKillPredictiveCache(mesh);
  mesh.rotation.set(0, 0, 0);
  const vMat = mesh.material;
  vMat.opacity = 1;
  vMat.transparent = false;
  const collider = mesh.userData.collider;
  if (collider) {
    collider.active = false;
    collider.halfX = 0;
    collider.halfZ = 0;
  }
  setTargetHealthVisual(mesh, 0);
}

const DEATH_INITIAL_ANGULAR_VEL = 0.8;

/* ── Ragdoll physics ──────────────────────────────────────────────── */

const RAGDOLL_SETTLE_DELAY = 0.6;
const RAGDOLL_FADE_DURATION = 0.8;
const RAGDOLL_MAX_TIME = 30.0;
/** Extra Y clearance for limb floor clamps (shins need more — mesh extends past probe). */
const RAGDOLL_FLOOR_SKIN = 0.014;
const RAGDOLL_SHIN_FLOOR_SKIN = 0.026;
/** Seconds after torso hits the floor before limb springs are snapped off. */
const RAGDOLL_LIMB_FREEZE_DELAY = 0.15;
/** Max wait for slow limbs to settle before freezing anyway. */
const RAGDOLL_LIMB_FREEZE_MAX = 1.0;
const RAGDOLL_PHYSICS_MAX_SUBDT = 0.018;
const RAGDOLL_PHYSICS_MAX_SUBSTEPS = 6;
const LIMB_SPRING = 14;
const LIMB_DAMPING = 5;

const LAUNCH_UP_VEL = 1.6;
const LAUNCH_BACK_VEL = 1.2;
const LAUNCH_GRAVITY = 22;
const LAUNCH_GROUND_FRICTION = 6;

const FLAIL_DURATION = 1.2;
const SPIN_VEL_MIN = 0.3;
const SPIN_VEL_MAX = 1.0;
const SPIN_GROUND_FRICTION = 6;

/* ── Hit-zone → ragdoll limb mapping ─────────────────────────────── */

const HIT_ZONE_LIMB_MAP = {
  head:        "head",
  neck:        "head",
  upper_chest: null,
  lower_chest: null,
  stomach:     null,
  pelvis:      null,
  arm:         "upperArm",
  thigh:       "thigh",
  knee:        "shin",
  lower_leg:   "shin",
  foot:        "shin",
};

/**
 * Per-zone force profiles that shape the ragdoll reaction.
 *  launchMul  — scales LAUNCH_UP_VEL / LAUNCH_BACK_VEL
 *  spinMul    — scales SPIN_VEL
 *  toppleDelay — seconds before torso topple engages (impact snap phase)
 *  impulseMul — strength of the per-bone hit impulse
 *  foldAngle  — optional initial X rotation on the core (stomach fold)
 */
const HIT_PROFILES = {
  head:        { launchMul: 1.2, spinMul: 0.6, toppleDelay: 0.06, impulseMul: 1.8, foldAngle: 0 },
  neck:        { launchMul: 1.1, spinMul: 0.5, toppleDelay: 0.07, impulseMul: 1.5, foldAngle: 0 },
  upper_chest: { launchMul: 1.3, spinMul: 0.3, toppleDelay: 0.04, impulseMul: 1.3, foldAngle: 0 },
  lower_chest: { launchMul: 1.1, spinMul: 0.3, toppleDelay: 0.05, impulseMul: 1.1, foldAngle: 0 },
  stomach:     { launchMul: 0.9, spinMul: 0.2, toppleDelay: 0.08, impulseMul: 1.0, foldAngle: 0.2 },
  pelvis:      { launchMul: 0.7, spinMul: 0.4, toppleDelay: 0.07, impulseMul: 0.8, foldAngle: 0 },
  arm:         { launchMul: 0.5, spinMul: 0.5, toppleDelay: 0.10, impulseMul: 1.6, foldAngle: 0 },
  thigh:       { launchMul: 0.3, spinMul: 0.2, toppleDelay: 0.12, impulseMul: 1.2, foldAngle: 0 },
  knee:        { launchMul: 0.2, spinMul: 0.15, toppleDelay: 0.12, impulseMul: 1.0, foldAngle: 0 },
  lower_leg:   { launchMul: 0.15, spinMul: 0.1, toppleDelay: 0.14, impulseMul: 0.8, foldAngle: 0 },
  foot:        { launchMul: 0.1, spinMul: 0.08, toppleDelay: 0.16, impulseMul: 0.6, foldAngle: 0 },
  body:        { launchMul: 1.0, spinMul: 0.3, toppleDelay: 0.05, impulseMul: 1.0, foldAngle: 0 },
  miss:        { launchMul: 1.0, spinMul: 0.3, toppleDelay: 0.05, impulseMul: 1.0, foldAngle: 0 },
  grenade:     { launchMul: 2.0, spinMul: 0.7, toppleDelay: 0.02, impulseMul: 1.5, foldAngle: 0 },
};

const GRENADE_SEVERABLE_ROOTS = ["upperArmL", "upperArmR", "thighL", "thighR"];
const SEVER_CHUNK_RADIUS = 0.08;
const SEVER_GROUND_FRICTION = 9;
const SEVER_SETTLE_SPEED = 0.55;
const SEVER_SETTLE_SPIN = 2.0;
const SEVER_FLAT_SPIN = 8;

const _severBBox = new THREE.Box3();
const _severUnionBox = new THREE.Box3();
const _severFlatCenter = new THREE.Vector3();
const _severSpinePivot = new THREE.Vector3();
const _severSpineDir = new THREE.Vector3();
const _severFlatTarget = new THREE.Vector3();
const _severFlatQuat = new THREE.Quaternion();
const _severIdentityQuat = new THREE.Quaternion();
const _severRotOffset = new THREE.Vector3();
const _severWorldUp = new THREE.Vector3(0, 1, 0);

function computeSubtreeWorldBox(root) {
  _severBBox.makeEmpty();
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    _severUnionBox.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld);
    _severBBox.union(_severUnionBox);
  });
  return _severBBox;
}

function computeSubtreeLowestY(root) {
  computeSubtreeWorldBox(root);
  return _severBBox.isEmpty() ? Infinity : _severBBox.min.y;
}

function computeSubtreeHighestY(root) {
  computeSubtreeWorldBox(root);
  return _severBBox.isEmpty() ? -Infinity : _severBBox.max.y;
}

function computeLimbSpineWorldDir(root, outDir) {
  root.getWorldPosition(_severSpinePivot);
  computeSubtreeWorldBox(root);
  _severBBox.getCenter(outDir);
  outDir.sub(_severSpinePivot);
  if (outDir.lengthSq() < 1e-5) outDir.set(0, -1, 0);
  else outDir.normalize();
}

function limbSpineVerticality(root) {
  computeLimbSpineWorldDir(root, _severSpineDir);
  return Math.abs(_severSpineDir.y);
}

function applyWorldRotationAroundPoint(obj, worldPivot, worldQuat) {
  _severRotOffset.copy(obj.position).sub(worldPivot);
  _severRotOffset.applyQuaternion(worldQuat);
  obj.position.copy(worldPivot).add(_severRotOffset);
  obj.quaternion.premultiply(worldQuat).normalize();
}

function pinSeveredChunkToFloor(chunk, floorY) {
  const bottomY = computeSubtreeLowestY(chunk.root);
  if (!Number.isFinite(bottomY)) return;
  const lift = floorY - bottomY;
  if (Math.abs(lift) > 0.0005) chunk.root.position.y += lift;
}

/** Rotate a severed chunk so its long axis lies on the floor. */
function flattenSeveredChunkOnGround(chunk, floorY) {
  const root = chunk.root;

  for (let pass = 0; pass < 2; pass++) {
    computeSubtreeWorldBox(root);
    _severBBox.getCenter(_severFlatCenter);
    computeLimbSpineWorldDir(root, _severSpineDir);

    if (_severSpineDir.y > 0.12) {
      _severFlatTarget.copy(_severSpineDir);
      _severFlatTarget.y = 0;
      if (_severFlatTarget.lengthSq() < 1e-4) _severFlatTarget.set(1, 0, 0);
      else _severFlatTarget.normalize();
      _severFlatQuat.setFromUnitVectors(_severSpineDir, _severFlatTarget);
      applyWorldRotationAroundPoint(root, _severFlatCenter, _severFlatQuat);
    } else if (_severSpineDir.y < -0.12) {
      _severFlatTarget.copy(_severSpineDir).negate();
      _severFlatTarget.y = 0;
      if (_severFlatTarget.lengthSq() < 1e-4) _severFlatTarget.set(1, 0, 0);
      else _severFlatTarget.normalize();
      _severFlatQuat.setFromUnitVectors(_severSpineDir, _severFlatTarget);
      applyWorldRotationAroundPoint(root, _severFlatCenter, _severFlatQuat);
    }
  }

  computeSubtreeWorldBox(root);
  _severBBox.getCenter(_severFlatCenter);
  _severFlatQuat.setFromAxisAngle(_severWorldUp, Math.random() * Math.PI * 2);
  applyWorldRotationAroundPoint(root, _severFlatCenter, _severFlatQuat);
  pinSeveredChunkToFloor(chunk, floorY);
}

function applyGroundFlattening(chunk, floorY, dt) {
  const root = chunk.root;
  computeSubtreeWorldBox(root);
  _severBBox.getCenter(_severFlatCenter);
  computeLimbSpineWorldDir(root, _severSpineDir);

  const tilt = Math.abs(_severSpineDir.y);
  if (tilt < 0.1) return;

  _severFlatTarget.copy(_severSpineDir);
  _severFlatTarget.y = 0;
  if (_severFlatTarget.lengthSq() < 1e-4) _severFlatTarget.set(1, 0, 0);
  else _severFlatTarget.normalize();

  _severFlatQuat.setFromUnitVectors(_severSpineDir, _severFlatTarget);
  _severFlatQuat.slerp(_severIdentityQuat, 1 - Math.min(1, dt * SEVER_FLAT_SPIN));
  applyWorldRotationAroundPoint(root, _severFlatCenter, _severFlatQuat);
  pinSeveredChunkToFloor(chunk, floorY);
}

function getLimbChainIds(rootId) {
  if (rootId.startsWith("upperArm")) return [rootId, `forearm${rootId.slice(-1)}`];
  if (rootId.startsWith("thigh")) return [rootId, `shin${rootId.slice(-1)}`];
  return [rootId];
}

function collectObjectMaterials(root) {
  /** @type {THREE.Material[]} */
  const materials = [];
  root.traverse((obj) => {
    if (obj.material) materials.push(obj.material);
  });
  return materials;
}

function computeSeverLimbThrowDir(ragdoll, limb, rootId, blastDir, out) {
  ragdoll.rootGroup.getWorldPosition(_severSpinePivot);
  limb.pivot.getWorldPosition(_ragdollLimbEnd);
  out.subVectors(_ragdollLimbEnd, _severSpinePivot);

  if (out.lengthSq() < 0.0025) {
    if (rootId.endsWith("L")) out.set(-1, 0.12, 0);
    else if (rootId.endsWith("R")) out.set(1, 0.12, 0);
    else out.copy(blastDir);
  }

  out.y = Math.max(out.y, 0.06);
  out.normalize();

  if (blastDir?.lengthSq() > 1e-6) {
    _severFlatTarget.copy(blastDir).normalize();
    out.lerp(_severFlatTarget, 0.18).normalize();
  }

  return out;
}

function spawnGrenadeDeathBlood(mesh, blastDir, blastFalloff, scene, onBloodSplatter) {
  if (!scene || !blastDir) return;
  const height = mesh.userData.height ?? DEFAULT_TARGET_CONFIG.height;
  const damage = Math.max(14, Math.round(18 + blastFalloff * 52));

  _ragdollLimbEnd.set(mesh.position.x, mesh.position.y + height * 0.42, mesh.position.z);
  onBloodSplatter?.(spawnBloodSplatter(scene, _ragdollLimbEnd.clone(), blastDir, damage));

  _ragdollLimbEnd.y = mesh.position.y + height * 0.2;
  onBloodSplatter?.(
    spawnBloodSplatter(scene, _ragdollLimbEnd.clone(), blastDir, Math.round(damage * 0.55)),
  );
}

function applyGrenadeLimbSevering(
  ragdoll,
  blastDir,
  knockbackMul,
  blastFalloff,
  scene,
  onBloodSplatter,
  gameCore,
) {
  if (!scene || !blastDir) return;
  ragdoll.severed = [];

  for (const rootId of GRENADE_SEVERABLE_ROOTS) {
    const limb = ragdoll.limbs.find((l) => l.id === rootId);
    if (!limb) continue;

    computeSeverLimbThrowDir(ragdoll, limb, rootId, blastDir, _severSpineDir);
    const plan = requireWasmMethod(gameCore, "planRagdollSever")({
      rootId,
      blastFalloff,
      knockbackMul,
      spineDirX: _severSpineDir.x,
      spineDirZ: _severSpineDir.z,
      chanceRoll: Math.random(),
      horizontalRoll: Math.random(),
      velXRoll: Math.random(),
      velYRoll: Math.random(),
      velZRoll: Math.random(),
      angularXRoll: Math.random(),
      angularYRoll: Math.random(),
      angularZRoll: Math.random(),
    });
    if (!plan.sever) continue;

    const chainIds = getLimbChainIds(rootId);
    const chainSet = new Set(chainIds);

    limb.pivot.updateMatrixWorld(true);
    _ragdollLimbEnd.setFromMatrixPosition(limb.pivot.matrixWorld);
    onBloodSplatter?.(
      spawnBloodSplatter(scene, _ragdollLimbEnd.clone(), blastDir, plan.bloodDamage),
    );

    scene.attach(limb.pivot);

    ragdoll.severed.push({
      root: limb.pivot,
      vel: new THREE.Vector3(plan.velX, plan.velY, plan.velZ),
      angVel: new THREE.Vector3(plan.angularX, plan.angularY, plan.angularZ),
      groundContacts: 0,
      settled: false,
      materials: collectObjectMaterials(limb.pivot),
    });

    ragdoll.limbs = ragdoll.limbs.filter((l) => !chainSet.has(l.id));
  }
}

function disposeSeveredLimbs(ragdoll) {
  for (const chunk of ragdoll.severed ?? []) {
    chunk.root.parent?.remove(chunk.root);
    chunk.root.traverse((obj) => {
      obj.geometry?.dispose();
      obj.material?.dispose();
    });
  }
  ragdoll.severed = [];
}

function updateSeveredLimbs(ragdoll, dt, colliders, floorY, bounds, gameCore) {
  for (const chunk of ragdoll.severed ?? []) {
    if (chunk.settled) {
      pinSeveredChunkToFloor(chunk, floorY);
      continue;
    }

    chunk.vel.y -= LAUNCH_GRAVITY * dt;
    chunk.root.position.x += chunk.vel.x * dt;
    chunk.root.position.y += chunk.vel.y * dt;
    chunk.root.position.z += chunk.vel.z * dt;

    const rotSpeed = chunk.angVel.length();
    if (rotSpeed > 0.001) {
      _ragdollStepAxis.copy(chunk.angVel).normalize();
      _ragdollStepQuat.setFromAxisAngle(_ragdollStepAxis, rotSpeed * dt);
      chunk.root.quaternion.premultiply(_ragdollStepQuat).normalize();
    }

    let bottomY = computeSubtreeLowestY(chunk.root);
    let topY = computeSubtreeHighestY(chunk.root);
    const onGround = Number.isFinite(bottomY) && bottomY <= floorY + 0.04;

    if (Number.isFinite(bottomY) && bottomY < floorY) {
      chunk.root.position.y += floorY - bottomY;
      bottomY = floorY;
      if (chunk.vel.y < 0) {
        chunk.vel.y *= -0.1;
        chunk.vel.x *= 0.72;
        chunk.vel.z *= 0.72;
        chunk.angVel.multiplyScalar(0.5);
        chunk.groundContacts = (chunk.groundContacts ?? 0) + 1;
      }
    }

    const bodyLow = Number.isFinite(bottomY) ? bottomY : chunk.root.position.y;
    const bodyHigh = Number.isFinite(topY) ? topY : chunk.root.position.y + 0.35;

    const pushed = pushOutOfWalls(
      chunk.root.position.x,
      chunk.root.position.z,
      SEVER_CHUNK_RADIUS,
      colliders,
      bodyLow,
      bodyHigh,
    );
    chunk.root.position.x = pushed.x;
    chunk.root.position.z = pushed.z;

    const clamped = clampToBounds(
      chunk.root.position.x,
      chunk.root.position.z,
      SEVER_CHUNK_RADIUS,
      bounds,
    );
    chunk.root.position.x = clamped.x;
    chunk.root.position.z = clamped.z;

    if (onGround) {
      applyGroundFlattening(chunk, floorY, dt);
      chunk.vel.x *= Math.max(0, 1 - SEVER_GROUND_FRICTION * dt);
      chunk.vel.z *= Math.max(0, 1 - SEVER_GROUND_FRICTION * dt);
      chunk.angVel.multiplyScalar(Math.max(0, 1 - 6 * dt));
      if (chunk.vel.y < 0) chunk.vel.y = 0;
    } else {
      chunk.angVel.multiplyScalar(Math.max(0, 1 - 0.9 * dt));
    }

    const speed = Math.hypot(chunk.vel.x, chunk.vel.z, chunk.vel.y);
    const spin = chunk.angVel.length();
    const spineTilt = limbSpineVerticality(chunk.root);
    if (
      onGround &&
      (chunk.groundContacts ?? 0) >= 1 &&
      speed < SEVER_SETTLE_SPEED &&
      spin < SEVER_SETTLE_SPIN &&
      spineTilt < 0.35
    ) {
      flattenSeveredChunkOnGround(chunk, floorY);
      chunk.settled = true;
      chunk.vel.set(0, 0, 0);
      chunk.angVel.set(0, 0, 0);
    } else if (
      onGround &&
      (chunk.groundContacts ?? 0) >= 2 &&
      speed < SEVER_SETTLE_SPEED * 1.5
    ) {
      flattenSeveredChunkOnGround(chunk, floorY);
      chunk.settled = true;
      chunk.vel.set(0, 0, 0);
      chunk.angVel.set(0, 0, 0);
    }
  }
}

/* ── Phase timing constants ────────────────────────────────────────── */
const PHASE_IMPACT_SNAP_END = 0.12;
const PHASE_TORSO_TRANSFER_END = 0.35;
const PHASE_AIRBORNE_FLAIL_END = 0.60;

function resolveHitLimb(hitZone, hitPoint, bodyX) {
  const mapped = HIT_ZONE_LIMB_MAP[hitZone];
  if (!mapped) return null;
  if (mapped === "upperArm" || mapped === "thigh" || mapped === "shin") {
    const side = hitPoint && hitPoint.x < bodyX ? "L" : "R";
    return mapped + side;
  }
  return mapped;
}

const _D = Math.PI / 180;
const JOINT_LIMITS = {
  upperArmL: { x: [-170*_D, 50*_D], y: [-90*_D, 90*_D], z: [-144*_D, 40*_D] },
  upperArmR: { x: [-170*_D, 50*_D], y: [-90*_D, 90*_D], z: [-40*_D, 144*_D] },
  forearmL:  { x: [-150*_D, 10*_D], y: [-90*_D, 90*_D], z: [-50*_D, 50*_D] },
  forearmR:  { x: [-150*_D, 10*_D], y: [-90*_D, 90*_D], z: [-50*_D, 50*_D] },
  thighL:    { x: [-115*_D, 25*_D], y: [-50*_D, 50*_D], z: [-45*_D, 25*_D] },
  thighR:    { x: [-115*_D, 25*_D], y: [-50*_D, 50*_D], z: [-25*_D, 45*_D] },
  shinL:     { x: [  -3*_D,135*_D], y: [-10*_D, 10*_D], z: [-5*_D,   5*_D] },
  shinR:     { x: [  -3*_D,135*_D], y: [-10*_D, 10*_D], z: [-5*_D,   5*_D] },
};
const JOINT_LIMIT_DEFAULT = {
  x: [-90*_D, 90*_D], y: [-90*_D, 90*_D], z: [-90*_D, 90*_D],
};

const _ragdollLocalDown = new THREE.Vector3();
const _ragdollQuat = new THREE.Quaternion();
const _ragdollErrorQuat = new THREE.Quaternion();
const _ragdollErrorAxis = new THREE.Vector3();
const _ragdollStepAxis = new THREE.Vector3();
const _ragdollStepQuat = new THREE.Quaternion();
const _ragdollTargetQuat = new THREE.Quaternion();
const _ragdollLimbEnd = new THREE.Vector3();
const _ragdollIdentityQuat = new THREE.Quaternion();
const _ragdollTempQuat = new THREE.Quaternion();
const _ragdollInvMatrix = new THREE.Matrix4();
const _ragdollCorrDir = new THREE.Vector3();
const _ragdollCurDir = new THREE.Vector3();
const _ragdollEuler = new THREE.Euler();

function createRagdoll(
  mesh,
  bulletDir,
  scene,
  hitZone,
  hitPoint,
  knockbackMul = 1,
  blastFalloff = 1,
  onBloodSplatter = null,
  gameCore = null,
) {
  const height = mesh.userData.height ?? DEFAULT_TARGET_CONFIG.height;
  const pose = mesh.userData.targetPose ?? DEFAULT_TARGET_POSE;
  const template = getRagdollTemplate(height, pose);
  const segs = cloneRagdollSegments(template);

  const profile = HIT_PROFILES[hitZone] ?? HIT_PROFILES.body;
  const blastKnockback = knockbackMul;
  const hitLimbId = resolveHitLimb(hitZone, hitPoint, mesh.position.x);

  const coreIds = new Set(["head", "torso", "pelvis"]);
  const limbSegs = segs.filter((s) => !coreIds.has(s.id));

  const coreMerged = template.coreMerged.clone();
  const coreHalfX = template.coreHalfX;
  const coreHalfZ = template.coreHalfZ;

  const rootGroup = new THREE.Group();
  rootGroup.position.copy(mesh.position);
  scene.add(rootGroup);

  const ragdollMat =
    mesh.userData.predictiveRagdollMat ?? acquireRagdollMaterial();
  mesh.userData.predictiveRagdollMat = null;
  const coreMesh = new THREE.Mesh(coreMerged, ragdollMat);
  configureRagdollMesh(coreMesh);
  rootGroup.add(coreMesh);

  const z = Object.fromEntries(HIT_ZONES.map((zone) => [zone.id, zone]));
  const h = height;
  const armOff = (pose.armOffset ?? 0.12) * h;
  const shoulderY = h * (0.5 - z.arm.fromTop - 0.03);
  const legOff = (pose.legOffset ?? 0.048) * h;
  const hipY = h * (0.5 - z.thigh.fromTop);

  const armAngle = pose.armAngle ?? 0.45;
  const armTotalH = h * (z.arm.toTop - z.arm.fromTop);
  const upperArmH = armTotalH * 0.46;
  const legAngle = pose.legAngle ?? 0.10;
  const kneeZoneY = h * (0.5 - (z.knee.fromTop + z.knee.toTop) / 2);

  const anchors = {};
  const childParent = {};
  const rifleJoints = pose.rifleHold ? getRifleArmJoints(h) : null;
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? "L" : "R";
    const aa = sign * armAngle;
    anchors[`upperArm${side}`] = rifleJoints
      ? rifleJoints[side].shoulder.clone()
      : new THREE.Vector3(sign * armOff, shoulderY, 0);
    anchors[`forearm${side}`] = rifleJoints
      ? rifleJoints[side].elbow.clone()
      : new THREE.Vector3(
        upperArmH * Math.sin(aa) + sign * armOff,
        -upperArmH * Math.cos(aa) + shoulderY,
        0,
      );
    childParent[`forearm${side}`] = `upperArm${side}`;

    const la = sign * legAngle;
    const dy = kneeZoneY - hipY;
    anchors[`thigh${side}`] = new THREE.Vector3(sign * legOff, hipY, 0);
    anchors[`shin${side}`] = new THREE.Vector3(
      -dy * Math.sin(la) + sign * legOff,
      dy * Math.cos(la) + hipY,
      0,
    );
    childParent[`shin${side}`] = `thigh${side}`;
  }

  const limbsById = {};
  const limbs = [];
  const extraMaterials = [];

  function makeLimb(seg, parentGroup, pivotPos) {
    const anchor = anchors[seg.id];
    if (!anchor) { seg.geometry.dispose(); return; }
    seg.geometry.translate(
      seg.center.x - anchor.x,
      seg.center.y - anchor.y,
      seg.center.z - anchor.z,
    );
    const limbVec = new THREE.Vector3(
      seg.center.x - anchor.x,
      seg.center.y - anchor.y,
      seg.center.z - anchor.z,
    );
    const limbLength = limbVec.length() * 2;
    const defaultDir = limbVec.normalize();

    const pivot = new THREE.Group();
    pivot.position.copy(pivotPos);
    parentGroup.add(pivot);

    let limbMat = ragdollMat;
    if (seg.id.startsWith("shin")) {
      limbMat = acquireRagdollMaterial();
      limbMat.polygonOffsetFactor = RAGDOLL_SHIN_POLYGON_OFFSET.factor;
      limbMat.polygonOffsetUnits = RAGDOLL_SHIN_POLYGON_OFFSET.units;
      extraMaterials.push(limbMat);
    }
    const limbMesh = new THREE.Mesh(seg.geometry, limbMat);
    configureRagdollMesh(limbMesh);
    pivot.add(limbMesh);

    const isHitLimb = seg.id === hitLimbId;
    const isLower = seg.id.startsWith("forearm") || seg.id.startsWith("shin");

    const isArm = seg.id.startsWith("upperArm") || seg.id.startsWith("forearm");
    const limbPlan = gameCore
      ? requireWasmMethod(gameCore, "planRagdollLimbImpulse")({
          mode: hitZone === "grenade" && bulletDir
            ? "grenade"
            : (isHitLimb && bulletDir ? "hit" : "passive"),
          isArm,
          isLower,
          isHitLimb,
          profileImpulseMul: profile.impulseMul,
          blastKnockback,
          bulletDirX: bulletDir?.x ?? null,
          bulletDirZ: bulletDir?.z ?? null,
          strengthRoll: Math.random(),
          xRoll: Math.random(),
          yRoll: Math.random(),
          zRoll: Math.random(),
        })
      : { x: 0, y: 0, z: 0, activationDelay: 0 };

    const limb = {
      pivot,
      mesh: limbMesh,
      id: seg.id,
      defaultDir: defaultDir.clone(),
      limbLength,
      limits: JOINT_LIMITS[seg.id] ?? JOINT_LIMIT_DEFAULT,
      angularVel: new THREE.Vector3(limbPlan.x, limbPlan.y, limbPlan.z),
      isHitLimb,
      activationDelay: limbPlan.activationDelay,
    };
    limbs.push(limb);
    limbsById[seg.id] = limb;
  }

  for (const seg of limbSegs) {
    if (childParent[seg.id]) continue;
    if (anchors[seg.id]) makeLimb(seg, rootGroup, anchors[seg.id]);
    else seg.geometry.dispose();
  }
  for (const seg of limbSegs) {
    const pId = childParent[seg.id];
    if (!pId) continue;
    const parentLimb = limbsById[pId];
    if (!parentLimb) { seg.geometry.dispose(); continue; }
    const relPos = anchors[seg.id].clone().sub(anchors[pId]);
    makeLimb(seg, parentLimb.pivot, relPos);
  }

  const zoneId = hitZone ?? "body";
  const zoneMult =
    zoneId === "body" || zoneId === "miss"
      ? 1
      : HIT_ZONES.find((z) => z.id === zoneId)?.mult ?? 1;
  const impulse = gameCore
    ? requireWasmMethod(gameCore, "resolveRagdollImpulseSeed")({
        hitZone: zoneId,
        zoneMult,
        bulletDirX: bulletDir?.x ?? null,
        bulletDirZ: bulletDir?.z ?? null,
        dirRoll: Math.random(),
        angularRoll: Math.random(),
        launchRoll: Math.random(),
        spinSignRoll: Math.random(),
        spinRoll: Math.random(),
        profileLaunchMul: profile.launchMul,
        profileSpinMul: profile.spinMul,
        blastKnockback,
        deathInitialAngularVel: DEATH_INITIAL_ANGULAR_VEL,
        launchUpVel: LAUNCH_UP_VEL,
        launchBackVel: LAUNCH_BACK_VEL,
        spinVelMin: SPIN_VEL_MIN,
        spinVelMax: SPIN_VEL_MAX,
      })
    : {
        deathDir: 0,
        angularVel: 0,
        launchVelY: 0,
        launchVelX: 0,
        launchVelZ: 0,
        spinVel: 0,
      };
  const deathDir = impulse.deathDir;

  const hitSide = hitPoint
    ? (hitPoint.x < mesh.position.x ? -1 : 1)
    : 0;

  const ragdoll = {
    rootGroup,
    coreMesh,
    limbs,
    extraMaterials,
    severed: [],
    hitZone: hitZone ?? "body",
    hitLimbId,
    profile,
    core: {
      tipAngle: profile.foldAngle,
      angularVel: impulse.angularVel,
      dir: deathDir,
      originX: mesh.position.x,
      originZ: mesh.position.z,
      height,
      radius: mesh.userData.radius ?? 0.45,
      halfX: coreHalfX,
      halfZ: coreHalfZ,
      settled: false,
      settledAt: null,
      bounced: false,
      launchY: 0,
      launchVelY: impulse.launchVelY,
      launchVelX: impulse.launchVelX,
      launchVelZ: impulse.launchVelZ,
      airborne: true,
      spinAngle: 0,
      spinVel: impulse.spinVel,
      toppleDelay: profile.toppleDelay,
      toppleDelayActive: true,
      hitSide,
      torsoTwist: hitSide * 0.15,
    },
    time: 0,
    allResting: false,
    restingTime: null,
    limbsFrozen: false,
    fallingThroughHole: false,
    holeFallVelY: 0,
    holeFallOffset: 0,
    lastFloorHitTime: null,
  };

  if (hitZone === "grenade") {
    spawnGrenadeDeathBlood(mesh, bulletDir, blastFalloff, scene, onBloodSplatter);
    applyGrenadeLimbSevering(
      ragdoll,
      bulletDir,
      blastKnockback,
      blastFalloff,
      scene,
      onBloodSplatter,
      gameCore,
    );
  }

  return ragdoll;
}

function disposeRagdoll(ragdoll) {
  disposeSeveredLimbs(ragdoll);
  if (ragdoll.rootGroup) {
    disposeBloodMarksOnTarget(ragdoll.rootGroup);
    ragdoll.rootGroup.parent?.remove(ragdoll.rootGroup);
    ragdoll.coreMesh?.geometry?.dispose();
    releaseRagdollMaterial(ragdoll.coreMesh?.material);
    for (const limb of ragdoll.limbs) {
      limb.mesh.geometry?.dispose();
    }
    for (const mat of ragdoll.extraMaterials ?? []) {
      releaseRagdollMaterial(mat);
    }
  }
  ragdoll.limbs.length = 0;
}

function clampToBounds(px, pz, r, bounds) {
  return clampToBoundsCore(null, px, pz, r, bounds);
}

function beginRagdollHoleFall(ragdoll, root, floorY, onHoleFall) {
  if (ragdoll.fallingThroughHole) return;
  ragdoll.fallingThroughHole = true;
  ragdoll.holeFallVelY = -2;
  ragdoll.holeFallOffset = root.position.y - floorY;
  onHoleFall?.(root.position.clone());
}

const RAGDOLL_HOLE_MIN_TIP = Math.PI / 2 - 0.08;

/** Ragdoll must be down on the deck before a hole opens beneath it. */
function ragdollOnDeck(core) {
  return !core.airborne && core.tipAngle >= RAGDOLL_HOLE_MIN_TIP;
}

/** @param {{ x: number, z: number, radius?: number }[]} floorHoles */
function detectRagdollOverHole(
  ragdoll,
  core,
  root,
  floorY,
  floorHoles,
  onHoleFall,
  gameCore = null,
) {
  if (!floorHoles?.length || ragdoll.fallingThroughHole) return;
  if (!ragdollOnDeck(core)) return;

  const inset = Math.min(core.radius ?? 0.35, 0.2);
  const samplePoints = [
    [core.originX, core.originZ],
    [root.position.x, root.position.z],
  ];
  for (const [x, z] of samplePoints) {
    if (pointInFloorHole(x, z, floorHoles, inset, gameCore)) {
      beginRagdollHoleFall(ragdoll, root, floorY, onHoleFall);
      return;
    }
  }
}

function updateRagdollHoleFall(ragdoll, root, floorY, dt, gameCore) {
  if (!ragdoll.fallingThroughHole) return false;

  const out = tickRagdollHoleFallCore(gameCore, {
    holeFallVelY: ragdoll.holeFallVelY,
    holeFallOffset: ragdoll.holeFallOffset,
    floorY,
    dt,
  });
  ragdoll.holeFallVelY = out.holeFallVelY;
  ragdoll.holeFallOffset = out.holeFallOffset;
  root.position.y = out.rootY;

  if (out.opacity < 1) {
    ragdoll.coreMesh.material.opacity = out.opacity;
    ragdoll.coreMesh.material.transparent = true;
    for (const limb of ragdoll.limbs) {
      limb.mesh.material.opacity = out.opacity;
      limb.mesh.material.transparent = true;
    }
    for (const chunk of ragdoll.severed ?? []) {
      for (const mat of chunk.materials) {
        mat.opacity = out.opacity;
        mat.transparent = true;
      }
    }
  }
  if (out.finished) return true;

  return root.position.y < floorY - HOLE_FALL_REMOVE_DEPTH;
}

function tryRagdollFloorHit(ragdoll, position, impact, onFloorHit) {
  if (!onFloorHit || !position) return;
  const t = ragdoll.time;
  if (ragdoll.lastFloorHitTime != null && t - ragdoll.lastFloorHitTime < 0.12) {
    return;
  }
  ragdoll.lastFloorHitTime = t;
  onFloorHit(position, impact);
}

function applyLimbProbeCorrection(limb) {
  _ragdollInvMatrix.copy(limb.pivot.parent.matrixWorld).invert();
  _ragdollCorrDir
    .copy(_ragdollLimbEnd)
    .applyMatrix4(_ragdollInvMatrix)
    .sub(limb.pivot.position)
    .normalize();
  _ragdollCurDir
    .copy(limb.defaultDir)
    .applyQuaternion(limb.pivot.quaternion)
    .normalize();
  _ragdollStepQuat.setFromUnitVectors(_ragdollCurDir, _ragdollCorrDir);
  limb.pivot.quaternion
    .premultiply(_ragdollStepQuat)
    .normalize();
}

/** @returns {boolean} true when the probe hit floor, walls, or bounds */
function probeLimbContact(limb, frac, floorY, colliders, bounds, skipFloor, gameCore) {
  const limbR = 0.06;
  _ragdollLimbEnd
    .copy(limb.defaultDir)
    .multiplyScalar(limb.limbLength * frac)
    .applyMatrix4(limb.pivot.matrixWorld);

  let hit = false;
  const isShin = limb.id.startsWith("shin");
  const floorSkin = isShin ? RAGDOLL_SHIN_FLOOR_SKIN : RAGDOLL_FLOOR_SKIN;
  const floorLimit = floorY + limbR + floorSkin;
  if (!skipFloor && _ragdollLimbEnd.y < floorLimit) {
    _ragdollLimbEnd.y = floorLimit;
    hit = true;
  }

  const wP = pushOutOfWalls(
    _ragdollLimbEnd.x,
    _ragdollLimbEnd.z,
    limbR,
    colliders,
    _ragdollLimbEnd.y - limbR,
    _ragdollLimbEnd.y + limbR,
  );
  if (wP.x !== _ragdollLimbEnd.x || wP.z !== _ragdollLimbEnd.z) {
    _ragdollLimbEnd.x = wP.x;
    _ragdollLimbEnd.z = wP.z;
    hit = true;
  }

  const bP = clampToBounds(
    _ragdollLimbEnd.x, _ragdollLimbEnd.z, limbR, bounds,
  );
  if (bP.x !== _ragdollLimbEnd.x || bP.z !== _ragdollLimbEnd.z) {
    _ragdollLimbEnd.x = bP.x;
    _ragdollLimbEnd.z = bP.z;
    hit = true;
  }

  return hit;
}

function freezeRagdollLimbs(ragdoll) {
  if (ragdoll.limbsFrozen) return;
  ragdoll.limbsFrozen = true;

  for (const limb of ragdoll.limbs) {
    limb.angularVel.set(0, 0, 0);
    limb.frozen = true;
  }

  ragdoll.core.spinVel = 0;
}

function updateRagdollPhysics(ragdoll, dt, colliders, floorY, bounds, floorHoles, callbacks) {
  const gameCore = callbacks?.gameCore ?? null;
  ragdoll.time += dt;
  updateSeveredLimbs(ragdoll, dt, colliders, floorY, bounds, gameCore);

  if (ragdoll.allResting && !ragdoll.fallingThroughHole) {
    return tickRagdollFade(ragdoll);
  }

  const core = ragdoll.core;
  const root = ragdoll.rootGroup;
  const t = ragdoll.time;
  const onFloorHit = callbacks?.onFloorHit;
  const wasSettled = core.settled;

  // ── Phase-gated topple delay ──
  // During the impact snap phase, only the hit limb reacts; torso stays upright.
  if (core.toppleDelayActive && t < core.toppleDelay) {
    // Stiff muscular hold — no topple yet, just minor torso twist from hit side
    if (core.torsoTwist !== 0) {
      const twistProgress = Math.min(1, t / core.toppleDelay);
      root.rotation.set(0, 0, 0);
      root.rotateY(core.torsoTwist * twistProgress);
    }
    root.position.copy(ragdoll.rootGroup.position);
    root.position.y = core.height / 2 + floorY;
    root.updateMatrixWorld(true);

    // Only update hit limb during impact snap
    for (const limb of ragdoll.limbs) {
      if (!limb.isHitLimb) continue;
      const rotSpeed = limb.angularVel.length();
      if (rotSpeed > 0.001) {
        _ragdollStepAxis.copy(limb.angularVel).normalize();
        _ragdollStepQuat.setFromAxisAngle(_ragdollStepAxis, rotSpeed * dt);
        limb.pivot.quaternion.premultiply(_ragdollStepQuat).normalize();
      }
      limb.angularVel.multiplyScalar(Math.max(0, 1 - 3 * dt));
      limb.pivot.updateMatrixWorld(false);

      _ragdollEuler.setFromQuaternion(limb.pivot.quaternion, "XYZ");
      const lim = limb.limits;
      let jClamped = false;
      if (_ragdollEuler.x < lim.x[0]) { _ragdollEuler.x = lim.x[0]; jClamped = true; }
      if (_ragdollEuler.x > lim.x[1]) { _ragdollEuler.x = lim.x[1]; jClamped = true; }
      if (_ragdollEuler.y < lim.y[0]) { _ragdollEuler.y = lim.y[0]; jClamped = true; }
      if (_ragdollEuler.y > lim.y[1]) { _ragdollEuler.y = lim.y[1]; jClamped = true; }
      if (_ragdollEuler.z < lim.z[0]) { _ragdollEuler.z = lim.z[0]; jClamped = true; }
      if (_ragdollEuler.z > lim.z[1]) { _ragdollEuler.z = lim.z[1]; jClamped = true; }
      if (jClamped) {
        limb.pivot.quaternion.setFromEuler(_ragdollEuler);
        limb.angularVel.multiplyScalar(0.1);
        limb.pivot.updateMatrixWorld(false);
      }
    }
    if (updateRagdollHoleFall(ragdoll, root, floorY, dt, gameCore)) return true;
    return false;
  }

  if (core.toppleDelayActive) {
    core.toppleDelayActive = false;
  }

  const toppleTime = t - core.toppleDelay;

  // ── Core topple (gravity-based, delayed by impact snap phase) ──
  const toppleOut = tickRagdollCoreToppleCore(gameCore, {
    tipAngle: core.tipAngle,
    angularVel: core.angularVel,
    settled: core.settled,
    bounced: core.bounced,
    dt,
  });
  core.tipAngle = toppleOut.tipAngle;
  core.angularVel = toppleOut.angularVel;
  core.settled = toppleOut.settled;
  core.bounced = toppleOut.bounced;

  if (core.settled && core.settledAt == null) {
    core.settledAt = t;
  }

  // ── Ballistic launch (body flies up + backward from bullet impact) ──
  if (core.airborne) {
    const launchOut = tickRagdollLaunchCore(gameCore, {
      launchY: core.launchY,
      launchVelY: core.launchVelY,
      launchVelX: core.launchVelX,
      launchVelZ: core.launchVelZ,
      originX: core.originX,
      originZ: core.originZ,
      airborne: core.airborne,
      dt,
    });
    core.launchY = launchOut.launchY;
    core.launchVelY = launchOut.launchVelY;
    core.launchVelX = launchOut.launchVelX;
    core.launchVelZ = launchOut.launchVelZ;
    core.originX = launchOut.originX;
    core.originZ = launchOut.originZ;
    core.airborne = launchOut.airborne;
    if (!launchOut.airborne) {
      tryRagdollFloorHit(
        ragdoll,
        new THREE.Vector3(core.originX, floorY, core.originZ),
        launchOut.floorImpact,
        onFloorHit,
      );
      core.launchVelX *= 0.3;
      core.launchVelZ *= 0.3;
    }
  } else if (
    Math.abs(core.launchVelX) > 0.01 ||
    Math.abs(core.launchVelZ) > 0.01
  ) {
    core.originX += core.launchVelX * dt;
    core.originZ += core.launchVelZ * dt;
    core.launchVelX *= Math.max(0, 1 - LAUNCH_GROUND_FRICTION * dt);
    core.launchVelZ *= Math.max(0, 1 - LAUNCH_GROUND_FRICTION * dt);
  }

  // ── Spin (random Y rotation, damped) ──
  core.spinAngle += core.spinVel * dt;
  if (!core.airborne) {
    core.spinVel *= Math.max(0, 1 - SPIN_GROUND_FRICTION * dt);
  }

  // ── Torso twist decay (hit-side rotation fades into ragdoll spin) ──
  if (core.torsoTwist !== 0) {
    core.torsoTwist *= Math.max(0, 1 - 4 * dt);
    if (Math.abs(core.torsoTwist) < 0.01) core.torsoTwist = 0;
  }

  const effDir = core.dir + core.spinAngle;
  const sinD = Math.sin(effDir);
  const cosD = Math.cos(effDir);
  const halfH = core.height / 2;
  const tipSin = Math.sin(core.tipAngle);
  const tipCos = Math.cos(core.tipAngle);
  const slide = halfH * tipSin;
  const coreCollR = Math.max(core.halfX, core.halfZ);
  const origX0 = core.originX;
  const origZ0 = core.originZ;
  const ragdollFootY = floorY + core.launchY;
  const ragdollBodyTop = ragdollFootY + core.height;

  let { x: oX, z: oZ } = pushOutOfWalls(
    core.originX, core.originZ, coreCollR, colliders, ragdollFootY, ragdollBodyTop,
  );

  const midX = oX + sinD * slide;
  const midZ = oZ + cosD * slide;
  const midPush = pushOutOfWalls(midX, midZ, coreCollR, colliders, ragdollFootY, ragdollBodyTop);
  oX += midPush.x - midX;
  oZ += midPush.z - midZ;

  const endX = oX + sinD * slide * 2;
  const endZ = oZ + cosD * slide * 2;
  const endPush = pushOutOfWalls(endX, endZ, coreCollR, colliders, ragdollFootY, ragdollBodyTop);
  oX += endPush.x - endX;
  oZ += endPush.z - endZ;

  const clamped = clampToBounds(oX, oZ, coreCollR, bounds);
  core.originX = clamped.x;
  core.originZ = clamped.z;

  if (core.originX !== origX0 || core.originZ !== origZ0) {
    if (core.originX !== origX0) core.launchVelX *= -0.2;
    if (core.originZ !== origZ0) core.launchVelZ *= -0.2;
    core.spinVel *= -0.3;
  }

  // Apply topple pose + spin + torso twist to root group
  root.rotation.set(0, 0, 0);
  root.rotateY(core.dir);
  root.rotateX(core.tipAngle);
  root.rotateY(-core.dir);
  if (core.torsoTwist !== 0) {
    _ragdollStepQuat.setFromAxisAngle(
      _ragdollStepAxis.set(0, 1, 0), core.torsoTwist,
    );
    root.quaternion.premultiply(_ragdollStepQuat);
  }
  _ragdollStepQuat.setFromAxisAngle(
    _ragdollStepAxis.set(0, 1, 0), core.spinAngle,
  );
  root.quaternion.premultiply(_ragdollStepQuat);

  const sinTipDir = Math.sin(core.dir);
  const cosTipDir = Math.cos(core.dir);
  const groundClearance =
    core.halfX * Math.abs(sinTipDir * tipSin) +
    halfH * Math.abs(tipCos) +
    core.halfZ * Math.abs(cosTipDir * tipSin);
  root.position.y = groundClearance + floorY + core.launchY;
  const slideNow = halfH * tipSin;
  root.position.x = core.originX + sinD * slideNow;
  root.position.z = core.originZ + cosD * slideNow;

  if (!wasSettled && core.settled) {
    tryRagdollFloorHit(
      ragdoll,
      new THREE.Vector3(root.position.x, floorY, root.position.z),
      0.4,
      onFloorHit,
    );
  }

  // ── Limb swing (phase-aware spring-damped pendulums) ──
  root.updateMatrixWorld(true);

  if (
    !ragdoll.limbsFrozen &&
    core.settled &&
    !core.airborne &&
    core.settledAt != null
  ) {
    const settledAge = t - core.settledAt;
    const limbsSlow =
      ragdoll.limbs.length === 0 ||
      ragdoll.limbs.every((l) => l.angularVel.length() < 0.06);
    if (
      settledAge >= RAGDOLL_LIMB_FREEZE_DELAY &&
      (limbsSlow || settledAge >= RAGDOLL_LIMB_FREEZE_MAX)
    ) {
      freezeRagdollLimbs(ragdoll);
      if (!ragdoll.allResting) {
        ragdoll.allResting = true;
        ragdoll.restingTime = t;
        disableRagdollShadowCast(ragdoll);
      }
    }
  }

  // Phase-dependent spring/damping — starts loose so limbs swing freely,
  // then tightens as the body settles into gravity
  const phaseT = Math.min(1, toppleTime / 1.2);
  const easeIn = phaseT * phaseT;
  const springStr = THREE.MathUtils.lerp(LIMB_SPRING * 0.15, LIMB_SPRING, easeIn);
  const dampStr = THREE.MathUtils.lerp(LIMB_DAMPING * 0.3, LIMB_DAMPING, easeIn);
  const runLimbCollisions =
    !core.airborne && (core.settled || toppleTime >= 0.28);
  const settledBlend =
    core.settled && core.settledAt != null && !ragdoll.limbsFrozen
      ? Math.min(1, (t - core.settledAt) / RAGDOLL_LIMB_FREEZE_DELAY)
      : 0;

  let allLimbsSettled = ragdoll.limbsFrozen;
  if (!ragdoll.limbsFrozen) {
  for (const limb of ragdoll.limbs) {
    const isArm = limb.id.startsWith("upperArm") || limb.id.startsWith("forearm");
    const limbTypeScale = isArm ? 0.4 : 1.0;

    const limbActiveT = Math.min(1, Math.max(0, (t - limb.activationDelay) / 0.15));
    let limbSpring = THREE.MathUtils.lerp(springStr * 0.2, springStr * limbTypeScale, limbActiveT);
    let limbDamp = THREE.MathUtils.lerp(dampStr * 0.4, dampStr * limbTypeScale, limbActiveT);
    if (settledBlend > 0) {
      limbSpring *= 1 - settledBlend * 0.95;
      limbDamp *= 1 + settledBlend * 4;
    }

    limb.pivot.parent.getWorldQuaternion(_ragdollQuat);
    _ragdollTempQuat.copy(_ragdollQuat).invert();
    _ragdollLocalDown.set(0, -1, 0).applyQuaternion(_ragdollTempQuat);

    _ragdollTargetQuat.setFromUnitVectors(limb.defaultDir, _ragdollLocalDown);

    _ragdollTempQuat.copy(limb.pivot.quaternion).invert();
    _ragdollErrorQuat
      .copy(_ragdollTargetQuat)
      .multiply(_ragdollTempQuat)
      .normalize();

    if (_ragdollErrorQuat.w < 0) {
      _ragdollErrorQuat.x *= -1;
      _ragdollErrorQuat.y *= -1;
      _ragdollErrorQuat.z *= -1;
      _ragdollErrorQuat.w *= -1;
    }

    const w = Math.min(1, _ragdollErrorQuat.w);
    let errorAngle = 2 * Math.acos(w);
    const sinHalf = Math.sqrt(1 - w * w);

    if (sinHalf > 0.001) {
      _ragdollErrorAxis.set(
        _ragdollErrorQuat.x / sinHalf,
        _ragdollErrorQuat.y / sinHalf,
        _ragdollErrorQuat.z / sinHalf,
      );
    } else {
      _ragdollErrorAxis.set(0, 1, 0);
      errorAngle = 0;
    }

    limb.angularVel.addScaledVector(
      _ragdollErrorAxis, errorAngle * limbSpring * dt,
    );
    limb.angularVel.multiplyScalar(Math.max(0, 1 - limbDamp * dt));

    const rotSpeed = limb.angularVel.length();
    if (rotSpeed > 0.001) {
      _ragdollStepAxis.copy(limb.angularVel).normalize();
      _ragdollStepQuat.setFromAxisAngle(_ragdollStepAxis, rotSpeed * dt);
      limb.pivot.quaternion.premultiply(_ragdollStepQuat).normalize();
    }

    limb.pivot.updateMatrixWorld(false);

    _ragdollEuler.setFromQuaternion(limb.pivot.quaternion, "XYZ");
    const lim = limb.limits;
    let jClamped = false;
    if (_ragdollEuler.x < lim.x[0]) { _ragdollEuler.x = lim.x[0]; jClamped = true; }
    if (_ragdollEuler.x > lim.x[1]) { _ragdollEuler.x = lim.x[1]; jClamped = true; }
    if (_ragdollEuler.y < lim.y[0]) { _ragdollEuler.y = lim.y[0]; jClamped = true; }
    if (_ragdollEuler.y > lim.y[1]) { _ragdollEuler.y = lim.y[1]; jClamped = true; }
    if (_ragdollEuler.z < lim.z[0]) { _ragdollEuler.z = lim.z[0]; jClamped = true; }
    if (_ragdollEuler.z > lim.z[1]) { _ragdollEuler.z = lim.z[1]; jClamped = true; }
    if (jClamped) {
      limb.pivot.quaternion.setFromEuler(_ragdollEuler);
      limb.angularVel.multiplyScalar(0.1);
      limb.pivot.updateMatrixWorld(false);
    }

    if (runLimbCollisions) {
    for (let pass = 0; pass < 2; pass++) {
      let anyHit = false;
      for (const frac of [1.0, 0.5]) {
        if (
          probeLimbContact(
            limb,
            frac,
            floorY,
            colliders,
            bounds,
            ragdoll.fallingThroughHole,
            gameCore,
          )
        ) {
          applyLimbProbeCorrection(limb);
          limb.angularVel.multiplyScalar(-0.15);
          limb.pivot.updateMatrixWorld(false);
          anyHit = true;
          break;
        }
      }
      if (!anyHit) break;
    }
    }

    if (rotSpeed > 0.08 || errorAngle > 0.06) allLimbsSettled = false;
  }
  }

  detectRagdollOverHole(
    ragdoll,
    core,
    root,
    floorY,
    floorHoles,
    callbacks?.onHoleFall,
    callbacks?.gameCore ?? null,
  );
  if (updateRagdollHoleFall(ragdoll, root, floorY, dt, gameCore)) return true;

  // ── Settle + fade ──
  if (ragdoll.fallingThroughHole) return false;
  const spinSettled = Math.abs(core.spinVel) < 0.1;
  const allSettled =
    core.settled && !core.airborne && spinSettled && allLimbsSettled;
  if (allSettled && !ragdoll.allResting) {
    ragdoll.allResting = true;
    ragdoll.restingTime = ragdoll.time;
    disableRagdollShadowCast(ragdoll);
  }

  return tickRagdollFade(ragdoll);
}

/**
 * Begin the death animation for a target.
 * When `opts.scene` is provided, spawns ragdoll body parts that tumble with
 * gravity and collide with floors/walls. Falls back to the legacy rigid
 * topple when no scene is given.
 * @param {THREE.Mesh} mesh
 * @param {THREE.Vector3} [bulletDir]
 * @param {{ scene?: THREE.Scene, colliders?: object[], floorY?: number, bounds?: object, hitZone?: string, hitPoint?: THREE.Vector3, knockbackMul?: number, blastFalloff?: number, onBloodSplatter?: (splatter: ReturnType<typeof spawnBloodSplatter> | null) => void }} [opts]
 */
export function startDeathAnimation(mesh, bulletDir, opts) {
  const ud = mesh.userData;
  ud.dying = true;
  ud.deathTime = 0;
  const height = mesh.userData.height ?? DEFAULT_TARGET_CONFIG.height;
  ud.deathFloorY = mesh.position.y - height / 2;
  const collider = ud.collider;
  if (collider) {
    collider.active = false;
    collider.halfX = 0;
    collider.halfZ = 0;
  }

  ud.deathColliders =
    opts?.colliders ?? ud.predictiveDeathColliders ?? ud.deathColliders;

  if (opts?.scene) {
    const bar = mesh.userData.healthBar;
    if (bar) bar.visible = false;

    ensureTargetRagdollTemplate(mesh);
    ud.ragdollPending = true;
    _pendingRagdolls.push({
      mesh,
      bulletDir,
      opts: {
        scene: opts.scene,
        hitZone: opts.hitZone,
        hitPoint: opts.hitPoint,
        knockbackMul: opts.knockbackMul,
        blastFalloff: opts.blastFalloff,
        onBloodSplatter: opts.onBloodSplatter,
        gameCore: opts.gameCore ?? null,
      },
    });
    return;
  }

  throw new Error("Target death requires a scene-backed Rust ragdoll");
}

/**
 * Tick all dying targets. Ragdoll deaths are driven by `updateRagdollPhysics`;
 * legacy topple deaths use the old gravity-based rotation.
 * Fires `onComplete(mesh)` when the animation is fully done.
 * @param {THREE.Mesh[]} targets
 * @param {number} dt
 * @param {(mesh: THREE.Mesh) => void} onComplete
 * @param {{ colliders?: object[], floorY?: number, bounds?: object, floorHoles?: { x: number, z: number, radius?: number }[], onBodyFloorHit?: (position: THREE.Vector3, impact: number) => void, onHoleFall?: (mesh: THREE.Mesh, position: THREE.Vector3) => void }} [opts]
 */
export function updateDeathAnimations(targets, dt, onComplete, opts) {
  const floorY = opts?.floorY ?? 0;
  const floorHoles = opts?.floorHoles ?? [];
  const onBodyFloorHit = opts?.onBodyFloorHit;
  const onHoleFall = opts?.onHoleFall;

  for (const mesh of targets) {
    const ud = mesh.userData;
    if (!ud.dying) continue;

    ud.deathTime += dt;

    if (ud.ragdollPending) continue;

    // Ragdoll path
    if (ud.ragdoll) {
      const ragdollFloorY = ud.deathFloorY ?? floorY;
      const ragdollOpts = {
        onFloorHit: onBodyFloorHit,
        onHoleFall: onHoleFall
          ? (position) => onHoleFall(mesh, position)
          : undefined,
        gameCore: opts?.gameCore ?? null,
      };
      const colliders = ud.deathColliders ?? opts?.colliders ?? [];
      const bounds = opts?.bounds ?? null;
      const substeps = Math.min(
        RAGDOLL_PHYSICS_MAX_SUBSTEPS,
        Math.max(1, Math.ceil(dt / RAGDOLL_PHYSICS_MAX_SUBDT)),
      );
      const subDt = dt / substeps;
      let done = false;
      for (let step = 0; step < substeps && !done; step += 1) {
        done = updateRagdollPhysics(
          ud.ragdoll,
          subDt,
          colliders,
          ragdollFloorY,
          bounds,
          floorHoles,
          ragdollOpts,
        );
      }
      if (done) {
        if (ud.ragdoll.rootGroup) {
          ud.deathFinalPos = ud.ragdoll.rootGroup.position.clone();
        }
        disposeRagdoll(ud.ragdoll);
        ud.ragdoll = null;
        onComplete(mesh);
      }
      continue;
    }

    throw new Error("Dying target has no Rust ragdoll state");
  }
}

/* ── HP orbs (VX-27 Power Core cylinder) ───────────────────────────── */

const HP_ORB_VALUE = 10;
const HP_ORB_RADIUS = 0.14;
const HP_ORB_BOUNCE_RESTITUTION = 0.55;
const HP_ORB_GRAVITY = 12;
const HP_ORB_GROUND_FRICTION = 3;
const HP_ORB_COLLECT_RADIUS = 0.6;
const HP_ORB_LIFETIME = 20;
const HP_ORB_SPIN_SPEED = 2.5;
const HP_ORB_BOB_SPEED = 2.0;
const HP_ORB_BOB_HEIGHT = 0.08;
const HP_ORB_CYL_RADIUS = 0.065;
const HP_ORB_CYL_LENGTH = 0.39;
const HP_ORB_SETTLE_Y = HP_ORB_CYL_RADIUS + 0.02;

let _orbGeo = null;
let _orbMats = null;
let _orbTexturesLoaded = false;

const _texLoader = new THREE.TextureLoader();
const _orbTexCache = new Map();

const HP_ORB_TEX_PATHS = [
  "/textures/vx27/vx27_body_albedo.webp",
  "/textures/vx27/vx27_body_normal.webp",
  "/textures/vx27/vx27_body_roughness.webp",
  "/textures/vx27/vx27_body_metallic.webp",
  "/textures/vx27/vx27_body_emissive.webp",
  "/textures/vx27/vx27_body_ao.webp",
  "/textures/vx27/vx27_endcap_albedo.webp",
  "/textures/vx27/vx27_endcap_normal.webp",
  "/textures/vx27/vx27_endcap_roughness.webp",
  "/textures/vx27/vx27_endcap_metallic.webp",
  "/textures/vx27/vx27_endcap_emissive.webp",
  "/textures/vx27/vx27_endcap_ao.webp",
];

let _orbPreloadPromise = null;

function loadTex(path, srgb = false, repeatX = 1, repeatY = 1, rotation = 0) {
  let tex = _orbTexCache.get(path);
  if (!tex) {
    tex = _texLoader.load(path);
    _orbTexCache.set(path, tex);
  }
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (rotation) {
    tex.rotation = rotation;
    tex.center.set(0.5, 0.5);
  }
  return tex;
}

/** Decode HP orb textures before first pickup spawn. */
export function preloadHpOrbAssets() {
  if (_orbMats) return Promise.resolve();
  if (_orbPreloadPromise) return _orbPreloadPromise;
  _orbPreloadPromise = Promise.all(
    HP_ORB_TEX_PATHS.map((path) =>
      _texLoader.loadAsync(path).then((tex) => {
        _orbTexCache.set(path, tex);
      })
    )
  )
    .then(() => {
      getOrbMaterials();
      getOrbGeometry();
    })
    .catch((err) => {
      _orbPreloadPromise = null;
      throw err;
    });
  return _orbPreloadPromise;
}

export function getOrbGeometry() {
  if (!_orbGeo) {
    _orbGeo = new THREE.CylinderGeometry(
      HP_ORB_CYL_RADIUS, HP_ORB_CYL_RADIUS, HP_ORB_CYL_LENGTH, 32, 1, false
    );
  }
  return _orbGeo;
}

export function getOrbMaterials() {
  if (!_orbMats) {
    const base = "/textures/vx27/";

    const rot = -Math.PI / 2;
    const bodyMat = new THREE.MeshStandardMaterial({
      map: loadTex(base + "vx27_body_albedo.webp", true, 1, 4, rot),
      normalMap: loadTex(base + "vx27_body_normal.webp", false, 1, 4, rot),
      roughnessMap: loadTex(base + "vx27_body_roughness.webp", false, 1, 4, rot),
      metalnessMap: loadTex(base + "vx27_body_metallic.webp", false, 1, 4, rot),
      emissiveMap: loadTex(base + "vx27_body_emissive.webp", true, 1, 4, rot),
      aoMap: loadTex(base + "vx27_body_ao.webp", false, 1, 4, rot),
      emissive: 0xffffff,
      emissiveIntensity: 1.5,
      metalness: 1,
      roughness: 1,
      transparent: true,
      opacity: 1,
    });

    const capMat = new THREE.MeshStandardMaterial({
      map: loadTex(base + "vx27_endcap_albedo.webp", true),
      normalMap: loadTex(base + "vx27_endcap_normal.webp"),
      roughnessMap: loadTex(base + "vx27_endcap_roughness.webp"),
      metalnessMap: loadTex(base + "vx27_endcap_metallic.webp"),
      emissiveMap: loadTex(base + "vx27_endcap_emissive.webp", true),
      aoMap: loadTex(base + "vx27_endcap_ao.webp"),
      emissive: 0xffffff,
      emissiveIntensity: 1.5,
      metalness: 1,
      roughness: 1,
      transparent: true,
      opacity: 1,
    });

    _orbMats = [bodyMat, capMat, capMat];
  }
  return _orbMats;
}

/** Update the body texture repeat on all body map channels. */
export function setOrbBodyRepeat(repeatU, repeatV) {
  const mats = getOrbMaterials();
  const body = mats[0];
  for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"]) {
    const tex = body[key];
    if (tex) tex.repeat.set(repeatU, repeatV);
  }
}

/**
 * Spawn a VX-27 Power Core at the given position with a random bounce.
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} position - enemy death position
 * @param {number} floorY
 * @returns {object} orb state object
 */
export function spawnHpOrb(scene, position, floorY, gameCore = null) {
  const mesh = new THREE.Mesh(getOrbGeometry(), getOrbMaterials());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.rotation.z = Math.PI / 2;
  mesh.scale.setScalar(1.0);

  const spawnY = Math.max(position.y, floorY + 0.5);
  mesh.position.set(position.x, spawnY, position.z);
  scene.add(mesh);

  const launch = requireWasmMethod(gameCore, "planRewardDropLaunch")({
    angleRoll: Math.random(),
    speedRoll: Math.random(),
    velYRoll: Math.random(),
    minSpeed: 1.5,
    speedSpan: 1.5,
    minVelY: 3.0,
    velYSpan: 2.0,
  });
  const baseScale = 1.0;

  return {
    mesh,
    velX: launch.velX,
    velY: launch.velY,
    velZ: launch.velZ,
    floorY,
    time: 0,
    settled: false,
    settledTime: 0,
    collected: false,
    value: HP_ORB_VALUE,
    baseScale,
  };
}

/** Create a large display-only canister for inspection. */
export function createDisplayCanister(scene, x, y, z, scale = 5) {
  const mesh = new THREE.Mesh(getOrbGeometry(), getOrbMaterials());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.rotation.z = Math.PI / 2;
  mesh.scale.setScalar(scale);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

/**
 * Tick all HP orbs — physics, bobbing, collection, fade, cleanup.
 * @param {object[]} orbs - array of orb state objects (mutated in place)
 * @param {number} dt
 * @param {THREE.Vector3} playerPos - camera/player world position
 * @param {(value: number) => void} onCollect - called when player picks up an orb
 * @param {object[]} [colliders]
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} [bounds]
 */
export function updateHpOrbs(orbs, dt, playerPos, onCollect, colliders, bounds, floorHoles = [], gameCore = null) {
  for (let i = orbs.length - 1; i >= 0; i--) {
    const orb = orbs[i];
    orb.time += dt;

    const hole = updateEntityForFloorHole(
      orb,
      orb.mesh.position.x,
      orb.mesh.position.z,
      orb.mesh.position.y,
      orb.floorY,
      dt,
      floorHoles,
      HP_ORB_RADIUS,
      gameCore,
    );
    orb.mesh.position.y = hole.y;
    if (hole.remove) {
      orb.mesh.parent?.remove(orb.mesh);
      orbs.splice(i, 1);
      continue;
    }
    if (hole.falling) {
      orb.mesh.rotation.y += HP_ORB_SPIN_SPEED * dt;
      continue;
    }

    if (!orb.settled) {
      orb.velY -= HP_ORB_GRAVITY * dt;
      orb.mesh.position.x += orb.velX * dt;
      orb.mesh.position.y += orb.velY * dt;
      orb.mesh.position.z += orb.velZ * dt;

      if (orb.mesh.position.y <= orb.floorY + HP_ORB_SETTLE_Y) {
        orb.mesh.position.y = orb.floorY + HP_ORB_SETTLE_Y;
        if (Math.abs(orb.velY) < 0.3) {
          orb.velY = 0;
          orb.velX = 0;
          orb.velZ = 0;
          orb.settled = true;
          orb.settledTime = orb.time;
          orb.settleBlend = 0;
        } else {
          orb.velY *= -HP_ORB_BOUNCE_RESTITUTION;
          orb.velX *= 0.7;
          orb.velZ *= 0.7;
        }
      }

      orb.velX *= Math.max(0, 1 - HP_ORB_GROUND_FRICTION * dt);
      orb.velZ *= Math.max(0, 1 - HP_ORB_GROUND_FRICTION * dt);

      if (colliders) {
        const footY = orb.mesh.position.y - HP_ORB_RADIUS;
        const bodyTop = orb.mesh.position.y + HP_ORB_RADIUS;
        const pushed = pushOutOfWalls(
          orb.mesh.position.x,
          orb.mesh.position.z,
          HP_ORB_RADIUS,
          colliders,
          footY,
          bodyTop,
          gameCore,
        );
        if (pushed.x !== orb.mesh.position.x) { orb.velX *= -0.4; orb.mesh.position.x = pushed.x; }
        if (pushed.z !== orb.mesh.position.z) { orb.velZ *= -0.4; orb.mesh.position.z = pushed.z; }
      }
      if (bounds) {
        const clamped = clampToBounds(
          orb.mesh.position.x, orb.mesh.position.z, HP_ORB_RADIUS, bounds, gameCore,
        );
        orb.mesh.position.x = clamped.x;
        orb.mesh.position.z = clamped.z;
      }
    } else {
      orb.settleBlend = Math.min(1, (orb.settleBlend ?? 0) + dt * 1.8);
      const ease = orb.settleBlend * orb.settleBlend * (3 - 2 * orb.settleBlend);
      const hoverY = orb.floorY + HP_ORB_SETTLE_Y + 0.15;
      const groundY = orb.floorY + HP_ORB_SETTLE_Y;
      const baseY = groundY + (hoverY - groundY) * ease;
      const bob = Math.sin((orb.time - orb.settledTime) * HP_ORB_BOB_SPEED) * HP_ORB_BOB_HEIGHT * ease;
      orb.mesh.position.y = baseY + bob;
    }

    orb.mesh.rotation.y += HP_ORB_SPIN_SPEED * dt;

    if (!orb.collected) {
      const collect = requireWasmMethod(gameCore, "resolvePickupCollect")({
        itemX: orb.mesh.position.x,
        itemZ: orb.mesh.position.z,
        playerX: playerPos.x,
        playerZ: playerPos.z,
        collectRadius: HP_ORB_COLLECT_RADIUS,
      });
      if (collect.collected) {
        orb.collected = true;
        orb.collectTime = orb.time;
        onCollect(orb.value);
      }
    }

    let removeOrb = false;
    if (orb.collected) {
      if (!orb.ownMats) {
        orb.ownMats = true;
        orb.mesh.material = getOrbMaterials().map((m) => m.clone());
      }
      const fade = requireWasmMethod(gameCore, "resolveCollectFade")({
        time: orb.time,
        collectTime: orb.collectTime,
        duration: 0.25,
      });
      const scale = fade.scale;
      orb.mesh.scale.setScalar((orb.baseScale || 1) * scale);
      for (const m of orb.mesh.material) m.opacity = scale;
      orb.mesh.position.y += dt * 3;
      if (fade.remove) removeOrb = true;
    } else {
      const vis = getRewardExpireVisuals(orb.time, HP_ORB_LIFETIME);
      if (vis.flashing) {
        ensureRewardOwnMaterials(orb, getOrbMaterials);
        applyRewardExpireVisual(orb.mesh, vis, orb);
      } else {
        orb.mesh.visible = true;
      }
      if (vis.remove) removeOrb = true;
    }

    if (removeOrb) {
      orb.mesh.parent?.remove(orb.mesh);
      if (orb.ownMats) for (const m of orb.mesh.material) m.dispose();
      orbs.splice(i, 1);
    }
  }
}

export function disposeAllHpOrbs(orbs) {
  for (const orb of orbs) {
    orb.mesh.parent?.remove(orb.mesh);
    if (orb.ownMats) for (const m of orb.mesh.material) m.dispose();
  }
  orbs.length = 0;
}
