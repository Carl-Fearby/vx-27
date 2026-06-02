import * as THREE from "three";
import { isBulletPassthroughMesh } from "./BulletHoles.js";
import {
  ROOM_INTERIOR_LAYER,
  WORLD_LAYER,
} from "./LightingLayers.js";

const _dir = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _hits = [];

_ray.layers.enable(WORLD_LAYER);
_ray.layers.enable(ROOM_INTERIOR_LAYER);

/**
 * True when no solid level mesh blocks the segment (used for fire, grenades, flashbangs).
 * @param {THREE.Vector3} from
 * @param {THREE.Vector3} to
 * @param {THREE.Object3D[]} hitMeshes Flat mesh list from {@link collectLevelHitMeshes}.
 * @param {{ blockEpsilon?: number, near?: number }} [options]
 */
export function hasLineOfSightToPoint(from, to, hitMeshes, options = {}) {
  if (!hitMeshes?.length || !from || !to) return true;

  const blockEpsilon = options.blockEpsilon ?? 0.45;
  const near = options.near ?? 0.05;

  _dir.subVectors(to, from);
  const dist = _dir.length();
  if (dist < near + blockEpsilon) return true;

  _dir.multiplyScalar(1 / dist);
  _ray.set(from, _dir);
  _ray.far = dist - blockEpsilon;
  _ray.near = near;

  _hits.length = 0;
  _ray.intersectObjects(hitMeshes, false, _hits);
  for (const hit of _hits) {
    if (hit.object.isSprite) continue;
    if (isBulletPassthroughMesh(hit.object)) continue;
    return false;
  }
  return true;
}
