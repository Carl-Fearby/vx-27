import * as THREE from "three";
import { setViewmodelLayer } from "../lighting/LightingLayers.js";
import { DEFAULT_HIP_ROUND_DISPLAY } from "./WeaponRoundDisplayTuning.js";

const VIEWMODEL_RENDER_ORDER = 10050;

/** Match HUD ammo digits — rgb(94, 170, 255). */
const NORMAL_CORE = "#5eaaff";
const NORMAL_GLOW = "rgba(94, 170, 255, 0.55)";
const NORMAL_HALO = "rgba(58, 140, 255, 0.85)";
const LOW_CORE = "#e6321e";
const LOW_HALO = "rgba(230, 50, 30, 0.9)";

/** Matches `.hudAmmoValue` — Orbitron 700 + 0.08em letter-spacing. */
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

/** Room for two digits + glow at the tuned font size. */
function canvasDimensionsForFontSize(sizePx) {
  const fs = Math.max(12, Math.round(sizePx));
  return {
    width: Math.max(256, Math.ceil(fs * 3.2)),
    height: Math.max(128, Math.ceil(fs * 1.25)),
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

/**
 * Round counter welded to a receiver point on the rifle mesh.
 * Parented under `sway` but transform is recomposed from the model each frame
 * so bob, sway, ADS pose scale, and recoil all stay aligned with the surface.
 *
 * @param {THREE.Group} sway Weapon sway group (between holder and pivot).
 */
export function createWeaponRoundDisplay(sway) {
  const canvas = document.createElement("canvas");
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
  mesh.name = "weapon_round_display";
  mesh.renderOrder = VIEWMODEL_RENDER_ORDER;
  mesh.frustumCulled = false;
  sway.add(mesh);
  setViewmodelLayer(mesh);

  let fontSize = DEFAULT_HIP_ROUND_DISPLAY.fontSize;
  let logicalCanvasW = 256;
  let logicalCanvasH = 128;
  let fontLoadGen = 0;
  let lastCount = -1;
  let lastLow = false;
  let lastDrawnCount = 0;
  let lastDrawnLow = false;

  function canvasDpr() {
    if (typeof window === "undefined") return 1;
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  function resizeCanvasForFontSize(sizePx) {
    const { width, height } = canvasDimensionsForFontSize(sizePx);
    const dpr = canvasDpr();
    const physicalW = Math.round(width * dpr);
    const physicalH = Math.round(height * dpr);
    logicalCanvasW = width;
    logicalCanvasH = height;
    if (canvas.width === physicalW && canvas.height === physicalH) return false;
    canvas.width = physicalW;
    canvas.height = physicalH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function redrawNow() {
    lastCount = -1;
    draw(lastDrawnCount, lastDrawnLow);
  }

  function primeHudFont(sizePx) {
    const spec = hudRoundsFontSpec(sizePx);
    if (typeof document === "undefined" || !document.fonts?.load) {
      redrawNow();
      return;
    }
    const gen = ++fontLoadGen;
    document.fonts.load(spec).then(() => {
      if (gen !== fontLoadGen || fontSize !== sizePx) return;
      redrawNow();
    });
  }

  function drawGlowText(text, low) {
    const cx = logicalCanvasW / 2;
    const cy = logicalCanvasH / 2;
    applyHudRoundsTextStyle(ctx, fontSize);

    if (low) {
      ctx.shadowColor = LOW_HALO;
      ctx.shadowBlur = 16;
      ctx.fillStyle = "rgba(230, 50, 30, 0.45)";
      ctx.fillText(text, cx, cy);
      ctx.shadowBlur = 8;
      ctx.fillStyle = LOW_CORE;
      ctx.fillText(text, cx, cy);
      ctx.shadowBlur = 0;
      return;
    }

    ctx.shadowColor = NORMAL_HALO;
    ctx.shadowBlur = 22;
    ctx.fillStyle = NORMAL_GLOW;
    ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(148, 200, 255, 0.75)";
    ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 0;
    ctx.fillStyle = NORMAL_CORE;
    ctx.fillText(text, cx, cy);
  }

  function draw(count, low) {
    if (!ctx) return;
    if (count === lastCount && low === lastLow) return;
    lastCount = count;
    lastLow = low;
    lastDrawnCount = count;
    lastDrawnLow = low;

    ctx.clearRect(0, 0, logicalCanvasW, logicalCanvasH);
    const text = String(Math.max(0, Math.floor(count))).padStart(2, "0");
    drawGlowText(text, low);
    texture.needsUpdate = true;
  }

  function applyVisualTuning(tuning) {
    const w = tuning.planeWidth * tuning.scale;
    const h = tuning.planeHeight * tuning.scale;
    mesh.scale.set(w, h, 1);

    const nextFontSize = Math.round(tuning.fontSize);
    if (fontSize !== nextFontSize) {
      fontSize = nextFontSize;
      resizeCanvasForFontSize(fontSize);
      primeHudFont(fontSize);
      redrawNow();
    }
  }

  /**
   * @param {import("./WeaponRoundDisplayTuning.js").WeaponRoundDisplayPose} tuning
   * @param {THREE.Object3D} model
   * @param {THREE.Object3D} swayGroup
   */
  function syncToModelSurface(tuning, model, swayGroup) {
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
    mesh.visible = true;

    applyVisualTuning(tuning);
  }

  function dispose() {
    texture.dispose();
    material.dispose();
    mesh.geometry.dispose();
    sway.remove(mesh);
  }

  resizeCanvasForFontSize(fontSize);
  primeHudFont(fontSize);
  applyVisualTuning(DEFAULT_HIP_ROUND_DISPLAY);
  draw(88, false);

  return {
    mesh,
    getSuggestedPose: () => ({ ...DEFAULT_HIP_ROUND_DISPLAY }),
    setCount(count, low = false) {
      draw(count, low);
    },
    syncToModelSurface,
    dispose,
  };
}
