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
/** Nudge HP / rounds / stamina stack down on the gun screen texture. */
const CONTENT_Y_OFFSET_PX = 20;
const HP_Y_FRAC = 0.24;
/** HP → rounds → stamina bar. */
const HP_TO_ROUNDS = 1.12;
const HP_TO_ROUNDS_EXTRA = 0.38;
const ROUNDS_TO_STAMINA_BAR = 0.44;

const BAR_BLUE = {
  top: "rgb(30, 160, 255)",
  mid: "rgb(70, 200, 255)",
  bottom: "rgb(30, 160, 255)",
};
const BAR_ORANGE = {
  top: "rgb(255, 140, 20)",
  mid: "rgb(255, 180, 60)",
  bottom: "rgb(255, 140, 20)",
};
const BAR_RED = {
  top: "rgb(230, 35, 20)",
  mid: "rgb(255, 75, 50)",
  bottom: "rgb(230, 35, 20)",
};
const BAR_GREEN = {
  top: "rgb(80, 255, 60)",
  mid: "rgb(120, 255, 80)",
  bottom: "rgb(80, 255, 60)",
};

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

/** Room for HP, rounds, stamina bar + label at the tuned font size. */
function canvasDimensionsForFontSize(sizePx) {
  const fs = Math.max(12, Math.round(sizePx));
  return {
    width: Math.max(256, Math.ceil(fs * 3.2)),
    height: Math.max(180, Math.ceil(fs * 2.55)),
  };
}

function statFontSize(roundsFontSize) {
  return Math.max(10, Math.round(roundsFontSize * 0.5));
}

/** @typedef {{ core: string, glow: string, halo: string }} GlowPalette */

/** Match `.hudHealthFill` layers — blue base, orange ≤50, red ≤25, green >100. */
const HP_BLUE = {
  core: "#46c8ff",
  glow: "rgba(70, 200, 255, 0.45)",
  halo: "rgba(30, 160, 255, 0.85)",
};
const HP_ORANGE = {
  core: "#ffb347",
  glow: "rgba(255, 179, 71, 0.45)",
  halo: "rgba(255, 140, 20, 0.85)",
};
const HP_RED = {
  core: "#ff4444",
  glow: "rgba(255, 68, 68, 0.45)",
  halo: "rgba(230, 35, 20, 0.9)",
};
const HP_RADIO = {
  core: "#7dffa8",
  glow: "rgba(125, 255, 168, 0.45)",
  halo: "rgba(80, 220, 120, 0.85)",
};
const HP_DEAD = {
  core: "#888888",
  glow: "rgba(120, 120, 120, 0.35)",
  halo: "rgba(80, 80, 80, 0.6)",
};

/** @returns {GlowPalette} */
function hpGlowPalette(hp) {
  const safeHp = Number.isFinite(hp) ? hp : 100;
  if (safeHp <= 0) return HP_DEAD;
  if (safeHp > 100) return HP_RADIO;
  if (safeHp <= 25) return HP_RED;
  if (safeHp <= 50) return HP_ORANGE;
  return HP_BLUE;
}

function staminaBarMetrics(stamina, hp) {
  const safeStamina = Number.isFinite(stamina) ? Math.max(0, stamina) : 1;
  const safeHp = Number.isFinite(hp) ? Math.max(0, hp) : 100;
  const radioactive = safeHp > 100;
  const hpCap = radioactive ? safeHp : 100;
  const displayVal = Math.round(safeStamina * 100);
  const pctOfHpCap = hpCap > 0 ? Math.min(1, displayVal / hpCap) : 0;
  let greenOp = 0;
  if (displayVal > 100 && hpCap > 100) {
    greenOp = Math.min(
      1,
      (Math.min(displayVal, hpCap) - 100) / (hpCap - 100),
    );
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
  return { displayVal, pctOfHpCap, orangeOp, redOp, greenOp };
}

function chamferedRectPath(ctx, x, y, w, h, corner) {
  const c = Math.min(corner, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function drawVerticalGradientBar(ctx, x, y, w, h, colors) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, colors.top);
  grad.addColorStop(0.45, colors.mid);
  grad.addColorStop(1, colors.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
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
  let lastHp = -1;
  let lastCount = -1;
  let lastStaminaPct = -1;
  let lastLow = false;
  let lastDrawnHp = 100;
  let lastDrawnCount = 0;
  let lastDrawnStamina = 1;
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
    lastHp = -1;
    lastCount = -1;
    lastStaminaPct = -1;
    draw(lastDrawnHp, lastDrawnCount, lastDrawnStamina, lastDrawnLow);
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

  /**
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {number} sizePx
   * @param {GlowPalette | "low" | "normal"} palette
   */
  function drawGlowTextAt(text, x, y, sizePx, palette) {
    applyHudRoundsTextStyle(ctx, sizePx);

    if (palette === "low") {
      ctx.shadowColor = LOW_HALO;
      ctx.shadowBlur = 16;
      ctx.fillStyle = "rgba(230, 50, 30, 0.45)";
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 8;
      ctx.fillStyle = LOW_CORE;
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
      return;
    }

    const colors =
      palette === "normal"
        ? { core: NORMAL_CORE, glow: NORMAL_GLOW, halo: NORMAL_HALO }
        : palette;

    ctx.shadowColor = colors.halo;
    ctx.shadowBlur = 22;
    ctx.fillStyle = colors.glow;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 12;
    ctx.fillStyle = colors.glow;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.core;
    ctx.fillText(text, x, y);
  }

  function staminaBarHeight() {
    return Math.max(4, Math.round(fontSize * 0.14));
  }

  function drawStaminaBar(cx, barTopY, stamina, hp) {
    const barW = Math.round(fontSize * 2.15);
    const barH = staminaBarHeight();
    const corner = Math.max(1, Math.round(barH * 0.35));
    const x = cx - barW / 2;
    const y = barTopY;
    const { pctOfHpCap, orangeOp, redOp, greenOp } =
      staminaBarMetrics(stamina, hp);
    const fillW = Math.max(corner * 2, Math.round(barW * pctOfHpCap));

    ctx.save();

    chamferedRectPath(ctx, x, y, barW, barH, corner);
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 220, 255, 0.55)";
    ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.04));
    ctx.stroke();

    if (fillW > 0) {
      ctx.save();
      chamferedRectPath(ctx, x, y, fillW, barH, corner);
      ctx.clip();
      drawVerticalGradientBar(ctx, x, y, fillW, barH, BAR_BLUE);
      if (orangeOp > 0) {
        ctx.globalAlpha = orangeOp;
        drawVerticalGradientBar(ctx, x, y, fillW, barH, BAR_ORANGE);
      }
      if (redOp > 0) {
        ctx.globalAlpha = redOp;
        drawVerticalGradientBar(ctx, x, y, fillW, barH, BAR_RED);
      }
      if (greenOp > 0) {
        ctx.globalAlpha = greenOp;
        drawVerticalGradientBar(ctx, x, y, fillW, barH, BAR_GREEN);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function draw(hp, count, stamina, low) {
    if (!ctx) return;
    const staminaPct = Math.round(
      Math.max(0, Number.isFinite(stamina) ? stamina : 1) * 100,
    );
    if (
      hp === lastHp &&
      count === lastCount &&
      staminaPct === lastStaminaPct &&
      low === lastLow
    ) {
      return;
    }
    lastHp = hp;
    lastCount = count;
    lastStaminaPct = staminaPct;
    lastLow = low;
    lastDrawnHp = hp;
    lastDrawnCount = count;
    lastDrawnStamina = stamina;
    lastDrawnLow = low;

    ctx.clearRect(0, 0, logicalCanvasW, logicalCanvasH);
    const cx = logicalCanvasW / 2;
    const statFs = statFontSize(fontSize);
    const hpText = `${Math.max(0, Math.round(hp))} HP`;
    const roundsText = String(Math.max(0, Math.floor(count))).padStart(2, "0");

    const yOff = CONTENT_Y_OFFSET_PX;
    const hpY = logicalCanvasH * HP_Y_FRAC + yOff;
    drawGlowTextAt(hpText, cx, hpY, statFs, hpGlowPalette(hp));

    const roundsY =
      hpY + statFs * HP_TO_ROUNDS + fontSize * HP_TO_ROUNDS_EXTRA;
    drawGlowTextAt(
      roundsText,
      cx,
      roundsY,
      fontSize,
      low ? "low" : "normal",
    );

    const barTopY = roundsY + fontSize * ROUNDS_TO_STAMINA_BAR;
    drawStaminaBar(cx, barTopY, stamina, hp);
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
  draw(100, 88, 1, false);

  return {
    mesh,
    getSuggestedPose: () => ({ ...DEFAULT_HIP_ROUND_DISPLAY }),
    setCount(count, low = false, hp = 100, stamina = 1) {
      draw(hp, count, stamina, low);
    },
    syncToModelSurface,
    dispose,
  };
}
