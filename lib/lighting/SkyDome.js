import * as THREE from "three";
import { SKY_MESH_RADIUS, SUN_BOWL_RADIUS } from "./SunLightTuning.js";
import {
  ROOM_INTERIOR_LAYER,
  setSkyLayer,
  WORLD_LAYER,
} from "./LightingLayers.js";

let sunOcclusionRoot = null;
const _sunLosRaycaster = new THREE.Raycaster();
const _sunLosOrigin = new THREE.Vector3();
const _sunLosDir = new THREE.Vector3();
const _sunLosHits = [];
const _sunLosCamPos = new THREE.Vector3();
const _sunLosCamQuat = new THREE.Quaternion();
const _sunLosSunPos = new THREE.Vector3();
let _sunLosCacheValid = false;
let _sunLosCacheVisible = true;
const SUN_LOS_CAM_EPS = 0.025;
const SUN_LOS_SUN_EPS = 0.5;

/** Level geometry that can block the sun disc / lens flare (usually `level.group`). */
export function setSunOcclusionRoot(root) {
  sunOcclusionRoot = root;
  _sunLosCacheValid = false;
}

function meshBlocksSunView(obj) {
  if (!obj?.isMesh) return false;
  if (obj.userData?.isSkyDome) return false;
  if (obj.userData?.pickupShadowCaster) return false;
  if (obj.userData?.bulletHole || obj.userData?.bulletImpactFlash) return false;
  if (obj.userData?.healthBar) return false;
  if (obj.userData?.isShadowOccluder) return true;
  if (obj.userData?.skipBulletSurface) return false;
  if (obj.userData?.roomArenaWallOverlay || obj.userData?.roomCornerSeal) return false;
  return true;
}

function isSunVisibleFromCamera(camera, sunWorldPos) {
  if (!sunOcclusionRoot || !camera) return true;

  _sunLosOrigin.copy(camera.position);
  _sunLosDir.subVectors(sunWorldPos, _sunLosOrigin);
  const dist = _sunLosDir.length();
  if (dist < 0.5) return true;

  _sunLosDir.multiplyScalar(1 / dist);
  _sunLosRaycaster.set(_sunLosOrigin, _sunLosDir);
  _sunLosRaycaster.far = Math.max(dist - SUN_DISC_SIZE * 0.35, 0.5);
  _sunLosRaycaster.near = 0.05;
  _sunLosRaycaster.layers.set(WORLD_LAYER);
  _sunLosRaycaster.layers.enable(ROOM_INTERIOR_LAYER);

  _sunLosHits.length = 0;
  _sunLosRaycaster.intersectObject(sunOcclusionRoot, true, _sunLosHits);

  for (const hit of _sunLosHits) {
    if (meshBlocksSunView(hit.object)) return false;
  }
  return true;
}

function isSunVisibleFromCameraCached(camera, sunWorldPos) {
  if (
    !_sunLosCacheValid ||
    _sunLosCamPos.distanceToSquared(camera.position) >
      SUN_LOS_CAM_EPS * SUN_LOS_CAM_EPS ||
    _sunLosCamQuat.angleTo(camera.quaternion) > 0.002 ||
    _sunLosSunPos.distanceToSquared(sunWorldPos) > SUN_LOS_SUN_EPS * SUN_LOS_SUN_EPS
  ) {
    _sunLosCamPos.copy(camera.position);
    _sunLosCamQuat.copy(camera.quaternion);
    _sunLosSunPos.copy(sunWorldPos);
    _sunLosCacheVisible = isSunVisibleFromCamera(camera, sunWorldPos);
    _sunLosCacheValid = true;
  }
  return _sunLosCacheVisible;
}

const CELESTIAL_RADIUS = SUN_BOWL_RADIUS;
/** Apparent diameter in world units — bigger than the real ~0.5° for game readability. */
const SUN_DISC_SIZE = CELESTIAL_RADIUS * 0.15;
const MOON_DISC_SIZE = CELESTIAL_RADIUS * 0.176;
const MOON_TEXTURE_URL = "/sky/moon_lroc_color_2k.jpg";

function createSunDiscTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Soft sun orb: a small fully-saturated core that eases off smoothly
  // through warm tones to a transparent edge. No hard plateau — the
  // disc should feel like a luminous ball, not a flat sticker.
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0.0, "rgba(255, 255, 250, 1)");
  grad.addColorStop(0.28, "rgba(255, 252, 235, 0.95)");
  grad.addColorStop(0.5, "rgba(255, 235, 185, 0.7)");
  grad.addColorStop(0.72, "rgba(255, 200, 130, 0.35)");
  grad.addColorStop(0.88, "rgba(255, 170, 95, 0.12)");
  grad.addColorStop(1.0, "rgba(255, 150, 80, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSunSpikeTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);

  // Linear blade with a defined bright core that tapers to transparent
  // tips. The plateau is kept narrow so each blade still reads as a line
  // rather than a smear, but the outer fade is generous so the tips melt
  // into the sky instead of cutting across foreground objects.
  function drawSpike(angle, length, thickness, alpha) {
    ctx.save();
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(-length, 0, length, 0);
    grad.addColorStop(0.0, "rgba(255, 240, 200, 0)");
    grad.addColorStop(0.32, `rgba(255, 250, 230, ${alpha * 0.25})`);
    grad.addColorStop(0.46, `rgba(255, 253, 245, ${alpha})`);
    grad.addColorStop(0.54, `rgba(255, 253, 245, ${alpha})`);
    grad.addColorStop(0.68, `rgba(255, 250, 230, ${alpha * 0.25})`);
    grad.addColorStop(1.0, "rgba(255, 240, 200, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(-length, -thickness / 2, length * 2, thickness);
    ctx.restore();
  }

  // Irregular spread of rays at non-cardinal angles. Alphas pulled back
  // so the rays are visible against sky but don't dominate when they
  // happen to cross foreground silhouettes during the day/night swing.
  const spikes = [
    { ang: 0.17, len: 235, thick: 4, a: 0.55 },
    { ang: 0.74, len: 170, thick: 2, a: 0.35 },
    { ang: 1.36, len: 245, thick: 4, a: 0.6 },
    { ang: 1.92, len: 180, thick: 2, a: 0.35 },
    { ang: 2.48, len: 215, thick: 3, a: 0.45 },
    { ang: 3.05, len: 155, thick: 2, a: 0.3 },
    { ang: 3.68, len: 240, thick: 4, a: 0.55 },
    { ang: 4.21, len: 165, thick: 2, a: 0.35 },
    { ang: 4.83, len: 210, thick: 3, a: 0.45 },
    { ang: 5.46, len: 175, thick: 2, a: 0.35 },
    { ang: 5.97, len: 225, thick: 3, a: 0.5 },
  ];

  // Light blur softens the edges so the lines don't read as crisp painted
  // strokes — closer to real atmospheric halation around a bright source.
  ctx.filter = "blur(1.5px)";
  for (const s of spikes) drawSpike(s.ang, s.len, s.thick, s.a);
  ctx.filter = "none";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSoftDiscTexture(innerColor, edgeColor) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, innerColor);
  grad.addColorStop(0.55, edgeColor);
  grad.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createRingTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  // Annulus — bright at ~85% of radius and falls off both inward and out.
  const grad = ctx.createRadialGradient(128, 128, 70, 128, 128, 128);
  grad.addColorStop(0.0, "rgba(255,255,255,0)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.78, "rgba(255,255,255,0.45)");
  grad.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createHexTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = 64;
  const cy = 64;
  const r = 56;
  // Hexagonal aperture ghost — the recognisable "lens flare" shape.
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 0.85)");
  grad.addColorStop(0.7, "rgba(255, 240, 210, 0.55)");
  grad.addColorStop(1.0, "rgba(255, 220, 180, 0)");
  ctx.fillStyle = grad;
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSunCoreTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // A small pure-white punch-through that stacks on top of the main disc
  // via additive blending — pushes the central pixels visibly brighter than
  // the surrounding corona.
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.55, "rgba(255, 252, 240, 0.9)");
  grad.addColorStop(0.85, "rgba(255, 245, 220, 0.25)");
  grad.addColorStop(1.0, "rgba(255, 240, 210, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createMoonHaloTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Rim-glow halo: peak brightness sits exactly at the moon's edge (the
  // moon disc occupies the inner ~71% of the sprite since haloSize is
  // 1.4× moonSize), so there's no dark gap between the disc and the
  // glow. From the peak the alpha falls off smoothly outward into the
  // sky. The moon mesh renders on top, so the halo only shows in the
  // ring outside the disc — additive on top of the lit moon edge plus a
  // soft outer wash.
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0.0, "rgba(250, 252, 255, 0)");
  grad.addColorStop(0.5, "rgba(250, 252, 255, 0)");
  grad.addColorStop(0.7, "rgba(252, 254, 255, 0.98)");
  grad.addColorStop(0.78, "rgba(245, 250, 255, 0.7)");
  grad.addColorStop(0.88, "rgba(232, 240, 252, 0.32)");
  grad.addColorStop(1.0, "rgba(215, 225, 245, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function loadMoonSurfaceTexture(anisotropy) {
  const loader = new THREE.TextureLoader();
  const tex = loader.load(MOON_TEXTURE_URL);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}


const _celestialDir = new THREE.Vector3();

/**
 * Place a billboard sprite along the world direction toward `worldPos` from
 * the origin, at the celestial sphere radius. The sprite is a child of the
 * sky root (which follows the camera) so it sits at "infinity".
 */
function placeCelestialSprite(sprite, worldPos) {
  if (!worldPos) {
    sprite.visible = false;
    return;
  }
  _celestialDir.set(worldPos.x, worldPos.y, worldPos.z);
  const len = _celestialDir.length();
  if (len < 1e-4) {
    sprite.visible = false;
    return;
  }
  _celestialDir.multiplyScalar(CELESTIAL_RADIUS / len);
  sprite.position.copy(_celestialDir);
  sprite.visible = true;
}

const SKY_BASE = "/sky";
const DAY_MANIFEST_URL = `${SKY_BASE}/sky_dome_asset.json`;
const NIGHT_MANIFEST_URL = `${SKY_BASE}/night_sky_dome_asset.json`;
const DEFAULT_DAY_TEXTURE = "sky_dome_equirectangular_4k.webp";
const DEFAULT_NIGHT_TEXTURE = "night_sky_dome_equirectangular_4k.webp";
/** Bust CDN/browser cache when the seam-fixed asset changes. */
const SKY_TEXTURE_CACHE_BUST = "seamless-v33-4k-webp";
/**
 * Night equirect horizon sits ~0.10 higher in V than day (see sky manifests).
 * Subtract when sampling night so both domes align during crossfade.
 */
const NIGHT_SKY_LAT_OFFSET = 0.1;

async function loadManifest(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function resolveTextureFile(manifest, fallback) {
  return (
    manifest?.files?.primary_webp ??
    manifest?.files?.primary_jpg ??
    manifest?.files?.primary_texture ??
    manifest?.files?.primary_png ??
    manifest?.texture_files?.runtime_recommended ??
    fallback
  );
}

/**
 * Equirectangular sky textures are sampled by direction in the fragment shader,
 * so mipmaps would only ever hurt: the discontinuity at the longitude seam pushes
 * the GPU to pick the coarsest LOD and produces a visible vertical band. Anisotropic
 * filtering keeps the horizon sharp without mips.
 *
 * @param {string} url
 * @param {number} anisotropy
 */
async function loadEquirectTexture(url, anisotropy) {
  const busted =
    url.includes("?") ? url : `${url}?v=${SKY_TEXTURE_CACHE_BUST}`;
  const tex = await new THREE.TextureLoader().loadAsync(busted);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

async function loadDayTexture(anisotropy) {
  const manifest = await loadManifest(DAY_MANIFEST_URL);
  const file = resolveTextureFile(manifest, DEFAULT_DAY_TEXTURE);
  return loadEquirectTexture(`${SKY_BASE}/${file}`, anisotropy);
}

async function loadNightTexture(anisotropy, dayFallback) {
  try {
    const manifest = await loadManifest(NIGHT_MANIFEST_URL);
    const file = resolveTextureFile(manifest, DEFAULT_NIGHT_TEXTURE);
    const tex = await loadEquirectTexture(`${SKY_BASE}/${file}`, anisotropy);
    return { texture: tex, owned: true };
  } catch (err) {
    console.warn("Night sky unavailable, falling back to day texture:", err);
    return { texture: dayFallback, owned: false };
  }
}

/**
 * Direction-based equirect sampling: UVs are derived per-fragment from the
 * normalized world direction, so the longitude seam disappears (atan2 wraps to
 * the same wrapped texel via RepeatWrapping). The vertex shader passes local
 * position; we normalize in the fragment so interpolation stays continuous.
 *
 * @param {THREE.Texture} dayTexture
 * @param {THREE.Texture} nightTexture
 */
function createSkyMaterial(dayTexture, nightTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDay: { value: dayTexture },
      uNight: { value: nightTexture },
      uNightBlend: { value: 0 },
      uNightLatOffset: { value: NIGHT_SKY_LAT_OFFSET },
      uRotation: { value: 0 },
      uBrightness: { value: 1 },
      uGreyness: { value: 0 },
      uLightningFlash: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalDir;
      void main() {
        // Unit direction per vertex — avoids a meridian band from interpolating radius vectors.
        vLocalDir = normalize(position);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;

      uniform sampler2D uDay;
      uniform sampler2D uNight;
      uniform float uNightBlend;
      uniform float uNightLatOffset;
      uniform float uRotation;
      uniform float uBrightness;
      uniform float uGreyness;
      uniform float uLightningFlash;
      varying vec3 vLocalDir;

      const float INV_TWO_PI = 0.15915494309189535;
      const float INV_PI = 0.3183098861837907;

      vec2 dirToEquirectUV(vec3 d) {
        float lon = atan(d.z, d.x);
        float lat = asin(clamp(d.y, -1.0, 1.0));
        return vec2(lon * INV_TWO_PI + 0.5, lat * INV_PI + 0.5);
      }

      void main() {
        vec3 dir = normalize(vLocalDir);
        float cosR = cos(uRotation);
        float sinR = sin(uRotation);
        dir = vec3(
          cosR * dir.x + sinR * dir.z,
          dir.y,
          -sinR * dir.x + cosR * dir.z
        );
        vec2 dayUV = dirToEquirectUV(dir);
        vec2 nightUV = vec2(dayUV.x, clamp(dayUV.y - uNightLatOffset, 0.0, 1.0));
        vec3 dayColor = texture2D(uDay, dayUV).rgb;
        vec3 nightColor = texture2D(uNight, nightUV).rgb;
        vec3 skyColor = mix(dayColor, nightColor, uNightBlend);
        // Overcast rain: desaturate toward a cool steel-grey and dim.
        float lum = dot(skyColor, vec3(0.299, 0.587, 0.114));
        vec3 overcastGrey = vec3(lum * 0.88 + 0.04, lum * 0.88 + 0.05, lum * 0.88 + 0.07);
        skyColor = mix(skyColor, overcastGrey, uGreyness * (1.0 - uLightningFlash * 0.92));
        vec3 flashWhite = vec3(0.9, 0.95, 1.0);
        skyColor = mix(skyColor, flashWhite, uLightningFlash * 0.72);
        gl_FragColor = vec4(skyColor * (uBrightness + uLightningFlash * 2.4), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
  });
}

/**
 * Inward-facing sphere that follows the camera and samples a day/night equirect
 * pair by direction. Radius is purely geometric; visual appearance is unaffected
 * by it because the shader works off the normalized direction vector.
 *
 * @param {THREE.Scene} scene
 * @param {{ rotation?: number, renderer?: THREE.WebGLRenderer | null }} [options]
 */
export async function createSkyDome(scene, options = {}) {
  const renderer = options.renderer ?? null;
  const rotation = options.rotation ?? 0;

  scene.background = null;

  const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  const anisotropy = Math.min(16, Math.max(1, maxAnisotropy));

  const dayTexture = await loadDayTexture(anisotropy);
  const { texture: nightTexture, owned: nightOwned } = await loadNightTexture(
    anisotropy,
    dayTexture
  );

  // 32 segments is plenty: the shader does direction-based sampling, so
  // tessellation only affects how curved the silhouette looks against the
  // near clip (irrelevant — the dome envelops the camera).
  const geometry = new THREE.SphereGeometry(SKY_MESH_RADIUS, 64, 32);
  const material = createSkyMaterial(dayTexture, nightTexture);
  material.uniforms.uRotation.value = rotation;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "sky_dome";
  mesh.userData.isSkyDome = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  setSkyLayer(mesh);

  const root = new THREE.Group();
  root.name = "sky_dome_root";
  root.userData.isSkyDome = true;
  root.add(mesh);
  scene.add(root);

  // Sun + moon billboards live as children of the sky root so they translate
  // with the camera and sit at the celestial sphere distance. Additive
  // blending for the sun makes its corona feel hot against any sky; the moon
  // uses standard alpha blending so the maria stay readable.
  const sunTexture = createSunDiscTexture();
  const sunMaterial = new THREE.SpriteMaterial({
    map: sunTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const sunSprite = new THREE.Sprite(sunMaterial);
  sunSprite.name = "sky_sun";
  sunSprite.scale.set(SUN_DISC_SIZE, SUN_DISC_SIZE, 1);
  sunSprite.userData.isSkyDome = true;
  sunSprite.frustumCulled = false;
  sunSprite.renderOrder = -999;
  setSkyLayer(sunSprite);
  root.add(sunSprite);

  // Inner hot core stacked additively on top of the corona — gives the sun
  // a visible brightness peak instead of plateauing at the corona's white.
  const sunCoreTexture = createSunCoreTexture();
  const sunCoreMaterial = new THREE.SpriteMaterial({
    map: sunCoreTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const sunCoreSprite = new THREE.Sprite(sunCoreMaterial);
  sunCoreSprite.name = "sky_sun_core";
  // Core is ~45% of the outer disc so it sits inside the bright plateau.
  const sunCoreSize = SUN_DISC_SIZE * 0.45;
  sunCoreSprite.scale.set(sunCoreSize, sunCoreSize, 1);
  sunCoreSprite.userData.isSkyDome = true;
  sunCoreSprite.frustumCulled = false;
  sunCoreSprite.renderOrder = -998;
  setSkyLayer(sunCoreSprite);
  root.add(sunCoreSprite);

  // Diffraction spikes — additive star burst riding on top of the sun. Tag
  // it isSkyDome so it renders in the sky pass and gets naturally occluded
  // when world geometry covers the sun (a real lens artifact too).
  const sunSpikeTexture = createSunSpikeTexture();
  const sunSpikeMaterial = new THREE.SpriteMaterial({
    map: sunSpikeTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const sunSpikeSprite = new THREE.Sprite(sunSpikeMaterial);
  sunSpikeSprite.name = "sky_sun_spikes";
  // Spikes extend well past the sun disc — that's the whole point.
  const spikeSize = SUN_DISC_SIZE * 5.0;
  sunSpikeSprite.scale.set(spikeSize, spikeSize, 1);
  sunSpikeSprite.userData.isSkyDome = true;
  sunSpikeSprite.frustumCulled = false;
  // Render *below* the sun disc so the disc reads through the spike core.
  sunSpikeSprite.renderOrder = -1001;
  setSkyLayer(sunSpikeSprite);
  root.add(sunSpikeSprite);

  // Lens flare ghosts — a chain of additive sprites along the line from
  // the sun's screen position to screen centre. Positioned per-frame in
  // sky-local space (which is camera-aligned because the sky root only
  // translates with the camera). Tagged isSkyDome so the existing render
  // split picks them up.
  const flareDiscTextureWarm = createSoftDiscTexture(
    "rgba(255, 220, 170, 1.0)",
    "rgba(255, 180, 110, 0.35)"
  );
  const flareDiscTextureCool = createSoftDiscTexture(
    "rgba(200, 220, 255, 1.0)",
    "rgba(140, 180, 240, 0.3)"
  );
  const flareHexTexture = createHexTexture();
  const flareRingTexture = createRingTexture();

  const flareGhostConfigs = [
    { t: 0.18, sizeScreen: 0.05, color: 0xffcc88, opacity: 0.55, tex: flareDiscTextureWarm },
    { t: 0.32, sizeScreen: 0.03, color: 0xffe9b8, opacity: 0.7, tex: flareHexTexture },
    { t: 0.52, sizeScreen: 0.09, color: 0xbcd6ff, opacity: 0.35, tex: flareRingTexture },
    { t: 0.72, sizeScreen: 0.04, color: 0xff9c7a, opacity: 0.5, tex: flareDiscTextureWarm },
    { t: 0.95, sizeScreen: 0.14, color: 0xcfe2ff, opacity: 0.22, tex: flareRingTexture },
    { t: 1.18, sizeScreen: 0.045, color: 0xff8f6a, opacity: 0.5, tex: flareHexTexture },
    { t: 1.42, sizeScreen: 0.035, color: 0xffd0a0, opacity: 0.55, tex: flareDiscTextureCool },
  ];

  const flareGhosts = flareGhostConfigs.map((cfg) => {
    const mat = new THREE.SpriteMaterial({
      map: cfg.tex,
      color: cfg.color,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.userData.isSkyDome = true;
    sprite.userData.flare = {
      t: cfg.t,
      sizeScreen: cfg.sizeScreen,
      baseOpacity: cfg.opacity,
    };
    sprite.frustumCulled = false;
    // Above the sky dome (-1000) but below sun disc; ordering inside the
    // additive group barely matters since depthWrite is off.
    sprite.renderOrder = -1002;
    sprite.visible = false;
    setSkyLayer(sprite);
    root.add(sprite);
    return sprite;
  });

  // Per-frame lens flare positioning. Computes the sun's screen-space NDC
  // position via projection, then for each ghost lays it along the line
  // from sun → screen-centre at a fixed near-camera depth. Done in
  // sky-local space (which equals camera-relative world offset) so the
  // ghosts move with the camera automatically.
  const _sunWorld = new THREE.Vector3();
  const _sunNDC = new THREE.Vector3();
  const _camForward = new THREE.Vector3();
  const _camRight = new THREE.Vector3();
  const _camUp = new THREE.Vector3();
  const _ghostOffset = new THREE.Vector3();
  const FLARE_DEPTH = 12;
  let lensFlareEnabled = true;

  function hideLensFlareEffects() {
    sunSpikeSprite.visible = false;
    sunSpikeMaterial.opacity = 0;
    for (const g of flareGhosts) g.visible = false;
  }

  function updateLensFlare(camera) {
    if (!lensFlareEnabled) {
      hideLensFlareEffects();
      return;
    }

    const sunOpacity = sunMaterial.opacity;
    if (sunOpacity <= 0.001) {
      hideLensFlareEffects();
      return;
    }

    // Project sun into NDC. sunSprite world position already accounts for
    // sky root tracking the camera each frame.
    sunSprite.getWorldPosition(_sunWorld);
    if (!isSunVisibleFromCameraCached(camera, _sunWorld)) {
      hideLensFlareEffects();
      return;
    }

    // Spikes track the sun's position and intensity. setSunPosition keeps
    // sunSpikeSprite at the same local pos, so we only update opacity here.
    sunSpikeSprite.visible = true;
    sunSpikeMaterial.opacity = sunOpacity;

    _sunNDC.copy(_sunWorld).project(camera);
    if (_sunNDC.z >= 1) {
      hideLensFlareEffects();
      return;
    }

    // Lens flares are strongest when the sun is on/near screen, fading off
    // as it leaves the frame.
    const dist = Math.max(Math.abs(_sunNDC.x), Math.abs(_sunNDC.y));
    const edgeFade = THREE.MathUtils.clamp(1.4 - dist, 0, 1);
    if (edgeFade <= 0) {
      for (const g of flareGhosts) g.visible = false;
      return;
    }

    camera.getWorldDirection(_camForward);
    _camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    _camUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

    const fovY = THREE.MathUtils.degToRad(camera.fov || 60);
    const halfH = Math.tan(fovY * 0.5) * FLARE_DEPTH;
    const halfW = halfH * (camera.aspect || 1);

    for (const ghost of flareGhosts) {
      const f = ghost.userData.flare;
      const gx = _sunNDC.x * (1 - f.t);
      const gy = _sunNDC.y * (1 - f.t);

      _ghostOffset
        .copy(_camForward).multiplyScalar(FLARE_DEPTH)
        .addScaledVector(_camRight, gx * halfW)
        .addScaledVector(_camUp, gy * halfH);
      ghost.position.copy(_ghostOffset);

      // Sprite scale measured as a fraction of screen height — convert to
      // world units at the flare depth.
      const worldSize = f.sizeScreen * halfH * 2;
      ghost.scale.set(worldSize, worldSize, 1);

      ghost.material.opacity = f.baseOpacity * sunOpacity * edgeFade;
      ghost.visible = ghost.material.opacity > 0.001;
    }
  }

  // Real LRO color mosaic on a sphere. The sphere gets natural perspective
  // foreshortening at the edges of a wide-FOV view (so the moon reads as
  // an ellipse when looked at off-axis) — kept on purpose so it matches
  // how everything else in the scene projects. MeshBasicMaterial means the
  // moon is always fully lit by its own texture, regardless of scene
  // lights. The sphere is oriented per frame so its prime meridian (the
  // recognisable near side) faces the camera.
  const moonTexture = loadMoonSurfaceTexture(anisotropy);
  const moonMaterial = new THREE.MeshBasicMaterial({
    map: moonTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    opacity: 0,
  });
  const moonRadius = MOON_DISC_SIZE * 0.5;
  // 32x16 sphere keeps the silhouette smooth at this on-screen size while
  // cutting triangle count ~4x vs the prior 48x32.
  const moonGeometry = new THREE.SphereGeometry(moonRadius, 32, 16);
  const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
  moonMesh.name = "sky_moon";
  moonMesh.userData.isSkyDome = true;
  moonMesh.frustumCulled = false;
  moonMesh.renderOrder = -998;
  moonMesh.castShadow = false;
  moonMesh.receiveShadow = false;
  setSkyLayer(moonMesh);
  root.add(moonMesh);

  // Halo as a flat plane (not a Sprite) so it shares the same perspective
  // foreshortening as the moon sphere. Sprites are screen-aligned and
  // always render as perfect circles, which doesn't match the elliptical
  // silhouette the moon sphere gets at the edge of the view. By aiming
  // the halo plane at the camera *position* (same axis as the sphere's
  // viewing direction), the halo squishes into the same ellipse as the
  // moon when seen off-axis.
  const moonHaloTexture = createMoonHaloTexture();
  const moonHaloMaterial = new THREE.MeshBasicMaterial({
    map: moonHaloTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  // Halo extends only ~20% past the disc on each side — a tight rim glow,
  // not a sky-wide bloom.
  const haloSize = MOON_DISC_SIZE * 1.4;
  const moonHaloGeometry = new THREE.PlaneGeometry(haloSize, haloSize);
  const moonHaloMesh = new THREE.Mesh(moonHaloGeometry, moonHaloMaterial);
  moonHaloMesh.name = "sky_moon_halo";
  moonHaloMesh.userData.isSkyDome = true;
  moonHaloMesh.frustumCulled = false;
  moonHaloMesh.renderOrder = -999;
  moonHaloMesh.castShadow = false;
  moonHaloMesh.receiveShadow = false;
  setSkyLayer(moonHaloMesh);
  root.add(moonHaloMesh);

  // Orient the moon's near side (prime meridian) at the camera, and align
  // the halo plane's normal along the same moon-to-camera axis so both
  // share the same off-axis foreshortening.
  const _moonForward = new THREE.Vector3();
  const _moonUp = new THREE.Vector3(0, 1, 0);
  const _moonRight = new THREE.Vector3();
  const _moonAdjUp = new THREE.Vector3();
  const _moonSphereBasis = new THREE.Matrix4();
  const _moonHaloBasis = new THREE.Matrix4();
  function orientMoonToCamera() {
    if (moonMesh.position.lengthSq() < 1e-6) return;
    // _moonForward = direction from moon back toward the camera (origin
    // in sky-local space, since sky root sits on the camera).
    _moonForward.copy(moonMesh.position).normalize().negate();
    _moonRight.crossVectors(_moonUp, _moonForward);
    if (_moonRight.lengthSq() < 1e-6) {
      _moonRight.set(1, 0, 0);
    } else {
      _moonRight.normalize();
    }
    _moonAdjUp.crossVectors(_moonForward, _moonRight).normalize();
    // Sphere: SphereGeometry's u=0.5 (the near side of the LROC equirect)
    // sits on its local +X axis, so we put +X along the forward vector.
    _moonSphereBasis.makeBasis(_moonForward, _moonAdjUp, _moonRight);
    moonMesh.quaternion.setFromRotationMatrix(_moonSphereBasis);
    // Halo plane: PlaneGeometry's front normal is +Z, so we put +Z along
    // the forward vector. Same forward axis as the sphere → same ellipse
    // when viewed off-axis.
    _moonHaloBasis.makeBasis(_moonRight, _moonAdjUp, _moonForward);
    moonHaloMesh.quaternion.setFromRotationMatrix(_moonHaloBasis);
  }

  let _sunOpacityBase = 0;
  let _sunRainDim = 1;

  function applySunOpacity() {
    const o = _sunOpacityBase * _sunRainDim;
    sunMaterial.opacity = o;
    sunCoreMaterial.opacity = o;
    sunSpikeMaterial.opacity = o * 0.6;
  }

  return {
    mesh: root,
    texture: dayTexture,
    nightTexture,
    setNightBlend(blend) {
      material.uniforms.uNightBlend.value = THREE.MathUtils.clamp(blend, 0, 1);
    },
    getNightBlend() {
      return material.uniforms.uNightBlend.value;
    },
    setBrightness(brightness) {
      material.uniforms.uBrightness.value = THREE.MathUtils.clamp(brightness, 0, 1);
    },
    setGreyness(g) {
      material.uniforms.uGreyness.value = THREE.MathUtils.clamp(g, 0, 1);
    },
    setLightningFlash(flash) {
      material.uniforms.uLightningFlash.value = Math.max(0, flash);
    },
    setRotation(radians) {
      material.uniforms.uRotation.value = radians;
    },
    setSunPosition(pos) {
      placeCelestialSprite(sunSprite, pos);
      placeCelestialSprite(sunCoreSprite, pos);
      placeCelestialSprite(sunSpikeSprite, pos);
    },
    setMoonPosition(pos) {
      placeCelestialSprite(moonMesh, pos);
      placeCelestialSprite(moonHaloMesh, pos);
      orientMoonToCamera();
    },
    setSunOpacity(opacity) {
      _sunOpacityBase = THREE.MathUtils.clamp(opacity, 0, 1);
      // Pull spike opacity below the disc — keeps the lines defined but
      // gentle enough that when they cross over environment edges they
      // don't look like they're cutting through the world.
      applySunOpacity();
    },
    setSunRainDim(dim) {
      _sunRainDim = THREE.MathUtils.clamp(dim, 0, 1);
      applySunOpacity();
    },
    setMoonOpacity(opacity) {
      const o = THREE.MathUtils.clamp(opacity, 0, 1);
      moonMaterial.opacity = o;
      // Subtle rim glow that frames the moon without competing with the
      // photo.
      moonHaloMaterial.opacity = o * 0.28;
    },
    setSunDiscVisible(visible) {
      sunSprite.visible = visible;
      sunCoreSprite.visible = visible;
    },
    setLensFlareEnabled(enabled) {
      lensFlareEnabled = enabled;
      if (!enabled) {
        sunSpikeSprite.visible = false;
        sunSpikeMaterial.opacity = 0;
        for (const g of flareGhosts) g.visible = false;
      }
    },
    update(camera) {
      root.position.copy(camera.position);
      updateLensFlare(camera);
    },
    dispose() {
      scene.remove(root);
      geometry.dispose();
      material.dispose();
      sunMaterial.dispose();
      sunCoreMaterial.dispose();
      sunSpikeMaterial.dispose();
      moonMaterial.dispose();
      moonHaloMaterial.dispose();
      moonGeometry.dispose();
      moonHaloGeometry.dispose();
      sunTexture.dispose();
      sunCoreTexture.dispose();
      sunSpikeTexture.dispose();
      moonTexture.dispose();
      moonHaloTexture.dispose();
      flareDiscTextureWarm.dispose();
      flareDiscTextureCool.dispose();
      flareHexTexture.dispose();
      flareRingTexture.dispose();
      for (const ghost of flareGhosts) ghost.material.dispose();
      dayTexture.dispose();
      if (nightOwned) nightTexture.dispose();
      scene.background = null;
    },
  };
}
