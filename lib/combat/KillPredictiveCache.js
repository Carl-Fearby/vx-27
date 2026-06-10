import * as THREE from "three";
import { hasLineOfSightToPoint } from "./LineOfSight.js";
import {
  clearTargetKillPredictiveCache,
  ensureTargetRagdollTemplate,
  reservePredictiveRagdollMaterial,
  warmHeadshotRagdollGpu,
} from "./Targets.js";
import {
  collidersForRagdollNear,
  resolveVx27ContainerForPlayer,
} from "../vx27-container/Vx27Container.js";

/** Max distance (m) for LOS-based engagement pre-bake. */
export const KILL_PREDICT_ENGAGE_RANGE = 28;
const KILL_PREDICT_ENGAGE_RANGE_SQ =
  KILL_PREDICT_ENGAGE_RANGE * KILL_PREDICT_ENGAGE_RANGE;

/** Delay before reserving material for LOS targets (co-container is instant). */
export const KILL_PREDICT_LOS_MAT_SEC = 0.12;
/** Delay before queuing GPU bake for LOS targets (co-container is instant). */
export const KILL_PREDICT_LOS_GPU_SEC = 0.3;
/** Re-cache ragdoll colliders at most this often for LOS targets (m). */
const KILL_PREDICT_COLLIDER_REFRESH_DIST_SQ = 0.45 * 0.45;

const _chestPos = new THREE.Vector3();

/** @type {Map<THREE.Mesh, { time: number, coContainer: boolean, colliderX: number, colliderZ: number }>} */
const _engaged = new Map();

/** @type {{ scene: THREE.Scene, mesh: THREE.Mesh, hitZone: string, priority: number }[]} */
let _gpuWarmQueue = [];

/**
 * Game-logic engagement: same VX-27 container as player, or in range with clear LOS.
 * @param {{
 *   playerX: number,
 *   playerZ: number,
 *   camera: THREE.Camera,
 *   liveTargets: THREE.Mesh[],
 *   levelHitMeshes: THREE.Object3D[],
 *   containers: THREE.Object3D[],
 *   allColliders: import("../physics/Collision.js").ColliderBox[],
 * }} ctx
 * @returns {{ mesh: THREE.Mesh, coContainer: boolean, priority: number }[]}
 */
export function collectEngagementTargets(ctx) {
  const playerContainer = resolveVx27ContainerForPlayer(
    ctx.playerX,
    ctx.playerZ,
    ctx.containers,
    ctx.allColliders
  );
  const camPos = ctx.camera.position;
  /** @type {{ mesh: THREE.Mesh, coContainer: boolean, priority: number }[]} */
  const out = [];

  for (const mesh of ctx.liveTargets) {
    if (!mesh?.userData?.isTarget || mesh.userData.health <= 0) continue;

    const tx = mesh.position.x;
    const tz = mesh.position.z;
    const targetContainer = resolveVx27ContainerForPlayer(
      tx,
      tz,
      ctx.containers,
      ctx.allColliders
    );
    const coContainer = !!(playerContainer && targetContainer === playerContainer);
    if (coContainer) {
      out.push({ mesh, coContainer: true, priority: 0 });
      continue;
    }

    const height = mesh.userData.height ?? 1.75;
    _chestPos.set(tx, mesh.position.y + height * 0.55, tz);
    const dx = _chestPos.x - camPos.x;
    const dy = _chestPos.y - camPos.y;
    const dz = _chestPos.z - camPos.z;
    if (dx * dx + dy * dy + dz * dz > KILL_PREDICT_ENGAGE_RANGE_SQ) continue;
    if (
      !hasLineOfSightToPoint(camPos, _chestPos, ctx.levelHitMeshes, {
        blockEpsilon: 0.35,
      })
    ) {
      continue;
    }

    out.push({ mesh, coContainer: false, priority: 1 });
  }

  out.sort((a, b) => a.priority - b.priority);
  return out;
}

/** @param {THREE.Mesh} mesh @param {import("../physics/Collision.js").ColliderBox[]} colliders @param {THREE.Object3D[]} containers */
function cachePredictiveDeathColliders(mesh, colliders, containers) {
  mesh.userData.predictiveDeathColliders = collidersForRagdollNear(
    mesh.position.x,
    mesh.position.z,
    colliders,
    containers
  );
}

/**
 * @param {THREE.Mesh} mesh
 * @param {THREE.Scene} scene
 * @param {number} priority
 */
function queueGpuWarm(mesh, scene, priority) {
  if (mesh.userData.predictiveKillGpuWarmed) return;
  const existing = _gpuWarmQueue.find((q) => q.mesh === mesh);
  if (existing) {
    existing.priority = Math.min(existing.priority, priority);
    _gpuWarmQueue.sort((a, b) => a.priority - b.priority);
    return;
  }
  _gpuWarmQueue.push({ scene, mesh, hitZone: "head", priority });
  _gpuWarmQueue.sort((a, b) => a.priority - b.priority);
}

/**
 * Pre-cache kill path from game state — co-container targets and LOS threats.
 * @param {{
 *   playerX: number,
 *   playerZ: number,
 *   camera: THREE.Camera,
 *   liveTargets: THREE.Mesh[],
 *   levelHitMeshes: THREE.Object3D[],
 *   raycaster: THREE.Raycaster,
 *   scene: THREE.Scene,
 *   allColliders: import("../physics/Collision.js").ColliderBox[],
 *   containers: THREE.Object3D[],
 *   dt: number,
 *   enabled?: boolean,
 * }} ctx
 */
export function updateKillPredictiveCache(ctx) {
  if (ctx.enabled === false) {
    for (const mesh of _engaged.keys()) {
      clearTargetKillPredictiveCache(mesh);
    }
    _engaged.clear();
    _gpuWarmQueue = [];
    return;
  }

  const engagedList = collectEngagementTargets(ctx);
  const nextMeshes = new Set(engagedList.map((e) => e.mesh));

  for (const mesh of _engaged.keys()) {
    if (nextMeshes.has(mesh)) continue;
    clearTargetKillPredictiveCache(mesh);
    _engaged.delete(mesh);
    _gpuWarmQueue = _gpuWarmQueue.filter((q) => q.mesh !== mesh);
  }

  const dt = Math.max(0, ctx.dt);
  for (const { mesh, coContainer } of engagedList) {
    let entry = _engaged.get(mesh);
    if (!entry) {
      entry = { time: 0, coContainer };
      _engaged.set(mesh, entry);
    } else {
      entry.coContainer = coContainer;
    }
    entry.time += dt;

    ensureTargetRagdollTemplate(mesh);

    const tx = mesh.position.x;
    const tz = mesh.position.z;
    const colliderMoved =
      entry.colliderX == null ||
      entry.colliderZ == null ||
      (tx - entry.colliderX) ** 2 + (tz - entry.colliderZ) ** 2 >=
        KILL_PREDICT_COLLIDER_REFRESH_DIST_SQ;
    if (coContainer || colliderMoved) {
      cachePredictiveDeathColliders(mesh, ctx.allColliders, ctx.containers);
      entry.colliderX = tx;
      entry.colliderZ = tz;
    }

    if (coContainer || entry.time >= KILL_PREDICT_LOS_MAT_SEC) {
      reservePredictiveRagdollMaterial(mesh);
    }

    if (
      (coContainer || entry.time >= KILL_PREDICT_LOS_GPU_SEC) &&
      !mesh.userData.predictiveKillGpuWarmed
    ) {
      queueGpuWarm(mesh, ctx.scene, coContainer ? 0 : 1);
    }
  }
}

/** One invisible ragdoll bake per frame — spreads GPU work before the kill. */
export function flushKillPredictiveGpuWarm() {
  if (!_gpuWarmQueue.length) return;
  const { scene, mesh, hitZone } = _gpuWarmQueue.shift();
  if (!mesh?.userData?.isTarget || mesh.userData.health <= 0) return;
  warmHeadshotRagdollGpu(scene, mesh, { hitZone, hide: true });
  mesh.userData.predictiveKillGpuWarmed = true;

  if (
    mesh.userData.predictiveRagdollMat == null &&
    _engaged.has(mesh)
  ) {
    reservePredictiveRagdollMaterial(mesh);
  }
}

export function resetKillPredictiveCache() {
  for (const mesh of _engaged.keys()) {
    clearTargetKillPredictiveCache(mesh);
  }
  _engaged.clear();
  _gpuWarmQueue = [];
}
