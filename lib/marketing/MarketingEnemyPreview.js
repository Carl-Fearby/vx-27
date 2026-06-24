import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createCreditsPreviewLoop } from "@/lib/credits/useCreditsLazy3d.js";
import {
  centerObject,
  fitObjectUniform,
  frameCameraOnObject,
} from "@/lib/credits/creditsPreviewFrame.js";

const CHARACTER_URL = "/models/enemies/px27-android-character.glb";
const WALK_URL = "/models/enemies/px27-android-walk.glb";

const PREVIEW_CFG = {
  size: 340,
  fov: 34,
  rotY: 0.0032,
  padding: 1.42,
  targetSize: 1.72,
};

function findSkinnedMesh(root) {
  let found = null;
  root.traverse((object) => {
    if (!found && object.isSkinnedMesh) found = object;
  });
  return found;
}

function pickWalkClip(animations) {
  return (
    animations.find((clip) => /walk/i.test(clip.name)) ??
    animations[0] ??
    null
  );
}

/** Strip horizontal hips motion so walk cycles in place. */
function makeInPlaceWalkClip(source) {
  const tracks = source.tracks.map((track) => {
    const cloned = track.clone();
    const bone = track.name.split(".")[0] ?? "";
    if (
      /hips/i.test(bone) &&
      cloned.name.endsWith(".position") &&
      cloned.values.length >= 3
    ) {
      const baseX = cloned.values[0];
      const baseZ = cloned.values[2];
      for (let i = 0; i < cloned.values.length; i += 3) {
        cloned.values[i] = baseX;
        cloned.values[i + 2] = baseZ;
      }
    }
    return cloned;
  });
  return new THREE.AnimationClip(
    source.name || "enemy-walk",
    source.duration,
    tracks,
  );
}

function configurePreviewMesh(mesh) {
  if (!mesh?.isMesh) return;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  for (const mat of materials) {
    if (!mat) continue;
    mat.side = THREE.FrontSide;
    mat.depthTest = true;
    mat.depthWrite = true;
    if (mat.emissive?.isColor) mat.emissive.setRGB(0, 0, 0);
  }
}

/**
 * Rotating PX-27 android rig for the marketing site.
 * @returns {Promise<{ dispose: () => void, setActive: (run: boolean) => void }>}
 */
export async function mountMarketingEnemyPreview(canvas, { getPriority } = {}) {
  if (!canvas) {
    return { dispose: () => {}, setActive: () => {} };
  }

  const cfg = PREVIEW_CFG;
  const loader = new GLTFLoader();
  const [characterGltf, walkGltf] = await Promise.all([
    loader.loadAsync(CHARACTER_URL),
    loader.loadAsync(WALK_URL),
  ]);

  const walkSource = pickWalkClip(walkGltf.animations);
  if (!walkSource) throw new Error("PX-27 walk GLB has no animation");

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

  const spinRoot = new THREE.Group();
  const tiltRoot = new THREE.Group();
  const rig = cloneSkeleton(characterGltf.scene);
  rig.traverse(configurePreviewMesh);
  fitObjectUniform(rig, cfg.targetSize);
  tiltRoot.add(rig);
  tiltRoot.rotation.set(0.04, -0.28, 0);
  spinRoot.add(tiltRoot);
  centerObject(spinRoot);
  spinRoot.updateMatrixWorld(true);
  scene.add(spinRoot);

  frameCameraOnObject(camera, spinRoot, {
    padding: cfg.padding,
    aspect: 1,
    yaw: 0.48,
    pitch: 0.08,
  });

  const mixer = new THREE.AnimationMixer(rig);
  const walkClip = makeInPlaceWalkClip(walkSource.clone());
  const action = mixer.clipAction(walkClip);
  action.play();

  const clock = new THREE.Clock();
  const loop = createCreditsPreviewLoop(() => {
    mixer.update(clock.getDelta());
    spinRoot.rotation.y += cfg.rotY;
    renderer.render(scene, camera);
  }, getPriority);

  return {
    setActive: (run) => loop.setActive(run),
    dispose: () => {
      loop.stop();
      mixer.stopAllAction();
      scene.remove(spinRoot);
      rig.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const mat of materials) mat?.dispose?.();
      });
      renderer.dispose();
    },
  };
}
