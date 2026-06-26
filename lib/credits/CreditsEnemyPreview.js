import * as THREE from "three";
import { createEnemyRigPreview, preloadEnemyRig } from "../combat/EnemyRig.js";
import { createCreditsPreviewLoop } from "./useCreditsLazy3d.js";

const VARIANTS = {
  flank: { size: 148, fov: 36, rotY: 0.0028, padding: 1.48, targetHeight: 1.75 },
  hero: { size: 300, fov: 32, rotY: 0.0036, padding: 1.55, targetHeight: 1.85 },
  strip: { size: 340, fov: 30, rotY: 0.0032, padding: 1.58, targetHeight: 1.85 },
  marketing: {
    size: 340,
    fov: 34,
    rotY: 0,
    padding: 1.68,
    targetHeight: 1.85,
    patrol: true,
    patrolRadius: 0.48,
    patrolSpeed: 0.62,
    patrolYawOffset: -0.28,
    walkStrideFactor: 0.62,
    walkStrideScale: 1.78,
    groundGrid: { divisions: 16, margin: 1.16 },
  },
  lightbox: {
    size: 560,
    fov: 30,
    rotY: 0.0036,
    padding: 1.5,
    targetHeight: 2.0,
    walkStrideFactor: 0.62,
    walkStrideScale: 1.78,
    groundGrid: { divisions: 20, margin: 1.14 },
  },
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

const GROUND_GRID_COLOR = [0.306, 0.812, 0.541];
const _groundFadeWorld = new THREE.Vector3();

function createPreviewGroundGrid(width, depth, divisions = 16) {
  const verts = [];
  const colors = [];
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const stepX = width / divisions;
  const stepZ = depth / divisions;

  const pushVertex = (x, y, z) => {
    verts.push(x, y, z);
    colors.push(
      GROUND_GRID_COLOR[0],
      GROUND_GRID_COLOR[1],
      GROUND_GRID_COLOR[2],
    );
  };

  for (let i = 0; i <= divisions; i++) {
    const x = -halfW + i * stepX;
    pushVertex(x, 0, -halfD);
    pushVertex(x, 0, halfD);
  }
  for (let j = 0; j <= divisions; j++) {
    const z = -halfD + j * stepZ;
    pushVertex(-halfW, 0, z);
    pushVertex(halfW, 0, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
    vertexColors: true,
    toneMapped: false,
  });
  const grid = new THREE.LineSegments(geometry, material);
  grid.renderOrder = -1;
  grid.userData.cellSizeX = stepX;
  grid.userData.cellSizeZ = stepZ;
  return grid;
}

/** Fade grid lines to black with distance from the camera (perspective falloff). */
function updateGroundGridDistanceFade(grid, groundRoot, camera) {
  const posAttr = grid.geometry.getAttribute("position");
  const colorAttr = grid.geometry.getAttribute("color");
  if (!posAttr || !colorAttr) return;

  groundRoot.updateMatrixWorld(true);
  const count = posAttr.count;
  let minD = Infinity;
  let maxD = -Infinity;

  for (let i = 0; i < count; i++) {
    _groundFadeWorld.fromBufferAttribute(posAttr, i);
    groundRoot.localToWorld(_groundFadeWorld);
    const dist = _groundFadeWorld.distanceTo(camera.position);
    if (dist < minD) minD = dist;
    if (dist > maxD) maxD = dist;
  }

  const range = Math.max(maxD - minD, 0.001);
  const fadeStart = minD + range * 0.18;
  const fadeEnd = minD + range * 0.72;
  const [baseR, baseG, baseB] = GROUND_GRID_COLOR;

  for (let i = 0; i < count; i++) {
    _groundFadeWorld.fromBufferAttribute(posAttr, i);
    groundRoot.localToWorld(_groundFadeWorld);
    const dist = _groundFadeWorld.distanceTo(camera.position);
    const fade = 1 - THREE.MathUtils.smoothstep(fadeStart, fadeEnd, dist);
    const strength = fade * fade;
    colorAttr.setXYZ(i, baseR * strength, baseG * strength, baseB * strength);
  }
  colorAttr.needsUpdate = true;
}

/** Ground plane span from camera frustum — fills preview box width at the bottom. */
function wrapScrollOffset(offset, cell) {
  return -((offset % cell) + cell) % cell;
}

function computeGroundGridSpan(
  camera,
  { margin = 1.14, divisions = 16, patrolRadius = 0 } = {},
) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster();
  const hits = [];

  for (const ndc of [
    [-1, -1],
    [1, -1],
    [-1, -0.2],
    [1, -0.2],
    [0, -1],
  ]) {
    raycaster.setFromCamera(new THREE.Vector2(ndc[0], ndc[1]), camera);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) hits.push(hit);
  }

  if (hits.length < 2) {
    const fallback = 3.2;
    return { width: fallback, depth: fallback * 0.72, divisions };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of hits) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  const width = Math.max((maxX - minX) * margin, 2.4) + patrolRadius * 2.4;
  const depth = Math.max((maxZ - minZ) * margin, 1.8) + patrolRadius * 2.4;
  return { width, depth, divisions };
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

  const groundRoot = new THREE.Group();
  let groundGrid = null;
  if (cfg.groundGrid) {
    const gridOpts =
      typeof cfg.groundGrid === "object" ? cfg.groundGrid : { divisions: 16 };
    const span = computeGroundGridSpan(camera, {
      ...gridOpts,
      patrolRadius: cfg.patrol ? (cfg.patrolRadius ?? 0) : 0,
    });
    groundGrid = createPreviewGroundGrid(span.width, span.depth, span.divisions);
    groundRoot.add(groundGrid);
    scene.add(groundRoot);
  }

  const tiltYaw = tiltRoot.rotation.y;

  let disposed = false;
  let patrolPhase = 0;
  let gridScroll = 0;
  let lastWalkTime = preview.walkAction?.time ?? 0;
  const clock = new THREE.Clock();
  const loop = createCreditsPreviewLoop(() => {
    if (disposed) return;
    const dt = clock.getDelta();
    preview.update(dt);

    if (cfg.patrol) {
      patrolPhase += dt * (cfg.patrolSpeed ?? 0.6);
      const radius = cfg.patrolRadius ?? 0.45;
      spinRoot.position.set(
        Math.sin(patrolPhase) * radius,
        0,
        Math.cos(patrolPhase) * radius,
      );
      spinRoot.rotation.y =
        patrolPhase + Math.PI / 2 + (cfg.patrolYawOffset ?? 0);
    } else if (cfg.faceYaw != null) {
      spinRoot.position.set(0, 0, 0);
      spinRoot.rotation.y = cfg.faceYaw;
    } else {
      spinRoot.position.set(0, 0, 0);
      spinRoot.rotation.y += cfg.rotY ?? 0;
    }

    if (groundGrid && preview.walkAction) {
      const strideLength =
        preview.targetHeight *
        (cfg.walkStrideFactor ?? 0.56) *
        (cfg.walkStrideScale ?? 1);
      const walkDuration = Math.max(preview.walkClipDuration ?? 1, 0.001);
      const walkTime = preview.walkAction.time;
      let walkDelta = walkTime - lastWalkTime;
      if (walkDelta < 0) walkDelta += walkDuration;
      if (walkDelta > walkDuration) walkDelta = walkDuration;
      lastWalkTime = walkTime;
      gridScroll += walkDelta * (strideLength / walkDuration);

      groundRoot.position.set(spinRoot.position.x, 0, spinRoot.position.z);
      groundRoot.rotation.y = spinRoot.rotation.y + tiltYaw;
      groundGrid.position.x = 0;
      groundGrid.position.z = wrapScrollOffset(
        gridScroll,
        groundGrid.userData.cellSizeZ,
      );
      updateGroundGridDistanceFade(groundGrid, groundRoot, camera);
    }

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
      if (groundGrid) {
        scene.remove(groundRoot);
        groundGrid.geometry.dispose();
        groundGrid.material.dispose();
      }
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
