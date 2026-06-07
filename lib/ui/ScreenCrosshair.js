import * as THREE from "three";
import { setCrosshairLayer } from "../lighting/LightingLayers.js";
import { GUN_CROSSHAIR_URL } from "../weapons/CrosshairTuning.js";

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

  const reticuleTex = new THREE.TextureLoader().load(GUN_CROSSHAIR_URL);
  reticuleTex.colorSpace = THREE.SRGBColorSpace;
  reticuleTex.minFilter = THREE.LinearFilter;
  reticuleTex.magFilter = THREE.LinearFilter;
  reticuleTex.generateMipmaps = false;

  const reticuleMaterial = new THREE.MeshBasicMaterial({
    map: reticuleTex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const reticuleMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    reticuleMaterial,
  );
  reticuleMesh.name = "screen_crosshair_reticule";
  reticuleMesh.frustumCulled = false;
  reticuleMesh.position.z = CROSSHAIR_VIEW_Z;
  reticuleMesh.visible = false;
  setCrosshairLayer(reticuleMesh);

  const rig = new THREE.Group();
  rig.name = "screen_crosshair_rig";
  rig.add(standardCross);
  rig.add(reticuleMesh);
  scene.add(rig);

  /**
   * @param {{
   *   aimBlend: number,
   *   tuning: import("../weapons/CrosshairTuning.js").CrosshairTuning,
   *   showGunReticule?: boolean,
   *   standardCrosshairOnly?: boolean,
   *   doorTarget?: boolean,
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

    const t = THREE.MathUtils.clamp(opts.aimBlend, 0, 1);
    const standardOnly = Boolean(opts.standardCrosshairOnly);
    const doorTarget = Boolean(opts.doorTarget);
    const baseOpacity = doorTarget ? 1 : 0.85;
    const highlight = doorTarget ? 0xb8f0ff : 0xffffff;

    const standardFade = standardOnly
      ? 1
      : THREE.MathUtils.clamp(1 - t / 0.48, 0, 1);
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
      reticuleMesh.visible = false;
      return;
    }

    const reticuleFade = THREE.MathUtils.clamp((t - 0.42) / 0.18, 0, 1);
    reticuleMesh.visible = reticuleFade > 0.01;
    if (!reticuleMesh.visible) return;

    const worldW = pixelsToWorldSize(
      opts.tuning.gunWidth,
      opts.camera,
      opts.canvasHeight,
    );
    const worldH = pixelsToWorldSize(
      opts.tuning.gunHeight,
      opts.camera,
      opts.canvasHeight,
    );
    reticuleMesh.scale.set(worldW, worldH, 1);
    reticuleMaterial.opacity = baseOpacity * reticuleFade;
    reticuleMaterial.color.set(highlight);
  }

  function dispose() {
    scene.remove(rig);
    standardMaterial.dispose();
    standardBarGeo.dispose();
    reticuleTex.dispose();
    reticuleMaterial.dispose();
    reticuleMesh.geometry.dispose();
  }

  return { rig, mesh: reticuleMesh, update, dispose };
}
