import * as THREE from "three";
import {
  createCratePreviewMesh,
  disposeCratePreviewMesh,
} from "@/lib/AmmoCrate";
import { getCreditsRiflePrototype } from "@/lib/CreditsRiflePreview";
import { disposeGrenadeModel, getGrenadeModel } from "@/lib/Grenade";
import { getOrbGeometry, getOrbMaterials } from "@/lib/Targets";
import { createCreditsPreviewLoop } from "@/lib/useCreditsLazy3d";
import {
  fitObjectUniform,
  frameCameraOnBounds,
} from "@/lib/creditsPreviewFrame";

const WIDTH = 720;
const HEIGHT = 420;

function prepareMesh(root) {
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
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    }
  });
}

function fitToSize(object, targetSize) {
  fitObjectUniform(object, targetSize);
}

function disposeObject3D(root) {
  root.traverse((obj) => {
    if (obj.geometry && !obj.geometry.userData?.shared) obj.geometry.dispose();
    const { material } = obj;
    if (!material) return;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
  });
}

/**
 * Multi-model chaos stage for the credits big-bang finale.
 * @returns {Promise<() => void>}
 */
export async function mountCreditsFinalePreview(canvas, { getPriority } = {}) {
  if (!canvas) {
    return { dispose: () => {}, setActive: () => {} };
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pxW = Math.round(WIDTH * dpr);
  const pxH = Math.round(HEIGHT * dpr);

  canvas.width = pxW;
  canvas.height = pxH;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(pxW, pxH, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const stage = new THREE.Group();
  scene.add(stage);

  const camera = new THREE.PerspectiveCamera(38, WIDTH / HEIGHT, 0.01, 48);

  scene.add(new THREE.AmbientLight(0x88aaff, 0.45));
  const key = new THREE.DirectionalLight(0xe0f0ff, 1.5);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5eaaff, 1.1);
  rim.position.set(-3, 1, -2);
  scene.add(rim);
  const boom = new THREE.PointLight(0x46c8ff, 0, 12);
  boom.position.set(0, 0.2, 1);
  scene.add(boom);

  const actors = [];
  const grenades = [];

  const rifleProto = await getCreditsRiflePrototype();
  const rifle = rifleProto.clone(true);
  prepareMesh(rifle);
  rifle.position.set(0, 0.08, 0);
  rifle.rotation.set(0.15, Math.PI * 0.25, 0);
  stage.add(rifle);
  actors.push({
    obj: rifle,
    spinY: 0.011,
    spinX: 0.002,
    bob: 0.025,
    bobSpeed: 1.4,
  });

  for (const [pos, spinZ] of [
    [[-0.72, -0.08, 0.15], 0.022],
    [[0.78, 0.02, -0.1], -0.018],
    [[-0.42, -0.32, 0.25], 0.026],
  ]) {
    const grenade = getGrenadeModel();
    prepareMesh(grenade);
    fitToSize(grenade, 0.28);
    grenade.position.set(...pos);
    grenade.rotation.x = Math.PI / 2;
    stage.add(grenade);
    grenades.push(grenade);
    actors.push({
      obj: grenade,
      baseY: pos[1],
      spinZ,
      spinX: 0.008,
      bob: 0.035,
      bobSpeed: 2 + Math.random(),
      phase: Math.random() * Math.PI * 2,
    });
  }

  const crate = createCratePreviewMesh();
  fitToSize(crate, 0.42);
  crate.position.set(0.62, -0.22, 0.05);
  crate.rotation.y = -0.4;
  stage.add(crate);
  actors.push({
    obj: crate,
    baseY: -0.22,
    spinY: -0.009,
    bob: 0.04,
    bobSpeed: 1.8,
    phase: 1.2,
  });

  const orb = new THREE.Mesh(getOrbGeometry(), getOrbMaterials());
  prepareMesh(orb);
  fitToSize(orb, 0.32);
  orb.position.set(-0.58, -0.2, 0);
  stage.add(orb);
  const orbBaseScale = orb.scale.clone();
  actors.push({
    obj: orb,
    spinY: 0.018,
    pulse: 0.04,
    pulseSpeed: 2.6,
    phase: 0.5,
    orbBaseScale,
  });

  const { center: lookTarget } = frameCameraOnBounds(camera, stage, {
    padding: 1.24,
    aspect: WIDTH / HEIGHT,
  });
  const camBase = camera.position.clone();

  let t = 0;

  const loop = createCreditsPreviewLoop(() => {
    t += 1 / 60;
    boom.intensity = 2.2 + Math.sin(t * 4.5) * 1.8 + Math.sin(t * 11) * 0.6;

    for (const a of actors) {
      if (a.spinY) a.obj.rotation.y += a.spinY;
      if (a.spinX) a.obj.rotation.x += a.spinX;
      if (a.spinZ) a.obj.rotation.z += a.spinZ;
      if (a.baseY !== undefined && a.bob) {
        a.obj.position.y =
          a.baseY + Math.sin(t * a.bobSpeed + (a.phase ?? 0)) * a.bob;
      }
      if (a.pulse && a.orbBaseScale) {
        const s = 1 + Math.sin(t * a.pulseSpeed + (a.phase ?? 0)) * a.pulse;
        a.obj.scale.set(
          a.orbBaseScale.x * s,
          a.orbBaseScale.y * s,
          a.orbBaseScale.z * s,
        );
      }
    }

    camera.position.x = camBase.x + Math.sin(t * 0.35) * 0.04;
    camera.position.y = camBase.y;
    camera.position.z = camBase.z;
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
  }, getPriority);

  return {
    setActive: (run) => loop.setActive(run),
    dispose: () => {
      loop.stop();
      disposeObject3D(rifle);
      for (const g of grenades) disposeGrenadeModel(g);
      disposeCratePreviewMesh(crate);
      disposeObject3D(orb);
      renderer.dispose();
    },
  };
}
