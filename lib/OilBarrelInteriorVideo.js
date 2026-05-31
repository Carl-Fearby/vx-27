import * as THREE from "three";
import { normalizeFlameTexVRange } from "./OilBarrelTuning.js";

/** RGB + alpha matte (from ProRes 4444 source). */
export const OIL_CAN_INTERIOR_COLOR_URL =
  "/textures/oil_barrel/inside/oil_can_interior_color.mp4?v=fire-alpha-looped";
export const OIL_CAN_INTERIOR_ALPHA_URL =
  "/textures/oil_barrel/inside/oil_can_interior_alpha.mp4?v=fire-alpha-looped";

/** Looped flames — shipped clip is 540×304 (landscape). */
const VIDEO_ASPECT = 540 / 304;
/** Bottom edge sits this far above the interior floor (m). */
const VIDEO_FLOOR_LIFT = 0.04;
/** Cylindrical clip inside the barrel — fraction of inner radius (wall containment). */
const VIDEO_CLIP_RADIUS_FACTOR = 0.96;
let _colorVideo = null;
let _alphaVideo = null;
let _colorTex = null;
let _alphaTex = null;
/** @type {THREE.ShaderMaterial | null} Template; each screen clones this. */
let _videoMatTemplate = null;
let _loadPromise = null;
/** Bump when the shader changes so cached materials are rebuilt after hot reload. */
const INTERIOR_VIDEO_SHADER_GEN = 8;
let _loadedShaderGen = 0;

function invalidateVideoTemplateIfStale() {
  if (_loadedShaderGen === INTERIOR_VIDEO_SHADER_GEN) return;
  _videoMatTemplate = null;
  _loadPromise = null;
  _loadedShaderGen = INTERIOR_VIDEO_SHADER_GEN;
}

const _localCamInBarrel = new THREE.Vector3();

/** @param {THREE.Object3D} obj */
function findOilBarrelGroup(obj) {
  let node = obj;
  while (node) {
    if (node.name === "oil_barrel" && node.isGroup) return node;
    node = node.parent;
  }
  return null;
}

/**
 * @param {THREE.VideoTexture} colorTex
 * @param {THREE.VideoTexture} alphaTex Grayscale matte (alpha channel extracted at encode).
 */
export function createInteriorVideoMaterial(colorTex, alphaTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: colorTex },
      alphaMap: { value: alphaTex },
      clipRadius: { value: 0.25 },
      clipTopY: { value: 1 },
      layoutBottomY: { value: -0.5 },
      layoutTopY: { value: 0.5 },
      sampleV0: { value: 0.08 },
      sampleV1: { value: 0.92 },
      barrelMatrixInverse: { value: new THREE.Matrix4() },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform sampler2D alphaMap;
      uniform float clipRadius;
      uniform float clipTopY;
      uniform float layoutBottomY;
      uniform float layoutTopY;
      uniform float sampleV0;
      uniform float sampleV1;
      uniform mat4 barrelMatrixInverse;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vec4 local = barrelMatrixInverse * vec4(vWorldPos, 1.0);
        float r = length(local.xz);
        if (local.y < clipTopY && r > clipRadius) discard;

        float span = max(layoutTopY - layoutBottomY, 0.001);
        float t = clamp((local.y - layoutBottomY) / span, 0.0, 1.0);
        vec2 uv = vec2(vUv.x, mix(sampleV0, sampleV1, t));

        vec3 rgb = texture2D(map, uv).rgb;
        float matte = texture2D(alphaMap, uv).r;
        float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
        float key = smoothstep(0.05, 0.2, lum);
        float blueSpill = smoothstep(0.12, 0.42, rgb.b - max(rgb.r, rgb.g));
        float alpha = matte * key * (1.0 - blueSpill * 0.92);
        if (alpha < 0.02) discard;
        rgb *= alpha;
        gl_FragColor = vec4(rgb, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    premultipliedAlpha: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/**
 * @param {THREE.ShaderMaterial} template
 * @param {number} innerRadius
 * @param {number} clipTopY
 * @param {{ layoutBottomY: number, layoutTopY: number }} layout
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning
 */
function cloneInteriorVideoMaterial(template, innerRadius, clipTopY, layout, tuning) {
  const { sampleV0, sampleV1 } = normalizeFlameTexVRange(tuning);
  const mat = /** @type {THREE.ShaderMaterial} */ (template.clone());
  mat.uniforms.clipRadius.value = innerRadius * VIDEO_CLIP_RADIUS_FACTOR;
  mat.uniforms.clipTopY.value = clipTopY;
  mat.uniforms.layoutBottomY.value = layout.layoutBottomY;
  mat.uniforms.layoutTopY.value = layout.layoutTopY;
  mat.uniforms.sampleV0.value = sampleV0;
  mat.uniforms.sampleV1.value = sampleV1;
  return mat;
}

/** @param {THREE.ShaderMaterial} mat @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning */
function applyFlameTexVUniforms(mat, tuning) {
  const { sampleV0, sampleV1 } = normalizeFlameTexVRange(tuning);
  mat.uniforms.sampleV0.value = sampleV0;
  mat.uniforms.sampleV1.value = sampleV1;
}

/** @param {string} url */
function makeLoopingVideo(url) {
  const video = document.createElement("video");
  video.src = url;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  return video;
}

/** @param {HTMLVideoElement} colorVideo @param {HTMLVideoElement} alphaVideo */
function configureVideoTexture(tex, video) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  video.play().catch(() => {});
  return tex;
}

/** Decode synced color + alpha videos (true alpha from source, not luma key). */
export function ensureOilBarrelInteriorVideo() {
  invalidateVideoTemplateIfStale();
  if (_videoMatTemplate) return Promise.resolve(_videoMatTemplate);
  if (_loadPromise) return _loadPromise;

  _loadPromise = new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Oil barrel video requires a browser"));
      return;
    }

    const colorVideo = makeLoopingVideo(OIL_CAN_INTERIOR_COLOR_URL);
    const alphaVideo = makeLoopingVideo(OIL_CAN_INTERIOR_ALPHA_URL);
    let colorReady = false;
    let alphaReady = false;

    const finish = () => {
      if (!colorReady || !alphaReady) return;
      _colorVideo = colorVideo;
      _alphaVideo = alphaVideo;
      _colorTex = configureVideoTexture(
        new THREE.VideoTexture(colorVideo),
        colorVideo
      );
      _alphaTex = configureVideoTexture(
        new THREE.VideoTexture(alphaVideo),
        alphaVideo
      );
      _alphaTex.colorSpace = THREE.LinearSRGBColorSpace;
      _videoMatTemplate = createInteriorVideoMaterial(_colorTex, _alphaTex);
      resolve(_videoMatTemplate);
    };

    const onError = () => {
      _loadPromise = null;
      reject(
        new Error(
          `Failed to load oil barrel interior video (${OIL_CAN_INTERIOR_COLOR_URL})`
        )
      );
    };

    colorVideo.addEventListener("loadeddata", () => {
      colorReady = true;
      finish();
    }, { once: true });
    alphaVideo.addEventListener("loadeddata", () => {
      alphaReady = true;
      finish();
    }, { once: true });
    colorVideo.addEventListener("error", onError, { once: true });
    alphaVideo.addEventListener("error", onError, { once: true });
    colorVideo.load();
    alphaVideo.load();
  });

  return _loadPromise;
}

/**
 * Yaw-only billboard — plane stays vertical inside the barrel (no tilt through the wall).
 * @param {THREE.Mesh} mesh
 * @param {THREE.Camera} camera
 */
function billboardFireYawOnly(mesh, camera) {
  const barrel = findOilBarrelGroup(mesh);
  if (!barrel) return;
  barrel.updateMatrixWorld(true);
  _localCamInBarrel.copy(camera.position);
  barrel.worldToLocal(_localCamInBarrel);
  mesh.rotation.set(0, Math.atan2(_localCamInBarrel.x, _localCamInBarrel.z), 0);
}

/**
 * Per-frame video update + yaw billboards + cylindrical clip matrix.
 * @param {THREE.Camera} [camera]
 * @param {THREE.Object3D} [root]
 */
export function tickOilBarrelInteriorVideo(camera, root) {
  if (_colorTex && _colorVideo && _colorVideo.readyState >= 2) {
    _colorTex.needsUpdate = true;
  }
  if (_alphaTex && _alphaVideo && _alphaVideo.readyState >= 2) {
    _alphaTex.needsUpdate = true;
    if (_colorVideo && Math.abs(_alphaVideo.currentTime - _colorVideo.currentTime) > 0.08) {
      _alphaVideo.currentTime = _colorVideo.currentTime;
    }
  }
  if (!camera || !root) return;

  root.traverse((obj) => {
    if (!obj.isMesh || obj.name !== "oil_interior_video") return;
    billboardFireYawOnly(obj, camera);

    const barrel = findOilBarrelGroup(obj);
    const inv = obj.material?.uniforms?.barrelMatrixInverse?.value;
    if (barrel && inv) {
      barrel.updateMatrixWorld(true);
      inv.copy(barrel.matrixWorld).invert();
    }
  });
}

/**
 * Barrel-local X for flame video + fire point light (centre offset + fire-only shift).
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning
 */
export function computeInteriorFireCenterX(tuning) {
  return (
    (tuning.interiorVideoCenterOffsetX ?? 0) +
    (tuning.interiorFireOffsetX ?? 0)
  );
}

/**
 * Single flame column (floor → just above lip). Height scale stretches in-barrel only.
 *
 * @param {number} innerRadius
 * @param {number} floorY
 * @param {number} rimY Open rim Y (top lip) in barrel space.
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning
 */
export function computeInteriorFlameLayout(innerRadius, floorY, rimY, tuning) {
  const widthScale = tuning.interiorVideoWidthScale ?? 1;
  const heightScale = tuning.interiorVideoHeightScale ?? 1;
  const maxWidth = innerRadius * 2.08 * widthScale;
  const offsetY = tuning.interiorVideoCenterOffsetY ?? 0;
  const x = computeInteriorFireCenterX(tuning);

  const bottomY = floorY + VIDEO_FLOOR_LIFT;
  const topY = rimY + 0.03;
  let height = (topY - bottomY) * heightScale;
  let width = height * VIDEO_ASPECT * widthScale;
  if (width > maxWidth) {
    width = maxWidth;
  }

  const layoutBottomY = bottomY;
  const layoutTopY = bottomY + height;

  return {
    width,
    height,
    x,
    y: bottomY + height * 0.5 + offsetY,
    z: 0,
    layoutBottomY,
    layoutTopY,
  };
}

/** @deprecated Use computeInteriorFlameLayout */
export function computeInteriorVideoCenterY(floorY, videoHeight) {
  return floorY + VIDEO_FLOOR_LIFT + videoHeight * 0.5;
}

function applyInteriorVideoMeshLayout(mesh, tuning) {
  const ud = mesh.userData;
  if (
    ud.innerRadius == null ||
    ud.floorY == null ||
    ud.clipTopY == null
  ) {
    return;
  }

  const layout = computeInteriorFlameLayout(
    ud.innerRadius,
    ud.floorY,
    ud.clipTopY,
    tuning
  );
  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(layout.width, layout.height);
  mesh.position.set(layout.x, layout.y, layout.z);

  if (_videoMatTemplate) {
    mesh.material = cloneInteriorVideoMaterial(
      _videoMatTemplate,
      ud.innerRadius,
      ud.clipTopY,
      {
        layoutBottomY: layout.layoutBottomY,
        layoutTopY: layout.layoutTopY,
      },
      tuning
    );
  } else if (mesh.material?.uniforms?.sampleV0) {
    applyFlameTexVUniforms(mesh.material, tuning);
  }

  mesh.visible = tuning.interiorFire !== false;
}

/**
 * @param {THREE.Object3D} root
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning
 */
export function refreshOilBarrelInteriorVideoLayout(root, tuning) {
  if (!root) return;
  invalidateVideoTemplateIfStale();
  root.traverse((obj) => {
    if (!obj.isMesh || obj.name !== "oil_interior_video") return;
    if (_videoMatTemplate && obj.userData.innerRadius != null) {
      const layout = computeInteriorFlameLayout(
        obj.userData.innerRadius,
        obj.userData.floorY,
        obj.userData.clipTopY,
        tuning
      );
      obj.material = cloneInteriorVideoMaterial(
        _videoMatTemplate,
        obj.userData.innerRadius,
        obj.userData.clipTopY,
        {
          layoutBottomY: layout.layoutBottomY,
          layoutTopY: layout.layoutTopY,
        },
        tuning
      );
    } else if (obj.material?.uniforms?.sampleV0) {
      applyFlameTexVUniforms(obj.material, tuning);
    }
    applyInteriorVideoMeshLayout(obj, tuning);
  });
}

/** @deprecated Use refreshOilBarrelInteriorVideoLayout */
export function refreshOilBarrelInteriorVideoSizes(root, tuning) {
  refreshOilBarrelInteriorVideoLayout(root, tuning);
}

/**
 * @param {number} innerRadius
 * @param {number} wallHeight
 * @param {number} floorY Interior floor Y in barrel local space.
 * @param {number} clipTopY Rim Y — radial clip only below; flame can extend above.
 * @param {import("./OilBarrelTuning.js").OilBarrelTuning} tuning
 * @returns {THREE.Mesh | null}
 */
export function createOilBarrelInteriorVideoMesh(
  innerRadius,
  wallHeight,
  floorY,
  clipTopY,
  tuning
) {
  if (!_videoMatTemplate || tuning.interiorFire === false) return null;

  const layout = computeInteriorFlameLayout(
    innerRadius,
    floorY,
    clipTopY,
    tuning
  );

  const mat = cloneInteriorVideoMaterial(
    _videoMatTemplate,
    innerRadius,
    clipTopY,
    {
      layoutBottomY: layout.layoutBottomY,
      layoutTopY: layout.layoutTopY,
    },
    tuning
  );
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(layout.width, layout.height),
    mat
  );
  mesh.name = "oil_interior_video";
  mesh.position.set(layout.x, layout.y, layout.z);
  mesh.renderOrder = 6;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.shadowCast = false;
  mesh.userData.shadowReceive = false;
  mesh.userData.skipBulletSurface = true;
  mesh.userData.innerRadius = innerRadius;
  mesh.userData.innerWallHeight = wallHeight;
  mesh.userData.floorY = floorY;
  mesh.userData.clipTopY = clipTopY;
  return mesh;
}

export function getOilBarrelInteriorVideoMaterial() {
  return _videoMatTemplate;
}
