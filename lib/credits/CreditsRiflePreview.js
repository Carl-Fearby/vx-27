import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createCreditsPreviewLoop } from "./useCreditsLazy3d.js";
import {
  fitObjectUniform,
  frameCameraOnObject,
} from "./creditsPreviewFrame.js";
import { RIFLE_MODEL_URL } from "../weapons/ViewWeapon.js";

const VARIANTS = {
  flank: { size: 148, fov: 36, rotY: 0.0028, padding: 1.32 },
  hero: { size: 300, fov: 32, rotY: 0.0042, padding: 1.28 },
  strip: { size: 340, fov: 30, rotY: 0.0036, padding: 1.28 },
};

const TARGET_WEAPON_SIZE = 0.52;
let riflePrototypePromise = null;

function prepareCreditsMaterials(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const geo = obj.geometry;
    if (geo && (!geo.attributes.normal || geo.attributes.normal.count === 0)) {
      geo.computeVertexNormals();
    }
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.side = THREE.FrontSide;
      mat.depthTest = true;
      mat.depthWrite = true;
      mat.transparent = false;
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    }
  });
}

function disposeObject3D(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const { material } = obj;
    if (!material) return;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
  });
}

async function getRiflePrototype() {
  if (!riflePrototypePromise) {
    riflePrototypePromise = new GLTFLoader()
      .loadAsync(RIFLE_MODEL_URL)
      .then((gltf) => {
        const model = gltf.scene;
        prepareCreditsMaterials(model);
        fitObjectUniform(model, TARGET_WEAPON_SIZE);
        model.rotation.set(0, Math.PI * 0.12, 0);
        model.updateMatrixWorld(true);
        return model;
      });
  }
  return riflePrototypePromise;
}

export { getRiflePrototype as getCreditsRiflePrototype };

/**
 * Renders the in-game rifle GLB on a canvas for credits screens.
 * @returns {Promise<{ dispose: () => void, setActive: (run: boolean) => void }>}
 */
export async function mountCreditsRiflePreview(canvas, { variant = "hero", getPriority } = {}) {
  if (!canvas) {
    return { dispose: () => {}, setActive: () => {} };
  }

  const cfg = VARIANTS[variant] ?? VARIANTS.hero;
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

  const prototype = await getRiflePrototype();
  const model = prototype.clone(true);
  scene.add(model);

  frameCameraOnObject(camera, model, { padding: cfg.padding, aspect: 1 });

  const loop = createCreditsPreviewLoop(() => {
    model.rotation.y += cfg.rotY;
    renderer.render(scene, camera);
  }, getPriority);

  return {
    setActive: (run) => loop.setActive(run),
    dispose: () => {
      loop.stop();
      disposeObject3D(model);
      renderer.dispose();
    },
  };
}
