import * as THREE from "three";
import {
  createVx27ContainerPreviewMesh,
  disposeVx27ContainerPreviewMesh,
  preloadVx27ContainerCreditsAssets,
} from "../vx27-container/Vx27Container.js";
import { createCreditsPreviewLoop } from "./useCreditsLazy3d.js";
import {
  fitObjectUniform,
  frameCameraOnObject,
} from "./creditsPreviewFrame.js";

const VARIANTS = {
  default: { size: 280, fov: 38, rotY: 0.004, padding: 1.38, targetSize: 0.78 },
  hero: { size: 280, fov: 38, rotY: 0.004, padding: 1.38, targetSize: 0.78 },
  flank: { size: 168, fov: 38, rotY: 0.003, padding: 1.42, targetSize: 0.74 },
};

/**
 * Renders the in-game VX-27 cargo module on a canvas for credits screens.
 * @returns {Promise<{ dispose: () => void, setActive: (run: boolean) => void }>}
 */
export async function mountCreditsVx27ContainerPreview(
  canvas,
  { variant = "default", getPriority } = {}
) {
  if (!canvas) {
    return { dispose: () => {}, setActive: () => {} };
  }

  const cfg = VARIANTS[variant] ?? VARIANTS.default;
  await preloadVx27ContainerCreditsAssets();

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
  scene.add(new THREE.AmbientLight(0xa8c8ff, 0.48));
  const key = new THREE.DirectionalLight(0xd0e8ff, 1.4);
  key.position.set(2.4, 3.1, 3.4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5eaaff, 0.85);
  rim.position.set(-2.8, 0.5, -2.1);
  scene.add(rim);
  const fill = new THREE.PointLight(0x4060b0, 0.42, 12);
  fill.position.set(0, -0.2, 1.8);
  scene.add(fill);

  const container = createVx27ContainerPreviewMesh();
  fitObjectUniform(container, cfg.targetSize);
  container.rotation.set(0.04, -0.48, 0.02);
  container.updateMatrixWorld(true);
  scene.add(container);

  frameCameraOnObject(camera, container, {
    padding: cfg.padding,
    aspect: 1,
    yaw: 0.38,
    pitch: 0.12,
  });

  const loop = createCreditsPreviewLoop(() => {
    container.rotation.y += cfg.rotY;
    renderer.render(scene, camera);
  }, getPriority);

  return {
    setActive: (run) => loop.setActive(run),
    dispose: () => {
      loop.stop();
      scene.remove(container);
      disposeVx27ContainerPreviewMesh(container);
      renderer.dispose();
    },
  };
}
