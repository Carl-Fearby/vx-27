import * as THREE from "three";
import {
  ALL_RENDER_LAYERS_MASK,
  ROOM_INTERIOR_LAYER,
  WORLD_LAYER,
  pinLightToLayers,
} from "../lighting/LightingLayers.js";
import {
  createVx27ContainerPreviewMesh,
  disposeVx27ContainerPreviewMesh,
  prepareVx27ContainerCreditsPreview,
  preloadVx27ContainerCreditsAssets,
} from "../vx27-container/Vx27Container.js";
import { createCreditsPreviewLoop } from "./useCreditsLazy3d.js";
import {
  centerObject,
  fitObjectUniform,
  frameCameraOnObject,
} from "./creditsPreviewFrame.js";

const VARIANTS = {
  default: {
    size: 280,
    fov: 36,
    rotY: 0.0035,
    padding: 1.34,
    targetSize: 0.82,
    yaw: 0.58,
    pitch: 0.11,
    lookAtX: 0.055,
  },
  hero: {
    size: 280,
    fov: 36,
    rotY: 0.0035,
    padding: 1.34,
    targetSize: 0.82,
    yaw: 0.58,
    pitch: 0.11,
    lookAtX: 0.055,
  },
  flank: {
    size: 168,
    fov: 36,
    rotY: 0.003,
    padding: 1.38,
    targetSize: 0.78,
    yaw: 0.55,
    pitch: 0.1,
    lookAtX: 0.05,
  },
  opener: {
    size: 340,
    fov: 34,
    rotY: 0.0035,
    padding: 1.28,
    targetSize: 0.88,
    yaw: 0.58,
    pitch: 0.12,
    screenOffsetX: -0.24,
  },
};

function pinPreviewLight(light) {
  pinLightToLayers(light, WORLD_LAYER, ROOM_INTERIOR_LAYER);
}

/**
 * Renders the in-game VX-27 cargo module on a canvas for credits screens.
 * @returns {Promise<{ dispose: () => void, setActive: (run: boolean) => void }>}
 */
export async function mountCreditsVx27ContainerPreview(
  canvas,
  { variant = "default", getPriority } = {},
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
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(px, px, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(cfg.fov, 1, 0.01, 48);
  camera.layers.mask = ALL_RENDER_LAYERS_MASK;

  const ambient = new THREE.AmbientLight(0xa8c8ff, 0.55);
  pinPreviewLight(ambient);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xb8d8ff, 0x1a2030, 0.72);
  pinPreviewLight(hemi);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xd0e8ff, 1.55);
  key.position.set(2.4, 3.1, 3.4);
  pinPreviewLight(key);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x5eaaff, 1.05);
  rim.position.set(-2.8, 0.5, -2.1);
  pinPreviewLight(rim);
  scene.add(rim);

  const fill = new THREE.PointLight(0x4060b0, 0.55, 12);
  fill.position.set(0, -0.2, 1.8);
  pinPreviewLight(fill);
  scene.add(fill);

  const spinRoot = new THREE.Group();
  const tiltRoot = new THREE.Group();
  const container = createVx27ContainerPreviewMesh();
  prepareVx27ContainerCreditsPreview(container);
  fitObjectUniform(container, cfg.targetSize);
  tiltRoot.add(container);
  // Level1 doors open on the right leaves — slight pitch, spin on world Y only.
  tiltRoot.rotation.set(0.06, 0, 0);
  spinRoot.add(tiltRoot);
  centerObject(spinRoot);
  spinRoot.updateMatrixWorld(true);
  scene.add(spinRoot);

  frameCameraOnObject(camera, spinRoot, {
    padding: cfg.padding,
    aspect: 1,
    yaw: cfg.yaw,
    pitch: cfg.pitch,
    lookAtX: cfg.lookAtX ?? 0,
    screenOffsetX: cfg.screenOffsetX ?? 0,
  });

  let disposed = false;
  const loop = createCreditsPreviewLoop(() => {
    if (disposed) return;
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
      disposeVx27ContainerPreviewMesh(container);
      renderer.dispose();
    },
  };
}
