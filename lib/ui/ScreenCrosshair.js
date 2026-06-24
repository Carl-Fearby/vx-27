import * as THREE from "three";
import { setCrosshairLayer } from "../lighting/LightingLayers.js";
import { GUN_CROSSHAIR_URL } from "../weapons/CrosshairTuning.js";

export const HACK_CROSSHAIR_URL = "/ui/hack/hack-crosshair.png";
export const PURCHASE_CROSSHAIR_URL = "/ui/purchase-crosshair.png";

/**
 * Along camera forward (−Z local), behind the raised viewmodel.
 * Rifle ADS is closest (~−0.15); hip carry is further (~−1.3).
 */
const CROSSHAIR_VIEW_Z = -1.05;

const _cameraPos = new THREE.Vector3();
const _cameraQuat = new THREE.Quaternion();

/**
 * @param {number} pixels
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} canvasPixelHeight
 */
function pixelsToWorldSize(pixels, camera, canvasPixelHeight) {
  const dist = Math.abs(CROSSHAIR_VIEW_Z);
  const vFovRad = (camera.fov * Math.PI) / 180;
  const viewHeight = 2 * Math.tan(vFovRad * 0.5) * dist;
  return (pixels / Math.max(canvasPixelHeight, 1)) * viewHeight;
}

/** Screen-space line thickness for the hip cross (px). */
const STANDARD_CROSS_LINE_PX = 2;
/** Special interact reticules — hack + wall shop purchase. */
const SPECIAL_CROSSHAIR_SIZE_PX = 156;
const HACK_LABEL_GAP_PX = -8;
const HACK_LABEL_WIDTH_PX = 300;
const HACK_LABEL_CANVAS_W = 1024;
const HACK_LABEL_CANVAS_H = 220;
const HACK_LABEL_FONT = '700 84px Orbitron, "Rajdhani", sans-serif';

const PURCHASE_LABEL_GAP_PX = -8;
const PURCHASE_LABEL_WIDTH_PX = 300;
const PURCHASE_LABEL_CANVAS_W = 1024;
const PURCHASE_LABEL_CANVAS_H = 220;
const PURCHASE_LABEL_FONT = '700 84px Orbitron, "Rajdhani", sans-serif';
/** ~0.2s to full opacity at 60fps. */
const SPECIAL_CROSSHAIR_FADE_SPEED = 14;

/**
 * @param {number} current
 * @param {number} target
 * @param {number} dt
 */
function approachFade(current, target, dt) {
  if (dt <= 0) return target;
  const t = 1 - Math.exp(-SPECIAL_CROSSHAIR_FADE_SPEED * dt);
  return current + (target - current) * t;
}

/** @param {CanvasRenderingContext2D} ctx */
function paintHackLabel(ctx) {
  ctx.clearRect(0, 0, HACK_LABEL_CANVAS_W, HACK_LABEL_CANVAS_H);
  ctx.font = HACK_LABEL_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#c8f4ff";
  ctx.shadowColor = "rgba(92, 200, 255, 0.55)";
  ctx.shadowBlur = 18;
  ctx.fillText("HACK", HACK_LABEL_CANVAS_W / 2, HACK_LABEL_CANVAS_H / 2);
  ctx.shadowBlur = 0;
}

/** @param {CanvasRenderingContext2D} ctx */
function paintPurchaseLabel(ctx) {
  ctx.clearRect(0, 0, PURCHASE_LABEL_CANVAS_W, PURCHASE_LABEL_CANVAS_H);
  ctx.font = PURCHASE_LABEL_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#c8f4ff";
  ctx.shadowColor = "rgba(92, 200, 255, 0.55)";
  ctx.shadowBlur = 18;
  ctx.fillText(
    "PURCHASE",
    PURCHASE_LABEL_CANVAS_W / 2,
    PURCHASE_LABEL_CANVAS_H / 2,
  );
  ctx.shadowBlur = 0;
}

/**
 * @param {THREE.Texture} tex
 * @param {THREE.Mesh} mesh
 * @param {number} sizePx
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} canvasHeight
 */
function layoutSpecialCrosshairIcon(tex, mesh, sizePx, camera, canvasHeight) {
  const img = tex.image;
  const aspect =
    img?.width > 0 && img?.height > 0 ? img.width / img.height : 1;
  const worldW = pixelsToWorldSize(sizePx, camera, canvasHeight);
  const worldH = worldW / aspect;
  mesh.scale.set(worldW, worldH, 1);
  mesh.position.y = 0;
}

/**
 * Hip standard cross + ADS gun reticule — both in {@link renderCrosshairPass}
 * before the viewmodel so the weapon paints over them.
 * @param {THREE.Scene} scene
 */
export function createScreenCrosshair(scene) {
  const standardMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const standardBarGeo = new THREE.PlaneGeometry(1, 1);
  const standardVertical = new THREE.Mesh(standardBarGeo, standardMaterial);
  standardVertical.name = "screen_crosshair_standard_v";
  standardVertical.frustumCulled = false;
  standardVertical.position.z = CROSSHAIR_VIEW_Z;
  setCrosshairLayer(standardVertical);

  const standardHorizontal = new THREE.Mesh(standardBarGeo, standardMaterial);
  standardHorizontal.name = "screen_crosshair_standard_h";
  standardHorizontal.frustumCulled = false;
  standardHorizontal.position.z = CROSSHAIR_VIEW_Z;
  setCrosshairLayer(standardHorizontal);

  const standardCross = new THREE.Group();
  standardCross.name = "screen_crosshair_standard";
  standardCross.add(standardVertical);
  standardCross.add(standardHorizontal);
  standardCross.visible = false;

  let reticuleTex = null;
  let reticuleMaterial = null;
  let reticuleMesh = null;
  function ensureReticuleMesh() {
    if (reticuleMesh) return reticuleMesh;

    reticuleTex = new THREE.TextureLoader().load(GUN_CROSSHAIR_URL);
    reticuleTex.colorSpace = THREE.SRGBColorSpace;
    reticuleTex.minFilter = THREE.LinearFilter;
    reticuleTex.magFilter = THREE.LinearFilter;
    reticuleTex.generateMipmaps = false;

    reticuleMaterial = new THREE.MeshBasicMaterial({
      map: reticuleTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    reticuleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      reticuleMaterial,
    );
    reticuleMesh.name = "screen_crosshair_reticule";
    reticuleMesh.frustumCulled = false;
    reticuleMesh.position.z = CROSSHAIR_VIEW_Z;
    reticuleMesh.visible = false;
    setCrosshairLayer(reticuleMesh);
    rig.add(reticuleMesh);
    return reticuleMesh;
  }

  const hackTex = new THREE.TextureLoader().load(HACK_CROSSHAIR_URL);
  hackTex.colorSpace = THREE.SRGBColorSpace;
  hackTex.minFilter = THREE.LinearFilter;
  hackTex.magFilter = THREE.LinearFilter;
  hackTex.generateMipmaps = false;

  const hackMaterial = new THREE.MeshBasicMaterial({
    map: hackTex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const hackMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    hackMaterial,
  );
  hackMesh.name = "screen_crosshair_hack";
  hackMesh.frustumCulled = false;
  hackMesh.position.z = CROSSHAIR_VIEW_Z;
  setCrosshairLayer(hackMesh);

  const hackLabelCanvas = document.createElement("canvas");
  hackLabelCanvas.width = HACK_LABEL_CANVAS_W;
  hackLabelCanvas.height = HACK_LABEL_CANVAS_H;
  const hackLabelCtx = hackLabelCanvas.getContext("2d");
  if (hackLabelCtx) paintHackLabel(hackLabelCtx);
  const hackLabelTex = new THREE.CanvasTexture(hackLabelCanvas);
  hackLabelTex.colorSpace = THREE.SRGBColorSpace;
  hackLabelTex.minFilter = THREE.LinearFilter;
  hackLabelTex.magFilter = THREE.LinearFilter;
  hackLabelTex.generateMipmaps = false;

  const hackLabelMaterial = new THREE.MeshBasicMaterial({
    map: hackLabelTex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const hackLabelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    hackLabelMaterial,
  );
  hackLabelMesh.name = "screen_crosshair_hack_label";
  hackLabelMesh.frustumCulled = false;
  hackLabelMesh.position.z = CROSSHAIR_VIEW_Z;
  setCrosshairLayer(hackLabelMesh);

  const hackGroup = new THREE.Group();
  hackGroup.name = "screen_crosshair_hack_group";
  hackGroup.visible = false;
  hackGroup.add(hackMesh);
  hackGroup.add(hackLabelMesh);

  const purchaseTex = new THREE.TextureLoader().load(PURCHASE_CROSSHAIR_URL);
  purchaseTex.colorSpace = THREE.SRGBColorSpace;
  purchaseTex.minFilter = THREE.LinearFilter;
  purchaseTex.magFilter = THREE.LinearFilter;
  purchaseTex.generateMipmaps = false;

  const purchaseMaterial = new THREE.MeshBasicMaterial({
    map: purchaseTex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const purchaseMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    purchaseMaterial,
  );
  purchaseMesh.name = "screen_crosshair_purchase";
  purchaseMesh.frustumCulled = false;
  purchaseMesh.position.z = CROSSHAIR_VIEW_Z;
  setCrosshairLayer(purchaseMesh);

  const purchaseLabelCanvas = document.createElement("canvas");
  purchaseLabelCanvas.width = PURCHASE_LABEL_CANVAS_W;
  purchaseLabelCanvas.height = PURCHASE_LABEL_CANVAS_H;
  const purchaseLabelCtx = purchaseLabelCanvas.getContext("2d");
  if (purchaseLabelCtx) paintPurchaseLabel(purchaseLabelCtx);
  const purchaseLabelTex = new THREE.CanvasTexture(purchaseLabelCanvas);
  purchaseLabelTex.colorSpace = THREE.SRGBColorSpace;
  purchaseLabelTex.minFilter = THREE.LinearFilter;
  purchaseLabelTex.magFilter = THREE.LinearFilter;
  purchaseLabelTex.generateMipmaps = false;

  const purchaseLabelMaterial = new THREE.MeshBasicMaterial({
    map: purchaseLabelTex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const purchaseLabelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    purchaseLabelMaterial,
  );
  purchaseLabelMesh.name = "screen_crosshair_purchase_label";
  purchaseLabelMesh.frustumCulled = false;
  purchaseLabelMesh.position.z = CROSSHAIR_VIEW_Z;
  setCrosshairLayer(purchaseLabelMesh);

  const purchaseGroup = new THREE.Group();
  purchaseGroup.name = "screen_crosshair_purchase_group";
  purchaseGroup.visible = false;
  purchaseGroup.add(purchaseMesh);
  purchaseGroup.add(purchaseLabelMesh);

  let hackLabelFontReady = false;
  let purchaseLabelFontReady = false;
  let hackFade = 0;
  let purchaseFade = 0;
  if (typeof document !== "undefined" && document.fonts?.load) {
    void document.fonts
      .load("700 84px Orbitron")
      .then(() => {
        hackLabelFontReady = true;
        purchaseLabelFontReady = true;
        if (hackLabelCtx) {
          paintHackLabel(hackLabelCtx);
          hackLabelTex.needsUpdate = true;
        }
        if (purchaseLabelCtx) {
          paintPurchaseLabel(purchaseLabelCtx);
          purchaseLabelTex.needsUpdate = true;
        }
      })
      .catch(() => {});
  }

  const rig = new THREE.Group();
  rig.name = "screen_crosshair_rig";
  rig.add(standardCross);
  rig.add(hackGroup);
  rig.add(purchaseGroup);
  scene.add(rig);

  /**
   * @param {{
   *   aimBlend: number,
   *   tuning: import("../weapons/CrosshairTuning.js").CrosshairTuning,
   *   showGunReticule?: boolean,
   *   reticuleMotion?: { offsetX?: number, offsetY?: number } | null,
   *   standardCrosshairOnly?: boolean,
   *   standardCrossFadeWithAim?: boolean,
   *   doorTarget?: boolean,
   *   hackTarget?: boolean,
   *   purchaseTarget?: boolean,
   *   dt?: number,
   *   camera: THREE.PerspectiveCamera,
   *   canvasHeight: number,
   * }} opts
   */
  function update(opts) {
    opts.camera.updateMatrixWorld(true);
    opts.camera.getWorldPosition(_cameraPos);
    opts.camera.getWorldQuaternion(_cameraQuat);
    rig.position.copy(_cameraPos);
    rig.quaternion.copy(_cameraQuat);

    const dt = Math.max(0, opts.dt ?? 0);
    const hackWants = Boolean(opts.hackTarget);
    const purchaseWants = Boolean(opts.purchaseTarget) && !hackWants;

    hackFade = approachFade(hackFade, hackWants ? 1 : 0, dt);
    purchaseFade = approachFade(purchaseFade, purchaseWants ? 1 : 0, dt);

    const hackShowing = hackFade > 0.01;
    const purchaseShowing = purchaseFade > 0.01;
    const specialCover = Math.max(hackFade, purchaseFade);

    if (hackWants) {
      if (!hackLabelFontReady && hackLabelCtx && document.fonts?.check) {
        if (document.fonts.check("700 84px Orbitron")) {
          hackLabelFontReady = true;
          paintHackLabel(hackLabelCtx);
          hackLabelTex.needsUpdate = true;
        }
      }

      layoutSpecialCrosshairIcon(
        hackTex,
        hackMesh,
        SPECIAL_CROSSHAIR_SIZE_PX,
        opts.camera,
        opts.canvasHeight,
      );

      const labelGap = pixelsToWorldSize(
        HACK_LABEL_GAP_PX,
        opts.camera,
        opts.canvasHeight,
      );
      const labelWorldW = pixelsToWorldSize(
        HACK_LABEL_WIDTH_PX,
        opts.camera,
        opts.canvasHeight,
      );
      const labelWorldH =
        labelWorldW / (HACK_LABEL_CANVAS_W / HACK_LABEL_CANVAS_H);
      hackLabelMesh.scale.set(labelWorldW, labelWorldH, 1);
      hackLabelMesh.position.y =
        hackMesh.scale.y / 2 + labelGap + labelWorldH / 2;
    }

    hackGroup.visible = hackShowing;
    if (hackShowing) {
      hackMaterial.opacity = hackFade;
      hackLabelMaterial.opacity = hackFade;
      hackMaterial.color.set(0xffffff);
      hackLabelMaterial.color.set(0xffffff);
    }

    if (purchaseWants) {
      if (!purchaseLabelFontReady && purchaseLabelCtx && document.fonts?.check) {
        if (document.fonts.check("700 84px Orbitron")) {
          purchaseLabelFontReady = true;
          paintPurchaseLabel(purchaseLabelCtx);
          purchaseLabelTex.needsUpdate = true;
        }
      }

      layoutSpecialCrosshairIcon(
        purchaseTex,
        purchaseMesh,
        SPECIAL_CROSSHAIR_SIZE_PX,
        opts.camera,
        opts.canvasHeight,
      );

      const labelGap = pixelsToWorldSize(
        PURCHASE_LABEL_GAP_PX,
        opts.camera,
        opts.canvasHeight,
      );
      const labelWorldW = pixelsToWorldSize(
        PURCHASE_LABEL_WIDTH_PX,
        opts.camera,
        opts.canvasHeight,
      );
      const labelWorldH =
        labelWorldW / (PURCHASE_LABEL_CANVAS_W / PURCHASE_LABEL_CANVAS_H);
      purchaseLabelMesh.scale.set(labelWorldW, labelWorldH, 1);
      purchaseLabelMesh.position.y =
        purchaseMesh.scale.y / 2 + labelGap + labelWorldH / 2;
    }

    purchaseGroup.visible = purchaseShowing;
    if (purchaseShowing) {
      purchaseMaterial.opacity = purchaseFade;
      purchaseLabelMaterial.opacity = purchaseFade;
      purchaseMaterial.color.set(0xffffff);
      purchaseLabelMaterial.color.set(0xffffff);
    }

    const t = THREE.MathUtils.clamp(opts.aimBlend, 0, 1);
    const aimReticleReady = THREE.MathUtils.clamp((t - 0.42) / 0.18, 0, 1);
    const reticuleReadiness = opts.standardCrossFadeWithAim
      ? aimReticleReady
      : THREE.MathUtils.clamp(
          opts.reticuleBlend ?? aimReticleReady,
          0,
          1,
        );
    const standardOnly = Boolean(opts.standardCrosshairOnly);
    const doorTarget = Boolean(opts.doorTarget);
    const baseOpacity = doorTarget ? 1 : 0.85;
    const highlight = doorTarget ? 0xb8f0ff : 0xffffff;

    const standardFade =
      (standardOnly ? 1 : 1 - reticuleReadiness) * (1 - specialCover);
    standardCross.visible = standardFade > 0.01;
    if (standardCross.visible) {
      const armW = pixelsToWorldSize(
        opts.tuning.standardWidth,
        opts.camera,
        opts.canvasHeight,
      );
      const armH = pixelsToWorldSize(
        opts.tuning.standardHeight,
        opts.camera,
        opts.canvasHeight,
      );
      const lineW = pixelsToWorldSize(
        STANDARD_CROSS_LINE_PX,
        opts.camera,
        opts.canvasHeight,
      );
      standardVertical.scale.set(lineW, armH, 1);
      standardHorizontal.scale.set(armW, lineW, 1);
      standardMaterial.opacity = baseOpacity * standardFade;
      standardMaterial.color.set(highlight);
    }

    if (opts.showGunReticule === false) {
      if (reticuleMesh) reticuleMesh.visible = false;
      return;
    }

    const reticuleFade = reticuleReadiness * (1 - specialCover);
    const activeReticuleMesh = ensureReticuleMesh();
    reticuleMesh.visible = reticuleFade > 0.01;
    if (!activeReticuleMesh.visible) return;

    const gunWidth = THREE.MathUtils.lerp(
      opts.tuning.gunHipWidth ?? opts.tuning.gunWidth,
      opts.tuning.gunAimWidth ?? opts.tuning.gunWidth,
      t,
    );
    const gunHeight = THREE.MathUtils.lerp(
      opts.tuning.gunHipHeight ?? opts.tuning.gunHeight,
      opts.tuning.gunAimHeight ?? opts.tuning.gunHeight,
      t,
    );
    const gunOffsetX = THREE.MathUtils.lerp(
      opts.tuning.gunHipOffsetX ?? opts.tuning.gunOffsetX ?? 0,
      opts.tuning.gunAimOffsetX ?? opts.tuning.gunOffsetX ?? 0,
      t,
    );
    const gunOffsetY = THREE.MathUtils.lerp(
      opts.tuning.gunHipOffsetY ?? opts.tuning.gunOffsetY ?? 0,
      opts.tuning.gunAimOffsetY ?? opts.tuning.gunOffsetY ?? 0,
      t,
    );
    const worldW = pixelsToWorldSize(gunWidth, opts.camera, opts.canvasHeight);
    const worldH = pixelsToWorldSize(gunHeight, opts.camera, opts.canvasHeight);
    const motionX = opts.reticuleMotion?.offsetX ?? 0;
    const motionY = opts.reticuleMotion?.offsetY ?? 0;
    const motionScale = 1 - t * 0.65;
    const offsetX = pixelsToWorldSize(
      gunOffsetX + motionX * motionScale,
      opts.camera,
      opts.canvasHeight,
    );
    const offsetY = pixelsToWorldSize(
      gunOffsetY + motionY * motionScale,
      opts.camera,
      opts.canvasHeight,
    );
    activeReticuleMesh.scale.set(worldW, worldH, 1);
    activeReticuleMesh.position.set(offsetX, offsetY, CROSSHAIR_VIEW_Z);
    reticuleMaterial.opacity = baseOpacity * reticuleFade;
    reticuleMaterial.color.set(highlight);
  }

  function dispose() {
    scene.remove(rig);
    standardMaterial.dispose();
    standardBarGeo.dispose();
    reticuleTex?.dispose();
    reticuleMaterial?.dispose();
    reticuleMesh?.geometry.dispose();
    hackTex.dispose();
    hackMaterial.dispose();
    hackMesh.geometry.dispose();
    hackLabelTex.dispose();
    hackLabelMaterial.dispose();
    hackLabelMesh.geometry.dispose();
    purchaseTex.dispose();
    purchaseMaterial.dispose();
    purchaseMesh.geometry.dispose();
    purchaseLabelTex.dispose();
    purchaseLabelMaterial.dispose();
    purchaseLabelMesh.geometry.dispose();
  }

  return { rig, mesh: reticuleMesh, update, dispose };
}
