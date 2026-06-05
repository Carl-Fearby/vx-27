import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { setWorldLayer } from "../lighting/LightingLayers.js";
import { getLaserPalette } from "../weapons/ViewWeapon.js";

const MAX_TRACERS = 24;
const TRACER_LIFE_SEC = 0.12;
const TRACER_LINE_WIDTH = 5;

function createTracerMaterial(color) {
  const mat = new LineMaterial({
    color,
    linewidth: TRACER_LINE_WIDTH,
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

function createTracerEntry() {
  const geo = new LineGeometry();
  const mat = createTracerMaterial(getLaserPalette(false).core);
  const line = new Line2(geo, mat);
  line.frustumCulled = false;
  line.renderOrder = 50;
  setWorldLayer(line);
  return { line, geo, mat, age: 0, active: false };
}

/**
 * Short-lived muzzle→impact lines (hitscan VFX only — no traveling bolts).
 * Uses Line2 so width is visible (plain Line is ~1px on most GPUs).
 * @param {THREE.Scene} scene
 */
export function createLaserTracerSystem(scene) {
  const pool = [];
  for (let i = 0; i < MAX_TRACERS; i += 1) {
    pool.push(createTracerEntry());
  }
  const active = [];

  function applyResolution(w, h) {
    for (const entry of pool) {
      entry.mat.resolution.set(w, h);
    }
    for (const entry of active) {
      entry.mat.resolution.set(w, h);
    }
  }

  function recycle(entry) {
    scene.remove(entry.line);
    entry.active = false;
    entry.age = 0;
    pool.push(entry);
  }

  return {
    /**
     * @param {THREE.Vector3} from
     * @param {THREE.Vector3} to
     * @param {{ radioactive?: boolean }} [options]
     */
    spawn(from, to, { radioactive = false } = {}) {
      let entry = pool.pop();
      if (!entry && active.length > 0) {
        entry = active.shift();
        scene.remove(entry.line);
        entry.active = false;
        entry.age = 0;
      }
      if (!entry) return;

      entry.mat.color.setHex(getLaserPalette(radioactive).core);
      entry.mat.opacity = 1;
      entry.geo.setPositions([
        from.x,
        from.y,
        from.z,
        to.x,
        to.y,
        to.z,
      ]);
      entry.line.computeLineDistances();
      entry.age = 0;
      entry.active = true;
      scene.add(entry.line);
      active.push(entry);
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
        entry.mat.opacity = 1 - t * t;
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
      for (const entry of pool) {
        scene.remove(entry.line);
        entry.geo.dispose();
        entry.mat.dispose();
      }
      pool.length = 0;
    },
  };
}
