import * as THREE from "three";
import {
  buildControlPanelPreviewMesh,
  disposeControlPanelPreviewMesh,
  preloadControlPanelPreviewAssets,
} from "../control-panel/ControlPanel.js";
import { createCreditsPreviewLoop } from "./useCreditsLazy3d.js";
import {
  centerObject,
  fitObjectUniform,
  frameCameraOnObject,
} from "./creditsPreviewFrame.js";

const VARIANTS = {
  default: { size: 300, fov: 36, rotY: 0.0035, padding: 1.42, targetSize: 0.74 },
  hero: { size: 320, fov: 34, rotY: 0.003, padding: 1.38, targetSize: 0.78 },
  marketing: { size: 340, fov: 34, rotY: 0.0032, padding: 1.36, targetSize: 0.8 },
};

/**
 * Renders the in-game control panel on a canvas for credits / marketing.
 * @returns {Promise<{ dispose: () => void, setActive: (run: boolean) => void }>}
 */
export async function mountCreditsControlPanelPreview(
  canvas,
  { variant = "default", getPriority } = {},
) {
  if (!canvas) {
    return { dispose: () => {}, setActive: () => {} };
  }

  const cfg = VARIANTS[variant] ?? VARIANTS.default;
  await preloadControlPanelPreviewAssets();

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.round(cfg.size * dpr);

  canvas.width = px;
  canvas.height = px;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(px, px, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(cfg.fov, 1, 0.01, 48);
  scene.add(new THREE.AmbientLight(0xa8c8ff, 0.44));
  const key = new THREE.DirectionalLight(0xd0e8ff, 1.35);
  key.position.set(2.2, 3.4, 3.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5eaaff, 0.9);
  rim.position.set(-2.6, 0.8, -2.4);
  scene.add(rim);
  const fill = new THREE.PointLight(0x4060b0, 0.38, 12);
  fill.position.set(0.2, 0.4, 2.1);
  scene.add(fill);

  const spinRoot = new THREE.Group();
  const tiltRoot = new THREE.Group();
  const panel = buildControlPanelPreviewMesh();
  fitObjectUniform(panel, cfg.targetSize);
  tiltRoot.add(panel);
  tiltRoot.rotation.set(0.06, -0.42, 0.01);
  spinRoot.add(tiltRoot);
  centerObject(spinRoot);
  spinRoot.updateMatrixWorld(true);
  scene.add(spinRoot);

  frameCameraOnObject(camera, spinRoot, {
    padding: cfg.padding,
    aspect: 1,
    yaw: 0.52,
    pitch: 0.1,
  });

  const loop = createCreditsPreviewLoop(() => {
    spinRoot.rotation.y += cfg.rotY;
    renderer.render(scene, camera);
  }, getPriority);

  return {
    setActive: (run) => loop.setActive(run),
    dispose: () => {
      loop.stop();
      scene.remove(spinRoot);
      disposeControlPanelPreviewMesh(panel);
      renderer.dispose();
    },
  };
}
