import * as THREE from "three";
import { createEnemyRigPreview, preloadEnemyRig } from "../combat/EnemyRig.js";
import { createCreditsPreviewLoop } from "./useCreditsLazy3d.js";

const VARIANTS = {
  flank: { size: 148, fov: 36, rotY: 0.0028, padding: 1.48, targetHeight: 1.75 },
  hero: { size: 300, fov: 32, rotY: 0.0036, padding: 1.55, targetHeight: 1.85 },
  strip: { size: 340, fov: 30, rotY: 0.0032, padding: 1.58, targetHeight: 1.85 },
  marketing: { size: 340, fov: 34, rotY: 0.0032, padding: 1.58, targetHeight: 1.85 },
};

/** Frame using known character height — Meshy armature breaks setFromObject bbox. */
function frameEnemyPreviewCamera(
  camera,
  targetHeight,
  { padding = 1.55, aspect = 1, yaw = 0.48, pitch = 0.08 } = {},
) {
  const lookY = targetHeight * 0.44;
  const radius = targetHeight * 0.48;
  const vFovRad = THREE.MathUtils.degToRad(camera.fov);
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
  const distance =
    Math.max(radius / Math.sin(vFovRad / 2), radius / Math.sin(hFovRad / 2)) *
    padding;

  const dir = new THREE.Vector3(
    Math.sin(yaw) * 0.35,
    pitch,
    Math.cos(yaw),
  ).normalize();
  camera.position.copy(dir.multiplyScalar(distance));
  camera.position.y += lookY;
  camera.lookAt(0, lookY, 0);
  camera.near = Math.max(0.01, distance * 0.02);
  camera.far = Math.max(camera.near + 2, distance + radius * 8 + 4);
  camera.updateProjectionMatrix();
}

function addPreviewLights(scene) {
  scene.add(new THREE.AmbientLight(0xa8c8ff, 0.42));
  const key = new THREE.DirectionalLight(0xd0e8ff, 1.28);
  key.position.set(2.4, 3.6, 3.4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5eaaff, 0.85);
  rim.position.set(-2.8, 1.1, -2.2);
  scene.add(rim);
  const fill = new THREE.PointLight(0x4060b0, 0.34, 12);
  fill.position.set(0.1, 0.5, 2.2);
  scene.add(fill);
}

/** Preload decode for credits. */
export async function getCreditsEnemyPrototype() {
  await preloadEnemyRig();
  return true;
}

/**
 * Animated PX-27 android rig for credits / marketing previews.
 * @returns {Promise<{ dispose: () => void, setActive: (run: boolean) => void }>}
 */
export async function mountCreditsEnemyPreview(
  canvas,
  { variant = "hero", getPriority } = {},
) {
  if (!canvas) {
    return { dispose: () => {}, setActive: () => {} };
  }

  const cfg = VARIANTS[variant] ?? VARIANTS.hero;
  const preview = await createEnemyRigPreview({ targetHeight: cfg.targetHeight });
  if (!preview) {
    return { dispose: () => {}, setActive: () => {} };
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.round(cfg.size * dpr);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(px, px, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(cfg.fov, 1, 0.01, 48);
  addPreviewLights(scene);

  const spinRoot = new THREE.Group();
  const tiltRoot = new THREE.Group();
  tiltRoot.add(preview.holder);
  tiltRoot.rotation.set(0.04, -0.28, 0);
  spinRoot.add(tiltRoot);
  scene.add(spinRoot);

  frameEnemyPreviewCamera(camera, preview.targetHeight, {
    padding: cfg.padding,
    aspect: 1,
  });

  let disposed = false;
  const clock = new THREE.Clock();
  const loop = createCreditsPreviewLoop(() => {
    if (disposed) return;
    preview.update(clock.getDelta());
    spinRoot.rotation.y += cfg.rotY;
    spinRoot.updateMatrixWorld(true);
    renderer.render(scene, camera);
  }, getPriority);

  return {
    setActive: (run) => loop.setActive(run),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      loop.stop();
      scene.remove(spinRoot);
      preview.dispose();
      renderer.dispose();
    },
  };
}

/** @deprecated Use mountCreditsEnemyPreview */
export async function mountMarketingEnemyPreview(canvas, opts = {}) {
  return mountCreditsEnemyPreview(canvas, { ...opts, variant: "marketing" });
}

/** @deprecated */
export function disposePreviewMaterials() {}

/** @deprecated */
export async function createEnemyPreviewRig(_characterScene, targetHeight) {
  const preview = await createEnemyRigPreview({ targetHeight });
  return preview?.holder ?? null;
}
