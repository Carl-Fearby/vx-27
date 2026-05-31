import * as THREE from "three";
import {
  createCratePreviewMesh,
  disposeCratePreviewMesh,
  preloadAmmoCrateAssets,
} from "@/lib/AmmoCrate";
import { createCreditsPreviewLoop } from "@/lib/useCreditsLazy3d";
import {
  fitObjectUniform,
  frameCameraOnObject,
} from "@/lib/creditsPreviewFrame";

const VARIANTS = {
  default: { size: 220, fov: 36, rotY: 0.006, padding: 1.3, targetSize: 0.72 },
  cluster: { size: 180, fov: 36, rotY: 0.005, padding: 1.32, targetSize: 0.62 },
};

/**
 * Renders the in-game ammo crate on a canvas for credits screens.
 * @returns {Promise<{ dispose: () => void, setActive: (run: boolean) => void }>}
 */
export async function mountCreditsAmmoCratePreview(canvas, { variant = "default", getPriority } = {}) {
  if (!canvas) {
    return { dispose: () => {}, setActive: () => {} };
  }

  const cfg = VARIANTS[variant] ?? VARIANTS.default;
  await preloadAmmoCrateAssets();

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
  scene.add(new THREE.AmbientLight(0xa8c8ff, 0.5));
  const key = new THREE.DirectionalLight(0xd0e8ff, 1.35);
  key.position.set(2.2, 2.8, 3.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5eaaff, 0.9);
  rim.position.set(-2.5, 0.4, -1.8);
  scene.add(rim);
  const fill = new THREE.PointLight(0x4060b0, 0.45, 10);
  fill.position.set(0, -0.35, 1.6);
  scene.add(fill);

  const crate = createCratePreviewMesh();
  fitObjectUniform(crate, cfg.targetSize);
  crate.rotation.set(0.1, -0.52, 0.06);
  crate.updateMatrixWorld(true);
  scene.add(crate);

  frameCameraOnObject(camera, crate, { padding: cfg.padding, aspect: 1, yaw: 0.42, pitch: 0.14 });

  const loop = createCreditsPreviewLoop(() => {
    crate.rotation.y += cfg.rotY;
    renderer.render(scene, camera);
  }, getPriority);

  return {
    setActive: (run) => loop.setActive(run),
    dispose: () => {
      loop.stop();
      scene.remove(crate);
      disposeCratePreviewMesh(crate);
      renderer.dispose();
    },
  };
}
