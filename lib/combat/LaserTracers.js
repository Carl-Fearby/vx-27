import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { setWorldLayer } from "../lighting/LightingLayers.js";
import { getLaserPalette } from "../weapons/ViewWeapon.js";

const MAX_TRACERS = 24;
/** Brief cinematic pulse — not a lingering beam. */
const TRACER_LIFE_SEC = 0.085;
/** Visible bolt length from muzzle (metres); full hitscan range stays hidden. */
const BOLT_MAX_LEN = 5.5;
const BOLT_EXTEND_PHASE = 0.2;
const CORE_LINE_WIDTH = 2.8;
const GLOW_LINE_WIDTH = 11;
const PREVIEW_LINE_WIDTH = 3.5;
const PREVIEW_OPACITY = 0.85;
const ENEMY_TRACER_PALETTE = { core: 0xfff0e8, glow: 0xff3018 };

function createTracerMaterial(color, linewidth) {
  const mat = new LineMaterial({
    color,
    linewidth,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    toneMapped: false,
    worldUnits: false,
    blending: THREE.AdditiveBlending,
  });
  mat.resolution.set(1, 1);
  return mat;
}

const _trackFrom = new THREE.Vector3();
const _trackTo = new THREE.Vector3();
const _trackDir = new THREE.Vector3();

function createLinePair(coreColor, glowColor) {
  const coreGeo = new LineGeometry();
  coreGeo.setPositions(new Float32Array(6));
  const glowGeo = new LineGeometry();
  glowGeo.setPositions(new Float32Array(6));

  const coreMat = createTracerMaterial(coreColor, CORE_LINE_WIDTH);
  const glowMat = createTracerMaterial(glowColor, GLOW_LINE_WIDTH);
  glowMat.opacity = 0.55;

  const coreLine = new Line2(coreGeo, coreMat);
  const glowLine = new Line2(glowGeo, glowMat);
  coreLine.frustumCulled = false;
  glowLine.frustumCulled = false;
  coreLine.renderOrder = 51;
  glowLine.renderOrder = 50;
  setWorldLayer(coreLine);
  setWorldLayer(glowLine);

  const group = new THREE.Group();
  group.add(glowLine);
  group.add(coreLine);

  return {
    group,
    coreLine,
    glowLine,
    coreGeo,
    glowGeo,
    coreMat,
    glowMat,
    corePositions: coreGeo.attributes.instanceStart.data.array,
    glowPositions: glowGeo.attributes.instanceStart.data.array,
    coreBuffer: coreGeo.attributes.instanceStart.data,
    glowBuffer: glowGeo.attributes.instanceStart.data,
  };
}

function setLineSegment(positions, buffer, from, to) {
  positions[0] = from.x;
  positions[1] = from.y;
  positions[2] = from.z;
  positions[3] = to.x;
  positions[4] = to.y;
  positions[5] = to.z;
  buffer.needsUpdate = true;
}

function setEntrySegment(entry, from, to) {
  setLineSegment(entry.corePositions, entry.coreBuffer, from, to);
  setLineSegment(entry.glowPositions, entry.glowBuffer, from, to);
}

function createTracerEntry() {
  const palette = getLaserPalette(false);
  const lines = createLinePair(palette.core, palette.glow);
  return {
    ...lines,
    age: 0,
    active: false,
    /** @type {{ getMuzzleWorld: Function } | null} */
    trackWeapon: null,
    /** @type {THREE.Camera | null} */
    trackCamera: null,
    /** @type {THREE.Vector3 | null} */
    impactPoint: null,
    /** @type {THREE.Vector3 | null} */
    missDirection: null,
    missRange: 0,
    lengthMul: 1,
    brightness: 1,
  };
}

function clearTracerTracking(entry) {
  entry.trackWeapon = null;
  entry.trackCamera = null;
  entry.impactPoint = null;
  entry.missDirection = null;
  entry.missRange = 0;
  entry.lengthMul = 1;
  entry.brightness = 1;
}

function resolveBoltDirection(entry, from, outDir) {
  if (entry.impactPoint) {
    outDir.subVectors(entry.impactPoint, from);
    const dist = outDir.length();
    if (dist < 1e-6) return 0;
    outDir.divideScalar(dist);
    return dist;
  }
  if (entry.missDirection && entry.missRange > 0) {
    outDir.copy(entry.missDirection);
    return entry.missRange;
  }
  return 0;
}

function applyBoltSegment(entry, from, to, lengthMul = 1) {
  _trackDir.subVectors(to, from);
  const dist = _trackDir.length();
  if (dist < 1e-6) {
    setEntrySegment(entry, from, from);
    return;
  }
  _trackDir.divideScalar(dist);
  const boltLen = Math.min(dist, BOLT_MAX_LEN) * lengthMul;
  _trackTo.copy(from).addScaledVector(_trackDir, boltLen);
  setEntrySegment(entry, from, _trackTo);
}

/**
 * Re-anchor the beam start to the live muzzle each frame (sway, bob, idle, recoil).
 * Impact stays on the crosshair ray from the shot; miss rays keep their fired direction.
 */
function refreshTrackedTracerSegment(entry) {
  const weapon = entry.trackWeapon;
  const camera = entry.trackCamera;
  if (!weapon?.getMuzzleWorld || !camera) return;

  weapon.getMuzzleWorld(_trackFrom, _trackDir, camera);
  const maxDist = resolveBoltDirection(entry, _trackFrom, _trackDir);
  if (maxDist <= 0) return;

  const boltLen = Math.min(maxDist, BOLT_MAX_LEN) * entry.lengthMul;
  _trackTo.copy(_trackFrom).addScaledVector(_trackDir, boltLen);
  setEntrySegment(entry, _trackFrom, _trackTo);
}

function applyPalette(entry, radioactive, enemy = false) {
  const palette = enemy ? ENEMY_TRACER_PALETTE : getLaserPalette(radioactive);
  entry.coreMat.color.setHex(palette.core);
  entry.glowMat.color.setHex(palette.glow);
}

function applyBrightness(entry, brightness) {
  entry.coreMat.opacity = brightness;
  entry.glowMat.opacity = 0.55 * brightness;
}

const _warmFrom = new THREE.Vector3();
const _warmTo = new THREE.Vector3();
const _warmDir = new THREE.Vector3();

/**
 * Prime Line2 laser bolt shaders during load.
 * @param {ReturnType<typeof createLaserTracerSystem>} laserTracers
 * @param {THREE.PerspectiveCamera} camera
 * @param {{
 *   frames?: number,
 *   isActive?: () => boolean,
 *   renderFrame?: () => void | Promise<void>,
 * }} [opts]
 */
export async function warmupLaserTracersGpu(laserTracers, camera, opts = {}) {
  if (!laserTracers || !camera) return;

  const frames = opts.frames ?? 12;
  const isActive = opts.isActive ?? (() => true);
  const renderFrame = opts.renderFrame;
  const stepDt = TRACER_LIFE_SEC / Math.max(4, frames * 0.55);

  camera.getWorldDirection(_warmDir);
  _warmFrom.copy(camera.position).addScaledVector(_warmDir, 0.35);
  _warmTo.copy(_warmFrom).addScaledVector(_warmDir, 10);

  for (const radioactive of [false, true]) {
    if (!isActive()) return;
    laserTracers.spawn(_warmFrom, _warmTo, { radioactive });
    for (let i = 0; i < frames; i += 1) {
      if (!isActive()) return;
      laserTracers.update(stepDt);
      if (renderFrame) await renderFrame();
    }
  }

  for (let i = 0; i < 8; i += 1) {
    if (!isActive()) return;
    laserTracers.update(stepDt);
    if (renderFrame) await renderFrame();
  }
}

/**
 * Dual Line2 layers: hot core + soft halo, quick extend then fade.
 * @param {THREE.Scene} scene
 */
export function createLaserTracerSystem(scene) {
  const pool = [];
  for (let i = 0; i < MAX_TRACERS; i += 1) {
    pool.push(createTracerEntry());
  }
  const active = [];
  const preview = createTracerEntry();
  preview.group.name = "laser_emitter_tune_preview";
  preview.coreLine.renderOrder = 53;
  preview.coreMat.linewidth = PREVIEW_LINE_WIDTH;
  preview.coreMat.opacity = PREVIEW_OPACITY;
  preview.glowLine.visible = false;

  function applyResolution(w, h) {
    for (const entry of pool) {
      entry.coreMat.resolution.set(w, h);
      entry.glowMat.resolution.set(w, h);
    }
    for (const entry of active) {
      entry.coreMat.resolution.set(w, h);
      entry.glowMat.resolution.set(w, h);
    }
    preview.coreMat.resolution.set(w, h);
    preview.glowMat.resolution.set(w, h);
  }

  function recycle(entry) {
    scene.remove(entry.group);
    entry.active = false;
    entry.age = 0;
    clearTracerTracking(entry);
    pool.push(entry);
  }

  return {
    /**
     * @param {THREE.Vector3} from
     * @param {THREE.Vector3} to
     * @param {{
     *   radioactive?: boolean,
     *   enemy?: boolean,
     *   trackWeapon?: { getMuzzleWorld: Function } | null,
     *   trackCamera?: THREE.Camera | null,
     *   impactPoint?: THREE.Vector3 | null,
     *   missDirection?: THREE.Vector3 | null,
     *   missRange?: number,
     * }} [options]
     */
    spawn(from, to, options = {}) {
      const {
        radioactive = false,
        enemy = false,
        trackWeapon = null,
        trackCamera = null,
        impactPoint = null,
        missDirection = null,
        missRange = 0,
      } = options;
      let entry = pool.pop();
      if (!entry && active.length > 0) {
        entry = active.shift();
        scene.remove(entry.group);
        entry.active = false;
        entry.age = 0;
        clearTracerTracking(entry);
      }
      if (!entry) return;

      entry.glowLine.visible = true;
      applyPalette(entry, radioactive, enemy);
      applyBrightness(entry, 1);
      entry.lengthMul = 0;
      applyBoltSegment(entry, from, to, 0);
      entry.trackWeapon = trackWeapon;
      entry.trackCamera = trackCamera;
      entry.impactPoint = impactPoint;
      entry.missDirection = missDirection;
      entry.missRange = missRange;
      entry.age = 0;
      entry.active = true;
      scene.add(entry.group);
      active.push(entry);
    },

    /**
     * Persistent live beam used by emitter tuning. It does not consume the shot
     * tracer pool or fade with age.
     * @param {THREE.Vector3} from
     * @param {THREE.Vector3} to
     * @param {{ radioactive?: boolean }} [options]
     */
    showPreview(from, to, { radioactive = false } = {}) {
      applyPalette(preview, radioactive);
      preview.coreMat.opacity = PREVIEW_OPACITY;
      setEntrySegment(preview, from, to);
      if (!preview.active) {
        preview.active = true;
        scene.add(preview.group);
      }
    },

    hidePreview() {
      if (!preview.active) return;
      scene.remove(preview.group);
      preview.active = false;
    },

    /** @param {number} dt */
    update(dt) {
      for (let i = active.length - 1; i >= 0; i -= 1) {
        const entry = active[i];
        entry.age += dt;
        const t = entry.age / TRACER_LIFE_SEC;
        if (t >= 1) {
          active.splice(i, 1);
          recycle(entry);
          continue;
        }

        let lengthMul = 1;
        let brightness = 1;
        if (t < BOLT_EXTEND_PHASE) {
          const et = t / BOLT_EXTEND_PHASE;
          lengthMul = 1 - (1 - et) ** 3;
          brightness = 1;
        } else {
          const ft = (t - BOLT_EXTEND_PHASE) / (1 - BOLT_EXTEND_PHASE);
          lengthMul = 1;
          brightness = (1 - ft) ** 2;
        }
        entry.lengthMul = lengthMul;
        entry.brightness = brightness;
        applyBrightness(entry, brightness);

        if (entry.trackWeapon) {
          refreshTrackedTracerSegment(entry);
        } else if (entry.impactPoint || entry.missDirection) {
          // Static fallback if tracking was dropped.
          const from = _trackFrom.set(
            entry.corePositions[0],
            entry.corePositions[1],
            entry.corePositions[2],
          );
          if (entry.impactPoint) {
            applyBoltSegment(entry, from, entry.impactPoint, lengthMul);
          } else if (entry.missDirection) {
            _trackTo.copy(from).addScaledVector(entry.missDirection, entry.missRange);
            applyBoltSegment(entry, from, _trackTo, lengthMul);
          }
        }
      }
    },

    /** Match canvas pixel size — required for LineMaterial screen-space width. */
    setResolution(w, h) {
      applyResolution(w, h);
    },

    dispose() {
      while (active.length > 0) {
        recycle(active.pop());
      }
      scene.remove(preview.group);
      preview.coreGeo.dispose();
      preview.glowGeo.dispose();
      preview.coreMat.dispose();
      preview.glowMat.dispose();
      for (const entry of pool) {
        scene.remove(entry.group);
        entry.coreGeo.dispose();
        entry.glowGeo.dispose();
        entry.coreMat.dispose();
        entry.glowMat.dispose();
      }
      pool.length = 0;
    },
  };
}
