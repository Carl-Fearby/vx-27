import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { setWorldLayer } from "../lighting/LightingLayers.js";
import {
  getEnemyMuzzleWorldPosition,
} from "./EnemyRig.js";

const MAX_MARKERS = 48;
const STUB_LENGTH = 0.55;
const DOT_RADIUS = 0.045;

function createPreviewStub() {
  const geometry = new LineGeometry();
  geometry.setPositions([0, 0, 0, 0, 0, STUB_LENGTH]);
  const material = new LineMaterial({
    color: 0xff5522,
    linewidth: 3.5,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    worldUnits: false,
    blending: THREE.AdditiveBlending,
  });
  material.resolution.set(1, 1);
  const line = new Line2(geometry, material);
  line.frustumCulled = false;
  line.renderOrder = 62;
  setWorldLayer(line);
  return { line, geometry, material };
}

function createPreviewDot() {
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(DOT_RADIUS, 14, 14),
    new THREE.MeshBasicMaterial({
      color: 0xff6633,
      toneMapped: false,
      transparent: true,
      opacity: 0.98,
      depthTest: false,
      depthWrite: false,
    }),
  );
  dot.renderOrder = 63;
  setWorldLayer(dot);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(DOT_RADIUS * 2.2, 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffaa44,
      toneMapped: false,
      transparent: true,
      opacity: 0.35,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.renderOrder = 61;
  setWorldLayer(halo);
  return { dot, halo };
}

/**
 * World-space markers at rifle enemy laser origins while the rig wizard is open.
 * @param {THREE.Scene} scene
 */
export function createEnemyMuzzlePreviewSystem(scene) {
  /** @type {{ group: THREE.Group, stub: ReturnType<typeof createPreviewStub>, dot: ReturnType<typeof createPreviewDot> }[]} */
  const markers = [];
  let visible = false;
  let resolutionW = 1;
  let resolutionH = 1;

  for (let i = 0; i < MAX_MARKERS; i += 1) {
    const group = new THREE.Group();
    group.name = "enemy-muzzle-preview";
    group.visible = false;
    const stub = createPreviewStub();
    const dot = createPreviewDot();
    group.add(dot.halo);
    group.add(stub.line);
    group.add(dot.dot);
    scene.add(group);
    markers.push({ group, stub, dot });
  }

  return {
    setVisible(next) {
      visible = next === true;
      if (!visible) {
        for (const marker of markers) {
          marker.group.visible = false;
        }
      }
    },

    isVisible() {
      return visible;
    },

    /** @param {THREE.Mesh[]} targets */
    update(targets) {
      if (!visible) return;
      let used = 0;
      for (const marker of markers) {
        marker.group.visible = false;
      }
      if (!targets?.length) return;

      for (const mesh of targets) {
        if (!mesh?.userData?.hasRifle || !mesh.userData.enemyRifle) continue;
        if (used >= markers.length) break;
        const marker = markers[used];
        used += 1;
        getEnemyMuzzleWorldPosition(mesh, marker.group.position);
        marker.group.quaternion.copy(mesh.quaternion);
        marker.group.visible = true;
      }
    },

    setResolution(w, h) {
      resolutionW = w;
      resolutionH = h;
      for (const marker of markers) {
        marker.stub.material.resolution.set(w, h);
      }
    },

    dispose() {
      for (const marker of markers) {
        scene.remove(marker.group);
        marker.stub.geometry.dispose();
        marker.stub.material.dispose();
        marker.dot.dot.geometry.dispose();
        marker.dot.dot.material.dispose();
        marker.dot.halo.geometry.dispose();
        marker.dot.halo.material.dispose();
      }
      markers.length = 0;
    },
  };
}
