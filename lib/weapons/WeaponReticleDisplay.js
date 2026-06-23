import * as THREE from "three";
import { setViewmodelLayer } from "../lighting/LightingLayers.js";
import {
  DEFAULT_CROSSHAIR_TUNING,
  GUN_CROSSHAIR_URL,
  normalizeCrosshairTuning,
  RETICLE_BASE_PLANE,
  reticlePlaneSizeFromTuning,
} from "./CrosshairTuning.js";
import {
  DEFAULT_AIM_ROUND_DISPLAY,
  DEFAULT_HIP_ROUND_DISPLAY,
} from "./WeaponRoundDisplayTuning.js";

const VIEWMODEL_RENDER_ORDER = 10055;
const RETICLE_ROUNDS_RENDER_ORDER = VIEWMODEL_RENDER_ORDER + 2;

/** Match HUD ammo digits — rgb(94, 170, 255). */
const NORMAL_CORE = "#5eaaff";
const NORMAL_GLOW = "rgba(94, 170, 255, 0.55)";
const NORMAL_HALO = "rgba(58, 140, 255, 0.85)";
const LOW_CORE = "#e6321e";
const LOW_HALO = "rgba(230, 50, 30, 0.9)";

const RETICLE_ROUNDS_CANVAS_W = 128;
const RETICLE_ROUNDS_CANVAS_H = 64;
const RETICLE_ROUNDS_FONT_PX = 28;
const RETICLE_ROUNDS_PLANE_W = 0.028;
const RETICLE_ROUNDS_PLANE_H = 0.014;

/** Wizard offset px → model metres (same scale on X/Y/Z). */
const RETICLE_OFFSET_MODEL_PER_PX = 0.001;

function hudRoundsFontSpec(sizePx) {
  return `700 ${sizePx}px Orbitron, "Eurostile", "Rajdhani", sans-serif`;
}

function applyHudRoundsTextStyle(ctx, sizePx) {
  ctx.font = hudRoundsFontSpec(sizePx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if ("letterSpacing" in ctx) {
    ctx.letterSpacing = `${sizePx * 0.08}px`;
  }
}

function drawReticleRoundCount(ctx, count, low) {
  ctx.clearRect(0, 0, RETICLE_ROUNDS_CANVAS_W, RETICLE_ROUNDS_CANVAS_H);
  const text = String(Math.max(0, Math.floor(count))).padStart(2, "0");
  const cx = RETICLE_ROUNDS_CANVAS_W / 2;
  const cy = RETICLE_ROUNDS_CANVAS_H / 2;
  applyHudRoundsTextStyle(ctx, RETICLE_ROUNDS_FONT_PX);

  if (low) {
    ctx.shadowColor = LOW_HALO;
    ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(230, 50, 30, 0.45)";
    ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 6;
    ctx.fillStyle = LOW_CORE;
    ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 0;
    return;
  }

  ctx.shadowColor = NORMAL_HALO;
  ctx.shadowBlur = 14;
  ctx.fillStyle = NORMAL_GLOW;
  ctx.fillText(text, cx, cy);
  ctx.shadowBlur = 0;
  ctx.fillStyle = NORMAL_CORE;
  ctx.fillText(text, cx, cy);
}

function createReticleRoundOverlay(parentMesh) {
  const canvas = document.createElement("canvas");
  canvas.width = RETICLE_ROUNDS_CANVAS_W;
  canvas.height = RETICLE_ROUNDS_CANVAS_H;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.name = "weapon_reticle_rounds";
  mesh.renderOrder = RETICLE_ROUNDS_RENDER_ORDER;
  mesh.frustumCulled = false;
  mesh.position.z = 0.003;
  mesh.scale.set(RETICLE_ROUNDS_PLANE_W, RETICLE_ROUNDS_PLANE_H, 1);
  mesh.visible = false;
  parentMesh.add(mesh);
  setViewmodelLayer(mesh);

  let lastCount = -1;
  let lastLow = false;
  let fontLoadGen = 0;

  function primeFont() {
    if (typeof document === "undefined" || !document.fonts?.load) return;
    const gen = ++fontLoadGen;
    document.fonts.load(hudRoundsFontSpec(RETICLE_ROUNDS_FONT_PX)).then(() => {
      if (gen !== fontLoadGen) return;
      drawReticleRoundCount(ctx, lastCount >= 0 ? lastCount : 0, lastLow);
      texture.needsUpdate = true;
    });
  }

  function redraw(count, low) {
    if (!ctx) return;
    if (count === lastCount && low === lastLow) return;
    lastCount = count;
    lastLow = low;
    drawReticleRoundCount(ctx, count, low);
    texture.needsUpdate = true;
  }

  primeFont();
  redraw(0, false);

  return {
    mesh,
    material,
    redraw,
    dispose() {
      texture.dispose();
      material.dispose();
      mesh.geometry.dispose();
      parentMesh.remove(mesh);
    },
  };
}

const _anchorPos = new THREE.Vector3();
const _anchorQuat = new THREE.Quaternion();
const _anchorMat = new THREE.Matrix4();
const _surfaceWorld = new THREE.Matrix4();
const _swayInv = new THREE.Matrix4();
const _euler = new THREE.Euler(0, 0, 0, "YXZ");
const _decompPos = new THREE.Vector3();
const _decompQuat = new THREE.Quaternion();
const _decompScale = new THREE.Vector3();
const _unitScale = new THREE.Vector3(1, 1, 1);

function createBorder() {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.5, -0.5, 0.002),
    new THREE.Vector3(0.5, -0.5, 0.002),
    new THREE.Vector3(0.5, -0.5, 0.002),
    new THREE.Vector3(0.5, 0.5, 0.002),
    new THREE.Vector3(0.5, 0.5, 0.002),
    new THREE.Vector3(-0.5, 0.5, 0.002),
    new THREE.Vector3(-0.5, 0.5, 0.002),
    new THREE.Vector3(-0.5, -0.5, 0.002),
  ]);
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const border = new THREE.LineSegments(geometry, material);
  border.name = "weapon_reticle_tuning_border";
  border.renderOrder = VIEWMODEL_RENDER_ORDER + 1;
  border.frustumCulled = false;
  border.visible = false;
  setViewmodelLayer(border);
  return border;
}

function isAdsTuningMode(mode) {
  return mode === "ads" || mode === "aim";
}

function resolveReticlePose(hip, aim, blend) {
  const t = THREE.MathUtils.clamp(blend, 0, 1);
  if (t <= 0) return hip;
  if (t >= 1) return aim;
  return t >= 0.5 ? aim : hip;
}

function poseFromCrosshairTuning(tuning, mode) {
  const prefix = mode === "aim" ? "gunAim" : "gunHip";
  const base =
    mode === "aim" ? DEFAULT_AIM_ROUND_DISPLAY : DEFAULT_HIP_ROUND_DISPLAY;
  const { planeWidth, planeHeight } = reticlePlaneSizeFromTuning(
    tuning,
    mode === "aim" ? "aim" : "hip",
  );
  const scale = RETICLE_OFFSET_MODEL_PER_PX;

  return {
    posX: base.posX + (tuning[`${prefix}OffsetX`] ?? 0) * scale,
    posY: base.posY + (tuning[`${prefix}OffsetY`] ?? 0) * scale,
    posZ: base.posZ + (tuning[`${prefix}OffsetZ`] ?? 0) * scale,
    rotX:
      base.rotX + THREE.MathUtils.degToRad(tuning[`${prefix}RotX`] ?? 0),
    rotY:
      base.rotY + THREE.MathUtils.degToRad(tuning[`${prefix}RotY`] ?? 0),
    rotZ:
      base.rotZ + THREE.MathUtils.degToRad(tuning[`${prefix}RotZ`] ?? 0),
    planeWidth,
    planeHeight,
    opacity: RETICLE_BASE_PLANE.opacity,
  };
}

/**
 * Reticle plane welded to the rifle model, using the same model→sway
 * recomposition as the ammo readout so it inherits weapon pose, ADS blend,
 * bob, sway, recoil, and raise/holster motion.
 *
 * @param {THREE.Group} sway
 */
export function createWeaponReticleDisplay(sway) {
  const texture = new THREE.TextureLoader().load(GUN_CROSSHAIR_URL);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: RETICLE_BASE_PLANE.opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.name = "weapon_reticle_display";
  mesh.renderOrder = VIEWMODEL_RENDER_ORDER;
  mesh.frustumCulled = false;
  sway.add(mesh);
  setViewmodelLayer(mesh);
  const border = createBorder();
  mesh.add(border);
  const roundOverlay = createReticleRoundOverlay(mesh);
  let lastAimBlend = 0;

  function syncToModelSurface(
    model,
    swayGroup,
    crosshairTuning,
    aimBlend = 0,
    tuningActive = false,
    tuningMode = "hip",
  ) {
    const normalized = normalizeCrosshairTuning(
      crosshairTuning ?? DEFAULT_CROSSHAIR_TUNING,
    );
    const previewBlend = tuningActive
      ? isAdsTuningMode(tuningMode)
        ? 1
        : 0
      : aimBlend;
    lastAimBlend = previewBlend;
    const tuning = resolveReticlePose(
      poseFromCrosshairTuning(normalized, "hip"),
      poseFromCrosshairTuning(normalized, "aim"),
      previewBlend,
    );
    _anchorPos.set(tuning.posX, tuning.posY, tuning.posZ);
    _euler.set(tuning.rotX, tuning.rotY, tuning.rotZ);
    _anchorQuat.setFromEuler(_euler);
    _anchorMat.compose(_anchorPos, _anchorQuat, _unitScale);

    model.updateMatrixWorld(true);
    _surfaceWorld.multiplyMatrices(model.matrixWorld, _anchorMat);

    swayGroup.updateMatrixWorld(true);
    _swayInv.copy(swayGroup.matrixWorld).invert();
    _surfaceWorld.premultiply(_swayInv);

    _surfaceWorld.decompose(_decompPos, _decompQuat, _decompScale);
    mesh.position.copy(_decompPos);
    mesh.quaternion.copy(_decompQuat);
    mesh.scale.set(tuning.planeWidth, tuning.planeHeight, 1);
    material.opacity = tuning.opacity;
    border.visible = Boolean(tuningActive);
    mesh.visible = true;

    const roundsReady = previewBlend >= 0.5 ? 1 : 0;
    roundOverlay.mesh.visible = roundsReady > 0;
    roundOverlay.material.opacity = roundsReady;
  }

  function setRoundCount(count, low = false) {
    roundOverlay.redraw(count, low);
    const roundsReady = lastAimBlend >= 0.5 ? 1 : 0;
    roundOverlay.mesh.visible = roundsReady > 0;
    roundOverlay.material.opacity = roundsReady;
  }

  function dispose() {
    texture.dispose();
    material.dispose();
    border.geometry.dispose();
    border.material.dispose();
    mesh.geometry.dispose();
    roundOverlay.dispose();
    sway.remove(mesh);
  }

  return {
    mesh,
    syncToModelSurface,
    setRoundCount,
    dispose,
  };
}
